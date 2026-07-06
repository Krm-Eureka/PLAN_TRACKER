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
      const users = await fetchSheetData(accessToken, 'Users!A1:N');
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
