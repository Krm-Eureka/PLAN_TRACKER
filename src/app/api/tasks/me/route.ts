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
        const assigneeId   = t.assignee_id || "";
        const assigneeName = (t.assignee_name || t.assignee || "").toLowerCase();

        if (myUserId && assigneeId === myUserId) return true;
        if (myEmail  && assigneeName.includes(myEmail.split("@")[0])) return true;
        return false;
      })
      .map((t) => ({
        ...t,
        assignee_name: t.assignee_name || idToName[t.assignee_id || ""] || t.assignee_id || "",
      }));

    return NextResponse.json({ status: "success", tasks: myTasks });
  } catch (error: unknown) {
    const err = error as Error;
    return NextResponse.json(
      { status: "error", message: err.message || "Failed to fetch tasks" },
      { status: 500 }
    );
  }
}
