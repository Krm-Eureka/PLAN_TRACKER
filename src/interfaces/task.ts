export interface TaskData {
  id?: string;
  project_id: string;
  task_name: string;
  description?: string;
  assignee_id?: string;
  start_date?: string;
  due_date?: string;
  status: string;
  priority?: string;
  [key: string]: unknown;
}
