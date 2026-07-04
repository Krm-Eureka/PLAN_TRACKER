import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

const recentTasks = [
  { id: 1, name: 'Setup VPN for new hires', project: 'Onboarding Q3', priority: 'High', status: 'In Progress', due: 'Today' },
  { id: 2, name: 'Database migration to Cloud', project: 'Cloud Infra', priority: 'Urgent', status: 'To Do', due: 'Tomorrow' },
  { id: 3, name: 'Update SSL Certificates', project: 'Security Audit', priority: 'High', status: 'Done', due: 'Done' },
  { id: 4, name: 'Fix printer in building A', project: 'Helpdesk', priority: 'Normal', status: 'In Progress', due: '2 days' },
]

export function RecentTasks() {
  return (
    <Card className="shadow-sm border-slate-200/60">
      <CardHeader>
        <CardTitle>My Recent Tasks</CardTitle>
        <CardDescription>Tasks assigned to you that need attention.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {recentTasks.map((task) => (
            <div key={task.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100 hover:border-blue-100 hover:bg-blue-50/50 transition-colors cursor-pointer">
              <div className="flex flex-col gap-1">
                <span className="font-medium text-slate-900 text-sm">{task.name}</span>
                <span className="text-xs text-slate-500">{task.project}</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={task.status === 'Done' ? 'outline' : 'default'} 
                        className={
                          task.status === 'Done' ? 'text-emerald-600 border-emerald-200 bg-emerald-50' : 
                          task.status === 'In Progress' ? 'bg-amber-100 text-amber-800 hover:bg-amber-100' : 
                          'bg-slate-100 text-slate-800 hover:bg-slate-100'
                        }>
                  {task.status}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
