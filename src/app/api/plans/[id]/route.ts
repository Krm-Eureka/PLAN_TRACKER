import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { fetchSheetData, deleteSheetRow, updateSheetRow, appendSheetRow, getSheetHeaders } from "@/lib/googleSheets";
import { v7 as uuidv7 } from "uuid";

export async function DELETE(
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

    // 1. Fetch plans to find the correct row index
    const rows = await fetchSheetData(token, "Plans!A:Z");
    let rowIndex = -1;
    let foundPlan: any = null;

    for (let i = 0; i < rows.length; i++) {
      if (rows[i].id === plan_id) {
        rowIndex = i + 2; // +1 zero-indexed to 1-indexed, +1 for header row
        foundPlan = rows[i];
        break;
      }
    }

    if (rowIndex === -1 || !foundPlan) {
      return NextResponse.json({ status: "error", message: "Plan not found" }, { status: 404 });
    }

    // 2. Verify authorization
    if (foundPlan.user_id !== user_id) {
      return NextResponse.json({ status: "error", message: "Unauthorized to delete this plan" }, { status: 403 });
    }

    // 3. Delete the row
    await deleteSheetRow(token, "Plans", rowIndex);

    // 4. Sync Task Assignees if the plan had a task
    if (foundPlan.task_id) {
      try {
        const tasks = await fetchSheetData(token, "Tasks!A1:Z");
        const taskIdx = tasks.findIndex((t: any) => t.id === foundPlan.task_id);

        if (taskIdx !== -1) {
          const task = tasks[taskIdx];
          let assigneeIds = (task.assignee_id || "").split(",").map((id: string) => id.trim()).filter(Boolean);

          const participants = [foundPlan.user_id, ...(foundPlan.companions || foundPlan.col_10 || "").split(",").map((s: string) => s.trim())].filter(Boolean);

          let hasChanges = false;
          participants.forEach((id: string) => {
            // Safety check: is user in any OTHER plan for this task?
            const inOtherPlans = rows.some((r: any) => {
              if (r.id === plan_id || r.task_id !== foundPlan.task_id) return false;
              const rComps = (r.companions || "").split(",").map((c: string) => c.trim().toLowerCase());
              return r.user_id === id || rComps.includes(id.toLowerCase());
            });
            if (!inOtherPlans) {
              const originalLength = assigneeIds.length;
              assigneeIds = assigneeIds.filter((a: string) => a.toLowerCase() !== id.toLowerCase());
              if (assigneeIds.length !== originalLength) hasChanges = true;
            }
          });

          if (hasChanges) {
            // Update the sheet
            const users = await fetchSheetData(token, "Users!A1:T");
            const names = assigneeIds.map((id: string) => {
              const u = users.find((u: any) => u.id === id);
              return u?.name_en || u?.name_th || id;
            });
            const emails = assigneeIds.map((id: string) => {
              const u = users.find((u: any) => u.id === id);
              return u?.email || "";
            });

            const headers = await getSheetHeaders(token, "Tasks");
            const updatedTask: Record<string, any> = {
              ...task,
              assignee_id: assigneeIds.join(", "),
              assignee_name: names.join(", "),
              assignee_email: emails.join(", "),
            };

            const rowValues = headers.map((h: string) => updatedTask[h] ?? "");
            const endCol = String.fromCharCode(65 + headers.length - 1); // rough A-Z
            await updateSheetRow(token, `Tasks!A${taskIdx + 2}:${endCol}${taskIdx + 2}`, rowValues);
          }
        }
      } catch (e) {
        console.error("Failed to sync task assignees on plan delete:", e);
      }
    }

    return NextResponse.json({ status: "success", message: "Plan deleted successfully" });
  } catch (error: unknown) {
    const err = error as Error;
    console.error("API error deleting plan:", err);
    return NextResponse.json(
      { status: "error", message: err.message || "Failed to delete plan" },
      { status: 500 }
    );
  }
}

export async function PUT(
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
    const body = await req.json();

    // 1. Fetch plans to find the correct row index
    const rows = await fetchSheetData(token, "Plans!A:Z");
    let rowIndex = -1;
    let foundPlan: any = null;

    for (let i = 0; i < rows.length; i++) {
      if (rows[i].id === plan_id) {
        rowIndex = i + 2; // +1 zero-indexed to 1-indexed, +1 for header row
        foundPlan = rows[i];
        break;
      }
    }

    if (rowIndex === -1 || !foundPlan) {
      return NextResponse.json({ status: "error", message: "Plan not found" }, { status: 404 });
    }

    // 2. Verify authorization (Owner or Companion)
    const companionsList = (foundPlan.companions || foundPlan.col_10 || "").split(",").map((c: string) => c.trim().toLowerCase());
    const isOwner = foundPlan.user_id === user_id;
    const isCompanion = companionsList.includes(user_id.toLowerCase());
    
    if (!isOwner && !isCompanion) {
      return NextResponse.json({ status: "error", message: "Unauthorized to update this plan" }, { status: 403 });
    }

    // 3. Prepare the new row values (Columns: id, user_id, project_id, start_date, location, duration_days, plan_detail)
    const updatedValues = [
      foundPlan.id,
      foundPlan.user_id,
      body.project_id !== undefined ? body.project_id : (foundPlan.project_id || ""),
      body.start_date !== undefined ? body.start_date : (foundPlan.start_date || ""),
      body.location !== undefined ? body.location : (foundPlan.location || ""),
      body.duration_days !== undefined ? body.duration_days : (foundPlan.duration_days || "1"),
      body.plan_detail !== undefined ? body.plan_detail : (foundPlan.plan_detail || ""),
      body.task_id !== undefined ? body.task_id : (foundPlan.task_id || ""),
      body.start_time !== undefined ? body.start_time : (foundPlan.start_time || ""),
      body.end_time !== undefined ? body.end_time : (foundPlan.end_time || ""),
      body.companions !== undefined ? body.companions : (foundPlan.companions || foundPlan.col_10 || "")
    ];

    // 4. Update the row
    await updateSheetRow(token, `Plans!A${rowIndex}:K${rowIndex}`, updatedValues);

    // 5. Send notifications to new companions
    if (body.companions !== undefined) {
      const oldCompanions = (foundPlan.companions || foundPlan.col_10 || "").split(",").map((s: string) => s.trim()).filter(Boolean);
      const newCompanions = body.companions.split(",").map((s: string) => s.trim()).filter(Boolean);
      const addedCompanions = newCompanions.filter((id: string) => !oldCompanions.includes(id) && id !== user_id);
      
      if (addedCompanions.length > 0) {
        const sessionUser = (session as { user?: { name?: string } })?.user?.name || "Someone";
        for (const cid of addedCompanions) {
          const notifId = uuidv7();
          await appendSheetRow(token, "Notifications!A:G", [
            notifId, cid, "Added to a Plan", `${sessionUser} has added you to their plan: ${body.location || foundPlan.location}`, `/calendar`, "false", new Date().toISOString()
          ]);
        }
      }
    }

    // 6. Sync Task Assignees if companions or task changed
    const currentTaskId = body.task_id !== undefined ? body.task_id : (foundPlan.task_id || "");
    if (currentTaskId && body.companions !== undefined) {
      try {
        const oldCompanionsRaw = (foundPlan.companions || foundPlan.col_10 || "").split(",").map((s: string) => s.trim()).filter(Boolean);
        const newCompanionsRaw = body.companions.split(",").map((s: string) => s.trim()).filter(Boolean);
        
        const added = newCompanionsRaw.filter((id: string) => !oldCompanionsRaw.includes(id));
        const removed = oldCompanionsRaw.filter((id: string) => !newCompanionsRaw.includes(id));

        if (added.length > 0 || removed.length > 0) {
          const tasks = await fetchSheetData(token, "Tasks!A1:Z");
          const taskIdx = tasks.findIndex((t: any) => t.id === currentTaskId);

          if (taskIdx !== -1) {
            const task = tasks[taskIdx];
            let assigneeIds = (task.assignee_id || "").split(",").map((id: string) => id.trim()).filter(Boolean);

            // Add new companions
            added.forEach((id: string) => {
              if (!assigneeIds.map((a: string) => a.toLowerCase()).includes(id.toLowerCase())) {
                assigneeIds.push(id);
              }
            });

            // Remove companions (with safety check)
            removed.forEach((id: string) => {
              // Safety check: is user in any other plan for this task?
              const inOtherPlans = rows.some((r: any) => {
                if (r.id === plan_id || r.task_id !== currentTaskId) return false;
                const rComps = (r.companions || "").split(",").map((c: string) => c.trim().toLowerCase());
                return r.user_id === id || rComps.includes(id.toLowerCase());
              });
              if (!inOtherPlans) {
                assigneeIds = assigneeIds.filter((a: string) => a.toLowerCase() !== id.toLowerCase());
              }
            });

            const users = await fetchSheetData(token, "Users!A1:T");
            const names = assigneeIds.map((id: string) => {
              const u = users.find((u: any) => u.id === id);
              return u?.name_en || u?.name_th || id;
            });
            const emails = assigneeIds.map((id: string) => {
              const u = users.find((u: any) => u.id === id);
              return u?.email || "";
            });

            const headers = await getSheetHeaders(token, "Tasks");
            const updatedTask: Record<string, any> = {
              ...task,
              assignee_id: assigneeIds.join(", "),
              assignee_name: names.join(", "),
              assignee_email: emails.join(", "),
            };

            const rowValues = headers.map((h: string) => updatedTask[h] ?? "");
            const endCol = String.fromCharCode(65 + headers.length - 1); // rough A-Z
            await updateSheetRow(token, `Tasks!A${taskIdx + 2}:${endCol}${taskIdx + 2}`, rowValues);
          }
        }
      } catch (e) {
        console.error("Failed to sync task assignees on plan update:", e);
      }
    }

    return NextResponse.json({ status: "success", message: "Plan updated successfully" });
  } catch (error: unknown) {
    const err = error as Error;
    console.error("API error updating plan:", err);
    return NextResponse.json(
      { status: "error", message: err.message || "Failed to update plan" },
      { status: 500 }
    );
  }
}
