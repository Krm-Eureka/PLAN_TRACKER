import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { appendSheetRow, fetchSheetData } from "@/lib/googleSheets";
import { getSessionContext, filterProjectsByDepartment } from "@/lib/permissions";
import { unstable_cache, revalidatePath } from "next/cache";
import { logActivity } from "@/lib/logger";

const getCachedProjects = unstable_cache(
  async (token: string) => {
    return await fetchSheetData(token, "Projects!A1:Z");
  },
  ['all-projects-raw'],
  { tags: ['projects'], revalidate: 3600 }
);

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const token = (session as { accessToken?: string })?.accessToken;
    if (!token) return NextResponse.json({ status: "error", message: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { project_code, project_name, client_name, manager_id, start_date, end_date, status, priority, department, project_email_update, color } = body;

    if (!project_code || !project_name) {
      return NextResponse.json({ status: "error", message: "Missing required fields" }, { status: 400 });
    }

    const id = crypto.randomUUID();

    // Process department: if it's an array, join it with commas
    const deptString = Array.isArray(department) ? department.join(", ") : (department || "");

    // Data: [id, project_code, project_name, client_name, manager_id, start_date, end_date, status, priority, department, progress, project_email_update, color]
    const rowData = [
      id, project_code, project_name, client_name || "",
      manager_id || "", start_date || "", end_date || "",
      status || "Planning", priority || "Medium",
      deptString,
      "",
      project_email_update || "",
      color || "#10b981"
    ];

    await appendSheetRow(token, "Projects", rowData);

    // Log the activity
    const ctx = await getSessionContext();
    if (ctx) {
      await logActivity(token, {
        action: 'CREATE PROJECT',
        project_id: id,
        project_name: `${project_code} - ${project_name}`,
        user_name: ctx.email,
        user_email: ctx.email
      });
    }

    revalidatePath("/projects");

    return NextResponse.json({ status: "success", message: "Project created successfully" });
  } catch (error: unknown) {
    const err = error as Error;
    console.error("API error appending project:", err);
    return NextResponse.json({ status: "error", message: err.message || "Failed to create project" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const ctx = await getSessionContext();
    if (!ctx) return NextResponse.json({ status: "error", message: "Unauthorized" }, { status: 401 });

    const url = new URL(req.url);
    const page = parseInt(url.searchParams.get("page") || "1", 10);
    const limit = parseInt(url.searchParams.get("limit") || "10000", 10); // default huge to not break existing clients temporarily
    const search = url.searchParams.get("search")?.toLowerCase() || "";

    const data = await getCachedProjects(ctx.token);
    let filtered = await filterProjectsByDepartment(ctx, data);

    if (search) {
      filtered = filtered.filter(p =>
        (p.project_name || "").toLowerCase().includes(search) ||
        (p.project_code || "").toLowerCase().includes(search) ||
        (p.client_name || "").toLowerCase().includes(search)
      );
    }

    const total = filtered.length;
    const totalPages = Math.ceil(total / limit);
    const offset = (page - 1) * limit;
    const paginated = filtered.slice(offset, offset + limit);

    return NextResponse.json({
      status: "success",
      data: paginated,
      meta: { total, page, limit, totalPages }
    });
  } catch (error: unknown) {
    const err = error as Error;
    console.error("API error fetching projects:", err);
    return NextResponse.json({ status: "error", message: err.message || "Failed to fetch projects" }, { status: 500 });
  }
}

