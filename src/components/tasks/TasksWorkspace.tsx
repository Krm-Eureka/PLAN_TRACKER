'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
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

export function TasksWorkspace({ tasks, users, department }: TasksWorkspaceProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // view: 'table' | 'board' | 'calendar'
  const currentView = searchParams?.get('view') || 'table';

  const setView = (view: string) => {
    const params = new URLSearchParams(searchParams?.toString() || '');
    params.set('view', view);
    router.push(`/tasks?${params.toString()}`);
  };

  return (
    <div className="space-y-4 h-[calc(100vh-140px)] flex flex-col">
      {/* View Switcher */}
      <div className="flex bg-slate-100/80 p-1.5 rounded-xl w-fit border border-slate-200/60 shadow-sm shrink-0">
        <button
          onClick={() => setView('table')}
          className={cn(
            "flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-all duration-200",
            currentView === 'table' 
              ? "bg-white text-emerald-700 shadow-sm ring-1 ring-emerald-500/20" 
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/50"
          )}
        >
          <ListTodo className="w-4 h-4" />
          List
        </button>
        <button
          onClick={() => setView('board')}
          className={cn(
            "flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-all duration-200",
            currentView === 'board' 
              ? "bg-white text-emerald-700 shadow-sm ring-1 ring-emerald-500/20" 
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/50"
          )}
        >
          <LayoutGrid className="w-4 h-4" />
          Board
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 min-h-0 overflow-hidden relative">
        <div className={cn("absolute inset-0 transition-opacity duration-300", currentView === 'table' ? "opacity-100 z-10" : "opacity-0 pointer-events-none -z-10")}>
          <div className="h-full overflow-y-auto pb-8">
            <TasksTable tasks={tasks} users={users} department={department} />
          </div>
        </div>
        
        <div className={cn("absolute inset-0 transition-opacity duration-300 flex flex-col", currentView === 'board' ? "opacity-100 z-10" : "opacity-0 pointer-events-none -z-10")}>
          <div className="flex-1 min-h-0 overflow-hidden pt-2">
            <KanbanBoard />
          </div>
        </div>
      </div>
    </div>
  );
}
