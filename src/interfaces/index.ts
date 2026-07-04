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
  project_code: string;
  task_name: string;
  description?: string;
  assignee?: string;
  start_date?: string;
  due_date?: string;
  status: string;
  priority?: string;
  [key: string]: any;
}

export interface ProjectData {
  project_code: string;
  project_name: string;
  description?: string;
  manager?: string;
  start_date?: string;
  end_date?: string;
  status: string;
  priority?: string;
  [key: string]: any;
}

export interface PlanData {
  emp_id: string;
  name: string;
  start_date: string;
  location: string;
  duration_days: string;
}
