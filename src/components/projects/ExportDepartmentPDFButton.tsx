'use client';

import { useState } from 'react';
import { Download, FileText } from 'lucide-react';
import { ProjectData, UserData } from '@/interfaces';
import { exportDepartmentPDF } from '@/utils/exportDepartmentPDF';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface ExportDepartmentPDFButtonProps {
  projects: ProjectData[];
  users: UserData[];
  department: string;
  exporterName: string;
}

export function ExportDepartmentPDFButton({ projects, users, department, exporterName }: ExportDepartmentPDFButtonProps) {
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async (filterMode: 'all' | 'active_this_month') => {
    let projectsToExport = projects;

    if (filterMode === 'active_this_month') {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

      projectsToExport = projects.filter(p => {
        const sLow = (p.status || '').toLowerCase();
        const isDoneOrCancel = sLow.includes('done') || sLow.includes('complete') || sLow.includes('cancel');
        
        // If it's done or cancelled and its target end date is before this month, hide it
        const pEnd = p.end_date ? new Date(p.end_date) : null;
        if (isDoneOrCancel && pEnd && pEnd < startOfMonth) return false;

        // If it hasn't even started (starts after this month), hide it
        const pStart = p.start_date ? new Date(p.start_date) : null;
        if (pStart && pStart > endOfMonth) return false;

        return true;
      });
    }

    if (projectsToExport.length === 0) {
      toast.error("No projects found for the selected criteria.");
      return;
    }
    
    setIsExporting(true);
    toast.info("Generating PDF Report...");
    
    try {
      await exportDepartmentPDF(projectsToExport, users, department, exporterName);
      toast.success("PDF Exported Successfully!");
    } catch (error) {
      console.error("Export error:", error);
      toast.error("Failed to export PDF.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger 
        disabled={isExporting || projects.length === 0}
        className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 border bg-transparent shadow-sm h-9 px-4 py-2 gap-2 text-indigo-600 border-indigo-200 hover:bg-indigo-50"
      >
        {isExporting ? <Download className="w-4 h-4 animate-bounce" /> : <FileText className="w-4 h-4" />}
        {isExporting ? 'Exporting...' : 'Export PDF'}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem onClick={() => handleExport('active_this_month')} className="cursor-pointer">
          <FileText className="w-4 h-4 mr-2 text-indigo-600" />
          Active Projects (This Month)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExport('all')} className="cursor-pointer">
          <Download className="w-4 h-4 mr-2 text-slate-500" />
          All Projects (Unfiltered)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
