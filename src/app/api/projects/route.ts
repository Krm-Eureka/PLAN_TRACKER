import { NextRequest, NextResponse } from "next/server";
import { getSessionContext, filterProjectsByDepartment } from "@/lib/permissions";
import { v7 as uuidv7 } from "uuid";
import { revalidatePath } from "next/cache";
import { logActivity } from "@/lib/logger";
import { prisma } from "@/lib/prisma";

const normalizeProjectCode = (code: string) => {
  return (code || "").toUpperCase().replace(/(^|\D)0+(?=\d)/g, '$1');
};

export async function POST(req: NextRequest) {
  try {
    const ctx = await getSessionContext();
    if (!ctx) return NextResponse.json({ status: "error", message: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { project_code, project_name, client_name, manager_id, start_date, end_date, status, priority, department, project_email_update, color, progress } = body;

    if (!project_code || !project_name) {
      return NextResponse.json({ status: "error", message: "Missing required fields" }, { status: 400 });
    }

    // Check for duplicate project code
    const normalizedInputCode = normalizeProjectCode(project_code);
    const existingProjects = await prisma.project.findMany();
    
    const isDuplicate = existingProjects.some(p => {
      if (!p.project_code) return false;
      return normalizeProjectCode(p.project_code) === normalizedInputCode;
    });

    if (isDuplicate) {
      return NextResponse.json({ status: "error", message: "Project Code already exists. Please use a unique code." }, { status: 400 });
    }

    const id = uuidv7();

    // Enforce department for non-admins
    let finalDepartment = department;
    if (!ctx.isAdmin) {
      if (!ctx.department) {
        return NextResponse.json({ status: "error", message: "Forbidden: You must belong to a department to create projects." }, { status: 403 });
      }
      finalDepartment = ctx.department;
    }

    // Process department: if it's an array, join it with commas
    const deptString = Array.isArray(finalDepartment) ? finalDepartment.join(", ") : (finalDepartment || "");

    const newProject = await prisma.project.create({
      data: {
        id,
        project_code,
        project_name,
        client_name: client_name || "",
        manager_id: manager_id || "",
        start_date: start_date || "",
        end_date: end_date || "",
        status: status || "Planning",
        priority: priority || "Medium",
        department: deptString,
        progress: progress || "",
        project_email_update: project_email_update || "",
        color: color || "#10b981"
      }
    });

    if (ctx) {
      await logActivity(ctx.token, {
        action: 'CREATE PROJECT',
        project_id: id,
        project_name: `${project_code} - ${project_name}`,
        user_name: ctx.email,
        user_email: ctx.email
      });
    }

    revalidatePath("/", "layout");
    return NextResponse.json({ status: "success", message: "Project created successfully", data: newProject });
  } catch (error: unknown) {
    const err = error as Error;
    console.error("API error creating project:", err);
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

    // Fetch projects directly from Prisma
    const data = await prisma.project.findMany({
      orderBy: { created_at: 'desc' }
    });
    
    // Filter by department (using the helper)
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
