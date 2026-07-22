// @ts-nocheck
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { prisma } from "@/lib/prisma"
import { getSessionContext } from "@/lib/permissions"
import { FolderKanban, ArrowLeft, AlertCircle } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { GanttChart } from "@/components/projects/GanttChart"
import { AddTaskButton } from "@/components/projects/AddTaskButton"
import { EditProjectButton } from "@/components/projects/EditProjectButton"
import { DeleteProjectButton } from "@/components/projects/DeleteProjectButton"
import { RescheduleProjectButton } from "@/components/projects/RescheduleProjectButton"
import { Pagination } from "@/components/ui/Pagination"

import { calculateProjectProgress } from "@/utils/progress"

export const dynamic = 'force-dynamic';

export default async function ProjectDetailsPage({ 
  params,
  searchParams
}: { 
  params: Promise<{ id: string }>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const resolvedParams = await params;
  const session = await getServerSession(authOptions);
  const ctx = await getSessionContext();
  const projectId = decodeURIComponent(resolvedParams.id);

  const sp = await searchParams;
  const page = parseInt(sp.page as string || "1", 10);
  const limit = 100; // Limit tasks to 100 per page to keep Gantt Chart performant

  let project: any = null;
  let allTasks: any[] = [];
  let users: any[] = [];
  let departments: { id: string, name: string }[] = [];
  let errorMsg = null;

  try {
    if (!ctx) throw new Error("Unauthorized");

    const fetchedProject = await prisma.project.findFirst({
      where: {
        OR: [
          { id: projectId },
          { project_code: projectId }
        ]
      }
    });

    if (fetchedProject) {
      const [fetchedTasks, fetchedUsers, fetchedDepartments] = await Promise.all([
        prisma.task.findMany({
          where: { project_id: fetchedProject.id },
          orderBy: { created_at: 'asc' }
        }),
        prisma.user.findMany(),
        prisma.department.findMany()
      ]);

      // Sort by task_order manually since it's a string, or rely on created_at
      fetchedTasks.sort((a: any, b: any) => {
        const orderA = a.task_order || '';
        const orderB = b.task_order || '';
        if (!orderA && !orderB) return 0;
        if (!orderA) return 1;
        if (!orderB) return -1;
        return orderA.localeCompare(orderB, undefined, { numeric: true, sensitivity: 'base' });
      });

      project = {
        ...fetchedProject,
        start_date: fetchedProject.start_date || "",
        end_date: fetchedProject.end_date || "",
        created_at: fetchedProject.created_at ? fetchedProject.created_at.toISOString() : "",
        updated_at: fetchedProject.updated_at ? fetchedProject.updated_at.toISOString() : "",
        project_email_update: fetchedProject.project_email_update || ""
      };

      allTasks = fetchedTasks.map((task: any) => ({
        ...task,
        start_date: task.start_date || "",
        due_date: task.due_date || "",
        created_at: task.created_at ? task.created_at.toISOString() : "",
        updated_at: task.updated_at ? task.updated_at.toISOString() : "",
      }));

      users = fetchedUsers;
      departments = fetchedDepartments.map((dept: any) => ({
        id: dept.id,
        name: dept.department_name || dept.name || "",
        department_id: dept.department_id
      }));
    }
  } catch (error: unknown) {
    const err = error as Error;
    console.error("Failed to fetch project details:", err);
    errorMsg = err.message;
  }

  const projectTasks = allTasks;

  // Calculate overall project progress before pagination
  let projectProgress = 0;
  if (projectTasks && projectTasks.length > 0) {
    projectProgress = calculateProjectProgress(projectTasks);
  }

  // Paginate tasks
  const totalTasks = projectTasks.length;
  const totalPages = Math.ceil(totalTasks / limit);
  const offset = (page - 1) * limit;
  const paginatedTasks = projectTasks.slice(offset, offset + limit);

  if (!project) {
    return (
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
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
              <FolderKanban className="w-8 h-8 text-emerald-600" />
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
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
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
            <FolderKanban className="w-8 h-8 text-emerald-600" />
            {project?.project_name || projectId}
            <span className="ml-2 text-xl font-bold px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200 shadow-sm">
              {projectProgress}%
            </span>
          </h1>
          <p className="text-slate-500 mt-1">Project timeline and tasks schedule</p>
        </div>
        <div className="flex gap-2 mt-4 sm:mt-0 flex-wrap">
          <RescheduleProjectButton project={project} />
          <EditProjectButton users={users} departments={departments} project={project} />
          <DeleteProjectButton project={project} />
          <AddTaskButton 
            users={users} 
            projectId={(project.id as string) || projectId} 
            projectDepartment={project.department_id as string}
            tasks={paginatedTasks}
          />
        </div>
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
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden p-6">
            <GanttChart tasks={paginatedTasks} project={project} users={users} />
          </div>
          
          {totalPages > 1 && (
            <div className="flex justify-between items-center bg-white px-4 py-2 rounded-xl border border-slate-200 shadow-sm">
              <div className="text-sm text-slate-500 font-medium">
                Showing {offset + 1}-{Math.min(offset + limit, totalTasks)} of {totalTasks} tasks
              </div>
              <Pagination currentPage={page} totalPages={totalPages} />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
