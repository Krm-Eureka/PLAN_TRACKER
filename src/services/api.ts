// src/services/api.ts
import { api } from '@/lib/axios';

export interface UserData {
  no: string;
  emp_id: string;
  name_th: string;
  name_en: string;
  nickname: string;
  dl_status: string;
  position: string;
  department: string;
  division: string;
  start_date: string;
  telephone: string;
  email: string;
  role_system: string;
  active_tasks: number;
}

export async function fetchTeamWorkload(accessToken?: string): Promise<UserData[]> {
  try {
    // We now use Axios to call our internal Backend API route
    // The internal API route will handle the communication with Google Apps Script
    // and securely inject the token.
    const response = await api.get('/api/users');
    
    if (response.data && response.data.status === 'success') {
      return response.data.data as UserData[];
    }
    
    throw new Error(response.data.message || 'Failed to fetch from internal API');
  } catch (error) {
    console.error("Axios API Error (Users):", error);
    
    // Fallback Mock Data
    return [
      {
        no: "1", emp_id: "EMP001", name_th: "วิศรุต สนองผัน", name_en: "Witsarut Sanongphun",
        nickname: "", dl_status: "Non DL", position: "IT PROGRAMMER", department: "KRM",
        division: "IT", start_date: "", telephone: "0962231700", email: "witsarut@eurekaautomation.co.th",
        role_system: "Developer", active_tasks: 12
      },
      {
        no: "2", emp_id: "EMP002", name_th: "สมชาย ใจดี", name_en: "Somchai Jaidee",
        nickname: "Som", dl_status: "Non DL", position: "Support", department: "Helpdesk",
        division: "IT", start_date: "", telephone: "0812345678", email: "somchai@eurekaautomation.co.th",
        role_system: "Staff", active_tasks: 3
      }
    ];
  }
}
