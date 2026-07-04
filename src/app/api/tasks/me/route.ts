import { NextRequest, NextResponse } from "next/server";
import { fetchSheetData } from "@/lib/googleSheets";
import { getSessionContext, filterByDepartment } from "@/lib/permissions";

export async function GET(req: NextRequest) {
  try {
    const ctx = await getSessionContext();
    if (!ctx) return NextResponse.json({ status: "error", message: "Unauthorized" }, { status: 401 });

    const rows = await fetchSheetData(ctx.token, "Tasks!A:Z");
    const filtered = await filterByDepartment(ctx, rows, t => t.assignee || "");

    return NextResponse.json({ status: "success", tasks: filtered });
  } catch (error: any) {
    return NextResponse.json(
      { status: "error", message: error.message || "Failed to fetch tasks" },
      { status: 500 }
    );
  }
}

