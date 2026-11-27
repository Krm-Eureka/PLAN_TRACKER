import crypto from "crypto";
import { isAdminRole } from "@/lib/roles";
import type { SessionContext } from "@/lib/permissions";

export type LineQuickReplyItem = {
  type: "action";
  action:
    | { type: "message"; label: string; text: string }
    | { type: "postback"; label: string; data: string; displayText?: string };
};

export type LineMessage =
  | {
      type: "text";
      text: string;
      quickReply?: { items: LineQuickReplyItem[] };
    }
  | {
      type: "flex";
      altText: string;
      contents: Record<string, unknown>;
      quickReply?: { items: LineQuickReplyItem[] };
    };

export interface LineWebhookEvent {
  type: string;
  replyToken?: string;
  source?: {
    type?: string;
    userId?: string;
  };
  message?: {
    id?: string;
    type?: string;
    text?: string;
  };
  postback?: {
    data?: string;
  };
}

/**
 * Verifies the X-Line-Signature header (Base64-encoded HMAC-SHA256 of raw request body)
 * using constant-time comparison.
 */
export function verifyLineSignature(
  rawBody: string,
  signatureHeader: string | null,
  channelSecret: string
): boolean {
  if (!signatureHeader || !channelSecret) return false;
  try {
    const expected = crypto
      .createHmac("sha256", channelSecret)
      .update(rawBody, "utf8")
      .digest();
    const provided = Buffer.from(signatureHeader.trim(), "base64");
    if (expected.length !== provided.length) return false;
    return crypto.timingSafeEqual(expected, provided);
  } catch {
    return false;
  }
}

export function parseLinkCode(text: string): string | null {
  const match = text.trim().match(/^LINK-(\d{6})$/i);
  return match ? `LINK-${match[1]}` : null;
}

/**
 * Extracts a leading Project Code + issue description from single-line / voice-keyboard text.
 * Examples:
 * - "26M018 มอเตอร์ดัง" -> { candidateCode: "26M018", description: "มอเตอร์ดัง" }
 * - "26IN001: แก้สิทธิ์" -> { candidateCode: "26IN001", description: "แก้สิทธิ์" }
 */
export function parseProjectIssueInput(
  text: string
): { candidateCode: string; description: string } | null {
  const trimmed = text.trim();
  const match = trimmed.match(/^([A-Za-z0-9][A-Za-z0-9_-]{1,29})\s*[:\-–]?\s+([\s\S]+)$/);
  if (!match) return null;
  const candidateCode = match[1].trim();
  const description = match[2].trim();
  if (!candidateCode || !description) return null;
  return { candidateCode, description };
}

export function parsePostbackData(data: string): Record<string, string> {
  const params = new URLSearchParams(data);
  const result: Record<string, string> = {};
  params.forEach((value, key) => {
    result[key] = value;
  });
  return result;
}

export function getLineOaBasicId(): string | null {
  const raw = (
    process.env.LINE_OA_BASIC_ID ||
    process.env.NEXT_PUBLIC_LINE_OA_ID ||
    ""
  ).trim();
  if (!raw) return null;
  return raw.startsWith("@") ? raw : `@${raw}`;
}

export function buildLineSessionContext(user: {
  id: string;
  email: string;
  name_en: string;
  name_th: string;
  department_id: string | null;
  division: string | null;
  role_system: string | null;
}): SessionContext {
  return {
    id: user.id,
    token: "",
    email: user.email,
    name_en: user.name_en,
    name_th: user.name_th,
    department: user.department_id || "",
    division: user.division || "",
    role_system: user.role_system || "member",
    isAdmin: isAdminRole(user.role_system),
  };
}

function truncateLabel(text: string, max = 20): string {
  const clean = text.trim();
  return clean.length <= max ? clean : `${clean.slice(0, max - 1)}…`;
}

export function buildDefaultQuickReply(
  projects: Array<{ id: string; project_code: string }> = []
): { items: LineQuickReplyItem[] } {
  const items: LineQuickReplyItem[] = [
    {
      type: "action",
      action: { type: "message", label: "งานของฉัน", text: "งานของฉัน" },
    },
    {
      type: "action",
      action: { type: "message", label: "แจ้งปัญหา", text: "แจ้งปัญหา" },
    },
  ];

  // LINE allows up to 13 Quick Reply items total
  for (const p of projects.slice(0, 11)) {
    if (!p.project_code || p.project_code === "NONE") continue;
    items.push({
      type: "action",
      action: {
        type: "postback",
        label: truncateLabel(p.project_code, 20),
        data: `action=pick_issue_project&projectId=${encodeURIComponent(p.id)}`,
        displayText: `แจ้งปัญหาโปรเจกต์ ${p.project_code}`,
      },
    });
  }

  return { items };
}

export function buildHelpReply(
  projects: Array<{ id: string; project_code: string }> = []
): LineMessage {
  return {
    type: "text",
    text: [
      "คำสั่งที่ใช้งานได้:",
      "1) แจ้งปัญหาทันที: พิมพ์หรือพูดรหัสโปรเจกต์ตามด้วยปัญหา เช่น",
      "   26M018 มอเตอร์แกน X เสียงดัง",
      "2) แจ้งปัญหาแบบเลือกโปรเจกต์: กดปุ่ม 'แจ้งปัญหา' ด้านล่าง",
      "3) ดู/อัปเดตงานของฉัน: กดปุ่ม 'งานของฉัน' ด้านล่าง",
    ].join("\n"),
    quickReply: buildDefaultQuickReply(projects),
  };
}

export function buildProjectQuickReply(
  projects: Array<{ id: string; project_code: string; project_name: string }>
): LineMessage {
  if (projects.length === 0) {
    return {
      type: "text",
      text: "ไม่พบโปรเจกต์ที่เปิดใช้งานในขอบเขตสิทธิ์ของคุณครับ",
    };
  }

  const items: LineQuickReplyItem[] = projects.slice(0, 13).map((p) => ({
    type: "action",
    action: {
      type: "postback",
      label: truncateLabel(p.project_code || p.project_name, 20),
      data: `action=pick_issue_project&projectId=${encodeURIComponent(p.id)}`,
      displayText: `เลือกโปรเจกต์ ${p.project_code || p.project_name}`,
    },
  }));

  return {
    type: "text",
    text: "กรุณาเลือกโปรเจกต์ที่ต้องการแจ้งปัญหา หรือพิมพ์ 'รหัสโปรเจกต์ รายละเอียดปัญหา' ได้เลยครับ",
    quickReply: { items },
  };
}

export function buildMyTasksCarousel(
  tasks: Array<{
    id: string;
    task_name: string;
    status: string;
    due_date: string | null;
    percent_complete: string | null;
    project?: { project_code: string; project_name: string } | null;
  }>
): LineMessage {
  if (tasks.length === 0) {
    return {
      type: "text",
      text: "ตอนนี้คุณไม่มีงานค้างอยู่ครับ",
      quickReply: buildDefaultQuickReply(),
    };
  }

  const statusChoices = ["In Progress", "Review", "Done", "On Hold"];

  const bubbles = tasks.slice(0, 10).map((t) => {
    const projectLabel = t.project
      ? `${t.project.project_code} · ${t.project.project_name}`
      : "No Project";
    const pct = t.percent_complete ? `${t.percent_complete}%` : "0%";
    const currentStatus = t.status || "To Do";

    const actionButtons = statusChoices
      .filter((s) => s.toLowerCase() !== currentStatus.toLowerCase())
      .slice(0, 4)
      .map((targetStatus) => ({
        type: "button",
        style: targetStatus === "Done" ? "primary" : "secondary",
        height: "sm",
        action: {
          type: "postback",
          label: truncateLabel(`เปลี่ยนเป็น ${targetStatus}`, 40),
          data: `action=task_status&taskId=${encodeURIComponent(t.id)}&status=${encodeURIComponent(targetStatus)}`,
          displayText: `อัปเดต "${truncateLabel(t.task_name, 20)}" → ${targetStatus}`,
        },
      }));

    return {
      type: "bubble",
      size: "kilo",
      body: {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        contents: [
          {
            type: "text",
            text: projectLabel,
            size: "xs",
            color: "#059669",
            weight: "bold",
            wrap: true,
          },
          {
            type: "text",
            text: t.task_name,
            size: "md",
            weight: "bold",
            wrap: true,
            maxLines: 2,
          },
          {
            type: "text",
            text: `สถานะ: ${currentStatus} (${pct})`,
            size: "xs",
            color: "#475569",
          },
          {
            type: "text",
            text: `กำหนดส่ง: ${t.due_date || "-"}`,
            size: "xs",
            color: "#64748b",
          },
        ],
      },
      footer: {
        type: "box",
        layout: "vertical",
        spacing: "xs",
        contents: actionButtons,
      },
    };
  });

  return {
    type: "flex",
    altText: `งานของคุณ (${tasks.length} รายการ)`,
    contents: {
      type: "carousel",
      contents: bubbles,
    },
    quickReply: buildDefaultQuickReply(),
  };
}

export function buildIssueCreatedReply(issue: {
  id: string;
  issue_code: string;
  project_code: string;
  project_name: string;
  reporter_name: string;
  description: string;
  status: string;
  created_at: Date;
}): LineMessage {
  const reportedTime = issue.created_at.toLocaleString("th-TH", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

  return {
    type: "flex",
    altText: `บันทึกปัญหา ${issue.issue_code} (${issue.project_code})`,
    contents: {
      type: "bubble",
      size: "kilo",
      body: {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        contents: [
          {
            type: "text",
            text: `บันทึกปัญหาสำเร็จ · ${issue.issue_code}`,
            weight: "bold",
            size: "sm",
            color: "#059669",
          },
          {
            type: "text",
            text: `${issue.project_code} · ${issue.project_name}`,
            weight: "bold",
            size: "md",
            wrap: true,
          },
          {
            type: "text",
            text: issue.description,
            size: "sm",
            wrap: true,
            color: "#1e293b",
          },
          {
            type: "text",
            text: `ผู้แจ้ง: ${issue.reporter_name}\nเวลา: ${reportedTime}\nสถานะ: ${issue.status}`,
            size: "xs",
            color: "#64748b",
            wrap: true,
          },
        ],
      },
      footer: {
        type: "box",
        layout: "horizontal",
        spacing: "sm",
        contents: [
          {
            type: "button",
            style: "secondary",
            height: "sm",
            action: {
              type: "postback",
              label: "กำลังแก้ไข",
              data: `action=issue_status&issueId=${encodeURIComponent(issue.id)}&status=${encodeURIComponent("In Progress")}`,
              displayText: `อัปเดต ${issue.issue_code} → In Progress`,
            },
          },
          {
            type: "button",
            style: "primary",
            height: "sm",
            action: {
              type: "postback",
              label: "แก้ไขแล้ว",
              data: `action=issue_status&issueId=${encodeURIComponent(issue.id)}&status=${encodeURIComponent("Resolved")}`,
              displayText: `ปิด ${issue.issue_code} → Resolved`,
            },
          },
        ],
      },
    },
    quickReply: buildDefaultQuickReply(),
  };
}

export async function replyLineMessage(
  replyToken: string | undefined,
  messages: LineMessage[]
): Promise<void> {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!replyToken || !token || messages.length === 0) return;

  try {
    const res = await fetch("https://api.line.me/v2/bot/message/reply", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        replyToken,
        messages: messages.slice(0, 5),
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error("LINE reply API failed:", res.status, body);
    }
  } catch (error) {
    console.error("LINE reply API error:", error);
  }
}

export async function getLineUserProfile(
  lineUserId: string
): Promise<{ displayName?: string }> {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token || !lineUserId) return {};

  try {
    const res = await fetch(
      `https://api.line.me/v2/bot/profile/${encodeURIComponent(lineUserId)}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    if (!res.ok) return {};
    const data = (await res.json()) as { displayName?: string };
    return { displayName: data.displayName };
  } catch {
    return {};
  }
}
