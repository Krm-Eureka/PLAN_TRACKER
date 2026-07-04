"use client"

import React, { useState, useMemo } from 'react'
import { Gantt, Task, ViewMode } from 'gantt-task-react'
import "gantt-task-react/dist/index.css"
import { AlertCircle } from 'lucide-react'

interface GanttChartProps {
  tasks: any[];
  project: any;
}

export function GanttChart({ tasks, project }: GanttChartProps) {
  const [view, setView] = useState<ViewMode>(ViewMode.Month)

  // Helper to safely parse dates that might be in DD/MM/YYYY or YYYY-MM-DD format
  const parseSafeDate = (dateStr: any): Date | null => {
    if (!dateStr) return null;
    if (dateStr instanceof Date) return isNaN(dateStr.getTime()) ? null : dateStr;
    
    const str = String(dateStr).trim();
    // Check for DD/MM/YYYY or DD-MM-YYYY
    const dmyMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (dmyMatch) {
      const day = parseInt(dmyMatch[1], 10);
      const month = parseInt(dmyMatch[2], 10) - 1; // 0-indexed
      const year = parseInt(dmyMatch[3], 10);
      const d = new Date(year, month, day);
      if (!isNaN(d.getTime())) return d;
    }

    // Fallback to standard parsing
    const parsed = new Date(str);
    if (!isNaN(parsed.getTime())) return parsed;

    return null;
  };

  // Transform Google Sheets tasks into gantt-task-react format
  const ganttTasks: Task[] = useMemo(() => {
    // If no tasks found for this project, create a dummy task based on project dates so chart isn't empty
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
      endDate.setDate(endDate.getDate() + 7); // Default to 1 week if no end date

      const parsedStart = parseSafeDate(t.start_date);
      if (parsedStart) startDate = parsedStart;
      
      const parsedEnd = parseSafeDate(t.end_date || t.due_date);
      if (parsedEnd) endDate = parsedEnd;

      // Ensure start is before end
      if (startDate > endDate) {
        const temp = startDate;
        startDate = endDate;
        endDate = temp;
      }

      // Determine progress based on status
      let progress = 0;
      const status = (t.status || '').toLowerCase();
      if (status.includes('done') || status.includes('complete')) progress = 100;
      else if (status.includes('doing') || status.includes('progress')) progress = 50;

      return {
        start: startDate,
        end: endDate,
        name: t.task_name || `Task ${index + 1}`,
        id: t.task_id || `task-${index}`,
        type: 'task',
        progress: progress,
        isDisabled: true, // Read-only for now
        styles: { 
          progressColor: progress === 100 ? '#10b981' : '#4f46e5',
          progressSelectedColor: progress === 100 ? '#059669' : '#4338ca' 
        }
      } as Task;
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
          listCellWidth="350px"
          columnWidth={view === ViewMode.Month ? 200 : 60}
          rowHeight={35}
          barCornerRadius={4}
          fontFamily="inherit"
          fontSize="13px"
        />
      </div>
    </div>
  )
}
