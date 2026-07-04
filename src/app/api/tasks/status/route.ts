import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { updateSheetCell, fetchSheetData } from "@/lib/googleSheets";

export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const token = (session as any)?.accessToken;
    
    if (!token) {
      return NextResponse.json({ status: "error", message: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { task_id, new_status } = body;

    if (!task_id || !new_status) {
      return NextResponse.json({ status: "error", message: "Missing parameters" }, { status: 400 });
    }

    // 1. Fetch task IDs to find the correct row
    const rows = await fetchSheetData(token, "Tasks!A:A");
    // rows is an array of objects mapping to headers, BUT fetchSheetData assumes row 1 is headers.
    // So rows[0] is actually row 2 in the sheet.
    
    let rowIndex = -1;
    for (let i = 0; i < rows.length; i++) {
      const cellValue = Object.values(rows[i])[0];
      if (cellValue === task_id) {
        rowIndex = i + 2; // +1 for 0-index, +1 for header row
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
  } catch (error: any) {
    console.error("API error updating task status:", error);
    return NextResponse.json(
      { status: "error", message: error.message || "Failed to update status" },
      { status: 500 }
    );
  }
}
