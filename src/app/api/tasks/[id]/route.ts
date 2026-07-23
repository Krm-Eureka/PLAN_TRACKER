// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getSessionContext, canEditTask } from "@/lib/permissions";
import { v7 as uuidv7 } from "uuid";
import { prisma } from "@/lib/prisma";
import { updateProjectAndParentTasks } from "@/lib/taskUpdater";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getSessionContext();
    if (!ctx) return NextResponse.json({ status: "error", message: "Unauthorized" }, { status: 401 });

    const resolvedParams = await params;
    const taskId = resolvedParams.id;
    const body = await req.json();

    const existingTask = await prisma.task.findUnique({
      where: { id: taskId }
    });
    
    if (!existingTask) {
      return NextResponse.json({ status: "error", message: "Task not found" }, { status: 404 });
    }

    const project = await prisma.project.findFirst({
      where: {
        OR: [
          { id: existingTask.project_id },
          { project_code: existingTask.project_id }
        ]
      }
    });
    
    if (!(await canEditTask(ctx, existingTask, project || undefined))) {
      return NextResponse.json({ status: "error", message: "Forbidden: You do not have permission to edit this task." }, { status: 403 });
    }
    
    const { task_name, description, assignee_id, start_date, due_date, status, priority, parent_task_id, percent_complete, custom_data } = body;
    
    const assigneeIdsArray = Array.isArray(assignee_id) ? assignee_id : (assignee_id ? [assignee_id] : []);
    const assigneeIdString = assigneeIdsArray.join(", ");

    let assigneeNameString = existingTask.assignee_name || "";

    if (assigneeIdString !== existingTask.assignee_id) {
      if (assigneeIdsArray.length > 0) {
        try {
          const users = await prisma.user.findMany({
            where: { id: { in: assigneeIdsArray } }
          });
          const names = assigneeIdsArray.map((id: string) => {
            const found = users.find(u => u.id === id);
            return found?.name_en || found?.name_th || id;
          });
          assigneeNameString = names.join(", ");
        } catch {
          // ignore
        }
      } else {
        assigneeNameString = "";
      }
    }

    const updateDate = (status === "Done" || status === "Complete") 
      ? new Date().toISOString().split("T")[0] 
      : existingTask.update_date;

    await prisma.task.update({
      where: { id: taskId },
      data: {
        task_name: task_name !== undefined ? task_name : existingTask.task_name,
        description: description !== undefined ? description : existingTask.description,
        assignee_id: assigneeIdString,
        assignee_name: assigneeNameString,
        start_date: start_date !== undefined ? start_date : existingTask.start_date,
        due_date: due_date !== undefined ? due_date : existingTask.due_date,
        status: status !== undefined ? status : existingTask.status,
        priority: priority !== undefined ? priority : existingTask.priority,
        parent_task_id: parent_task_id !== undefined ? parent_task_id : existingTask.parent_task_id,
        percent_complete: percent_complete !== undefined ? String(percent_complete) : existingTask.percent_complete,
        update_date: updateDate,
        custom_data: custom_data !== undefined ? custom_data : existingTask.custom_data
      }
    });

    // --- NOTIFICATION LOGIC ---
    const oldAssignees = new Set((existingTask.assignee_id || "").split(",").map(s => s.trim()).filter(Boolean));
    const newAssignees = new Set(assigneeIdsArray as string[]);
    const addedAssignees = Array.from(newAssignees).filter(id => !oldAssignees.has(id));
    
    if (addedAssignees.length > 0) {
      try {
        const notificationsData = addedAssignees.filter(uid => uid !== ctx.id).map(uid => ({
          id: uuidv7(),
          user_id: uid,
          title: `Task Assignment: ${task_name || existingTask.task_name}`,
          message: `You have been assigned to task: ${task_name || existingTask.task_name}`,
          link: `/projects/${encodeURIComponent(existingTask.project_id || "")}`,
          is_read: false
        }));

        if (notificationsData.length > 0) {
          await prisma.notification.createMany({
            data: notificationsData
          });
        }
      } catch (e) {
        console.error("Failed to send assignment notifications:", e);
      }
    }

    // Auto-update parent tasks and project progress
    if (existingTask.project_id) {
      await updateProjectAndParentTasks(existingTask.project_id);
    }

    revalidatePath("/projects");
    revalidatePath(`/projects/${encodeURIComponent(existingTask.project_id || "")}`);

    return NextResponse.json({ status: "success", message: "Task updated successfully" });
  } catch (error: unknown) {
    const err = error as Error;
    console.error("API error updating task:", err);
    return NextResponse.json({ status: "error", message: err.message || "Failed to update task" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getSessionContext();
    if (!ctx) return NextResponse.json({ status: "error", message: "Unauthorized" }, { status: 401 });

    const resolvedParams = await params;
    const taskId = resolvedParams.id;

    const existingTask = await prisma.task.findUnique({ where: { id: taskId } });
    if (!existingTask) {
      return NextResponse.json({ status: "error", message: "Task not found" }, { status: 404 });
    }

    const project = await prisma.project.findFirst({
      where: {
        OR: [
          { id: existingTask.project_id },
          { project_code: existingTask.project_id }
        ]
      }
    });

    if (!(await canEditTask(ctx, existingTask, project || undefined))) {
      return NextResponse.json({ status: "error", message: "Forbidden: You do not have permission to delete this task." }, { status: 403 });
    }

    await prisma.task.delete({ where: { id: taskId } });

    if (existingTask.project_id) {
      await updateProjectAndParentTasks(existingTask.project_id);
    }

    if (ctx) {
      await prisma.log.create({
        data: {
          id: uuidv7(),
          action: 'DELETE TASK',
          project_id: existingTask.project_id || "",
          project_name: existingTask.task_name || "Unknown Task",
          user_name: ctx.name_en || ctx.name_th || ctx.email,
          user_email: ctx.email
        }
      });
    }

    revalidatePath("/projects");
    revalidatePath(`/projects/${encodeURIComponent(existingTask.project_id || "")}`);
    revalidatePath("/", "layout");

    return NextResponse.json({ status: "success", message: "Task deleted successfully" });
  } catch (error: unknown) {
    const err = error as Error;
    console.error("API error deleting task:", err);
    return NextResponse.json({ status: "error", message: err.message || "Failed to delete task" }, { status: 500 });
  }
}

