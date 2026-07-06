import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { fetchSheetData } from "@/lib/googleSheets";
import { filterProjectsByDepartment, filterByDepartment, getSessionContext } from "@/lib/permissions";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const token = (session as { accessToken?: string })?.accessToken;
    
    if (!token) {
      return NextResponse.json({ status: "error", message: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const query = (searchParams.get("q") || "").toLowerCase().trim();

    if (!query) {
      return NextResponse.json({ status: "success", data: { projects: [], tasks: [] } });
    }

    // Fetch data
    const [projectsData, tasksData] = await Promise.all([
      fetchSheetData(token, "Projects!A:Z"),
      fetchSheetData(token, "Tasks!A:Z")
    ]);

    // Apply permissions
    const ctx = await getSessionContext();
    let allowedProjects = projectsData;
    let allowedTasks = tasksData;

    if (ctx) {
      allowedProjects = await filterProjectsByDepartment(ctx, projectsData);
      allowedTasks = await filterByDepartment(ctx, tasksData, (t: any) => t.assignee || t.assignee_id || "");
    }

    // Filter by query
    const matchedProjects = allowedProjects.filter((p: any) => 
      (p.project_name || "").toLowerCase().includes(query) ||
      (p.project_code || "").toLowerCase().includes(query) ||
      (p.client_name || "").toLowerCase().includes(query)
    ).slice(0, 5); // Limit to 5 results

    const matchedTasks = allowedTasks.filter((t: any) => 
      (t.task_name || "").toLowerCase().includes(query) ||
      (t.description || "").toLowerCase().includes(query)
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
