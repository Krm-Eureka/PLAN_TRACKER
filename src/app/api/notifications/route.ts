import { safeErrorMessage } from "@/lib/apiError";
import { NextRequest, NextResponse } from "next/server";
import { getSessionContext } from "@/lib/permissions";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { v7 as uuidv7 } from "uuid";
import { prisma } from "@/lib/prisma";
import { isInternalPath } from "@/lib/safeLink";

// Fetch notifications for the current user
export async function GET(req: NextRequest) {
  try {
    const session = await getSessionContext();
    const user_id = session?.id;

    if (!user_id) {
      return NextResponse.json({ status: "error", message: "Unauthorized" }, { status: 401 });
    }

    const now = new Date();
    const TWENTY_EIGHT_HOURS = 28 * 60 * 60 * 1000;
    const cutoffDate = new Date(now.getTime() - TWENTY_EIGHT_HOURS);

    // Fetch notifications:
    // - Unread notifications for this user
    // - OR read notifications for this user created within the last 28 hours
    const notifications = await prisma.notification.findMany({
      where: {
        user_id,
        OR: [
          { is_read: false },
          { 
            is_read: true,
            created_at: { gte: cutoffDate }
          }
        ]
      },
      orderBy: { created_at: 'desc' }
    });

    return NextResponse.json({ status: "success", data: notifications });
  } catch (error: unknown) {
    const err = error as Error;
    console.error("API error fetching notifications:", err);
    return NextResponse.json(
      { status: "error", message: safeErrorMessage(err, "Failed to fetch notifications") },
      { status: 500 }
    );
  }
}

// Mark a notification as read (or all as read)
export async function PUT(req: NextRequest) {
  try {
    const session = await getSessionContext();
    const user_id = session?.id;

    if (!user_id) {
      return NextResponse.json({ status: "error", message: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { notification_id, mark_all } = body;

    if (mark_all) {
      // Mark all as read for this user
      await prisma.notification.updateMany({
        where: { user_id, is_read: false },
        data: { is_read: true }
      });
    } else if (notification_id) {
      // Mark a specific notification as read
      await prisma.notification.updateMany({
        where: { id: notification_id, user_id },
        data: { is_read: true }
      });
    }

    return NextResponse.json({ status: "success", message: "Updated notifications" });
  } catch (error: unknown) {
    const err = error as Error;
    console.error("API error updating notifications:", err);
    return NextResponse.json(
      { status: "error", message: safeErrorMessage(err, "Failed to update notifications") },
      { status: 500 }
    );
  }
}

// Create a new notification (Internal helper or can be called from client)
export async function POST(req: NextRequest) {
  try {
    const session = await getSessionContext();
    const user_id = session?.id;

    if (!user_id) {
      return NextResponse.json({ status: "error", message: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    // ไม่รับ `actions` จากผู้ใช้: ปุ่ม action จะเรียก API ด้วยสิทธิ์ของผู้รับ
    // ถ้าให้ผู้ใช้กำหนดเองได้ = หลอกให้คนอื่น (เช่น admin) กดลบ/แก้ข้อมูลแทนได้
    const { user_id: target_user_id, title, message, link, related_task_id } = body;

    if (!target_user_id || !title) {
      return NextResponse.json({ status: "error", message: "Missing fields" }, { status: 400 });
    }
    if (String(title).length > 200 || String(message || "").length > 1000) {
      return NextResponse.json({ status: "error", message: "Title or message too long" }, { status: 400 });
    }
    if (link && !isInternalPath(link)) {
      return NextResponse.json({ status: "error", message: "Link must be an internal path (e.g. /projects/123)" }, { status: 400 });
    }

    await prisma.notification.create({
      data: {
        id: uuidv7(),
        user: { connect: { id: String(target_user_id) } },
        title: String(title),
        message: String(message || ""),
        link: link || "",
        type: null,
        related_task_id: related_task_id ? String(related_task_id) : null,
        // actions: ไม่ตั้งค่า (ค่า default ของ DB) — ไม่รับจากผู้ใช้
        is_read: false
      }
    });

    return NextResponse.json({ status: "success", message: "Notification created" });
  } catch (error: unknown) {
    const err = error as Error;
    return NextResponse.json({ status: "error", message: safeErrorMessage(err) }, { status: 500 });
  }
}
