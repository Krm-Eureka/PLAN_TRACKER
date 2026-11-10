import { safeErrorMessage } from "@/lib/apiError";
import { NextRequest, NextResponse } from "next/server";
import { getSessionContext, canViewTask } from "@/lib/permissions";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";

// GET comments for a task
export async function GET(
  req: NextRequest,
  { params }: { params: any }
) {
  try {
    const session = await getSessionContext();
    if (!session || !session.id) {
      return NextResponse.json({ status: "error", message: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    if (!(await canViewTask(session, id))) {
      return NextResponse.json({ status: "error", message: "Task not found" }, { status: 404 });
    }

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
    return NextResponse.json({ status: "error", message: safeErrorMessage(error) }, { status: 500 });
  }
}

// POST a new comment
export async function POST(
  req: NextRequest,
  { params }: { params: any }
) {
  try {
    const session = await getSessionContext();
    const user_id = session?.id;
    if (!user_id) {
      return NextResponse.json({ status: "error", message: "Unauthorized" }, { status: 401 });
    }

    const { id: task_id } = await params;
    const body = await req.json();
    const { content, mentions } = body;

    if (!content || typeof content !== "string") {
      return NextResponse.json({ status: "error", message: "Content is required" }, { status: 400 });
    }
    if (content.length > 5000) {
      return NextResponse.json({ status: "error", message: "Comment too long (max 5000 characters)" }, { status: 400 });
    }
    if (!session || !(await canViewTask(session, task_id))) {
      return NextResponse.json({ status: "error", message: "Task not found" }, { status: 404 });
    }

    // mention ได้เฉพาะผู้ใช้ที่มีอยู่จริง ไม่เกิน 20 คน
    const requestedMentions: string[] = Array.isArray(mentions)
      ? Array.from(new Set(mentions.map((m: unknown) => String(m)).filter(Boolean))).slice(0, 20)
      : [];
    const validMentionIds = requestedMentions.length
      ? (await prisma.user.findMany({ where: { id: { in: requestedMentions } }, select: { id: true } })).map(u => u.id)
      : [];

    const comment = await prisma.taskComment.create({
      data: {
        task_id,
        user_id,
        content,
        mentions: validMentionIds
      },
      include: {
        user: {
          select: { name_th: true, name_en: true, email: true, color: true }
        }
      }
    });

    // Handle mentions (optional integration for Phase 1 notifications)
    {
      for (const mentionId of validMentionIds) {
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
    return NextResponse.json({ status: "error", message: safeErrorMessage(error) }, { status: 500 });
  }
}
