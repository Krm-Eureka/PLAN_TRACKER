import { NextRequest, NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { getSessionContext, canEditTask } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export async function PUT(req: NextRequest) {
  try {
    const ctx = await getSessionContext();
    if (!ctx) return NextResponse.json({ status: "error", message: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { updates } = body; // Array of { id: string, task_order: string }

    if (!updates || !Array.isArray(updates)) {
      return NextResponse.json({ status: "error", message: "Invalid updates format" }, { status: 400 });
    }

    // Fetch tasks to check permissions
    const taskIds = updates.map(u => u.id);
    const tasks = await prisma.task.findMany({
      where: { id: { in: taskIds } }
    });

    const projectIds = Array.from(new Set(tasks.map(t => t.project_id)));
    const projects = await prisma.project.findMany({
      where: {
        OR: [
          { id: { in: projectIds } },
          { project_code: { in: projectIds } }
        ]
      }
    });

    // Verify permissions for all updates
    for (const task of tasks) {
      const project = projects.find(p => p.id === task.project_id || p.project_code === task.project_id);
      if (!(await canEditTask(ctx, task, project || undefined))) {
        return NextResponse.json({ status: "error", message: "Forbidden: You do not have permission to reorder one or more tasks." }, { status: 403 });
      }
    }

    // Prepare batch updates (transactions)
    const updatePromises = updates.map(update => {
      return prisma.task.update({
        where: { id: update.id },
        data: { task_order: String(update.task_order) }
      });
    });

    if (updatePromises.length > 0) {
      await prisma.$transaction(updatePromises);
    }

    revalidatePath("/", "layout");

    return NextResponse.json({ status: "success", message: "Tasks reordered successfully" });
  } catch (error: unknown) {
    const err = error as Error;
    console.error("PUT /api/tasks/reorder error:", err);
    return NextResponse.json(
      { status: "error", message: err.message || "Failed to reorder tasks" },
      { status: 500 }
    );
  }
}
