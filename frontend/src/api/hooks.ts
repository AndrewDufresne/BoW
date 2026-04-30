import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./client";
import type {
  DashboardSubmissionRow,
  EmploymentType,
  Person,
  Project,
  ProjectWithSubs,
  SubProject,
  Submission,
  SubmissionLine,
  Team,
  TeamProgress,
} from "./types";

/* ---------- Teams ---------- */
export const teamsKey = (active?: boolean) => ["teams", { active }] as const;

export function useTeams(active?: boolean) {
  return useQuery({
    queryKey: teamsKey(active),
    queryFn: async () =>
      (await api.get<Team[]>("/teams", { params: { active } })).data,
  });
}

export function useTeamMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["teams"] });
  return {
    create: useMutation({
      mutationFn: async (body: Partial<Team>) => (await api.post<Team>("/teams", body)).data,
      onSuccess: invalidate,
    }),
    update: useMutation({
      mutationFn: async ({ id, ...body }: Partial<Team> & { id: string }) =>
        (await api.patch<Team>(`/teams/${id}`, body)).data,
      onSuccess: invalidate,
    }),
    deactivate: useMutation({
      mutationFn: async (id: string) => (await api.delete<Team>(`/teams/${id}`)).data,
      onSuccess: invalidate,
    }),
  };
}

/* ---------- Persons ---------- */
export const personsKey = (active?: boolean, teamId?: string) =>
  ["persons", { active, teamId }] as const;

export function usePersons(opts: { active?: boolean; teamId?: string } = {}) {
  return useQuery({
    queryKey: personsKey(opts.active, opts.teamId),
    queryFn: async () =>
      (
        await api.get<Person[]>("/persons", {
          params: { active: opts.active, team_id: opts.teamId },
        })
      ).data,
  });
}

export interface PersonPayload {
  employee_id?: string | null;
  name: string;
  email?: string | null;
  location?: string | null;
  line_manager?: string | null;
  allocation?: number | string;
  employment_type?: EmploymentType;
  funding?: string | null;
  team_id: string;
  active?: boolean;
}

export function usePersonMutations() {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["persons"] });
    qc.invalidateQueries({ queryKey: ["teams"] });
  };
  return {
    create: useMutation({
      mutationFn: async (body: PersonPayload) => (await api.post<Person>("/persons", body)).data,
      onSuccess: invalidate,
    }),
    update: useMutation({
      mutationFn: async ({ id, ...body }: Partial<PersonPayload> & { id: string }) =>
        (await api.patch<Person>(`/persons/${id}`, body)).data,
      onSuccess: invalidate,
    }),
    deactivate: useMutation({
      mutationFn: async (id: string) => (await api.delete<Person>(`/persons/${id}`)).data,
      onSuccess: invalidate,
    }),
  };
}

/* ---------- Projects ---------- */
export const projectsKey = (active?: boolean) => ["projects", { active }] as const;

export function useProjects(active?: boolean) {
  return useQuery({
    queryKey: projectsKey(active),
    queryFn: async () =>
      (await api.get<Project[]>("/projects", { params: { active } })).data,
  });
}

export function useProjectsWithSubs() {
  return useQuery({
    queryKey: ["projects-with-subs"],
    queryFn: async () =>
      (await api.get<ProjectWithSubs[]>("/projects/with-subs")).data,
  });
}

export function useProjectMutations() {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["projects"] });
    qc.invalidateQueries({ queryKey: ["projects-with-subs"] });
    qc.invalidateQueries({ queryKey: ["sub-projects"] });
  };
  return {
    create: useMutation({
      mutationFn: async (body: Partial<Project>) =>
        (await api.post<Project>("/projects", body)).data,
      onSuccess: invalidate,
    }),
    update: useMutation({
      mutationFn: async ({ id, ...body }: Partial<Project> & { id: string }) =>
        (await api.patch<Project>(`/projects/${id}`, body)).data,
      onSuccess: invalidate,
    }),
    deactivate: useMutation({
      mutationFn: async (id: string) => (await api.delete<Project>(`/projects/${id}`)).data,
      onSuccess: invalidate,
    }),
  };
}

/* ---------- Sub-projects ---------- */
export const subProjectsKey = (projectId?: string, active?: boolean) =>
  ["sub-projects", { projectId, active }] as const;

export function useSubProjects(opts: { projectId?: string; active?: boolean } = {}) {
  return useQuery({
    queryKey: subProjectsKey(opts.projectId, opts.active),
    queryFn: async () =>
      (
        await api.get<SubProject[]>("/sub-projects", {
          params: { project_id: opts.projectId, active: opts.active },
        })
      ).data,
  });
}

export function useProjectSubProjects(projectId?: string, active = true) {
  return useQuery({
    queryKey: ["project-sub-projects", projectId, active],
    enabled: !!projectId,
    queryFn: async () =>
      (
        await api.get<SubProject[]>(`/projects/${projectId}/sub-projects`, {
          params: { active },
        })
      ).data,
  });
}

export function useSubProjectMutations() {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["sub-projects"] });
    qc.invalidateQueries({ queryKey: ["project-sub-projects"] });
    qc.invalidateQueries({ queryKey: ["projects"] });
    qc.invalidateQueries({ queryKey: ["projects-with-subs"] });
  };
  return {
    create: useMutation({
      mutationFn: async (body: Partial<SubProject>) =>
        (await api.post<SubProject>("/sub-projects", body)).data,
      onSuccess: invalidate,
    }),
    update: useMutation({
      mutationFn: async ({ id, ...body }: Partial<SubProject> & { id: string }) =>
        (await api.patch<SubProject>(`/sub-projects/${id}`, body)).data,
      onSuccess: invalidate,
    }),
    deactivate: useMutation({
      mutationFn: async (id: string) =>
        (await api.delete<SubProject>(`/sub-projects/${id}`)).data,
      onSuccess: invalidate,
    }),
  };
}

/* ---------- Submissions ---------- */
export function useSubmissionByPersonMonth(personId?: string, month?: string) {
  return useQuery({
    queryKey: ["submission", personId, month],
    enabled: !!personId && !!month,
    queryFn: async () =>
      (
        await api.get<Submission | null>("/submissions/by-person-month", {
          params: { person_id: personId, month },
        })
      ).data,
  });
}

export interface SubmissionPayload {
  person_id: string;
  month: string;
  lines: Pick<SubmissionLine, "project_id" | "sub_project_id" | "time_spent_pct" | "comments">[];
}

export function useUpsertSubmission() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: SubmissionPayload) =>
      (await api.post<Submission>("/submissions", payload)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["submission"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

/* ---------- Dashboard ---------- */
export function useTeamProgress(month: string) {
  return useQuery({
    queryKey: ["dashboard", "team-progress", month],
    enabled: !!month,
    queryFn: async () =>
      (
        await api.get<TeamProgress[]>("/dashboard/team-progress", {
          params: { month },
        })
      ).data,
  });
}

export interface DashboardFilters {
  month: string;
  team_id?: string;
  project_id?: string;
  completion?: "all" | "submitted" | "missing";
}

export function useDashboardSubmissions(filters: DashboardFilters) {
  return useQuery({
    queryKey: ["dashboard", "submissions", filters],
    enabled: !!filters.month,
    queryFn: async () =>
      (
        await api.get<DashboardSubmissionRow[]>("/dashboard/submissions", {
          params: filters,
        })
      ).data,
  });
}