// @ts-nocheck
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { prisma } from "@/lib/prisma"
import { getSessionContext } from "@/lib/permissions"
import { AlertCircle, ListTodo } from "lucide-react"

import { TasksWorkspace } from "@/components/tasks/TasksWorkspace"

export const dynamic = 'force-dynamic';

export default async function TasksPage() {
  const session = await getSessionContext();
  const token = session?.token;
  const ctx = await getSessionContext();

  let allTasks: any[] = [];
  let allUsers: any[] = [];
  let errorMsg = null;
  let department = ctx?.department || "";
  
  const myRole = (session as { role_system?: string })?.role_system || "";
  const isSuperUser = myRole.toLowerCase() === "super admin" || myRole.toLowerCase() === "superadmin";

  try {
    if (!ctx) throw new Error("Unauthorized");

    const [tasksRaw, usersRaw, projectsRaw] = await Promise.all([
      prisma.task.findMany({
        orderBy: [
          { due_date: 'desc' },
          { start_date: 'desc' }
        ]
      }),
      prisma.user.findMany(),
      prisma.project.findMany()
    ]);

    allUsers = usersRaw;

    // 1. Map users to get email and name
    const idToEmail: Record<string, string> = {};
    const idToName: Record<string, string> = {};
    usersRaw.forEach((u) => {
      if (u.id) {
        idToEmail[u.id] = (u.email || '').toLowerCase();
        idToName[u.id] = u.name_en || u.name_th || u.email || '';
      }
    });

    // 2. Map project ID to Project Details
    const idToProjectCode: Record<string, string> = {};
    const idToProjectName: Record<string, string> = {};
    const idToProjectColor: Record<string, string> = {};
    const deptProjectIds = new Set<string>();
    
    projectsRaw.forEach((p) => {
      if (p.id) {
        idToProjectCode[p.id] = p.project_code && p.project_code !== 'NONE' ? p.project_code : (p.project_name || p.id);
        idToProjectName[p.id] = p.project_name || "";
        idToProjectColor[p.id] = p.color || "";
      }
      if ((p.department || '') === department) {
        deptProjectIds.add(p.id);
      }
    });

    let mappedTasks = tasksRaw.map((rawTask: any) => {
      const pCode = rawTask.project_id ? idToProjectCode[rawTask.project_id] : "";
      const pName = rawTask.project_id ? idToProjectName[rawTask.project_id] : "";
      const pColor = rawTask.project_id ? idToProjectColor[rawTask.project_id] : "";
      
      const assigneeIds = (rawTask.assignee_id || '').split(',').map((id: string) => id.trim()).filter(Boolean);
      const names = assigneeIds.map((id: string) => idToName[id] || null).filter(Boolean);
      
      const finalAssignee = names.length > 0 ? names.join(', ') : (rawTask.assignee_name || "-");

      return {
        ...rawTask,
        project_code: pCode,
        project_name: pName,
        project_color: pColor,
        assignee: finalAssignee,
        // serialize dates for client
        start_date: rawTask.start_date || "",
        due_date: rawTask.due_date || "",
        created_at: rawTask.created_at ? rawTask.created_at.toISOString() : "",
        updated_at: rawTask.updated_at ? rawTask.updated_at.toISOString() : "",
      };
    });

    // 3. Filter by department if not super admin
    if (department && !isSuperUser) {
      const deptEmails = new Set(
        usersRaw
          .filter((u) => (u.department_id || '') === department)
          .map(u => (u.email || '').toLowerCase())
          .filter(Boolean)
      );
      const deptUserIds = new Set(
        usersRaw
          .filter((u) => (u.department_id || '') === department)
          .map(u => (u.id || '').toLowerCase())
          .filter(Boolean)
      );
      
      mappedTasks = mappedTasks.filter(t => {
        const assigneeIdList = (t.assignee_id || '').split(',').map((id: string) => id.trim().toLowerCase()).filter(Boolean);
        const assigneeEmails = assigneeIdList.map((id: string) => (idToEmail[id] || '').toLowerCase()).filter(Boolean);
        
        if (assigneeIdList.length > 0) {
          if (assigneeIdList.some((id: string) => deptUserIds.has(id))) return true;
          if (assigneeEmails.some((email: string) => deptEmails.has(email))) return true;
        }
        
        if (t.project_id) {
          return deptProjectIds.has(t.project_id);
        }
        
        return false;
      });
    }

    allTasks = mappedTasks;

  } catch (error: unknown) {
    const err = error as Error;
    console.error("Failed to fetch tasks:", err);
    errorMsg = err.message;
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 w-full h-full flex flex-col">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
          <ListTodo className="w-8 h-8 text-emerald-600" />
          Tasks & Workspace
        </h1>
        <p className="text-slate-500 mt-1">Manage all your team's tasks, board, and plans in one place.</p>
      </div>

      {errorMsg ? (
        <div className="bg-red-50 text-red-600 p-4 rounded-xl border border-red-100 flex items-start gap-3 shadow-sm">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold">Failed to load tasks</h3>
            <p className="text-sm mt-1">{errorMsg}</p>
          </div>
        </div>
      ) : (
        <TasksWorkspace tasks={allTasks} users={allUsers} department={department} />
      )}
    </div>
  )
}
