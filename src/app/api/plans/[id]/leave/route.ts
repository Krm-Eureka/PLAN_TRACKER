import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { fetchSheetData, updateSheetRow, clearSheetCache, getSheetHeaders, getColumnLetter } from "@/lib/googleSheets";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const token = (session as { accessToken?: string })?.accessToken;

    if (!token) {
      return NextResponse.json({ status: "error", message: "Unauthorized" }, { status: 401 });
    }

    const user_id = (session as { id?: string })?.id || "";
    if (!user_id) {
      return NextResponse.json({ status: "error", message: "User ID not found in session" }, { status: 401 });
    }

    const resolvedParams = await params;
    const plan_id = resolvedParams.id;

    // 1. Fetch the plan row
    const rows = await fetchSheetData(token, "Plans!A:K");
    let rowIndex = -1;
    let foundPlan: any = null;

    for (let i = 0; i < rows.length; i++) {
      if (rows[i].id === plan_id) {
        rowIndex = i + 2; // +1 for zero-index, +1 for header row
        foundPlan = rows[i];
        break;
      }
    }

    if (rowIndex === -1 || !foundPlan) {
      return NextResponse.json({ status: "error", message: "Plan not found" }, { status: 404 });
    }

    // 2. Check if user is in companions list
    const companionsList = (foundPlan.companions || "").split(",").map((c: string) => c.trim()).filter(Boolean);
    const userIndex = companionsList.findIndex((c: string) => c.toLowerCase() === user_id.toLowerCase());

    // 3. Sync with the linked Task (remove user from assignee_id)
    //    This runs even if user already left the Plan, to handle edge cases where
    //    the Plan was updated separately but the Task was not.
    const task_id = foundPlan.task_id || "";
    if (task_id) {
      try {
        const tasks = await fetchSheetData(token, "Tasks!A1:Z");
        const taskIdx = tasks.findIndex((t: any) => t.id === task_id);

        if (taskIdx !== -1) {
          const task = tasks[taskIdx];
          const taskRowIndex = taskIdx + 2;

          const assigneeIds = (task.assignee_id || "").split(",").map((id: string) => id.trim()).filter(Boolean);
          const filteredIds = assigneeIds.filter((id: string) => id.toLowerCase() !== user_id.toLowerCase());

          if (filteredIds.length !== assigneeIds.length) {
            const users = await fetchSheetData(token, "Users!A1:T");

            const names = filteredIds.map((id: string) => {
              const found = users.find((u: any) => u.id === id);
              return found?.name_en || found?.name_th || id;
            });
            const emails = filteredIds.map((id: string) => {
              const found = users.find((u: any) => u.id === id);
              return found?.email || "";
            });

            const headers = await getSheetHeaders(token, "Tasks");
            const updatedTask: Record<string, any> = {
              ...task,
              assignee_id: filteredIds.join(", "),
              assignee_name: names.join(", "),
              assignee_email: emails.join(", "),
            };

            const rowValues = headers.map((h: string) => updatedTask[h] ?? "");
            const endCol = getColumnLetter(headers.length - 1);
            await updateSheetRow(token, `Tasks!A${taskRowIndex}:${endCol}${taskRowIndex}`, rowValues);
          }
        }
      } catch (taskErr) {
        console.error("Failed to sync task assignee on leave:", taskErr);
        // Non-fatal: Plan update proceeds even if Task sync fails
      }
    }

    // 4. If not in companions list, nothing to remove from Plan
    if (userIndex === -1) {
      return NextResponse.json({ status: "success", message: "Already left or not joined" });
    }

    // 5. Remove user from companions and update the Plan row
    companionsList.splice(userIndex, 1);
    const newCompanions = companionsList.join(", ");

    const updatedValues = [
      foundPlan.id,
      foundPlan.user_id,
      foundPlan.project_id || "",
      foundPlan.start_date || "",
      foundPlan.location || "",
      foundPlan.duration_days || "1",
      foundPlan.plan_detail || "",
      foundPlan.task_id || "",
      foundPlan.start_time || "",
      foundPlan.end_time || "",
      newCompanions,
    ];

    await updateSheetRow(token, `Plans!A${rowIndex}:K${rowIndex}`, updatedValues);

    // 6. Clear cache so next fetch returns fresh data
    clearSheetCache();

    return NextResponse.json({ status: "success", message: "Left plan successfully" });
  } catch (error: unknown) {
    const err = error as Error;
    console.error("API error leaving plan:", err);
    return NextResponse.json(
      { status: "error", message: err.message || "Failed to leave plan" },
      { status: 500 }
    );
  }
}
