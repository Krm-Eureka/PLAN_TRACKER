import { getServerSession } from "next-auth/next"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { fetchRecentTasks } from "@/services/api"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { getStatusColor } from "@/utils/status"
import { formatDistanceToNow, isPast, isToday, isTomorrow } from 'date-fns'

export default async function MyTasks() {
  const session = await getServerSession(authOptions);
  const token = (session as any)?.accessToken;
  const userEmail = session?.user?.email;

  let myTasks: any[] = [];
  
  try {
    const allTasks = await fetchRecentTasks(token);
    myTasks = allTasks.filter(t => {
      const assignee = t.assignee || (t as any).owner_email || '';
      return assignee.toLowerCase() === userEmail?.toLowerCase();
    });
  } catch (error) {
    console.error("Failed to fetch tasks for user:", error);
  }

  const formatDueDate = (dateStr: string) => {
    if (!dateStr) return 'No Date';
    
    // Parse DD/MM/YYYY or similar if needed, or fallback to standard Date
    let date = new Date(dateStr);
    const dmyMatch = dateStr.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (dmyMatch) {
      date = new Date(parseInt(dmyMatch[3], 10), parseInt(dmyMatch[2], 10) - 1, parseInt(dmyMatch[1], 10));
    }
    
    if (isNaN(date.getTime())) return 'Invalid Date';
    
    if (isToday(date)) return 'Today';
    if (isTomorrow(date)) return 'Tomorrow';
    
    if (isPast(date)) {
      return 'Overdue';
    }
    
    return formatDistanceToNow(date, { addSuffix: true });
  }

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
              <Badge variant="outline" className="text-amber-600 bg-amber-50">In Progress: {myTasks.filter(t => (t.status || '').toLowerCase().includes('progress')).length}</Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {myTasks.length === 0 ? (
              <div className="text-center py-12 text-slate-500 bg-slate-50 rounded-lg border border-slate-200 border-dashed">
                You have no active tasks assigned to you.
              </div>
            ) : myTasks.map((task, index) => {
              const dueText = formatDueDate(task.due_date || task.end_date);
              const isDangerDate = dueText === 'Today' || dueText === 'Tomorrow' || dueText === 'Overdue';
              
              return (
                <div key={task.task_id || index} className="flex items-center justify-between p-4 bg-white rounded-lg border border-slate-200 hover:border-indigo-300 hover:shadow-md transition-all cursor-pointer group">
                  <div className="flex flex-col gap-1 w-1/3">
                    <span className="font-semibold text-slate-900 group-hover:text-indigo-600 transition-colors">{task.task_name}</span>
                    <span className="text-xs font-medium text-indigo-600 bg-indigo-50 w-fit px-2 py-0.5 rounded-full border border-indigo-100">{task.project_code || task.project_id || 'No Project'}</span>
                  </div>
                  
                  <div className="flex flex-col items-center justify-center w-1/4">
                    <span className="text-xs text-slate-500 mb-1">Due Date</span>
                    <span className={`text-sm font-medium ${isDangerDate && task.status !== 'Done' ? 'text-red-600' : 'text-slate-700'}`}>
                      {task.due_date || task.end_date ? dueText : '-'}
                    </span>
                  </div>

                  <div className="flex items-center justify-end gap-3 w-1/3">
                    <Badge variant={task.priority === 'High' || task.priority === 'Urgent' ? 'destructive' : 'secondary'} className="shadow-sm">
                      {task.priority || 'Normal'}
                    </Badge>
                    <Badge className={`px-2.5 py-0.5 shadow-sm ${getStatusColor(task.status)}`}>
                      {task.status || 'To Do'}
                    </Badge>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
