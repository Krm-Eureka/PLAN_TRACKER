import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { getStatusColor } from "@/utils/status"
import Link from "next/link"
import { RecentTasksProps } from "@/interfaces"

export function RecentTasks({ tasks, userEmail }: RecentTasksProps) {
  // Filter for current user's tasks, sort by most recent, take up to 50
  const myTasks = tasks
    .filter(t => {
      const assignee = t.assignee || t.owner_email || '';
      const status = (t.status || '').toLowerCase();
      // Only show tasks assigned to me that are not done and not cancelled
      return assignee.toLowerCase() === userEmail.toLowerCase() && !status.includes('done') && !status.includes('complete') && !status.includes('cancel');
    })
    .slice(-50)
    .reverse(); // assuming newer tasks are appended at the end

  return (
    <Card className="shadow-sm border-slate-200/60 flex flex-col h-full max-h-[500px]">
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
            <Link href="/tasks/me" key={task.task_id || idx} className="flex items-center justify-between p-3 bg-white rounded-lg border border-slate-200 hover:border-indigo-300 hover:shadow-md transition-all cursor-pointer group">
              <div className="flex flex-col gap-1 w-2/3">
                <span className="font-medium text-slate-900 text-sm group-hover:text-indigo-600 transition-colors truncate">{task.task_name}</span>
                <span className="text-xs font-medium text-indigo-600 bg-indigo-50 w-fit px-2 py-0.5 rounded-full border border-indigo-100">{task.project_code || task.project_id || 'No Project'}</span>
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
