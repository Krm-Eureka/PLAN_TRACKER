// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { getSessionContext } from "@/lib/permissions";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { api as axios } from '@/lib/axios';
import fs from "fs";

const CHAT_API = "https://chat.googleapis.com/v1";

export async function GET(req: NextRequest) {
  try {
    const session = await getSessionContext();
    const token = session?.token;
    if (!token) return NextResponse.json({ status: "error", message: "Unauthorized" }, { status: 401 });

    try {
      const res = await axios.get(`${CHAT_API}/spaces`, {
        params: { pageSize: 50 },
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = res.data;
      const sessionEmail = (session?.email || "").toLowerCase();
      const sessionName = session?.name_en || session?.name_th || "";

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

                // Try to find "other member" by display name first (fast path)
                const otherByName = memberships.find((m: any) =>
                  m.member?.type === "HUMAN" &&
                  m.member?.displayName &&
                  m.member.displayName.toLowerCase() !== sessionName.toLowerCase() &&
                  m.member.displayName !== ""
                );

                if (otherByName) {
                  displayName = otherByName.member.displayName;
                } else if (memberships.length > 0) {
                  // Resolve via People API to get email for accurate "self" detection
                  const resolvedPeople: Record<string, { name: string; email: string }> = {};
                  await Promise.all(memberships.map(async (m: any) => {
                    if (m.member?.type === "HUMAN" && m.member?.name) {
                      const accountId = m.member.name.replace('users/', '');
                      try {
                        const peopleRes = await axios.get(
                          `https://people.googleapis.com/v1/people/${accountId}?personFields=names,emailAddresses`,
                          { headers: { Authorization: `Bearer ${token}` } }
                        );
                        resolvedPeople[m.member.name] = {
                          name: peopleRes.data.names?.[0]?.displayName || "Unknown",
                          email: (peopleRes.data.emailAddresses?.[0]?.value || "").toLowerCase(),
                        };
                      } catch (e: any) {
                        console.error(`[Chat API] People API failed for ${accountId}:`, e.response?.data || e.message);
                        resolvedPeople[m.member.name] = { name: "Unknown", email: "" };
                      }
                    }
                  }));

                  // Find a human whose email ≠ current user's email
                  const otherHuman = memberships.find((m: any) =>
                    m.member?.type === "HUMAN" &&
                    resolvedPeople[m.member.name] &&
                    resolvedPeople[m.member.name].email !== sessionEmail &&
                    resolvedPeople[m.member.name].email !== ""
                  );

                  if (otherHuman) {
                    displayName = resolvedPeople[otherHuman.member.name].name;
                  } else {
                    // Self-DM (Note to self) or bot
                    const bot = memberships.find((m: any) => m.member?.type === "BOT");
                    if (bot) {
                      displayName = "Bot";
                    } else {
                      // This is a note-to-self DM — label clearly to avoid duplicates
                      displayName = sessionName ? `${sessionName} (ตัวเอง)` : "Note to Self";
                    }
                  }
                }
              } catch (err: any) {
                console.error(`[Chat API] Failed to fetch members for ${s.name}:`, err.response?.data || err.message);
              }
              if (!displayName) displayName = "Direct Message";
            } else {
              displayName = s.displayName || "Unnamed Space";
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

      // Deduplicate by space name (prevent duplicates from API pagination overlap)
      const seen = new Set<string>();
      const uniqueSpaces = spaces.filter(sp => {
        if (seen.has(sp.name)) return false;
        seen.add(sp.name);
        return true;
      });

      return NextResponse.json({ status: "success", data: uniqueSpaces });

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
