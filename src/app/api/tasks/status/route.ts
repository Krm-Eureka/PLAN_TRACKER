import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { updateSheetCell, fetchSheetData, getSheetHeaders, getColumnLetter } from "@/lib/googleSheets";
import { getAutoAdjustedPercent } from "@/utils/progress";
import { revalidatePath, revalidateTag } from "next/cache";
import { logActivity } from "@/lib/logger";
import { getSessionContext, canEditTask } from "@/lib/permissions";

// No hardcoded columns, we will fetch headers dynamically

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

async function updateProjectProgress(token: string, projectId: string, allTasks: Record<string, string>[]) {
  if (!projectId) return;

  const projectTasks = allTasks.filter(t => t.project_id === projectId || t.project_code === projectId);
  if (projectTasks.length === 0) return;

  const countableTasks = projectTasks.filter(t => !(t.status || '').toLowerCase().includes('cancel'));
  const completedCount = countableTasks.filter(t => {
    const s = (t.status || '').toLowerCase();
    return s.includes('done') || s.includes('complete');
  }).length;

  const projectProgress = countableTasks.length > 0
    ? Math.round((completedCount / countableTasks.length) * 100)
    : 0;

  // Fetch Projects sheet
  const projects = await fetchSheetData(token, "Projects!A:Z");
  let projectRowIndex = -1;
  for (let i = 0; i < projects.length; i++) {
    if (projects[i].id === projectId || projects[i].project_code === projectId) {
      projectRowIndex = i + 2;
      break;
    }
  }

  if (projectRowIndex !== -1) {
    const headers = await getSheetHeaders(token, "Projects");
    let progressColIndex = headers.indexOf('progress');

    if (progressColIndex === -1) {
      progressColIndex = headers.length;
      const colLetter = getColumnLetter(progressColIndex);
      await updateSheetCell(token, `Projects!${colLetter}1`, 'progress');
    }

    const colLetter = getColumnLetter(progressColIndex);
    const promises = [
      updateSheetCell(token, `Projects!${colLetter}${projectRowIndex}`, String(projectProgress))
    ];

    let statusColIndex = headers.indexOf('status');
    if (statusColIndex !== -1) {
      const statusColLetter = getColumnLetter(statusColIndex);
      const currentStatus = projects[projectRowIndex - 2]?.status || '';

      if (projectProgress === 100 && !['done', 'complete', 'completed'].includes(currentStatus.toLowerCase())) {
        promises.push(updateSheetCell(token, `Projects!${statusColLetter}${projectRowIndex}`, 'Done'));
      } else if (projectProgress < 100 && ['done', 'complete', 'completed'].includes(currentStatus.toLowerCase())) {
        promises.push(updateSheetCell(token, `Projects!${statusColLetter}${projectRowIndex}`, 'In Progress'));
      }
    }

    await Promise.all(promises);
  }
}


export async function PUT(req: NextRequest) {
  try {
    const ctx = await getSessionContext();
    if (!ctx) return NextResponse.json({ status: "error", message: "Unauthorized" }, { status: 401 });
    const token = ctx.token;

    const body = await req.json();
    const { task_id, new_status, task_name } = body;

    if (!task_id || !new_status) {
      return NextResponse.json({ status: "error", message: "Missing parameters" }, { status: 400 });
    }

    // 1. Find the task row
    const [rows, projectsRaw] = await Promise.all([
      fetchSheetData(token, "Tasks!A:Z"),
      fetchSheetData(token, "Projects!A:Z")
    ]);

    let rowIndex = -1;
    let foundTask: Record<string, string> | null = null;

    for (let i = 0; i < rows.length; i++) {
      const rowId = (rows[i].id || "").trim();
      const rowTaskName = (rows[i].task_name || "").trim();

      if (rowId && rowId === task_id.trim()) {
        rowIndex = i + 2; // +1 zero-index, +1 header
        foundTask = rows[i];
        break;
      }
      // Fallback: match by task_name
      if (task_name && rowTaskName === task_name.trim()) {
        rowIndex = i + 2;
        foundTask = rows[i];
        break;
      }
    }

    if (rowIndex === -1 || !foundTask) {
      return NextResponse.json({ status: "error", message: "Task not found" }, { status: 404 });
    }

    const taskProjectId = foundTask.project_id || foundTask.project_code;
    const project = projectsRaw.find((p: any) => p.id === taskProjectId || p.project_code === taskProjectId);

    if (!(await canEditTask(ctx, foundTask, project))) {
      return NextResponse.json({ status: "error", message: "Forbidden: You do not have permission to edit this task's status." }, { status: 403 });
    }

    const isDone = ["done", "complete", "completed"].includes(new_status.toLowerCase());
    const today = toDateString(new Date());
    const old_status = foundTask.status || "";

    // 2. Fetch headers dynamically
    const headers = await getSheetHeaders(token, "Tasks");
    const getCol = (name: string) => {
      let idx = headers.indexOf(name);
      if (idx === -1) return "";
      return getColumnLetter(idx);
    };

    const colStatus = getCol("status");
    const colUpdateDate = getCol("update_date");
    const colIsDelay = getCol("is_delay");

    const promises: Promise<unknown>[] = [];

    if (colStatus) promises.push(updateSheetCell(token, `Tasks!${colStatus}${rowIndex}`, new_status));
    if (colUpdateDate) promises.push(updateSheetCell(token, `Tasks!${colUpdateDate}${rowIndex}`, today));

    // 3. Compute is_delay based on today's date vs due_date
    const dueDate = foundTask.due_date || "";
    const delayFlag = isDelayed(dueDate, today) ? "TRUE" : "FALSE";
    if (colIsDelay) promises.push(updateSheetCell(token, `Tasks!${colIsDelay}${rowIndex}`, delayFlag));

    await Promise.all(promises);

    // 5. Update Project Progress in DB
    foundTask.status = new_status; // locally update the row
    const projectId = foundTask.project_id || foundTask.project_code;
    if (projectId) {
      // Run it asynchronously without waiting if you want to speed up response, 
      // but waiting ensures it's done.
      await updateProjectProgress(token, projectId, rows);
    }

    // 4. If un-done (reverting from Done) → clear end_date and is_delay
    // Also adjust percent_complete logic
    const pctColIndex = headers.indexOf('percent_complete');
    let pctColLetter = "";
    if (pctColIndex !== -1) {
      pctColLetter = getColumnLetter(pctColIndex);
    }

    if (isDone && pctColLetter) {
      await updateSheetCell(token, `Tasks!${pctColLetter}${rowIndex}`, "100");
      foundTask.percent_complete = "100";
    }

    if (!isDone) {
      const promises: Promise<any>[] = [];
      // Auto-adjust percent_complete based on new status
      if (pctColLetter) {
        let currentPct = Number(foundTask.percent_complete) || 0;
        let newPctStr = String(getAutoAdjustedPercent(old_status, new_status, currentPct));

        if (newPctStr !== String(foundTask.percent_complete)) {
          promises.push(updateSheetCell(token, `Tasks!${pctColLetter}${rowIndex}`, newPctStr));
          foundTask.percent_complete = newPctStr;
        }
      }

      if (promises.length > 0) await Promise.all(promises);
    }

    // 6. Cascade Status to Parent Task (if this is a subtask)
    if (foundTask.parent_task_id) {
      const siblings = rows.filter(r => r.parent_task_id === foundTask!.parent_task_id);
      const parentTask = rows.find(r => r.id === foundTask!.parent_task_id);
      const parentIndex = rows.findIndex(r => r.id === foundTask!.parent_task_id) + 2;

      if (parentTask && parentIndex > 1) {
        const allSiblingsDone = siblings.every(s => ["done", "complete", "completed"].includes((s.status || '').toLowerCase()));

        if (allSiblingsDone && !["done", "complete", "completed"].includes((parentTask.status || '').toLowerCase())) {
          // Parent becomes Done
          const pUpdateDate = today;
          const pDelayFlag = isDelayed(parentTask.due_date || "", pUpdateDate) ? "TRUE" : "FALSE";
          const parentPromises = [];
          if (colStatus) parentPromises.push(updateSheetCell(token, `Tasks!${colStatus}${parentIndex}`, "Done"));
          if (colUpdateDate) parentPromises.push(updateSheetCell(token, `Tasks!${colUpdateDate}${parentIndex}`, pUpdateDate));
          if (colIsDelay) parentPromises.push(updateSheetCell(token, `Tasks!${colIsDelay}${parentIndex}`, pDelayFlag));
          await Promise.all(parentPromises);
        } else if (!allSiblingsDone && ["done", "complete", "completed"].includes((parentTask.status || '').toLowerCase())) {
          // Revert parent from Done to In Progress
          const parentPromises = [];
          if (colStatus) parentPromises.push(updateSheetCell(token, `Tasks!${colStatus}${parentIndex}`, "In Progress"));
          if (colUpdateDate) parentPromises.push(updateSheetCell(token, `Tasks!${colUpdateDate}${parentIndex}`, today));
          if (colIsDelay) parentPromises.push(updateSheetCell(token, `Tasks!${colIsDelay}${parentIndex}`, isDelayed(parentTask.due_date || "", today) ? "TRUE" : "FALSE"));
          await Promise.all(parentPromises);
        }
      }
    }

    revalidatePath('/tasks');
    revalidatePath('/projects');
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    revalidateTag('tasks');
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    revalidateTag('projects');

    // Log the activity
    if (ctx) {
      await logActivity(token, {
        action: 'UPDATE TASK STATUS',
        project_id: foundTask.project_id || foundTask.project_code || task_id,
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

