import { NextRequest, NextResponse } from "next/server";
import { filterProjectsByDepartment, filterByDepartment, getSessionContext } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const ctx = await getSessionContext();
    
    if (!ctx) {
      return NextResponse.json({ status: "error", message: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const query = (searchParams.get("q") || "").toLowerCase().trim();

    if (!query) {
      return NextResponse.json({ status: "success", data: { projects: [], tasks: [] } });
    }

    // Fetch data from Prisma
    const [projectsData, tasksData] = await Promise.all([
      prisma.project.findMany({
        orderBy: { created_at: 'desc' }
      }),
      prisma.task.findMany({
        orderBy: { created_at: 'desc' }
      })
    ]);

    // Apply permissions
    let allowedProjects = await filterProjectsByDepartment(ctx, projectsData);
    let allowedTasks = await filterByDepartment(ctx, tasksData, (t: any) => t.assignee_id || t.assignee_name || "");

    // Filter by query
    const matchedProjects = allowedProjects.filter((p: any) => 
      (p.project_name || "").toLowerCase().includes(query) ||
      (p.project_code || "").toLowerCase().includes(query) ||
      (p.client_name || "").toLowerCase().includes(query) ||
      (p.status || "").toLowerCase().includes(query)
    ).slice(0, 5); // Limit to 5 results

    const matchedTasks = allowedTasks.filter((t: any) => 
      (t.task_name || "").toLowerCase().includes(query) ||
      (t.description || "").toLowerCase().includes(query) ||
      (t.status || "").toLowerCase().includes(query)
    ).slice(0, 5); // Limit to 5 results

    return NextResponse.json({ 
      status: "success", 
      data: { 
        projects: matchedProjects,
        tasks: matchedTasks
      } 
    });
  } catch (error: unknown) {
    const err = error as Error;
    console.error("API error searching:", err);
    return NextResponse.json(
      { status: "error", message: err.message || "Failed to search" },
      { status: 500 }
    );
  }
}
