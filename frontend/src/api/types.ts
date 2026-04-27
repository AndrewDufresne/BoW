export interface Team {
  id: string;
  name: string;
  description?: string | null;
  active: boolean;
  member_count: number;
}

export interface Person {
  id: string;
  name: string;
  email?: string | null;
  team_id?: string | null;
  team_name?: string | null;
  active: boolean;
}

export interface Project {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  active: boolean;
  activity_count: number;
}

export interface Activity {
  id: string;
  project_id: string;
  name: string;
  active: boolean;
  project_name?: string | null;
}

export interface SubmissionLine {
  id?: string;
  project_id: string;
  activity_id: string;
  time_spent_pct: number | string;
  comments?: string | null;
  project_name?: string | null;
  activity_name?: string | null;
}

export interface Submission {
  id: string;
  person_id: string;
  team_id?: string | null;
  month: string;
  status: string;
  total_percent: number | string;
  person_name?: string | null;
  team_name?: string | null;
  lines: SubmissionLine[];
}
