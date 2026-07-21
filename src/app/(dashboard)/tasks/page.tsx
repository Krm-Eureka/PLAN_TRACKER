import { getServerSession } from "next-auth/next"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { fetchTeamWorkload, fetchProjects } from "@/services/api"
import { fetchSheetData } from "@/lib/googleSheets"
import { getSessionContext } from "@/lib/permissions"
import { unstable_cache } from "next/cache"
import { AlertCircle, ListTodo } from "lucide-react"

import { TaskData, UserData, ProjectData } from "@/interfaces"
import { TasksWorkspace } from "@/components/tasks/TasksWorkspace"
import { parseSafeDate } from "@/utils/date"

const getCachedTasksRaw = unstable_cache(
  async (token: string) => await fetchSheetData(token, "Tasks!A1:Z"),
  ['all-tasks-raw'],
  { tags: ['tasks'], revalidate: 30 }
);

export default async function TasksPage() {
  const session = await getServerSession(authOptions);
  const token = (session as { accessToken?: string })?.accessToken;
  const ctx = await getSessionContext();

  let allTasks: TaskData[] = [];
  let allUsers: UserData[] = [];
  let errorMsg = null;
  let department = ctx?.department || "";
  
  const myRole = (session as { role_system?: string })?.role_system || "";
  const isSuperUser = myRole.toLowerCase() === "super admin" || myRole.toLowerCase() === "superadmin";

  try {
    if (!token || !ctx) throw new Error("Unauthorized");

    const [tasksRaw, users, projects] = await Promise.all([
      getCachedTasksRaw(token),
      fetchTeamWorkload(token).catch(() => [] as UserData[]),
      fetchProjects(token).catch(() => [] as ProjectData[])
    ]);

    // 1. Map users to get email and name
    const idToEmail: Record<string, string> = {};
    const idToName: Record<string, string> = {};
    users.forEach((u: UserData) => {
      if (u.id) {
        idToEmail[u.id] = (u.email || '').toLowerCase();
        idToName[u.id] = u.name_en || u.name_th || u.email || '';
      }
    });
    allUsers = users;

    // 2. Map project ID to Project Code
    const idToProjectCode: Record<string, string> = {};
    const deptProjectIds = new Set<string>();
    
    projects.forEach((p: ProjectData) => {
      if (p.id) {
        idToProjectCode[p.id] = p.project_code && p.project_code !== 'NONE' ? p.project_code : (p.project_name || p.id);
      }
      if ((p.department || '') === department) {
        deptProjectIds.add(p.id as string);
      }
    });

    let mappedTasks = (tasksRaw as unknown as TaskData[]).map(t => {
      // Re-map project_code if missing but we have project_id
      const pCode = t.project_code || (t.project_id ? idToProjectCode[t.project_id] : "");
      
      // Re-map assignee from ID to Name
      const assigneeIds = (t.assignee_id || t.assignee || '').split(',').map(id => id.trim()).filter(Boolean);
      const names = assigneeIds.map(id => idToName[id] || null).filter(Boolean);
      
      // Use mapped names if found, otherwise use assignee_name from DB, otherwise "-"
      const finalAssignee = names.length > 0 ? names.join(', ') : (t.assignee_name || "-");

      return {
        ...t,
        project_code: pCode,
        assignee: finalAssignee
      };
    });

    // 3. Filter by department if not super admin
    if (department && !isSuperUser) {
      const deptEmails = new Set(
        users
          .filter((u: UserData) => (u.department_id || u.department || '') === department)
          .map(u => (u.email || '').toLowerCase())
          .filter(Boolean)
      );
      const deptUserIds = new Set(
        users
          .filter((u: UserData) => (u.department_id || u.department || '') === department)
          .map(u => (u.id || '').toLowerCase())
          .filter(Boolean)
      );
      
      mappedTasks = mappedTasks.filter(t => {
        const assigneeIdList = (t.assignee_id || '').split(',').map((id: string) => id.trim().toLowerCase()).filter(Boolean);
        const assigneeEmails = assigneeIdList.map(id => (idToEmail[id] || '').toLowerCase()).filter(Boolean);
        
        // If assigned to someone in this department (by ID or email)
        if (assigneeIdList.length > 0) {
          if (assigneeIdList.some(id => deptUserIds.has(id))) return true;
          if (assigneeEmails.some(e => deptEmails.has(e))) return true;
        }
        
        // Or if it belongs to a project in this department
        if (t.project_id) {
          return deptProjectIds.has(t.project_id);
        }
        
        return false;
      });
    }

    // 4. Sort tasks (newest/upcoming first)
    allTasks = mappedTasks.sort((a, b) => {
      const da = parseSafeDate(a.due_date || a.start_date);
      const db = parseSafeDate(b.due_date || b.start_date);
      if (!da && !db) return 0;
      if (!da) return 1;
      if (!db) return -1;
      return db.getTime() - da.getTime(); // Descending (newest first)
    });

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
