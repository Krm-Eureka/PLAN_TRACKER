"use client"

import React, { useState, useEffect } from 'react'
import axios from 'axios'
import { showToast } from '@/utils'
import { X, Edit3, Settings } from 'lucide-react'
import { createPortal } from 'react-dom'
import { UserData, ProjectData } from '@/interfaces';
import { Button } from '@/components/ui/button'
import { useSession } from 'next-auth/react'

interface EditProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  users: UserData[];
  project: ProjectData;
  departments?: { id: string, name: string }[];
}

export function EditProjectModal({ isOpen, onClose, onSaved, users, project, departments = [] }: EditProjectModalProps) {
  const [mounted, setMounted] = useState(false)
  const { data: session } = useSession();
  const currentUserRole = (session as { role_system?: string })?.role_system?.toLowerCase() || '';
  const currentUserPos = (session as { position?: string })?.position?.toLowerCase() || '';
  const isSuperUser = currentUserRole.includes('admin') || currentUserRole.includes('superadmin') || currentUserPos.includes('md') || currentUserRole.includes('md');

  const [formData, setFormData] = useState({
    project_code: project.project_code || '',
    project_name: project.project_name || '',
    client_name: project.client_name || '',
    manager_id: project.manager_id || '',
    start_date: project.start_date || '',
    end_date: project.end_date || '',
    status: project.status || 'Planning',
    priority: project.priority || 'Medium',
    department: project.department || '',
    project_email_update: project.project_email_update || '',
    color: project.color || '#10b981'
  })

  useEffect(() => {
    setMounted(true)
    if (isOpen) {
      setFormData({
        project_code: project.project_code || '',
        project_name: project.project_name || '',
        client_name: project.client_name || '',
        manager_id: project.manager_id || '',
        start_date: project.start_date || '',
        end_date: project.end_date || '',
        status: project.status || 'Planning',
        priority: project.priority || 'Medium',
        department: project.department || '',
        project_email_update: project.project_email_update || '',
        color: project.color || '#10b981'
      });
    }
  }, [isOpen, project]);

  const [isSubmitting, setIsSubmitting] = useState(false)

  if (!isOpen || !mounted) return null;

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

      const projectId = project.id || project.project_code;
      const res = await axios.put(`/api/projects/${encodeURIComponent(projectId)}`, formData)

      if (res.data.status === 'success') {
        showToast.success("Project Updated", "The project has been updated successfully.")
        onSaved()
        onClose()
      } else {
        throw new Error(res.data.message)
      }
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } }; message?: string };
      console.error("Failed to update project:", err)
      showToast.error("Error", err.response?.data?.message || err.message || "Failed to update project")
    } finally {
      setIsSubmitting(false)
    }
  }

  return createPortal(
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200"
      onPointerDown={(e) => e.stopPropagation()}
      onPointerUp={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      <div 
        className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >

        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100 bg-slate-50/50">
          <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
            <Edit3 className="w-5 h-5 text-emerald-600" />
            Edit Project
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
                placeholder="e.g. PRJ-001"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-colors uppercase"
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
                placeholder="e.g. Website Redesign"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-colors"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Client Name</label>
              <input
                name="client_name"
                type="text"
                value={formData.client_name}
                onChange={handleChange}
                placeholder="e.g. Acme Corp"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-colors"
              />
            </div>
            
            {/* Departments Multi-select Checkboxes */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Departments</label>
              <div className="p-3 border border-slate-200 rounded-lg bg-slate-50 max-h-32 overflow-y-auto">
                <div className="flex flex-wrap gap-2">
                  {departments.length > 0 ? departments.map(dept => {
                    const isSelected = formData.department.split(',').map(d => d.trim()).includes(dept.id) ||
                                       formData.department.split(',').map(d => d.trim()).includes(dept.name);
                    return (
                      <label key={dept.id} className={`cursor-pointer flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium transition-colors ${isSelected ? 'bg-emerald-100 border-emerald-300 text-emerald-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'}`}>
                        <input
                          type="checkbox"
                          className="sr-only"
                          checked={isSelected}
                          onChange={(e) => {
                            const current = formData.department.split(',').map(d => d.trim()).filter(Boolean);
                            if (e.target.checked) {
                              setFormData({ ...formData, department: [...current, dept.id].join(', ') });
                            } else {
                              setFormData({ ...formData, department: current.filter(d => d !== dept.id && d !== dept.name).join(', ') });
                            }
                          }}
                        />
                        {dept.name}
                      </label>
                    );
                  }) : (
                    <span className="text-xs text-slate-400">No departments found in sheet.</span>
                  )}
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
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-colors bg-white"
            >
              <option value="">Select a manager</option>
              {users
                .filter(user => {
                  if (isSuperUser) return true;
                  
                  const selectedDepts = formData.department.split(',').map(d => d.trim()).filter(Boolean);
                  
                  const inDept = selectedDepts.length === 0 || selectedDepts.includes((user.department || user.position || '').trim());
                  
                  return inDept;
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
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-colors"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Target End Date</label>
              <input
                name="end_date"
                type="date"
                value={formData.end_date}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-colors"
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
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-colors bg-white"
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
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-colors bg-white"
              >
                <option value="High">High</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Email Search Topic <span className="text-xs text-slate-400 font-normal">(Optional)</span></label>
            <input
              name="project_email_update"
              type="text"
              value={formData.project_email_update}
              onChange={handleChange}
              placeholder="e.g. PRJ-001 or Project Updates"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-colors"
            />
            <p className="text-xs text-slate-500 mt-1 mb-4">
              If left blank, the system will use the Project Code to search for email threads.
            </p>
          </div>

          <div className="pt-4 border-t border-slate-100">
            <h4 className="text-sm font-semibold text-slate-800 flex items-center gap-2 mb-3">
              <Settings className="w-4 h-4 text-emerald-600" />
              Theme & Display
            </h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Project Color</label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    name="color"
                    value={formData.color}
                    onChange={handleChange}
                    className="h-10 w-16 cursor-pointer rounded border border-slate-200 bg-white p-1"
                  />
                  <span className="text-xs font-mono bg-slate-50 px-2 py-1 rounded border border-slate-200 text-slate-600">
                    {formData.color.toUpperCase()}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="pt-4 flex justify-end gap-3 border-t border-slate-100 mt-6">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              {isSubmitting ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </form>

      </div>
    </div>,
    document.body
  )
}
