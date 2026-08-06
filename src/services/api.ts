// src/services/api.ts
import { api } from '@/lib/axios';
import { UserData, TaskData, ProjectData } from '@/interfaces';


export async function fetchTasksList(projectId?: string): Promise<any[]> {
  try {
    const url = projectId ? `/api/tasks?project_id=${projectId}` : `/api/tasks?limit=200`;
    const response = await api.get(url);
    if (response.data?.status === 'success') return response.data.data;
    throw new Error(response.data.message || 'Failed to fetch tasks');
  } catch (error) {
    console.error("Axios API Error (Tasks):", error);
    return [];
  }
}

// ==========================================
// MUTATIONS (PUT / POST / DELETE)
// ==========================================

// --- Tasks ---
export const updateTaskDates = async (payload: { task_id: string; start_date?: string; due_date?: string; update_date?: string; percent_complete?: number }) => {
  const res = await api.put('/api/tasks/dates', payload);
  return res.data;
};

export const updateTaskStatus = async (payload: { task_id: string; new_status: string; task_name?: string }) => {
  const res = await api.put('/api/tasks/status', payload);
  return res.data;
};

export const reorderTasks = async (updates: any[]) => {
  const res = await api.put('/api/tasks/reorder', { updates });
  return res.data;
};

export const updateTask = async (taskId: string, payload: any) => {
  const res = await api.put(`/api/tasks/${encodeURIComponent(taskId)}`, payload);
  return res.data;
};

export const createTask = async (payload: any) => {
  const res = await api.post('/api/tasks', payload);
  return res.data;
};

// --- Projects ---
export const updateProject = async (projectId: string, payload: any) => {
  const res = await api.put(`/api/projects/${encodeURIComponent(projectId)}`, payload);
  return res.data;
};

export const rescheduleProject = async (payload: any) => {
  const res = await api.put('/api/projects/reschedule', payload);
  return res.data;
};

// --- Plans ---
export const createPlan = async (payload: any) => {
  const res = await api.post('/api/plans', payload);
  return res.data;
};

export const updatePlan = async (planId: string, payload: any) => {
  const res = await api.put(`/api/plans/${encodeURIComponent(planId)}`, payload);
  return res.data;
};

export const deletePlan = async (planId: string) => {
  const res = await api.delete(`/api/plans/${encodeURIComponent(planId)}`);
  return res.data;
};

export async function fetchProject(projectId: string): Promise<ProjectData | null> {
  try {
    const response = await api.get(`/api/projects/${projectId}`);
    if (response.data?.status === 'success') return response.data.data;
    return null;
  } catch (error) {
    console.error("Axios API Error (fetchProject):", error);
    return null;
  }
}

// --- Notifications ---
export const updateNotification = async (payload: { notification_id?: string; mark_all?: boolean }) => {
  const res = await api.put('/api/notifications', payload);
  return res.data;
};

// --- Users ---
export const updateUser = async (userId: string, payload: any) => {
  const res = await api.put(`/api/users/${encodeURIComponent(userId)}`, payload);
  return res.data;
};
