import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { fetchSheetData, getSheetHeaders, updateSheetCell, batchUpdateSheetValues, getColumnLetter } from "@/lib/googleSheets";
import { revalidatePath } from "next/cache";
import { getSessionContext, canEditTask } from "@/lib/permissions";

export async function PUT(req: NextRequest) {
  try {
    const ctx = await getSessionContext();
    if (!ctx) return NextResponse.json({ status: "error", message: "Unauthorized" }, { status: 401 });
    const token = ctx.token;

    const body = await req.json();
    const { updates } = body; // Array of { id: string, task_order: string }

    if (!updates || !Array.isArray(updates)) {
      return NextResponse.json({ status: "error", message: "Invalid updates format" }, { status: 400 });
    }

    // 1. Get headers to find task_order column
    const headers = await getSheetHeaders(token, "Tasks");
    let taskOrderColIdx = headers.indexOf("task_order");

    // If task_order header doesn't exist, we add it to the first empty column
    if (taskOrderColIdx === -1) {
      taskOrderColIdx = headers.length;
      const colLetter = getColumnLetter(taskOrderColIdx);
      await updateSheetCell(token, `Tasks!${colLetter}1`, "task_order");
    }

    const taskOrderColLetter = getColumnLetter(taskOrderColIdx);

    // 2. Fetch all tasks and projects to check permissions and get row indices
    const [tasks, projectsRaw] = await Promise.all([
      fetchSheetData(token, "Tasks!A:Z"),
      fetchSheetData(token, "Projects!A:Z")
    ]);
    
    // Create a map of task ID to row index (1-indexed for sheets API)
    // fetchSheetData returns data starting from row 2 (row 1 is header)
    const idToRowMap = new Map<string, number>();
    const idToTaskMap = new Map<string, any>();
    tasks.forEach((t: any, index: number) => {
      if (t.id) {
        idToRowMap.set(t.id, index + 2); // +2 because index 0 is row 2
        idToTaskMap.set(t.id, t);
      }
    });

    // 2.5 Verify permissions for all updates
    for (const update of updates) {
      const task = idToTaskMap.get(update.id);
      if (task) {
        const projectId = task.project_id || task.project_code;
        const project = projectsRaw.find((p: any) => p.id === projectId || p.project_code === projectId);
        if (!(await canEditTask(ctx, task, project))) {
          return NextResponse.json({ status: "error", message: "Forbidden: You do not have permission to reorder one or more tasks." }, { status: 403 });
        }
      }
    }

    // 3. Prepare batch updates
    const batchData = [];
    for (const update of updates) {
      const rowIndex = idToRowMap.get(update.id);
      if (rowIndex) {
        batchData.push({
          range: `Tasks!${taskOrderColLetter}${rowIndex}`,
          values: [[update.task_order]]
        });
      }
    }

    if (batchData.length > 0) {
      await batchUpdateSheetValues(token, batchData);
    }
    revalidatePath("/", "layout");

    return NextResponse.json({ status: "success", message: "Tasks reordered successfully" });
  } catch (error: unknown) {
    const err = error as Error;
    console.error("PUT /api/tasks/reorder error:", err);
    return NextResponse.json(
      { status: "error", message: err.message || "Failed to reorder tasks" },
      { status: 500 }
    );
  }
}
