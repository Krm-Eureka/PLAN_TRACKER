import { getServerSession } from "next-auth/next"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { fetchRecentTasks, fetchProjects, fetchTeamWorkload } from "@/services/api"
import { FolderKanban, ArrowLeft, AlertCircle } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { GanttChart } from "@/components/projects/GanttChart"
import { AddTaskButton } from "@/components/projects/AddTaskButton"

import { TaskData, ProjectData, UserData } from "@/interfaces"

export default async function ProjectDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const session = await getServerSession(authOptions);
  const token = (session as { accessToken?: string })?.accessToken;
  const projectId = decodeURIComponent(resolvedParams.id);
  
  let projects: ProjectData[] = [];
  let allTasks: TaskData[] = [];
  let users: UserData[] = [];
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
  } catch (error: unknown) {
    const err = error as Error;
    console.error("Failed to fetch project details:", err);
    errorMsg = err.message;
  }

  // Find the specific project — URL param can be a UUID (new) or project_code (legacy fallback)
  const project = projects.find(p => p.id === projectId || p.project_code === projectId);
  
  // Filter tasks belonging to this project
  // New schema: tasks link via project_id (UUID). Legacy fallback: project_code.
  const projectTasks = allTasks.filter(t =>
    (project?.id && t.project_id === project.id) ||
    t.project_id === projectId ||
    (t as { project_code?: string }).project_code === project?.project_code
  );

  // If we can't figure out the relationship, we might just show an empty chart or all tasks as a fallback for demonstration
  // In a real scenario, the data structure MUST link tasks to projects.

  if (!project) { // เพิ่มเงื่อนไขนี้เพื่อตรวจสอบว่า project มีค่าหรือไม่
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
              Project Not Found
            </h1>
            <p className="text-slate-500 mt-1">The project with ID '{projectId}' could not be found.</p>
          </div>
        </div>
      </div>
    );
  }

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
        <AddTaskButton users={users} projectId={project?.id || projectId} />
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
