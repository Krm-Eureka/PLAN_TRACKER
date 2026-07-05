import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { appendSheetRow, fetchSheetData } from "@/lib/googleSheets";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const token = (session as { accessToken?: string })?.accessToken;
    
    if (!token) {
      return NextResponse.json({ status: "error", message: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { start_date, location, duration_days, project_id } = body;

    if (!start_date || !location || !duration_days) {
      return NextResponse.json({ status: "error", message: "Missing required fields" }, { status: 400 });
    }

    // Get current user details from session
    const user_id = (session as { id?: string })?.id || "";
    
    if (!user_id) {
      return NextResponse.json({ status: "error", message: "User ID not found in session. Please relogin." }, { status: 400 });
    }

    const newPlanId = crypto.randomUUID();

    // Data format: [id, user_id, project_id, start_date, location, duration_days]
    const rowData = [
      newPlanId,
      user_id,
      project_id || "",
      start_date,
      location,
      duration_days
    ];

    await appendSheetRow(token, "Plans!A:F", rowData);

    return NextResponse.json({ status: "success", message: "Plan saved successfully" });
  } catch (error: unknown) {
    const err = error as Error;
    console.error("API error appending plan:", err);
    return NextResponse.json(
      { status: "error", message: err.message || "Failed to save plan" },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const token = (session as { accessToken?: string })?.accessToken;
    
    if (!token) {
      return NextResponse.json({ status: "error", message: "Unauthorized" }, { status: 401 });
    }

    const data = await fetchSheetData(token, "Plans!A1:Z");
    return NextResponse.json({ status: "success", data });
  } catch (error: unknown) {
    const err = error as Error;
    console.error("API error fetching plans:", err);
    return NextResponse.json(
      { status: "error", message: err.message || "Failed to fetch plans" },
      { status: 500 }
    );
  }
}
