import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { updateSheetRow, fetchSheetData, getSheetHeaders } from "@/lib/googleSheets";
import { revalidatePath } from "next/cache";
import { getSessionContext, canEditProject } from "@/lib/permissions";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getSessionContext();
    if (!ctx) return NextResponse.json({ status: "error", message: "Unauthorized" }, { status: 401 });
    const token = ctx.token;

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
    
    if (!(await canEditProject(ctx, existingProject))) {
      return NextResponse.json({ status: "error", message: "Forbidden: You do not have permission to edit this project." }, { status: 403 });
    }
    
    const { project_code, project_name, client_name, manager_id, start_date, end_date, status, priority, department, project_email_update, color } = body;
    const deptString = Array.isArray(department) ? department.join(", ") : (department || "");

    const headers = await getSheetHeaders(token, "Projects");
    
    const updatedValues: Record<string, any> = {
      ...existingProject,
      project_code: project_code || existingProject.project_code,
      project_name: project_name || existingProject.project_name,
      client_name: client_name !== undefined ? client_name : existingProject.client_name,
      manager_id: manager_id !== undefined ? manager_id : existingProject.manager_id,
      start_date: start_date !== undefined ? start_date : existingProject.start_date,
      end_date: end_date !== undefined ? end_date : existingProject.end_date,
      status: status !== undefined ? status : existingProject.status,
      priority: priority !== undefined ? priority : existingProject.priority,
      department: deptString !== undefined ? deptString : existingProject.department,
      project_email_update: project_email_update !== undefined ? project_email_update : (existingProject.project_email_update || ""),
      color: color !== undefined ? color : (existingProject.color || "")
    };

    const cleanHeaders = headers.map(h => h.trim().toLowerCase());

    const rowData = headers.map(header => {
      const cleanHeader = header.trim().toLowerCase();
      if (cleanHeader === 'id') return existingProject.id || projectId;
      // Prefer the normalized key from our explicitly updated fields, otherwise fallback
      if (updatedValues[cleanHeader] !== undefined) return updatedValues[cleanHeader];
      if (updatedValues[header] !== undefined) return updatedValues[header];
      return "";
    });

    if (!cleanHeaders.includes('color') && color) {
      rowData.push(color);
    }

    const lastColLetter = String.fromCharCode(65 + Math.max(headers.length, rowData.length) - 1);
    await updateSheetRow(token, `Projects!A${rowIndex}:${lastColLetter}${rowIndex}`, rowData);
    const { revalidatePath, revalidateTag } = await import("next/cache");
    revalidatePath("/projects");
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    revalidateTag("projects");

    return NextResponse.json({ status: "success", message: "Project updated successfully" });
  } catch (error: unknown) {
    const err = error as Error;
    console.error("API error updating project:", err);
    return NextResponse.json({ status: "error", message: err.message || "Failed to update project" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getSessionContext();
    if (!ctx) return NextResponse.json({ status: "error", message: "Unauthorized" }, { status: 401 });
    const token = ctx.token;

    const resolvedParams = await params;
    const projectId = resolvedParams.id;
    const email = ctx.email || "";
    const name = ctx.name_en || ctx.name_th || "Unknown";

    // 1. Fetch Projects to find the project row
    const projectsData = await fetchSheetData(token, "Projects!A1:Z");
    const projectIndex = projectsData.findIndex((p: any) => p.id === projectId || p.project_code === projectId);
    
    if (projectIndex === -1) {
      return NextResponse.json({ status: "error", message: "Project not found" }, { status: 404 });
    }

    const projectRowIndex = Number(projectsData[projectIndex]._rowIndex);
    const existingProject = projectsData[projectIndex];
    const projectName = existingProject.project_name || "Unknown Project";

    if (!(await canEditProject(ctx, existingProject))) {
      return NextResponse.json({ status: "error", message: "Forbidden: You do not have permission to delete this project." }, { status: 403 });
    }

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
