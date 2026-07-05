import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { updateSheetCell, fetchSheetData } from "@/lib/googleSheets";

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

    // 1. Fetch entire sheet to find the correct row (id is A, task_name is C)
    const rows = await fetchSheetData(token, "Tasks!A:Z");
    
    let rowIndex = -1;
    for (let i = 0; i < rows.length; i++) {
      const rowId = rows[i].id?.trim();
      const rowTaskName = rows[i].task_name?.trim();
      
      // Try exact UUID match first
      if (rowId && rowId === task_id.trim()) {
        rowIndex = i + 2; // +1 for 0-index, +1 for header row
        break;
      }
      
      // Fallback: match by task_name (for legacy data without UUIDs)
      if (task_name && rowTaskName === task_name.trim()) {
        rowIndex = i + 2;
        break;
      }
    }

    if (rowIndex === -1) {
      return NextResponse.json({ status: "error", message: "Task not found" }, { status: 404 });
    }

    // 2. Update status column (H) for the found row
    await updateSheetCell(token, `Tasks!H${rowIndex}`, new_status);

    // 3. If DONE, we could potentially set actual_end_date (omitted for now to keep it simple, or we can update another cell)

    return NextResponse.json({ status: "success", message: "Status updated successfully" });
  } catch (error: unknown) {
    const err = error as Error;
    console.error("API error updating task status:", err);
    return NextResponse.json(
      { status: "error", message: err.message || "Failed to update status" },
      { status: 500 }
    );
  }
}
