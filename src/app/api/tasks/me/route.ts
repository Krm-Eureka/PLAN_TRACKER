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

    // Fetch tasks and users in parallel
    const [rows, users] = await Promise.all([
      fetchSheetData(token, "Tasks!A:Z"),
      fetchSheetData(token, "Users!A:Z"),
    ]);

    // Build UUID -> name map
    const idToName: Record<string, string> = {};
    users.forEach((u) => {
      const uid = u.id || "";
      if (uid) idToName[uid] = u.name_th || u.name_en || u.email || uid;
    });

    // Filter tasks belonging to this user + enrich with name
    const myTasks = rows
      .filter((t: Record<string, string>) => {
        const assigneeId   = (t.assignee_id || "").trim();
        const assigneeName = (t.assignee_name || t.assignee || "").toLowerCase();
        
        const safeMyUserId = myUserId.trim();
        const emailPrefix = myEmail ? myEmail.split("@")[0].toLowerCase() : "";

        if (safeMyUserId && assigneeId === safeMyUserId) return true;
        // Check if name contains email prefix (e.g. witsarut.s) or if assigneeName contains the user's name (which might be in English or Thai)
        if (emailPrefix && assigneeName.includes(emailPrefix)) return true;
        
        // Also check if the task name or assignee id loosely matches the email prefix just in case
        if (emailPrefix && assigneeId.toLowerCase().includes(emailPrefix)) return true;

        return false;
      })
      .map((t) => ({
        ...t,
        assignee_name: t.assignee_name || idToName[t.assignee_id || ""] || t.assignee_id || "",
      }));

    console.log("[DEBUG /api/tasks/me] myUserId:", myUserId, "myEmail:", myEmail);
    console.log("[DEBUG /api/tasks/me] Total Tasks:", rows.length, "My Tasks Count:", myTasks.length);

    return NextResponse.json({ status: "success", tasks: myTasks });
  } catch (error: unknown) {
    const err = error as Error;
    return NextResponse.json(
      { status: "error", message: err.message || "Failed to fetch tasks" },
      { status: 500 }
    );
  }
}
