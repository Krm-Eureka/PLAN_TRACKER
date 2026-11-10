import { safeErrorMessage } from "@/lib/apiError";
import { NextRequest, NextResponse } from "next/server";
import { getSessionContext, getRolePermissions, filterProjectsByDepartment } from "@/lib/permissions";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const session = await getSessionContext();
    if (!session) {
      return NextResponse.json({ status: "error", message: "Unauthorized" }, { status: 401 });
    }

    // GLOBAL เห็นทั้งหมด; คนอื่นเห็นเฉพาะสิ่งที่ตัวเองทำ + log ของโปรเจกต์ที่ตัวเองเห็นได้
    const perms = await getRolePermissions(session);
    let where = {};
    if (perms.viewScope !== "GLOBAL") {
      const projects = await prisma.project.findMany({
        select: { id: true, project_code: true, manager_id: true, department: true },
      });
      const visible = await filterProjectsByDepartment(session, projects as unknown as Record<string, unknown>[]);
      const projectKeys = visible.flatMap((p) => [String(p.id), String(p.project_code || "")]).filter(Boolean);
      where = {
        OR: [
          { user_email: { equals: session.email, mode: "insensitive" as const } },
          { project_id: { in: projectKeys } },
        ],
      };
    }

    const data = await prisma.log.findMany({
      where,
      orderBy: { created_at: 'desc' },
      take: 100 // Limit to recent 100 logs
    });
    
    return NextResponse.json({ status: "success", data });
  } catch (error: unknown) {
    const err = error as Error;
    console.error("GET /api/logs error:", err);
    return NextResponse.json({ status: "error", message: safeErrorMessage(err, "Failed to fetch logs") }, { status: 500 });
  }
}
