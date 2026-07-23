/**
 * Statuses that are considered "terminal" — tasks/projects in these states
 * are never counted as overdue, even if their due date has passed.
 */
const EXEMPT_FROM_OVERDUE = ['done', 'complete', 'cancel', 'hold', 'wait'];

/**
 * Returns true if a status string matches any exempt keyword.
 */
function isStatusExempt(status: string): boolean {
  const s = (status || '').toLowerCase();
  return EXEMPT_FROM_OVERDUE.some(k => s.includes(k));
}

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
  const s = (status || '').toLowerCase();
  // On Hold is never shown as overdue — always amber
  if (isOverdue && !s.includes('hold') && !s.includes('wait') && status !== 'Done' && status !== 'Cancel') return 'bg-red-50 text-red-700 border-red-200';
  if (s.includes('done') || s.includes('complete')) return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (s.includes('progress') || s.includes('doing')) return 'bg-blue-50 text-blue-700 border-blue-200';
  if (s.includes('review')) return 'bg-purple-50 text-purple-700 border-purple-200';
  if (s.includes('hold') || s.includes('wait')) return 'bg-amber-50 text-amber-700 border-amber-200';
  if (s.includes('cancel')) return 'bg-slate-50 text-slate-500 border-slate-200';
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
  const s = (status || 'To Do').toLowerCase();
  if (s.includes('progress')) return 'In Progress';
  if (s.includes('review')) return 'Review';
  if (s.includes('hold')) return 'Hold';
  if (s.includes('done') || s.includes('complete')) return 'Done';
  if (s.includes('cancel')) return 'Cancel';
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






export interface TaskFilters {
  search: string;
  status: string;
  project: string;
  year: string;
  month: string;
}

export const filterTasks = (tasks: TaskData[], filters: TaskFilters): TaskData[] => {
  return tasks.filter(t => {
    if (filters.search && !(t.task_name || '').toLowerCase().includes(filters.search.toLowerCase())) return false;
    if (filters.status) {
      const ts = (t.status || '').toLowerCase();
      const fs = filters.status.toLowerCase();
      if (fs === 'to do') {
        if (!ts.includes('to do') && ts !== '') return false;
      } else if (fs === 'in progress') {
        if (!ts.includes('progress')) return false;
      } else if (fs === 'done') {
        if (!ts.includes('done') && !ts.includes('complete')) return false;
      } else {
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
  const inProgressTasks = tasks.filter(t => {
    const s = (t.status || '').toLowerCase();
    return s.includes('progress') || s.includes('doing');
  }).length;

  const completedTasks = tasks.filter(t => {
    const s = (t.status || '').toLowerCase();
    return s.includes('done') || s.includes('complete');
  }).length;

  const overdueTasks = tasks.filter(t => isTaskOverdue(t.status || '', t.due_date)).length;

  return { inProgressTasks, completedTasks, overdueTasks };
};
