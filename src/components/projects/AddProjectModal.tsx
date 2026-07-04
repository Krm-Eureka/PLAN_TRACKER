"use client"

import React, { useState } from 'react'
import axios from 'axios'
import { showToast } from '@/utils'
import { X, FolderPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface AddProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  users: { emp_id: string; name_en: string; name_th: string }[];
}

export function AddProjectModal({ isOpen, onClose, onSaved, users }: AddProjectModalProps) {
  const [formData, setFormData] = useState({
    project_code: '',
    project_name: '',
    description: '',
    manager: '',
    start_date: '',
    end_date: '',
    status: 'Planning',
    priority: 'Medium'
  })
  
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (!isOpen) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.project_code || !formData.project_name) {
      showToast.error("Missing fields", "Project Code and Name are required.")
      return
    }

    try {
      setIsSubmitting(true)
      
      const res = await axios.post('/api/projects', formData)
      
      if (res.data.status === 'success') {
        showToast.success("Project Created", "New project has been added successfully.")
        // Reset form
        setFormData({
          project_code: '',
          project_name: '',
          description: '',
          manager: '',
          start_date: '',
          end_date: '',
          status: 'Planning',
          priority: 'Medium'
        })
        onSaved()
        onClose()
      } else {
        throw new Error(res.data.message)
      }
    } catch (error: any) {
      console.error("Failed to save project:", error)
      showToast.error("Error", error.response?.data?.message || error.message || "Failed to create project")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
            <FolderPlus className="w-5 h-5 text-indigo-600" />
            Create New Project
          </h3>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors p-1 rounded-full hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto flex-1 space-y-5">
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Project Code <span className="text-red-500">*</span></label>
              <input 
                name="project_code" 
                type="text" 
                required
                value={formData.project_code}
                onChange={handleChange}
                placeholder="e.g. 26LA004"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors uppercase"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Project Name <span className="text-red-500">*</span></label>
              <input 
                name="project_name"
                type="text" 
                required
                value={formData.project_name}
                onChange={handleChange}
                placeholder="e.g. ASRS for Gravure Printing Cylinders"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Client Name</label>
            <input 
              name="client_name"
              type="text" 
              value={(formData as any).client_name || ''}
              onChange={handleChange}
              placeholder="e.g. MEKTEC"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Project Manager (PM)</label>
            <select
              name="manager"
              value={formData.manager}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors bg-white"
            >
              <option value="">Select Manager</option>
              {users.map(user => (
                <option key={user.emp_id} value={(user as any).email || user.name_en}>
                  {user.name_th || user.name_en} ({user.department || user.position})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Start Date</label>
              <input 
                name="start_date"
                type="date" 
                value={formData.start_date}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Target End Date</label>
              <input 
                name="end_date"
                type="date" 
                value={formData.end_date}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
              <select
                name="status"
                value={formData.status}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors bg-white"
              >
                <option value="Planning">Planning</option>
                <option value="In Progress">In Progress</option>
                <option value="On Hold">On Hold</option>
                <option value="Done">Done</option>
                <option value="Cancelled">Cancelled</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Priority</label>
              <select
                name="priority"
                value={formData.priority}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors bg-white"
              >
                <option value="High">High</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low</option>
              </select>
            </div>
          </div>

          {/* Actions */}
          <div className="pt-4 flex justify-end gap-3 border-t border-slate-100 mt-6">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting} className="bg-indigo-600 hover:bg-indigo-700 text-white">
              {isSubmitting ? "Creating..." : "Create Project"}
            </Button>
          </div>
        </form>

      </div>
    </div>
  )
}
