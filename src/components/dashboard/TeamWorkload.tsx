import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { UserData, TaskData, ProjectData } from "@/interfaces"

interface TeamWorkloadProps {
  users: UserData[];
  tasks: TaskData[];
  projects: ProjectData[];
  isSuperAdmin?: boolean;
}

export function TeamWorkload({ users, tasks, projects, isSuperAdmin }: TeamWorkloadProps) {
  const groupedUsers = users.reduce((acc, user) => {
    const dept = user.department || "No Department";
    if (!acc[dept]) acc[dept] = [];
    acc[dept].push(user);
    return acc;
  }, {} as Record<string, UserData[]>);

  return (
    <Card className="shadow-sm border-slate-200/60 flex flex-col h-full max-h-[500px]">
      <CardHeader className="shrink-0">
        <CardTitle>Team Workload</CardTitle>
        <CardDescription>Current capacity of your team members.</CardDescription>
      </CardHeader>
      <CardContent className="flex-1 overflow-y-auto min-h-0 pr-2 pb-4">
        <div className="space-y-6">
          {Object.entries(groupedUsers).map(([dept, deptUsers]) => (
            <div key={dept} className="space-y-3">
              {isSuperAdmin && (
                <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider sticky top-0 bg-white/80 backdrop-blur pb-1 z-10 border-b border-slate-100">
                  {dept}
                </h3>
              )}
              <div className="space-y-4">
                {deptUsers.map((person) => {
                  // Calculate active tasks
                  const userTasks = tasks.filter(t => {
                    const assignees = (t.assignee_id || (t as any).assignee || '').split(',').map((id: string) => id.trim());
                    return assignees.includes(person.id as string) || assignees.includes(person.email as string) || assignees.includes(person.emp_id as string);
                  });
                  const activeTasks = userTasks.filter(t => !['done', 'complete', 'completed', 'cancel', 'cancelled', 'on hold', 'hold'].includes((t.status || '').toLowerCase()));
                  const activeTaskCount = activeTasks.length;

                  // Calculate active projects (projects where the user has an active task)
                  const activeProjectIds = new Set(activeTasks.map(t => t.project_id).filter(Boolean));
                  const activeProjectCount = activeProjectIds.size;

                  // Capacity logic (max 10 tasks)
                  const capacity = Math.min((activeTaskCount / 10) * 100, 100);
                  const initials = person.name_en ? person.name_en.split(' ').map((n: string) => n[0]).join('').substring(0, 2) : (person.department || 'U');

                  return (
                    <div key={person.emp_id || person.email} className="flex items-center justify-between p-3 bg-white border border-slate-100 rounded-lg shadow-sm hover:shadow-md transition-shadow">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center font-semibold text-xs text-slate-600 shrink-0">
                          {initials}
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="font-medium text-slate-900 text-sm truncate">{person.name_en || person.email}</span>
                          <span className="text-xs text-slate-500 truncate">{person.position}</span>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1 w-1/3 shrink-0">
                        <span className="text-xs font-medium text-slate-600">
                          {activeTaskCount} tasks • {activeProjectCount} projects
                        </span>
                        <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full ${capacity > 75 ? 'bg-red-500' : 'bg-emerald-500'}`}
                            style={{ width: `${capacity}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
