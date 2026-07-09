import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { fetchSheetData, deleteSheetRow, updateSheetRow, appendSheetRow } from "@/lib/googleSheets";

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

    // 2. Verify authorization
    if (foundPlan.user_id !== user_id) {
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
          const notifId = crypto.randomUUID();
          await appendSheetRow(token, "Notifications!A:G", [
            notifId, cid, "Added to a Plan", `${sessionUser} has added you to their plan: ${body.location || foundPlan.location}`, `/calendar`, "false", new Date().toISOString()
          ]);
        }
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
