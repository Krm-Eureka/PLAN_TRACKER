export interface ProjectData {
  id?: string;
  project_code: string;
  project_name: string;
  client_name?: string;
  manager?: string;
  start_date?: string;
  end_date?: string;
  status: string;
  priority?: string;
  [key: string]: any;
}
