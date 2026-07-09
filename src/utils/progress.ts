import { TaskData } from "@/interfaces";

/**
 * Parses the percent_complete of a single task. 
 * Falls back to status if empty: Done=100%, Cancel=0%.
 */
export function getTaskDirectProgress(task: TaskData): number {
  const status = (task.status || '').toLowerCase();
  
  if (status.includes('cancel')) return 0;
  if (status.includes('to do')) return 0;
  if (status.includes('done') || status.includes('complete')) return 100;

  if (task.percent_complete && !isNaN(Number(task.percent_complete))) {
    return Math.min(100, Math.max(0, Number(task.percent_complete)));
  }

  return 0;
}

/**
 * Calculates auto-adjusted percentage when a task status changes.
 */
export function getAutoAdjustedPercent(oldStatus: string, newStatus: string, currentPercent: number): number {
  const oldS = (oldStatus || '').toLowerCase();
  const newS = (newStatus || '').toLowerCase();

  // New Status = To Do / Cancel
  if (newS.includes('to do') || newS.includes('cancel')) return 0;

  // New Status = Done
  if (newS.includes('done') || newS.includes('complete')) return 100;

  // New Status = Review
  if (newS.includes('review')) return 75;

  // New Status = In Progress
  if (newS.includes('progress') || newS.includes('doing')) {
    if (oldS.includes('to do') || oldS.includes('cancel')) return 25;
    if (oldS.includes('review')) return 40;
    
    // If coming from Done, or if it's currently 0 or 100, default to 25%
    if (oldS.includes('done') || oldS.includes('complete')) return 25;
    if (currentPercent === 0 || currentPercent === 100) return 25;
  }

  // Hold or any other untouched scenario, keep current percentage
  return currentPercent;
}

/**
 * Calculates the progress of a task, considering its children.
 * If a task has children, its progress is the average of its non-cancelled children's progress.
 * If a task has no non-cancelled children, its progress is its direct percent_complete.
 */
export function calculateTaskProgress(task: TaskData, allTasks: TaskData[]): number {
  const children = allTasks.filter(t => 
    t.parent_task_id === task.id && 
    !(t.status || '').toLowerCase().includes('cancel')
  );
  
  if (children.length === 0) {
    return getTaskDirectProgress(task);
  }

  const childrenProgressSum = children.reduce((sum, child) => {
    return sum + calculateTaskProgress(child, allTasks);
  }, 0);

  return Math.round(childrenProgressSum / children.length);
}

/**
 * Calculates the overall project progress.
 * Project progress is the average progress of all MAIN tasks (tasks without a parent) that are not cancelled.
 */
export function calculateProjectProgress(allTasks: TaskData[]): number {
  const mainTasks = allTasks.filter(t => 
    !t.parent_task_id && 
    !(t.status || '').toLowerCase().includes('cancel')
  );
  
  if (mainTasks.length === 0) {
    const activeTasks = allTasks.filter(t => !(t.status || '').toLowerCase().includes('cancel'));
    if (activeTasks.length > 0) {
      const sum = activeTasks.reduce((s, t) => s + getTaskDirectProgress(t), 0);
      return Math.round(sum / activeTasks.length);
    }
    return 0;
  }

  const mainTasksSum = mainTasks.reduce((sum, task) => {
    return sum + calculateTaskProgress(task, allTasks);
  }, 0);

  return Math.round(mainTasksSum / mainTasks.length);
}
