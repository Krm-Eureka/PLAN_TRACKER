import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { updateSheetRow, fetchSheetData } from "@/lib/googleSheets";
import { revalidatePath } from "next/cache";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    const token = (session as { accessToken?: string })?.accessToken;
    if (!token) return NextResponse.json({ status: "error", message: "Unauthorized" }, { status: 401 });

    const resolvedParams = await params;
    const projectId = resolvedParams.id;
    const body = await req.json();

    const data = await fetchSheetData(token, "Projects!A1:Z");
    const index = data.findIndex((p: any) => p.id === projectId || p.project_code === projectId);
    
    if (index === -1) {
      return NextResponse.json({ status: "error", message: "Project not found" }, { status: 404 });
    }

    const rowIndex = index + 2;
    const existingProject = data[index];
    
    const { project_code, project_name, client_name, manager_id, start_date, end_date, status, priority, department, project_email_update } = body;
    const deptString = Array.isArray(department) ? department.join(", ") : (department || "");

    const rowData = [
      existingProject.id || projectId, 
      project_code || existingProject.project_code, 
      project_name || existingProject.project_name, 
      client_name !== undefined ? client_name : existingProject.client_name, 
      manager_id !== undefined ? manager_id : existingProject.manager_id, 
      start_date !== undefined ? start_date : existingProject.start_date, 
      end_date !== undefined ? end_date : existingProject.end_date, 
      status !== undefined ? status : existingProject.status, 
      priority !== undefined ? priority : existingProject.priority, 
      deptString !== undefined ? deptString : existingProject.department,
      existingProject.progress !== undefined ? existingProject.progress : "",
      project_email_update !== undefined ? project_email_update : (existingProject.project_email_update || "")
    ];

    await updateSheetRow(token, `Projects!A${rowIndex}:L${rowIndex}`, rowData);
    revalidatePath("/projects");

    return NextResponse.json({ status: "success", message: "Project updated successfully" });
  } catch (error: unknown) {
    const err = error as Error;
    console.error("API error updating project:", err);
    return NextResponse.json({ status: "error", message: err.message || "Failed to update project" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    const token = (session as { accessToken?: string })?.accessToken;
    if (!token) return NextResponse.json({ status: "error", message: "Unauthorized" }, { status: 401 });

    const resolvedParams = await params;
    const projectId = resolvedParams.id;
    const { name, email } = (session as any)?.user || { name: "Unknown", email: "" };

    // 1. Fetch Projects to find the project row
    const projectsData = await fetchSheetData(token, "Projects!A1:Z");
    const projectIndex = projectsData.findIndex((p: any) => p.id === projectId || p.project_code === projectId);
    
    if (projectIndex === -1) {
      return NextResponse.json({ status: "error", message: "Project not found" }, { status: 404 });
    }

    const projectRowIndex = Number(projectsData[projectIndex]._rowIndex);
    const projectName = projectsData[projectIndex].project_name || "Unknown Project";

    // 2. Fetch Tasks to find all tasks for this project
    const tasksData = await fetchSheetData(token, "Tasks!A1:Z");
    const taskRowIndices: number[] = [];
    tasksData.forEach((t: any) => {
      if (t.project_id === projectId) {
        taskRowIndices.push(Number(t._rowIndex));
      }
    });

    // 3. Delete Project Row
    const { deleteSheetRow, deleteSheetRows, appendSheetRow } = await import('@/lib/googleSheets');
    await deleteSheetRow(token, 'Projects', projectRowIndex);

    // 4. Delete Task Rows (batch)
    if (taskRowIndices.length > 0) {
      await deleteSheetRows(token, 'Tasks', taskRowIndices);
    }

    // 5. Write to Logs sheet
    const timestamp = new Date().toISOString();
    const logData = [
      timestamp,
      "DELETE_PROJECT",
      projectId,
      projectName,
      name,
      email
    ];
    
    try {
      await appendSheetRow(token, "Logs!A:F", logData);
    } catch (logErr) {
      console.warn("Failed to write to Logs sheet. Please ensure the 'Logs' sheet exists.", logErr);
    }

    revalidatePath("/projects");
    revalidatePath("/tasks");

    return NextResponse.json({ status: "success", message: "Project and associated tasks deleted successfully" });
  } catch (error: unknown) {
    const err = error as Error;
    console.error("API error deleting project:", err);
    return NextResponse.json({ status: "error", message: err.message || "Failed to delete project" }, { status: 500 });
  }
}
