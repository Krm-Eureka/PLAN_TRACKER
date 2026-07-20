import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { fetchSheetData, appendSheetRow, updateSheetRow } from "@/lib/googleSheets";
import { v7 as uuidv7 } from "uuid";

// Fetch notifications for the current user
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const token = (session as { accessToken?: string })?.accessToken;
    const user_id = (session as { id?: string })?.id;

    if (!token || !user_id) {
      return NextResponse.json({ status: "error", message: "Unauthorized" }, { status: 401 });
    }

    const rows = await fetchSheetData(token, "Notifications!A:G");
    
    // Filter by user_id, remove read notifications older than 28h, and sort by created_at descending
    const now = Date.now();
    const TWENTY_EIGHT_HOURS = 28 * 60 * 60 * 1000;

    const notifications = rows
      .filter((n: any) => {
        if (n.user_id !== user_id) return false;
        
        // If it's read, keep it only for 28 hours
        if (String(n.is_read) === "true") {
          const createdAt = new Date(n.created_at).getTime();
          if (!isNaN(createdAt) && (now - createdAt > TWENTY_EIGHT_HOURS)) {
            return false;
          }
        }
        return true;
      })
      .sort((a: any, b: any) => {
        const timeA = new Date(a.created_at).getTime();
        const timeB = new Date(b.created_at).getTime();
        const validA = !isNaN(timeA) ? timeA : 0;
        const validB = !isNaN(timeB) ? timeB : 0;
        return validB - validA;
      });

    return NextResponse.json({ status: "success", data: notifications });
  } catch (error: unknown) {
    const err = error as Error;
    console.error("API error fetching notifications:", err);
    return NextResponse.json(
      { status: "error", message: err.message || "Failed to fetch notifications" },
      { status: 500 }
    );
  }
}

// Mark a notification as read (or all as read)
export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const token = (session as { accessToken?: string })?.accessToken;
    const user_id = (session as { id?: string })?.id;

    if (!token || !user_id) {
      return NextResponse.json({ status: "error", message: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { notification_id, mark_all } = body;

    const rows = await fetchSheetData(token, "Notifications!A:G");

    if (mark_all) {
      // Mark all as read for this user
      // Note: updating multiple rows efficiently in Google Sheets requires batchUpdate,
      // but for simplicity, we can just do individual row updates if there aren't many.
      // Or we can just build a batch request, but we'll use a simple loop for now since
      // we don't have a batch update cells helper.
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        if (row.user_id === user_id && String(row.is_read) !== "true") {
          const rowIndex = i + 2;
          await updateSheetRow(token, `Notifications!A${rowIndex}:G${rowIndex}`, [
            row.id, row.user_id, row.title, row.message, row.link, "true", row.created_at
          ]);
        }
      }
    } else if (notification_id) {
      // Mark a specific notification as read
      let rowIndex = -1;
      let foundNotif = null;

      for (let i = 0; i < rows.length; i++) {
        if (rows[i].id === notification_id && rows[i].user_id === user_id) {
          rowIndex = i + 2;
          foundNotif = rows[i];
          break;
        }
      }

      if (rowIndex !== -1 && foundNotif) {
        await updateSheetRow(token, `Notifications!A${rowIndex}:G${rowIndex}`, [
          foundNotif.id, foundNotif.user_id, foundNotif.title, foundNotif.message, foundNotif.link, "true", foundNotif.created_at
        ]);
      }
    }

    return NextResponse.json({ status: "success", message: "Updated notifications" });
  } catch (error: unknown) {
    const err = error as Error;
    console.error("API error updating notifications:", err);
    return NextResponse.json(
      { status: "error", message: err.message || "Failed to update notifications" },
      { status: 500 }
    );
  }
}

// Create a new notification (Internal helper or can be called from client)
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const token = (session as { accessToken?: string })?.accessToken;

    if (!token) {
      return NextResponse.json({ status: "error", message: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { user_id, title, message, link } = body;

    if (!user_id || !title) {
      return NextResponse.json({ status: "error", message: "Missing fields" }, { status: 400 });
    }

    const newId = uuidv7();
    const createdAt = new Date().toISOString();

    await appendSheetRow(token, "Notifications!A:G", [
      newId, user_id, title, message || "", link || "", "false", createdAt
    ]);

    return NextResponse.json({ status: "success", message: "Notification created" });
  } catch (error: unknown) {
    const err = error as Error;
    return NextResponse.json({ status: "error", message: err.message }, { status: 500 });
  }
}
