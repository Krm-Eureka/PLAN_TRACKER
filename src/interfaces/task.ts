export interface TaskData {
  id?: string;
  task_id?: string;      // เพิ่มฟิลด์นี้
  project_id: string;
  project_code?: string; // เพิ่มฟิลด์นี้
  task_name: string;
  description?: string;
  assignee_id?: string;
  assignee?: string;     // เพิ่มฟิลด์นี้
  owner_email?: string;  // เพิ่มฟิลด์นี้
  start_date?: string;
  due_date?: string;
  end_date?: string;     // เพิ่มฟิลด์นี้
  status: string;
  priority?: string;
  [key: string]: unknown;
}
