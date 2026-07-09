"use client"

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Trash2, X } from 'lucide-react';
import { ProjectData } from '@/interfaces';
import axios from 'axios';
import { useRouter, usePathname } from 'next/navigation';
import { showToast } from '@/utils/toast';

interface DeleteProjectModalProps {
  project: ProjectData;
  isOpen: boolean;
  onClose: () => void;
}

export function DeleteProjectModal({ project, isOpen, onClose }: DeleteProjectModalProps) {
  const [confirmName, setConfirmName] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [mounted, setMounted] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!isOpen || !mounted) return null;

  const isMatch = confirmName === project.project_name;

  const handleDelete = async () => {
    if (!isMatch) return;
    
    setIsDeleting(true);
    try {
      const res = await axios.delete(`/api/projects/${project.id || project.project_code}`);
      
      if (res.status === 200) {
        showToast.success('Project deleted successfully');
        onClose();
        if (pathname === '/projects') {
          router.refresh();
        } else {
          router.push('/projects');
        }
      } else {
        throw new Error(res.data.message || 'Failed to delete project');
      }
    } catch (error: any) {
      console.error('Error deleting project:', error);
      showToast.error(error.response?.data?.message || error.message || 'Failed to delete project');
    } finally {
      setIsDeleting(false);
    }
  };

  return createPortal(
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
    >
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md flex flex-col animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-red-50/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 text-red-600 rounded-lg">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-semibold text-red-700">Delete Project</h2>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          <p className="text-slate-600">
            This action cannot be undone. This will permanently delete the project <span className="font-bold text-slate-800">{project.project_name}</span> and remove all associated tasks and data.
          </p>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-700">
              Please type <span className="font-bold select-all bg-slate-100 px-1.5 py-0.5 rounded">{project.project_name}</span> to confirm.
            </label>
            <input
              type="text"
              value={confirmName}
              onChange={(e) => setConfirmName(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-colors"
              placeholder={project.project_name}
            />
          </div>
        </div>

        {/* Actions */}
        <div className="p-5 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={isDeleting}
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-200 disabled:opacity-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            disabled={!isMatch || isDeleting}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors shadow-sm"
          >
            {isDeleting ? (
              <>
                <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                Deleting...
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4" />
                Delete Project
              </>
            )}
          </button>
        </div>

      </div>
    </div>,
    document.body
  );
}
