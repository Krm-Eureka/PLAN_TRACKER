import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import axios from "axios";
import fs from "fs";

const CHAT_API = "https://chat.googleapis.com/v1";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const token = (session as { accessToken?: string })?.accessToken;
    if (!token) return NextResponse.json({ status: "error", message: "Unauthorized" }, { status: 401 });

    try {
      const res = await axios.get(`${CHAT_API}/spaces`, {
        params: { pageSize: 50 },
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = res.data;
      const sessionName = session?.user?.name || "";

      const spaces = await Promise.all(
        (data.spaces || []).map(async (s: any) => {
          let displayName = s.displayName;
          if (!displayName || displayName.startsWith("spaces/") || displayName.startsWith("users/")) {
            if (s.spaceType === "DIRECT_MESSAGE" || s.type === "DIRECT_MESSAGE") {
              try {
                const memRes = await axios.get(`${CHAT_API}/${s.name}/members`, {
                  headers: { Authorization: `Bearer ${token}` }
                });
                const memData = memRes.data;
                const memberships = memData.memberships || [];
                
                
                const otherMemberWithDisplayName = memberships.find((m: any) => 
                  m.member?.displayName && m.member.displayName !== sessionName
                );
                
                if (otherMemberWithDisplayName) {
                  displayName = otherMemberWithDisplayName.member.displayName;
                } else if (memberships.length > 0) {
                  // Resolve all human names
                  const resolvedNames: Record<string, string> = {};
                  await Promise.all(memberships.map(async (m: any) => {
                    if (m.member?.type === "HUMAN" && m.member?.name) {
                      const accountId = m.member.name.replace('users/', '');
                      try {
                        const peopleRes = await axios.get(`https://people.googleapis.com/v1/people/${accountId}?personFields=names`, {
                          headers: { Authorization: `Bearer ${token}` }
                        });
                        resolvedNames[m.member.name] = peopleRes.data.names?.[0]?.displayName || "Unknown";
                      } catch (e: any) {
                        console.error(`[DEBUG Chat API] People API failed for ${accountId}:`, e.response?.data || e.message);
                        resolvedNames[m.member.name] = "Unknown";
                      }
                    }
                  }));

                  // Find a human that is not the current user
                  const otherHuman = memberships.find((m: any) => 
                    m.member?.type === "HUMAN" && 
                    resolvedNames[m.member.name] && 
                    resolvedNames[m.member.name] !== sessionName
                  );

                  if (otherHuman) {
                    displayName = resolvedNames[otherHuman.member.name];
                  } else {
                    // Check if there is a bot
                    const bot = memberships.find((m: any) => m.member?.type === "BOT");
                    if (bot) {
                      displayName = "Bot";
                    } else {
                      displayName = sessionName || "Direct Message"; // Note to self
                    }
                  }
                }
              } catch (err: any) {
                console.error(`[DEBUG Chat API] Failed to fetch members for ${s.name}:`, err.response?.data || err.message);
              }
              if (!displayName) displayName = "Direct Message";
            } else {
              displayName = "Unnamed Space";
            }
          }
          return {
            name: s.name,
            displayName,
            type: s.spaceType || s.type,
            singleUserBotDm: s.singleUserBotDm || false,
          };
        })
      );

      return NextResponse.json({ status: "success", data: spaces });
    } catch (apiError: any) {
      return NextResponse.json(
        { status: "error", message: apiError.response?.data?.error?.message || "Failed to fetch spaces" },
        { status: apiError.response?.status || 500 }
      );
    }
  } catch (error: unknown) {
    const err = error as Error;
    return NextResponse.json({ status: "error", message: err.message }, { status: 500 });
  }
}
