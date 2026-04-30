import { useState } from "react";
import { Card } from "@/components/Card";
import { Field, Input, Select } from "@/components/Form";
import {
  useDashboardSubmissions,
  useProjects,
  useTeams,
  type DashboardFilters,
} from "@/api/hooks";
import { TeamSubmissionProgressCard } from "./TeamSubmissionProgressCard";

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function StatisticsTab() {
  const teams = useTeams(true);
  const projects = useProjects(true);

  const [filters, setFilters] = useState<DashboardFilters>({
    month: currentMonth(),
    team_id: undefined,
    project_id: undefined,
    completion: "all",
  });

  const { data, isLoading } = useDashboardSubmissions(filters);

  const submittedCount = data?.filter((r) => r.status === "submitted").length ?? 0;
  const total = data?.length ?? 0;

  return (
    <>
      <TeamSubmissionProgressCard month={filters.month} />
      <Card
      bodyClassName="p-0"
      title="Submission Statistics"
      actions={
        <span className="text-sm text-ink-600 font-mono">
          {submittedCount}/{total} submitted
        </span>
      }
    >
      <div className="px-6 py-4 border-b border-ink-200 grid grid-cols-1 md:grid-cols-4 gap-4">
        <Field label="Month">
          <Input
            type="month"
            value={filters.month}
            onChange={(e) => setFilters((f) => ({ ...f, month: e.target.value }))}
          />
        </Field>
        <Field label="Team">
          <Select
            value={filters.team_id ?? ""}
            onChange={(e) =>
              setFilters((f) => ({ ...f, team_id: e.target.value || undefined }))
            }
          >
            <option value="">All teams</option>
            {teams.data?.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Project">
          <Select
            value={filters.project_id ?? ""}
            onChange={(e) =>
              setFilters((f) => ({ ...f, project_id: e.target.value || undefined }))
            }
          >
            <option value="">All projects</option>
            {projects.data?.map((p) => (
              <option key={p.id} value={p.id}>
                {p.code} · {p.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Completion Status">
          <Select
            value={filters.completion ?? "all"}
            onChange={(e) =>
              setFilters((f) => ({
                ...f,
                completion: e.target.value as DashboardFilters["completion"],
              }))
            }
          >
            <option value="all">All</option>
            <option value="submitted">Submitted</option>
            <option value="missing">Missing</option>
          </Select>
        </Field>
      </div>

      <table className="table-base">
        <thead>
          <tr>
            <th>Person</th>
            <th>Team</th>
            <th>Status</th>
            <th className="text-right">Total %</th>
            <th>Updated</th>
          </tr>
        </thead>
        <tbody>
          {isLoading ? (
            <tr>
              <td colSpan={5} className="text-ink-600">
                Loading…
              </td>
            </tr>
          ) : !data || data.length === 0 ? (
            <tr>
              <td colSpan={5} className="text-ink-600">
                No rows match your filters.
              </td>
            </tr>
          ) : (
            data.map((r) => (
              <tr key={`${r.person_id}-${r.team_id}`}>
                <td className="font-medium text-ink-900">{r.person_name}</td>
                <td className="text-ink-600">{r.team_name}</td>
                <td>
                  <span
                    className={
                      r.status === "submitted" ? "tag tag-success" : "tag tag-neutral"
                    }
                  >
                    {r.status === "submitted" ? "Submitted" : "Missing"}
                  </span>
                </td>
                <td className="text-right font-mono">
                  {r.total_percent != null ? Number(r.total_percent).toFixed(2) : "—"}
                </td>
                <td className="text-ink-600">
                  {r.updated_at ? new Date(r.updated_at).toLocaleString() : "—"}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </Card>
    </>
  );
}
