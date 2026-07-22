"use client"

import React, { useState, useMemo } from 'react'
import { Gantt, Task, ViewMode } from 'gantt-task-react'
import "gantt-task-react/dist/index.css"
import { AlertCircle, Clock, FileSpreadsheet, FileText, Loader2, Lightbulb, Mail, ChevronDown, ChevronRight } from 'lucide-react'
import { useRouter } from 'next/navigation'
import axios from 'axios'
import { showToast } from '@/utils/toast'

import { TaskData, ProjectData, UserData } from '@/interfaces'
import { getEffectiveStartDate, getEffectiveEndDate, formatDateYYYYMMDD, normalizeGanttDates } from '@/utils/date'
import { exportToExcel, exportToPDF } from '@/utils/export'
import { calculateTaskProgress } from '@/utils/progress'
import { getStatusColor } from '@/utils/status'
import { useSession } from 'next-auth/react'
import { EmailUpdateModal } from './EmailUpdateModal'
import { EditTaskModal } from './EditTaskModal'
import { Button } from '@/components/ui/button'

interface GanttChartProps {
  tasks: TaskData[];
  project: ProjectData;
  users?: UserData[];
}

export function GanttChart({ tasks, project, users = [] }: GanttChartProps) {
  const [view, setView] = useState<ViewMode>(ViewMode.Month);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dragOverTaskId, setDragOverTaskId] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [expandedParents, setExpandedParents] = useState<Set<string>>(new Set());
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const router = useRouter();
  const { data: session } = useSession();

  const toggleExpand = (taskId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedParents(prev => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  };

  // Map of task_id -> original TaskData for use in callbacks
  const taskDataMap = useMemo(() => {
    const map = new Map<string, TaskData>();
    tasks.forEach(t => { if (t.id) map.set(t.id, t); });
    return map;
  }, [tasks]);

  const ganttTasks: Task[] = useMemo(() => {
    if (!tasks || tasks.length === 0) return [];

    // Determine which task IDs are parents (have children)
    const parentIds = new Set<string>();
    tasks.forEach(t => {
      if (t.parent_task_id) parentIds.add(t.parent_task_id);
    });

    const taskItems: Task[] = [];

    const isVisible = (t: TaskData): boolean => {
      if (!t.parent_task_id) return true;
      if (!expandedParents.has(t.parent_task_id)) return false;
      const parent = taskDataMap.get(t.parent_task_id);
      if (parent) return isVisible(parent);
      return true;
    };

    tasks.forEach((t, index) => {
      if (!isVisible(t)) return;

      let { startDate, endDate } = normalizeGanttDates(t);

      const status = (t.status || '').toLowerCase();
      const isCancelled = status.includes('cancel');
      const isDone = status.includes('done') || status.includes('complete');
      const isInProgress = status.includes('progress') || status.includes('doing');
      const isOnHold = status.includes('hold');

      // percent_complete: use utility function to calculate recursively
      const progress = calculateTaskProgress(t, tasks);

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const isOverdue = progress < 100 && endDate < today && !isCancelled;

      // Determine bar color based on status
      let barColor = '#6366f1'; // emerald â€” default / To Do
      let barSelectedColor = '#4f46e5';
      let bgColor = '';
      let bgSelectedColor = '';

      let displayProgress = progress;

      if (isCancelled) { barColor = '#94a3b8'; barSelectedColor = '#64748b'; }
      else if (isDone) { barColor = '#10b981'; barSelectedColor = '#059669'; }
      else if (isOverdue) { barColor = '#ef4444'; barSelectedColor = '#dc2626'; }
      else if (isOnHold) { barColor = '#f59e0b'; barSelectedColor = '#d97706'; }
      else if (isInProgress) { barColor = '#3b82f6'; barSelectedColor = '#2563eb'; }

      // Check for delay (update_date > due_date) to show the delay "tail"
      if (t.update_date && t.due_date) {
        const actualDue = new Date(t.due_date);
        const actualEnd = new Date(t.update_date);
        actualDue.setHours(23, 59, 59, 999);
        actualEnd.setHours(23, 59, 59, 999);

        if (actualEnd > actualDue && isDone) {
          // It's delayed! Show green up to due_date, and red for the rest
          const totalDuration = actualEnd.getTime() - startDate.getTime();
          const plannedDuration = actualDue.getTime() - startDate.getTime();

          if (totalDuration > 0 && plannedDuration > 0) {
            displayProgress = (plannedDuration / totalDuration) * 100;
            displayProgress = Math.max(0, Math.min(100, displayProgress));

            // Background becomes red (delay tail)
            bgColor = '#ef4444'; // solid red
            bgSelectedColor = '#dc2626';
          }
        }
      }

      // Default backgrounds if not a delay tail
      if (!bgColor) {
        bgColor = barColor + '33'; // 20% opacity
        bgSelectedColor = barColor + '55';
      }

      // Determine task type: parent tasks become 'project' type in gantt-task-react
      const isParent = parentIds.has(t.id || '');
      const ganttType = isParent ? 'project' : 'task';

      // Auto-compute status for parent tasks based on subtask progress
      let computedStatus = t.status || 'To Do';
      if (isParent) {
        if (progress === 100) computedStatus = 'Done';
        else if (progress === 0) computedStatus = 'To Do';
        else computedStatus = 'In Progress';
      }
      const isEffectiveDone = (computedStatus || '').toLowerCase().includes('done') || (computedStatus || '').toLowerCase().includes('complete');

      const item: any = {
        start: startDate,
        end: endDate,
        name: t.task_order ? `${t.task_order}. ${t.task_name || `Task ${index + 1}`}` : (t.task_name || `Task ${index + 1}`),
        id: t.id || `task-${index}`,
        type: ganttType,
        progress: displayProgress,
        isDisabled: isCancelled || isDone, // Cancelled and Done tasks are non-interactive to prevent dragging historical/fake visual dates
        hideChildren: false,
        styles: {
          progressColor: barColor,
          progressSelectedColor: barSelectedColor,
          backgroundColor: bgColor,
          backgroundSelectedColor: bgSelectedColor,
        },
        // Custom props for our table
        realProgress: progress,
        originalStatus: computedStatus,
        isOverdue: isOverdue,
        isCancelled,
        description: t.description || '',
        assignee: t.assignee_name || (t.assignee_id as string) || (t as any).assignee || '',
        task_order: t.task_order || '',
        priority: t.priority || '',
        // Planned duration = start_date → due_date (always fixed from plan)
        plannedDuration: t.due_date && t.start_date
          ? Math.max(1, Math.round((new Date(t.due_date).getTime() - new Date(t.start_date).getTime()) / (1000 * 60 * 60 * 24)) + 1)
          : null,
        // Actual duration = start_date → update_date (ONLY when task is Done)
        duration: isEffectiveDone && t.update_date && t.start_date
          ? Math.max(1, Math.round((new Date(t.update_date).getTime() - new Date(t.start_date).getTime()) / (1000 * 60 * 60 * 24)) + 1)
          : null,
        actualStartDate: t.start_date,
        actualDueDate: t.due_date,
        actualUpdateDate: t.update_date,
      };

      // Link sub-tasks to their parent
      if (t.parent_task_id && taskDataMap.has(t.parent_task_id)) {
        item.project = t.parent_task_id;
      }

      taskItems.push(item as Task);
    });

    // Removed dummy-padding logic

    return taskItems;
  }, [tasks, project, taskDataMap, expandedParents]);

  // Local state for optimistic UI updates
  const [localTasks, setLocalTasks] = useState<Task[]>([]);
  React.useEffect(() => {
    setLocalTasks(ganttTasks);
  }, [ganttTasks]);

  // Responsive list width + container width for auto column-width calc
  const [listWidth, setListWidth] = useState("300px");
  const [containerWidth, setContainerWidth] = useState(typeof window !== 'undefined' ? window.innerWidth - 80 : 1200);
  const ganttContainerRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 640) setListWidth("130px");
      else if (window.innerWidth < 768) setListWidth("200px");
      else setListWidth("300px");
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Track container width via ResizeObserver (fires on mount + any resize)
  React.useEffect(() => {
    const el = ganttContainerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);


  // â”€â”€ Auto column width: scale chart to fill container width â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const autoColumnWidth = useMemo(() => {
    const validTasks = localTasks;
    if (validTasks.length === 0) {
      return view === ViewMode.Month ? 120 : view === ViewMode.Week ? 60 : 30;
    }

    // Find total span of the project in the current view unit
    let minDate = new Date(validTasks[0].start);
    let maxDate = new Date(validTasks[0].end);
    validTasks.forEach(t => {
      if (t.start < minDate) minDate = new Date(t.start);
      if (t.end > maxDate) maxDate = new Date(t.end);
    });

    const listPx = parseInt(listWidth) || 300;
    const availW = Math.max(containerWidth - listPx - 24, 200); // 24px for scrollbar

    let unitCount: number;
    if (view === ViewMode.Month) {
      // Count months between min and max (+1 padding on each side)
      const months =
        (maxDate.getFullYear() - minDate.getFullYear()) * 12 +
        (maxDate.getMonth() - minDate.getMonth()) + 3; // +3 for padding
      unitCount = Math.max(months, 1);
    } else if (view === ViewMode.Week) {
      const days = Math.ceil((maxDate.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24));
      unitCount = Math.max(Math.ceil(days / 7) + 2, 1);
    } else {
      const days = Math.ceil((maxDate.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24));
      unitCount = Math.max(days + 6, 1);
    }

    const computed = Math.floor(availW / unitCount);

    // Clamp: min readable size, max so short plans don't look absurd
    if (view === ViewMode.Month) return Math.max(computed, 80);
    if (view === ViewMode.Week) return Math.max(computed, 40);
    return Math.max(computed, 20);
  }, [localTasks, view, containerWidth, listWidth]);


  const handleDateChange = async (task: Task) => {
    if (!task) return;

    // Optimistic UI update
    setLocalTasks(prev => prev.map(t => (t.id === task.id ? task : t)));

    const startStr = formatDateYYYYMMDD(task.start);
    const endStr = formatDateYYYYMMDD(task.end);
    try {
      await axios.put('/api/tasks/dates', {
        task_id: task.id,
        start_date: startStr,
        due_date: endStr,
      });
      showToast.success('Dates updated');
      router.refresh();
    } catch (err) {
      console.error(err);
      showToast.error('Failed to save dates');
    }
  };

  const handleModalDateChange = async (id: string, field: 'start_date' | 'due_date' | 'update_date', val: string) => {
    try {
      await axios.put('/api/tasks/dates', {
        task_id: id,
        [field]: val || '',
      });
      showToast.success('Date updated');

      setSelectedTask(prev => {
        if (!prev) return prev;
        const mappedField = field === 'start_date' ? 'actualStartDate'
          : field === 'due_date' ? 'actualDueDate'
            : 'actualEndDate';
        return {
          ...prev,
          [mappedField]: val
        };
      });

      router.refresh();
    } catch (err) {
      console.error(err);
      showToast.error('Failed to update date');
    }
  };

  const handleProgressChange = async (task: Task) => {
    if (!task) return;

    // Optimistic UI update
    setLocalTasks(prev => prev.map(t => (t.id === task.id ? task : t)));

    try {
      await axios.put('/api/tasks/dates', {
        task_id: task.id,
        percent_complete: task.progress,
      });
      showToast.success(`Progress updated to ${task.progress}%`);
      router.refresh();
    } catch (err) {
      console.error(err);
      showToast.error('Failed to save progress');
    }
  };

  // --- CUSTOM TABLE COMPONENTS ---
  const CustomTaskListHeader: React.FC<{ headerHeight: number; fontFamily: string; fontSize: string; }> = ({ headerHeight, fontFamily, fontSize }) => (
    <div className="flex border-b border-slate-200 bg-slate-50 text-slate-700 font-semibold sticky top-0 z-10" style={{ height: headerHeight, fontFamily, fontSize }}>
      <div className="flex-1 flex items-center px-3 border-r border-slate-200 truncate">Task Name</div>
      <div className="w-[140px] hidden xl:flex items-center px-3 border-r border-slate-200 text-xs">Assign</div>
      <div className="w-[90px] hidden md:flex flex-col items-center justify-center border-r border-slate-200 text-xs leading-tight">
        <span>Plan</span>
        <span className="text-slate-400 font-normal">Actual</span>
      </div>
      <div className="w-[50px] hidden lg:flex items-center justify-center border-r border-slate-200 text-xs">%</div>
      <div className="w-[120px] hidden sm:flex items-center justify-center">Status</div>
    </div>
  );

  const handleStatusChange = async (taskId: string, newStatus: string, taskName: string) => {
    try {
      await axios.put('/api/tasks/status', { task_id: taskId, new_status: newStatus, task_name: taskName });
      showToast.success('Status updated successfully');
      if (selectedTask && selectedTask.id === taskId) {
        setSelectedTask(prev => prev ? { ...prev, originalStatus: newStatus } as any : null);
      }
      router.refresh();
    } catch (error) {
      console.error(error);
      showToast.error('Failed to update status');
    }
  };

  type ExtendedTask = Task & { originalStatus?: string; isOverdue?: boolean; isCancelled?: boolean; duration?: number; assignee?: string; task_order?: string; priority?: string; };

  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedTaskId(id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    if (id !== draggedTaskId) {
      setDragOverTaskId(id);
    }
  };

  const handleDrop = async (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    setDragOverTaskId(null);
    if (!draggedTaskId || draggedTaskId === targetId) return;

    // Use the full tasks array (from props) to rebuild the tree
    const draggedItem = tasks.find(t => t.id === draggedTaskId);
    const targetItem = tasks.find(t => t.id === targetId);

    if (!draggedItem || !targetItem) return;

    // Enforce that tasks can only be reordered within the same parent
    if (draggedItem.parent_task_id !== targetItem.parent_task_id) {
      showToast.error("Tasks can only be reordered within the same group (Main tasks with Main tasks, Subtasks with their siblings).");
      return;
    }

    // Build children map
    const childrenMap = new Map<string, TaskData[]>();
    tasks.forEach(t => {
      const pId = t.parent_task_id || "";
      if (!childrenMap.has(pId)) childrenMap.set(pId, []);
      childrenMap.get(pId)!.push(t);
    });

    // Sort each children array by current task_order
    childrenMap.forEach(arr => {
      arr.sort((a, b) => {
        const orderA = a.task_order || '';
        const orderB = b.task_order || '';
        if (!orderA && !orderB) return 0;
        if (!orderA) return 1;
        if (!orderB) return -1;
        return orderA.localeCompare(orderB, undefined, { numeric: true, sensitivity: 'base' });
      });
    });

    // Move dragged item in its sibling array
    const pId = draggedItem.parent_task_id || "";
    const siblings = childrenMap.get(pId)!;
    const fromIdx = siblings.findIndex(t => t.id === draggedTaskId);
    const toIdx = siblings.findIndex(t => t.id === targetId);
    
    if (fromIdx !== -1 && toIdx !== -1) {
      const [moved] = siblings.splice(fromIdx, 1);
      siblings.splice(toIdx, 0, moved);
    }

    // Traverse and compute new task_orders
    const updates: { id: string, task_order: string }[] = [];
    const traverse = (parentId: string, parentOrderPrefix: string) => {
      const children = childrenMap.get(parentId) || [];
      children.forEach((child, index) => {
        const newOrder = parentOrderPrefix ? `${parentOrderPrefix}.${index + 1}` : `${index + 1}`;
        // Optimistically update the object in memory
        child.task_order = newOrder; 
        updates.push({ id: child.id as string, task_order: newOrder });
        traverse(child.id as string, newOrder);
      });
    };
    traverse("", "");

    // Build a map of id -> new task_order for sorting
    const newOrderMap = new Map<string, string>();
    updates.forEach(u => newOrderMap.set(u.id, u.task_order));

    // Optimistically reorder localTasks to match the new task_order immediately
    setLocalTasks(prev => {
      return prev.sort((a, b) => {
          const oa = newOrderMap.get(a.id) || (a as any).task_order || '';
          const ob = newOrderMap.get(b.id) || (b as any).task_order || '';
          return oa.localeCompare(ob, undefined, { numeric: true, sensitivity: 'base' });
        });
    });

    try {
      await axios.put('/api/tasks/reorder', { updates });
      showToast.success('Task order updated');
      router.refresh();
    } catch (err) {
      console.error(err);
      showToast.error('Failed to save task order');
    }
  };

  const CustomTaskListTable: React.FC<{ rowHeight: number; tasks: ExtendedTask[]; fontFamily: string; fontSize: string; }> = ({ rowHeight, tasks, fontFamily, fontSize }) => {
    const statusClass = (s: string, isOverdue?: boolean) => {
      return getStatusColor(s, isOverdue);
    };

    return (
      <div style={{ fontFamily, fontSize }}>
        {tasks.map((t) => {

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
              onDragStart={(e) => handleDragStart(e, t.id)}
              onDragOver={(e) => handleDragOver(e, t.id)}
              onDrop={(e) => handleDrop(e, t.id)}
              onDragEnd={() => { setDraggedTaskId(null); setDragOverTaskId(null); }}
              onDoubleClick={() => {
                const origTask = tasks.find(x => x.id === t.id);
                if (origTask) {
                  setSelectedTask(origTask as any);
                }
              }}
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
                    onClick={(e) => toggleExpand(t.id, e)}
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
                onClick={() => handleTaskClick(t as Task)}
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
              <div className="w-[120px] hidden sm:flex items-center justify-center px-1">
                <select
                  disabled={isCancelled}
                  className={`w-full text-xs rounded border outline-none h-7 font-medium disabled:opacity-50 disabled:cursor-not-allowed ${statusClass(t.originalStatus || '', t.isOverdue)} cursor-pointer`}
                  value={t.originalStatus}
                  onChange={(e) => handleStatusChange(t.id, e.target.value, t.name)}
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

  const handleTaskClick = (task: Task) => {
    setSelectedTask(task);
  };

  const CustomTooltip: React.FC<{ task: Task; fontSize: string; fontFamily: string }> = ({ task, fontSize, fontFamily }) => {
    const duration = (task as any).duration;
    return (
      <div className="bg-white rounded shadow-md border border-slate-200 px-3 py-2 whitespace-nowrap pointer-events-none" style={{ fontSize: '11px', fontFamily, zIndex: 9999 }}>
        <div className="font-semibold text-slate-800 mb-0.5">{task.name}</div>
        <div className="text-slate-600">
          {task.start.toLocaleDateString('en-GB')} - {task.end.toLocaleDateString('en-GB')}
        </div>
        <div className="text-slate-600 mt-0.5 font-medium">
          Duration: {duration} day(s)
        </div>
      </div>
    );
  };

  // Touch scroll support for mobile
  const wrapperRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    let isDown = false;
    let startX = 0;
    let scrollContainer: Element | null = null;

    const findScrollContainer = () => {
      // Find the internal scroll container of gantt-task-react
      const divs = wrapper.getElementsByTagName('div');
      for (let i = 0; i < divs.length; i++) {
        // The scroll container will have a significantly larger scrollWidth than clientWidth
        if (divs[i].scrollWidth > divs[i].clientWidth + 20 && divs[i].style.overflowX !== 'hidden') {
          return divs[i];
        }
      }
      return null;
    };

    const handleTouchStart = (e: TouchEvent) => {
      scrollContainer = findScrollContainer();
      if (!scrollContainer) return;

      // Only capture if touch is inside the grid, not on the task list
      // We can assume touch on the right side of the screen is for the grid
      isDown = true;
      startX = e.touches[0].pageX;
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isDown || !scrollContainer) return;

      const x = e.touches[0].pageX;
      const walk = (startX - x); // Positive when swiping left (scrolls right)

      // If the swipe is mostly horizontal, prevent default vertical scroll and scroll horizontally
      // But since passive: true is not set, we shouldn't prevent default unless we check angle.
      // For simplicity, just add to scrollLeft.
      // Increase scroll sensitivity slightly for better feel
      if (Math.abs(walk) > 0) {
        scrollContainer.scrollLeft += (walk * 1.5);
        startX = x;
      }
    };

    const handleTouchEnd = () => {
      isDown = false;
    };

    // Use capture phase to ensure we intercept touches before gantt-task-react can stopPropagation
    wrapper.addEventListener('touchstart', handleTouchStart, { passive: true, capture: true });
    wrapper.addEventListener('touchmove', handleTouchMove, { passive: true, capture: true });
    wrapper.addEventListener('touchend', handleTouchEnd, { capture: true });
    wrapper.addEventListener('touchcancel', handleTouchEnd, { capture: true });

    return () => {
      wrapper.removeEventListener('touchstart', handleTouchStart, { capture: true });
      wrapper.removeEventListener('touchmove', handleTouchMove, { capture: true });
      wrapper.removeEventListener('touchend', handleTouchEnd, { capture: true });
      wrapper.removeEventListener('touchcancel', handleTouchEnd, { capture: true });
    };
  }, [ganttTasks, view]);

  const handleExportPDF = async () => {
    try {
      setIsExporting(true);
      await new Promise(resolve => setTimeout(resolve, 100)); // allow UI to update
      const exporterName = session?.user?.name || (session?.user as any)?.name_en || session?.user?.email || 'Unknown User';
      await exportToPDF(localTasks, tasks, project, exporterName);
      showToast.success('PDF exported successfully');
    } catch (error) {
      console.error(error);
      showToast.error('Failed to export PDF');
    } finally {
      setIsExporting(false);
    }
  };

  if (localTasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center text-slate-500">
        <AlertCircle className="w-12 h-12 mb-4 text-slate-300" />
        <h3 className="text-lg font-medium text-slate-900">No timeline data available</h3>
        <p className="mt-1">We couldn&apos;t find any tasks with valid dates for this project.</p>
      </div>
    );
  }

  return (
    <div className="w-full pb-4 relative">
      <div className="flex justify-between items-center gap-2 mb-4">
        <div className="flex gap-2">
          <button
            onClick={handleExportPDF}
            disabled={isExporting}
            className="flex items-center gap-1.5 text-sm border border-slate-200 rounded-md px-3 py-1.5 bg-white text-slate-700 shadow-sm hover:bg-slate-50 hover:text-emerald-600 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isExporting ? <Loader2 className="w-4 h-4 text-slate-500 animate-spin" /> : <FileText className="w-4 h-4 text-rose-500" />}
            {isExporting ? 'Exporting...' : 'Export PDF'}
          </button>
          
          <button
            onClick={() => setIsEmailModalOpen(true)}
            className="flex items-center gap-1.5 text-sm border border-indigo-200 rounded-md px-3 py-1.5 bg-indigo-50 text-indigo-700 shadow-sm hover:bg-indigo-100 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          >
            <Mail className="w-4 h-4" />
            Send Email Update
          </button>
        </div>
        <select
          className="text-sm border border-slate-200 rounded-md px-3 py-1.5 bg-white text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
          value={view}
          onChange={(e) => setView(e.target.value as ViewMode)}
        >
          <option value={ViewMode.Day}>Day</option>
          <option value={ViewMode.Week}>Week</option>
          <option value={ViewMode.Month}>Month</option>
        </select>
      </div>
      <div ref={wrapperRef} className="bg-white p-2 rounded-lg border border-slate-100">

        <div ref={ganttContainerRef} className="bg-white rounded-lg shadow border border-slate-200 overflow-hidden min-h-[400px] pb-10">
          <Gantt
            key={`${view}-${Math.floor(autoColumnWidth / 10)}`} // force re-render if width changes significantly
            tasks={localTasks}
            viewMode={view}
            listCellWidth={listWidth}
            columnWidth={autoColumnWidth}
            rowHeight={38}
            barCornerRadius={4}
            fontFamily="inherit"
            fontSize="13px"
            TaskListHeader={CustomTaskListHeader}
            TaskListTable={CustomTaskListTable as unknown as React.FC<unknown>}
            TooltipContent={CustomTooltip}
            onDoubleClick={handleTaskClick}
            onDateChange={handleDateChange}
            onProgressChange={handleProgressChange}
          />
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-x-4 gap-y-2 mt-4 px-2 text-xs text-slate-500">
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-indigo-500 inline-block"></span>To Do</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-blue-500 inline-block"></span>In Progress</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-emerald-500 inline-block"></span>Done</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-amber-500 inline-block"></span>On Hold</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-red-500 inline-block"></span>Overdue</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-slate-400 inline-block"></span>Cancelled</span>
          <span className="flex items-center gap-1.5 ml-auto text-slate-400 italic"><Lightbulb className="w-3.5 h-3.5" /> ลากแท่งเพื่อเปลี่ยนวัน &bull; ลากขอบขวาเพื่อขยายระยะเวลา</span>
        </div>
      </div>

      <EmailUpdateModal 
        isOpen={isEmailModalOpen}
        onClose={() => setIsEmailModalOpen(false)}
        project={project}
        tasks={tasks}
        ganttTasks={localTasks}
      />

      {selectedTask && !isEditModalOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setSelectedTask(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md flex flex-col animate-in zoom-in-95 duration-200 overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50/50">
              <h3 className="text-lg font-semibold text-slate-800">Task Details</h3>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setIsEditModalOpen(true)}>
                  Full Edit
                </Button>
                <button onClick={() => setSelectedTask(null)} className="text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-100">
                  <AlertCircle className="w-5 h-5 hidden" />
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                </button>
              </div>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1 block">Task Name</label>
                <div className="text-slate-900 font-medium">{selectedTask.name}</div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1 block">Start Date</label>
                  <input
                    type="date"
                    className="w-full text-sm rounded-md border border-slate-200 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 h-9 px-3"
                    value={formatDateYYYYMMDD((selectedTask as any).actualStartDate)}
                    onChange={(e) => handleModalDateChange(selectedTask.id, 'start_date', e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1 block">Due Date</label>
                  <input
                    type="date"
                    className="w-full text-sm rounded-md border border-slate-200 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 h-9 px-3"
                    value={formatDateYYYYMMDD((selectedTask as any).actualDueDate)}
                    onChange={(e) => handleModalDateChange(selectedTask.id, 'due_date', e.target.value)}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1 block">Status</label>
                  <select
                    className={`w-full text-sm rounded-md border outline-none cursor-pointer h-9 px-3 font-medium ${(() => {
                      const s = ((selectedTask as any).originalStatus || '').toLowerCase();
                      if (s.includes('cancel')) return 'bg-slate-100 border-slate-300 text-slate-500';
                      if (s.includes('done') || s.includes('complete')) return 'bg-emerald-50 border-emerald-300 text-emerald-700';
                      if (s.includes('progress') || s.includes('doing')) return 'bg-blue-50 border-blue-300 text-blue-700';
                      if (s.includes('review')) return 'bg-purple-50 border-purple-300 text-purple-700';
                      if (s.includes('hold')) return 'bg-amber-50 border-amber-300 text-amber-700';
                      if ((selectedTask as any).isOverdue) return 'bg-red-50 border-red-200 text-red-700';
                      return 'bg-slate-50 border-slate-200 text-slate-700';
                    })()}`}
                    value={(selectedTask as any).originalStatus}
                    onChange={(e) => handleStatusChange(selectedTask.id, e.target.value, selectedTask.name)}
                  >
                    <option value="To Do">To Do</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Review">Review</option>
                    <option value="Done">Done</option>
                    <option value="On Hold">On Hold</option>
                    <option value="Cancel">Cancel</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1 block">Update Date (Actual)</label>
                  <div className="w-full text-sm rounded-md border border-slate-200 bg-slate-50 text-slate-500 h-9 px-3 flex items-center">
                    {(selectedTask as any).actualUpdateDate ? new Date((selectedTask as any).actualUpdateDate).toLocaleDateString('en-GB') : '-'}
                  </div>
                </div>
              </div>

              {(selectedTask as Task & { assignee?: string }).assignee && (
                <div>
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1 block">Assignees</label>
                  <div className="flex flex-wrap gap-2">
                    {((selectedTask as Task & { assignee?: string }).assignee || '').split(',').map((name, i) => {
                      const trimmedName = name.trim();
                      if (!trimmedName) return null;
                      return (
                        <div key={i} className="text-sm text-emerald-700 bg-emerald-50 px-2 py-1 rounded inline-block border border-emerald-100">
                          {trimmedName}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {(selectedTask as Task & { description?: string }).description && (
                <div>
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1 block">Description</label>
                  <div className="text-sm text-slate-600 whitespace-pre-wrap bg-slate-50 p-3 rounded-lg border border-slate-100 max-h-60 overflow-y-auto">
                    {(selectedTask as Task & { description?: string }).description}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {selectedTask && (
        <EditTaskModal
          isOpen={isEditModalOpen}
          onClose={() => {
            setIsEditModalOpen(false);
            setSelectedTask(null);
          }}
          onSaved={() => {
            router.refresh();
            setIsEditModalOpen(false);
            setSelectedTask(null);
          }}
          users={users}
          projectId={project.id as string || project.project_code || ""}
          task={tasks.find(x => x.id === selectedTask.id) || selectedTask as any}
          tasks={tasks}
        />
      )}
    </div>
  )
}
