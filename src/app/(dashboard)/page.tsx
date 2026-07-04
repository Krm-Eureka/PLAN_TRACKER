import { StatCards } from "@/components/dashboard/StatCards"
import { RecentTasks } from "@/components/dashboard/RecentTasks"
import { TeamWorkload } from "@/components/dashboard/TeamWorkload"
import { TestGroupButton } from "@/components/dashboard/TestGroupButton"

export default function Dashboard() {
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Dashboard</h1>
        <p className="text-slate-500">Overview of your IT projects and tasks.</p>
      </div>

      <TestGroupButton />

      <StatCards />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 mt-8">
        <RecentTasks />
        <TeamWorkload />
      </div>
    </div>
  );
}
