import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { fetchSheetData, updateSheetRow, clearSheetCache } from "@/lib/googleSheets";

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

    // 2. Remove user from companions
    const companionsList = (foundPlan.companions || foundPlan.col_10 || "").split(",").map((c: string) => c.trim()).filter(Boolean);
    
    const userIndex = companionsList.findIndex((c: string) => c.toLowerCase() === user_id.toLowerCase());
    if (userIndex === -1) {
      return NextResponse.json({ status: "success", message: "Already left or not joined" });
    }

    companionsList.splice(userIndex, 1);
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
