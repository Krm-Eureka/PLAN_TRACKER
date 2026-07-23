import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";

// GET comments for a task
export async function GET(
  req: NextRequest,
  { params }: { params: any }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !(session as any).id) {
      return NextResponse.json({ status: "error", message: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const comments = await prisma.taskComment.findMany({
      where: { task_id: id },
      include: {
        user: {
          select: { name_th: true, name_en: true, email: true, color: true }
        }
      },
      orderBy: { created_at: 'asc' }
    });

    return NextResponse.json({ status: "success", data: comments });
  } catch (error: any) {
    return NextResponse.json({ status: "error", message: error.message }, { status: 500 });
  }
}

// POST a new comment
export async function POST(
  req: NextRequest,
  { params }: { params: any }
) {
  try {
    const session = await getServerSession(authOptions);
    const user_id = (session as any)?.id;
    if (!user_id) {
      return NextResponse.json({ status: "error", message: "Unauthorized" }, { status: 401 });
    }

    const { id: task_id } = await params;
    const body = await req.json();
    const { content, mentions } = body;

    if (!content) {
      return NextResponse.json({ status: "error", message: "Content is required" }, { status: 400 });
    }

    const comment = await prisma.taskComment.create({
      data: {
        task_id,
        user_id,
        content,
        mentions: mentions || []
      },
      include: {
        user: {
          select: { name_th: true, name_en: true, email: true, color: true }
        }
      }
    });

    // Handle mentions (optional integration for Phase 1 notifications)
    if (mentions && Array.isArray(mentions)) {
      for (const mentionId of mentions) {
        if (mentionId === user_id) continue;
        await prisma.notification.create({
          data: {
            id: crypto.randomUUID(),
            user_id: mentionId,
            title: `มีการพูดถึงคุณใน Task`,
            message: content.length > 50 ? content.substring(0, 50) + "..." : content,
            type: "mention",
            related_task_id: task_id,
            is_read: false
          }
        });
      }
    }

    return NextResponse.json({ status: "success", data: comment });
  } catch (error: any) {
    return NextResponse.json({ status: "error", message: error.message }, { status: 500 });
  }
}
