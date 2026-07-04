import { StatCards } from "@/components/dashboard/StatCards"
import { RecentTasks } from "@/components/dashboard/RecentTasks"
import { TeamWorkload } from "@/components/dashboard/TeamWorkload"
import { TestGroupButton } from "@/components/dashboard/TestGroupButton"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { fetchProjects, fetchRecentTasks, fetchTeamWorkload } from "@/services/api"

export default async function Dashboard() {
  const session = await getServerSession(authOptions);
  const token = (session as any)?.accessToken;
  const userEmail = session?.user?.email;

  let tasks: any[] = [];
  let projects: any[] = [];
  let users: any[] = [];

  try {
    if (token) {
      [tasks, projects, users] = await Promise.all([
        fetchRecentTasks(token),
        fetchProjects(token),
        fetchTeamWorkload(token)
      ]);
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

      <TestGroupButton />

      <StatCards tasks={tasks} projects={projects} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 mt-8">
        <RecentTasks tasks={tasks} userEmail={userEmail || ''} />
        <TeamWorkload users={users} />
      </div>
    </div>
  );
}
