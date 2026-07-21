import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { fetchSheetData, updateSheetRow, appendSheetRow, clearSheetCache, getSheetHeaders, getColumnLetter } from "@/lib/googleSheets";
import { v7 as uuidv7 } from "uuid";

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

    // 2. Guard: already joined or is the owner
    const companionsList = (foundPlan.companions || "").split(",").map((c: string) => c.trim()).filter(Boolean);
    if (foundPlan.user_id === user_id || companionsList.map((c: string) => c.toLowerCase()).includes(user_id.toLowerCase())) {
      return NextResponse.json({ status: "success", message: "Already joined" });
    }

    // 3. Add user to companions and update the Plan row
    companionsList.push(user_id);
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

    // 4. Sync with the linked Task (add user to assignee_id)
    const task_id = foundPlan.task_id || "";
    console.log(`[Join API] Plan ID: ${foundPlan.id}, Linked Task ID: '${task_id}'`);
    if (task_id) {
      try {
        const tasks = await fetchSheetData(token, "Tasks!A1:Z");
        const taskIdx = tasks.findIndex((t: any) => t.id === task_id);

        if (taskIdx !== -1) {
          const task = tasks[taskIdx];
          const taskRowIndex = taskIdx + 2;

          const assigneeIds = (task.assignee_id || "").split(",").map((id: string) => id.trim()).filter(Boolean);

          if (!assigneeIds.some((id: string) => id.toLowerCase() === user_id.toLowerCase())) {
            assigneeIds.push(user_id);

            const users = await fetchSheetData(token, "Users!A1:T");

            const names = assigneeIds.map((id: string) => {
              const found = users.find((u: any) => u.id === id);
              return found?.name_en || found?.name_th || id;
            });
            const emails = assigneeIds.map((id: string) => {
              const found = users.find((u: any) => u.id === id);
              return found?.email || "";
            });

            const headers = await getSheetHeaders(token, "Tasks");
            const updatedTask: Record<string, any> = {
              ...task,
              assignee_id: assigneeIds.join(", "),
              assignee_name: names.join(", "),
              assignee_email: emails.join(", "),
            };

            const rowValues = headers.map((h: string) => updatedTask[h] ?? "");
            const endCol = getColumnLetter(headers.length - 1);
            console.log(`[Join API] Updating Tasks range: Tasks!A${taskRowIndex}:${endCol}${taskRowIndex} with ${assigneeIds.length} assignees`);
            await updateSheetRow(token, `Tasks!A${taskRowIndex}:${endCol}${taskRowIndex}`, rowValues);
            console.log(`[Join API] Task synced successfully!`);
          } else {
            console.log(`[Join API] User already in task assignee_id`);
          }
        } else {
          console.log(`[Join API] Task ID ${task_id} not found in Tasks sheet`);
        }
      } catch (taskErr) {
        console.error("Failed to sync task assignee on join:", taskErr);
        // Non-fatal: Plan update already succeeded
      }
    }

    // 5. Clear cache so next fetch returns fresh data
    clearSheetCache();

    // 6. Notify the plan owner
    if (foundPlan.user_id) {
      const sessionUser = (session as { user?: { name?: string } })?.user?.name || "Someone";
      const notifId = uuidv7();
      await appendSheetRow(token, "Notifications!A:G", [
        notifId,
        foundPlan.user_id,
        "New Plan Joiner",
        `${sessionUser} has joined your plan: ${foundPlan.location}`,
        `/calendar`,
        "false",
        new Date().toISOString(),
      ]);
    }

    return NextResponse.json({ status: "success", message: "Joined plan successfully" });
  } catch (error: unknown) {
    const err = error as Error;
    console.error("API error joining plan:", err);
    return NextResponse.json(
      { status: "error", message: err.message || "Failed to join plan" },
      { status: 500 }
    );
  }
}
