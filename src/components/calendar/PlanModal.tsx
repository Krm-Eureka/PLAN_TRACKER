"use client"

import React, { useState } from 'react'
import { format } from 'date-fns'
import axios from 'axios'
import { showToast } from '@/utils'
import { X, Calendar as CalendarIcon, MapPin, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createPortal } from 'react-dom'

interface PlanModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedDate: Date | null;
  onSaved: () => void;
  projects?: { id?: string; project_code?: string; client_name?: string; project_name?: string }[];
  initialData?: any; // To support editing
}

export function PlanModal({ isOpen, onClose, selectedDate, onSaved, projects = [], initialData = null }: PlanModalProps) {
  const [location, setLocation] = useState('')
  const [planDetail, setPlanDetail] = useState('')
  const [durationDays, setDurationDays] = useState('1')
  const [projectId, setProjectId] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [mounted, setMounted] = useState(false)

  // Hydration fix for createPortal
  React.useEffect(() => {
    setMounted(true)
  }, [])

  // Populate data when editing
  React.useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setLocation(initialData.location || '')
        setPlanDetail(initialData.plan_detail || '')
        setDurationDays(initialData.duration_days || '1')
        setProjectId(initialData.project_id || '')
      } else {
        setLocation('')
        setPlanDetail('')
        setDurationDays('1')
        setProjectId('')
      }
    }
  }, [isOpen, initialData])

  if (!mounted || !isOpen || !selectedDate) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!location.trim()) {
      showToast.error("Missing required field", "Please enter a location or plan title.")
      return
    }

    try {
      setIsSubmitting(true)
      const formattedDate = format(selectedDate, 'yyyy-MM-dd')

      const payload = {
        start_date: formattedDate,
        location: location.trim(),
        duration_days: durationDays,
        project_id: projectId,   // UUID FK to Projects
        plan_detail: planDetail.trim()
      }

      let res;
      if (initialData && initialData.id) {
        // Edit mode
        res = await axios.put(`/api/plans/${initialData.id}`, payload)
      } else {
        // Create mode
        res = await axios.post('/api/plans', payload)
      }

      if (res.data.status === 'success') {
        showToast.success(initialData ? "Plan updated" : "Plan saved successfully", "Your plan has been updated.")
        setLocation('')
        setDurationDays('1')
        setProjectId('')
        onSaved()
        onClose()
      } else {
        throw new Error(res.data.message)
      }
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } }; message?: string };
      console.error("Failed to save plan:", err)
      showToast.error("Failed to save plan", err.response?.data?.message || err.message || "An unexpected error occurred.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">

        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100 bg-slate-50/50">
          <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
            <CalendarIcon className="w-5 h-5 text-indigo-600" />
            {initialData ? "Edit Plan" : "Add New Plan"}
          </h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors p-1 rounded-full hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Selected Date</label>
            <div className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-600 font-medium">
              {format(selectedDate, 'EEEE, MMMM do yyyy')}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-1">
              <MapPin className="w-4 h-4 text-slate-400" />
              Where are you going? / Plan Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. Client meeting at HQ, WFH, Leave..."
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Detail / Description
            </label>
            <textarea
              value={planDetail}
              onChange={(e) => setPlanDetail(e.target.value)}
              placeholder="More details about this plan..."
              rows={3}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-1">
              <Clock className="w-4 h-4 text-slate-400" />
              Duration (Days)
            </label>
            <select
              value={durationDays}
              onChange={(e) => setDurationDays(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors bg-white"
            >
              {[1, 2, 3, 4, 5, 6, 7].map(num => (
                <option key={num} value={num}>
                  {num} Day{num > 1 ? 's' : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-1">
              Project (Optional)
            </label>
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors bg-white"
            >
              <option value="">No Project</option>
              {projects.map((p) => (
                <option key={p.id || p.project_code} value={p.id || ''}>
                  [{p.project_code || p.id}] {p.client_name ? `${p.client_name} - ` : ''}{p.project_name}
                </option>
              ))}
            </select>
          </div>

          {/* Actions */}
          <div className="pt-4 flex justify-end gap-3 border-t border-slate-100">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting} className="bg-indigo-600 hover:bg-indigo-700 text-white">
              {isSubmitting ? "Saving..." : (initialData ? "Update Plan" : "Save Plan")}
            </Button>
          </div>
        </form>

      </div>
    </div>,
    document.body
  )
}
