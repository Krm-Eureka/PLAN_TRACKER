"use client"

import React, { useState } from 'react'
import axios from 'axios'
import { showToast } from '@/utils'
import { X, ClipboardList } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface AddTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  users: { emp_id: string; name_en: string; name_th: string; department?: string; position?: string }[];
  projectCode: string;
}

export function AddTaskModal({ isOpen, onClose, onSaved, users, projectCode }: AddTaskModalProps) {
  const [formData, setFormData] = useState({
    task_id: `TSK-${Math.floor(Math.random() * 10000)}`, // Auto generate or can be empty
    task_name: '',
    description: '',
    assignee: '',
    start_date: '',
    due_date: '',
    status: 'To Do',
    priority: 'Medium'
  })
  
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (!isOpen) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.task_name) {
      showToast.error("Missing fields", "Task Name is required.")
      return
    }

    try {
      setIsSubmitting(true)
      
      const res = await axios.post('/api/tasks', {
        ...formData,
        project_code: projectCode
      })
      
      if (res.data.status === 'success') {
        showToast.success("Task Created", "New task has been added to the project.")
        // Reset form
        setFormData({
          task_id: `TSK-${Math.floor(Math.random() * 10000)}`,
          task_name: '',
          description: '',
          assignee: '',
          start_date: '',
          due_date: '',
          status: 'To Do',
          priority: 'Medium'
        })
        onSaved()
        onClose()
      } else {
        throw new Error(res.data.message)
      }
    } catch (error: any) {
      console.error("Failed to save task:", error)
      showToast.error("Error", error.response?.data?.message || error.message || "Failed to create task")
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
            <ClipboardList className="w-5 h-5 text-indigo-600" />
            Add New Task
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
              <label className="block text-sm font-medium text-slate-700 mb-1">Task ID</label>
              <input 
                name="task_id"
                type="text" 
                value={formData.task_id}
                onChange={handleChange}
                placeholder="e.g. TSK-001"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors bg-slate-50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Task Name <span className="text-red-500">*</span></label>
              <input 
                name="task_name"
                type="text" 
                required
                value={formData.task_name}
                onChange={handleChange}
                placeholder="e.g. Design Homepage"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
            <textarea 
              name="description"
              rows={3}
              value={formData.description}
              onChange={handleChange}
              placeholder="Detailed description of the task..."
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Assignee (@mention)</label>
            <select
              name="assignee"
              value={formData.assignee}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors bg-white"
            >
              <option value="">Select Assignee</option>
              {users.map(user => (
                <option key={user.emp_id} value={user.name_th || user.name_en}>
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
              <label className="block text-sm font-medium text-slate-700 mb-1">Due Date</label>
              <input 
                name="due_date"
                type="date" 
                value={formData.due_date}
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
                <option value="To Do">To Do</option>
                <option value="In Progress">In Progress</option>
                <option value="Review">Review</option>
                <option value="Done">Done</option>
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
              {isSubmitting ? "Saving..." : "Save Task"}
            </Button>
          </div>
        </form>

      </div>
    </div>
  )
}
