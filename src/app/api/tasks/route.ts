import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { appendSheetRow, fetchSheetData } from "@/lib/googleSheets";
import { getSessionContext, filterByDepartment } from "@/lib/permissions";
import { unstable_cache, revalidatePath } from "next/cache";

const getCachedTasksRaw = unstable_cache(
  async (token: string) => await fetchSheetData(token, "Tasks!A:Z"),
  ['all-tasks-raw'],
  { tags: ['tasks'], revalidate: 3600 }
);

const getCachedUsersRaw = unstable_cache(
  async (token: string) => await fetchSheetData(token, "Users!A:Z"),
  ['all-users-raw'],
  { tags: ['users'], revalidate: 3600 }
);

export async function GET(req: NextRequest) {
  try {
    const ctx = await getSessionContext();
    if (!ctx) return NextResponse.json({ status: "error", message: "Unauthorized" }, { status: 401 });

    const url = new URL(req.url);
    const page = parseInt(url.searchParams.get("page") || "1", 10);
    const limit = parseInt(url.searchParams.get("limit") || "10000", 10);
    const search = url.searchParams.get("search")?.toLowerCase() || "";
    const projectId = url.searchParams.get("project_id") || "";

    // Fetch tasks and users from cache in parallel
    const [rows, users] = await Promise.all([
      getCachedTasksRaw(ctx.token),
      getCachedUsersRaw(ctx.token),
    ]);

    // Build UUID -> name/email map
    const idToName:  Record<string, string> = {};
    const idToEmail: Record<string, string> = {};
    users.forEach((u) => {
      const uid = u.id || "";
      if (uid) {
        idToName[uid]  = u.name_en || u.name_th || u.email || uid;
        idToEmail[uid] = u.email || "";
      }
    });

    // Enrich tasks: resolve assignee UUID -> name, ensure delay fields exist
    const enriched: any[] = rows.map((t: any) => {
      const assigneeId = (t.assignee_id || "").trim();
      const dueDate    = (t.due_date || "").trim();
      const updateDate = (t.update_date || "").trim();

      // Compute is_delay if update_date exists and field is empty
      let isDelay = (t.is_delay || "").trim();
      if (!isDelay && dueDate && updateDate) {
        const due = new Date(dueDate); due.setHours(0,0,0,0);
        const end = new Date(updateDate); end.setHours(0,0,0,0);
        isDelay = end > due ? "TRUE" : "FALSE";
      }
      
      // Handle comma-separated assignees
      const assigneeIds = assigneeId.split(",").map((id: string) => id.trim()).filter(Boolean);
      
      const assigneeNames = assigneeIds.map((id: string) => idToName[id] || id);
      const assigneeEmails = assigneeIds.map((id: string) => idToEmail[id] || "");

      return {
        ...t,
        assignee_name:  (t.assignee_name || assigneeNames.join(", ")).trim(),
        assignee_email: (t.assignee_email || assigneeEmails.join(", ")).trim(),
        is_delay:       isDelay,
      };
    });

    let filtered = await filterByDepartment(ctx, enriched, (t) => t.assignee_email || "");

    if (projectId) {
      filtered = filtered.filter(t => t.project_id === projectId);
    }

    if (search) {
      filtered = filtered.filter(t => 
        (t.task_name || "").toLowerCase().includes(search) || 
        (t.assignee_name || "").toLowerCase().includes(search)
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
    console.error("GET /api/tasks error:", err);
    return NextResponse.json({ status: "error", message: err.message || "Failed to fetch tasks" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const token = (session as { accessToken?: string })?.accessToken;

    if (!token) {
      return NextResponse.json({ status: "error", message: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { project_id, task_name, description, assignee_id, start_date, due_date, status, priority, parent_task_id } = body;

    if (!task_name) {
      return NextResponse.json({ status: "error", message: "Task name is required" }, { status: 400 });
    }

    // Process assignee_id: if it's an array, handle multiple assignees
    const assigneeIdsArray = Array.isArray(assignee_id) ? assignee_id : (assignee_id ? [assignee_id] : []);
    const assigneeIdString = assigneeIdsArray.join(", ");
    
    // Resolve assignee_names from Users sheet
    let assigneeNameString = "";
    if (assigneeIdsArray.length > 0) {
      try {
        const users = await getCachedUsersRaw(token);
        const names = assigneeIdsArray.map(id => {
          const found = users.find((u) => u.id === id);
          return found?.name_en || found?.name_th || id;
        });
        assigneeNameString = names.join(", ");
      } catch {
        // non-critical
      }
    }

    const newTaskId = crypto.randomUUID();

    let newTaskOrder = "";
    try {
      const allTasks = await getCachedTasksRaw(token);
      const projectTasks = allTasks.filter((t: any) => t.project_id === project_id);
      
      if (parent_task_id) {
        const parent = projectTasks.find((t: any) => t.id === parent_task_id);
        const siblings = projectTasks.filter((t: any) => t.parent_task_id === parent_task_id);
        const parentOrder = parent?.task_order || "";
        newTaskOrder = parentOrder ? `${parentOrder}.${siblings.length + 1}` : `${siblings.length + 1}`;
      } else {
        const rootTasks = projectTasks.filter((t: any) => !t.parent_task_id);
        newTaskOrder = `${rootTasks.length + 1}`;
      }
    } catch (e) {
      console.warn("Failed to calculate task order", e);
    }

    // Column map: A=id, B=project_id, C=task_name, D=description, E=assignee_id, F=assignee_name
    //          G=start_date, H=due_date, I=update_date, J=is_delay, K=status, L=priority
    //          M=task_order N=percent_complete O=parent_task_id
    const rowData: (string | number)[] = [
      newTaskId,           // A
      project_id   || "",  // B
      task_name    || "",  // C
      description  || "",  // D
      assigneeIdString,    // E
      assigneeNameString,  // F
      start_date   || "",  // G
      due_date     || "",  // H
      "",                  // I — update_date (ว่างไว้ก่อน)
      "",                  // J — is_delay (ว่างไว้ก่อน)
      status       || "To Do", // K
      priority     || "Medium", // L
      newTaskOrder,        // M task_order
      "",                  // N percent_complete
      parent_task_id || "", // O parent_task_id
    ];

    await appendSheetRow(token, "Tasks!A:O", rowData);
    revalidatePath("/tasks");

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


