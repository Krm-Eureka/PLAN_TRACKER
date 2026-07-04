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
    const filtered = await filterByDepartment(ctx, rows, t => t.assignee || "");
    return NextResponse.json({ status: "success", data: filtered });
  } catch (error: any) {
    return NextResponse.json({ status: "error", message: error.message || "Failed to fetch tasks" }, { status: 500 });
  }
}

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

    // Fetch all tasks to determine the next ID
    const existingTasks = await fetchSheetData(token, "Tasks!A:I");
    
    let nextCount = 1;
    if (project_code) {
      const projectTasks = existingTasks.filter((t: any) => t.project_code === project_code);
      nextCount = projectTasks.length + 1;
    } else {
      nextCount = existingTasks.length + 1;
    }

    const paddedCount = nextCount.toString().padStart(3, '0');
    const pCode = project_code || 'NOPROJECT';
    
    // Always auto-generate the ID using the new format
    const newTaskId = `TSK-${pCode}-${paddedCount}`;

    // Data format: [id, project_code, task_name, description, assignee, start_date, due_date, status, priority]
    const rowData = [
      newTaskId,
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

    return NextResponse.json({ status: "success", message: "Task created successfully", data: { id: newTaskId } });
  } catch (error: any) {
    console.error("API error appending task:", error);
    return NextResponse.json(
      { status: "error", message: error.message || "Failed to create task" },
      { status: 500 }
    );
  }
}
