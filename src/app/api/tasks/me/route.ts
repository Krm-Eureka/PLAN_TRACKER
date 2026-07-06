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

    // Find the current user in the Users sheet to get their exact ID and names
    const myUser = users.find(u => (u.email || "").toLowerCase().trim() === myEmail.trim());
    const realMyUserId = (myUser?.id || myUserId || "").trim();
    const myNameTh = (myUser?.name_th || "").toLowerCase().trim();
    const myNameEn = (myUser?.name_en || "").toLowerCase().trim();
    const emailPrefix = myEmail ? myEmail.split("@")[0].toLowerCase().trim() : "";

    // Filter tasks belonging to this user + enrich with name
    const myTasks = rows
      .filter((t: Record<string, string>) => {
        const assigneeIds   = (t.assignee_id || "").split(",").map(id => id.trim());
        const assigneeNames = (t.assignee_name || t.assignee || "").toLowerCase().split(",").map(n => n.trim());

        // 1. Match by precise ID in the list
        if (realMyUserId && assigneeIds.includes(realMyUserId)) return true;
        
        // 2. Match by Name (Thai or English) in the list
        if (myNameTh && assigneeNames.some(name => name.includes(myNameTh))) return true;
        if (myNameEn && assigneeNames.some(name => name.includes(myNameEn))) return true;
        
        // 3. Fallback to matching Email Prefix in the list
        if (emailPrefix && assigneeNames.some(name => name.includes(emailPrefix))) return true;
        if (emailPrefix && assigneeIds.some(id => id.toLowerCase().includes(emailPrefix))) return true;

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
