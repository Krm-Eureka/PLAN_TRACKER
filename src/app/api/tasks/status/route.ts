// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { logActivity } from "@/lib/logger";
import { getSessionContext, canEditTask } from "@/lib/permissions";
import { getAutoAdjustedPercent } from "@/utils/progress";
import { prisma } from "@/lib/prisma";

function toDateString(d: Date): string {
  return d.toISOString().split("T")[0]; // YYYY-MM-DD
}

function isDelayed(dueDateStr: string, endDateStr: string): boolean {
  if (!dueDateStr || !endDateStr) return false;
  const due = new Date(dueDateStr);
  const end = new Date(endDateStr);
  due.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  return end > due;
}

async function updateProjectProgress(projectId: string) {
  if (!projectId) return;

  const projectTasks = await prisma.task.findMany({
    where: { project_id: projectId }
  });
  
  if (projectTasks.length === 0) return;

  const countableTasks = projectTasks.filter(t => !(t.status || '').toLowerCase().includes('cancel'));
  const completedCount = countableTasks.filter(t => {
    const s = (t.status || '').toLowerCase();
    return s.includes('done') || s.includes('complete');
  }).length;

  const projectProgress = countableTasks.length > 0
    ? Math.round((completedCount / countableTasks.length) * 100)
    : 0;

  const project = await prisma.project.findUnique({
    where: { id: projectId }
  });

  if (project) {
    const currentStatus = project.status || '';
    let newStatus = currentStatus;

    if (projectProgress === 100 && !['done', 'complete', 'completed'].includes(currentStatus.toLowerCase())) {
      newStatus = 'Done';
    } else if (projectProgress < 100 && ['done', 'complete', 'completed'].includes(currentStatus.toLowerCase())) {
      newStatus = 'In Progress';
    }

    await prisma.project.update({
      where: { id: projectId },
      data: {
        progress: String(projectProgress),
        status: newStatus
      }
    });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const ctx = await getSessionContext();
    if (!ctx) return NextResponse.json({ status: "error", message: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { task_id, new_status, task_name } = body;

    if (!task_id || !new_status) {
      return NextResponse.json({ status: "error", message: "Missing parameters" }, { status: 400 });
    }

    let foundTask = await prisma.task.findUnique({
      where: { id: task_id.trim() }
    });

    if (!foundTask && task_name) {
      foundTask = await prisma.task.findFirst({
        where: { task_name: task_name.trim() }
      });
    }

    if (!foundTask) {
      return NextResponse.json({ status: "error", message: "Task not found" }, { status: 404 });
    }

    const taskProjectId = foundTask.project_id;
    const project = await prisma.project.findFirst({
      where: {
        OR: [
          { id: taskProjectId },
          { project_code: taskProjectId }
        ]
      }
    });

    if (!(await canEditTask(ctx, foundTask, project || undefined))) {
      return NextResponse.json({ status: "error", message: "Forbidden: You do not have permission to edit this task's status." }, { status: 403 });
    }

    const isDone = ["done", "complete", "completed"].includes(new_status.toLowerCase());
    const today = toDateString(new Date());
    const old_status = foundTask.status || "";
    
    const dueDate = foundTask.due_date || "";
    const delayFlag = isDelayed(dueDate, today);

    let newPercent = foundTask.percent_complete;
    
    if (isDone) {
      newPercent = "100";
    } else {
      const currentPct = Number(foundTask.percent_complete) || 0;
      newPercent = String(getAutoAdjustedPercent(old_status, new_status, currentPct));
    }

    await prisma.task.update({
      where: { id: foundTask.id },
      data: {
        status: new_status,
        update_date: isDone ? today : foundTask.update_date,
        is_delay: delayFlag,
        percent_complete: newPercent
      }
    });

    // Run async progress update
    if (taskProjectId) {
      updateProjectProgress(taskProjectId).catch(console.error);
    }

    // Cascade Status to Parent Task
    if (foundTask.parent_task_id) {
      const siblings = await prisma.task.findMany({
        where: { parent_task_id: foundTask.parent_task_id }
      });
      
      const parentTask = await prisma.task.findUnique({
        where: { id: foundTask.parent_task_id }
      });

      if (parentTask) {
        // Evaluate siblings including the one we just updated locally
        const updatedSiblings = siblings.map(s => s.id === foundTask!.id ? { ...s, status: new_status } : s);
        const allSiblingsDone = updatedSiblings.every(s => ["done", "complete", "completed"].includes((s.status || '').toLowerCase()));

        if (allSiblingsDone && !["done", "complete", "completed"].includes((parentTask.status || '').toLowerCase())) {
          await prisma.task.update({
            where: { id: parentTask.id },
            data: {
              status: "Done",
              update_date: today,
              is_delay: isDelayed(parentTask.due_date || "", today)
            }
          });
        } else if (!allSiblingsDone && ["done", "complete", "completed"].includes((parentTask.status || '').toLowerCase())) {
          await prisma.task.update({
            where: { id: parentTask.id },
            data: {
              status: "In Progress",
              update_date: today,
              is_delay: isDelayed(parentTask.due_date || "", today)
            }
          });
        }
      }
    }

    revalidatePath('/tasks');
    revalidatePath('/projects');

    if (ctx) {
      await logActivity(ctx.token, {
        action: 'UPDATE TASK STATUS',
        project_id: foundTask.project_id || task_id,
        project_name: foundTask.task_name ? `${foundTask.task_name} -> ${new_status}` : `Status -> ${new_status}`,
        user_name: ctx.name_en || ctx.name_th || ctx.email,
        user_email: ctx.email
      });
    }

    if (isDone) {
      return NextResponse.json({
        status: "success",
        message: "Status updated to Done",
        update_date: today,
        is_delay: delayFlag,
      });
    }

    return NextResponse.json({ status: "success", message: "Status updated successfully" });
  } catch (error: unknown) {
    const err = error as Error;
    console.error("PUT /api/tasks/status error:", err);
    return NextResponse.json(
      { status: "error", message: err.message || "Failed to update status" },
      { status: 500 }
    );
  }
}
