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
