"use client"

import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import axios from 'axios'
import { showToast } from '@/utils'
import { X, Edit3, Search } from 'lucide-react'
import { UserData, TaskData } from '@/interfaces';
import { Button } from '@/components/ui/button'
import { formatDateYYYYMMDD } from '@/utils/date'
import { getAutoAdjustedPercent } from '@/utils/status'
import { useSession } from 'next-auth/react'
import { TaskDiscussion } from '@/components/tasks/TaskDiscussion'

interface EditTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  users: UserData[];
  projectId: string;
  task: TaskData;
  tasks?: TaskData[];
}

export function EditTaskModal({
  isOpen,
  onClose,
  onSaved,
  users,
  projectId,
  task,
  tasks = []
}: EditTaskModalProps) {
  const { data: session } = useSession();

  const [formData, setFormData] = useState({
    id: task.id || '',
    task_name: task.task_name || '',
    description: task.description || '',
    assignee_id: [] as string[],
    start_date: task.start_date || formatDateYYYYMMDD(new Date()),
    due_date: task.due_date || formatDateYYYYMMDD(new Date(Date.now() + 7 * 86400000)),
    status: task.status || 'To Do',
    priority: task.priority || 'Medium',
    percent_complete: Number(task.percent_complete) || 0,
    parent_task_id: task.parent_task_id || ''
  })

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [userSearch, setUserSearch] = useState('')
  const [mounted, setMounted] = useState(false)
  const [activeTab, setActiveTab] = useState<'details' | 'discussion'>('details')

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (isOpen && task) {
      // Parse assignees
      let initialAssignees: string[] = [];
      if (typeof task.assignee_id === 'string' && task.assignee_id) {
        initialAssignees = task.assignee_id.split(',').map(id => id.trim()).filter(Boolean);
      } else if (Array.isArray(task.assignee_id)) {
        initialAssignees = task.assignee_id as unknown as string[];
      }

      setFormData({
        id: task.id as string || '',
        task_name: task.task_name as string || '',
        description: task.description as string || '',
        assignee_id: initialAssignees,
        start_date: task.start_date as string || formatDateYYYYMMDD(new Date()),
        due_date: task.due_date as string || formatDateYYYYMMDD(new Date(Date.now() + 7 * 86400000)),
        status: task.status as string || 'To Do',
        priority: task.priority as string || 'Medium',
        percent_complete: Number(task.percent_complete) || 0,
        parent_task_id: task.parent_task_id as string || ''
      });
      setUserSearch('');
    }
  }, [isOpen, task]);

  if (!isOpen) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => {
      const nextData = { ...prev, [name]: value };
      if (name === 'status') {
        nextData.percent_complete = getAutoAdjustedPercent(prev.status, value, prev.percent_complete);
      }
      return nextData;
    });
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.task_name) {
      showToast.error("Missing fields", "Task Name is required.")
      return
    }

    try {
      setIsSubmitting(true)

      const res = await axios.put(`/api/tasks/${formData.id}`, {
        ...formData,
        project_id: projectId
      })

      if (res.data.status === 'success') {
        showToast.success("Task Updated", "Task has been updated successfully.")
        onSaved()
        onClose()
      } else {
        throw new Error(res.data.message)
      }
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } }; message?: string };
      console.error("Failed to update task:", err)
      showToast.error("Error", err.response?.data?.message || err.message || "Failed to update task")
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!mounted || !isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col animate-in zoom-in-95 duration-200 overflow-hidden" onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100 bg-slate-50/50">
          <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
            <Edit3 className="w-5 h-5 text-emerald-600" />
            Edit Task
          </h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors p-1 rounded-full hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-200 px-6">
          <button
            type="button"
            className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'details'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
            onClick={() => setActiveTab('details')}
          >
            Details
          </button>
          <button
            type="button"
            className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'discussion'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
            onClick={() => setActiveTab('discussion')}
          >
            Discussion
          </button>
        </div>

        {/* Form Body */}
        {activeTab === 'details' ? (
          <form onSubmit={handleSubmit} className="p-6 overflow-y-auto flex-1 space-y-5">

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Task ID</label>
              <input
                name="id"
                type="text"
                disabled
                value={formData.id}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-slate-100 text-slate-500 cursor-not-allowed font-mono text-xs"
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
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-colors"
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
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-colors resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Assignees (@mention)</label>
            <div className="relative mb-2">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search assignees by name or email..."
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-colors bg-white"
              />
            </div>
            <div className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-slate-50/50 max-h-40 overflow-y-auto space-y-2">
              {users.filter(u => {
                if (!userSearch) return true;
                
                const searchLower = userSearch.toLowerCase().replace(/^@/, '');
                const nameEn = (u.name_en || '').toLowerCase();
                const nameTh = (u.name_th || '').toLowerCase();
                const email = (u.email || '').toLowerCase();
                const nickname = (u.nickname || '').toLowerCase();
                
                return nameEn.includes(searchLower) || nameTh.includes(searchLower) || email.includes(searchLower) || nickname.includes(searchLower);
              }).map(user => {
                const uid = user.id || "";
                return (
                  <label key={uid} className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.assignee_id.includes(uid)}
                      onChange={(e) => {
                         const checked = e.target.checked;
                         setFormData(prev => ({
                           ...prev,
                           assignee_id: checked
                             ? [...prev.assignee_id, uid]
                             : prev.assignee_id.filter(id => id !== uid)
                         }));
                      }}
                      className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    <span className="text-sm text-slate-700">
                      {user.name_en || user.name_th} <span className="text-slate-400 text-xs">({user.department || user.position})</span>
                    </span>
                  </label>
                );
              })}
              {users.filter(u => {
                if (!userSearch) return true;
                
                const searchLower = userSearch.toLowerCase().replace(/^@/, '');
                return (u.name_en || '').toLowerCase().includes(searchLower) || 
                       (u.name_th || '').toLowerCase().includes(searchLower) || 
                       (u.email || '').toLowerCase().includes(searchLower) ||
                       (u.nickname || '').toLowerCase().includes(searchLower);
              }).length === 0 && (
                  <div className="text-sm text-slate-400 italic py-1 text-center">No users found matching your search.</div>
                )}
            </div>
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
              <label className="block text-sm font-medium text-slate-700 mb-1">Due Date</label>
              <input
                name="due_date"
                type="date"
                value={formData.due_date}
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
                <option value="To Do">To Do</option>
                <option value="In Progress">In Progress</option>
                <option value="Review">Review</option>
                <option value="Done">Done</option>
                <option value="On Hold">On Hold</option>
                <option value="Cancel">Cancel</option>
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

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="md:col-span-1">
              <label className="block text-sm font-medium text-slate-700 mb-1">Parent Task <span className="text-slate-400 font-normal">(optional)</span></label>
              <select
                name="parent_task_id"
                value={formData.parent_task_id}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-colors bg-white text-sm"
              >
                <option value="">— None (root task) —</option>
                {tasks
                  .filter(t => !t.parent_task_id && t.id !== task.id && (t.project_id === projectId || t.project_code === projectId || (t as any).project === projectId))
                  .map(t => (
                    <option key={t.id as string} value={t.id as string}>
                      {t.task_order ? `${t.task_order}. ` : ''}{t.task_name as string}
                    </option>
                  ))
                }
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
              <select
                name="status"
                value={formData.status}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-colors bg-white"
              >
                <option value="To Do">To Do</option>
                <option value="In Progress">In Progress</option>
                <option value="Review">Review</option>
                <option value="Done">Done</option>
                <option value="On Hold">On Hold</option>
                <option value="Cancel">Cancel</option>
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

          <div className="pt-4 flex justify-end gap-3 border-t border-slate-100 mt-6">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              {isSubmitting ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </form>
        ) : (
          <div className="flex-1 overflow-hidden">
            <TaskDiscussion taskId={formData.id} />
          </div>
        )}

      </div>
    </div>,
    document.body
  )
}
