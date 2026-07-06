import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ status: "error", message: "Unauthorized" }, { status: 401 });
    }

    const user_id = (session as { id?: string })?.id || "";
    if (!user_id) {
      return NextResponse.json({ status: "error", message: "User ID not found in session" }, { status: 401 });
    }
    
    // params is a promise in Next.js 15+ App router when used asynchronously, wait for it
    const resolvedParams = await params;
    const plan_id = resolvedParams.id;

    const scriptUrl = process.env.NEXT_PUBLIC_APPS_SCRIPT_URL;
    if (!scriptUrl) {
      return NextResponse.json({ status: "error", message: "Apps Script URL not configured" }, { status: 500 });
    }

    const response = await fetch(scriptUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action: "deletePlan",
        payload: {
          plan_id,
          user_id
        }
      }),
    });

    const result = await response.json();
    if (result.status === "success") {
      return NextResponse.json(result);
    } else {
      return NextResponse.json(result, { status: 400 });
    }
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
    if (!session) {
      return NextResponse.json({ status: "error", message: "Unauthorized" }, { status: 401 });
    }

    const user_id = (session as { id?: string })?.id || "";
    if (!user_id) {
      return NextResponse.json({ status: "error", message: "User ID not found in session" }, { status: 401 });
    }

    const resolvedParams = await params;
    const plan_id = resolvedParams.id;
    const body = await req.json();

    const scriptUrl = process.env.NEXT_PUBLIC_APPS_SCRIPT_URL;
    if (!scriptUrl) {
      return NextResponse.json({ status: "error", message: "Apps Script URL not configured" }, { status: 500 });
    }

    const response = await fetch(scriptUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action: "updatePlan",
        payload: {
          plan_id,
          user_id,
          ...body
        }
      }),
    });

    const result = await response.json();
    if (result.status === "success") {
      return NextResponse.json(result);
    } else {
      return NextResponse.json(result, { status: 400 });
    }
  } catch (error: unknown) {
    const err = error as Error;
    console.error("API error updating plan:", err);
    return NextResponse.json(
      { status: "error", message: err.message || "Failed to update plan" },
      { status: 500 }
    );
  }
}
