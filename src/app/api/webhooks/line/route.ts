import { NextRequest, NextResponse } from "next/server";
import { v7 as uuidv7 } from "uuid";
import { prisma } from "@/lib/prisma";
import { filterProjectsByDepartment, type SessionContext } from "@/lib/permissions";
import { updateTaskStatusCore } from "@/lib/taskStatusService";
import { createProjectIssue, updateProjectIssueStatus } from "@/lib/issueService";
import { isDoneStatus, isCancelStatus } from "@/constants/status";
import {
  verifyLineSignature,
  parseLinkCode,
  parseProjectIssueInput,
  parsePostbackData,
  buildLineSessionContext,
  buildDefaultQuickReply,
  buildHelpReply,
  buildProjectQuickReply,
  buildMyTasksCarousel,
  buildIssueCreatedReply,
  replyLineMessage,
  getLineUserProfile,
  type LineWebhookEvent,
} from "@/lib/line";

const PENDING_PROJECT_TTL_MS = 10 * 60 * 1000;

async function getVisibleActiveProjects(ctx: SessionContext) {
  const allProjects = await prisma.project.findMany({
    select: {
      id: true,
      project_code: true,
      project_name: true,
      manager_id: true,
      department: true,
      status: true,
    },
    orderBy: { updated_at: "desc" },
  });

  const visible = await filterProjectsByDepartment(
    ctx,
    allProjects as unknown as Record<string, unknown>[]
  );

  return visible
    .filter((p) => {
      const s = String(p.status || "");
      return !isDoneStatus(s) && !isCancelStatus(s);
    })
    .map((p) => ({
      id: String(p.id),
      project_code: String(p.project_code || ""),
      project_name: String(p.project_name || ""),
    }));
}

async function handleLinkCode(
  lineUserId: string,
  code: string,
  replyToken?: string
) {
  const tokenRecord = await prisma.lineLinkToken.findUnique({
    where: { token: code },
    include: { user: true },
  });

  if (!tokenRecord || tokenRecord.used_at || tokenRecord.expires_at < new Date()) {
    await replyLineMessage(replyToken, [
      {
        type: "text",
        text: "รหัสเชื่อมต่อไม่ถูกต้องหรือหมดอายุแล้ว กรุณากดสร้างรหัสใหม่ที่หน้า Settings บนเว็บครับ",
      },
    ]);
    return;
  }

  const profile = await getLineUserProfile(lineUserId);

  await prisma.$transaction([
    // Ensure line_user_id is detached from any previous user if re-binding
    prisma.lineAccount.deleteMany({
      where: {
        OR: [{ line_user_id: lineUserId }, { user_id: tokenRecord.user_id }],
      },
    }),
    prisma.lineAccount.create({
      data: {
        id: uuidv7(),
        user_id: tokenRecord.user_id,
        line_user_id: lineUserId,
        display_name: profile.displayName || null,
        linked_at: new Date(),
      },
    }),
    prisma.lineLinkToken.update({
      where: { id: tokenRecord.id },
      data: { used_at: new Date() },
    }),
  ]);

  const userName =
    tokenRecord.user.name_th || tokenRecord.user.name_en || tokenRecord.user.email;

  await replyLineMessage(replyToken, [
    {
      type: "text",
      text: `เชื่อมต่อบัญชีสำเร็จแล้วครับ (${userName})\nสามารถกด 'งานของฉัน' หรือพิมพ์ 'รหัสโปรเจกต์ รายละเอียดปัญหา' เพื่อแจ้งปัญหาได้ทันที`,
      quickReply: buildDefaultQuickReply(),
    },
  ]);
}

async function handleMyTasks(ctx: SessionContext, replyToken?: string) {
  const tasks = await prisma.task.findMany({
    where: {
      assignee_id: { contains: ctx.id },
    },
    include: {
      project: {
        select: { project_code: true, project_name: true },
      },
    },
    orderBy: [{ due_date: "asc" }, { created_at: "desc" }],
  });

  const activeTasks = tasks.filter((t) => {
    const ids = (t.assignee_id || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    return (
      ids.includes(ctx.id) &&
      !isDoneStatus(t.status) &&
      !isCancelStatus(t.status)
    );
  });

  await replyLineMessage(replyToken, [buildMyTasksCarousel(activeTasks)]);
}

async function handleStartIssue(ctx: SessionContext, replyToken?: string) {
  const projects = await getVisibleActiveProjects(ctx);
  await replyLineMessage(replyToken, [buildProjectQuickReply(projects)]);
}

async function handleLineEvent(event: LineWebhookEvent) {
  const lineUserId = event.source?.userId;
  if (!lineUserId) return;
  if (event.source?.type && event.source.type !== "user") {
    return;
  }

  if (event.type === "follow") {
    await replyLineMessage(event.replyToken, [
      {
        type: "text",
        text: "ยินดีต้อนรับสู่ระบบแจ้งปัญหาและติดตามงาน!\nกรุณาล็อกอินเว็บ it-tracker ด้วยอีเมลบริษัท → หน้า Settings → กด 'เชื่อมต่อ LINE OA' แล้วส่งรหัส LINK-XXXXXX มาที่แชตนี้เพื่อเริ่มใช้งานครับ",
      },
    ]);
    return;
  }

  // Handle LINK-XXXXXX before checking existing binding
  if (event.type === "message" && event.message?.type === "text") {
    const rawText = event.message.text || "";
    const linkCode = parseLinkCode(rawText);
    if (linkCode) {
      await handleLinkCode(lineUserId, linkCode, event.replyToken);
      return;
    }
  }

  const lineAccount = await prisma.lineAccount.findUnique({
    where: { line_user_id: lineUserId },
    include: { user: true },
  });

  if (!lineAccount?.user) {
    await replyLineMessage(event.replyToken, [
      {
        type: "text",
        text: "บัญชียังไม่ได้เชื่อมต่อกับระบบ\nกรุณาล็อกอินเว็บ it-tracker → หน้า Settings → กด 'เชื่อมต่อ LINE OA' แล้วส่งรหัส LINK-XXXXXX มาที่แชตนี้ครับ",
      },
    ]);
    return;
  }

  const user = lineAccount.user;
  const ctx = buildLineSessionContext(user);

  if (event.type === "postback" && event.postback?.data) {
    const params = parsePostbackData(event.postback.data);
    const action = params.action;

    if (action === "my_tasks") {
      await handleMyTasks(ctx, event.replyToken);
      return;
    }

    if (action === "start_issue") {
      await handleStartIssue(ctx, event.replyToken);
      return;
    }

    if (action === "pick_issue_project" && params.projectId) {
      const visibleProjects = await getVisibleActiveProjects(ctx);
      const picked = visibleProjects.find((p) => p.id === params.projectId);
      if (!picked) {
        await replyLineMessage(event.replyToken, [
          {
            type: "text",
            text: "ไม่พบโปรเจกต์หรือคุณไม่มีสิทธิ์เข้าถึงโปรเจกต์นี้ครับ",
          },
        ]);
        return;
      }

      await prisma.lineAccount.update({
        where: { id: lineAccount.id },
        data: {
          pending_project_id: picked.id,
          pending_expires_at: new Date(Date.now() + PENDING_PROJECT_TTL_MS),
        },
      });

      await replyLineMessage(event.replyToken, [
        {
          type: "text",
          text: `เลือกโปรเจกต์ ${picked.project_code} (${picked.project_name}) แล้ว\nพิมพ์หรือกดไมโครโฟนพูดรายละเอียดปัญหาส่งมาได้เลยครับ (หรือกด 'ยกเลิก')`,
          quickReply: {
            items: [
              {
                type: "action",
                action: { type: "message", label: "ยกเลิก", text: "ยกเลิก" },
              },
            ],
          },
        },
      ]);
      return;
    }

    if (action === "task_status" && params.taskId && params.status) {
      const result = await updateTaskStatusCore({
        ctx,
        taskId: params.taskId,
        newStatus: params.status,
      });

      if (!result.ok) {
        await replyLineMessage(event.replyToken, [
          {
            type: "text",
            text: `ไม่สามารถอัปเดตสถานะได้: ${result.message}`,
            quickReply: buildDefaultQuickReply(),
          },
        ]);
        return;
      }

      const progressInfo =
        result.projectProgress !== null
          ? `\nความคืบหน้าโปรเจกต์ ${result.projectCode || result.projectName}: ${result.projectProgress}% (${result.projectStatus || "-"})`
          : "";

      await replyLineMessage(event.replyToken, [
        {
          type: "text",
          text: `อัปเดตงาน "${result.taskName}" เป็น ${result.newStatus} (${result.newPercent}%) เรียบร้อยแล้ว${progressInfo}`,
          quickReply: buildDefaultQuickReply(),
        },
      ]);
      return;
    }

    if (action === "issue_status" && params.issueId && params.status) {
      const result = await updateProjectIssueStatus({
        ctx,
        issueIdOrCode: params.issueId,
        newStatus: params.status,
      });

      if (!result.ok) {
        await replyLineMessage(event.replyToken, [
          {
            type: "text",
            text: `ไม่สามารถอัปเดตปัญหาได้: ${result.message}`,
            quickReply: buildDefaultQuickReply(),
          },
        ]);
        return;
      }

      await replyLineMessage(event.replyToken, [
        {
          type: "text",
          text: `อัปเดต ${result.issue.issue_code} (${result.issue.project_code}) เป็น ${result.issue.status} แล้วครับ`,
          quickReply: buildDefaultQuickReply(),
        },
      ]);
      return;
    }
  }

  if (event.type === "message" && event.message?.type === "text") {
    const text = (event.message.text || "").trim();
    const lower = text.toLowerCase();

    if (["ยกเลิก", "cancel", "ออก", "หยุด"].includes(lower)) {
      const hadPending = Boolean(lineAccount.pending_project_id);
      if (hadPending) {
        await prisma.lineAccount.update({
          where: { id: lineAccount.id },
          data: {
            pending_project_id: null,
            pending_expires_at: null,
          },
        });
      }
      const projects = await getVisibleActiveProjects(ctx);
      await replyLineMessage(event.replyToken, [
        {
          type: "text",
          text: hadPending
            ? "ยกเลิกการแจ้งปัญหาแล้วครับ"
            : "ไม่ได้อยู่ในขั้นตอนแจ้งปัญหาครับ เลือกคำสั่งด้านล่างได้เลย",
          quickReply: buildDefaultQuickReply(projects),
        },
      ]);
      return;
    }

    if (["งานของฉัน", "my tasks", "tasks", "task"].includes(lower)) {
      if (lineAccount.pending_project_id) {
        await prisma.lineAccount.update({
          where: { id: lineAccount.id },
          data: { pending_project_id: null, pending_expires_at: null },
        });
      }
      await handleMyTasks(ctx, event.replyToken);
      return;
    }

    if (["แจ้งปัญหา", "report", "issue", "report issue"].includes(lower)) {
      await handleStartIssue(ctx, event.replyToken);
      return;
    }

    if (["ช่วยเหลือ", "help", "เมนู", "menu"].includes(lower)) {
      if (lineAccount.pending_project_id) {
        await prisma.lineAccount.update({
          where: { id: lineAccount.id },
          data: { pending_project_id: null, pending_expires_at: null },
        });
      }
      const projects = await getVisibleActiveProjects(ctx);
      await replyLineMessage(event.replyToken, [buildHelpReply(projects)]);
      return;
    }

    // Check 1: Single-line / voice input starting with a valid visible Project Code
    const visibleProjects = await getVisibleActiveProjects(ctx);
    const parsed = parseProjectIssueInput(text);
    if (parsed) {
      const matchedProject = visibleProjects.find(
        (p) =>
          p.project_code.toLowerCase() === parsed.candidateCode.toLowerCase()
      );
      if (matchedProject) {
        const created = await createProjectIssue({
          ctx,
          projectIdOrCode: matchedProject.id,
          description: parsed.description,
          source: "LINE",
          lineMessageId: event.message.id,
        });

        await prisma.lineAccount.update({
          where: { id: lineAccount.id },
          data: {
            pending_project_id: null,
            pending_expires_at: null,
          },
        });

        if (created.ok) {
          await replyLineMessage(event.replyToken, [
            buildIssueCreatedReply(created.issue),
          ]);
        } else {
          await replyLineMessage(event.replyToken, [
            { type: "text", text: `บันทึกปัญหาไม่สำเร็จ: ${created.message}` },
          ]);
        }
        return;
      }
    }

    // Check 2: User previously picked a project via Quick Reply/Postback
    if (
      lineAccount.pending_project_id &&
      lineAccount.pending_expires_at &&
      lineAccount.pending_expires_at > new Date()
    ) {
      const created = await createProjectIssue({
        ctx,
        projectIdOrCode: lineAccount.pending_project_id,
        description: text,
        source: "LINE",
        lineMessageId: event.message.id,
      });

      await prisma.lineAccount.update({
        where: { id: lineAccount.id },
        data: {
          pending_project_id: null,
          pending_expires_at: null,
        },
      });

      if (created.ok) {
        await replyLineMessage(event.replyToken, [
          buildIssueCreatedReply(created.issue),
        ]);
      } else {
        await replyLineMessage(event.replyToken, [
          { type: "text", text: `บันทึกปัญหาไม่สำเร็จ: ${created.message}` },
        ]);
      }
      return;
    }

    // Fallback: Show help & project Quick Reply buttons
    await replyLineMessage(event.replyToken, [buildHelpReply(visibleProjects)]);
  }
}

export async function POST(req: NextRequest) {
  const channelSecret = process.env.LINE_CHANNEL_SECRET;
  if (!channelSecret) {
    return NextResponse.json(
      { status: "error", message: "LINE_CHANNEL_SECRET is not configured" },
      { status: 503 }
    );
  }

  const rawBody = await req.text();
  if (rawBody.length > 100_000) {
    return NextResponse.json(
      { status: "error", message: "Payload too large" },
      { status: 413 }
    );
  }
  const signature = req.headers.get("x-line-signature");

  if (!verifyLineSignature(rawBody, signature, channelSecret)) {
    return NextResponse.json(
      { status: "error", message: "Invalid signature" },
      { status: 401 }
    );
  }

  try {
    const payload = JSON.parse(rawBody) as { events?: LineWebhookEvent[] };
    const events = Array.isArray(payload.events) ? payload.events : [];

    for (const event of events) {
      await handleLineEvent(event);
    }

    return NextResponse.json({ status: "ok" });
  } catch (error) {
    console.error("POST /api/webhooks/line error:", error);
    return NextResponse.json(
      { status: "error", message: "Invalid webhook payload" },
      { status: 400 }
    );
  }
}
