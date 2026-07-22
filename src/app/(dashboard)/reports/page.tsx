// @ts-nocheck
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { getSessionContext, filterProjectsByDepartment } from "@/lib/permissions";
import { ExportDepartmentPDFButton } from "@/components/projects/ExportDepartmentPDFButton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, PieChart, Activity, CheckCircle2, AlertTriangle, AlertCircle, PauseCircle } from "lucide-react";
import { TaskStatusPieChart } from "@/components/reports/TaskStatusPieChart";
import { ProjectBarChart } from "@/components/reports/ProjectBarChart";

export const dynamic = 'force-dynamic';

export default async function ReportsPage() {
  const session = await getServerSession(authOptions);
  const user = session?.user;

  if (!user) {
    return (
      <div className="flex h-[50vh] items-center justify-center text-slate-500">
        Please sign in to view reports.
      </div>
    );
  }

  const ctx = await getSessionContext();
  if (!ctx) return <div className="flex h-[50vh] items-center justify-center text-slate-500">Unauthorized access.</div>;

  const isManagerOrHigher = ctx.isAdmin ||
    (ctx.role_system || "").toLowerCase().includes("manager") ||
    (ctx.role_system || "").toLowerCase().includes("md") ||
    (ctx.role_system || "").toLowerCase().includes("director") ||
    (ctx.role_system || "").toLowerCase().includes("supervisor");

  if (!isManagerOrHigher) {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <Card className="border-slate-200 bg-red-50/50 shadow-sm">
          <CardContent className="flex flex-col items-center justify-center p-12 text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
            <h2 className="text-xl font-bold text-slate-800 mb-2">Access Denied</h2>
            <p className="text-slate-600">The Reports dashboard is restricted to Managers, Supervisors, and Directors.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  let filteredProjects: any[] = [];
  let tasks: any[] = [];
  let rawUsers: any[] = [];
  let departments: any[] = [];

  try {
    const [rawProjects, rawTasks, fetchedUsers, fetchedDepts] = await Promise.all([
      prisma.project.findMany({ orderBy: { created_at: 'desc' } }),
      prisma.task.findMany(),
      prisma.user.findMany(),
      prisma.department.findMany()
    ]);

    rawUsers = fetchedUsers;
    departments = fetchedDepts.map((dept: any) => ({
      id: dept.id,
      department_id: dept.department_id,
      department_name: dept.department_name,
      name: dept.department_name
    }));

    // Serialize dates for client
    const formattedProjects = rawProjects.map((proj: any) => ({
      ...proj,
      start_date: proj.start_date || "",
      end_date: proj.end_date || "",
      created_at: proj.created_at ? proj.created_at.toISOString() : "",
      updated_at: proj.updated_at ? proj.updated_at.toISOString() : "",
    }));

    filteredProjects = await filterProjectsByDepartment(ctx, formattedProjects);

    const validProjectIds = new Set(filteredProjects.map((proj: any) => String(proj.id)));
    tasks = rawTasks.filter((rawTask: any) => rawTask.project_id && validProjectIds.has(rawTask.project_id)).map((rawTask: any) => ({
      ...rawTask,
      start_date: rawTask.start_date || "",
      due_date: rawTask.due_date || "",
      created_at: rawTask.created_at ? rawTask.created_at.toISOString() : "",
      updated_at: rawTask.updated_at ? rawTask.updated_at.toISOString() : "",
    }));
  } catch (err) {
    console.error("Failed to fetch data for report:", err);
  }

  let myDept = ctx.department;
  if (!myDept && user?.email) {
    const me = rawUsers.find(u => (u.email || '').toLowerCase() === user.email?.toLowerCase());
    if (me) myDept = me.department_id || '';
  }
  let myDeptName = myDept;
  if (myDept && myDept !== 'All') {
    const deptInfo = departments.find(d => d.id === myDept || d.department_id === myDept);
    if (deptInfo && deptInfo.department_name) myDeptName = deptInfo.department_name;
  }

  const totalProjects = filteredProjects.length;
  const completedProjects = filteredProjects.filter(p => (p.status || '').toLowerCase().includes('done') || (p.status || '').toLowerCase().includes('complete')).length;
  const inProgressProjects = filteredProjects.filter(p => (p.status || '').toLowerCase().includes('progress') || (p.status || '').toLowerCase().includes('doing')).length;
  
  // Tasks breakdown
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter(t => (t.status || '').toLowerCase().includes('done') || (t.status || '').toLowerCase().includes('complete')).length;
  const inProgressTasks = tasks.filter(t => (t.status || '').toLowerCase().includes('progress') || (t.status || '').toLowerCase().includes('doing')).length;
  const holdTasks = tasks.filter(t => (t.status || '').toLowerCase().includes('hold')).length;
  
  // Overdue = tasks whose due_date is past today, and status is NOT Done / Cancel / Hold!
  const overdueTasks = tasks.filter(t => {
    const s = (t.status || '').toLowerCase();
    if (s.includes('done') || s.includes('complete') || s.includes('cancel') || s.includes('hold')) return false;
    const due = t.update_date || t.due_date;
    if (due) {
      const d = new Date(due); d.setHours(0, 0, 0, 0);
      return d < new Date(new Date().setHours(0, 0, 0, 0));
    }
    return false;
  }).length;

  // Chart Data
  const taskStatusCounts = { todo: 0, inProgress: 0, review: 0, done: 0, hold: 0, cancel: 0 };
  tasks.forEach(t => {
    const s = (t.status || 'to do').toLowerCase();
    if (s.includes('progress')) taskStatusCounts.inProgress++;
    else if (s.includes('review')) taskStatusCounts.review++;
    else if (s.includes('done') || s.includes('complete')) taskStatusCounts.done++;
    else if (s.includes('hold')) taskStatusCounts.hold++;
    else if (s.includes('cancel')) taskStatusCounts.cancel++;
    else taskStatusCounts.todo++;
  });

  const pieData = [
    { name: 'Done', value: taskStatusCounts.done, color: '#10b981' },
    { name: 'In Progress', value: taskStatusCounts.inProgress, color: '#3b82f6' },
    { name: 'Review', value: taskStatusCounts.review, color: '#8b5cf6' },
    { name: 'To Do', value: taskStatusCounts.todo, color: '#94a3b8' },
    { name: 'On Hold', value: taskStatusCounts.hold, color: '#f59e0b' },
    { name: 'Overdue', value: overdueTasks, color: '#ef4444' }
  ].filter(d => d.value > 0);

  const projectStats = filteredProjects.map(p => {
    const pTasks = tasks.filter(t => t.project_id === p.id);
    let pComp = 0, pCompLate = 0, pProg = 0, pOverdue = 0, pHold = 0, pTodo = 0;
    pTasks.forEach(t => {
      const s = (t.status || '').toLowerCase();
      if (s.includes('done') || s.includes('complete')) {
        const due = t.due_date;
        const end = t.update_date;
        let isLate = false;
        if (due && end) {
          const dDue = new Date(due); dDue.setHours(23, 59, 59, 999);
          const dEnd = new Date(end); dEnd.setHours(23, 59, 59, 999);
          if (dEnd > dDue) isLate = true;
        }
        if (isLate) pCompLate++; else pComp++;
      } else if (s.includes('hold')) {
        pHold++;
      } else if (s.includes('cancel')) {
        // ignore
      } else {
        const due = t.update_date || t.due_date;
        let isOverdue = false;
        if (due) {
          const d = new Date(due); d.setHours(0, 0, 0, 0);
          if (d < new Date(new Date().setHours(0, 0, 0, 0))) isOverdue = true;
        }
        if (isOverdue) pOverdue++;
        else if (s.includes('progress') || s.includes('review')) pProg++;
        else pTodo++;
      }
    });
    return { name: p.project_code || p.project_name || 'Unknown', completed: pComp, completedLate: pCompLate, inProgress: pProg, overdue: pOverdue, hold: pHold, todo: pTodo, total: pTasks.length };
  }).sort((a, b) => b.total - a.total).slice(0, 7);

  return (
    <div className="p-4 sm:p-6 max-w-[2000px] mx-auto space-y-6 animate-in fade-in duration-700">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <PieChart className="w-8 h-8 text-indigo-600" />
            Reports & Analytics
          </h1>
          <p className="text-slate-500 mt-1">
            {(!myDeptName || myDeptName === 'All') 
              ? 'Overview of all projects and tasks across all departments'
              : `Overview of ${myDeptName} department projects and tasks`}
          </p>
        </div>
        <div className="flex gap-2">
          <ExportDepartmentPDFButton
            projects={filteredProjects}
            users={rawUsers as any[]}
            department={myDeptName || 'All'}
            exporterName={user.name || user.email || 'Manager'}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {/* 1. Total Projects / Tasks */}
        <Card className="border-indigo-100 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-500 mb-1">Total Projects / Tasks</p>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-2xl font-bold text-slate-900">{totalProjects}</span>
                  <span className="text-[11px] font-semibold text-slate-500">proj ({totalTasks} tasks)</span>
                </div>
              </div>
              <div className="p-2.5 bg-indigo-50 rounded-full text-indigo-600 hidden xl:block">
                <FileText className="w-5 h-5" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 2. Completed Tasks */}
        <Card className="border-emerald-100 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-500 mb-1">Completed Tasks</p>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-2xl font-bold text-emerald-600">{completedTasks}</span>
                  <span className="text-[11px] text-slate-400">/ {totalTasks} tasks ({completedProjects} proj)</span>
                </div>
              </div>
              <div className="p-2.5 bg-emerald-50 rounded-full text-emerald-600 hidden xl:block">
                <CheckCircle2 className="w-5 h-5" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 3. In Progress Tasks */}
        <Card className="border-blue-100 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-500 mb-1">In Progress Tasks</p>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-2xl font-bold text-blue-600">{inProgressTasks}</span>
                  <span className="text-[11px] text-slate-400">/ {totalTasks} tasks ({inProgressProjects} proj)</span>
                </div>
              </div>
              <div className="p-2.5 bg-blue-50 rounded-full text-blue-600 hidden xl:block">
                <Activity className="w-5 h-5" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 4. On Hold Tasks */}
        <Card className="border-amber-100 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-amber-700 mb-1">On Hold Tasks</p>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-2xl font-bold text-amber-600">{holdTasks}</span>
                  <span className="text-[11px] text-amber-600/70">paused indefinitely</span>
                </div>
              </div>
              <div className="p-2.5 bg-amber-50 rounded-full text-amber-600 hidden xl:block">
                <PauseCircle className="w-5 h-5" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 5. Overdue Tasks */}
        <Card className="border-rose-100 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-rose-700 mb-1">Overdue Tasks</p>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-2xl font-bold text-rose-600">{overdueTasks}</span>
                  <span className="text-[11px] text-rose-500">past due date</span>
                </div>
              </div>
              <div className="p-2.5 bg-rose-50 rounded-full text-rose-600 hidden xl:block">
                <AlertTriangle className="w-5 h-5" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="border-slate-200 shadow-sm col-span-1">
          <CardHeader>
            <CardTitle className="text-base sm:text-lg">Tasks Status Overview</CardTitle>
            <CardDescription>Breakdown of all {tasks.length} tasks in department</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px]">
            <TaskStatusPieChart data={pieData} />
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm col-span-1 lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base sm:text-lg">Top Projects Workload</CardTitle>
            <CardDescription>Tasks completion vs overdue across top active projects</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ProjectBarChart data={projectStats} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
