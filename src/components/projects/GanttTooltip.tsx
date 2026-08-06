import React from 'react';
import { Task } from 'gantt-task-react';

interface GanttTooltipProps {
  task: Task;
  fontSize: string;
  fontFamily: string;
}

export const GanttTooltip: React.FC<GanttTooltipProps> = ({ task, fontSize, fontFamily }) => {
  const duration = (task as any).duration;
  return (
    <div className="bg-white rounded shadow-md border border-slate-200 px-3 py-2 whitespace-nowrap pointer-events-none" style={{ fontSize: '11px', fontFamily, zIndex: 9999 }}>
      <div className="font-semibold text-slate-800 mb-0.5">{task.name}</div>
      <div className="text-slate-600">
        {task.start.toLocaleDateString('en-GB')} - {task.end.toLocaleDateString('en-GB')}
      </div>
      <div className="text-slate-600 mt-0.5 font-medium">
        Duration: {duration != null ? `${duration} day(s)` : '-'}
      </div>
    </div>
  );
};
