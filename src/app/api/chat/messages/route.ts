// @ts-nocheck
// Trigger rebuild
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import axios from "axios";

const CHAT_API = "https://chat.googleapis.com/v1";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const token = (session as { accessToken?: string })?.accessToken;
    if (!token)
      return NextResponse.json(
        { status: "error", message: "Unauthorized" },
        { status: 401 },
      );

    const { searchParams } = new URL(req.url);
    const spaceName = searchParams.get("space");
    if (!spaceName)
      return NextResponse.json(
        { status: "error", message: "Missing space" },
        { status: 400 },
      );

    try {
      const res = await axios.get(`${CHAT_API}/${spaceName}/messages`, {
        params: { pageSize: 50, orderBy: "createTime desc" },
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = res.data;

      // Fetch members to map raw user IDs to names
      const userMap: Record<string, string> = {};
      try {
        const memRes = await axios.get(`${CHAT_API}/${spaceName}/members`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const memData = memRes.data;
        const memberships = memData.memberships || [];
        await Promise.all(memberships.map(async (m: any) => {
          if (m.member?.name) {
            let dName = m.member.displayName;
            if (!dName && m.member.type === "HUMAN") {
              const accountId = m.member.name.replace('users/', '');
              try {
                const peopleRes = await axios.get(`https://people.googleapis.com/v1/people/${accountId}?personFields=names`, {
                  headers: { Authorization: `Bearer ${token}` }
                });
                dName = peopleRes.data.names?.[0]?.displayName;
              } catch (e) {}
            }
            if (dName) {
              userMap[m.member.name] = dName;
            }
          }
        }));
      } catch (err: any) {
        console.error(
          `[DEBUG Chat API] Failed to fetch members for space in messages:`,
          err.response?.data || err.message,
        );
      }

      const messages = (data.messages || []).reverse().map((m: any) => {
        let senderName = m.sender?.displayName;
        // If API returns raw resource name, treat as missing
        if (!senderName || senderName.startsWith("users/")) {
          if (m.sender?.type === "BOT") senderName = "Bot";
          else {
            // Try to look up from space members
            senderName = userMap[m.sender?.name] || "User";
          }
        }
        return {
          name: m.name,
          text: m.text || "",
          sender: senderName,
          senderEmail: m.sender?.name || "",
          createTime: m.createTime || null,
          thread: m.thread?.name || null,
        };
      });

      return NextResponse.json({ status: "success", data: messages });
    } catch (apiError: any) {
      return NextResponse.json(
        {
          status: "error",
          message:
            apiError.response?.data?.error?.message ||
            "Failed to fetch messages",
        },
        { status: apiError.response?.status || 500 },
      );
    }
  } catch (error: unknown) {
    const err = error as Error;
    return NextResponse.json(
      { status: "error", message: err.message },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const token = (session as { accessToken?: string })?.accessToken;
    if (!token)
      return NextResponse.json(
        { status: "error", message: "Unauthorized" },
        { status: 401 },
      );

    const body = await req.json();
    const { spaceName, text } = body;
    if (!spaceName || !text?.trim()) {
      return NextResponse.json(
        { status: "error", message: "Missing spaceName or text" },
        { status: 400 },
      );
    }

    try {
      const res = await axios.post(
        `${CHAT_API}/${spaceName}/messages`,
        { text },
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      const sent = res.data;
      return NextResponse.json({
        status: "success",
        data: { name: sent.name, text: sent.text, createTime: sent.createTime },
      });
    } catch (apiError: any) {
      return NextResponse.json(
        {
          status: "error",
          message:
            apiError.response?.data?.error?.message || "Failed to send message",
        },
        { status: apiError.response?.status || 500 },
      );
    }
  } catch (error: unknown) {
    const err = error as Error;
    return NextResponse.json(
      { status: "error", message: err.message },
      { status: 500 },
    );
  }
}
