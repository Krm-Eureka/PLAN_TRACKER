"use client"

import React, { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Download, Loader2, ChevronDown, FileSpreadsheet, FileText, Package } from 'lucide-react'
import { ProjectData, TaskData } from '@/interfaces'
import { exportGanttToExcel } from '@/utils/exportGanttExcel'
import { exportGanttToPDF } from '@/utils/exportGanttPDF'
import { exportToPDF } from '@/utils/export'
import { generateGanttTasks } from '@/utils/gantt'
import { useSession } from 'next-auth/react'

interface ExportGanttExcelButtonProps {
  project: ProjectData;
  tasks: TaskData[];
}

export function ExportGanttExcelButton({ project, tasks }: ExportGanttExcelButtonProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { data: session } = useSession();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleExportExcel = async () => {
    setIsOpen(false);
    setIsExporting(true);
    try {
      await exportGanttToExcel(project, tasks);
    } catch (error) {
      console.error("Failed to export Gantt Excel", error);
      alert("Failed to export Gantt Excel. Please try again.");
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportPDF = async () => {
    setIsOpen(false);
    setIsExporting(true);
    try {
      await exportGanttToPDF(project, tasks);
    } catch (error) {
      console.error("Failed to export Gantt PDF", error);
      alert("Failed to export Gantt PDF. Please try again.");
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportAll = async () => {
    setIsOpen(false);
    setIsExporting(true);
    try {
      await exportGanttToExcel(project, tasks);
      await exportGanttToPDF(project, tasks);
    } catch (error) {
      console.error("Failed to export All", error);
      alert("Failed to export All. Please try again.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
        disabled={isExporting}
        className="bg-white border-emerald-200 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800"
      >
        {isExporting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
        Export Gantt
        <ChevronDown className="w-4 h-4 ml-1" />
      </Button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 bg-white border border-slate-200 rounded-md shadow-lg z-50 overflow-hidden">
          <button
            onClick={handleExportExcel}
            className="w-full flex items-center px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 hover:text-emerald-600 transition-colors"
          >
            <FileSpreadsheet className="w-4 h-4 mr-2 text-emerald-500" />
            Export as XLSX
          </button>
          <button
            onClick={handleExportPDF}
            className="w-full flex items-center px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 hover:text-red-600 transition-colors"
          >
            <FileText className="w-4 h-4 mr-2 text-red-500" />
            Export as PDF
          </button>
          <div className="border-t border-slate-100"></div>
          <button
            onClick={handleExportAll}
            className="w-full flex items-center px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 hover:text-indigo-600 transition-colors"
          >
            <Package className="w-4 h-4 mr-2 text-indigo-500" />
            Export All (2 Files)
          </button>
        </div>
      )}
    </div>
  );
}
