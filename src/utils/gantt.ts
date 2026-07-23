import { Task } from 'gantt-task-react';
import { TaskData } from '@/interfaces';
import { normalizeGanttDates } from '@/utils/date';
import { calculateTaskProgress, isTaskOverdue } from '@/utils/status';

export const generateGanttTasks = (
  tasks: TaskData[],
  expandedParents: Set<string>,
  taskDataMap: Map<string, TaskData>,
  isForExport: boolean = false
): Task[] => {
  if (!tasks || tasks.length === 0) return [];

  // Determine which task IDs are parents (have children)
  const parentIds = new Set<string>();
  tasks.forEach(t => {
    if (t.parent_task_id) parentIds.add(t.parent_task_id);
  });

  const taskItems: Task[] = [];

  const isVisible = (t: TaskData): boolean => {
    if (!t.parent_task_id) return true;
    if (!expandedParents.has(t.parent_task_id)) return false;
    const parent = taskDataMap.get(t.parent_task_id);
    if (parent) return isVisible(parent);
    return true;
  };

  tasks.forEach((t, index) => {
    if (!isForExport && !isVisible(t)) return;

    let { startDate, endDate } = normalizeGanttDates(t);

    const status = (t.status || '').toLowerCase();
    const isCancelled = status.includes('cancel');
    const isDone = status.includes('done') || status.includes('complete');
    const isInProgress = status.includes('progress') || status.includes('doing');
    const isOnHold = status.includes('hold');

    // percent_complete: use utility function to calculate recursively
    const progress = calculateTaskProgress(t, tasks);

    const isOverdue = isTaskOverdue(t.status || '', t.due_date);

    // Determine bar color based on status
    let barColor = '#6366f1'; // emerald default / To Do
    let barSelectedColor = '#4f46e5';
    let bgColor = '';
    let bgSelectedColor = '';

    let displayProgress = progress;

    if (isCancelled) { barColor = '#94a3b8'; barSelectedColor = '#64748b'; }
    else if (isDone) { barColor = '#10b981'; barSelectedColor = '#059669'; }
    else if (isOverdue) { barColor = '#ef4444'; barSelectedColor = '#dc2626'; }
    else if (isOnHold) { barColor = '#f59e0b'; barSelectedColor = '#d97706'; }
    else if (isInProgress) { barColor = '#3b82f6'; barSelectedColor = '#2563eb'; }

    // Check for delay (update_date > due_date) to show the delay "tail"
    if (t.update_date && t.due_date) {
      const actualDue = new Date(t.due_date);
      const actualEnd = new Date(t.update_date);
      actualDue.setHours(23, 59, 59, 999);
      actualEnd.setHours(23, 59, 59, 999);

      if (actualEnd > actualDue && isDone) {
        // It's delayed! Show green up to due_date, and red for the rest
        const totalDuration = actualEnd.getTime() - startDate.getTime();
        const plannedDuration = actualDue.getTime() - startDate.getTime();

        if (totalDuration > 0 && plannedDuration > 0) {
          displayProgress = (plannedDuration / totalDuration) * 100;
          displayProgress = Math.max(0, Math.min(100, displayProgress));

          // Background becomes red (delay tail)
          bgColor = '#ef4444'; // solid red
          bgSelectedColor = '#dc2626';
        }
      }
    }

    // Default backgrounds if not a delay tail
    if (!bgColor) {
      bgColor = barColor + '33'; // 20% opacity
      bgSelectedColor = barColor + '55';
    }

    // Determine task type: parent tasks become 'project' type in gantt-task-react
    const isParent = parentIds.has(t.id || '');
    const ganttType = isParent ? 'project' : 'task';

    // Auto-compute status for parent tasks based on subtask progress
    let computedStatus = t.status || 'To Do';
    if (isParent) {
      if (progress === 100) computedStatus = 'Done';
      else if (progress === 0) computedStatus = 'To Do';
      else computedStatus = 'In Progress';
    }
    const isEffectiveDone = (computedStatus || '').toLowerCase().includes('done') || (computedStatus || '').toLowerCase().includes('complete');

    const item: any = {
      start: startDate,
      end: endDate,
      name: t.task_order ? `${t.task_order}. ${t.task_name || `Task ${index + 1}`}` : (t.task_name || `Task ${index + 1}`),
      id: t.id || `task-${index}`,
      type: ganttType,
      progress: displayProgress,
      isDisabled: isCancelled || isDone,
      hideChildren: false,
      styles: {
        progressColor: barColor,
        progressSelectedColor: barSelectedColor,
        backgroundColor: bgColor,
        backgroundSelectedColor: bgSelectedColor,
      },
      realProgress: progress,
      originalStatus: computedStatus,
      isOverdue: isOverdue,
      isCancelled,
      description: t.description || '',
      assignee: t.assignee_name || (t.assignee_id as string) || (t as any).assignee || '',
      task_order: t.task_order || '',
      priority: t.priority || '',
      plannedDuration: t.due_date && t.start_date
        ? Math.max(1, Math.round((new Date(t.due_date).getTime() - new Date(t.start_date).getTime()) / (1000 * 60 * 60 * 24)) + 1)
        : null,
      duration: isEffectiveDone && t.start_date
        ? Math.max(1, Math.round((new Date(t.update_date || t.due_date || new Date()).getTime() - new Date(t.start_date).getTime()) / (1000 * 60 * 60 * 24)) + 1)
        : null,
      actualStartDate: t.start_date,
      actualDueDate: t.due_date,
      actualUpdateDate: t.update_date,
    };

    if (t.parent_task_id && taskDataMap.has(t.parent_task_id)) {
      item.project = t.parent_task_id;
    }

    taskItems.push(item as Task);
  });

  const validItems = taskItems.filter(t => t.start && !isNaN(t.start.getTime()) && t.end && !isNaN(t.end.getTime()));
  if (validItems.length > 0) {
    const minDate = new Date(Math.min(...validItems.map(t => t.start.getTime())));
    const maxDate = new Date(Math.max(...validItems.map(t => t.end.getTime())));

    const dummyStart = new Date(minDate);
    const dummyEnd = new Date(maxDate);
    dummyEnd.setMonth(dummyEnd.getMonth() + 2);

    taskItems.push({
      start: dummyStart,
      end: dummyEnd,
      name: '',
      id: 'dummy-padding-task',
      type: 'task',
      progress: 0,
      isDisabled: true,
      hideChildren: false,
      styles: {
        progressColor: 'transparent',
        progressSelectedColor: 'transparent',
        backgroundColor: 'transparent',
        backgroundSelectedColor: 'transparent'
      },
      realProgress: 0,
      originalStatus: '',
      assignee: '',
    } as unknown as Task);
  }

  return taskItems.map(t => {
    let safeStart = t.start;
    let safeEnd = t.end;
    if (!safeStart || isNaN(safeStart.getTime())) safeStart = new Date();
    if (!safeEnd || isNaN(safeEnd.getTime())) {
      safeEnd = new Date(safeStart);
      safeEnd.setDate(safeEnd.getDate() + 1);
    }
    return { ...t, start: safeStart, end: safeEnd };
  });
};
