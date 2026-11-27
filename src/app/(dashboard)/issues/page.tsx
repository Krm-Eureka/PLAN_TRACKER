import { redirect } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { prisma } from "@/lib/prisma";
import {
  getSessionContext,
  filterProjectsByDepartment,
} from "@/lib/permissions";
import {
  IssueListSection,
  type IssueItem,
  type IssueProjectOption,
} from "@/components/issues/IssueListSection";

export const dynamic = "force-dynamic";

export default async function IssuesPage() {
  const ctx = await getSessionContext();
  if (!ctx) redirect("/auth/signin");

  const allProjects = await prisma.project.findMany({
    select: {
      id: true,
      project_code: true,
      project_name: true,
      manager_id: true,
      department: true,
      status: true,
    },
    orderBy: { project_code: "asc" },
  });

  const visibleProjects = await filterProjectsByDepartment(
    ctx,
    allProjects as unknown as Record<string, unknown>[]
  );
  const visibleProjectIds = visibleProjects.map((p) => String(p.id));

  const issuesRaw =
    visibleProjectIds.length > 0
      ? await prisma.projectIssue.findMany({
          where: { project_id: { in: visibleProjectIds } },
          include: {
            project: {
              select: { id: true, project_code: true, project_name: true },
            },
          },
          orderBy: { created_at: "desc" },
        })
      : [];

  const issues: IssueItem[] = issuesRaw.map((i) => ({
    id: i.id,
    issue_code: i.issue_code,
    project_id: i.project_id,
    project_code: i.project.project_code,
    project_name: i.project.project_name,
    reporter_name: i.reporter_name,
    description: i.description,
    status: i.status,
    source: i.source,
    created_at: i.created_at.toISOString(),
    resolved_at: i.resolved_at ? i.resolved_at.toISOString() : null,
  }));

  const projectOptions: IssueProjectOption[] = visibleProjects.map((p) => ({
    id: String(p.id),
    project_code: String(p.project_code || ""),
    project_name: String(p.project_name || ""),
  }));

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
          <AlertTriangle className="w-7 h-7 text-emerald-600" />
          Issue Log
        </h1>
        <p className="text-slate-500 text-sm">
          รายการปัญหาแยกตามโปรเจกต์ (รับแจ้งจาก LINE OA และเว็บ โดยไม่กระทบวันที่ใน Master Plan)
        </p>
      </div>

      <IssueListSection
        initialIssues={issues}
        projects={projectOptions}
        groupByProject
      />
    </div>
  );
}
