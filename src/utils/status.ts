export const getStatusColor = (status: string) => {
  const s = (status || '').toLowerCase();
  if (s.includes('done') || s.includes('complete')) return 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 border-emerald-200';
  if (s.includes('progress') || s.includes('doing')) return 'bg-blue-100 text-blue-700 hover:bg-blue-200 border-blue-200';
  if (s.includes('hold') || s.includes('wait')) return 'bg-amber-100 text-amber-700 hover:bg-amber-200 border-amber-200';
  if (s.includes('over') || s.includes('late')) return 'bg-rose-100 text-rose-700 hover:bg-rose-200 border-rose-200';
  if (s.includes('cancel')) return 'bg-red-100 text-red-700 hover:bg-red-200 border-red-200';
  return 'bg-slate-100 text-slate-700 hover:bg-slate-200 border-slate-200';
};
