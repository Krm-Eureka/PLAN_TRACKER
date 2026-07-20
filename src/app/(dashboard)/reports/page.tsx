import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getSessionContext, filterProjectsByDepartment } from "@/lib/permissions";
import { fetchSheetData } from "@/lib/googleSheets";
import { ProjectData, TaskData } from "@/interfaces";
import { ExportDepartmentPDFButton } from "@/components/projects/ExportDepartmentPDFButton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, PieChart, Activity, CheckCircle2, AlertTriangle, AlertCircle, KanbanSquare } from "lucide-react";
import { TaskStatusPieChart } from "@/components/reports/TaskStatusPieChart";
import { ProjectBarChart } from "@/components/reports/ProjectBarChart";
import { filterTasks } from "@/utils/taskFilter";
import Link from "next/link";

export const dynamic = 'force-dynamic';

export default async function ReportsPage() {
  const session = await getServerSession(authOptions);
  const token = (session as { accessToken?: string })?.accessToken;
  const user = session?.user;

  if (!token || !user) {
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

  let filteredProjects: ProjectData[] = [];
  let tasks: TaskData[] = [];
  
  try {
    const [rawProjects, rawTasks] = await Promise.all([
      fetchSheetData(token, "Projects!A:Z"),
      fetchSheetData(token, "Tasks!A:Z")
    ]);
    filteredProjects = await filterProjectsByDepartment(ctx, rawProjects as any[]);
    
    // Filter tasks to only those belonging to the filtered projects
    const validProjectKeys = new Set(
      filteredProjects.flatMap(p => [p.id, p.project_code]).filter(Boolean)
    );
    tasks = (rawTasks as any[] || []).filter(t => 
      validProjectKeys.has(t.project_id) || validProjectKeys.has(t.project_code)
    );
  } catch (err) {
    console.error("Failed to fetch data for report:", err);
  }

  const total = filteredProjects.length;
  const done = filteredProjects.filter(p => (p.status || '').toLowerCase().includes('done') || (p.status || '').toLowerCase().includes('complete')).length;
  const inProgress = filteredProjects.filter(p => (p.status || '').toLowerCase().includes('progress') || (p.status || '').toLowerCase().includes('doing')).length;
  const overdue = filteredProjects.filter(p => {
    const s = (p.status || '').toLowerCase();
    if (s.includes('done') || s.includes('complete') || s.includes('cancel')) return false;
    if (p.end_date) {
      const due = new Date(p.end_date);
      due.setHours(0, 0, 0, 0);
      return due < new Date(new Date().setHours(0,0,0,0));
    }
    return false;
  }).length;

  // Chart Data Preparation
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
    { name: 'To Do', value: taskStatusCounts.todo, color: '#94a3b8' },
    { name: 'Hold', value: taskStatusCounts.hold, color: '#f59e0b' },
    { name: 'Review', value: taskStatusCounts.review, color: '#8b5cf6' }
  ].filter(d => d.value > 0);

  // Top 5 Projects by Task Count for Bar Chart
  const projectStats = filteredProjects.map(p => {
    const pTasks = tasks.filter(t => (t.project_code || t.project_id) === (p.project_code || p.project_id));
    let pComp = 0, pProg = 0, pOverdue = 0;
    pTasks.forEach(t => {
      const s = (t.status || '').toLowerCase();
      if (s.includes('done') || s.includes('complete')) pComp++;
      else if (s.includes('progress') || s.includes('review')) pProg++;
      else {
        // Check overdue
        const due = t.update_date || t.due_date;
        if (due) {
          const d = new Date(due);
          d.setHours(0,0,0,0);
          if (d < new Date(new Date().setHours(0,0,0,0))) pOverdue++;
        }
      }
    });
    return { name: p.project_name || p.project_code || 'Unknown', completed: pComp, inProgress: pProg, overdue: pOverdue, total: pTasks.length };
  }).sort((a, b) => b.total - a.total).slice(0, 7); // Show top 7

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-700">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <PieChart className="w-8 h-8 text-indigo-600" />
            Reports & Analytics
          </h1>
          <p className="text-slate-500 mt-1">
            Overview of {ctx.department || 'All'} department projects and tasks
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/board" className="flex items-center gap-2 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 px-4 py-2 rounded-lg font-medium transition-colors shadow-sm">
            <KanbanSquare className="w-4 h-4" /> Board
          </Link>
          <ExportDepartmentPDFButton 
            projects={filteredProjects} 
            department={ctx.department || 'All'} 
            exporterName={user.name || user.email || 'Manager'}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-indigo-100 shadow-sm">
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500 mb-1">Total Projects</p>
                <p className="text-3xl font-bold text-slate-900">{total}</p>
              </div>
              <div className="p-3 bg-indigo-50 rounded-full text-indigo-600 hidden sm:block">
                <FileText className="w-6 h-6" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-emerald-100 shadow-sm">
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500 mb-1">Completed</p>
                <p className="text-3xl font-bold text-emerald-600">{done}</p>
              </div>
              <div className="p-3 bg-emerald-50 rounded-full text-emerald-600 hidden sm:block">
                <CheckCircle2 className="w-6 h-6" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-blue-100 shadow-sm">
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500 mb-1">In Progress</p>
                <p className="text-3xl font-bold text-blue-600">{inProgress}</p>
              </div>
              <div className="p-3 bg-blue-50 rounded-full text-blue-600 hidden sm:block">
                <Activity className="w-6 h-6" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-red-100 shadow-sm">
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500 mb-1">Overdue</p>
                <p className="text-3xl font-bold text-red-600">{overdue}</p>
              </div>
              <div className="p-3 bg-red-50 rounded-full text-red-600 hidden sm:block">
                <AlertTriangle className="w-6 h-6" />
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
