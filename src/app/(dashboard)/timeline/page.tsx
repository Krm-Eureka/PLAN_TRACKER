import { redirect } from "next/navigation";
import { GanttChartSquare } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getSessionContext, filterProjectsByDepartment } from "@/lib/permissions";
import { calculateProjectProgress, isProjectOverdue } from "@/utils/status";
import { ProjectTimeline, type TimelineProject } from "@/components/timeline/ProjectTimeline";
import type { TaskData } from "@/interfaces";

export const dynamic = "force-dynamic";

export default async function TimelinePage() {
  const ctx = await getSessionContext();
  if (!ctx) redirect("/auth/signin");

  const [projectsRaw, tasksRaw, users] = await Promise.all([
    prisma.project.findMany({
      select: {
        id: true, project_code: true, project_name: true, client_name: true, manager_id: true,
        department: true, start_date: true, end_date: true, status: true, priority: true,
      },
    }),
    prisma.task.findMany({
      select: { id: true, project_id: true, status: true, percent_complete: true, parent_task_id: true },
    }),
    prisma.user.findMany({ select: { id: true, name_en: true, name_th: true } }),
  ]);

  const visible = (await filterProjectsByDepartment(ctx, projectsRaw as unknown as Record<string, unknown>[])) as unknown as typeof projectsRaw;

  const tasksByProject = new Map<string, TaskData[]>();
  for (const t of tasksRaw) {
    const list = tasksByProject.get(t.project_id) ?? [];
    list.push(t as unknown as TaskData);
    tasksByProject.set(t.project_id, list);
  }
  const userName = new Map(users.map((u) => [u.id, u.name_en || u.name_th || ""]));

  const projects: TimelineProject[] = visible
    .filter((p) => p.start_date || p.end_date)
    .map((p) => {
      const tasks = tasksByProject.get(p.id) ?? [];
      return {
        id: p.id,
        code: p.project_code,
        name: p.project_name,
        client: p.client_name,
        manager: p.manager_id ? userName.get(p.manager_id) || null : null,
        start: (p.start_date || p.end_date || "").slice(0, 10),
        end: (p.end_date || p.start_date || "").slice(0, 10),
        status: p.status,
        priority: p.priority,
        progress: tasks.length > 0 ? calculateProjectProgress(tasks) : 0,
        taskCount: tasks.length,
        overdue: isProjectOverdue(p.status, p.end_date),
      };
    });

  return (
    <div className="space-y-4 animate-in fade-in duration-500">
      <div className="flex flex-col gap-1 print:hidden">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
          <GanttChartSquare className="w-7 h-7 text-emerald-600" />
          Project Timeline
        </h1>
        <p className="text-slate-500 text-sm">ทุกโปรเจกต์บนแกนเวลาเดียวกัน — เห็นงานซ้อน ช่วงว่าง และโปรเจกต์ที่เลยกำหนด</p>
      </div>
      <ProjectTimeline projects={projects} />
    </div>
  );
}
