// src/services/api.ts
import { api } from '@/lib/axios';
import { UserData, TaskData, ProjectData } from '@/interfaces';
import { unstable_cache } from 'next/cache';

// ดึง users จาก DB พร้อม cache 60 วินาที (เปลี่ยนไม่บ่อย)
const fetchUsersFromDB = unstable_cache(
  async () => {
    const { prisma } = await import('@/lib/prisma');
    return prisma.user.findMany();
  },
  ['users-all'],
  { revalidate: 60, tags: ['users'] }
);

export async function fetchTeamWorkload(_accessToken?: string): Promise<UserData[]> {
  try {
    if (typeof window === 'undefined') {
      const users = await fetchUsersFromDB();
      return users as unknown as UserData[];
    }
    const response = await api.get('/api/users');
    if (response.data?.status === 'success') return response.data.data as UserData[];
    throw new Error(response.data.message || 'Failed to fetch from internal API');
  } catch (error) {
    console.error("Axios API Error (Users):", error);
    throw error;
  }
}

// ดึง departments จาก DB พร้อม cache 5 นาที (แทบไม่เปลี่ยน)
const fetchDepartmentsFromDB = unstable_cache(
  async () => {
    const { prisma } = await import('@/lib/prisma');
    return prisma.department.findMany();
  },
  ['departments-all'],
  { revalidate: 300, tags: ['departments'] }
);

export const fetchDepartments = async (_accessToken?: string) => {
  try {
    if (typeof window === 'undefined') {
      const depts = await fetchDepartmentsFromDB();
      return depts.map((dept: { id: string; department_name: string | null; name?: string | null; department_id: string | null }) => ({
        id: dept.id,
        name: dept.department_name || dept.name,
        department_id: dept.department_id
      })).filter((dept: { id: string; name: string | null | undefined }) => dept.id && dept.name);
    }
    const response = await api.get('/api/departments');
    if (response.data?.status === 'success') return response.data.data;
    return [];
  } catch (error: any) {
    console.error("Failed to fetch Departments:", error.message || error);
    return [];
  }
};

// Tasks cache สั้น (30s) เพราะ status เปลี่ยนบ่อย
const fetchTasksFromDB = unstable_cache(
  async () => {
    const { prisma } = await import('@/lib/prisma');
    return prisma.task.findMany({ orderBy: { created_at: 'desc' }, take: 100 });
  },
  ['tasks-recent'],
  { revalidate: 30, tags: ['tasks'] }
);

export async function fetchRecentTasks(_accessToken?: string): Promise<TaskData[]> {
  try {
    if (typeof window === 'undefined') {
      if (process.env.PLAYWRIGHT_TEST === '1' || process.env.NEXT_PUBLIC_PLAYWRIGHT_TEST === '1') {
        return [
          { id: 'min-task-1', project_id: 'min-proj-1', task_name: 'Minimal Task 1', status: 'Pending' },
          { id: 'task-min-88', project_id: 'proj-min-99', task_name: 'Very Minimal Task Display', status: 'In Progress' }
        ] as any;
      }
      const tasks = await fetchTasksFromDB();
      return tasks as unknown as TaskData[];
    }
    const response = await api.get('/api/tasks');
    if (response.data?.status === 'success') return response.data.data as TaskData[];
    throw new Error(response.data.message || 'Failed to fetch tasks');
  } catch (error) {
    console.error("Axios API Error (Tasks):", error);
    return [];
  }
}

// Projects cache 60s
const fetchProjectsFromDB = unstable_cache(
  async () => {
    const { prisma } = await import('@/lib/prisma');
    return prisma.project.findMany({ orderBy: { created_at: 'desc' } });
  },
  ['projects-all'],
  { revalidate: 60, tags: ['projects'] }
);

export async function fetchProjects(_accessToken?: string): Promise<ProjectData[]> {
  try {
    if (typeof window === 'undefined') {
      if (process.env.PLAYWRIGHT_TEST === '1' || process.env.NEXT_PUBLIC_PLAYWRIGHT_TEST === '1') {
        return [
          { id: 'min-proj-1', project_code: 'MP-01', project_name: 'Minimal Project A', status: 'In Progress', department: 'dept-1' },
          { id: 'proj-min-99', project_code: 'MP-99', project_name: 'Super Minimal Project', status: 'In Progress', department: 'dept-1' }
        ] as any;
      }
      const projects = await fetchProjectsFromDB();
      return projects as unknown as ProjectData[];
    }
    const response = await api.get('/api/projects');
    if (response.data?.status === 'success') return response.data.data as ProjectData[];
    throw new Error(response.data.message || 'Failed to fetch projects');
  } catch (error) {
    console.error("Axios API Error (Projects):", error);
    return [];
  }
}

// Plans cache 60s
const fetchPlansFromDB = unstable_cache(
  async () => {
    const { prisma } = await import('@/lib/prisma');
    return prisma.plan.findMany({ orderBy: { created_at: 'desc' } });
  },
  ['plans-all'],
  { revalidate: 60, tags: ['plans'] }
);

export async function fetchPlans(_accessToken?: string): Promise<any[]> {
  try {
    if (typeof window === 'undefined') {
      return (await fetchPlansFromDB()) as any[];
    }
    const response = await api.get('/api/plans');
    if (response.data?.status === 'success') return response.data.data;
    throw new Error(response.data.message || 'Failed to fetch plans');
  } catch (error) {
    console.error("Axios API Error (Plans):", error);
    return [];
  }
}

// Logs cache 30s
const fetchLogsFromDB = unstable_cache(
  async () => {
    const { prisma } = await import('@/lib/prisma');
    return prisma.log.findMany({ orderBy: { created_at: 'desc' }, take: 200 });
  },
  ['logs-recent'],
  { revalidate: 30, tags: ['logs'] }
);

export async function fetchActivityLogs(_accessToken?: string): Promise<any[]> {
  try {
    if (typeof window === 'undefined') {
      return (await fetchLogsFromDB()) as any[];
    }
    const response = await api.get('/api/logs');
    if (response.data?.status === 'success') return response.data.data;
    throw new Error(response.data.message || 'Failed to fetch activity logs');
  } catch (error) {
    console.error("Axios API Error (Logs):", error);
    return [];
  }
}
