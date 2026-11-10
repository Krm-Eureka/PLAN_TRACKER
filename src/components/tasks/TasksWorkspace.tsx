'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { TaskData, UserData } from '@/interfaces';
import { TasksTable } from '@/components/tasks/TasksTable';
import { KanbanBoard } from '@/components/kanban/KanbanBoard';
import { ListTodo, LayoutGrid } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TasksWorkspaceProps {
  tasks: TaskData[];
  users: UserData[];
  department: string;
}

type View = 'table' | 'board';

const VIEWS: { key: View; label: string; hint: string; icon: typeof ListTodo }[] = [
  { key: 'table', label: 'รายการ', hint: 'งานทั้งหมดที่คุณมีสิทธิ์เห็น', icon: ListTodo },
  { key: 'board', label: 'บอร์ดของฉัน', hint: 'เฉพาะงานที่คุณเป็นผู้รับผิดชอบ — ลากการ์ดเพื่อเปลี่ยนสถานะ', icon: LayoutGrid },
];

export function TasksWorkspace({ tasks, users, department }: TasksWorkspaceProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const currentView: View = searchParams?.get('view') === 'board' ? 'board' : 'table';
  const active = VIEWS.find(v => v.key === currentView)!;

  // replace แทน push: ไม่เพิ่มประวัติทุกครั้งที่สลับแท็บ และไม่เลื่อนหน้า
  const setView = (view: View) => {
    const params = new URLSearchParams(searchParams?.toString() || '');
    if (view === 'table') params.delete('view');
    else params.set('view', view);
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  return (
    <div className="space-y-3 h-[calc(100vh-140px)] flex flex-col">
      <div className="flex flex-wrap items-center gap-3 shrink-0">
        <div className="flex bg-slate-100/80 p-1.5 rounded-xl w-fit border border-slate-200/60 shadow-sm" role="tablist" aria-label="มุมมองงาน">
          {VIEWS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={currentView === key}
              onClick={() => setView(key)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-all duration-200",
                currentView === key
                  ? "bg-white text-emerald-700 shadow-sm ring-1 ring-emerald-500/20"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/50"
              )}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>
        <p className="text-xs text-slate-500">{active.hint}</p>
      </div>

      {/* แสดงเฉพาะมุมมองที่เลือก (เดิม mount ทั้งสองอันตลอด ทำให้ Kanban โหลดข้อมูลแม้ไม่ได้เปิด) */}
      <div className="flex-1 min-h-0 overflow-hidden" role="tabpanel">
        {currentView === 'table' ? (
          <div className="h-full overflow-y-auto pb-8">
            <TasksTable tasks={tasks} users={users} department={department} />
          </div>
        ) : (
          <div className="h-full min-h-0 overflow-hidden pt-1">
            <KanbanBoard />
          </div>
        )}
      </div>
    </div>
  );
}
