// src/services/api.ts

const API_URL = process.env.NEXT_PUBLIC_APPS_SCRIPT_URL;

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
  if (!API_URL) {
    console.warn("NEXT_PUBLIC_APPS_SCRIPT_URL is not set. Returning mock data.");
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

  try {
    const headers: HeadersInit = {};
    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }

    let res = await fetch(`${API_URL}?action=getUsers`, { 
      next: { revalidate: 60 },
      headers,
      redirect: 'manual' // Prevent automatic redirect which strips headers
    });

    // Handle Google Apps Script cross-domain redirect (302)
    if (res.status === 302 || res.status === 301 || res.status === 303 || res.status === 307) {
      const redirectUrl = res.headers.get('location');
      if (redirectUrl) {
        res = await fetch(redirectUrl, {
          next: { revalidate: 60 },
          headers, // Re-attach the Authorization header
        });
      }
    }

    const result = await res.json();
    if (result.status === 'success') {
      return result.data as UserData[];
    }
    throw new Error(result.message);
  } catch (error) {
    console.error("Error fetching users:", error);
    return [];
  }
}
