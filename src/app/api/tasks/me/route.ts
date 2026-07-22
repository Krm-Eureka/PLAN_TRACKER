import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const user_id = (session as { id?: string })?.id;
    if (!user_id) {
      return NextResponse.json({ status: "error", message: "Unauthorized" }, { status: 401 });
    }

    // Since assignee_id is a comma-separated string of UUIDs, 
    // we can safely use 'contains' because UUIDs are unique and won't substring-match incorrectly.
    const tasks = await prisma.task.findMany({
      where: {
        assignee_id: {
          contains: user_id
        }
      },
      include: {
        project: true
      }
    });

    const myTasks = tasks.map(t => {
      let project_code = "";
      if (t.project) {
        const pCode = t.project.project_code && t.project.project_code !== "NONE" ? `${t.project.project_code} - ` : "";
        project_code = `${pCode}${t.project.project_name}`;
      }

      return {
        ...t,
        project_code
      };
    });

    return NextResponse.json({ status: "success", tasks: myTasks });
  } catch (error: unknown) {
    const err = error as Error;
    console.error("GET /api/tasks/me error:", err);
    return NextResponse.json(
      { status: "error", message: err.message || "Failed to fetch tasks" },
      { status: 500 }
    );
  }
}
