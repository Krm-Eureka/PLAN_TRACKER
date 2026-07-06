"use client"

import React, { useState, useMemo } from 'react'
import { Gantt, Task, ViewMode } from 'gantt-task-react'
import "gantt-task-react/dist/index.css"
import { AlertCircle, Clock } from 'lucide-react'
import { useRouter } from 'next/navigation'
import axios from 'axios'
import { showToast } from '@/utils/toast'

import { TaskData, ProjectData } from '@/interfaces'

interface GanttChartProps {
  tasks: TaskData[];
  project: ProjectData;
}

export function GanttChart({ tasks, project }: GanttChartProps) {
  const [view, setView] = useState<ViewMode>(ViewMode.Month)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const router = useRouter()

  const parseSafeDate = (dateStr: string | Date | undefined | null): Date | null => {
    if (!dateStr) return null;
    if (dateStr instanceof Date) return isNaN(dateStr.getTime()) ? null : dateStr;
    const str = String(dateStr).trim();
    const dmyMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (dmyMatch) {
      const day = parseInt(dmyMatch[1], 10);
      const month = parseInt(dmyMatch[2], 10) - 1;
      const year = parseInt(dmyMatch[3], 10);
      const d = new Date(year, month, day);
      if (!isNaN(d.getTime())) return d;
    }
    const parsed = new Date(str);
    if (!isNaN(parsed.getTime())) return parsed;
    return null;
  };

  const ganttTasks: Task[] = useMemo(() => {
    let projectProgress = 0;

    if (tasks && tasks.length > 0) {
      // Exclude cancelled tasks from progress calculation
      const countableTasks = tasks.filter(t => !(t.status || '').toLowerCase().includes('cancel'));
      const completedCount = countableTasks.filter(t => {
        const s = (t.status || '').toLowerCase();
        return s.includes('done') || s.includes('complete');
      }).length;
      projectProgress = countableTasks.length > 0
        ? Math.round((completedCount / countableTasks.length) * 100)
        : 0;
    }

    if (!tasks || tasks.length === 0) {
      const pStart = parseSafeDate(project?.start_date);
      const pEnd = parseSafeDate(project?.end_date);
      if (pStart && pEnd) {
        return [{
          start: pStart,
          end: pEnd,
          name: project.project_name || 'Project Duration',
          id: 'Project',
          type: 'project',
          progress: projectProgress,
          isDisabled: true,
          styles: { progressColor: '#4f46e5', progressSelectedColor: '#4338ca' }
        }];
      }
      return [];
    }

    const taskItems = tasks.map((t, index) => {
      let startDate = new Date();
      let endDate = new Date();
      endDate.setDate(endDate.getDate() + 7);

      const parsedStart = parseSafeDate(t.start_date);
      if (parsedStart) startDate = parsedStart;
      
      const parsedEnd = parseSafeDate(t.end_date || t.due_date);
      if (parsedEnd) endDate = parsedEnd;

      if (startDate > endDate) {
        const temp = startDate;
        startDate = endDate;
        endDate = temp;
      }

      let progress = 0;
      const status = (t.status || '').toLowerCase();
      if (status.includes('done') || status.includes('complete')) progress = 100;
      else if (status.includes('doing') || status.includes('progress')) progress = 50;
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const isOverdue = progress < 100 && endDate < today && !status.includes('cancel');

      return {
        start: startDate,
        end: endDate,
        name: t.task_name || `Task ${index + 1}`,
        id: t.id || `task-${index}`,
        type: 'task',
        progress: progress,
        isDisabled: true,
        styles: { 
          progressColor: isOverdue ? '#ef4444' : (progress === 100 ? '#10b981' : '#4f46e5'),
          progressSelectedColor: isOverdue ? '#dc2626' : (progress === 100 ? '#059669' : '#4338ca') 
        },
        originalStatus: t.status || 'To Do',
        isOverdue,
        description: t.description || '',
        // Support assignee_name (human readable), assignee_id (UUID), and legacy assignee
        assignee: t.assignee_name || (t.assignee_id as string) || (t as { assignee?: string }).assignee || ''
      } as unknown as Task; // Cast to unknown then Task to inject custom props
    });

    return taskItems;
  }, [tasks, project]);

  if (ganttTasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center text-slate-500">
        <AlertCircle className="w-12 h-12 mb-4 text-slate-300" />
        <h3 className="text-lg font-medium text-slate-900">No timeline data available</h3>
        <p className="mt-1">We couldn&apos;t find any tasks with valid dates for this project.</p>
      </div>
    );
  }

  // --- CUSTOM TABLE COMPONENTS ---
  const CustomTaskListHeader: React.FC<{ headerHeight: number; fontFamily: string; fontSize: string; }> = ({ headerHeight, fontFamily, fontSize }) => (
    <div className="flex border-b border-slate-200 bg-slate-50 text-slate-700 font-semibold" style={{ height: headerHeight, fontFamily, fontSize }}>
      <div className="flex-1 flex items-center px-3 border-r border-slate-200">Task Name</div>
      <div className="w-[120px] flex items-center justify-center">Status</div>
    </div>
  );

  const CustomTaskListTable: React.FC<{ rowHeight: number; tasks: (Task & { originalStatus?: string; isOverdue?: boolean })[]; fontFamily: string; fontSize: string; }> = ({ rowHeight, tasks, fontFamily, fontSize }) => {
    const handleStatusChange = async (taskId: string, newStatus: string, taskName: string) => {
      try {
        await axios.put('/api/tasks/status', { task_id: taskId, new_status: newStatus, task_name: taskName });
        showToast.success('Status updated successfully');
        router.refresh();
      } catch (error) {
        console.error(error);
        showToast.error('Failed to update status');
      }
    };

    return (
      <div style={{ fontFamily, fontSize }}>
        {tasks.map((t) => (
          <div key={t.id} className="flex border-b border-slate-100 text-slate-600 hover:bg-slate-50" style={{ height: rowHeight }}>
            <div className="flex-1 flex items-center px-3 border-r border-slate-100 truncate gap-2" title={t.name}>
              {t.isOverdue && !((t.originalStatus || '').toLowerCase().includes('cancel')) && <span title="Overdue"><Clock className="w-3.5 h-3.5 text-red-500 shrink-0" /></span>}
              <span className={
                (t.originalStatus || '').toLowerCase().includes('cancel')
                  ? 'line-through text-slate-400'
                  : t.isOverdue ? 'text-red-600 font-medium' : ''
              }>{t.name}</span>
            </div>
            <div className="w-[120px] flex items-center justify-center px-1">
              <select
                className={`w-full text-xs rounded border outline-none cursor-pointer h-7 font-medium ${
                  (() => {
                    const s = (t.originalStatus || '').toLowerCase();
                    if (s.includes('cancel')) return 'bg-slate-100 border-slate-300 text-slate-500';
                    if (s.includes('done') || s.includes('complete')) return 'bg-emerald-50 border-emerald-300 text-emerald-700';
                    if (s.includes('progress') || s.includes('doing')) return 'bg-blue-50 border-blue-300 text-blue-700';
                    if (s.includes('review')) return 'bg-purple-50 border-purple-300 text-purple-700';
                    if (s.includes('hold')) return 'bg-amber-50 border-amber-300 text-amber-700';
                    if (t.isOverdue) return 'bg-red-50 border-red-200 text-red-700';
                    return 'bg-slate-50 border-slate-200 text-slate-700';
                  })()
                }`}
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
        ))}
      </div>
    );
  };

  const CustomTooltip: React.FC<{ task: Task; fontSize: string; fontFamily: string }> = ({ task, fontSize, fontFamily }) => {
    const customTask = task as Task & { assignee?: string; description?: string; };
    return (
      <div className="bg-white rounded-lg shadow-lg border border-slate-200 p-3 max-w-sm" style={{ fontSize, fontFamily }}>
        <h4 className="font-semibold text-slate-900 mb-1">{task.name}</h4>
        <div className="text-xs text-slate-500 mb-2">
          {task.start.toLocaleDateString('en-GB')} - {task.end.toLocaleDateString('en-GB')} 
          {task.type !== 'project' && ` (${Math.round((task.end.getTime() - task.start.getTime()) / (1000 * 60 * 60 * 24))} days)`}
        </div>
        
        {customTask.assignee && (
          <div className="text-xs text-slate-700 bg-slate-50 p-1.5 rounded border border-slate-100 mb-2 inline-flex items-center gap-1.5">
            <span className="font-semibold">Assignee:</span> {customTask.assignee}
          </div>
        )}

        {customTask.description && (
          <div className="text-xs text-slate-600 whitespace-pre-wrap bg-indigo-50/50 p-2 rounded border border-indigo-50 mt-1 line-clamp-3">
            {customTask.description}
          </div>
        )}
        <div className="text-[10px] text-slate-400 mt-2 text-right">Click task to view full details</div>
      </div>
    );
  };

  const handleTaskClick = (task: Task) => {
    setSelectedTask(task);
  };

  return (
    <div className="w-full overflow-x-auto pb-4 relative">
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
      
      <div className="min-w-[800px]">
        <Gantt
          tasks={ganttTasks}
          viewMode={view}
          listCellWidth="300px"
          columnWidth={view === ViewMode.Month ? 120 : 60}
          rowHeight={35}
          barCornerRadius={4}
          fontFamily="inherit"
          fontSize="13px"
          TaskListHeader={CustomTaskListHeader}
          TaskListTable={CustomTaskListTable as unknown as React.FC<unknown>}
          TooltipContent={CustomTooltip}
          onClick={handleTaskClick}
        />
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
