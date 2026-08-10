"use client"

import React, { useState } from 'react'
import { FileText, Mail, Loader2 } from 'lucide-react'
import { useSession } from 'next-auth/react'
import { toast } from 'sonner'
import { ProjectData, TaskData } from '@/interfaces'
import { exportToPDF } from '@/utils/export'
import { generateGanttTasks } from '@/utils/gantt'
import { EmailUpdateModal } from './EmailUpdateModal'

interface TimelineActionsProps {
  project: ProjectData;
  tasks: TaskData[];
}

export function TimelineActions({ project, tasks }: TimelineActionsProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const { data: session } = useSession();

  const handleExportPDF = async () => {
    try {
      setIsExporting(true);
      await new Promise(resolve => setTimeout(resolve, 100)); // allow UI to update
      
      const taskDataMap = new Map<string, TaskData>();
      tasks.forEach(t => { if (t.id) taskDataMap.set(t.id, t); });
      const fullGanttTasks = generateGanttTasks(tasks, new Set(), taskDataMap, true);
      
      const exporterName = session?.user?.name || (session?.user as any)?.name_en || session?.user?.email || 'Unknown User';
      await exportToPDF(fullGanttTasks, tasks, project, exporterName);
      toast.success('PDF exported successfully');
    } catch (error) {
      console.error(error);
      toast.error('Failed to export PDF');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="flex gap-2 items-center">
      <button
        onClick={handleExportPDF}
        disabled={isExporting}
        className="flex items-center justify-center gap-1.5 text-sm border border-slate-200 rounded-md px-3 py-1.5 bg-white text-slate-700 shadow-sm hover:bg-slate-50 hover:text-emerald-600 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
      >
        {isExporting ? <Loader2 className="w-4 h-4 text-slate-500 animate-spin" /> : <FileText className="w-4 h-4 text-rose-500" />}
        {isExporting ? 'Exporting...' : 'Export Timeline Report'}
      </button>

      <button
        onClick={() => setIsEmailModalOpen(true)}
        className="flex items-center justify-center gap-1.5 text-sm border border-indigo-200 rounded-md px-3 py-1.5 bg-indigo-50 text-indigo-700 shadow-sm hover:bg-indigo-100 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/20 whitespace-nowrap"
      >
        <Mail className="w-4 h-4" />
        Email Update
      </button>

      <EmailUpdateModal
        isOpen={isEmailModalOpen}
        onClose={() => setIsEmailModalOpen(false)}
        project={project}
        tasks={tasks}
        ganttTasks={generateGanttTasks(tasks, new Set(), new Map(tasks.map(t => [t.id!, t])), true)}
      />
    </div>
  );
}
