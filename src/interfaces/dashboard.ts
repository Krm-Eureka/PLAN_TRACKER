import { TaskData } from './task';
import { ProjectData } from './project';
import { UserData } from './user';

export interface StatCardsProps {
  tasks: TaskData[];
  projects: ProjectData[];
}

export interface RecentTasksProps {
  tasks: TaskData[];
  userEmail: string;
}

export interface TeamWorkloadProps {
  users: UserData[];
}
