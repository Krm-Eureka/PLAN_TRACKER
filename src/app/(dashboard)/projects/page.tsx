// @ts-nocheck
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { prisma } from "@/lib/prisma"
import { getSessionContext, filterProjectsByDepartment } from "@/lib/permissions"
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

export const dynamic = 'force-dynamic';

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const session = await getSessionContext();
  const ctx = await getSessionContext();

  const params = await searchParams;
  const page = parseInt(params.page as string || "1", 10);
  const search = (params.search as string || "").toLowerCase();
  const filterDept = params.dept_filter as string | undefined;
  const limit = 50;

  let paginatedProjects: any[] = [];
  let users: any[] = [];
  let departments: any[] = [];
  let errorMsg = null;
  let totalPages = 1;

  try {
    if (!ctx) throw new Error("Unauthorized");

    const [rawProjects, fetchedUsers, fetchedDepts, rawTasks] = await Promise.all([
      prisma.project.findMany({
        orderBy: { created_at: 'desc' }
      }),
      prisma.user.findMany(),
      prisma.department.findMany(),
      prisma.task.findMany()
    ]);

    users = fetchedUsers;
    departments = fetchedDepts.map((dept: any) => ({
      id: dept.id,
      name: dept.department_name,
      department_id: dept.department_id
    }));

    // Convert dates to string to pass to Client Components
    const formattedProjects = rawProjects.map((proj: any) => ({
      ...proj,
      start_date: proj.start_date || "",
      end_date: proj.end_date || "",
      created_at: proj.created_at ? proj.created_at.toISOString() : "",
      updated_at: proj.updated_at ? proj.updated_at.toISOString() : "",
      project_email_update: proj.project_email_update || ""
    }));

    let filteredProjects = await filterProjectsByDepartment(ctx, formattedProjects) as any[];

    filteredProjects = filteredProjects.filter((proj: any) => proj.project_code !== 'NONE').map((proj: any) => {
      if (proj.end_date) {
        const statusLower = (proj.status || '').toLowerCase();
        const isCompleted = statusLower.includes('done') || statusLower.includes('complete') || statusLower.includes('cancel');
        if (!isCompleted) {
          const end = new Date(proj.end_date);
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          if (end < today) {
            proj.status = 'OVER DUE';
          }
        }
      }
      return proj;
    });

    if (search) {
      filteredProjects = filteredProjects.filter(p => 
        (p.project_name || "").toLowerCase().includes(search) || 
        (p.project_code || "").toLowerCase().includes(search) ||
        (p.client_name || "").toLowerCase().includes(search)
      );
    }

    if (filterDept) {
      const filterDeptObj = departments.find(d => d.id === filterDept);
      const filterDeptName = filterDeptObj ? filterDeptObj.name.toLowerCase() : "";

      const usersInDept = users.filter(u => u.department_id === filterDept || (filterDeptName && String(u.department_id).toLowerCase() === filterDeptName)).map(u => (u.email || "").toLowerCase());
      const usersInDeptSet = new Set(usersInDept);
      
      const userIdsInDeptSet = new Set<string>();
      users.forEach(u => {
        if (u.department_id === filterDept) {
          if (u.id) userIdsInDeptSet.add(String(u.id).toLowerCase());
          if (u.emp_id) userIdsInDeptSet.add(String(u.emp_id).toLowerCase());
        }
      });

      const projectIdsWithDeptTasks = new Set<string>();
      rawTasks.forEach(t => {
        if (!t.project_id) return;
        
        const assignees = String(t.assignee_id || "").split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
        const hasDeptAssignee = assignees.some(a => {
          if (a.includes('@')) return usersInDeptSet.has(a);
          return userIdsInDeptSet.has(a);
        });

        if (hasDeptAssignee) {
          projectIdsWithDeptTasks.add(String(t.project_id));
        }
      });
      
      filteredProjects = filteredProjects.filter(p => {
        if (p.department_id) {
           const pDepts = String(p.department_id).split(',').map(d => d.trim().toLowerCase());
           if (pDepts.includes(filterDept.toLowerCase()) || (filterDeptName && pDepts.includes(filterDeptName))) return true;
        }
        
        let managerEmail = String(p.manager_id || "").toLowerCase();
        if (managerEmail && !managerEmail.includes("@")) {
          const mUser = users.find(u => String(u.id) === managerEmail || String(u.emp_id) === managerEmail);
          if (mUser && mUser.email) managerEmail = mUser.email.toLowerCase();
        }
        if (managerEmail && usersInDeptSet.has(managerEmail)) return true;

        if (p.id && projectIdsWithDeptTasks.has(String(p.id))) return true;
        if (p.project_code && projectIdsWithDeptTasks.has(String(p.project_code))) return true;

        return false;
      });
    }

    const total = filteredProjects.length;
    totalPages = Math.ceil(total / limit);
    const offset = (page - 1) * limit;
    
    paginatedProjects = filteredProjects.slice(offset, offset + limit);
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
  }, {} as Record<string, any[]>);

  const sortedYears = Object.keys(groupedProjects).sort((a, b) => {
    if (a === 'Other') return 1;
    if (b === 'Other') return -1;
    return parseInt(b) - parseInt(a);
  });

  const roleSystem = (ctx?.role_system || "").toLowerCase();
  const isSuperAdminOnly = roleSystem === 'superadmin' || roleSystem === 'super admin';

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
        <AddProjectButton users={users} departments={departments} />
      </div>

      {isSuperAdminOnly && departments.length > 0 && (
        <div className="flex flex-wrap gap-2 items-center bg-slate-50/50 p-3 rounded-xl border border-slate-100">
          <span className="text-sm font-medium text-slate-500 mr-2">Filter by Department:</span>
          <Link href={`/projects${search ? `?search=${search}` : ''}`}>
            <Badge variant={!filterDept ? "default" : "outline"} className={`cursor-pointer px-3 py-1.5 text-sm rounded-full transition-colors ${!filterDept ? 'bg-slate-800 hover:bg-slate-900' : 'hover:bg-slate-100 text-slate-600'}`}>
              All Departments
            </Badge>
          </Link>
          {departments.map(dept => (
            <Link key={dept.id} href={`/projects?dept_filter=${dept.id}${search ? `&search=${search}` : ''}`}>
              <Badge variant={filterDept === dept.id ? "default" : "outline"} className={`cursor-pointer px-3 py-1.5 text-sm rounded-full transition-colors ${filterDept === dept.id ? 'bg-emerald-600 hover:bg-emerald-700' : 'hover:bg-slate-100 text-slate-600'}`}>
                {dept.name}
              </Badge>
            </Link>
          ))}
        </div>
      )}

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
              We couldn't find any projects matching your criteria.
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
              {groupedProjects[year].map((project: any, index: number) => {
                const projectId = project.project_code || `project-${index}`;
                const isOverdue = project.status === 'OVER DUE';
                return (
                  <Link href={`/projects/${encodeURIComponent(project.id)}`} key={project.id}>
                    <Card
                      className={`group overflow-hidden shadow-sm hover:shadow-xl transition duration-300 bg-white h-full relative ${
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
                            <EditProjectButton users={users} departments={departments} project={project} />
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
                                .filter(([k]) => !['id', 'project_code', 'project_name', 'status', 'start_date', 'end_date', 'color', 'created_at', 'updated_at', 'manager_id', 'department_id'].includes(k.toLowerCase()) && project[k] && project[k] !== '-')
                                .slice(0, 3)
                                .map(([key, value]) => {
                                  let displayValue = String(value);
                                  return (
                                    <div key={key} className="flex gap-2">
                                      <span className="font-medium text-slate-700 capitalize shrink-0">{key.replace(/_id$/, '').replace(/_/g, ' ')}:</span>
                                      <span className="truncate" title={displayValue}>{displayValue}</span>
                                    </div>
                                  );
                                })}
                                {project.manager_id && (
                                  <div className="flex gap-2">
                                    <span className="font-medium text-slate-700 capitalize shrink-0">Manager:</span>
                                    <span className="truncate">
                                      {(() => {
                                        const mUser = users.find(u => String(u.id) === project.manager_id || String(u.emp_id) === project.manager_id);
                                        return mUser ? (mUser.name_en || mUser.name_th || mUser.email) : project.manager_id;
                                      })()}
                                    </span>
                                  </div>
                                )}
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
