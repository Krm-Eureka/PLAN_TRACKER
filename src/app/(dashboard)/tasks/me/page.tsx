'use client';

import { useEffect, useState, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { showToast } from '@/utils/toast';
import { Search, SlidersHorizontal, X, Eye, AlertCircle, Clock, CheckCircle2, Circle, PauseCircle, XCircle, RotateCcw } from 'lucide-react';

const STATUS_OPTIONS = ['To Do', 'In Progress', 'Review', 'Done', 'Hold', 'Cancel'];

const STATUS_META: Record<string, { color: string; bg: string; icon: React.ReactNode }> = {
  'done':        { color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-300', icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
  'complete':    { color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-300', icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
  'in progress': { color: 'text-blue-700',    bg: 'bg-blue-50 border-blue-300',       icon: <RotateCcw className="w-3.5 h-3.5" /> },
  'review':      { color: 'text-purple-700',  bg: 'bg-purple-50 border-purple-300',   icon: <Eye className="w-3.5 h-3.5" /> },
  'hold':        { color: 'text-amber-700',   bg: 'bg-amber-50 border-amber-300',     icon: <PauseCircle className="w-3.5 h-3.5" /> },
  'cancel':      { color: 'text-slate-500',   bg: 'bg-slate-100 border-slate-300',    icon: <XCircle className="w-3.5 h-3.5" /> },
  'to do':       { color: 'text-slate-600',   bg: 'bg-slate-50 border-slate-200',     icon: <Circle className="w-3.5 h-3.5" /> },
};

function getStatusMeta(status: string) {
  const key = (status || '').toLowerCase();
  for (const [k, v] of Object.entries(STATUS_META)) {
    if (key.includes(k)) return v;
  }
  return STATUS_META['to do'];
}

function parseSafeDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  const dmyMatch = dateStr.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (dmyMatch) {
    const d = new Date(parseInt(dmyMatch[3]), parseInt(dmyMatch[2]) - 1, parseInt(dmyMatch[1]));
    return isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? null : d;
}

function formatDisplayDate(dateStr: string) {
  const d = parseSafeDate(dateStr);
  if (!d) return '-';
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

function getDueLabel(dateStr: string, status: string) {
  const s = (status || '').toLowerCase();
  if (s.includes('cancel') || s.includes('done') || s.includes('complete'))
    return { label: formatDisplayDate(dateStr) || '-', danger: false };

  const d = parseSafeDate(dateStr);
  if (!d) return { label: '-', danger: false };

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
  const diff = Math.ceil((d.getTime() - today.getTime()) / 86400000);

  if (+d === +today) return { label: 'Today', danger: true };
  if (+d === +tomorrow) return { label: 'Tomorrow', danger: true };
  if (d < today) return { label: 'Overdue', danger: true };
  if (diff <= 7) return { label: `${diff}d left`, danger: false };
  return { label: formatDisplayDate(dateStr), danger: false };
}

export default function MyTasksPage() {
  const { data: session } = useSession();
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState<any | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterProject, setFilterProject] = useState('');
  const [filterYear, setFilterYear] = useState('');
  const [filterMonth, setFilterMonth] = useState('');
  const [sortBy, setSortBy] = useState<'due' | 'name' | 'project' | 'status'>('due');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 5;

  const userEmail = (session?.user as any)?.email || '';

  useEffect(() => {
    if (!userEmail) return;
    setLoading(true);
    fetch('/api/tasks/me')
      .then(r => r.json())
      .then(data => {
        const all: any[] = data.tasks || [];
        const mine = all.filter(t => {
          const assignee = (t.assignee || t.owner_email || '').toLowerCase();
          return assignee === userEmail.toLowerCase();
        });
        setTasks(mine);
      })
      .catch(() => setTasks([]))
      .finally(() => setLoading(false));
  }, [userEmail]);

  const projects = useMemo(() => {
    const s = new Set(tasks.map(t => t.project_code || t.project_id).filter(Boolean));
    return Array.from(s).sort();
  }, [tasks]);

  const years = useMemo(() => {
    const s = new Set<string>();
    tasks.forEach(t => {
      const d = parseSafeDate(t.end_date || t.due_date);
      if (d) s.add(String(d.getFullYear()));
    });
    return Array.from(s).sort();
  }, [tasks]);

  const hasFilter = search || filterStatus || filterProject || filterYear || filterMonth;

  // Reset to page 1 whenever filters/sort change
  const resetPage = () => setPage(1);

  const filtered = useMemo(() => {
    let result = tasks.filter(t => {
      if (search && !(t.task_name || '').toLowerCase().includes(search.toLowerCase())) return false;
      if (filterStatus && (t.status || '').toLowerCase() !== filterStatus.toLowerCase()) return false;
      if (filterProject && (t.project_code || t.project_id) !== filterProject) return false;
      const d = parseSafeDate(t.end_date || t.due_date);
      if (filterYear && d && String(d.getFullYear()) !== filterYear) return false;
      if (filterMonth && d && String(d.getMonth() + 1).padStart(2, '0') !== filterMonth) return false;
      return true;
    });

    result = [...result].sort((a, b) => {
      if (sortBy === 'name') return (a.task_name || '').localeCompare(b.task_name || '');
      if (sortBy === 'project') return (a.project_code || '').localeCompare(b.project_code || '');
      if (sortBy === 'status') return (a.status || '').localeCompare(b.status || '');
      // Default: sort by due date (overdue first, then soonest)
      const da = parseSafeDate(a.end_date || a.due_date);
      const db = parseSafeDate(b.end_date || b.due_date);
      if (!da && !db) return 0;
      if (!da) return 1;
      if (!db) return -1;
      return da.getTime() - db.getTime();
    });

    return result;
  }, [tasks, search, filterStatus, filterProject, filterYear, filterMonth, sortBy]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = useMemo(
    () => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filtered, page, PAGE_SIZE]
  );

  // Stats
  const stats = useMemo(() => {
    const today = new Date(); today.setHours(0,0,0,0);
    return {
      total: filtered.length,
      todo: filtered.filter(t => (t.status || 'To Do').toLowerCase().includes('to do') || !(t.status)).length,
      inProgress: filtered.filter(t => (t.status || '').toLowerCase().includes('progress')).length,
      review: filtered.filter(t => (t.status || '').toLowerCase().includes('review')).length,
      done: filtered.filter(t => (t.status || '').toLowerCase().includes('done') || (t.status || '').toLowerCase().includes('complete')).length,
      overdue: filtered.filter(t => {
        const d = parseSafeDate(t.end_date || t.due_date);
        const s = (t.status || '').toLowerCase();
        return d && d < today && !s.includes('done') && !s.includes('cancel') && !s.includes('complete');
      }).length,
    };
  }, [filtered]);

  const handleStatusChange = async (task: any, newStatus: string) => {
    const id = task.task_id || task.id;
    setUpdatingId(id);
    try {
      const res = await fetch('/api/tasks/status', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task_id: id, new_status: newStatus, task_name: task.task_name }),
      });
      if (!res.ok) throw new Error();
      setTasks(prev => prev.map(t => (t.task_id || t.id) === id ? { ...t, status: newStatus } : t));
      if (selectedTask && (selectedTask.task_id || selectedTask.id) === id) {
        setSelectedTask((p: any) => ({ ...p, status: newStatus }));
      }
      showToast.success('Status updated');
    } catch {
      showToast.error('Failed to update status');
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">My Tasks</h1>
        <p className="text-slate-500">Tasks assigned to you across all projects.</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: 'Total', value: stats.total, color: 'text-slate-700', bg: 'bg-slate-50 border-slate-200' },
          { label: 'To Do', value: stats.todo, color: 'text-slate-600', bg: 'bg-slate-50 border-slate-200', status: 'To Do' },
          { label: 'In Progress', value: stats.inProgress, color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200', status: 'In Progress' },
          { label: 'Review', value: stats.review, color: 'text-purple-700', bg: 'bg-purple-50 border-purple-200', status: 'Review' },
          { label: 'Done', value: stats.done, color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200', status: 'Done' },
          { label: 'Overdue', value: stats.overdue, color: 'text-red-700', bg: 'bg-red-50 border-red-200' },
        ].map(s => (
          <button
            key={s.label}
            onClick={() => s.status ? setFilterStatus(filterStatus === s.status ? '' : s.status) : null}
            className={`rounded-xl border p-3 text-left transition-all shadow-sm hover:shadow-md ${s.bg} ${s.status && filterStatus === s.status ? 'ring-2 ring-inset ring-indigo-500' : ''}`}
          >
            <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-xs text-slate-500 mt-0.5">{s.label}</div>
          </button>
        ))}
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-wrap gap-2 items-center bg-white border border-slate-200 rounded-xl px-4 py-3 shadow-sm">
        {/* Search */}
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <input
            className="w-full pl-8 pr-3 py-1.5 text-sm border border-slate-200 rounded-lg bg-slate-50 text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400"
            placeholder="Search tasks..."
            value={search}
            onChange={e => { setSearch(e.target.value); resetPage(); }}
          />
        </div>

        <SlidersHorizontal className="w-4 h-4 text-slate-400 shrink-0" />

        {/* Status */}
        <select className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-slate-50 text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400"
          value={filterStatus} onChange={e => { setFilterStatus(e.target.value); resetPage(); }}>
          <option value="">All Status</option>
          {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>

        {/* Project */}
        <select className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-slate-50 text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400"
          value={filterProject} onChange={e => { setFilterProject(e.target.value); resetPage(); }}>
          <option value="">All Projects</option>
          {projects.map(p => <option key={p} value={p}>{p}</option>)}
        </select>

        {/* Year */}
        <select className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-slate-50 text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400"
          value={filterYear} onChange={e => { setFilterYear(e.target.value); setFilterMonth(''); resetPage(); }}>
          <option value="">All Years</option>
          {years.map(y => <option key={y} value={y}>{y}</option>)}
        </select>

        {/* Month */}
        <select className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-slate-50 text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400"
          value={filterMonth} onChange={e => { setFilterMonth(e.target.value); resetPage(); }}>
          <option value="">All Months</option>
          {['01','02','03','04','05','06','07','08','09','10','11','12'].map((m,i) => (
            <option key={m} value={m}>{new Date(2000,i).toLocaleString('en',{month:'long'})}</option>
          ))}
        </select>

        {/* Sort */}
        <select className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-slate-50 text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400"
          value={sortBy} onChange={e => { setSortBy(e.target.value as any); resetPage(); }}>
          <option value="due">Sort: Due Date</option>
          <option value="name">Sort: Name</option>
          <option value="project">Sort: Project</option>
          <option value="status">Sort: Status</option>
        </select>

        {hasFilter && (
          <button onClick={() => { setSearch(''); setFilterStatus(''); setFilterProject(''); setFilterYear(''); setFilterMonth(''); resetPage(); }}
            className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700 px-2 py-1.5 rounded hover:bg-red-50 transition font-medium">
            <X className="w-3.5 h-3.5" /> Clear
          </button>
        )}
      </div>

      {/* Task List */}
      <Card className="shadow-sm border-slate-200/60">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Tasks</CardTitle>
              <CardDescription>Click a task row or 👁 to view full details.</CardDescription>
            </div>
            <Badge variant="outline" className="text-slate-500">{filtered.length} tasks</Badge>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-12 text-slate-400 animate-pulse">Loading tasks...</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-slate-500 bg-slate-50 rounded-lg border border-dashed border-slate-200">
              No tasks found.
            </div>
          ) : (
            <div className="space-y-2">
              {paginated.map((task, index) => {
                const due = getDueLabel(task.end_date || task.due_date, task.status);
                const meta = getStatusMeta(task.status);
                const isCancelled = (task.status || '').toLowerCase().includes('cancel');
                const id = task.task_id || task.id;
                const isUpdating = updatingId === id;

                return (
                  <div
                    key={id || index}
                    className="flex items-center gap-3 p-3 bg-white rounded-xl border border-slate-200 hover:border-indigo-300 hover:shadow-sm transition-all group"
                  >
                    {/* Task name */}
                    <div
                      className="flex flex-col gap-0.5 min-w-0 flex-1 cursor-pointer"
                      onClick={() => setSelectedTask(task)}
                    >
                      <span className={`font-medium truncate group-hover:text-indigo-600 transition-colors ${isCancelled ? 'line-through text-slate-400' : 'text-slate-800'}`}>
                        {task.task_name}
                      </span>
                      <div className="flex gap-2 items-center">
                        <span className="text-xs text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100 font-medium">
                          {task.project_code || task.project_id || '-'}
                        </span>
                        {task.priority && (
                          <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${task.priority === 'High' || task.priority === 'Urgent' ? 'bg-red-50 text-red-600' : 'bg-slate-100 text-slate-500'}`}>
                            {task.priority}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Due date */}
                    <div className="flex flex-col items-center w-24 shrink-0">
                      <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wide">Due</span>
                      <span className={`text-xs font-semibold mt-0.5 ${due.danger ? 'text-red-600' : 'text-slate-600'}`}>
                        {due.label}
                      </span>
                    </div>

                    {/* Status dropdown */}
                    <select
                      className={`text-xs font-semibold rounded-lg border px-2 py-1.5 outline-none cursor-pointer transition-all shrink-0 ${meta.bg} ${meta.color} ${isUpdating ? 'opacity-40' : ''}`}
                      value={task.status || 'To Do'}
                      disabled={isUpdating}
                      onChange={e => handleStatusChange(task, e.target.value)}
                      onClick={e => e.stopPropagation()}
                    >
                      {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>

                    {/* View button */}
                    <button
                      onClick={() => setSelectedTask(task)}
                      className="shrink-0 text-slate-300 hover:text-indigo-500 transition p-1 rounded hover:bg-indigo-50"
                      title="View details"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Pagination */}
          {!loading && totalPages > 1 && (
            <div className="flex items-center justify-between pt-4 border-t border-slate-100 mt-2">
              <span className="text-xs text-slate-500">
                Page {page} of {totalPages} &nbsp;·&nbsp; {filtered.length} tasks
              </span>
              <div className="flex gap-1">
                <button
                  onClick={() => setPage(1)}
                  disabled={page === 1}
                  className="px-2 py-1 text-xs rounded border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
                >«</button>
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-2.5 py-1 text-xs rounded border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
                >‹ Prev</button>
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
                  .reduce<(number | '...')[]>((acc, p, i, arr) => {
                    if (i > 0 && p - (arr[i - 1] as number) > 1) acc.push('...');
                    acc.push(p);
                    return acc;
                  }, [])
                  .map((p, i) => p === '...' ? (
                    <span key={`ellipsis-${i}`} className="px-2 py-1 text-xs text-slate-400">…</span>
                  ) : (
                    <button
                      key={p}
                      onClick={() => setPage(p as number)}
                      className={`px-2.5 py-1 text-xs rounded border font-medium transition ${
                        page === p
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >{p}</button>
                  ))
                }
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-2.5 py-1 text-xs rounded border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
                >Next ›</button>
                <button
                  onClick={() => setPage(totalPages)}
                  disabled={page === totalPages}
                  className="px-2 py-1 text-xs rounded border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
                >»</button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Task Detail Modal */}
      {selectedTask && (
        <div
          className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm"
          onClick={() => setSelectedTask(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col animate-in zoom-in-95 duration-200"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 rounded-t-2xl bg-slate-50">
              <h3 className="text-lg font-bold text-slate-800">Task Details</h3>
              <button onClick={() => setSelectedTask(null)} className="text-slate-400 hover:text-slate-700 p-1 rounded-full hover:bg-slate-200 transition">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Task Name</label>
                <p className={`mt-1 text-slate-900 font-semibold text-base ${(selectedTask.status||'').toLowerCase().includes('cancel') ? 'line-through text-slate-400' : ''}`}>
                  {selectedTask.task_name}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Project</label>
                  <p className="mt-1 text-indigo-600 font-medium text-sm">{selectedTask.project_code || '-'}</p>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Priority</label>
                  <p className="mt-1 text-sm text-slate-700">{selectedTask.priority || 'Normal'}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Start Date</label>
                  <p className="mt-1 text-sm text-slate-700">{formatDisplayDate(selectedTask.start_date)}</p>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">End Date</label>
                  <p className={`mt-1 text-sm font-medium ${getDueLabel(selectedTask.end_date || selectedTask.due_date, selectedTask.status).danger ? 'text-red-600' : 'text-slate-700'}`}>
                    {formatDisplayDate(selectedTask.end_date || selectedTask.due_date)}
                  </p>
                </div>
              </div>

              {selectedTask.assignee && (
                <div>
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Assignee</label>
                  <p className="mt-1 text-sm text-indigo-700 bg-indigo-50 px-2 py-1 rounded inline-block">{selectedTask.assignee}</p>
                </div>
              )}

              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2">Status</label>
                <select
                  className={`text-sm font-semibold rounded-lg border px-3 py-2 outline-none cursor-pointer ${getStatusMeta(selectedTask.status).bg} ${getStatusMeta(selectedTask.status).color} ${updatingId === (selectedTask.task_id||selectedTask.id) ? 'opacity-50' : ''}`}
                  value={selectedTask.status || 'To Do'}
                  disabled={updatingId === (selectedTask.task_id||selectedTask.id)}
                  onChange={e => handleStatusChange(selectedTask, e.target.value)}
                >
                  {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              {selectedTask.description && (
                <div>
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Description</label>
                  <div className="mt-1 text-sm text-slate-600 whitespace-pre-wrap bg-slate-50 p-3 rounded-lg border border-slate-100 max-h-48 overflow-y-auto">
                    {selectedTask.description}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
