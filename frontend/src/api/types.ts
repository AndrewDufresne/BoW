export interface Team {
  id: string;
  name: string;
  description?: string | null;
  manager?: string | null;
  active: boolean;
  member_count: number;
}

export interface TeamMini {
  id: string;
  name: string;
}

export type EmploymentType = string;

export interface Person {
  id: string;
  employee_id?: string | null;
  name: string;
  email?: string | null;
  location?: string | null;
  line_manager?: string | null;
  allocation: number | string;
  employment_type: EmploymentType;
  funding?: string | null;
  team_id: string;
  team?: TeamMini | null;
  active: boolean;
}

export interface Project {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  funding?: string | null;
  active: boolean;
  sub_project_count: number;
}

export interface SubProject {
  id: string;
  project_id: string;
  name: string;
  description?: string | null;
  funding?: string | null;
  active: boolean;
  project_name?: string | null;
}

export interface SubProjectMini {
  id: string;
  name: string;
  description?: string | null;
  funding?: string | null;
}

export interface ProjectWithSubs {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  funding?: string | null;
  sub_projects: SubProjectMini[];
}

export interface SubmissionLine {
  id?: string;
  project_id: string;
  sub_project_id: string;
  time_spent_pct: number | string;
  comments?: string | null;
  project_name?: string | null;
  sub_project_name?: string | null;
}

export interface Submission {
  id: string;
  person_id: string;
  team_id: string;
  month: string;
  status: string;
  total_percent: number | string;
  person_name?: string | null;
  team_name?: string | null;
  lines: SubmissionLine[];
}

export interface TeamProgress {
  team_id: string;
  team_name: string;
  total_active: number;
  submitted_count: number;
  completion_pct: number;
}

export interface DashboardSubmissionRow {
  submission_id: string | null;
  person_id: string;
  person_name: string;
  team_id: string;
  team_name: string;
  month: string;
  status: "submitted" | "missing";
  total_percent: number | string | null;
  updated_at: string | null;
}