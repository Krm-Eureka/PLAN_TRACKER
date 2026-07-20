export const getStatusColor = (status: string) => {
  const s = (status || '').toLowerCase();
  if (s.includes('done') || s.includes('complete')) return 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 border-emerald-200';
  if (s.includes('progress') || s.includes('doing')) return 'bg-blue-100 text-blue-700 hover:bg-blue-200 border-blue-200';
  if (s.includes('hold') || s.includes('wait')) return 'bg-amber-100 text-amber-700 hover:bg-amber-200 border-amber-200';
  if (s.includes('over') || s.includes('late')) return 'bg-rose-100 text-rose-700 hover:bg-rose-200 border-rose-200';
  if (s.includes('cancel')) return 'bg-red-100 text-red-700 hover:bg-red-200 border-red-200';
  return 'bg-slate-100 text-slate-700 hover:bg-slate-200 border-slate-200';
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
