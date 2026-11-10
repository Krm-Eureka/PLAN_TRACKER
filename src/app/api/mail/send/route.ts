import { safeErrorMessage } from "@/lib/apiError";
import { NextRequest, NextResponse } from "next/server";
import { getSessionContext } from "@/lib/permissions";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { sendCleanReply } from "@/lib/googleMail";
import { parseRecipients } from "@/utils/recipients";

const MAX_RECIPIENTS = 30;
const MAX_HTML_CHARS = 500_000;
const MAX_PDF_BASE64_CHARS = 14_000_000; // ~10 MB (Gmail จำกัด 25 MB ต่อฉบับ)
const EMAIL_RE = /^[^\s@<>,;"]+@[^\s@<>,;"]+\.[^\s@<>,;"]+$/;

/**
 * ตรวจผู้รับ: รูปแบบอีเมลต้องถูกต้อง, ไม่เกิน MAX_RECIPIENTS
 * ถ้าตั้ง MAIL_ALLOWED_DOMAINS (คั่นด้วย comma) จะส่งได้เฉพาะโดเมนเหล่านั้น
 */
function validateRecipients(to: unknown, cc: unknown): string | null {
  // ใช้ parser เดียวกับหน้าเว็บ — รองรับชื่อที่มี comma ในเครื่องหมายคำพูด เช่น "Doe, John" <john@x.com>
  const raw = [to, cc].filter(Boolean).map(String).join(", ");
  const list = parseRecipients(raw).map((r) => r.email.toLowerCase());

  // ส่วนที่ parser อ่านไม่ออก (ไม่มีรูปแบบอีเมล) = ผู้รับไม่ถูกต้อง
  const leftover = raw
    .replace(/(?:"[^"]*"|[^,;<>\n"]*?)\s*<[^>]+>|[^\s,;<>"]+@[^\s,;<>"]+/g, "")
    .replace(/[\s,;]/g, "");
  if (leftover) return `Invalid recipient: ${leftover.slice(0, 60)}`;

  if (list.length === 0) return "No recipients";
  if (list.length > MAX_RECIPIENTS) return `Too many recipients (max ${MAX_RECIPIENTS})`;

  const bad = list.find((e) => !EMAIL_RE.test(e));
  if (bad) return `Invalid email address: ${bad}`;

  const allowed = (process.env.MAIL_ALLOWED_DOMAINS || "")
    .split(",")
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);
  if (allowed.length > 0) {
    const outside = list.find((e) => !allowed.includes(e.split("@")[1]));
    if (outside) return `Recipient domain not allowed: ${outside}`;
  }
  return null;
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSessionContext();
    const token = session?.token;
    
    if (!token) {
      return NextResponse.json({ status: "error", message: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { to, cc, subject, htmlBody, threadId, inReplyTo, references, pdfBase64, pdfFilename } = body;

    if (!to || !subject || !htmlBody) {
      return NextResponse.json({ status: "error", message: "Missing required fields (to, subject, htmlBody)" }, { status: 400 });
    }

    const recipientError = validateRecipients(to, cc);
    if (recipientError) {
      return NextResponse.json({ status: "error", message: recipientError }, { status: 400 });
    }
    if (/[\r\n]/.test(String(subject)) || String(subject).length > 300) {
      return NextResponse.json({ status: "error", message: "Invalid subject" }, { status: 400 });
    }
    if (String(htmlBody).length > MAX_HTML_CHARS) {
      return NextResponse.json({ status: "error", message: "Email body too large" }, { status: 413 });
    }
    if (pdfBase64 && String(pdfBase64).length > MAX_PDF_BASE64_CHARS) {
      return NextResponse.json({ status: "error", message: "Attachment too large" }, { status: 413 });
    }

    const result = await sendCleanReply(token, {
      to,
      cc,
      subject,
      htmlBody,
      threadId,
      inReplyTo,
      references,
      pdfBase64,
      pdfFilename
    });

    return NextResponse.json({ 
      status: "success", 
      message: "Email sent successfully",
      data: result
    });

  } catch (error: any) {
    console.error("API error sending email:", error);
    return NextResponse.json({ status: "error", message: safeErrorMessage(error, "Failed to send email") }, { status: 500 });
  }
}
