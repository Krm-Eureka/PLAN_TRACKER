// src/services/api.ts
import axios from 'axios';
import { UserData, TaskData, ProjectData } from '@/interfaces';

export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || '',
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

export async function fetchTeamWorkload(_accessToken?: string): Promise<UserData[]> {
  try {
    // If running on the server, use Prisma directly
    if (typeof window === 'undefined') {
      const { prisma } = await import('@/lib/prisma');
      const users = await prisma.user.findMany();
      return users as unknown as UserData[];
    }

    // If running on the client, fetch via our internal Next.js API route
    const response = await api.get('/api/users');
    
    if (response.data && response.data.status === 'success') {
      return response.data.data as UserData[];
    }
    
    throw new Error(response.data.message || 'Failed to fetch from internal API');
  } catch (error) {
    console.error("Axios API Error (Users):", error);
    throw error;
  }
}

export const fetchDepartments = async (_accessToken?: string) => {
  try {
    if (typeof window === 'undefined') {
      const { prisma } = await import('@/lib/prisma');
      const depts = await prisma.department.findMany();
      return depts.map(d => ({
        id: d.id,
        name: d.department_name || d.name,
        department_id: d.department_id
      })).filter(d => d.id && d.name);
    }

    const response = await api.get('/api/departments');
    if (response.data && response.data.status === 'success') {
      return response.data.data;
    }
    return [];
  } catch (error: any) {
    console.error("Failed to fetch Departments:", error.message || error);
    return [];
  }
};

export async function fetchRecentTasks(_accessToken?: string): Promise<TaskData[]> {
  try {
    if (typeof window === 'undefined') {
      const { prisma } = await import('@/lib/prisma');
      const tasks = await prisma.task.findMany({ orderBy: { created_at: 'desc' }, take: 100 });
      return tasks as unknown as TaskData[];
    }

    const response = await api.get('/api/tasks');
    if (response.data && response.data.status === 'success') {
      return response.data.data as TaskData[];
    }
    throw new Error(response.data.message || 'Failed to fetch tasks');
  } catch (error) {
    console.error("Axios API Error (Tasks):", error);
    return [];
  }
}

export async function fetchProjects(_accessToken?: string): Promise<ProjectData[]> {
  try {
    if (typeof window === 'undefined') {
      const { prisma } = await import('@/lib/prisma');
      const projects = await prisma.project.findMany({ orderBy: { created_at: 'desc' } });
      return projects as unknown as ProjectData[];
    }

    const response = await api.get('/api/projects');
    if (response.data && response.data.status === 'success') {
      return response.data.data as ProjectData[];
    }
    throw new Error(response.data.message || 'Failed to fetch projects');
  } catch (error) {
    console.error("Axios API Error (Projects):", error);
    return [];
  }
}

export async function fetchPlans(_accessToken?: string): Promise<any[]> {
  try {
    if (typeof window === 'undefined') {
      const { prisma } = await import('@/lib/prisma');
      const plans = await prisma.plan.findMany({ orderBy: { created_at: 'desc' } });
      return plans as any[];
    }

    const response = await api.get('/api/plans');
    if (response.data && response.data.status === 'success') {
      return response.data.data;
    }
    throw new Error(response.data.message || 'Failed to fetch plans');
  } catch (error) {
    console.error("Axios API Error (Plans):", error);
    return [];
  }
}

export async function fetchActivityLogs(_accessToken?: string): Promise<any[]> {
  try {
    if (typeof window === 'undefined') {
      const { prisma } = await import('@/lib/prisma');
      const logs = await prisma.log.findMany({ orderBy: { created_at: 'desc' }, take: 200 });
      return logs as any[];
    }

    const response = await api.get('/api/logs');
    if (response.data && response.data.status === 'success') {
      return response.data.data;
    }
    throw new Error(response.data.message || 'Failed to fetch activity logs');
  } catch (error) {
    console.error("Axios API Error (Logs):", error);
    return [];
  }
}
