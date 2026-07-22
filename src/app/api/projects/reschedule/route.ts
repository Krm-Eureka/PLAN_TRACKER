// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { revalidatePath, revalidateTag } from "next/cache";
import { getSessionContext } from "@/lib/permissions";
import { v7 as uuidv7 } from "uuid";

function shiftDate(dateStr: string | null, deltaDays: number): string | null {
  if (!dateStr) return dateStr;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  d.setDate(d.getDate() + deltaDays);
  return d.toISOString().split("T")[0];
}

const SKIP_STATUSES = ["done", "complete", "completed", "cancel", "cancelled"];

export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const user_id = (session as { id?: string })?.id;
    if (!user_id) {
      return NextResponse.json({ status: "error", message: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { project_id, mode, shift_days, new_end_date } = body;

    if (!project_id || !mode) {
      return NextResponse.json({ status: "error", message: "Missing project_id or mode" }, { status: 400 });
    }

    if (!["shift_days", "set_end_date", "on_hold"].includes(mode)) {
      return NextResponse.json({ status: "error", message: "Invalid mode" }, { status: 400 });
    }

    // --- 1. Fetch Project and Tasks ---
    let actualProject = await prisma.project.findUnique({
      where: { id: project_id },
      include: { tasks: true }
    });

    if (!actualProject) {
      // Also try by project_code
      actualProject = await prisma.project.findUnique({
        where: { project_code: project_id },
        include: { tasks: true }
      });
    }

    if (!actualProject) {
      return NextResponse.json({ status: "error", message: "Project not found" }, { status: 404 });
    }

    const projectTasks = actualProject.tasks;
    let tasksUpdated = 0;

    // --- 2. Compute delta and run updates ---
    if (mode === "on_hold") {
      // Change project status to On Hold
      await prisma.project.update({
        where: { id: actualProject.id },
        data: { status: "On Hold" }
      });

      // Change all active tasks to On Hold
      for (const task of projectTasks) {
        const taskStatus = (task.status || "").toLowerCase();
        if (SKIP_STATUSES.includes(taskStatus)) continue; // skip done/cancel

        await prisma.task.update({
          where: { id: task.id },
          data: { status: "On Hold" }
        });
        tasksUpdated++;
      }
    } else {
      // Calculate delta days
      let deltaDays = 0;

      if (mode === "shift_days") {
        deltaDays = parseInt(shift_days || "0", 10);
        if (isNaN(deltaDays) || deltaDays === 0) {
          return NextResponse.json({ status: "error", message: "shift_days must be a non-zero integer" }, { status: 400 });
        }
      } else if (mode === "set_end_date") {
        if (!new_end_date) {
          return NextResponse.json({ status: "error", message: "new_end_date is required for set_end_date mode" }, { status: 400 });
        }
        const oldEnd = actualProject.end_date ? new Date(actualProject.end_date) : null;
        const newEnd = new Date(new_end_date);
        if (!oldEnd || isNaN(oldEnd.getTime()) || isNaN(newEnd.getTime())) {
          return NextResponse.json({ status: "error", message: "Invalid end dates" }, { status: 400 });
        }
        deltaDays = Math.round((newEnd.getTime() - oldEnd.getTime()) / (1000 * 60 * 60 * 24));
        if (deltaDays === 0) {
          return NextResponse.json({ status: "error", message: "New end date is the same as the current end date" }, { status: 400 });
        }
      }

      // Update project start_date and end_date
      const newProjectData: any = {};
      if (actualProject.start_date) {
        newProjectData.start_date = shiftDate(actualProject.start_date, deltaDays);
      }
      if (actualProject.end_date) {
        newProjectData.end_date = mode === "set_end_date" ? new_end_date : shiftDate(actualProject.end_date, deltaDays);
      }

      if (Object.keys(newProjectData).length > 0) {
        await prisma.project.update({
          where: { id: actualProject.id },
          data: newProjectData
        });
      }

      // Update tasks (skip Done/Cancel)
      for (const task of projectTasks) {
        const taskStatus = (task.status || "").toLowerCase();
        if (SKIP_STATUSES.includes(taskStatus)) continue;

        const newTaskData: any = {};
        if (task.start_date) newTaskData.start_date = shiftDate(task.start_date, deltaDays);
        if (task.due_date) newTaskData.due_date = shiftDate(task.due_date, deltaDays);

        if (Object.keys(newTaskData).length > 0) {
          await prisma.task.update({
            where: { id: task.id },
            data: newTaskData
          });
          tasksUpdated++;
        }
      }
    }

    // --- 3. Log + Revalidate ---
    const ctx = await getSessionContext();
    if (ctx) {
      const modeLabel = mode === "on_hold" ? "Set to On Hold" : mode === "shift_days" ? `Shifted +${shift_days} days` : `New end date: ${new_end_date}`;
      await prisma.log.create({
        data: {
          id: uuidv7(),
          action: "RESCHEDULE PROJECT",
          project_id: actualProject.id,
          project_name: `${actualProject.project_name || actualProject.id} — ${modeLabel}`,
          user_name: ctx.name_en || ctx.name_th || ctx.email,
          user_email: ctx.email,
        }
      });
    }

    revalidatePath("/projects");
    revalidatePath(`/projects/${actualProject.id}`);

    return NextResponse.json({
      status: "success",
      message: mode === "on_hold"
        ? `Project and ${tasksUpdated} tasks set to On Hold`
        : `Project and ${tasksUpdated} tasks rescheduled`,
      updated_tasks: tasksUpdated,
    });
  } catch (error: unknown) {
    const err = error as Error;
    console.error("PUT /api/projects/reschedule error:", err);
    return NextResponse.json({ status: "error", message: err.message || "Failed to reschedule project" }, { status: 500 });
  }
}
