import { StatCards } from "@/components/dashboard/StatCards"
import { RecentTasks } from "@/components/dashboard/RecentTasks"
import { TeamWorkload } from "@/components/dashboard/TeamWorkload"
// import { TestGroupButton } from "@/components/dashboard/TestGroupButton"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { fetchProjects, fetchRecentTasks, fetchTeamWorkload } from "@/services/api"
import { TaskData, ProjectData, UserData } from "@/interfaces"

export default async function Dashboard() {
  const session = await getServerSession(authOptions);
  const token = (session as { accessToken?: string })?.accessToken;
  const userEmail = session?.user?.email;

  let tasks: TaskData[] = [];
  let projects: ProjectData[] = [];
  let users: UserData[] = [];

  try {
    if (token) {
      [tasks, projects, users] = await Promise.all([
        fetchRecentTasks(token),
        fetchProjects(token),
        fetchTeamWorkload(token)
      ]);
      
      // Filter out NONE from stats
      projects = projects.filter((p: ProjectData) => p.project_code !== 'NONE');

      // 1. Resolve Assignees for Tasks so RecentTasks can filter by email
      const idToEmail: Record<string, string> = {};
      users.forEach(u => {
        if (u.id) idToEmail[u.id] = (u.email || '').toLowerCase();
      });

      tasks = tasks.map(t => {
        const assigneeIds = (t.assignee_id || t.assignee || '').split(',').map(id => id.trim()).filter(Boolean);
        const emails = assigneeIds.map(id => idToEmail[id] || '').filter(Boolean);
        return {
          ...t,
          owner_email: emails.join(', ') // Add owner_email so RecentTasks can match it
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

      {/* <TestGroupButton /> */}

      <StatCards tasks={tasks} projects={projects} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 mt-8">
        <RecentTasks tasks={tasks} userEmail={userEmail || ''} />
        <TeamWorkload users={users} />
      </div>
    </div>
  );
}
