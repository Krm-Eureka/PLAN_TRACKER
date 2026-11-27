import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/logger";
import { canEditTask, type SessionContext } from "@/lib/permissions";
import { updateProjectAndParentTasks } from "@/lib/taskUpdater";
import { normalizeTaskStatus } from "@/constants/status";
import { getAutoAdjustedPercent, getOnHoldResumeDates } from "@/utils/status";

function toDateString(d: Date): string {
  return d.toISOString().split("T")[0];
}

function isDelayed(dueDateStr: string, endDateStr: string): boolean {
  if (!dueDateStr || !endDateStr) return false;
  const due = new Date(dueDateStr);
  const end = new Date(endDateStr);
  due.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  return end > due;
}

export type UpdateTaskStatusResult =
  | {
      ok: true;
      taskId: string;
      taskName: string;
      projectId: string;
      projectCode: string;
      projectName: string;
      oldStatus: string;
      newStatus: string;
      newPercent: string;
      projectProgress: string | null;
      projectStatus: string | null;
      isDone: boolean;
      updateDate: string;
      isDelay: boolean;
      resumeDates: { start_date: string; due_date?: string } | null;
    }
  | {
      ok: false;
      status: 400 | 403 | 404;
      message: string;
    };

/**
 * Shared task status update logic used by both the Web API and LINE OA webhook.
 * Guarantees canonical status normalization, RBAC enforcement, parent/project
 * progress rollup, and activity logging stay identical across all channels.
 */
export async function updateTaskStatusCore(params: {
  ctx: SessionContext;
  taskId: string;
  newStatus: string;
}): Promise<UpdateTaskStatusResult> {
  const normalizedStatus = normalizeTaskStatus(String(params.newStatus || ""));
  if (!normalizedStatus) {
    return { ok: false, status: 400, message: "Unknown status" };
  }

  const foundTask = await prisma.task.findUnique({
    where: { id: String(params.taskId).trim() },
  });

  if (!foundTask) {
    return { ok: false, status: 404, message: "Task not found" };
  }

  const taskProjectId = foundTask.project_id;
  const project = await prisma.project.findFirst({
    where: {
      OR: [{ id: taskProjectId }, { project_code: taskProjectId }],
    },
  });

  if (!(await canEditTask(params.ctx, foundTask, project || undefined))) {
    return {
      ok: false,
      status: 403,
      message: "Forbidden: You do not have permission to edit this task's status.",
    };
  }

  const isDone = ["done", "complete", "completed"].includes(
    normalizedStatus.toLowerCase()
  );
  const today = toDateString(new Date());
  const oldStatus = foundTask.status || "";
  const dueDate = foundTask.due_date || "";
  const delayFlag = isDelayed(dueDate, today);

  let newPercent = foundTask.percent_complete || "0";
  if (isDone) {
    newPercent = "100";
  } else {
    const currentPct = Number(foundTask.percent_complete) || 0;
    newPercent = String(
      getAutoAdjustedPercent(oldStatus, normalizedStatus, currentPct)
    );
  }

  const resumeDates = getOnHoldResumeDates(
    oldStatus,
    normalizedStatus,
    foundTask.start_date,
    foundTask.due_date,
    today
  );

  await prisma.task.update({
    where: { id: foundTask.id },
    data: {
      status: normalizedStatus,
      update_date: isDone ? today : null,
      is_delay: delayFlag,
      percent_complete: newPercent,
      ...(resumeDates && { start_date: resumeDates.start_date }),
      ...(resumeDates?.due_date && { due_date: resumeDates.due_date }),
    },
  });

  if (taskProjectId) {
    await updateProjectAndParentTasks(taskProjectId);
  }

  const refreshedProject = project
    ? await prisma.project.findUnique({
        where: { id: project.id },
        select: { progress: true, status: true },
      })
    : null;

  await logActivity(params.ctx.token, {
    action: "UPDATE TASK STATUS",
    project_id: foundTask.project_id || foundTask.id,
    project_name: foundTask.task_name
      ? `${foundTask.task_name} -> ${normalizedStatus}`
      : `Status -> ${normalizedStatus}`,
    user_name: params.ctx.name_en || params.ctx.name_th || params.ctx.email,
    user_email: params.ctx.email,
  });

  return {
    ok: true,
    taskId: foundTask.id,
    taskName: foundTask.task_name,
    projectId: project?.id || foundTask.project_id,
    projectCode: project?.project_code || "",
    projectName: project?.project_name || "",
    oldStatus,
    newStatus: normalizedStatus,
    newPercent,
    projectProgress: refreshedProject?.progress ?? project?.progress ?? null,
    projectStatus: refreshedProject?.status ?? project?.status ?? null,
    isDone,
    updateDate: today,
    isDelay: delayFlag,
    resumeDates: resumeDates ?? null,
  };
}
