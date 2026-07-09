import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { fetchSheetData, getSheetHeaders, updateSheetCell, batchUpdateSheetValues, getColumnLetter } from "@/lib/googleSheets";
import { revalidatePath } from "next/cache";

export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const token = (session as { accessToken?: string })?.accessToken;

    if (!token) {
      return NextResponse.json({ status: "error", message: "Unauthorized" }, { status: 401 });
    }

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

    // 2. Fetch all tasks to get row indices
    const tasks = await fetchSheetData(token, "Tasks!A:Z");
    
    // Create a map of task ID to row index (1-indexed for sheets API)
    // fetchSheetData returns data starting from row 2 (row 1 is header)
    const idToRowMap = new Map<string, number>();
    tasks.forEach((t, index) => {
      if (t.id) {
        idToRowMap.set(t.id, index + 2); // +2 because index 0 is row 2
      }
    });

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
    revalidatePath("/tasks");

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
