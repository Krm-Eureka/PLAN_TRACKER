import { TaskData, ProjectData } from '@/interfaces';
import { getEffectiveEndDate } from '@/utils/date';

import { 
  isDoneStatus, 
  isProgressStatus, 
  isCancelStatus, 
  isHoldStatus, 
  isReviewStatus, 
  isTodoStatus 
} from '@/constants/status';

/**
 * Returns true if a status string matches any exempt keyword.
 */
export function isStatusExempt(status: string): boolean {
  return isDoneStatus(status) || isCancelStatus(status) || isHoldStatus(status);
}

/**
 * Returns a numerical priority for a given status, useful for sorting tasks.
 * Lower number = higher priority.
 * 1: In Progress, 2: Review, 3: To Do, 4: On Hold, 5: Others
 */
export const getStatusPriority = (status: string) => {
  if (isProgressStatus(status)) return 1;
  if (isReviewStatus(status)) return 2;
  if (isTodoStatus(status) || (status || '') === '') return 3;
  if (isHoldStatus(status)) return 4;
  return 5;
};

/**
 * Centralised overdue check for TASKS.
 * A task is overdue when:
 *   - its status is NOT done / complete / cancel / hold / wait
 *   - its due date has passed (before today, time-stripped)
 *
 * @param status      Task status string
 * @param dueDateStr  due_date or update_date string (YYYY-MM-DD or any parseable format)
 */
export function isTaskOverdue(status: string, dueDateStr?: string | null): boolean {
  if (!dueDateStr) return false;
  if (isStatusExempt(status)) return false;

  const due = new Date(dueDateStr);
  if (isNaN(due.getTime())) return false;

  // The deadline is 09:00 AM on the day AFTER the due date
  // (e.g., if due date is 23rd, it becomes overdue on the 24th at 09:00 AM)
  const deadline = new Date(due);
  deadline.setDate(deadline.getDate() + 1);
  deadline.setHours(9, 0, 0, 0);

  const now = new Date();
  
  return now > deadline;
}

/**
 * Checks if a task is "near overdue" based on a threshold in minutes.
 * A task is near overdue if:
 *   - it is NOT overdue yet
 *   - it is NOT exempt (done, hold, cancel, etc)
 *   - the current time is within `thresholdMinutes` of the deadline (09:00 AM next day)
 */
export function isTaskNearOverdue(status: string, dueDateStr?: string | null, thresholdMinutes: number = 30): boolean {
  if (!dueDateStr) return false;
  if (isStatusExempt(status)) return false;

  const due = new Date(dueDateStr);
  if (isNaN(due.getTime())) return false;

  const deadline = new Date(due);
  deadline.setDate(deadline.getDate() + 1);
  deadline.setHours(9, 0, 0, 0);

  const now = new Date();
  
  // If already overdue, it's not "near overdue"
  if (now >= deadline) return false;

  const diffMs = deadline.getTime() - now.getTime();
  const diffMinutes = diffMs / 60000;

  return diffMinutes >= 0 && diffMinutes <= thresholdMinutes;
}

/**
 * Centralised overdue check for PROJECTS.
 * Same rules as tasks — On Hold / Done / Cancel projects are never overdue.
 *
 * @param status      Project status string
 * @param endDateStr  end_date / due_date string
 */
export function isProjectOverdue(status: string, endDateStr?: string | null): boolean {
  return isTaskOverdue(status, endDateStr);
}

export const getStatusColor = (status: string, isOverdue?: boolean) => {
  // On Hold is never shown as overdue — always amber
  if (isOverdue && !isHoldStatus(status) && !isDoneStatus(status) && !isCancelStatus(status)) return 'bg-red-50 text-red-700 border-red-200';
  if (isDoneStatus(status)) return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (isProgressStatus(status)) return 'bg-blue-50 text-blue-700 border-blue-200';
  if (isReviewStatus(status)) return 'bg-purple-50 text-purple-700 border-purple-200';
  if (isHoldStatus(status)) return 'bg-amber-50 text-amber-700 border-amber-200';
  if (isCancelStatus(status)) return 'bg-slate-50 text-slate-500 border-slate-200';
  
  const s = (status || '').toLowerCase();
  if (s.includes('over') || s.includes('late')) return 'bg-red-50 text-red-700 border-red-200';
  return 'bg-white text-slate-600 border-slate-200';
};

export const getStatusTextColor = (status: string, isOverdue?: boolean) => {
  const colorClasses = getStatusColor(status, isOverdue);
  const textClassMatch = colorClasses.match(/text-[a-z]+-\d+/);
  return textClassMatch ? textClassMatch[0] : 'text-slate-600';
};

export const STATUS_COLUMN_META: Record<string, { bg: string, border: string, text: string }> = {
  'To Do': { bg: 'bg-slate-100', border: 'border-slate-200', text: 'text-slate-700' },
  'In Progress': { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700' },
  'Review': { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700' },
  'Hold': { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700' },
  'Done': { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700' },
  'Cancel': { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700' },
};

export function standardizeStatus(status?: string) {
  if (isProgressStatus(status)) return 'In Progress';
  if (isReviewStatus(status)) return 'Review';
  if (isHoldStatus(status)) return 'Hold';
  if (isDoneStatus(status)) return 'Done';
  if (isCancelStatus(status)) return 'Cancel';
  return 'To Do';
}

export const getActionColor = (action?: string) => {
  const act = (action || '').toUpperCase();
  if (act.includes('CREATE') || act.includes('ADD')) return 'text-emerald-600';
  if (act.includes('UPDATE') || act.includes('EDIT')) return 'text-blue-600';
  if (act.includes('DELETE') || act.includes('REMOVE')) return 'text-red-600';
  return 'text-slate-600';
};

export const getActionBadgeColor = (action?: string) => {
  const act = (action || '').toUpperCase();
  if (act.includes('CREATE') || act.includes('ADD')) return 'bg-emerald-50 text-emerald-600 border-emerald-200';
  if (act.includes('UPDATE') || act.includes('EDIT')) return 'bg-blue-50 text-blue-600 border-blue-200';
  if (act.includes('DELETE') || act.includes('REMOVE')) return 'bg-red-50 text-red-600 border-red-200';
  return 'bg-slate-50 text-slate-600 border-slate-200';
};





/**
 * Parses the percent_complete of a single task. 
 * Falls back to status if empty: Done=100%, Cancel=0%.
 */
export function getTaskDirectProgress(task: TaskData): number {
  if (isCancelStatus(task.status)) return 0;
  if (isTodoStatus(task.status)) return 0;
  if (isDoneStatus(task.status)) return 100;

  if (task.percent_complete && !isNaN(Number(task.percent_complete))) {
    return Math.min(100, Math.max(0, Number(task.percent_complete)));
  }

  return 0;
}

/**
 * Calculates auto-adjusted percentage when a task status changes.
 */
export function getAutoAdjustedPercent(oldStatus: string, newStatus: string, currentPercent: number): number {
  // New Status = To Do / Cancel
  if (isTodoStatus(newStatus) || isCancelStatus(newStatus)) return 0;

  // New Status = Done
  if (isDoneStatus(newStatus)) return 100;

  // New Status = Review
  if (isReviewStatus(newStatus)) return 75;

  // New Status = In Progress
  if (isProgressStatus(newStatus)) {
    if (isTodoStatus(oldStatus) || isCancelStatus(oldStatus)) return 25;
    if (isReviewStatus(oldStatus)) return 40;
    
    // If coming from Done, or if it's currently 0 or 100, default to 25%
    if (isDoneStatus(oldStatus)) return 25;
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
    !isCancelStatus(t.status)
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
    !isCancelStatus(t.status)
  );
  
  if (mainTasks.length === 0) {
    const activeTasks = allTasks.filter(t => !isCancelStatus(t.status));
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






export interface TaskFilters {
  search: string;
  status: string;
  project: string;
  year: string;
  month: string;
}

export type TaskReportCategory = 'COMPLETED_ON_TIME' | 'COMPLETED_LATE' | 'OVERDUE' | 'IN_PROGRESS' | 'HOLD' | 'TO_DO' | 'CANCEL';

export function isTaskCompletedLate(status: string, dueDateStr?: string | null, updateDateStr?: string | null): boolean {
  if (!isDoneStatus(status)) return false;
  if (!dueDateStr || !updateDateStr) return false;

  const due = new Date(dueDateStr);
  const end = new Date(updateDateStr);
  if (isNaN(due.getTime()) || isNaN(end.getTime())) return false;

  due.setHours(23, 59, 59, 999);
  end.setHours(23, 59, 59, 999);

  return end > due;
}

export function getTaskReportCategory(task: TaskData): TaskReportCategory {
  if (isCancelStatus(task.status)) return 'CANCEL';
  if (isHoldStatus(task.status)) return 'HOLD';
  
  if (isDoneStatus(task.status)) {
    if (isTaskCompletedLate(task.status || '', task.due_date, task.update_date)) {
      return 'COMPLETED_LATE';
    }
    return 'COMPLETED_ON_TIME';
  }

  // Not done, not hold, not cancel
  if (isTaskOverdue(task.status || '', task.due_date)) {
    return 'OVERDUE';
  }

  if (isProgressStatus(task.status) || isReviewStatus(task.status)) return 'IN_PROGRESS';
  
  return 'TO_DO';
}

export const filterTasks = (tasks: TaskData[], filters: TaskFilters): TaskData[] => {
  return tasks.filter(t => {
    if (filters.search && !(t.task_name || '').toLowerCase().includes(filters.search.toLowerCase())) return false;
    if (filters.status) {
      const fs = filters.status.toLowerCase();
      if (fs === 'to do') {
        if (!isTodoStatus(t.status) && (t.status || '') !== '') return false;
      } else if (fs === 'in progress') {
        if (!isProgressStatus(t.status)) return false;
      } else if (fs === 'done') {
        if (!isDoneStatus(t.status)) return false;
      } else {
        const ts = (t.status || '').toLowerCase();
        if (!ts.includes(fs)) return false;
      }
    }
    if (filters.project && (t.project_code || t.project_id) !== filters.project) return false;
    
    const parsedDate = getEffectiveEndDate(t);
    if (filters.year && parsedDate && String(parsedDate.getFullYear()) !== filters.year) return false;
    if (filters.month && parsedDate && String(parsedDate.getMonth() + 1).padStart(2, '0') !== filters.month) return false;
    
    return true;
  });
};

export const sortTasks = (tasks: TaskData[], sortBy: string): TaskData[] => {
  return [...tasks].sort((a, b) => {
    if (sortBy === 'name') return (a.task_name || '').localeCompare(b.task_name || '');
    if (sortBy === 'project') return (a.project_code || '').localeCompare(b.project_code || '');
    if (sortBy === 'status') return (a.status || '').localeCompare(b.status || '');
    
    // Default: sort by due date (overdue first, then soonest)
    const da = getEffectiveEndDate(a);
    const db = getEffectiveEndDate(b);
    if (!da && !db) return 0;
    if (!da) return 1;
    if (!db) return -1;
    return da.getTime() - db.getTime();
  });
};

export const getTaskFilterOptions = (tasks: TaskData[]) => {
  const projects = Array.from(new Set(tasks.map(t => t.project_code || t.project_id).filter(Boolean))).sort() as string[];
  const years = Array.from(new Set(tasks.reduce((acc, t) => {
    const parsedDate = getEffectiveEndDate(t);
    if (parsedDate) acc.push(String(parsedDate.getFullYear()));
    return acc;
  }, [] as string[]))).sort();

  return { projects, years };
};

export const getTaskStats = (tasks: TaskData[]) => {
  let inProgressTasks = 0, completedTasks = 0, overdueTasks = 0;

  tasks.forEach(t => {
    const cat = getTaskReportCategory(t);
    if (cat === 'IN_PROGRESS') inProgressTasks++;
    else if (cat === 'COMPLETED_ON_TIME' || cat === 'COMPLETED_LATE') completedTasks++;
    else if (cat === 'OVERDUE') overdueTasks++;
  });

  return { inProgressTasks, completedTasks, overdueTasks };
};

export function isOnHoldStatus(status: string): boolean {
  return isHoldStatus(status);
}

/**
 * คำนวณ start_date และ due_date ใหม่ เมื่อ task ออกจากสถานะ On Hold
 *
 * Logic:
 *   - start_date → วันที่วันนี้ (วันที่กลับมาทำงาน)
 *   - due_date   → เลื่อนออกไปเท่ากับ duration เดิม เพื่อรักษาระยะเวลางาน
 *
 * @param oldStatus      สถานะเก่า
 * @param newStatus      สถานะใหม่
 * @param currentStartDate  start_date ปัจจุบันของ task (YYYY-MM-DD)
 * @param currentDueDate    due_date ปัจจุบันของ task (YYYY-MM-DD)
 * @param today          วันที่วันนี้ (YYYY-MM-DD) — ถ้าไม่ส่งจะใช้ new Date()
 * @returns { start_date, due_date } ถ้าควรอัปเดต หรือ null ถ้าไม่ใช่การออกจาก On Hold
 */
export function getOnHoldResumeDates(
  oldStatus: string,
  newStatus: string,
  currentStartDate?: string | null,
  currentDueDate?: string | null,
  today?: string
): { start_date: string; due_date?: string } | null {
  const isDone = isDoneStatus(newStatus);

  // เงื่อนไข: ต้องเป็นการออกจาก On Hold และไม่ใช่ Done
  if (!isOnHoldStatus(oldStatus) || isOnHoldStatus(newStatus) || isDone) {
    return null;
  }

  const todayStr = today ?? new Date().toISOString().split('T')[0];

  // ถ้ามีทั้ง start_date และ due_date → คำนวณ due_date ใหม่จาก duration เดิม
  if (currentStartDate && currentDueDate) {
    const origStart = new Date(currentStartDate);
    const origDue = new Date(currentDueDate);
    const durationMs = origDue.getTime() - origStart.getTime();
    const newDue = new Date(new Date(todayStr).getTime() + durationMs);
    return {
      start_date: todayStr,
      due_date: newDue.toISOString().split('T')[0],
    };
  }

  // ถ้ามีแค่ start_date → เลื่อนเฉพาะ start_date
  return { start_date: todayStr };
}

