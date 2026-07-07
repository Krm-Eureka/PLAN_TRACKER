import { StatCards } from "@/components/dashboard/StatCards"
import { RecentTasks } from "@/components/dashboard/RecentTasks"
import { TeamWorkload } from "@/components/dashboard/TeamWorkload"
import { WeeklyTeamPlans } from "@/components/dashboard/WeeklyTeamPlans"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { fetchProjects, fetchRecentTasks, fetchTeamWorkload, fetchPlans } from "@/services/api"
import { TaskData, ProjectData, UserData } from "@/interfaces"
import { startOfWeek, endOfWeek, parseISO, isWithinInterval } from "date-fns"

export default async function Dashboard() {
  const session = await getServerSession(authOptions);
  const token = (session as { accessToken?: string })?.accessToken;
  const userEmail = session?.user?.email;

  let tasks: TaskData[] = [];
  let projects: ProjectData[] = [];
  let users: UserData[] = [];
  let plans: any[] = [];

  try {
    if (token) {
      [tasks, projects, users, plans] = await Promise.all([
        fetchRecentTasks(token),
        fetchProjects(token),
        fetchTeamWorkload(token),
        fetchPlans(token)
      ]);

      // Filter out NONE from stats
      projects = projects.filter((p: ProjectData) => p.project_code !== 'NONE');

      // 1. Resolve Assignees and Project Codes for Tasks
      const idToEmail: Record<string, string> = {};
      const idToName: Record<string, string> = {};
      users.forEach(u => {
        if (u.id) {
          idToEmail[u.id] = (u.email || '').toLowerCase();
          idToName[u.id] = u.name_en || u.name_th || u.email || '';
        }
      });

      const idToProjectCode: Record<string, string> = {};
      projects.forEach(p => {
        if (p.id) {
          const code = p.project_code && p.project_code !== 'NONE' ? p.project_code : '';
          const name = p.project_name || '';
          if (code && name) {
            idToProjectCode[p.id] = `${code} - ${name}`;
          } else {
            idToProjectCode[p.id] = name || code || p.id;
          }
        }
      });

      tasks = tasks.map(t => {
        const assigneeIds = (t.assignee_id || t.assignee || '').split(',').map(id => id.trim()).filter(Boolean);
        const emails = assigneeIds.map(id => idToEmail[id] || '').filter(Boolean);
        return {
          ...t,
          owner_email: emails.join(', '), // Add owner_email so RecentTasks can match it
          project_code: t.project_id ? (idToProjectCode[t.project_id] || t.project_id) : ''
        };
      });

      // 2. Compute active_tasks for Team Workload
      users = users.map(u => {
        const uid = u.id || '';
        let activeCount = 0;
        if (uid) {
          tasks.forEach(t => {
            const status = (t.status || '').toLowerCase();
            const isDone = status.includes('done') || status.includes('complete') || status.includes('cancel');
            const assignees = (t.assignee_id || t.assignee || '').split(',').map(id => id.trim());
            if (!isDone && assignees.includes(uid)) {
              activeCount++;
            }
          });
        }
        return { ...u, active_tasks: activeCount };
      });

      // Filter Team Workload to only show users in the same department, unless superAdmin
      const myDept = (session as { department?: string })?.department || "";
      const myRole = (session as { role_system?: string })?.role_system || "";

      if (myDept && myRole.toLowerCase() !== "super admin" && myRole.toLowerCase() !== "superadmin") {
        users = users.filter((u: UserData) => (u.department || "") === myDept);
      }

      // Filter Plans for current week and same department
      const validUserIds = new Set(users.map(u => u.id));
      const today = new Date();
      // Monday = 1, Sunday = 0, date-fns startOfWeek with weekStartsOn: 1 (Monday)
      const weekStart = startOfWeek(today, { weekStartsOn: 1 });
      const weekEnd = endOfWeek(today, { weekStartsOn: 1 });

      plans = plans.filter(p => {
        if (!validUserIds.has(p.user_id)) return false;
        try {
          const planDate = parseISO(p.start_date);
          return isWithinInterval(planDate, { start: weekStart, end: weekEnd });
        } catch {
          return false;
        }
      }).map(p => ({
        ...p,
        name: idToName[p.user_id] || p.user_id,
        project_code: p.project_id ? (idToProjectCode[p.project_id] || '') : ''
      }));
    }
  } catch (error) {
    console.error("Dashboard fetch error:", error);
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Dashboard</h1>
        <p className="text-slate-500">Overview of your IT projects and tasks.</p>
      </div>

      <StatCards tasks={tasks} projects={projects} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 mt-3">
        <RecentTasks tasks={tasks} userEmail={userEmail || ''} />
        <TeamWorkload users={users} />
      </div>

      <div className="mt-8">
        <WeeklyTeamPlans plans={plans} />
      </div>
    </div>
  );
}
