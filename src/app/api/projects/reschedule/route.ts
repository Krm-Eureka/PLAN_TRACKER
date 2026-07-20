import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import {
  fetchSheetData,
  getSheetHeaders,
  getColumnLetter,
  batchUpdateSheetValues,
} from "@/lib/googleSheets";
import { revalidatePath, revalidateTag } from "next/cache";
import { logActivity } from "@/lib/logger";
import { getSessionContext } from "@/lib/permissions";

function shiftDate(dateStr: string, deltaDays: number): string {
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
    const token = (session as { accessToken?: string })?.accessToken;
    if (!token) {
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

    // --- 1. Fetch Projects and Tasks ---
    const [projectsRaw, tasksRaw, projectHeaders, taskHeaders] = await Promise.all([
      fetchSheetData(token, "Projects!A:Z"),
      fetchSheetData(token, "Tasks!A:Z"),
      getSheetHeaders(token, "Projects"),
      getSheetHeaders(token, "Tasks"),
    ]);

    // Find project
    const projectIdx = projectsRaw.findIndex(
      (p) => p.id === project_id || p.project_code === project_id
    );
    if (projectIdx === -1) {
      return NextResponse.json({ status: "error", message: "Project not found" }, { status: 404 });
    }

    const project = projectsRaw[projectIdx];
    const projectRowIndex = projectIdx + 2;

    // Find tasks belonging to this project
    const projectTasks = tasksRaw
      .map((t, i): any => ({ ...t, _sheetRow: i + 2 }))
      .filter((t: any) => t.project_id === project_id || t.project_id === project.id);

    // --- 2. Compute delta and new dates based on mode ---
    const batchData: { range: string; values: string[][] }[] = [];

    // Helper: column letters for projects
    const pStartCol = getColumnLetter(projectHeaders.indexOf("start_date"));
    const pEndCol = getColumnLetter(projectHeaders.indexOf("end_date"));
    const pStatusCol = getColumnLetter(projectHeaders.indexOf("status"));

    // Helper: column letters for tasks
    const tStartColIdx = taskHeaders.indexOf("start_date");
    const tDueColIdx = taskHeaders.indexOf("due_date");
    const tStatusColIdx = taskHeaders.indexOf("status");

    if (mode === "on_hold") {
      // Change project status to On Hold
      if (pStatusCol && pStatusCol !== "@") {
        batchData.push({
          range: `Projects!${pStatusCol}${projectRowIndex}`,
          values: [["On Hold"]],
        });
      }

      // Change all active tasks to On Hold
      for (const task of projectTasks) {
        const taskStatus = (task.status || "").toLowerCase();
        if (SKIP_STATUSES.includes(taskStatus)) continue; // skip done/cancel

        if (tStatusColIdx !== -1) {
          const tStatusCol = getColumnLetter(tStatusColIdx);
          batchData.push({
            range: `Tasks!${tStatusCol}${task._sheetRow}`,
            values: [["On Hold"]],
          });
        }
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
        const oldEnd = project.end_date ? new Date(project.end_date) : null;
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
      if (project.start_date && pStartCol && pStartCol !== "@") {
        batchData.push({
          range: `Projects!${pStartCol}${projectRowIndex}`,
          values: [[shiftDate(project.start_date, deltaDays)]],
        });
      }
      if (project.end_date && pEndCol && pEndCol !== "@") {
        const newEndDate = mode === "set_end_date" ? new_end_date : shiftDate(project.end_date, deltaDays);
        batchData.push({
          range: `Projects!${pEndCol}${projectRowIndex}`,
          values: [[newEndDate]],
        });
      }

      // Update tasks (skip Done/Cancel)
      for (const task of projectTasks) {
        const taskStatus = (task.status || "").toLowerCase();
        if (SKIP_STATUSES.includes(taskStatus)) continue;

        if (task.start_date && tStartColIdx !== -1) {
          batchData.push({
            range: `Tasks!${getColumnLetter(tStartColIdx)}${task._sheetRow}`,
            values: [[shiftDate(task.start_date, deltaDays)]],
          });
        }
        if (task.due_date && tDueColIdx !== -1) {
          batchData.push({
            range: `Tasks!${getColumnLetter(tDueColIdx)}${task._sheetRow}`,
            values: [[shiftDate(task.due_date, deltaDays)]],
          });
        }
      }
    }

    // --- 3. Execute batch update ---
    if (batchData.length === 0) {
      return NextResponse.json({ status: "success", message: "No changes needed", updated: 0 });
    }

    await batchUpdateSheetValues(token, batchData);

    // --- 4. Log + Revalidate ---
    const ctx = await getSessionContext();
    if (ctx) {
      const modeLabel = mode === "on_hold" ? "Set to On Hold" : mode === "shift_days" ? `Shifted +${shift_days} days` : `New end date: ${new_end_date}`;
      await logActivity(token, {
        action: "RESCHEDULE PROJECT",
        project_id: project_id,
        project_name: `${project.project_name || project_id} — ${modeLabel}`,
        user_name: ctx.name_en || ctx.name_th || ctx.email,
        user_email: ctx.email,
      });
    }

    revalidatePath("/projects");
    revalidatePath(`/projects/${project_id}`);
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    revalidateTag("projects");
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    revalidateTag("tasks");

    const tasksUpdated = projectTasks.filter((t) => !SKIP_STATUSES.includes((t.status || "").toLowerCase())).length;

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
