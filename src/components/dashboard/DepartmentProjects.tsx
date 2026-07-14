import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Briefcase, ArrowRight } from "lucide-react"
import { ProjectData, TaskData } from "@/interfaces"
import Link from "next/link"

interface DepartmentProjectsProps {
  projects: ProjectData[];
  tasks: TaskData[];
}

export function DepartmentProjects({ projects, tasks }: DepartmentProjectsProps) {
  // Sort projects by end date or just take the first 5 active ones
  const activeProjects = projects
    .filter(p => p.status !== 'Closed' && p.status !== 'Completed')
    .slice(0, 5);

  return (
    <Card className="shadow-sm border-slate-200/60 flex flex-col h-full mt-6">
      <CardHeader className="shrink-0 pb-3 border-b border-slate-100 flex flex-row items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Briefcase className="w-5 h-5 text-indigo-500" />
            <CardTitle>Department Projects</CardTitle>
          </div>
          <CardDescription>Overview of active projects and progress.</CardDescription>
        </div>
        <Link 
          href="/projects"
          className="hidden sm:flex items-center text-sm font-medium text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 px-3 py-1.5 rounded-md transition-colors"
        >
          View All <ArrowRight className="ml-1 w-4 h-4" />
        </Link>
      </CardHeader>
      <CardContent className="flex-1 overflow-y-auto pt-4">
        {activeProjects.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-slate-400">
            <p>No active projects</p>
          </div>
        ) : (
          <div className="space-y-6">
            {activeProjects.map((project) => {
              // Calculate progress based on tasks
              const projectTasks = tasks.filter(t => 
                t.project_id === project.id && 
                !(t.status || '').toLowerCase().includes('cancel')
              );
              const totalTasks = projectTasks.length;
              const completedTasks = projectTasks.filter(t => 
                ['done', 'complete', 'completed'].some(status => (t.status || '').toLowerCase().includes(status))
              ).length;
              
              const progressPercentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

              return (
                <div key={project.id} className="space-y-2">
                  <div className="flex justify-between items-end">
                    <div>
                      <Link href={`/projects/${project.id}`} className="font-semibold text-slate-800 hover:text-indigo-600 hover:underline">
                        {project.project_code}
                      </Link>
                      <p className="text-sm text-slate-600 truncate max-w-[200px] sm:max-w-[300px]">
                        {project.project_name}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-medium text-slate-900">{progressPercentage}%</span>
                      <p className="text-xs text-slate-500">{completedTasks}/{totalTasks} tasks</p>
                    </div>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-indigo-500 rounded-full transition-all duration-500" 
                      style={{ width: `${progressPercentage}%` }} 
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
