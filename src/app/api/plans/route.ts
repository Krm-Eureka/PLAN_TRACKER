import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { appendSheetRow, fetchSheetData } from "@/lib/googleSheets";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const token = (session as any)?.accessToken;
    
    if (!token) {
      return NextResponse.json({ status: "error", message: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { start_date, location, duration_days, project_code } = body;

    if (!start_date || !location || !duration_days) {
      return NextResponse.json({ status: "error", message: "Missing required fields" }, { status: 400 });
    }

    // Get current user details from session
    const email = session.user?.email || "Unknown";
    const name = session.user?.name || "Unknown User";
    
    // We can use email prefix as emp_id if we don't have the real emp_id in session
    const emp_id = email.split('@')[0];

    // Data format: [emp_id, name, start_date, location, duration_days, project_code]
    const rowData = [
      emp_id,
      name,
      start_date,
      location,
      duration_days,
      project_code || ""
    ];

    await appendSheetRow(token, "Plans!A:F", rowData);

    return NextResponse.json({ status: "success", message: "Plan saved successfully" });
  } catch (error: any) {
    console.error("API error appending plan:", error);
    return NextResponse.json(
      { status: "error", message: error.message || "Failed to save plan" },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const token = (session as any)?.accessToken;
    
    if (!token) {
      return NextResponse.json({ status: "error", message: "Unauthorized" }, { status: 401 });
    }

    const data = await fetchSheetData(token, "Plans!A1:Z");
    return NextResponse.json({ status: "success", data });
  } catch (error: any) {
    console.error("API error fetching plans:", error);
    return NextResponse.json(
      { status: "error", message: error.message || "Failed to fetch plans" },
      { status: 500 }
    );
  }
}
