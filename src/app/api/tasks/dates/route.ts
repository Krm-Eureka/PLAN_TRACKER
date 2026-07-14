import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { fetchSheetData, updateSheetCell, getSheetHeaders, getColumnLetter } from "@/lib/googleSheets";
import { revalidatePath } from "next/cache";
import { logActivity } from "@/lib/logger";
import { getSessionContext } from "@/lib/permissions";

export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const token = (session as { accessToken?: string })?.accessToken;

    if (!token) {
      return NextResponse.json({ status: "error", message: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { task_id, start_date, due_date, percent_complete } = body;

    if (!task_id) {
      return NextResponse.json({ status: "error", message: "Missing task_id" }, { status: 400 });
    }

    const [rows, headers] = await Promise.all([
      fetchSheetData(token, "Tasks!A:Z"),
      getSheetHeaders(token, "Tasks"),
    ]);

    let rowIndex = -1;
    let taskName = "Task Progress Update";
    let projectId = task_id;
    for (let i = 0; i < rows.length; i++) {
      if ((rows[i].id || "").trim() === task_id.trim()) {
        rowIndex = i + 2;
        taskName = rows[i].task_name || "Task Progress Update";
        projectId = rows[i].project_id || task_id;
        break;
      }
    }

    if (rowIndex === -1) {
      return NextResponse.json({ status: "error", message: "Task not found" }, { status: 404 });
    }

    const updates: Promise<unknown>[] = [];

    if (start_date !== undefined) {
      const colIndex = headers.indexOf("start_date");
      if (colIndex !== -1) {
        updates.push(updateSheetCell(token, `Tasks!${getColumnLetter(colIndex)}${rowIndex}`, start_date));
      }
    }

    if (due_date !== undefined) {
      const colIndex = headers.indexOf("due_date");
      if (colIndex !== -1) {
        updates.push(updateSheetCell(token, `Tasks!${getColumnLetter(colIndex)}${rowIndex}`, due_date));
      }
    }

    if (body.update_date !== undefined) {
      const colIndex = headers.indexOf("update_date");
      if (colIndex !== -1) {
        updates.push(updateSheetCell(token, `Tasks!${getColumnLetter(colIndex)}${rowIndex}`, body.update_date));
      }
    }

    if (percent_complete !== undefined) {
      let colIndex = headers.indexOf("percent_complete");
      if (colIndex === -1) {
        colIndex = headers.length;
        await updateSheetCell(token, `Tasks!${getColumnLetter(colIndex)}1`, "percent_complete");
      }
      updates.push(updateSheetCell(token, `Tasks!${getColumnLetter(colIndex)}${rowIndex}`, String(percent_complete)));
    }

    await Promise.all(updates);
    revalidatePath("/tasks");
    
    // Log the activity
    const ctx = await getSessionContext();
    if (ctx) {
      await logActivity(token, {
        action: 'UPDATE TASK DATES',
        project_id: projectId || "",
        project_name: taskName,
        user_name: ctx.name_en || ctx.name_th || ctx.email,
        user_email: ctx.email
      });
    }

    return NextResponse.json({ status: "success", message: "Task updated successfully" });
  } catch (error: unknown) {
    const err = error as Error;
    console.error("PUT /api/tasks/dates error:", err);
    return NextResponse.json({ status: "error", message: err.message || "Failed to update task" }, { status: 500 });
  }
}
