import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { updateSheetRow, fetchSheetData, invalidateSheetsCache } from "@/lib/googleSheets";

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
    
    const { project_code, project_name, client_name, manager_id, start_date, end_date, status, priority, department } = body;
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
      deptString !== undefined ? deptString : existingProject.department
    ];

    await updateSheetRow(token, `Projects!A${rowIndex}:J${rowIndex}`, rowData);
    invalidateSheetsCache("Projects!A1:Z");

    return NextResponse.json({ status: "success", message: "Project updated successfully" });
  } catch (error: unknown) {
    const err = error as Error;
    console.error("API error updating project:", err);
    return NextResponse.json({ status: "error", message: err.message || "Failed to update project" }, { status: 500 });
  }
}
