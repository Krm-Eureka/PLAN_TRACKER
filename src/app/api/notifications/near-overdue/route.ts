import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { isTaskNearOverdue } from "@/utils/status";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const user_id = (session as { id?: string })?.id;

    if (!user_id) {
      return NextResponse.json({ status: "error", message: "Unauthorized" }, { status: 401 });
    }

    // Fetch all incomplete tasks for the user
    // (assignee_id is typically stored as a stringified array in this schema, e.g., '["user_id"]')
    const allTasks = await prisma.task.findMany({
      where: {
        assignee_id: { contains: user_id },
        due_date: { not: null } // must have a due date
      }
    });

    // We also need project details to group by project.
    // Fetch all projects just in case, since there aren't too many in a typical setup,
    // or fetch parent tasks. For this app, parent tasks ARE projects (Gantt chart parent logic).
    const parentTaskIds = Array.from(new Set(allTasks.map(t => t.parent_task_id).filter(id => id)));
    const parentTasks = await prisma.task.findMany({
      where: {
        id: { in: parentTaskIds as string[] }
      }
    });
    const projectMap = new Map();
    parentTasks.forEach(p => projectMap.set(p.id, p.task_name));

    // Filter tasks that are near overdue (within 30 mins of the 09:00 AM next day deadline)
    const nearOverdueTasks = allTasks.filter(t => {
      // 30 mins threshold
      return isTaskNearOverdue(t.status || 'To Do', t.due_date, 30);
    });

    if (nearOverdueTasks.length === 0) {
      return NextResponse.json({ status: "success", data: [] });
    }

    // Group by project (parent_task_id)
    const grouped = new Map<string, typeof nearOverdueTasks>();
    nearOverdueTasks.forEach(t => {
      const pId = t.parent_task_id || "No Project";
      if (!grouped.has(pId)) {
        grouped.set(pId, []);
      }
      grouped.get(pId)!.push(t);
    });

    // Format into notification-like objects for the frontend
    const notifications = [];
    for (const [pId, tasks] of grouped.entries()) {
      const projectName = pId === "No Project" ? "No Project" : (projectMap.get(pId) || "Unknown Project");
      
      const taskNames = tasks.map(t => t.task_order ? `${t.task_order}. ${t.task_name}` : t.task_name).join(', ');
      
      notifications.push({
        id: `near-overdue-${pId}`,
        title: `งานใกล้เลยกำหนด: ${projectName}`,
        message: `มี ${tasks.length} งานที่กำลังจะถึงกำหนดส่งในอีก 30 นาที: ${taskNames}`,
        is_read: "false",
        link: `/projects/${pId}`, // assuming this links to the project view
        created_at: new Date().toISOString(),
        type: 'alert',
        // attach exact task ids so frontend can remember them and not re-notify
        task_ids: tasks.map(t => t.id) 
      });
    }

    return NextResponse.json({ status: "success", data: notifications });
  } catch (error: unknown) {
    const err = error as Error;
    console.error("API error fetching near overdue tasks:", err);
    return NextResponse.json(
      { status: "error", message: err.message || "Failed to fetch near overdue tasks" },
      { status: 500 }
    );
  }
}
