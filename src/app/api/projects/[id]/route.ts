// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { getSessionContext, canEditProject } from "@/lib/permissions";
import { logActivity } from "@/lib/logger";
import { prisma } from "@/lib/prisma";

const normalizeProjectCode = (code: string) => {
  return (code || "").toUpperCase().replace(/(^|\D)0+(?=\d)/g, '$1');
};

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getSessionContext();
    if (!ctx) return NextResponse.json({ status: "error", message: "Unauthorized" }, { status: 401 });

    const resolvedParams = await params;
    const projectId = resolvedParams.id;

    const project = await prisma.project.findFirst({
      where: {
        OR: [
          { id: projectId },
          { project_code: projectId }
        ]
      }
    });

    if (!project) {
      return NextResponse.json({ status: "error", message: "Project not found" }, { status: 404 });
    }

    return NextResponse.json({ status: "success", data: project });
  } catch (error: unknown) {
    const err = error as Error;
    console.error("API error fetching project:", err);
    return NextResponse.json({ status: "error", message: err.message || "Failed to fetch project" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getSessionContext();
    if (!ctx) return NextResponse.json({ status: "error", message: "Unauthorized" }, { status: 401 });

    const resolvedParams = await params;
    const projectId = resolvedParams.id;
    const body = await req.json();

    const existingProject = await prisma.project.findFirst({
      where: {
        OR: [
          { id: projectId },
          { project_code: projectId }
        ]
      }
    });
    
    if (!existingProject) {
      return NextResponse.json({ status: "error", message: "Project not found" }, { status: 404 });
    }
    
    if (!(await canEditProject(ctx, existingProject))) {
      return NextResponse.json({ status: "error", message: "Forbidden: You do not have permission to edit this project." }, { status: 403 });
    }
    
    const { project_code, project_name, client_name, manager_id, start_date, end_date, status, priority, department, project_email_update, color, progress, custom_columns } = body;
    
    if (project_code && normalizeProjectCode(project_code) !== normalizeProjectCode(existingProject.project_code || "")) {
      const normalizedInputCode = normalizeProjectCode(project_code);
      const duplicateProject = await prisma.project.findFirst({
        where: {
          project_code: normalizedInputCode,
          id: { not: existingProject.id }
        }
      });
      if (duplicateProject) {
        return NextResponse.json({ status: "error", message: "Project Code already exists. Please use a unique code." }, { status: 400 });
      }
    }

    const deptString = Array.isArray(department) ? department.join(", ") : (department || "");

    await prisma.project.update({
      where: { id: existingProject.id },
      data: {
        project_code: project_code || existingProject.project_code,
        project_name: project_name || existingProject.project_name,
        client_name: client_name !== undefined ? client_name : existingProject.client_name,
        manager_id: manager_id !== undefined ? manager_id : existingProject.manager_id,
        start_date: start_date !== undefined ? start_date : existingProject.start_date,
        end_date: end_date !== undefined ? end_date : existingProject.end_date,
        status: status !== undefined ? status : existingProject.status,
        priority: priority !== undefined ? priority : existingProject.priority,
        department: deptString !== undefined ? deptString : existingProject.department,
        progress: progress !== undefined ? progress : existingProject.progress,
        project_email_update: project_email_update !== undefined ? project_email_update : existingProject.project_email_update,
        color: color !== undefined ? color : existingProject.color,
        custom_columns: custom_columns !== undefined ? custom_columns : existingProject.custom_columns
      }
    });

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
    const ctx = await getSessionContext();
    if (!ctx) return NextResponse.json({ status: "error", message: "Unauthorized" }, { status: 401 });

    const resolvedParams = await params;
    const projectId = resolvedParams.id;
    const email = ctx.email || "";
    const name = ctx.name_en || ctx.name_th || "Unknown";

    const existingProject = await prisma.project.findFirst({
      where: {
        OR: [
          { id: projectId },
          { project_code: projectId }
        ]
      }
    });
    
    if (!existingProject) {
      return NextResponse.json({ status: "error", message: "Project not found" }, { status: 404 });
    }

    const projectName = existingProject.project_name || "Unknown Project";

    if (!(await canEditProject(ctx, existingProject))) {
      return NextResponse.json({ status: "error", message: "Forbidden: You do not have permission to delete this project." }, { status: 403 });
    }

    // Delete Project (this will cascade delete Tasks because of onDelete: Cascade in schema)
    await prisma.project.delete({
      where: { id: existingProject.id }
    });

    // Write to Logs
    await logActivity(ctx.token, {
      action: "DELETE PROJECT",
      project_id: existingProject.id,
      project_name: projectName,
      user_name: name,
      user_email: email
    });

    revalidatePath("/projects");
    revalidatePath("/tasks");

    return NextResponse.json({ status: "success", message: "Project and associated tasks deleted successfully" });
  } catch (error: unknown) {
    const err = error as Error;
    console.error("API error deleting project:", err);
    return NextResponse.json({ status: "error", message: err.message || "Failed to delete project" }, { status: 500 });
  }
}
