export const getStatusColor = (status: string, isOverdue?: boolean) => {
  if (isOverdue && status !== 'Done' && status !== 'Cancel') return 'bg-red-50 text-red-700 border-red-200';
  const s = (status || '').toLowerCase();
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

