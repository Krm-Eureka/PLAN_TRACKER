import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { updateSheetRow, fetchSheetData, getSheetHeaders, appendSheetRow } from "@/lib/googleSheets";
import { revalidatePath } from "next/cache";
import { getSessionContext, canEditTask } from "@/lib/permissions";
import { v7 as uuidv7 } from "uuid";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getSessionContext();
    if (!ctx) return NextResponse.json({ status: "error", message: "Unauthorized" }, { status: 401 });
    const token = ctx.token;

    const resolvedParams = await params;
    const taskId = resolvedParams.id;
    const body = await req.json();

    const data = await fetchSheetData(token, "Tasks!A1:Z");
    const index = data.findIndex((t: any) => t.id === taskId);
    
    if (index === -1) {
      return NextResponse.json({ status: "error", message: "Task not found" }, { status: 404 });
    }

    const rowIndex = index + 2;
    const existingTask = data[index];
    
    // Check permission (needs project)
    const projectsData = await fetchSheetData(token, "Projects!A1:Z");
    const project = projectsData.find((p: any) => p.id === existingTask.project_id || p.project_code === existingTask.project_id);
    
    if (!(await canEditTask(ctx, existingTask, project))) {
      return NextResponse.json({ status: "error", message: "Forbidden: You do not have permission to edit this task." }, { status: 403 });
    }
    
    const { task_name, description, assignee_id, start_date, due_date, status, priority, parent_task_id } = body;
    
    // Process assignee_id array -> string
    const assigneeIdsArray = Array.isArray(assignee_id) ? assignee_id : (assignee_id ? [assignee_id] : []);
    const assigneeIdString = assigneeIdsArray.join(", ");

    // Need to resolve names if assignee changed
    let assigneeNameString = existingTask.assignee_name || "";
    let assigneeEmailString = existingTask.assignee_email || ""; // just in case

    if (assigneeIdString !== existingTask.assignee_id) {
      if (assigneeIdsArray.length > 0) {
        try {
          const users = await fetchSheetData(token, "Users!A:Z");
          const names = assigneeIdsArray.map((id: string) => {
            const found = users.find((u: any) => u.id === id);
            return found?.name_en || found?.name_th || id;
          });
          assigneeNameString = names.join(", ");
          
          const emails = assigneeIdsArray.map((id: string) => {
            const found = users.find((u: any) => u.id === id);
            return found?.email || "";
          });
          assigneeEmailString = emails.join(", ");
        } catch {
          // ignore
        }
      } else {
        assigneeNameString = "";
        assigneeEmailString = "";
      }
    }

    const headers = await getSheetHeaders(token, "Tasks");
    
    const updatedValues: Record<string, any> = {
      ...existingTask,
      task_name: task_name !== undefined ? task_name : existingTask.task_name,
      description: description !== undefined ? description : existingTask.description,
      assignee_id: assigneeIdString,
      assignee_name: assigneeNameString,
      start_date: start_date !== undefined ? start_date : existingTask.start_date,
      due_date: due_date !== undefined ? due_date : existingTask.due_date,
      status: status !== undefined ? status : existingTask.status,
      priority: priority !== undefined ? priority : existingTask.priority,
      parent_task_id: parent_task_id !== undefined ? parent_task_id : existingTask.parent_task_id,
      update_date: (status === "Done" || status === "Complete") ? new Date().toISOString().split("T")[0] : existingTask.update_date
    };

    const rowData = headers.map(header => {
      const cleanHeader = header.trim().toLowerCase();
      if (updatedValues[cleanHeader] !== undefined) return updatedValues[cleanHeader];
      if (updatedValues[header] !== undefined) return updatedValues[header];
      return "";
    });

    const lastColLetter = String.fromCharCode(65 + Math.max(headers.length, rowData.length) - 1);
    await updateSheetRow(token, `Tasks!A${rowIndex}:${lastColLetter}${rowIndex}`, rowData);

    // --- NOTIFICATION LOGIC ---
    // If assignees changed, send notifications to newly assigned users
    const oldAssignees = new Set((existingTask.assignee_id || "").split(",").map((s: string) => s.trim()).filter(Boolean));
    const newAssignees = new Set(assigneeIdsArray as string[]);
    
    const addedAssignees = Array.from(newAssignees).filter(id => !oldAssignees.has(id));
    
    if (addedAssignees.length > 0) {
      try {
        const createdAt = new Date().toISOString();
        const notificationPromises = addedAssignees.map(async (uid) => {
          // Don't notify self
          if (uid === ctx.id) return;
          
          const newId = uuidv7();
          const title = `Task Assignment: ${updatedValues.task_name}`;
          const message = `You have been assigned to task: ${updatedValues.task_name}`;
          const link = `/projects/${encodeURIComponent(existingTask.project_id || "")}`;
          
          return appendSheetRow(token, "Notifications!A:G", [
            newId, uid, title, message, link, "false", createdAt
          ]);
        });
        
        await Promise.all(notificationPromises);
      } catch (e) {
        console.error("Failed to send assignment notifications:", e);
      }
    }

    const { revalidatePath, revalidateTag } = await import("next/cache");
    revalidatePath("/projects");
    revalidatePath(`/projects/${encodeURIComponent(existingTask.project_id || "")}`);
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    revalidateTag("tasks");

    return NextResponse.json({ status: "success", message: "Task updated successfully" });
  } catch (error: unknown) {
    const err = error as Error;
    console.error("API error updating task:", err);
    return NextResponse.json({ status: "error", message: err.message || "Failed to update task" }, { status: 500 });
  }
}
