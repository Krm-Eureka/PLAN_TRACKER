import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { fetchSheetData, deleteSheetRow, updateSheetRow } from "@/lib/googleSheets";

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

    // 3. Prepare the new row values (Columns: id, user_id, project_id, start_date, location, duration_days)
    const updatedValues = [
      foundPlan.id,
      foundPlan.user_id,
      body.project_id !== undefined ? body.project_id : (foundPlan.project_id || ""),
      body.start_date !== undefined ? body.start_date : (foundPlan.start_date || ""),
      body.location !== undefined ? body.location : (foundPlan.location || ""),
      body.duration_days !== undefined ? body.duration_days : (foundPlan.duration_days || "1")
    ];

    // 4. Update the row
    await updateSheetRow(token, `Plans!A${rowIndex}:F${rowIndex}`, updatedValues);

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
