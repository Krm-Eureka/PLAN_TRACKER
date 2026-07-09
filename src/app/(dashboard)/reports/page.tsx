import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getSessionContext, filterProjectsByDepartment } from "@/lib/permissions";
import { fetchSheetData } from "@/lib/googleSheets";
import { ProjectData } from "@/interfaces";
import { ExportDepartmentPDFButton } from "@/components/projects/ExportDepartmentPDFButton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, PieChart, Activity, CheckCircle2, Clock, AlertTriangle, AlertCircle } from "lucide-react";

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
  if (!ctx) {
    return (
      <div className="flex h-[50vh] items-center justify-center text-slate-500">
        Unauthorized access.
      </div>
    );
  }

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
            <p className="text-slate-600">
              The Reports dashboard is restricted to Managers, Supervisors, and Directors.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  let filteredProjects: ProjectData[] = [];
  try {
    const rawProjects = await fetchSheetData(token, "Projects!A:Z");
    filteredProjects = await filterProjectsByDepartment(ctx, rawProjects as any[]);
  } catch (err) {
    console.error("Failed to fetch projects for report:", err);
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

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <PieChart className="w-6 h-6 text-indigo-600" />
            Department Reports
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Overview of {ctx.department || 'All'} department projects
          </p>
        </div>
        <ExportDepartmentPDFButton 
          projects={filteredProjects} 
          department={ctx.department || 'All'} 
          exporterName={user.name || user.email || 'Manager'}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-indigo-100 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500 mb-1">Total Projects</p>
                <p className="text-3xl font-bold text-slate-900">{total}</p>
              </div>
              <div className="p-3 bg-indigo-50 rounded-full text-indigo-600">
                <FileText className="w-6 h-6" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-emerald-100 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500 mb-1">Completed</p>
                <p className="text-3xl font-bold text-emerald-600">{done}</p>
              </div>
              <div className="p-3 bg-emerald-50 rounded-full text-emerald-600">
                <CheckCircle2 className="w-6 h-6" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-blue-100 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500 mb-1">In Progress</p>
                <p className="text-3xl font-bold text-blue-600">{inProgress}</p>
              </div>
              <div className="p-3 bg-blue-50 rounded-full text-blue-600">
                <Activity className="w-6 h-6" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-red-100 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500 mb-1">Overdue</p>
                <p className="text-3xl font-bold text-red-600">{overdue}</p>
              </div>
              <div className="p-3 bg-red-50 rounded-full text-red-600">
                <AlertTriangle className="w-6 h-6" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="bg-slate-50 border-b border-slate-100">
          <CardTitle className="text-lg">Generate Report</CardTitle>
          <CardDescription>
            Download a comprehensive PDF report containing all project details, statuses, and performance metrics for the {ctx.department || 'entire'} department.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          <div className="flex items-center justify-center p-8 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50">
            <div className="text-center max-w-md">
              <div className="mx-auto w-16 h-16 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mb-4">
                <FileText className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900 mb-2">Department PDF Report</h3>
              <p className="text-slate-500 text-sm mb-6">
                The report includes a performance summary and a detailed list of all {total} projects currently tracked in your department.
              </p>
              <ExportDepartmentPDFButton 
                projects={filteredProjects} 
                department={ctx.department || 'All'} 
                exporterName={user.name || user.email || 'Manager'}
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
