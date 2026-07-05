import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { appendSheetRow, fetchSheetData } from "@/lib/googleSheets";
import { getSessionContext, filterByDepartment } from "@/lib/permissions";

export async function GET() {
  try {
    const ctx = await getSessionContext();
    if (!ctx) return NextResponse.json({ status: "error", message: "Unauthorized" }, { status: 401 });

    const rows = await fetchSheetData(ctx.token, "Tasks!A:Z");
    const filtered = await filterByDepartment(ctx, rows, t => (t.assignee_id as string) || "");
    return NextResponse.json({ status: "success", data: filtered });
  } catch (error: unknown) {
    const err = error as Error;
    return NextResponse.json({ status: "error", message: err.message || "Failed to fetch tasks" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const token = (session as { accessToken?: string })?.accessToken;
    
    if (!token) {
      return NextResponse.json({ status: "error", message: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { project_id, task_name, description, assignee_id, start_date, due_date, status, priority } = body;

    if (!task_name) {
      return NextResponse.json({ status: "error", message: "Task name is required" }, { status: 400 });
    }

    const newTaskId = crypto.randomUUID();

    // Data format: [id, project_id, task_name, description, assignee_id, start_date, due_date, status, priority]
    const rowData = [
      newTaskId,
      project_id || "",
      task_name,
      description || "",
      assignee_id || "",
      start_date || "",
      due_date || "",
      status || "To Do",
      priority || "Medium"
    ];

    await appendSheetRow(token, "Tasks!A:I", rowData);

    return NextResponse.json({ status: "success", message: "Task created successfully", data: { id: newTaskId } });
  } catch (error: unknown) {
    const err = error as Error;
    console.error("API error appending task:", err);
    return NextResponse.json(
      { status: "error", message: err.message || "Failed to create task" },
      { status: 500 }
    );
  }
}
