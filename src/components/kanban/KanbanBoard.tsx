'use client';

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { TaskData } from '@/interfaces';
import { useSession } from 'next-auth/react';
import { showToast } from '@/utils/toast';
import { Loader2, GripVertical, Clock, AlertCircle, ChevronRight, X } from 'lucide-react';
import { getDueLabel, formatDateDDMMYYYY as formatDisplayDate } from '@/utils/date';
import { STATUS_COLUMN_META, standardizeStatus } from '@/utils/status';
import { api as axios } from '@/lib/axios';

const COLUMNS = ['To Do', 'In Progress', 'Review', 'Hold', 'Done', 'Cancel'];

// Status Picker Modal for mobile/tablet
function StatusPickerModal({
  task,
  currentStatus,
  onSelect,
  onClose,
}: {
  task: TaskData;
  currentStatus: string;
  onSelect: (status: string) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  // Close on backdrop click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose]);

  // Prevent body scroll while open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm">
      <div
        ref={ref}
        className="w-full max-w-md bg-white rounded-t-2xl shadow-2xl p-5 pb-8 animate-slide-up"
      >
        {/* Handle bar */}
        <div className="mx-auto mb-4 w-10 h-1.5 bg-slate-200 rounded-full" />

        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1 min-w-0 pr-2">
            <p className="text-xs text-slate-400 mb-0.5">เปลี่ยนสถานะ</p>
            <p className="text-sm font-semibold text-slate-800 leading-tight line-clamp-2">
              {task.task_name}
            </p>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Status options */}
        <div className="space-y-2">
          {COLUMNS.map((col) => {
            const meta = STATUS_COLUMN_META[col];
            const isCurrent = col === currentStatus;
            return (
              <button
                key={col}
                onClick={() => !isCurrent && onSelect(col)}
                disabled={isCurrent}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all text-sm font-medium
                  ${isCurrent
                    ? `${meta.bg} ${meta.border} ${meta.text} cursor-default opacity-80`
                    : `bg-white border-slate-200 text-slate-700 hover:${meta.bg} hover:${meta.border} hover:${meta.text} active:scale-[0.98]`
                  }`}
              >
                <span>{col}</span>
                {isCurrent ? (
                  <span className="text-[10px] font-semibold bg-white/60 px-2 py-0.5 rounded-full border border-current opacity-70">
                    สถานะปัจจุบัน
                  </span>
                ) : (
                  <ChevronRight className="w-4 h-4 opacity-40" />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function KanbanBoard() {
  const { data: session } = useSession();
  const [tasks, setTasks] = useState<TaskData[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  const [pickerTask, setPickerTask] = useState<TaskData | null>(null);

  const userEmail = (session?.user as { email?: string })?.email || '';

  // Detect mobile/tablet (pointer: coarse = touch device)
  useEffect(() => {
    const mq = window.matchMedia('(pointer: coarse)');
    setIsTouchDevice(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsTouchDevice(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

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

    const destStatus = destination.droppableId;
    await changeStatus(draggableId, destStatus);
  };

  const changeStatus = async (taskId: string, destStatus: string) => {
    const movedTask = tasks.find(t => String(t.task_id || t.id || '') === taskId);
    if (!movedTask) return;
    if (standardizeStatus(movedTask.status) === destStatus) return;

    // Optimistic UI update
    setTasks(prev => prev.map(t =>
      String(t.task_id || t.id || '') === taskId ? { ...t, status: destStatus } : t
    ));
    setUpdatingId(taskId);

    try {
      const res = await fetch('/api/tasks/status', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task_id: taskId, new_status: destStatus, task_name: movedTask.task_name }),
      });
      if (!res.ok) throw new Error('Update failed');
      showToast.success(`เปลี่ยนสถานะเป็น ${destStatus}`);
    } catch (err) {
      showToast.error('Failed to update status');
      fetchTasks();
    } finally {
      setUpdatingId(null);
    }
  };

  const handleCardTap = (task: TaskData) => {
    if (isTouchDevice) {
      setPickerTask(task);
    }
  };

  const handlePickerSelect = async (newStatus: string) => {
    if (!pickerTask) return;
    const taskId = String(pickerTask.task_id || pickerTask.id || '');
    setPickerTask(null);
    await changeStatus(taskId, newStatus);
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-slate-400">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <>
      {/* Status Picker Modal (mobile/tablet) */}
      {pickerTask && (
        <StatusPickerModal
          task={pickerTask}
          currentStatus={standardizeStatus(pickerTask.status)}
          onSelect={handlePickerSelect}
          onClose={() => setPickerTask(null)}
        />
      )}

      <DragDropContext onDragEnd={onDragEnd}>
        <div className="flex gap-4 overflow-x-auto h-full pb-4 px-2">
          {COLUMNS.map(column => {
            const columnTasks = columnsData[column] || [];
            const meta = STATUS_COLUMN_META[column];

            return (
              <div key={column} className="flex flex-col flex-1 min-w-[200px] max-w-[350px] bg-slate-50/50 rounded-xl border border-slate-200 overflow-hidden">
                <div className={`px-4 py-3 border-b ${meta.bg} ${meta.border} flex items-center justify-between`}>
                  <h3 className={`font-semibold ${meta.text}`}>{column}</h3>
                  <span className="text-xs font-medium bg-white px-2 py-0.5 rounded-full shadow-sm text-slate-600">
                    {columnTasks.length}
                  </span>
                </div>

                <Droppable droppableId={column} isDropDisabled={isTouchDevice}>
                  {(provided, snapshot) => (
                    <div
                      {...provided.droppableProps}
                      ref={provided.innerRef}
                      className={`flex-1 p-3 overflow-y-auto min-h-[150px] transition-colors ${snapshot.isDraggingOver ? 'bg-slate-100/80' : ''}`}
                    >
                      <div className="space-y-3">
                        {columnTasks.map((task, index) => {
                          const id = String(task.task_id || task.id || '');
                          const due = getDueLabel(String(task.due_date || ''), task.status);
                          const isUpdating = updatingId === id;

                          return (
                            <Draggable key={id} draggableId={id} index={index} isDragDisabled={isUpdating || isTouchDevice}>
                              {(provided, snapshot) => (
                                <div
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  {...(!isTouchDevice ? provided.dragHandleProps : {})}
                                  onClick={() => handleCardTap(task)}
                                  className={`bg-white p-3 rounded-lg border shadow-sm
                                    transition-[transform,opacity,box-shadow,border-color] duration-200 ease-out group
                                    ${snapshot.isDragging ? 'shadow-lg ring-2 ring-emerald-400 border-transparent rotate-2' : 'border-slate-200 hover:border-emerald-300'}
                                    ${isUpdating ? 'opacity-50' : ''}
                                    ${isTouchDevice ? 'cursor-pointer active:scale-[0.97] active:shadow-md select-none' : ''}`}
                                  style={provided.draggableProps.style}
                                >
                                  <div className="flex gap-2">
                                    {/* Grip icon - desktop only */}
                                    {!isTouchDevice && (
                                      <div className="mt-0.5 shrink-0 text-slate-300 group-hover:text-slate-400 transition-colors">
                                        <GripVertical className="w-4 h-4" />
                                      </div>
                                    )}

                                    {/* Tap-to-change hint - mobile only */}
                                    {isTouchDevice && (
                                      <div className="mt-0.5 shrink-0 text-emerald-400">
                                        <ChevronRight className="w-4 h-4" />
                                      </div>
                                    )}

                                    <div className="flex-1 min-w-0">
                                      <h4 className="text-sm font-medium text-slate-800 leading-tight mb-2 break-words">
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

                                        {task.due_date && (
                                          <div className={`flex items-center gap-1 text-[10px] ml-auto font-medium ${due.danger ? 'text-red-500' : 'text-slate-400'}`}>
                                            {due.danger ? <AlertCircle className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                                            {formatDisplayDate(String(task.due_date || ''))}
                                          </div>
                                        )}
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

      {/* Animation styles */}
      <style jsx global>{`
        @keyframes slide-up {
          from { transform: translateY(100%); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
        .animate-slide-up {
          animation: slide-up 0.28s cubic-bezier(0.32, 0.72, 0, 1);
        }
        @media (prefers-reduced-motion: reduce) {
          .animate-slide-up {
            animation-duration: 0.01ms;
          }
        }
      `}</style>
    </>
  );
}
