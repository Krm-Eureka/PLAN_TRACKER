import { safeErrorMessage } from "@/lib/apiError";
import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import {
  getSessionContext,
  filterProjectsByDepartment,
} from "@/lib/permissions";
import { createProjectIssue } from "@/lib/issueService";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const ctx = await getSessionContext();
    if (!ctx) {
      return NextResponse.json(
        { status: "error", message: "Unauthorized" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId")?.trim() || "";
    const statusFilter = searchParams.get("status")?.trim() || "";

    const allProjects = await prisma.project.findMany({
      select: {
        id: true,
        project_code: true,
        project_name: true,
        manager_id: true,
        department: true,
        status: true,
      },
    });

    const visibleProjects = await filterProjectsByDepartment(
      ctx,
      allProjects as unknown as Record<string, unknown>[]
    );
    const visibleProjectIds = visibleProjects.map((p) => String(p.id));

    if (projectId && !visibleProjectIds.includes(projectId)) {
      return NextResponse.json({ status: "success", data: [] });
    }

    const issues = await prisma.projectIssue.findMany({
      where: {
        project_id: projectId ? projectId : { in: visibleProjectIds },
        ...(statusFilter && statusFilter !== "ALL"
          ? { status: statusFilter }
          : {}),
      },
      include: {
        project: {
          select: {
            id: true,
            project_code: true,
            project_name: true,
            department: true,
          },
        },
        reported_by: {
          select: {
            id: true,
            name_th: true,
            name_en: true,
            email: true,
          },
        },
      },
      orderBy: { created_at: "desc" },
    });

    return NextResponse.json({ status: "success", data: issues });
  } catch (error: unknown) {
    console.error("GET /api/issues error:", error);
    return NextResponse.json(
      {
        status: "error",
        message: safeErrorMessage(error, "Failed to fetch issues"),
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const ctx = await getSessionContext();
    if (!ctx) {
      return NextResponse.json(
        { status: "error", message: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await req.json();
    const projectId = String(body.project_id || body.project_code || "").trim();
    const description = String(body.description || "").trim();

    if (!projectId || !description) {
      return NextResponse.json(
        { status: "error", message: "project_id and description are required" },
        { status: 400 }
      );
    }

    const result = await createProjectIssue({
      ctx,
      projectIdOrCode: projectId,
      description,
      source: "WEB",
    });

    if (!result.ok) {
      return NextResponse.json(
        { status: "error", message: result.message },
        { status: result.status }
      );
    }

    revalidatePath("/issues");
    revalidatePath(`/projects/${result.issue.project_id}`);

    return NextResponse.json(
      { status: "success", data: result.issue },
      { status: 201 }
    );
  } catch (error: unknown) {
    console.error("POST /api/issues error:", error);
    return NextResponse.json(
      {
        status: "error",
        message: safeErrorMessage(error, "Failed to create issue"),
      },
      { status: 500 }
    );
  }
}
