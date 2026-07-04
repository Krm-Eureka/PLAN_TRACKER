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

export interface TaskData {
  task_id: string;
  task_name: string;
  status: string;
  [key: string]: any;
}

export interface ProjectData {
  project_code: string;
  project_name: string;
  status: string;
  [key: string]: any;
}

export interface PlanData {
  emp_id: string;
  name: string;
  start_date: string;
  location: string;
  duration_days: string;
}
