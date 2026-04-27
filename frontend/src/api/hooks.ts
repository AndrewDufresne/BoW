import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./client";
import type { Activity, Person, Project, Submission, SubmissionLine, Team } from "./types";

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

export function usePersonMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["persons"] });
  return {
    create: useMutation({
      mutationFn: async (body: Partial<Person>) => (await api.post<Person>("/persons", body)).data,
      onSuccess: invalidate,
    }),
    update: useMutation({
      mutationFn: async ({ id, ...body }: Partial<Person> & { id: string }) =>
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

export function useProjectMutations() {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["projects"] });
    qc.invalidateQueries({ queryKey: ["activities"] });
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

/* ---------- Activities ---------- */
export const activitiesKey = (projectId?: string, active?: boolean) =>
  ["activities", { projectId, active }] as const;

export function useActivities(opts: { projectId?: string; active?: boolean } = {}) {
  return useQuery({
    queryKey: activitiesKey(opts.projectId, opts.active),
    queryFn: async () =>
      (
        await api.get<Activity[]>("/activities", {
          params: { project_id: opts.projectId, active: opts.active },
        })
      ).data,
  });
}

export function useProjectActivities(projectId?: string, active = true) {
  return useQuery({
    queryKey: ["project-activities", projectId, active],
    enabled: !!projectId,
    queryFn: async () =>
      (
        await api.get<Activity[]>(`/projects/${projectId}/activities`, {
          params: { active },
        })
      ).data,
  });
}

export function useActivityMutations() {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["activities"] });
    qc.invalidateQueries({ queryKey: ["project-activities"] });
    qc.invalidateQueries({ queryKey: ["projects"] });
  };
  return {
    create: useMutation({
      mutationFn: async (body: Partial<Activity>) =>
        (await api.post<Activity>("/activities", body)).data,
      onSuccess: invalidate,
    }),
    update: useMutation({
      mutationFn: async ({ id, ...body }: Partial<Activity> & { id: string }) =>
        (await api.patch<Activity>(`/activities/${id}`, body)).data,
      onSuccess: invalidate,
    }),
    deactivate: useMutation({
      mutationFn: async (id: string) =>
        (await api.delete<Activity>(`/activities/${id}`)).data,
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
  lines: Pick<SubmissionLine, "project_id" | "activity_id" | "time_spent_pct" | "comments">[];
}

export function useUpsertSubmission() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: SubmissionPayload) =>
      (await api.post<Submission>("/submissions", payload)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["submission"] }),
  });
}
