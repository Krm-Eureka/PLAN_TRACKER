import React from 'react';
import { Task } from 'gantt-task-react';
import { ChevronDown, ChevronRight, Clock } from 'lucide-react';
import { getStatusColor } from '@/utils/status';
import { TaskData } from '@/interfaces';

type ExtendedTask = Task & {
  originalStatus?: string;
  isOverdue?: boolean;
  isCancelled?: boolean;
  duration?: number;
  assignee?: string;
  task_order?: string;
  priority?: string;
};

interface GanttTaskListTableProps {
  rowHeight: number;
  tasks: ExtendedTask[];
  fontFamily: string;
  fontSize: string;
  dragOverTaskId: string | null;
  draggedTaskId: string | null;
  expandedParents: Set<string>;
  taskDataMap: Map<string, TaskData>;
  onDragStart: (e: React.DragEvent, id: string) => void;
  onDragOver: (e: React.DragEvent, id: string) => void;
  onDrop: (e: React.DragEvent, id: string) => void;
  onDragEnd: () => void;
  onTaskDoubleClick: (task: ExtendedTask) => void;
  onTaskClick: (task: ExtendedTask) => void;
  onToggleExpand: (taskId: string, e: React.MouseEvent) => void;
  onStatusChange: (taskId: string, newStatus: string, taskName: string) => void;
}

export const GanttTaskListTable: React.FC<GanttTaskListTableProps> = ({
  rowHeight,
  tasks,
  fontFamily,
  fontSize,
  dragOverTaskId,
  draggedTaskId,
  expandedParents,
  taskDataMap,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  onTaskDoubleClick,
  onTaskClick,
  onToggleExpand,
  onStatusChange,
}) => {
  const statusClass = (s: string, isOverdue?: boolean) => {
    return getStatusColor(s, isOverdue);
  };

  return (
    <div style={{ fontFamily, fontSize }}>
      {tasks.map((t) => {
        if (t.id === 'dummy-padding-task') {
          return <div key={t.id} style={{ height: rowHeight }} className="w-full bg-transparent border-b border-transparent pointer-events-none"></div>;
        }

        const isCancelled = !!(t as any).isCancelled;
        const isDragOver = dragOverTaskId === t.id;
        const isDragged = draggedTaskId === t.id;

        const getDepth = (taskId: string): number => {
          const taskData = taskDataMap.get(taskId);
          if (!taskData || !taskData.parent_task_id) return 0;
          return 1 + getDepth(taskData.parent_task_id);
        };
        const depth = getDepth(t.id);

        return (
          <div
            key={t.id}
            draggable={true}
            onDragStart={(e) => onDragStart(e, t.id)}
            onDragOver={(e) => onDragOver(e, t.id)}
            onDrop={(e) => onDrop(e, t.id)}
            onDragEnd={onDragEnd}
            onDoubleClick={() => onTaskDoubleClick(t)}
            className={`flex border-b border-slate-100 text-slate-600 hover:bg-emerald-50/30 transition-colors ${t.type === 'project' ? 'bg-slate-50 font-semibold' : ''} ${isDragged ? 'opacity-40 bg-slate-100' : ''} ${isDragOver ? 'border-t-2 border-t-emerald-500 bg-emerald-50/50' : ''}`}
            style={{ height: rowHeight, cursor: 'grab' }}
          >
            {/* Task Name */}
            <div
              className="flex-1 flex items-center px-2 sm:px-3 border-r border-slate-100 truncate gap-1.5"
              title={t.name}
              style={{ paddingLeft: `${Math.max(12, 12 + depth * 24)}px` }}
            >
              <div className="text-slate-300 cursor-grab active:cursor-grabbing hover:text-emerald-400 mr-1 select-none flex-shrink-0" title="Drag to reorder">
                <svg width="12" height="16" viewBox="0 0 12 16" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M4 3C4 3.55228 3.55228 4 3 4C2.44772 4 2 3.55228 2 3C2 2.44772 2.44772 2 3 2C3.55228 2 4 2.44772 4 3Z" /><path d="M4 8C4 8.55228 3.55228 9 3 9C2.44772 9 2 8.55228 2 8C2 7.44772 2.44772 7 3 7C3.55228 7 4 7.44772 4 8Z" /><path d="M4 13C4 13.55228 3.55228 14 3 14C2.44772 14 2 13.55228 2 13C2 12.44772 2.44772 12 3 12C3.55228 12 4 12.44772 4 13Z" /><path d="M10 3C10 3.55228 9.55228 4 9 4C8.44772 4 8 3.55228 8 3C8 2.44772 8.44772 2 9 2C9.55228 2 10 2.44772 10 3Z" /><path d="M10 8C10 8.55228 9.55228 9 9 9C8.44772 9 8 8.55228 8 8C8 7.44772 8.44772 7 9 7C9.55228 7 10 7.44772 10 8Z" /><path d="M10 13C10 13.55228 9.55228 14 9 14C8.44772 14 8 13.55228 8 13C8 12.44772 8.44772 12 9 12C9.55228 12 10 12.44772 10 13Z" /></svg>
              </div>
              {t.type === 'project' && (
                <div
                  className="text-slate-400 hover:text-emerald-600 cursor-pointer shrink-0 w-4 h-4 flex items-center justify-center transition-transform hover:bg-slate-200 rounded"
                  onClick={(e) => onToggleExpand(t.id, e)}
                >
                  {expandedParents.has(t.id) ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                </div>
              )}
              {t.isOverdue && !isCancelled && <span title="Overdue"><Clock className="w-3.5 h-3.5 text-red-500 shrink-0" /></span>}
              <span className={`truncate ${isCancelled ? 'line-through text-slate-400' : t.isOverdue ? 'text-red-600' : ''}`}>{t.name}</span>
            </div>
            {/* Assignee */}
            <div
              className="w-[140px] hidden xl:flex items-center px-3 text-[11px] font-medium text-slate-600 border-r border-slate-100 truncate"
              title={(t as any).assignee}
            >
              {(t as any).assignee || '-'}
            </div>
            {/* Duration: Plan / Actual */}
            <div
              className="w-[90px] hidden md:flex flex-col items-center justify-center text-xs border-r border-slate-100 cursor-pointer hover:bg-slate-100 transition-colors py-0.5"
              onClick={() => onTaskClick(t)}
              title="Plan: Start → Due | Actual: Start → End (Done only)"
            >
              <span className="text-slate-500">
                {(t as any).plannedDuration != null ? `${(t as any).plannedDuration}d` : '-'}
              </span>
              <span className={(t as any).duration != null ? ((t as any).duration > ((t as any).plannedDuration || 0) ? 'text-amber-600 font-bold' : 'text-emerald-600 font-medium') : 'text-slate-300'}>
                {(t as any).duration != null ? `${(t as any).duration}d` : '—'}
              </span>
            </div>
            {/* % Complete */}
            <div className="w-[50px] hidden lg:flex items-center justify-center text-xs font-medium border-r border-slate-100">
              <span className={(t as any).realProgress === 100 ? 'text-emerald-600' : t.isOverdue ? 'text-red-600' : 'text-emerald-600'}>
                {(t as any).realProgress}%
              </span>
            </div>
            {/* Status Dropdown */}
            <div className="w-[120px] hidden sm:flex items-center justify-center px-1 gap-1 group/row">
              <select
                disabled={isCancelled}
                className={`flex-1 text-xs rounded border outline-none h-7 font-medium disabled:opacity-50 disabled:cursor-not-allowed ${statusClass(t.originalStatus || '', t.isOverdue)} cursor-pointer`}
                value={t.originalStatus}
                onChange={(e) => onStatusChange(t.id, e.target.value, t.name)}
              >
                <option value="To Do">To Do</option>
                <option value="In Progress">In Progress</option>
                <option value="Review">Review</option>
                <option value="Done">Done</option>
                <option value="On Hold">On Hold</option>
                <option value="Cancel">Cancel</option>
              </select>
            </div>
          </div>
        );
      })}
    </div>
  );
};
