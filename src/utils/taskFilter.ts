import { TaskData } from '@/interfaces';
import { getEffectiveEndDate, isDateOverdue } from '@/utils/date';

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
    if (filters.status && (t.status || '').toLowerCase() !== filters.status.toLowerCase()) return false;
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

  const overdueTasks = tasks.filter(t => {
    const s = (t.status || '').toLowerCase();
    if (s.includes('done') || s.includes('complete') || s.includes('cancel')) return false;
    return isDateOverdue(t.update_date || t.due_date);
  }).length;

  return { inProgressTasks, completedTasks, overdueTasks };
};
