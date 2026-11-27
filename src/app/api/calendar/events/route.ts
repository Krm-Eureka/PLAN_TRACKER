import { safeErrorMessage } from "@/lib/apiError";
import { NextRequest, NextResponse } from "next/server";
import axios from "axios";
import { getSessionContext } from "@/lib/permissions";

const CALENDAR_API = "https://www.googleapis.com/calendar/v3";
const GROUP_CALENDAR_ID = process.env.GOOGLE_GROUP_CALENDAR_ID || "";

async function fetchCalendarEvents(
  accessToken: string,
  calendarId: string,
  timeMin: string,
  timeMax: string
) {
  const res = await axios.get(
    `${CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events`,
    {
      params: {
        timeMin,
        timeMax,
        singleEvents: "true",
        orderBy: "startTime",
        maxResults: "100",
      },
      headers: { Authorization: `Bearer ${accessToken}` },
      timeout: 10_000,
      validateStatus: () => true,
    }
  );

  if (res.status < 200 || res.status >= 300) {
    const err = res.data;
    if (res.status !== 404) {
      console.warn(`Calendar fetch failed for ${calendarId}:`, err?.error?.message);
    }
    return [];
  }

  const data = res.data || {};
  return (data.items || []).map((e: any) => ({
    id: e.id,
    summary: e.summary || "(No title)",
    start: e.start?.dateTime || e.start?.date || null,
    end: e.end?.dateTime || e.end?.date || null,
    location: e.location || null,
    hangoutLink: e.hangoutLink || null,
    htmlLink: e.htmlLink || null,
    isAllDay: !!e.start?.date && !e.start?.dateTime,
    source: calendarId === "primary" ? "personal" : "group",
  }));
}

export async function GET(req: NextRequest) {
  try {
    const session = await getSessionContext();
    const token = session?.token;
    if (!token) return NextResponse.json({ status: "error", message: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const year = parseInt(searchParams.get("year") || String(new Date().getFullYear()));
    const month = parseInt(searchParams.get("month") || String(new Date().getMonth() + 1));

    const timeMin = new Date(year, month - 1, 1);
    timeMin.setDate(timeMin.getDate() - 7);
    const timeMax = new Date(year, month, 0);
    timeMax.setDate(timeMax.getDate() + 7);
    timeMax.setHours(23, 59, 59, 999);

    const promises = [fetchCalendarEvents(token, "primary", timeMin.toISOString(), timeMax.toISOString())];
    
    if (GROUP_CALENDAR_ID) {
      promises.push(fetchCalendarEvents(token, GROUP_CALENDAR_ID, timeMin.toISOString(), timeMax.toISOString()));
    }

    const results = await Promise.all(promises);
    const personalEvents = results[0];
    const groupEvents = results[1] || [];

    return NextResponse.json({ status: "success", data: [...personalEvents, ...groupEvents] });
  } catch (error: unknown) {
    const err = error as Error;
    return NextResponse.json({ status: "error", message: safeErrorMessage(err) }, { status: 500 });
  }
}
