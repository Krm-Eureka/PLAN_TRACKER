import { getServerSession } from "next-auth/next"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { fetchRecentTasks, fetchProjects, fetchTeamWorkload } from "@/services/api"
import { FolderKanban, ArrowLeft, AlertCircle } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { GanttChart } from "@/components/projects/GanttChart"
import { AddTaskButton } from "@/components/projects/AddTaskButton"

export default async function ProjectDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const session = await getServerSession(authOptions);
  const token = (session as any)?.accessToken;
  const projectId = decodeURIComponent(resolvedParams.id);
  
  let projects: any[] = [];
  let allTasks: any[] = [];
  let users: any[] = [];
  let errorMsg = null;

  try {
    // Fetch both to find the project details and its tasks
    const [fetchedProjects, fetchedTasks, fetchedUsers] = await Promise.all([
      fetchProjects(token),
      fetchRecentTasks(token),
      fetchTeamWorkload(token).catch(() => [])
    ]);
    projects = fetchedProjects;
    allTasks = fetchedTasks;
    users = fetchedUsers;
  } catch (error: any) {
    console.error("Failed to fetch project details:", error);
    errorMsg = error.message;
  }

  // Find the specific project
  const project = projects.find(p => p.project_code === projectId || p.project_name === projectId);
  
  // Find tasks belonging to this project
  // We assume there might be a project_code or project field in the tasks sheet
  // If not, we'll try to match by name or ID, or fallback to showing all tasks if we can't filter
  let projectTasks = allTasks.filter(t => 
    t.project_code === projectId || 
    t.project === projectId || 
    t.project_name === project?.project_name
  );

  // If we can't figure out the relationship, we might just show an empty chart or all tasks as a fallback for demonstration
  // In a real scenario, the data structure MUST link tasks to projects.

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Link href="/projects">
              <Button variant="ghost" size="sm" className="h-8 gap-1 text-slate-500 hover:text-slate-900">
                <ArrowLeft className="w-4 h-4" />
                Back to Projects
              </Button>
            </Link>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <FolderKanban className="w-8 h-8 text-indigo-600" />
            {project?.project_name || projectId}
          </h1>
          <p className="text-slate-500 mt-1">Project timeline and tasks schedule</p>
        </div>
        <AddTaskButton users={users} projectCode={projectId} />
      </div>

      {errorMsg ? (
        <div className="bg-red-50 text-red-600 p-4 rounded-xl border border-red-100 flex items-start gap-3 shadow-sm">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold">Failed to load project details</h3>
            <p className="text-sm mt-1">{errorMsg}</p>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden p-6">
          <GanttChart tasks={projectTasks} project={project} />
        </div>
      )}
    </div>
  )
}
