import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { fetchSheetData, updateSheetRow, appendSheetRow, clearSheetCache } from "@/lib/googleSheets";
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

    // 2. Add user to companions if not already there
    const companionsList = (foundPlan.companions || foundPlan.col_10 || "").split(",").map((c: string) => c.trim()).filter(Boolean);
    
    // Check if user is owner or already a companion
    if (foundPlan.user_id === user_id || companionsList.map((c: string) => c.toLowerCase()).includes(user_id.toLowerCase())) {
      return NextResponse.json({ status: "success", message: "Already joined" });
    }

    companionsList.push(user_id);
    const newCompanions = companionsList.join(", ");

    // 3. Prepare the new row values
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
      newCompanions
    ];

    // 4. Update the row
    await updateSheetRow(token, `Plans!A${rowIndex}:K${rowIndex}`, updatedValues);

    // 5. Clear cache so next fetch returns fresh data
    clearSheetCache();

    // 5. Notify the owner
    if (foundPlan.user_id) {
      const sessionUser = (session as { user?: { name?: string } })?.user?.name || "Someone";
      const notifId = uuidv7();
      await appendSheetRow(token, "Notifications!A:G", [
        notifId, foundPlan.user_id, "New Plan Joiner", `${sessionUser} has joined your plan: ${foundPlan.location}`, `/calendar`, "false", new Date().toISOString()
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
