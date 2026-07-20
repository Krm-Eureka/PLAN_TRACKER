// src/services/api.ts
import axios from 'axios';
import { UserData, TaskData, ProjectData } from '@/interfaces';
import { fetchSheetData } from '@/lib/googleSheets';

export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || '',
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

export async function fetchTeamWorkload(accessToken?: string): Promise<UserData[]> {
  try {
    // If running on the server, fetch directly from Google Sheets API
    if (typeof window === 'undefined') {
      if (!accessToken) {
         throw new Error('Access token is required for server-side fetching');
      }
      const users = await fetchSheetData(accessToken, 'Users!A1:Z');
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
    throw error; // Throw real error, no mockup data!
  }
}

export const fetchDepartments = async (accessToken: string) => {
  try {
    const rawData = await fetchSheetData(accessToken, "Departments!A:Z");
    return rawData
      .map(row => ({
        id: String(row.id || ""),
        name: String(row.department_name || ""),
        department_id: String(row.department_id || "")
      }))
      .filter(d => d.id && d.name);
  } catch (error: any) {
    console.error("Failed to fetch Departments:", error.message || error);
    return []; // Return empty if sheet doesn't exist yet
  }
};

export async function fetchRecentTasks(accessToken?: string): Promise<TaskData[]> {
  try {
    if (typeof window === 'undefined') {
       if (!accessToken) throw new Error('Access token required');
       const tasks = await fetchSheetData(accessToken, 'Tasks!A1:Z');
       return tasks as unknown as TaskData[];
    }

    const response = await api.get('/api/tasks');
    if (response.data && response.data.status === 'success') {
      return response.data.data as TaskData[];
    }
    throw new Error(response.data.message || 'Failed to fetch tasks');
  } catch (error) {
    console.error("Axios API Error (Tasks):", error);
    // Return empty array on error so UI doesn't completely break, or throw
    return [];
  }
}

export async function fetchProjects(accessToken?: string): Promise<ProjectData[]> {
  try {
    if (typeof window === 'undefined') {
       if (!accessToken) throw new Error('Access token required');
       const projects = await fetchSheetData(accessToken, 'Projects!A1:Z');
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

export async function fetchPlans(accessToken?: string): Promise<any[]> {
  try {
    if (typeof window === 'undefined') {
       if (!accessToken) throw new Error('Access token required');
       // We fetch raw plans from sheets. Note: This will not have enriched names,
       // but we can enrich it in page.tsx since it already fetches users.
       const plans = await fetchSheetData(accessToken, 'Plans!A1:Z');
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

export async function fetchActivityLogs(accessToken?: string): Promise<any[]> {
  try {
    if (typeof window === 'undefined') {
       if (!accessToken) throw new Error('Access token required');
       const logs = await fetchSheetData(accessToken, 'Logs!A1:Z');
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
