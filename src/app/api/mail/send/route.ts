// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { sendCleanReply } from "@/lib/googleMail";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const token = (session as { accessToken?: string })?.accessToken;
    
    if (!token) {
      return NextResponse.json({ status: "error", message: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { to, cc, subject, htmlBody, threadId, inReplyTo, references, pdfBase64, pdfFilename } = body;

    if (!to || !subject || !htmlBody) {
      return NextResponse.json({ status: "error", message: "Missing required fields (to, subject, htmlBody)" }, { status: 400 });
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
    return NextResponse.json({ status: "error", message: error.message || "Failed to send email" }, { status: 500 });
  }
}
