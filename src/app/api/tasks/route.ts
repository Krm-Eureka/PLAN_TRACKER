// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { getSessionContext, filterByDepartment, canEditProject } from "@/lib/permissions";
import { v7 as uuidv7 } from "uuid";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getAutoAdjustedPercent } from "@/utils/status";

export async function GET(req: NextRequest) {
  try {
    const ctx = await getSessionContext();
    if (!ctx) return NextResponse.json({ status: "error", message: "Unauthorized" }, { status: 401 });

    const url = new URL(req.url);
    const page = parseInt(url.searchParams.get("page") || "1", 10);
    const limit = parseInt(url.searchParams.get("limit") || "10000", 10);
    const search = url.searchParams.get("search")?.toLowerCase() || "";
    const projectId = url.searchParams.get("project_id") || "";

    // Build where clause for Prisma
    let whereClause: any = {};
    if (projectId) {
      const matchingProject = await prisma.project.findFirst({
        where: { OR: [{ id: projectId }, { project_code: projectId }] }
      });

      const possibleIds = new Set<string>();
      possibleIds.add(projectId);
      if (matchingProject) {
        if (matchingProject.id) possibleIds.add(matchingProject.id);
        if (matchingProject.project_code) possibleIds.add(matchingProject.project_code);
      }

      whereClause.project_id = { in: Array.from(possibleIds) };
    }
    
    if (search) {
      whereClause.OR = [
        { task_name: { contains: search, mode: 'insensitive' } },
        { assignee_name: { contains: search, mode: 'insensitive' } },
      ];
    }

    const tasks = await prisma.task.findMany({
      where: whereClause,
      orderBy: { created_at: 'desc' }
    });

    // Compute is_delay dynamically
    const enriched = tasks.map((t) => {
      let isDelay = t.is_delay;
      if (!isDelay && t.due_date && t.update_date) {
        const due = new Date(t.due_date); due.setHours(0, 0, 0, 0);
        const end = new Date(t.update_date); end.setHours(0, 0, 0, 0);
        isDelay = end > due;
      }
      return {
        ...t,
        is_delay: isDelay,
      };
    });

    // Filter by department based on permissions
    let filtered = await filterByDepartment(ctx, enriched, (t) => t.assignee_id || "");

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
    console.error("GET /api/tasks error:", err);
    return NextResponse.json({ status: "error", message: err.message || "Failed to fetch tasks" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const ctx = await getSessionContext();
    if (!ctx) return NextResponse.json({ status: "error", message: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { project_id, task_name, description, assignee_id, start_date, due_date, status, priority, parent_task_id, percent_complete } = body;

    if (!task_name) {
      return NextResponse.json({ status: "error", message: "Task name is required" }, { status: 400 });
    }

    // Verify project access
    if (project_id) {
      const project = await prisma.project.findFirst({
        where: { OR: [{ id: project_id }, { project_code: project_id }] }
      });

      if (!project) {
        return NextResponse.json({ status: "error", message: "Project not found" }, { status: 404 });
      }

      if (!(await canEditProject(ctx, project))) {
        return NextResponse.json({ status: "error", message: "Forbidden: You do not have permission to add tasks to this project." }, { status: 403 });
      }
    }

    // Process assignee_id
    const assigneeIdsArray = Array.isArray(assignee_id) ? assignee_id : (assignee_id ? [assignee_id] : []);
    const assigneeIdString = assigneeIdsArray.join(", ");

    // Resolve assignee_names from Users DB
    let assigneeNameString = "";
    let assigneeEmailString = "";
    if (assigneeIdsArray.length > 0) {
      const users = await prisma.user.findMany({
        where: { id: { in: assigneeIdsArray } }
      });
      const names = assigneeIdsArray.map(id => {
        const found = users.find((u) => u.id === id);
        return found?.name_en || found?.name_th || id;
      });
      const emails = assigneeIdsArray.map(id => {
        const found = users.find((u) => u.id === id);
        return found?.email || "";
      });
      assigneeNameString = names.join(", ");
      assigneeEmailString = emails.join(", ");
    }

    const newTaskId = uuidv7();
    let newTaskOrder = "";

    try {
      const projectTasks = await prisma.task.findMany({
        where: { project_id: project_id }
      });

      if (parent_task_id) {
        const parent = projectTasks.find((t) => t.id === parent_task_id);
        const siblings = projectTasks.filter((t) => t.parent_task_id === parent_task_id);
        const parentOrder = parent?.task_order || "";
        newTaskOrder = parentOrder ? `${parentOrder}.${siblings.length + 1}` : `${siblings.length + 1}`;
      } else {
        const rootTasks = projectTasks.filter((t) => !t.parent_task_id);
        newTaskOrder = `${rootTasks.length + 1}`;
      }
    } catch (e) {
      console.warn("Failed to calculate task order", e);
    }

    let finalPercent = percent_complete !== undefined ? String(percent_complete) : "";
    if (!finalPercent) {
      finalPercent = String(getAutoAdjustedPercent("To Do", status || "To Do", 0));
    }

    const newTask = await prisma.task.create({
      data: {
        id: newTaskId,
        project_id: project_id || "",
        task_name: task_name || "",
        description: description || "",
        assignee_id: assigneeIdString,
        assignee_name: assigneeNameString,
        start_date: start_date || "",
        due_date: due_date || "",
        update_date: "",
        is_delay: false,
        status: status || "To Do",
        priority: priority || "Medium",
        task_order: newTaskOrder,
        percent_complete: finalPercent,
        parent_task_id: parent_task_id || "",
      }
    });

    // --- NOTIFICATION LOGIC ---
    if (assigneeIdsArray.length > 0) {
      try {
        const notificationData = assigneeIdsArray
          .filter(uid => uid !== ctx?.id) // Don't notify self
          .map(uid => ({
            id: uuidv7(),
            user_id: uid,
            title: `New Task Assignment: ${task_name}`,
            message: `You have been assigned to a new task: ${task_name}`,
            link: `/projects/${encodeURIComponent(project_id || "")}`,
            is_read: false
          }));

        if (notificationData.length > 0) {
          await prisma.notification.createMany({
            data: notificationData
          });
        }
      } catch (e) {
        console.error("Failed to send assignment notifications on task creation:", e);
      }
    }

    if (ctx) {
      await prisma.log.create({
        data: {
          id: uuidv7(),
          action: 'CREATE TASK',
          project_id: project_id || "",
          project_name: task_name || "Unknown Task",
          user_name: ctx.name_en || ctx.name_th || ctx.email,
          user_email: ctx.email
        }
      });
    }

    revalidatePath("/", "layout");

    return NextResponse.json({ status: "success", message: "Task created successfully", data: { id: newTaskId } });
  } catch (error: unknown) {
    const err = error as Error;
    console.error("POST /api/tasks error:", err);
    return NextResponse.json(
      { status: "error", message: err.message || "Failed to create task" },
      { status: 500 }
    );
  }
}
