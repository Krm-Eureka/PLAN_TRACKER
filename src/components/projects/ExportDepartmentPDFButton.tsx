'use client';

import { useState } from 'react';
import { Download, FileText } from 'lucide-react';
import { ProjectData } from '@/interfaces';
import { exportDepartmentPDF } from '@/utils/exportDepartmentPDF';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';

interface ExportDepartmentPDFButtonProps {
  projects: ProjectData[];
  department: string;
  exporterName: string;
}

export function ExportDepartmentPDFButton({ projects, department, exporterName }: ExportDepartmentPDFButtonProps) {
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    if (projects.length === 0) {
      toast.error("No projects to export.");
      return;
    }
    
    setIsExporting(true);
    toast.info("Generating PDF Report...");
    
    try {
      await exportDepartmentPDF(projects, department, exporterName);
      toast.success("PDF Exported Successfully!");
    } catch (error) {
      console.error("Export error:", error);
      toast.error("Failed to export PDF.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Button 
      onClick={handleExport} 
      disabled={isExporting || projects.length === 0}
      variant="outline"
      className="gap-2 text-indigo-600 border-indigo-200 hover:bg-indigo-50"
    >
      {isExporting ? <Download className="w-4 h-4 animate-bounce" /> : <FileText className="w-4 h-4" />}
      {isExporting ? 'Exporting...' : 'Export PDF'}
    </Button>
  );
}
