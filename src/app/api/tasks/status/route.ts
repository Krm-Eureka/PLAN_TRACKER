import { safeErrorMessage } from "@/lib/apiError";
import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getSessionContext } from "@/lib/permissions";
import { updateTaskStatusCore } from "@/lib/taskStatusService";

export async function PUT(req: NextRequest) {
  try {
    const ctx = await getSessionContext();
    if (!ctx) return NextResponse.json({ status: "error", message: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { task_id, new_status } = body;

    if (!task_id || !new_status) {
      return NextResponse.json({ status: "error", message: "Missing parameters" }, { status: 400 });
    }

    const result = await updateTaskStatusCore({
      ctx,
      taskId: String(task_id),
      newStatus: String(new_status),
    });

    if (!result.ok) {
      return NextResponse.json(
        { status: "error", message: result.message },
        { status: result.status }
      );
    }

    revalidatePath('/tasks');
    revalidatePath('/projects');
    revalidatePath('/weekly');

    if (result.isDone) {
      return NextResponse.json({
        status: "success",
        message: "Status updated to Done",
        update_date: result.updateDate,
        is_delay: result.isDelay,
      });
    }

    if (result.resumeDates) {
      return NextResponse.json({
        status: "success",
        message: "Status resumed from On Hold",
        start_date: result.resumeDates.start_date,
        due_date: result.resumeDates.due_date,
      });
    }

    return NextResponse.json({ status: "success", message: "Status updated successfully" });
  } catch (error: unknown) {
    const err = error as Error;
    console.error("PUT /api/tasks/status error:", err);
    return NextResponse.json(
      { status: "error", message: safeErrorMessage(err, "Failed to update status") },
      { status: 500 }
    );
  }
}
