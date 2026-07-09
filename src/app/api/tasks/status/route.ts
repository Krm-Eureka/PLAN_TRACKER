import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { updateSheetCell, fetchSheetData, getSheetHeaders, getColumnLetter } from "@/lib/googleSheets";
import { getAutoAdjustedPercent } from "@/utils/progress";
import { revalidatePath } from "next/cache";

// Tasks column map (1-indexed for Sheets API)
// A=id B=project_id C=task_name D=description E=assignee_id F=assignee_name
// G=start_date H=due_date I=end_date J=is_delay K=status L=priority
const COL = {
  id:             "A",
  project_id:     "B",
  task_name:      "C",
  description:    "D",
  assignee_id:    "E",
  assignee_name:  "F",
  start_date:     "G",
  due_date:       "H",
  update_date:    "I",
  is_delay:       "J",
  status:         "K",
  priority:       "L",
};

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
    await updateSheetCell(token, `Projects!${colLetter}${projectRowIndex}`, String(projectProgress));
  }
}


export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const token = (session as { accessToken?: string })?.accessToken;

    if (!token) {
      return NextResponse.json({ status: "error", message: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { task_id, new_status, task_name } = body;

    if (!task_id || !new_status) {
      return NextResponse.json({ status: "error", message: "Missing parameters" }, { status: 400 });
    }

    // 1. Find the task row
    const rows = await fetchSheetData(token, "Tasks!A:Z");

    let rowIndex = -1;
    let foundTask: Record<string, string> | null = null;

    for (let i = 0; i < rows.length; i++) {
      const rowId       = (rows[i].id || "").trim();
      const rowTaskName = (rows[i].task_name || "").trim();

      if (rowId && rowId === task_id.trim()) {
        rowIndex  = i + 2; // +1 zero-index, +1 header
        foundTask = rows[i];
        break;
      }
      // Fallback: match by task_name
      if (task_name && rowTaskName === task_name.trim()) {
        rowIndex  = i + 2;
        foundTask = rows[i];
        break;
      }
    }

    if (rowIndex === -1 || !foundTask) {
      return NextResponse.json({ status: "error", message: "Task not found" }, { status: 404 });
    }

    const isDone = ["done", "complete", "completed"].includes(new_status.toLowerCase());
    const today  = toDateString(new Date());
    const old_status = foundTask.status || "";

    // 2. Update status (col K) and update_date (col I)
    await Promise.all([
      updateSheetCell(token, `Tasks!${COL.status}${rowIndex}`, new_status),
      updateSheetCell(token, `Tasks!${COL.update_date}${rowIndex}`, today),
    ]);

    // 3. Compute is_delay based on today's date vs due_date
    const dueDate = foundTask.due_date || "";
    const delayFlag = isDelayed(dueDate, today) ? "TRUE" : "FALSE";
    await updateSheetCell(token, `Tasks!${COL.is_delay}${rowIndex}`, delayFlag);

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
    const headers = await getSheetHeaders(token, "Tasks");
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
        let currentPct = foundTask.percent_complete || "0";
        const currentPctNum = Number(currentPct) || 0;
        
        // Use our utility function to calculate the new %
        const newPctNum = getAutoAdjustedPercent(old_status, new_status, currentPctNum);
        const newPct = newPctNum.toString();

        if (newPct !== foundTask.percent_complete) {
          promises.push(updateSheetCell(token, `Tasks!${pctColLetter}${rowIndex}`, newPct));
          foundTask.percent_complete = newPct;
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
          // Mark parent as Done
          const pUpdateDate = today;
          const pDelayFlag = isDelayed(parentTask.due_date || "", pUpdateDate) ? "TRUE" : "FALSE";
          await Promise.all([
            updateSheetCell(token, `Tasks!${COL.status}${parentIndex}`, "Done"),
            updateSheetCell(token, `Tasks!${COL.update_date}${parentIndex}`, pUpdateDate),
            updateSheetCell(token, `Tasks!${COL.is_delay}${parentIndex}`, pDelayFlag),
          ]);
        } else if (!allSiblingsDone && ["done", "complete", "completed"].includes((parentTask.status || '').toLowerCase())) {
          // Revert parent from Done to In Progress
          await Promise.all([
            updateSheetCell(token, `Tasks!${COL.status}${parentIndex}`, "In Progress"),
            updateSheetCell(token, `Tasks!${COL.update_date}${parentIndex}`, today),
            updateSheetCell(token, `Tasks!${COL.is_delay}${parentIndex}`, isDelayed(parentTask.due_date || "", today) ? "TRUE" : "FALSE"),
          ]);
        }
      }
    }

    revalidatePath('/tasks');
    revalidatePath('/projects');

    if (isDone) {
      return NextResponse.json({
        status:   "success",
        message:  "Status updated to Done",
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

