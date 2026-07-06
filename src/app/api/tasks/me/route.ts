import { NextResponse } from "next/server";
import { fetchSheetData } from "@/lib/googleSheets";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const token = (session as { accessToken?: string })?.accessToken;
    if (!token) return NextResponse.json({ status: "error", message: "Unauthorized" }, { status: 401 });

    const myUserId = (session as { id?: string })?.id || "";
    const myEmail  = session?.user?.email?.toLowerCase() || "";

    // Fetch tasks, users, and projects in parallel
    const [rows, users, projects] = await Promise.all([
      fetchSheetData(token, "Tasks!A:Z"),
      fetchSheetData(token, "Users!A:Z"),
      fetchSheetData(token, "Projects!A:Z"),
    ]);

    // Build UUID -> name map
    const idToName: Record<string, string> = {};
    users.forEach((u) => {
      const uid = u.id || "";
      if (uid) idToName[uid] = u.name_en || u.name_th || u.email || uid;
    });

    // Build Project UUID -> formatted project string map
    const projectIdToName: Record<string, string> = {};
    projects.forEach((p) => {
      const pid = p.id || p.project_code || "";
      if (pid) {
        const code = p.project_code && p.project_code !== "NONE" ? p.project_code : "";
        const name = p.project_name || "";
        if (code && name) {
          projectIdToName[pid] = `${code} - ${name}`;
        } else {
          projectIdToName[pid] = name || code || pid;
        }
      }
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
      .map((t) => {
        const pId = t.project_id || t.project_code || "";
        return {
          ...t,
          assignee_name: t.assignee_name || idToName[t.assignee_id || ""] || t.assignee_id || "",
          project_code: projectIdToName[pId] || t.project_code || t.project_id || "", // Ensure project_code has the name for UI
        };
      });

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
