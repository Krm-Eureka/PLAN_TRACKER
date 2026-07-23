import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { getStatusColor, getStatusPriority } from "@/utils/status"
import Link from "next/link"
import { RecentTasksProps } from "@/interfaces"

export function RecentTasks({ tasks, userEmail }: RecentTasksProps) {

  const myTasks = tasks
    .filter(t => {
      const ownerEmails = (t.owner_email || '').toLowerCase();
      const status = (t.status || '').toLowerCase();
      // Only show tasks assigned to me that are not done and not cancelled
      return ownerEmails.includes(userEmail.toLowerCase()) && !status.includes('done') && !status.includes('complete') && !status.includes('cancel');
    })
    .sort((a, b) => {
      // 1. Sort by Status Priority
      const pA = getStatusPriority(a.status || '');
      const pB = getStatusPriority(b.status || '');
      if (pA !== pB) return pA - pB;
      
      // 2. Sort by Due Date (closest deadline first)
      const dateA = a.due_date ? new Date(a.due_date).getTime() : Infinity;
      const dateB = b.due_date ? new Date(b.due_date).getTime() : Infinity;
      return dateA - dateB;
    })
    .slice(0, 50);

  return (
    <Card className="shadow-sm border-slate-200/60 flex flex-col max-h-[500px]">
      <CardHeader className="shrink-0">
        <CardTitle>My Recent Tasks</CardTitle>
        <CardDescription>Tasks assigned to you that need attention.</CardDescription>
      </CardHeader>
      <CardContent className="flex-1 overflow-y-auto min-h-0 pr-2 pb-4">
        <div className="space-y-4">
          {myTasks.length === 0 ? (
            <div className="text-center py-8 text-slate-500 bg-slate-50 rounded-lg border border-slate-200 border-dashed">
              You&apos;re all caught up!
            </div>
          ) : myTasks.map((task, idx) => (
            <Link href="/tasks" key={task.task_id || idx} className="flex items-center justify-between p-3 bg-white rounded-lg border border-slate-200 hover:border-emerald-300 hover:shadow-md transition cursor-pointer group">
              <div className="flex flex-col gap-1 w-2/3">
                <span className="font-medium text-slate-900 text-sm group-hover:text-emerald-600 transition-colors truncate">{task.task_name}</span>
                <span className="text-xs font-medium text-emerald-600 bg-emerald-50 w-fit px-2 py-0.5 rounded-full border border-emerald-100">{task.project_code || task.project_id || 'No Project'}</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge className={`px-2 py-0.5 text-xs shadow-sm ${getStatusColor(task.status)}`}>
                  {task.status || 'To Do'}
                </Badge>
              </div>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
