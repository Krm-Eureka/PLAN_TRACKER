import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { fetchSheetData, batchUpdateSheetValues, getSheetHeaders, getColumnLetter } from "@/lib/googleSheets";
import { v7 as uuidv7 } from "uuid";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const token = (session as { accessToken?: string })?.accessToken;

  if (!session || !token) {
    return NextResponse.json({ status: "error", message: "Not authenticated" }, { status: 401 });
  }

  try {
    const updates: any[] = [];
    
    // Maps
    const projectMap = new Map<string, string>();
    const taskMap = new Map<string, string>();
    const planMap = new Map<string, string>();
    const notifMap = new Map<string, string>();

    // 1. PROJECTS
    const projectsHeaders = await getSheetHeaders(token, "Projects");
    const projIdIdx = projectsHeaders.findIndex(h => h === "id" || h === "project_id"); 
    if (projIdIdx >= 0) {
      const projIdCol = getColumnLetter(projIdIdx);
      const projects = await fetchSheetData(token, "Projects!A:Z");
      projects.forEach(p => {
        if (!p.id && !p.project_id) return;
        const oldId = String(p.id || p.project_id);
        const newId = uuidv7();
        projectMap.set(oldId, newId);
        updates.push({
          range: `Projects!${projIdCol}${p._rowIndex}`,
          values: [[newId]]
        });
      });
    }

    // 2. TASKS
    const tasksHeaders = await getSheetHeaders(token, "Tasks");
    const taskIdIdx = tasksHeaders.findIndex(h => h === "id" || h === "task_id");
    const taskProjIdIdx = tasksHeaders.findIndex(h => h === "project_id");
    const taskParentIdIdx = tasksHeaders.findIndex(h => h === "parent_task_id");
    
    const taskIdCol = taskIdIdx >= 0 ? getColumnLetter(taskIdIdx) : null;
    const taskProjIdCol = taskProjIdIdx >= 0 ? getColumnLetter(taskProjIdIdx) : null;
    const taskParentIdCol = taskParentIdIdx >= 0 ? getColumnLetter(taskParentIdIdx) : null;

    const tasks = await fetchSheetData(token, "Tasks!A:Z");
    
    // Pass 1: Generate new Task IDs
    tasks.forEach(t => {
      const oldId = String(t.id || t.task_id || "");
      if (oldId && taskIdCol) {
        const newId = uuidv7();
        taskMap.set(oldId, newId);
        updates.push({
          range: `Tasks!${taskIdCol}${t._rowIndex}`,
          values: [[newId]]
        });
      }
      
      const oldProjId = String(t.project_id || "");
      if (oldProjId && taskProjIdCol && projectMap.has(oldProjId)) {
        updates.push({
          range: `Tasks!${taskProjIdCol}${t._rowIndex}`,
          values: [[projectMap.get(oldProjId)]]
        });
      }
    });

    // Pass 2: Update parent_task_id
    tasks.forEach(t => {
      const oldParentId = String(t.parent_task_id || "");
      if (oldParentId && taskParentIdCol && taskMap.has(oldParentId)) {
        updates.push({
          range: `Tasks!${taskParentIdCol}${t._rowIndex}`,
          values: [[taskMap.get(oldParentId)]]
        });
      }
    });

    // 3. PLANS
    const plansHeaders = await getSheetHeaders(token, "Plans");
    const planIdIdx = plansHeaders.findIndex(h => h === "id");
    const planProjIdIdx = plansHeaders.findIndex(h => h === "project_id");
    const planTaskIdIdx = plansHeaders.findIndex(h => h === "task_id");

    const planIdCol = planIdIdx >= 0 ? getColumnLetter(planIdIdx) : null;
    const planProjIdCol = planProjIdIdx >= 0 ? getColumnLetter(planProjIdIdx) : null;
    const planTaskIdCol = planTaskIdIdx >= 0 ? getColumnLetter(planTaskIdIdx) : null;

    const plans = await fetchSheetData(token, "Plans!A:Z");
    plans.forEach(pl => {
      const oldId = String(pl.id || "");
      if (oldId && planIdCol) {
        const newId = uuidv7();
        planMap.set(oldId, newId);
        updates.push({
          range: `Plans!${planIdCol}${pl._rowIndex}`,
          values: [[newId]]
        });
      }

      const oldProjId = String(pl.project_id || "");
      if (oldProjId && planProjIdCol && projectMap.has(oldProjId)) {
        updates.push({
          range: `Plans!${planProjIdCol}${pl._rowIndex}`,
          values: [[projectMap.get(oldProjId)]]
        });
      }

      const oldTaskId = String(pl.task_id || "");
      if (oldTaskId && planTaskIdCol && taskMap.has(oldTaskId)) {
        updates.push({
          range: `Plans!${planTaskIdCol}${pl._rowIndex}`,
          values: [[taskMap.get(oldTaskId)]]
        });
      }
    });

    // 4. NOTIFICATIONS
    const notifsHeaders = await getSheetHeaders(token, "Notifications");
    const notifIdIdx = notifsHeaders.findIndex(h => h === "id");
    if (notifIdIdx >= 0) {
      const notifIdCol = getColumnLetter(notifIdIdx);
      const notifs = await fetchSheetData(token, "Notifications!A:Z");
      notifs.forEach(n => {
        if (!n.id) return;
        const newId = uuidv7();
        notifMap.set(String(n.id), newId);
        updates.push({
          range: `Notifications!${notifIdCol}${n._rowIndex}`,
          values: [[newId]]
        });
      });
    }

    // Execute Batch Update
    if (updates.length > 0) {
      // Chunk updates if it's too large (optional, but good practice for huge datasets)
      // We assume it's small enough for a single batch update for now.
      await batchUpdateSheetValues(token, updates);
    }

    return NextResponse.json({ 
      success: true, 
      message: "Migrated to UUIDv7 successfully!",
      stats: {
        totalCellsUpdated: updates.length,
        projectsMigrated: projectMap.size,
        tasksMigrated: taskMap.size,
        plansMigrated: planMap.size,
        notifsMigrated: notifMap.size
      }
    });
  } catch (error: any) {
    console.error("Migration Error:", error);
    return NextResponse.json({ status: "error", message: error.message }, { status: 500 });
  }
}
