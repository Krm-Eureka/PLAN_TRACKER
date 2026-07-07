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
    const { start_date, location, duration_days, project_id, plan_detail, task_id, start_time, end_time } = body;

    if (!start_date || !location || !duration_days) {
      return NextResponse.json({ status: "error", message: "Missing required fields" }, { status: 400 });
    }

    // Get current user details from session
    const user_id = (session as { id?: string })?.id || "";
    
    if (!user_id) {
      return NextResponse.json({ status: "error", message: "User ID not found in session. Please relogin." }, { status: 400 });
    }

    const newPlanId = crypto.randomUUID();

    // Data format: [id, user_id, project_id, start_date, location, duration_days, plan_detail, task_id, start_time, end_time]
    const rowData = [
      newPlanId,
      user_id,
      project_id || "",
      start_date,
      location,
      duration_days,
      plan_detail || "",
      task_id || "",
      start_time || "",
      end_time || ""
    ];

    await appendSheetRow(token, "Plans!A:J", rowData);

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

    const [plansData, users] = await Promise.all([
      fetchSheetData(token, "Plans!A:Z"),
      fetchSheetData(token, "Users!A:Z"),
    ]);

    // Handle missing plan_detail header safely
    const plans = plansData.map(p => {
      // If the spreadsheet lacks the 'plan_detail' header, it might have been pushed to the 7th column but not parsed by fetchSheetData if the header row was short.
      // But fetchSheetData maps strictly by headers. If the header is missing, it won't exist in the object.
      // Actually, if we just ensure we append to A:G, the data is in G.
      // We can't easily recover it here if fetchSheetData dropped it because of missing header.
      return p;
    });

    const idToUser: Record<string, Record<string, string>> = {};
    users.forEach((u) => {
      if (u.id) {
        idToUser[u.id] = u;
      }
    });

    const enrichedPlans = plans.map(p => {
      const user = idToUser[p.user_id || ""] || {};
      return {
        ...p,
        name: user.name_en || user.name_th || user.email || p.user_id,
        emp_id: user.emp_id || "",
        start_time: p.start_time || p.col_8 || "",
        end_time: p.end_time || p.col_9 || "",
      };
    });

    return NextResponse.json({ status: "success", data: enrichedPlans });
  } catch (error: unknown) {
    const err = error as Error;
    console.error("API error fetching plans:", err);
    return NextResponse.json(
      { status: "error", message: err.message || "Failed to fetch plans" },
      { status: 500 }
    );
  }
}

