import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { appendSheetRow, fetchSheetData } from "@/lib/googleSheets";
import { getSessionContext, filterByDepartment } from "@/lib/permissions";

export async function GET() {
  try {
    const ctx = await getSessionContext();
    if (!ctx) return NextResponse.json({ status: "error", message: "Unauthorized" }, { status: 401 });

    // Fetch tasks and users in parallel
    const [rows, users] = await Promise.all([
      fetchSheetData(ctx.token, "Tasks!A:Z"),
      fetchSheetData(ctx.token, "Users!A:Z"),
    ]);

    // Build UUID -> name/email map
    const idToName:  Record<string, string> = {};
    const idToEmail: Record<string, string> = {};
    users.forEach((u) => {
      const uid = u.id || "";
      if (uid) {
        idToName[uid]  = u.name_th || u.name_en || u.email || uid;
        idToEmail[uid] = u.email || "";
      }
    });

    // Enrich tasks: resolve assignee UUID -> name, ensure delay fields exist
    const enriched = rows.map((t) => {
      const assigneeId = (t.assignee_id || "").trim();
      const dueDate    = (t.due_date || "").trim();
      const endDate    = (t.end_date || "").trim();

      // Compute is_delay if end_date exists and field is empty
      let isDelay = (t.is_delay || "").trim();
      if (endDate && dueDate && !isDelay) {
        const due = new Date(dueDate); due.setHours(0,0,0,0);
        const end = new Date(endDate); end.setHours(0,0,0,0);
        isDelay = end > due ? "TRUE" : "FALSE";
      }

      return {
        ...t,
        assignee_name:  (t.assignee_name || idToName[assigneeId] || assigneeId).trim(),
        assignee_email: (t.assignee_email || idToEmail[assigneeId] || "").trim(),
        is_delay:       isDelay,
      };
    });

    const filtered = await filterByDepartment(ctx, enriched, (t) => t.assignee_email || "");
    return NextResponse.json({ status: "success", data: filtered });
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
    const { project_id, task_name, description, assignee_id, start_date, due_date, status, priority } = body;

    if (!task_name) {
      return NextResponse.json({ status: "error", message: "Task name is required" }, { status: 400 });
    }

    // Resolve assignee_name from Users sheet
    let assigneeName = "";
    if (assignee_id) {
      try {
        const users = await fetchSheetData(token, "Users!A:Z");
        const found = users.find((u) => u.id === assignee_id);
        assigneeName = found?.name_th || found?.name_en || "";
      } catch {
        // non-critical
      }
    }

    const newTaskId = crypto.randomUUID();

    // Columns: A=id, B=project_id, C=task_name, D=description, E=assignee_id, F=assignee_name,
    //          G=start_date, H=due_date, I=end_date, J=is_delay, K=status, L=priority
    const rowData: (string | number)[] = [
      newTaskId,
      project_id   || "",
      task_name,
      description  || "",
      assignee_id  || "",
      assigneeName,        // F — ชื่ออ่านง่ายใน Sheets
      start_date   || "",
      due_date     || "",
      "",                  // I — end_date (ว่างไว้ก่อน จนกว่าจะ Done)
      "",                  // J — is_delay (ว่างไว้ก่อน)
      status       || "To Do",
      priority     || "Medium",
    ];

    await appendSheetRow(token, "Tasks!A:L", rowData);

    // Trigger WebSocket broadcast
    try {
      fetch('http://localhost:3001/emit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event: 'data-updated', data: { type: 'tasks' } })
      }).catch(e => console.error("Broadcast error:", e));
    } catch (e) {
      // ignore
    }

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
