"use client"

import React, { useState, useMemo } from 'react'
import { Gantt, Task, ViewMode } from 'gantt-task-react'
import "gantt-task-react/dist/index.css"
import { AlertCircle, Clock } from 'lucide-react'
import { useRouter } from 'next/navigation'
import axios from 'axios'
import { showToast } from '@/utils/toast'

interface GanttChartProps {
  tasks: any[];
  project: any;
}

export function GanttChart({ tasks, project }: GanttChartProps) {
  const [view, setView] = useState<ViewMode>(ViewMode.Month)
  const router = useRouter()

  const parseSafeDate = (dateStr: any): Date | null => {
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
          progress: 0,
          isDisabled: true,
          styles: { progressColor: '#4f46e5', progressSelectedColor: '#4338ca' }
        }];
      }
      return [];
    }

    return tasks.map((t, index) => {
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
      const isOverdue = progress < 100 && endDate < today;

      return {
        start: startDate,
        end: endDate,
        name: t.task_name || `Task ${index + 1}`,
        id: t.task_id || `task-${index}`,
        type: 'task',
        progress: progress,
        isDisabled: true,
        styles: { 
          progressColor: isOverdue ? '#ef4444' : (progress === 100 ? '#10b981' : '#4f46e5'),
          progressSelectedColor: isOverdue ? '#dc2626' : (progress === 100 ? '#059669' : '#4338ca') 
        },
        originalStatus: t.status || 'To Do',
        isOverdue
      } as any; // Cast to any to inject custom props
    });
  }, [tasks, project]);

  if (ganttTasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center text-slate-500">
        <AlertCircle className="w-12 h-12 mb-4 text-slate-300" />
        <h3 className="text-lg font-medium text-slate-900">No timeline data available</h3>
        <p className="mt-1">We couldn't find any tasks with valid dates for this project.</p>
      </div>
    );
  }

  // --- CUSTOM TABLE COMPONENTS ---
  const CustomTaskListHeader: React.FC<{ headerHeight: number; fontFamily: string; fontSize: string; }> = ({ headerHeight, fontFamily, fontSize }) => (
    <div className="flex border-b border-slate-200 bg-slate-50 text-slate-700 font-semibold" style={{ height: headerHeight, fontFamily, fontSize }}>
      <div className="flex-1 flex items-center px-3 border-r border-slate-200">Task Name</div>
      <div className="w-[120px] flex items-center justify-center border-r border-slate-200">Status</div>
      <div className="w-[75px] flex items-center justify-center border-r border-slate-200">Start</div>
      <div className="w-[75px] flex items-center justify-center">End</div>
    </div>
  );

  const CustomTaskListTable: React.FC<{ rowHeight: number; tasks: any[]; fontFamily: string; fontSize: string; }> = ({ rowHeight, tasks, fontFamily, fontSize }) => {
    const handleStatusChange = async (taskId: string, newStatus: string) => {
      // Don't update if it's the dummy project row
      if (taskId === 'Project') return;
      
      try {
        await axios.put('/api/tasks/status', { task_id: taskId, new_status: newStatus });
        showToast.success('Status updated successfully');
        router.refresh();
      } catch (error) {
        console.error(error);
        showToast.error('Failed to update status');
      }
    };

    const formatDate = (date: Date) => date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' });

    return (
      <div style={{ fontFamily, fontSize }}>
        {tasks.map((t) => (
          <div key={t.id} className="flex border-b border-slate-100 text-slate-600 hover:bg-slate-50" style={{ height: rowHeight }}>
            <div className="flex-1 flex items-center px-3 border-r border-slate-100 truncate gap-2" title={t.name}>
              {t.isOverdue && <Clock className="w-3.5 h-3.5 text-red-500 shrink-0" title="Overdue" />}
              <span className={t.isOverdue ? 'text-red-600 font-medium' : ''}>{t.name}</span>
            </div>
            <div className="w-[120px] flex items-center justify-center border-r border-slate-100 px-1">
              {t.id === 'Project' ? (
                <span className="text-xs text-slate-400">-</span>
              ) : (
                <select 
                  className={`w-full text-xs rounded border outline-none cursor-pointer h-7 ${
                    t.isOverdue && t.originalStatus !== 'Done' 
                      ? 'bg-red-50 border-red-200 text-red-700' 
                      : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-white focus:ring-1 focus:ring-indigo-500'
                  }`}
                  value={t.originalStatus}
                  onChange={(e) => handleStatusChange(t.id, e.target.value)}
                >
                  <option value="To Do">To Do</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Review">Review</option>
                  <option value="Done">Done</option>
                  <option value="Hold">Hold</option>
                  <option value="Cancel">Cancel</option>
                </select>
              )}
            </div>
            <div className="w-[75px] flex items-center justify-center border-r border-slate-100 text-xs">
              {formatDate(t.start)}
            </div>
            <div className="w-[75px] flex items-center justify-center text-xs">
              {formatDate(t.end)}
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="w-full overflow-x-auto pb-4">
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
          listCellWidth="450px"
          columnWidth={view === ViewMode.Month ? 200 : 60}
          rowHeight={35}
          barCornerRadius={4}
          fontFamily="inherit"
          fontSize="13px"
          TaskListHeader={CustomTaskListHeader}
          TaskListTable={CustomTaskListTable as any}
        />
      </div>
    </div>
  )
}
