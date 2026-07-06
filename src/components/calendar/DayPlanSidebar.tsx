"use client"

import React, { useState } from 'react'
import { format } from 'date-fns'
import { X, MapPin, Edit2, Trash2, Plus, Clock, Loader2, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ProjectData } from '@/interfaces'
import axios from 'axios'
import { showToast } from '@/utils'
import { useSession } from 'next-auth/react'
import { createPortal } from 'react-dom'

interface Plan {
  id: string;
  emp_id: string;
  name: string;
  start_date: string;
  location: string;
  duration_days: string;
  user_id: string;
  project_id?: string;
  start_time?: string;
  end_time?: string;
}

interface DayPlanSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  selectedDate: Date | null;
  plans: Plan[];
  projects: ProjectData[];
  onAddNewClick: () => void;
  onEditClick: (plan: Plan) => void;
  onPlanDeleted: () => void;
}

export function DayPlanSidebar({ 
  isOpen, 
  onClose, 
  selectedDate, 
  plans, 
  projects,
  onAddNewClick,
  onEditClick,
  onPlanDeleted
}: DayPlanSidebarProps) {
  const { data: session } = useSession();
  const currentUserId = (session as { id?: string })?.id;
  
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || !selectedDate) return null;

  const handleDelete = async (plan: Plan) => {
    if (!confirm("Are you sure you want to delete this plan?")) return;
    
    try {
      setDeletingId(plan.id);
      const res = await axios.delete(`/api/plans/${plan.id}`);
      if (res.data.status === 'success') {
        showToast.success("Deleted", "Your plan has been deleted successfully.");
        onPlanDeleted();
      } else {
        throw new Error(res.data.message);
      }
    } catch (error: any) {
      console.error("Failed to delete plan:", error);
      showToast.error("Failed to delete plan", error.response?.data?.message || error.message);
    } finally {
      setDeletingId(null);
    }
  };

  return createPortal(
    <>
      {/* Backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-40 bg-slate-900/20 backdrop-blur-sm transition-opacity"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <div 
        className={`fixed inset-y-0 right-0 z-50 w-full sm:w-96 bg-white shadow-2xl border-l border-slate-100 transform transition-transform duration-300 ease-in-out flex flex-col ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 bg-slate-50/50">
          <div>
            <h3 className="text-lg font-semibold text-slate-800">
              {format(selectedDate, 'EEEE')}
            </h3>
            <p className="text-sm text-slate-500">
              {format(selectedDate, 'MMMM do, yyyy')}
            </p>
          </div>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors p-2 rounded-full hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-slate-700 uppercase tracking-wider">Plans for today</h4>
            <Button size="sm" onClick={onAddNewClick} className="bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border-0 h-8 px-3">
              <Plus className="w-4 h-4 mr-1" />
              Add Plan
            </Button>
          </div>

          {plans.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
              <AlertCircle className="w-8 h-8 text-slate-300 mb-3" />
              <p className="text-slate-500 font-medium">No plans for this day</p>
              <p className="text-sm text-slate-400 mt-1">Click the button above to add one.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {plans.map((plan) => {
                const isOwner = currentUserId && plan.user_id === currentUserId;
                const project = projects.find(p => p.id === plan.project_id);
                const isDeleting = deletingId === plan.id;

                return (
                  <div key={plan.id} className={`p-4 rounded-xl border ${isOwner ? 'border-indigo-100 bg-indigo-50/30' : 'border-slate-100 bg-slate-50'} relative group`}>
                    
                    {/* Action Buttons for Owner */}
                    {isOwner && (
                      <div className="absolute top-3 right-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => onEditClick(plan)}
                          disabled={isDeleting}
                          className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors disabled:opacity-50"
                          title="Edit Plan"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button 
                          onClick={() => handleDelete(plan)}
                          disabled={isDeleting}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
                          title="Delete Plan"
                        >
                          {isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin text-red-500" /> : <Trash2 className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    )}

                    <div className="flex items-start gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${isOwner ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-200 text-slate-600'}`}>
                        <span className="text-xs font-bold">{plan.name.substring(0, 2).toUpperCase()}</span>
                      </div>
                      <div className="flex-1 min-w-0 pr-12">
                        <p className="font-semibold text-slate-800 text-sm">{plan.name}</p>
                        
                        <div className="mt-2 space-y-1.5">
                          <div className="flex items-start gap-1.5 text-sm text-slate-600">
                            <MapPin className="w-4 h-4 mt-0.5 text-slate-400 shrink-0" />
                            <span className="leading-snug">{plan.location}</span>
                          </div>
                          
                          {parseInt(plan.duration_days || '1') > 1 && (
                            <div className="flex items-center gap-1.5 text-xs text-slate-500">
                              <Clock className="w-3.5 h-3.5 shrink-0" />
                              <span>{plan.duration_days} Days</span>
                            </div>
                          )}

                          {(plan.start_time || plan.end_time) && (
                            <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                              <Clock className="w-3.5 h-3.5 shrink-0 text-indigo-400" />
                              <span>
                                {plan.start_time || '?'} - {plan.end_time || '?'}
                              </span>
                            </div>
                          )}

                          {project && (
                            <div className="mt-2 inline-flex items-center gap-1 px-2 py-1 rounded-md bg-white border border-slate-200 text-xs text-slate-600 font-medium">
                              <span className="w-2 h-2 rounded-full bg-blue-400"></span>
                              <span className="truncate max-w-[200px]">[{project.project_code}] {project.project_name}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </>,
    document.body
  )
}
