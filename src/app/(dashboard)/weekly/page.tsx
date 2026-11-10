import { redirect } from "next/navigation";
import { CalendarRange } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getSessionContext, filterByDepartment, filterProjectsByDepartment } from "@/lib/permissions";
import { WeeklyBoard } from "@/components/weekly/WeeklyBoard";
import type { BoardTask } from "@/utils/weeklyBoard";

export const dynamic = "force-dynamic";

export default async function WeeklyPage() {
  const ctx = await getSessionContext();
  if (!ctx) redirect("/auth/signin");

  const [tasksRaw, projectsRaw] = await Promise.all([
    prisma.task.findMany({
      select: {
        id: true,
        task_name: true,
        status: true,
        start_date: true,
        due_date: true,
        update_date: true,
        assignee_id: true,
        assignee_name: true,
        project_id: true,
      },
    }),
    prisma.project.findMany({
      select: { id: true, project_code: true, project_name: true, client_name: true, manager_id: true, department: true },
    }),
  ]);

  // สิทธิ์เดียวกับหน้าอื่น: เห็น task ถ้าเห็นโปรเจกต์ของมัน หรือ assignee อยู่ในขอบเขตที่เห็นได้
  const visibleProjects = await filterProjectsByDepartment(ctx, projectsRaw as unknown as Record<string, unknown>[]);
  const visibleProjectIds = new Set(visibleProjects.map((p) => String(p.id)));
  const visibleByAssignee = new Set(
    (await filterByDepartment(ctx, tasksRaw as unknown as Record<string, unknown>[], (t) => String(t.assignee_id || ""))).map(
      (t) => String(t.id)
    )
  );

  const projectById = new Map(projectsRaw.map((p) => [p.id, p]));
  const tasks: BoardTask[] = tasksRaw
    .filter((t) => visibleProjectIds.has(t.project_id) || visibleByAssignee.has(t.id))
    .map((t) => {
      const p = projectById.get(t.project_id);
      return {
        id: t.id,
        task_name: t.task_name,
        status: t.status,
        start_date: t.start_date,
        due_date: t.due_date,
        update_date: t.update_date,
        assignee_name: t.assignee_name,
        project_id: t.project_id,
        project_code: p?.project_code ?? null,
        project_name: p?.project_name ?? null,
        client_name: p?.client_name ?? null,
      };
    });

  return (
    <div className="space-y-4 animate-in fade-in duration-500">
      <div className="flex flex-col gap-1 print:hidden">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
          <CalendarRange className="w-7 h-7 text-emerald-600" />
          Weekly Board
        </h1>
        <p className="text-slate-500 text-sm">สัปดาห์นี้ใครทำอะไร — ทุกโปรเจกต์ในมุมมองเดียว</p>
      </div>
      <WeeklyBoard tasks={tasks} />
    </div>
  );
}
