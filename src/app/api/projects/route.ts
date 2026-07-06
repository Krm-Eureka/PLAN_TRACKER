import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { appendSheetRow, fetchSheetData } from "@/lib/googleSheets";
import { getSessionContext, filterProjectsByDepartment } from "@/lib/permissions";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const token = (session as { accessToken?: string })?.accessToken;
    if (!token) return NextResponse.json({ status: "error", message: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { project_code, project_name, client_name, manager_id, start_date, end_date, status, priority, department } = body;

    if (!project_code || !project_name) {
      return NextResponse.json({ status: "error", message: "Missing required fields" }, { status: 400 });
    }

    const id = crypto.randomUUID();

    // Data: [id, project_code, project_name, client_name, manager_id, start_date, end_date, status, priority, department]
    const rowData = [
      id, project_code, project_name, client_name || "",
      manager_id || "", start_date || "", end_date || "",
      status || "Planning", priority || "Medium",
      department || ""
    ];

    await appendSheetRow(token, "Projects!A:J", rowData);

    // Trigger WebSocket broadcast
    try {
      fetch('http://localhost:3001/emit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event: 'data-updated', data: { type: 'projects' } })
      }).catch(e => console.error("Broadcast error:", e));
    } catch (e) {
      // ignore
    }

    return NextResponse.json({ status: "success", message: "Project created successfully" });
  } catch (error: unknown) {
    const err = error as Error;
    console.error("API error appending project:", err);
    return NextResponse.json({ status: "error", message: err.message || "Failed to create project" }, { status: 500 });
  }
}

export async function GET() {
  try {
    const ctx = await getSessionContext();
    if (!ctx) return NextResponse.json({ status: "error", message: "Unauthorized" }, { status: 401 });

    const data = await fetchSheetData(ctx.token, "Projects!A1:Z");
    const filtered = await filterProjectsByDepartment(ctx, data);

    return NextResponse.json({ status: "success", data: filtered });
  } catch (error: unknown) {
    const err = error as Error;
    console.error("API error fetching projects:", err);
    return NextResponse.json({ status: "error", message: err.message || "Failed to fetch projects" }, { status: 500 });
  }
}
