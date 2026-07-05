import { NextResponse } from "next/server";
import { fetchSheetData } from "@/lib/googleSheets";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const token = (session as { accessToken?: string })?.accessToken;
    if (!token) return NextResponse.json({ status: "error", message: "Unauthorized" }, { status: 401 });

    const myUserId = (session as { id?: string })?.id || "";
    const myEmail  = session?.user?.email?.toLowerCase() || "";

    const rows = await fetchSheetData(token, "Tasks!A:Z");
    // New schema: filter by assignee_id (UUID from Users sheet)
    // Legacy fallback: filter by assignee email
    const myTasks = rows.filter((t: Record<string, unknown>) => {
      const assigneeId = (t.assignee_id as string) || "";
      const assignee   = ((t.assignee as string) || "").toLowerCase();
      if (myUserId && assigneeId === myUserId) return true;
      if (myEmail   && assignee === myEmail)   return true;
      return false;
    });

    return NextResponse.json({ status: "success", tasks: myTasks });
  } catch (error: unknown) {
    const err = error as Error;
    return NextResponse.json(
      { status: "error", message: err.message || "Failed to fetch tasks" },
      { status: 500 }
    );
  }
}

