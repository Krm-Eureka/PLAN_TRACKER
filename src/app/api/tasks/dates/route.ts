// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { logActivity } from "@/lib/logger";
import { getSessionContext, canEditTask } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export async function PUT(req: NextRequest) {
  try {
    const ctx = await getSessionContext();
    if (!ctx) return NextResponse.json({ status: "error", message: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { task_id, start_date, due_date, percent_complete, update_date } = body;

    if (!task_id) {
      return NextResponse.json({ status: "error", message: "Missing task_id" }, { status: 400 });
    }

    const task = await prisma.task.findUnique({
      where: { id: task_id }
    });

    if (!task) {
      return NextResponse.json({ status: "error", message: "Task not found" }, { status: 404 });
    }

    const project = await prisma.project.findFirst({
      where: {
        OR: [
          { id: task.project_id },
          { project_code: task.project_id }
        ]
      }
    });

    if (!(await canEditTask(ctx, task, project || undefined))) {
      return NextResponse.json({ status: "error", message: "Forbidden: You do not have permission to edit this task." }, { status: 403 });
    }

    const dataToUpdate: any = {};
    if (start_date !== undefined) dataToUpdate.start_date = start_date;
    if (due_date !== undefined) dataToUpdate.due_date = due_date;
    if (update_date !== undefined) dataToUpdate.update_date = update_date;
    if (percent_complete !== undefined) dataToUpdate.percent_complete = String(percent_complete);

    await prisma.task.update({
      where: { id: task_id },
      data: dataToUpdate
    });

    revalidatePath("/tasks");
    
    if (ctx) {
      await logActivity(ctx.token, {
        action: 'UPDATE TASK DATES',
        project_id: task.project_id || "",
        project_name: task.task_name,
        user_name: ctx.name_en || ctx.name_th || ctx.email,
        user_email: ctx.email
      });
    }

    return NextResponse.json({ status: "success", message: "Task updated successfully" });
  } catch (error: unknown) {
    const err = error as Error;
    console.error("PUT /api/tasks/dates error:", err);
    return NextResponse.json({ status: "error", message: err.message || "Failed to update task" }, { status: 500 });
  }
}
