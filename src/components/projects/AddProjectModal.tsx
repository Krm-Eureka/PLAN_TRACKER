"use client"

import React, { useState } from 'react'
import axios from 'axios'
import { showToast } from '@/utils'
import { X, FolderPlus } from 'lucide-react'
import { UserData } from '@/interfaces';
import { Button } from '@/components/ui/button'
import { useSession } from 'next-auth/react'

import { formatDateYYYYMMDD } from '@/utils/date'

interface AddProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  users: UserData[];
}

export function AddProjectModal({ isOpen, onClose, onSaved, users }: AddProjectModalProps) {
  const { data: session } = useSession();
  const currentUserRole = (session as { role_system?: string })?.role_system?.toLowerCase() || '';
  const currentUserPos = (session as { position?: string })?.position?.toLowerCase() || '';
  const isSuperUser = currentUserRole.includes('admin') || currentUserRole.includes('superadmin') || currentUserPos.includes('md') || currentUserRole.includes('md');

  const [formData, setFormData] = useState({
    project_code: '',
    project_name: '',
    description: '',
    manager_id: '',
    start_date: formatDateYYYYMMDD(new Date()),
    end_date: formatDateYYYYMMDD(new Date(Date.now() + 30 * 86400000)), // Default 1 month
    status: 'Planning',
    priority: 'Medium',
    department: ''
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
          manager_id: '',
          start_date: formatDateYYYYMMDD(new Date()),
          end_date: formatDateYYYYMMDD(new Date(Date.now() + 30 * 86400000)),
          status: 'Planning',
          priority: 'Medium',
          department: ''
        })
        onSaved()
        onClose()
      } else {
        throw new Error(res.data.message)
      }
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } }; message?: string };
      console.error("Failed to save project:", err)
      showToast.error("Error", err.response?.data?.message || err.message || "Failed to create project")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col animate-in zoom-in-95 duration-200">

        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100 bg-slate-50/50">
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Client Name</label>
              <input
                name="client_name"
                type="text"
                value={(formData as { client_name?: string }).client_name || ''}
                onChange={handleChange}
                placeholder="e.g. MEKTEC"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors"
              />
            </div>
            
            {/* Departments Multi-select Checkboxes */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Departments</label>
              <div className="p-3 border border-slate-200 rounded-lg bg-slate-50 max-h-32 overflow-y-auto">
                <div className="flex flex-wrap gap-2">
                  {Array.from(new Set(users.map(u => (u.department || u.position || '').trim()).filter(Boolean))).sort().map(dept => {
                    const isSelected = formData.department.split(',').map(d => d.trim()).includes(dept);
                    return (
                      <label key={dept} className={`cursor-pointer flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium transition-colors ${isSelected ? 'bg-indigo-100 border-indigo-300 text-indigo-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'}`}>
                        <input
                          type="checkbox"
                          className="sr-only"
                          checked={isSelected}
                          onChange={(e) => {
                            const current = formData.department.split(',').map(d => d.trim()).filter(Boolean);
                            if (e.target.checked) {
                              setFormData({ ...formData, department: [...current, dept].join(', ') });
                            } else {
                              setFormData({ ...formData, department: current.filter(d => d !== dept).join(', ') });
                            }
                          }}
                        />
                        {dept}
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Project Manager (PM)</label>
            <select
              name="manager_id"
              value={formData.manager_id}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors bg-white"
            >
              <option value="">Select a manager</option>
              {users
                .filter(user => {
                  if (isSuperUser) return true; // Super user can assign anyone
                  
                  const selectedDepts = formData.department.split(',').map(d => d.trim()).filter(Boolean);
                  const role = (user.role_system || '').toLowerCase();
                  const pos = (user.position || '').toLowerCase();
                  
                  // 1. อยู่ในแผนกที่เลือกไว้ (เลือกได้ทุกคนในแผนก)
                  const inDept = selectedDepts.length === 0 || selectedDepts.includes((user.department || user.position || '').trim());
                  
                  // 2. เป็นระดับบริหารหรือ MD (แสดงเสมอไม่ว่าจะเลือกแผนกอะไร)
                  const isManagement = role.includes('admin') || role.includes('manager') || pos.includes('md') || pos.includes('manager') || pos.includes('director');
                  
                  return inDept || isManagement;
                })
                .map(user => (
                  <option key={user.id} value={user.id}>
                    {user.name_en || user.name_th} ({user.department || user.position})
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
