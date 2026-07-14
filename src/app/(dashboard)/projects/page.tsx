import { getServerSession } from "next-auth/next"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { fetchTeamWorkload } from "@/services/api"
import { fetchSheetData } from "@/lib/googleSheets"
import { getSessionContext, filterProjectsByDepartment } from "@/lib/permissions"
import { unstable_cache } from "next/cache"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { FolderKanban, Calendar, Clock, AlertCircle } from "lucide-react"

import Link from "next/link"
import { AddProjectButton } from "@/components/projects/AddProjectButton"
import { EditProjectButton } from "@/components/projects/EditProjectButton"
import { DeleteProjectButton } from "@/components/projects/DeleteProjectButton"
import { getStatusColor } from "@/utils"
import { formatDateDDMMYYYY, parseSafeDate } from "@/utils/date"
import { Pagination } from "@/components/ui/Pagination"

import { ProjectData, UserData } from "@/interfaces"

const getCachedProjectsRaw = unstable_cache(
  async (token: string) => await fetchSheetData(token, "Projects!A1:Z"),
  ['all-projects-raw'],
  { tags: ['projects'], revalidate: 3600 }
);

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const session = await getServerSession(authOptions);
  const token = (session as { accessToken?: string })?.accessToken;
  const ctx = await getSessionContext();

  const params = await searchParams;
  const page = parseInt(params.page as string || "1", 10);
  const search = (params.search as string || "").toLowerCase();
  const limit = 50; // Set limit to 50 items per page

  let paginatedProjects: ProjectData[] = [];
  let users: UserData[] = [];
  let errorMsg = null;
  let totalPages = 1;

  try {
    if (!token || !ctx) throw new Error("Unauthorized");

    const [rawProjects, fetchedUsers] = await Promise.all([
      getCachedProjectsRaw(token),
      fetchTeamWorkload(token).catch(() => [])
    ]);

    let filteredProjects = await filterProjectsByDepartment(ctx, rawProjects) as unknown as ProjectData[];

    filteredProjects = filteredProjects.filter((p: ProjectData) => p.project_code !== 'NONE').map((p: ProjectData) => {
      if (p.end_date) {
        const statusLower = (p.status || '').toLowerCase();
        const isCompleted = statusLower.includes('done') || statusLower.includes('complete') || statusLower.includes('cancel');
        if (!isCompleted) {
          const end = new Date(p.end_date);
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          if (end < today) {
            p.status = 'OVER DUE';
          }
        }
      }
      return p;
    }).reverse(); // newest first

    if (search) {
      filteredProjects = filteredProjects.filter(p => 
        (p.project_name || "").toLowerCase().includes(search) || 
        (p.project_code || "").toLowerCase().includes(search) ||
        (p.client_name || "").toLowerCase().includes(search)
      );
    }

    const total = filteredProjects.length;
    totalPages = Math.ceil(total / limit);
    const offset = (page - 1) * limit;
    
    paginatedProjects = filteredProjects.slice(offset, offset + limit);
    users = fetchedUsers;
  } catch (error: unknown) {
    const err = error as Error;
    console.error("Failed to fetch projects:", err);
    errorMsg = err.message;
  }

  const groupedProjects = paginatedProjects.reduce((acc, project) => {
    let year = '';
    const match = (project.project_code || '').match(/^(\d{2})/);
    if (match) {
      year = `20${match[1]}`;
    } else {
      const d = parseSafeDate(project.start_date);
      year = d ? d.getFullYear().toString() : 'Other';
    }
    if (!acc[year]) acc[year] = [];
    acc[year].push(project);
    return acc;
  }, {} as Record<string, ProjectData[]>);

  const sortedYears = Object.keys(groupedProjects).sort((a, b) => {
    if (a === 'Other') return 1;
    if (b === 'Other') return -1;
    return parseInt(b) - parseInt(a);
  });

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <FolderKanban className="w-8 h-8 text-emerald-600" />
            Projects Portfolio
          </h1>
          <p className="text-slate-500 mt-1">Manage and track all ongoing IT projects.</p>
        </div>
        <AddProjectButton users={users} />
      </div>

      {errorMsg && (
        <div className="bg-red-50 text-red-600 p-4 rounded-xl border border-red-100 flex items-start gap-3 shadow-sm">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold">Failed to load projects</h3>
            <p className="text-sm mt-1">{errorMsg}</p>
          </div>
        </div>
      )}

      {!errorMsg && paginatedProjects.length === 0 && (
        <Card className="border-dashed border-2 bg-slate-50/50">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
              <FolderKanban className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900">No Projects Found</h3>
            <p className="text-slate-500 mt-1 max-w-sm">
              We couldn&apos;t find any projects in your Google Sheet, or the data format doesn&apos;t match.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="space-y-10">
        {sortedYears.map(year => (
          <div key={year} className="space-y-4">
            <div className="flex items-center gap-4">
              <h3 className="text-xl font-bold text-slate-800 shrink-0">{year}</h3>
              <div className="h-[2px] bg-emerald-100 flex-1"></div>
            </div>
            <div className="grid gap-6 grid-cols-[repeat(auto-fill,minmax(350px,1fr))]">
              {groupedProjects[year].map((project, index) => {
                const projectId = project.project_code || `project-${index}`;
                const isOverdue = project.status === 'OVER DUE';
                return (
                  <Link href={`/projects/${encodeURIComponent(projectId)}`} key={projectId}>
                    <Card
                      className={`group overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 bg-white h-full relative ${
                        isOverdue 
                          ? 'border-2 border-rose-500 shadow-rose-100 hover:border-rose-600' 
                          : 'border border-slate-200/60 hover:border-emerald-200/60'
                      }`}
                    >
                      {project.color && (
                        <>
                          <div 
                            className="absolute top-0 left-0 w-full h-1.5 opacity-90 group-hover:opacity-100 transition-opacity z-10" 
                            style={{ backgroundColor: project.color as string }}
                          ></div>
                          <div 
                            className="absolute top-0 left-0 w-full h-24 opacity-[0.08] group-hover:opacity-[0.12] transition-opacity pointer-events-none z-0" 
                            style={{ background: `linear-gradient(to bottom, ${project.color}, transparent)` }}
                          ></div>
                        </>
                      )}
                      {isOverdue && (
                        <div className="bg-rose-500 text-white text-[11px] font-bold px-3 py-1.5 flex items-center justify-center gap-1.5 shadow-sm relative z-10">
                          <AlertCircle className="w-3.5 h-3.5 animate-pulse" />
                          โปรเจกต์ล่าช้า! โปรดเร่งติดตามความคืบหน้าด่วน
                        </div>
                      )}
                      <CardHeader className="pb-4 relative pt-5 z-10">
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex gap-2">
                            <Badge variant="outline" className="font-mono text-xs text-emerald-600 bg-emerald-50 border-emerald-100">
                              {project.project_code || 'N/A'}
                            </Badge>
                            <Badge className={`px-2.5 py-0.5 font-medium transition-colors ${getStatusColor(project.status)}`}>
                              {project.status || 'Unknown'}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-1 z-10 relative">
                            <EditProjectButton users={users} project={project} />
                            <DeleteProjectButton project={project} iconOnly />
                          </div>
                        </div>
                        <div className="min-h-[56px] flex flex-col justify-start">
                          <div className="relative inline-block w-fit">
                            <CardTitle 
                              className="text-xl leading-tight group-hover:text-emerald-700 transition-colors pb-1 line-clamp-2 text-slate-800"
                              title={project.project_name || 'Untitled Project'}
                            >
                              {project.project_name || 'Untitled Project'}
                            </CardTitle>
                            <div 
                              className={`absolute bottom-0 left-0 w-full h-0.5 transform origin-left scale-x-0 group-hover:scale-x-100 transition-transform duration-500 ${project.color ? '' : 'bg-gradient-to-r from-emerald-500 to-purple-500'}`}
                              style={project.color ? { backgroundColor: project.color as string } : {}}
                            ></div>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          <div className="grid grid-cols-2 gap-3 text-sm">
                            {project.start_date && (
                              <div className="flex items-center gap-2 text-slate-600 bg-slate-50 p-2 rounded-lg">
                                <Calendar className="w-4 h-4 text-slate-400" />
                                <div>
                                  <p className="text-[10px] uppercase font-semibold text-slate-400">Start</p>
                                  <p className="font-medium">{formatDateDDMMYYYY(project.start_date) || project.start_date}</p>
                                </div>
                              </div>
                            )}
                            {project.end_date && (
                              <div className={`flex items-center gap-2 p-2 rounded-lg ${isOverdue ? 'bg-rose-50 text-rose-700' : 'bg-slate-50 text-slate-600'}`}>
                                <Clock className={`w-4 h-4 ${isOverdue ? 'text-rose-500 animate-[bounce_2s_infinite]' : 'text-slate-400'}`} />
                                <div>
                                  <p className={`text-[10px] uppercase font-semibold ${isOverdue ? 'text-rose-500' : 'text-slate-400'}`}>Target</p>
                                  <p className="font-medium">{formatDateDDMMYYYY(project.end_date) || project.end_date}</p>
                                </div>
                              </div>
                            )}
                          </div>
                          <div className="pt-2 border-t border-slate-100">
                            <div className="text-xs text-slate-500 space-y-1.5 line-clamp-3">
                              {Object.entries(project)
                                .filter(([k]) => !['id', 'project_code', 'project_name', 'status', 'start_date', 'end_date', 'color'].includes(k.toLowerCase()) && project[k] && project[k] !== '-')
                                .slice(0, 3)
                                .map(([key, value]) => {
                                  let displayValue = String(value);
                                  if (key.toLowerCase() === 'manager_id') {
                                    let managerFound = false;
                                    if (users) {
                                      const manager = users.find(u => u.email === value || u.id === value || String(u.emp_id) === String(value));
                                      if (manager) {
                                        displayValue = manager.name_en || manager.name_th || displayValue;
                                        managerFound = true;
                                      }
                                    }
                                    if (!managerFound && typeof displayValue === 'string' && displayValue.length > 20 && displayValue.includes('-')) {
                                      displayValue = 'Unknown Manager';
                                    }
                                  }
                                  return (
                                    <div key={key} className="flex gap-2">
                                      <span className="font-medium text-slate-700 capitalize shrink-0">{key.replace(/_id$/, '').replace(/_/g, ' ')}:</span>
                                      <span className="truncate" title={displayValue}>{displayValue}</span>
                                    </div>
                                  );
                                })}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </div>
      
      {totalPages > 1 && (
        <Pagination currentPage={page} totalPages={totalPages} />
      )}
    </div>
  )
}
