'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { TaskData } from '@/interfaces';
import { useSession } from 'next-auth/react';
import { showToast } from '@/utils/toast';
import { Loader2, GripVertical, Clock, AlertCircle } from 'lucide-react';
import { getDueLabel, formatDateDDMMYYYY as formatDisplayDate } from '@/utils/date';
import { STATUS_COLUMN_META, standardizeStatus } from '@/utils/status';
import axios from 'axios';

const COLUMNS = ['To Do', 'In Progress', 'Review', 'Hold', 'Done'];

export function KanbanBoard() {
  const { data: session } = useSession();
  const [tasks, setTasks] = useState<TaskData[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const userEmail = (session?.user as { email?: string })?.email || '';

  const fetchTasks = useCallback(async () => {
    if (!userEmail) return;
    try {
      const res = await axios.get('/api/tasks/me');
      setTasks(res.data.tasks || []);
    } catch (err) {
      console.error(err);
      showToast.error('Failed to load tasks for board');
    } finally {
      setLoading(false);
    }
  }, [userEmail]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  // Group tasks by standardized status
  const columnsData = useMemo(() => {
    const cols: Record<string, TaskData[]> = {};
    COLUMNS.forEach(c => cols[c] = []);

    tasks.forEach(task => {
      const status = standardizeStatus(task.status);
      if (cols[status]) {
        cols[status].push(task);
      }
    });

    return cols;
  }, [tasks]);

  const onDragEnd = async (result: DropResult) => {
    const { destination, source, draggableId } = result;

    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;

    const sourceStatus = source.droppableId;
    const destStatus = destination.droppableId;

    // Optimistic UI update
    const taskId = draggableId;
    const movedTask = tasks.find(t => String(t.task_id || t.id || '') === taskId);
    if (!movedTask) return;

    const newTasks = tasks.map(t => {
      if (String(t.task_id || t.id || '') === taskId) {
        return { ...t, status: destStatus };
      }
      return t;
    });
    setTasks(newTasks);
    setUpdatingId(taskId);

    try {
      const res = await fetch('/api/tasks/status', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task_id: taskId, new_status: destStatus, task_name: movedTask.task_name }),
      });
      if (!res.ok) throw new Error('Update failed');
      showToast.success(`Moved to ${destStatus}`);
    } catch (err) {
      showToast.error('Failed to update status');
      // Revert optimism
      fetchTasks();
    } finally {
      setUpdatingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-slate-400">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div className="flex gap-4 overflow-x-auto h-full pb-4 px-2">
        {COLUMNS.map(column => {
          const columnTasks = columnsData[column] || [];
          const meta = STATUS_COLUMN_META[column];

          return (
            <div key={column} className="flex flex-col w-[320px] shrink-0 bg-slate-50/50 rounded-xl border border-slate-200 overflow-hidden">
              <div className={`px-4 py-3 border-b ${meta.bg} ${meta.border} flex items-center justify-between`}>
                <h3 className={`font-semibold ${meta.text}`}>{column}</h3>
                <span className="text-xs font-medium bg-white px-2 py-0.5 rounded-full shadow-sm text-slate-600">
                  {columnTasks.length}
                </span>
              </div>

              <Droppable droppableId={column}>
                {(provided, snapshot) => (
                  <div
                    {...provided.droppableProps}
                    ref={provided.innerRef}
                    className={`flex-1 p-3 overflow-y-auto min-h-[150px] transition-colors ${snapshot.isDraggingOver ? 'bg-slate-100/80' : ''}`}
                  >
                    <div className="space-y-3">
                      {columnTasks.map((task, index) => {
                        const id = String(task.task_id || task.id || '');
                        const due = getDueLabel(String(task.update_date || task.due_date || ''), task.status);
                        const isUpdating = updatingId === id;

                        return (
                          <Draggable key={id} draggableId={id} index={index} isDragDisabled={isUpdating}>
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                className={`bg-white p-3 rounded-lg border shadow-sm transition-all group ${snapshot.isDragging ? 'shadow-lg ring-2 ring-emerald-400 border-transparent rotate-2' : 'border-slate-200 hover:border-emerald-300'} ${isUpdating ? 'opacity-50' : ''}`}
                                style={provided.draggableProps.style}
                              >
                                <div className="flex gap-2">
                                  <div {...provided.dragHandleProps} className="mt-0.5 shrink-0 text-slate-300 hover:text-slate-500 transition-colors">
                                    <GripVertical className="w-4 h-4" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <h4 className="text-sm font-medium text-slate-800 leading-tight mb-2">
                                      {task.task_name}
                                    </h4>

                                    <div className="flex flex-wrap items-center gap-2 mt-auto">
                                      <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 border border-emerald-100 px-1.5 py-0.5 rounded">
                                        {task.project_code || task.project_id || '-'}
                                      </span>

                                      {task.priority && (
                                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${task.priority === 'High' || task.priority === 'Urgent' ? 'bg-red-50 text-red-600' : 'bg-slate-100 text-slate-500'}`}>
                                          {task.priority}
                                        </span>
                                      )}

                                      <div className={`flex items-center gap-1 text-[10px] ml-auto font-medium ${due.danger ? 'text-red-500' : 'text-slate-400'}`}>
                                        {due.danger ? <AlertCircle className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                                        {formatDisplayDate(String(task.update_date || task.due_date || ''))}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}
                          </Draggable>
                        );
                      })}
                      {provided.placeholder}
                    </div>
                  </div>
                )}
              </Droppable>
            </div>
          );
        })}
      </div>
    </DragDropContext>
  );
}
