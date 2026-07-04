"use client"

import React, { useState } from 'react'
import { format } from 'date-fns'
import axios from 'axios'
import { showToast } from '@/utils/toast'
import { X, Calendar as CalendarIcon, MapPin, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface PlanModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedDate: Date | null;
  onSaved: () => void;
}

export function PlanModal({ isOpen, onClose, selectedDate, onSaved }: PlanModalProps) {
  const [location, setLocation] = useState('')
  const [durationDays, setDurationDays] = useState('1')
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (!isOpen || !selectedDate) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!location.trim()) {
      showToast.error("Missing required field", "Please enter a location or plan details.")
      return
    }

    try {
      setIsSubmitting(true)
      const formattedDate = format(selectedDate, 'yyyy-MM-dd')
      
      const payload = {
        start_date: formattedDate,
        location: location.trim(),
        duration_days: durationDays
      }

      const res = await axios.post('/api/plans', payload)
      
      if (res.data.status === 'success') {
        showToast.success("Plan saved successfully", "Your plan has been added to the calendar.")
        setLocation('')
        setDurationDays('1')
        onSaved()
        onClose()
      } else {
        throw new Error(res.data.message)
      }
    } catch (error: any) {
      console.error("Failed to save plan:", error)
      showToast.error("Failed to save plan", error.response?.data?.message || error.message || "An unexpected error occurred.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
            <CalendarIcon className="w-5 h-5 text-indigo-600" />
            Add New Plan
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
              Where are you going?
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

          {/* Actions */}
          <div className="pt-4 flex justify-end gap-3 border-t border-slate-100">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting} className="bg-indigo-600 hover:bg-indigo-700 text-white">
              {isSubmitting ? "Saving..." : "Save Plan"}
            </Button>
          </div>
        </form>

      </div>
    </div>
  )
}
