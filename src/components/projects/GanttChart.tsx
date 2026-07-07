"use client"

import React, { useState, useMemo } from 'react'
import { Gantt, Task, ViewMode } from 'gantt-task-react'
import "gantt-task-react/dist/index.css"
import { AlertCircle, Clock } from 'lucide-react'
import { useRouter } from 'next/navigation'
import axios from 'axios'
import { showToast } from '@/utils/toast'

import { TaskData, ProjectData } from '@/interfaces'
import { getEffectiveStartDate, getEffectiveEndDate, formatDateYYYYMMDD } from '@/utils/date'

interface GanttChartProps {
  tasks: TaskData[];
  project: ProjectData;
}

export function GanttChart({ tasks, project }: GanttChartProps) {
  const [view, setView] = useState<ViewMode>(ViewMode.Month)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const router = useRouter()

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

    tasks.forEach((t, index) => {
      let startDate = new Date();
      let endDate = new Date();
      endDate.setDate(endDate.getDate() + 7);

      const parsedStart = getEffectiveStartDate(t);
      if (parsedStart) startDate = parsedStart;

      const parsedEnd = getEffectiveEndDate(t);
      if (parsedEnd) endDate = parsedEnd;

      if (startDate >= endDate) {
        endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + 1);
      }

      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(23, 59, 59, 999);

      const status = (t.status || '').toLowerCase();
      const isCancelled = status.includes('cancel');
      const isDone = status.includes('done') || status.includes('complete');
      const isInProgress = status.includes('progress') || status.includes('doing');
      const isOnHold = status.includes('hold');

      // percent_complete: use stored value first, fallback to status-based
      let progress = 0;
      if (t.percent_complete && !isNaN(Number(t.percent_complete))) {
        progress = Math.min(100, Math.max(0, Number(t.percent_complete)));
      } else if (isDone) {
        progress = 100;
      } else if (isInProgress) {
        progress = 50;
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const isOverdue = progress < 100 && endDate < today && !isCancelled;

      // Determine bar color based on status
      let barColor = '#6366f1'; // indigo — default / To Do
      let barSelectedColor = '#4f46e5';
      if (isCancelled) { barColor = '#94a3b8'; barSelectedColor = '#64748b'; }
      else if (isDone) { barColor = '#10b981'; barSelectedColor = '#059669'; }
      else if (isOverdue) { barColor = '#ef4444'; barSelectedColor = '#dc2626'; }
      else if (isOnHold) { barColor = '#f59e0b'; barSelectedColor = '#d97706'; }
      else if (isInProgress) { barColor = '#3b82f6'; barSelectedColor = '#2563eb'; }

      // Determine task type: parent tasks become 'project' type in gantt-task-react
      const isParent = parentIds.has(t.id || '');
      const ganttType = isParent ? 'project' : 'task';

      const item: any = {
        start: startDate,
        end: endDate,
        name: t.task_order ? `${t.task_order}. ${t.task_name || `Task ${index + 1}`}` : (t.task_name || `Task ${index + 1}`),
        id: t.id || `task-${index}`,
        type: ganttType,
        progress,
        isDisabled: isCancelled, // Only cancelled tasks are non-interactive
        hideChildren: false,
        styles: {
          progressColor: barColor,
          progressSelectedColor: barSelectedColor,
          backgroundColor: barColor + '33', // 20% opacity background
          backgroundSelectedColor: barColor + '55',
        },
        // Custom props for our table
        originalStatus: t.status || 'To Do',
        isOverdue,
        isCancelled,
        description: t.description || '',
        assignee: t.assignee_name || (t.assignee_id as string) || (t as any).assignee || '',
        task_order: t.task_order || '',
        priority: t.priority || '',
        duration: Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)),
      };

      // Link sub-tasks to their parent
      if (t.parent_task_id && taskDataMap.has(t.parent_task_id)) {
        item.project = t.parent_task_id;
      }

      taskItems.push(item as Task);
    });

    // Add padding task so the last task isn't clipped
    let maxDate = new Date(0);
    taskItems.forEach(t => { if (t.end > maxDate) maxDate = t.end; });
    if (maxDate.getTime() > 0) {
      const padDate = new Date(maxDate);
      padDate.setDate(padDate.getDate() + 14);
      taskItems.push({
        start: padDate, end: padDate, name: '', id: 'dummy-padding',
        type: 'task', progress: 0, isDisabled: true,
        styles: { progressColor: 'transparent', progressSelectedColor: 'transparent', backgroundColor: 'transparent', backgroundSelectedColor: 'transparent' },
      } as unknown as Task);
    }

    return taskItems;
  }, [tasks, project, taskDataMap]);

  // Local state for optimistic UI updates
  const [localTasks, setLocalTasks] = useState<Task[]>([]);
  React.useEffect(() => {
    setLocalTasks(ganttTasks);
  }, [ganttTasks]);
  // Responsive list width
  const [listWidth, setListWidth] = useState("300px");
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

  // --- DRAG CALLBACKS (save to Google Sheets) ---
  const handleDateChange = async (task: Task) => {
    if (task.id === 'dummy-padding') return;

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

  const handleProgressChange = async (task: Task) => {
    if (task.id === 'dummy-padding') return;

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
      <div className="w-[70px] hidden md:flex items-center justify-center border-r border-slate-200 text-xs">Duration</div>
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

  const CustomTaskListTable: React.FC<{ rowHeight: number; tasks: ExtendedTask[]; fontFamily: string; fontSize: string; }> = ({ rowHeight, tasks, fontFamily, fontSize }) => {
    const statusClass = (s: string, isOverdue?: boolean) => {
      const sl = s.toLowerCase();
      if (sl.includes('cancel')) return 'bg-slate-100 border-slate-300 text-slate-500';
      if (sl.includes('done') || sl.includes('complete')) return 'bg-emerald-50 border-emerald-300 text-emerald-700';
      if (sl.includes('progress') || sl.includes('doing')) return 'bg-blue-50 border-blue-300 text-blue-700';
      if (sl.includes('review')) return 'bg-purple-50 border-purple-300 text-purple-700';
      if (sl.includes('hold')) return 'bg-amber-50 border-amber-300 text-amber-700';
      if (isOverdue) return 'bg-red-50 border-red-200 text-red-700';
      return 'bg-slate-50 border-slate-200 text-slate-700';
    };

    return (
      <div style={{ fontFamily, fontSize }}>
        {tasks.map((t) => {
          if (t.id === 'dummy-padding') {
            return <div key={t.id} style={{ height: rowHeight }} className="border-b border-transparent pointer-events-none" />;
          }
          const isCancelled = !!(t as any).isCancelled;
          return (
          <div key={t.id} className={`flex border-b border-slate-100 text-slate-600 hover:bg-indigo-50/30 transition-colors ${t.type === 'project' ? 'bg-slate-50 font-semibold' : ''}`} style={{ height: rowHeight }}>
            {/* Task Name */}
            <div className="flex-1 flex items-center px-2 sm:px-3 border-r border-slate-100 truncate gap-1.5" title={t.name}>
              {t.type === 'project' && <span className="text-indigo-400 shrink-0">▼</span>}
              {t.isOverdue && !isCancelled && <span title="Overdue"><Clock className="w-3.5 h-3.5 text-red-500 shrink-0" /></span>}
              <span className={`truncate ${isCancelled ? 'line-through text-slate-400' : t.isOverdue ? 'text-red-600' : ''}`}>{t.name}</span>
            </div>
            {/* Duration */}
            <div className="w-[70px] hidden md:flex items-center justify-center text-xs text-slate-500 border-r border-slate-100">
              {t.duration ? `${t.duration}d` : '-'}
            </div>
            {/* % Complete */}
            <div className="w-[50px] hidden lg:flex items-center justify-center text-xs font-medium border-r border-slate-100">
              <span className={t.progress === 100 ? 'text-emerald-600' : t.isOverdue ? 'text-red-600' : 'text-indigo-600'}>
                {t.progress}%
              </span>
            </div>
            {/* Status Dropdown */}
            <div className="w-[120px] hidden sm:flex items-center justify-center px-1">
              <select
                disabled={isCancelled}
                className={`w-full text-xs rounded border outline-none cursor-pointer h-7 font-medium disabled:opacity-50 disabled:cursor-not-allowed ${statusClass(t.originalStatus || '', t.isOverdue)}`}
                value={t.originalStatus}
                onChange={(e) => handleStatusChange(t.id, e.target.value, t.name)}
              >
                <option value="To Do">To Do</option>
                <option value="In Progress">In Progress</option>
                <option value="Review">Review</option>
                <option value="Done">Done</option>
                <option value="Hold">Hold</option>
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

  if (localTasks.length === 0 || (localTasks.length === 1 && localTasks[0].id === 'dummy-padding')) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center text-slate-500">
        <AlertCircle className="w-12 h-12 mb-4 text-slate-300" />
        <h3 className="text-lg font-medium text-slate-900">No timeline data available</h3>
        <p className="mt-1">We couldn&apos;t find any tasks with valid dates for this project.</p>
      </div>
    );
  }

  return (
    <div className="w-full pb-4 relative" ref={wrapperRef}>
      <div className="flex justify-end gap-2 mb-4">
        <select 
          className="text-sm border border-slate-200 rounded-md px-3 py-1.5 bg-white text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          value={view}
          onChange={(e) => setView(e.target.value as ViewMode)}
        >
          <option value={ViewMode.Day}>Day</option>
          <option value={ViewMode.Week}>Week</option>
          <option value={ViewMode.Month}>Month</option>
        </select>
      </div>
      
      <div className="bg-white rounded-lg shadow border border-slate-200 overflow-hidden min-h-[400px]">
        <Gantt
          tasks={localTasks}
          viewMode={view}
          listCellWidth={listWidth}
          columnWidth={view === ViewMode.Month ? 120 : 60}
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
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-amber-500 inline-block"></span>Hold</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-red-500 inline-block"></span>Overdue</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-slate-400 inline-block"></span>Cancelled</span>
        <span className="flex items-center gap-1.5 ml-auto text-slate-400 italic">💡 ลากแท่งเพื่อเปลี่ยนวัน • ลากขอบขวาเพื่อขยายระยะเวลา • ลาก % เพื่ออัปเดตความคืบหน้า</span>
      </div>

      {selectedTask && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setSelectedTask(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md flex flex-col animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50/50">
              <h3 className="text-lg font-semibold text-slate-800">Task Details</h3>
              <button onClick={() => setSelectedTask(null)} className="text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-100">
                <AlertCircle className="w-5 h-5 hidden" />
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1 block">Task Name</label>
                <div className="text-slate-900 font-medium">{selectedTask.name}</div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1 block">Start Date</label>
                  <div className="text-sm text-slate-700">{selectedTask.start.toLocaleDateString('en-GB')}</div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1 block">End Date</label>
                  <div className="text-sm text-slate-700">{selectedTask.end.toLocaleDateString('en-GB')}</div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1 block">Status</label>
                  <select
                    className={`w-full text-sm rounded-md border outline-none cursor-pointer h-9 px-3 font-medium ${
                      (() => {
                        const s = ((selectedTask as any).originalStatus || '').toLowerCase();
                        if (s.includes('cancel')) return 'bg-slate-100 border-slate-300 text-slate-500';
                        if (s.includes('done') || s.includes('complete')) return 'bg-emerald-50 border-emerald-300 text-emerald-700';
                        if (s.includes('progress') || s.includes('doing')) return 'bg-blue-50 border-blue-300 text-blue-700';
                        if (s.includes('review')) return 'bg-purple-50 border-purple-300 text-purple-700';
                        if (s.includes('hold')) return 'bg-amber-50 border-amber-300 text-amber-700';
                        if ((selectedTask as any).isOverdue) return 'bg-red-50 border-red-200 text-red-700';
                        return 'bg-slate-50 border-slate-200 text-slate-700';
                      })()
                    }`}
                    value={(selectedTask as any).originalStatus}
                    onChange={(e) => handleStatusChange(selectedTask.id, e.target.value, selectedTask.name)}
                  >
                    <option value="To Do">To Do</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Review">Review</option>
                    <option value="Done">Done</option>
                    <option value="Hold">Hold</option>
                    <option value="Cancel">Cancel</option>
                  </select>
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
                        <div key={i} className="text-sm text-indigo-700 bg-indigo-50 px-2 py-1 rounded inline-block border border-indigo-100">
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
    </div>
  )
}
