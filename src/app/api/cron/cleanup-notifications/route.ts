import { safeErrorMessage } from "@/lib/apiError";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getDaysAgo } from "@/utils/date";

export async function GET(req: Request) {
  // Vercel Cron ส่ง header "Authorization: Bearer <CRON_SECRET>" มาให้อัตโนมัติ
  // ถ้ายังไม่ได้ตั้ง CRON_SECRET จะปฏิเสธทุก request (fail closed)
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ status: "error", message: "Unauthorized" }, { status: 401 });
  }

  try {
    const sevenDaysAgo = getDaysAgo(7);
    const thirtyDaysAgo = getDaysAgo(30);

    // Delete read notifications older than 7 days
    const readDeleted = await prisma.notification.deleteMany({
      where: {
        is_read: true,
        created_at: { lt: sevenDaysAgo }
      }
    });

    // Delete unread notifications older than 30 days
    const unreadDeleted = await prisma.notification.deleteMany({
      where: {
        is_read: false,
        created_at: { lt: thirtyDaysAgo }
      }
    });

    return NextResponse.json({
      status: "success",
      deleted_read: readDeleted.count,
      deleted_unread: unreadDeleted.count
    });
  } catch (error: unknown) {
    const err = error as Error;
    console.error("Cron Cleanup Error:", err);
    return NextResponse.json({ status: "error", message: safeErrorMessage(err) }, { status: 500 });
  }
}
