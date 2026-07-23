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

  const today = new Date();
  
  // Exact time comparison
  return due < today;
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

