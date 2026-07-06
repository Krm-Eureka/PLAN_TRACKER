export interface Plan {
  id: string;
  user_id: string;
  start_date: string; // YYYY-MM-DD format
  location: string;
  duration_days: string;
  project_id?: string;
  plan_detail?: string;
  task_id?: string;
  start_time?: string;
  end_time?: string;
}
