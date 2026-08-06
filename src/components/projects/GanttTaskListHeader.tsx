import React from 'react';

interface GanttTaskListHeaderProps {
  headerHeight: number;
  fontFamily: string;
  fontSize: string;
}

export const GanttTaskListHeader: React.FC<GanttTaskListHeaderProps> = ({
  headerHeight,
  fontFamily,
  fontSize
}) => (
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
