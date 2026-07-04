import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

const myTasks = [
  { id: 1, name: 'Setup VPN for new hires', project: 'Onboarding Q3', priority: 'High', status: 'In Progress', due: 'Today' },
  { id: 2, name: 'Database migration to Cloud', project: 'Cloud Infra', priority: 'Urgent', status: 'To Do', due: 'Tomorrow' },
  { id: 3, name: 'Update SSL Certificates', project: 'Security Audit', priority: 'High', status: 'Done', due: 'Done' },
  { id: 4, name: 'Fix printer in building A', project: 'Helpdesk', priority: 'Normal', status: 'In Progress', due: '2 days' },
  { id: 5, name: 'Provision 5 new laptops', project: 'Hardware', priority: 'Normal', status: 'To Do', due: 'Next week' },
]

export default function MyTasks() {
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">My Tasks</h1>
        <p className="text-slate-500">Tasks assigned specifically to you across all projects.</p>
      </div>

      <Card className="shadow-sm border-slate-200/60 mt-8">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Active Tasks</CardTitle>
              <CardDescription>Manage your current workload.</CardDescription>
            </div>
            <div className="flex space-x-2">
              <Badge variant="outline" className="text-slate-500 bg-slate-50">Total: {myTasks.length}</Badge>
              <Badge variant="outline" className="text-amber-600 bg-amber-50">In Progress: {myTasks.filter(t => t.status === 'In Progress').length}</Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {myTasks.map((task) => (
              <div key={task.id} className="flex items-center justify-between p-4 bg-white rounded-lg border border-slate-200 hover:border-blue-300 hover:shadow-md transition-all cursor-pointer">
                <div className="flex flex-col gap-1 w-1/3">
                  <span className="font-semibold text-slate-900">{task.name}</span>
                  <span className="text-xs font-medium text-blue-600 bg-blue-50 w-fit px-2 py-0.5 rounded-full">{task.project}</span>
                </div>
                
                <div className="flex flex-col items-center justify-center w-1/4">
                  <span className="text-xs text-slate-500 mb-1">Due Date</span>
                  <span className={`text-sm font-medium ${task.due === 'Today' || task.due === 'Tomorrow' ? 'text-red-500' : 'text-slate-700'}`}>
                    {task.due}
                  </span>
                </div>

                <div className="flex items-center justify-end gap-3 w-1/3">
                  <Badge variant={task.priority === 'Urgent' ? 'destructive' : task.priority === 'High' ? 'default' : 'secondary'}>
                    {task.priority}
                  </Badge>
                  <Badge variant="outline" 
                          className={
                            task.status === 'Done' ? 'text-emerald-600 border-emerald-200 bg-emerald-50' : 
                            task.status === 'In Progress' ? 'bg-amber-100 text-amber-800 border-amber-200' : 
                            'bg-slate-100 text-slate-800'
                          }>
                    {task.status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
