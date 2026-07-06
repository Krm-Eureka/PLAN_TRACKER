import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { updateSheetCell, fetchSheetData } from "@/lib/googleSheets";

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
  end_date:       "I",
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

    // 2. Update status (col K)
    await updateSheetCell(token, `Tasks!${COL.status}${rowIndex}`, new_status);

    // 3. If DONE → set end_date = today, compute is_delay
    if (isDone) {
      const dueDate    = foundTask.due_date || "";
      const endDate    = today;
      const delayFlag  = isDelayed(dueDate, endDate) ? "TRUE" : "FALSE";

      await Promise.all([
        updateSheetCell(token, `Tasks!${COL.end_date}${rowIndex}`, endDate),
        updateSheetCell(token, `Tasks!${COL.is_delay}${rowIndex}`, delayFlag),
      ]);

      return NextResponse.json({
        status:   "success",
        message:  "Status updated to Done",
        end_date: endDate,
        is_delay: delayFlag,
      });
    }

    // 4. If un-done (reverting from Done) → clear end_date and is_delay
    if (!isDone && foundTask.end_date) {
      await Promise.all([
        updateSheetCell(token, `Tasks!${COL.end_date}${rowIndex}`, ""),
        updateSheetCell(token, `Tasks!${COL.is_delay}${rowIndex}`, ""),
      ]);
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
