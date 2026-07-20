"use client"

import React, { useState } from "react"
import Link from "next/link"
import { TaskData } from "@/interfaces"
import { Badge } from "@/components/ui/badge"
import { getStatusColor } from "@/utils/status"
import { formatDateDDMMYYYY } from "@/utils/date"
import { Search, Calendar, ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"
import { EditTaskModal } from "@/components/projects/EditTaskModal"
import { UserData } from "@/interfaces"

interface TasksTableProps {
  tasks: TaskData[]
  users?: UserData[]
  department?: string
}

export function TasksTable({ tasks, users = [], department }: TasksTableProps) {
  const router = useRouter()
  const [searchTerm, setSearchTerm] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 50
  
  const [selectedTask, setSelectedTask] = useState<TaskData | null>(null)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)

  // Filter tasks based on search term
  const filteredTasks = tasks.filter(t => {
    if (!searchTerm) return true
    const s = searchTerm.toLowerCase()
    return (
      (t.task_name || "").toLowerCase().includes(s) ||
      (t.project_code || "").toLowerCase().includes(s) ||
      (t.assignee || "").toLowerCase().includes(s)
    )
  })

  // Pagination logic
  const totalPages = Math.ceil(filteredTasks.length / itemsPerPage)
  const paginatedTasks = filteredTasks.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  )

  // Reset page when search changes
  React.useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm])

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <div className="flex justify-between items-center bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
        <div className="relative w-full max-w-md">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-slate-400" />
          </div>
          <input
            type="text"
            className="block w-full pl-10 pr-3 py-2 border border-slate-200 rounded-lg leading-5 bg-slate-50 placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 sm:text-sm transition-colors"
            placeholder="Search by task name, project, or assignee..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="text-sm text-slate-500 font-medium px-4">
          Total: <span className="text-slate-900 font-bold">{filteredTasks.length}</span> tasks
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 shadow-sm rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase text-[11px] tracking-wider">
              <tr>
                <th className="px-6 py-4">Task Name</th>
                <th className="px-6 py-4">Project</th>
                <th className="px-6 py-4">Assignee</th>
                <th className="px-6 py-4">Timeline</th>
                <th className="px-6 py-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedTasks.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center">
                      <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mb-3">
                        <Search className="w-6 h-6 text-slate-400" />
                      </div>
                      <p>No tasks found matching your criteria.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedTasks.map((task, idx) => {
                  const projectId = task.project_code || task.project_id || ""
                  
                  return (
                    <tr 
                      key={task.task_id || task.id || idx} 
                      className="hover:bg-slate-50/80 transition-colors group cursor-pointer"
                      onDoubleClick={() => {
                        setSelectedTask(task);
                        setIsEditModalOpen(true);
                      }}
                    >
                      <td className="px-6 py-4">
                        <Link href={`/projects/${encodeURIComponent(projectId)}`} className="font-medium text-slate-900 hover:text-emerald-600 transition-colors block w-full max-w-xs truncate" title={task.task_name}>
                          {task.task_name || "Untitled Task"}
                        </Link>
                        {task.task_order && (
                          <span className="text-[10px] text-slate-400 font-mono">#{task.task_order}</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {projectId ? (
                          <Link href={`/projects/${encodeURIComponent(projectId)}`}>
                            <Badge variant="outline" className="font-mono text-[10px] text-indigo-600 bg-indigo-50 border-indigo-100 hover:bg-indigo-100 hover:border-indigo-200 transition-colors cursor-pointer">
                              {projectId}
                            </Badge>
                          </Link>
                        ) : (
                          <span className="text-slate-400 italic text-xs">No Project</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-2">
                          {task.assignee && task.assignee !== "-" ? (
                            task.assignee.split(',').map((name, i) => (
                              <div key={i} className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-600 shrink-0">
                                  {name.trim().substring(0, 2).toUpperCase()}
                                </div>
                                <span className="text-slate-700 max-w-[140px] truncate" title={name.trim()}>
                                  {name.trim()}
                                </span>
                              </div>
                            ))
                          ) : (
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-600 shrink-0">?</div>
                              <span className="max-w-[120px] truncate text-slate-400 italic">
                                Unassigned
                              </span>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-1 text-xs text-slate-600">
                          {task.start_date && (
                            <div className="flex items-center gap-1.5">
                              <span className="text-[9px] uppercase font-bold text-slate-400 w-8">Start</span>
                              <span>{formatDateDDMMYYYY(task.start_date)}</span>
                            </div>
                          )}
                          {task.due_date && (
                            <div className="flex items-center gap-1.5">
                              <span className="text-[9px] uppercase font-bold text-slate-400 w-8">Due</span>
                              <span className={task.status?.toLowerCase().includes("over") ? "text-rose-600 font-medium" : ""}>
                                {formatDateDDMMYYYY(task.due_date)}
                              </span>
                            </div>
                          )}
                          {!task.start_date && !task.due_date && <span className="text-slate-400 italic">No dates</span>}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col items-start gap-1.5 whitespace-nowrap">
                          <Badge className={`px-2 py-0.5 text-xs font-medium border ${getStatusColor(task.status || "")}`}>
                            {task.status || "To Do"}
                          </Badge>
                          {task.percent_complete !== undefined && task.percent_complete !== "" && task.percent_complete !== null && (
                            <div className="text-[10px] text-slate-500 font-medium text-center bg-white rounded-full border border-slate-100 shadow-sm px-2">
                              {task.percent_complete}%
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between bg-slate-50/50">
            <span className="text-sm text-slate-500 font-medium">
              Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, filteredTasks.length)} of {filteredTasks.length} entries
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="h-8 w-8 p-0"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="text-sm font-medium text-slate-700 px-2">
                Page {currentPage} of {totalPages}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="h-8 w-8 p-0"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
      
      {/* Edit Task Modal */}
      {selectedTask && (
        <EditTaskModal
          isOpen={isEditModalOpen}
          onClose={() => {
            setIsEditModalOpen(false)
            setSelectedTask(null)
          }}
          onSaved={() => {
            router.refresh()
          }}
          users={users}
          projectId={selectedTask.project_id || selectedTask.project_code || ""}
          task={selectedTask}
          tasks={tasks}
        />
      )}
    </div>
  )
}

