import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { appendSheetRow, fetchSheetData } from "@/lib/googleSheets";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const token = (session as any)?.accessToken;
    
    if (!token) {
      return NextResponse.json({ status: "error", message: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { id, project_code, task_name, description, assignee, start_date, due_date, status, priority } = body;

    if (!task_name) {
      return NextResponse.json({ status: "error", message: "Task name is required" }, { status: 400 });
    }

    // Data format: [id, project_code, task_name, description, assignee, start_date, due_date, status, priority]
    const rowData = [
      id || `TSK-${Math.floor(Math.random() * 10000)}`,
      project_code || "",
      task_name,
      description || "",
      assignee || "",
      start_date || "",
      due_date || "",
      status || "To Do",
      priority || "Medium"
    ];

    await appendSheetRow(token, "Tasks!A:I", rowData);

    return NextResponse.json({ status: "success", message: "Task created successfully" });
  } catch (error: any) {
    console.error("API error appending task:", error);
    return NextResponse.json(
      { status: "error", message: error.message || "Failed to create task" },
      { status: 500 }
    );
  }
}
