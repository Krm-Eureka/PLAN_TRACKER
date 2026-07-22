import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { ProjectData, TaskData } from "@/interfaces"
import { AlertCircle, AlertTriangle, Clock } from "lucide-react"
import Link from "next/link"
import { parseSafeDate } from "@/utils/date"

interface NeedsAttentionProps {
  projects: ProjectData[]
  tasks: TaskData[]
}

export function NeedsAttention({ projects, tasks }: NeedsAttentionProps) {
  const overdueProjects = projects.filter(p => p.status === 'OVER DUE')

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const overdueTasks = tasks.filter(t => {
    const status = (t.status || '').toLowerCase()
    if (status.includes('done') || status.includes('complete') || status.includes('cancel') || status.includes('hold') || status.includes('wait')) {
      return false
    }
    const due = parseSafeDate(t.due_date)
    if (!due) return false
    due.setHours(0, 0, 0, 0)
    return due < today
  })

  const hasIssues = overdueProjects.length > 0 || overdueTasks.length > 0

  if (!hasIssues) {
    return null; // Don't render anything if there's no attention needed
  }

  return (
    <Card className="border-rose-200 shadow-sm bg-rose-50/30 overflow-hidden relative">
      <div className="absolute top-0 left-0 w-1 h-full bg-rose-500"></div>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2 text-rose-600">
          <AlertCircle className="w-5 h-5" />
          <CardTitle className="text-lg">Needs Attention</CardTitle>
        </div>
        <CardDescription className="text-rose-600/70">
          Items that are overdue or require immediate action
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">

        {overdueProjects.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-rose-700 uppercase tracking-wider flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5" />
              Overdue Projects ({overdueProjects.length})
            </h4>
            <div className="space-y-2">
              {overdueProjects.slice(0, 3).map(p => {
                const projectId = p.id || p.project_code || ""
                return (
                  <Link href={`/projects/${encodeURIComponent(projectId)}`} key={projectId}>
                    <div className="bg-white border border-rose-200 rounded-md p-2.5 hover:border-rose-300 hover:shadow-sm transition group">
                      <div className="font-medium text-sm text-slate-800 group-hover:text-rose-600 transition-colors truncate">
                        {p.project_name}
                      </div>
                      <div className="flex justify-between items-center mt-1">
                        <span className="text-[10px] text-rose-500 font-mono bg-rose-50 px-1.5 rounded">
                          {p.project_code}
                        </span>
                        <span className="text-[10px] text-rose-500 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Due: {p.end_date}
                        </span>
                      </div>
                    </div>
                  </Link>
                )
              })}
              {overdueProjects.length > 3 && (
                <div className="text-xs text-center text-rose-500 font-medium pt-1">
                  + {overdueProjects.length - 3} more projects
                </div>
              )}
            </div>
          </div>
        )}

        {overdueTasks.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-amber-700 uppercase tracking-wider flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              Overdue Tasks ({overdueTasks.length})
            </h4>
            <div className="space-y-2">
              {overdueTasks.slice(0, 5).map(t => {
                const projectId = t.project_id || t.project_code || ""
                return (
                  <Link href={`/projects/${encodeURIComponent(projectId)}`} key={t.task_id || t.id}>
                    <div className="bg-white border border-amber-200 rounded-md p-2.5 hover:border-amber-300 hover:shadow-sm transition group">
                      <div className="font-medium text-sm text-slate-800 group-hover:text-amber-600 transition-colors truncate">
                        {t.task_name}
                      </div>
                      <div className="flex justify-between items-center mt-1">
                        <span className="text-[10px] text-amber-600 truncate max-w-[120px]">
                          Assignee: {t.assignee || t.owner_email || 'Unassigned'}
                        </span>
                        <span className="text-[10px] text-amber-600 flex items-center gap-1 font-medium">
                          Due: {t.due_date}
                        </span>
                      </div>
                    </div>
                  </Link>
                )
              })}
              {overdueTasks.length > 5 && (
                <div className="text-xs text-center text-amber-600 font-medium pt-1">
                  + {overdueTasks.length - 5} more tasks
                </div>
              )}
            </div>
          </div>
        )}

      </CardContent>
    </Card>
  )
}
