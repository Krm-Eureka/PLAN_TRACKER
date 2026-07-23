import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getDaysAgo } from "@/utils/date";

export async function GET(req: Request) {
  try {
    // Optional: Add authorization header check to ensure only cron can run this
    // const authHeader = req.headers.get('authorization');
    // if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    //   return new NextResponse('Unauthorized', { status: 401 });
    // }

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
    return NextResponse.json({ status: "error", message: err.message }, { status: 500 });
  }
}
