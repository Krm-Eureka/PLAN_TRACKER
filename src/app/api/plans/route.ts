// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { v7 as uuidv7 } from "uuid";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const user_id = (session as { id?: string })?.id || "";

    if (!user_id) {
      return NextResponse.json({ status: "error", message: "User ID not found in session. Please relogin." }, { status: 401 });
    }

    const body = await req.json();
    const { start_date, location, duration_days, project_id, plan_detail, task_id, start_time, end_time, companions } = body;

    if (!start_date || !location || !duration_days) {
      return NextResponse.json({ status: "error", message: "Missing required fields" }, { status: 400 });
    }

    const newPlanId = uuidv7();

    await prisma.plan.create({
      data: {
        id: newPlanId,
        user: user_id ? { connect: { id: user_id } } : undefined,
        project: project_id ? { connect: { id: project_id } } : undefined,
        start_date,
        location,
        duration_days,
        plan_detail: plan_detail || "",
        task: task_id ? { connect: { id: task_id } } : undefined,
        start_time: start_time || "",
        end_time: end_time || "",
        companions: companions || ""
      }
    });

    // If there are companions, send them a notification
    if (companions) {
      const sessionUser = (session as { user?: { name?: string } })?.user?.name || "Someone";
      const compIds = companions.split(",").map((id: string) => id.trim()).filter(Boolean);
      
      const notificationsToCreate = compIds
        .filter((cid: string) => cid !== user_id) // Don't notify self
        .map((cid: string) => ({
          id: uuidv7(),
          user_id: cid,  // createMany uses UncheckedCreateInput (raw IDs only)
          title: "Added to a Plan",
          message: `${sessionUser} has added you to their plan: ${location}`,
          link: "/calendar",
          is_read: false
        }));

      if (notificationsToCreate.length > 0) {
        await prisma.notification.createMany({
          data: notificationsToCreate
        });
      }
    }

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

import { getMonthPrefixFilter } from "@/utils/date";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const user_id = (session as { id?: string })?.id || "";

    if (!user_id) {
      return NextResponse.json({ status: "error", message: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const yearStr = searchParams.get("year");
    const monthStr = searchParams.get("month");

    let whereClause: any = {};
    if (yearStr && monthStr) {
      const year = parseInt(yearStr, 10);
      const month = parseInt(monthStr, 10); // 1-12
      if (!isNaN(year) && !isNaN(month)) {
        const prefixes = getMonthPrefixFilter(year, month);
        whereClause = {
          OR: prefixes.map(p => ({ start_date: { startsWith: p } }))
        };
      }
    }

    // Use Prisma to fetch plans and users
    const plans = await prisma.plan.findMany({
      where: whereClause
    });
    const users = await prisma.user.findMany({
      select: {
        id: true,
        emp_id: true,
        name_en: true,
        name_th: true,
        email: true
      }
    });

    const idToUser: Record<string, typeof users[0]> = {};
    users.forEach((u) => {
      if (u.id) {
        idToUser[String(u.id).trim().toLowerCase()] = u;
      }
    });

    const enrichedPlans = plans.map(p => {
      const cleanUserId = String(p.user_id || "").trim().toLowerCase();
      const user = idToUser[cleanUserId] || {};
      return {
        ...p,
        name: user.name_en || user.name_th || user.email || p.user_id,
        emp_id: user.emp_id || "",
        start_time: p.start_time || "",
        end_time: p.end_time || "",
        companions: p.companions || "",
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
