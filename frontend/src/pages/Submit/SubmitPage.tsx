import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  usePersons,
  useProjects,
  useSubmissionByPersonMonth,
  useUpsertSubmission,
} from "@/api/hooks";
import { Card } from "@/components/Card";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";
import { Field, Input, Select, Textarea } from "@/components/Form";
import { toast } from "@/components/Toast";
import { extractErrorMessage } from "@/api/client";
import { ProjectActivitySelect } from "./ProjectActivitySelect";
import { TeamProgressCard } from "./TeamProgressCard";

interface RowDraft {
  key: string;
  project_id: string;
  sub_project_id: string;
  time_spent_pct: string;
  comments: string;
}

let rowSeed = 1;
const newRow = (): RowDraft => ({
  key: `row-${rowSeed++}`,
  project_id: "",
  sub_project_id: "",
  time_spent_pct: "",
  comments: "",
});

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function SubmitPage() {
  const persons = usePersons({ active: true });
  const projects = useProjects(true);

  const [personId, setPersonId] = useState<string>("");
  const [teamId, setTeamId] = useState<string>("");
  const [month, setMonth] = useState<string>(currentMonth());
  const [rows, setRows] = useState<RowDraft[]>([newRow()]);

  const existing = useSubmissionByPersonMonth(personId, month);
  const upsert = useUpsertSubmission();

  const selectedPerson = persons.data?.find((p) => p.id === personId);
  const personTeams = selectedPerson?.teams ?? [];

  // Reset team when person changes; auto-pick when only one team
  useEffect(() => {
    if (!selectedPerson) {
      setTeamId("");
      return;
    }
    if (personTeams.length === 1) {
      setTeamId(personTeams[0].id);
    } else if (!personTeams.find((t) => t.id === teamId)) {
      setTeamId("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [personId, selectedPerson?.teams.length]);

  // Hydrate rows when existing submission loads
  useEffect(() => {
    if (!personId || !month) return;
    if (existing.isFetching) return;
    if (existing.data && existing.data.lines.length > 0) {
      setRows(
        existing.data.lines.map((l) => ({
          key: `row-${rowSeed++}`,
          project_id: l.project_id,
          sub_project_id: l.sub_project_id,
          time_spent_pct: String(l.time_spent_pct),
          comments: l.comments ?? "",
        })),
      );
      if (
        existing.data.team_id &&
        personTeams.some((t) => t.id === existing.data!.team_id)
      ) {
        setTeamId(existing.data.team_id);
      }
    } else {
      setRows([newRow()]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [personId, month, existing.dataUpdatedAt]);

  const total = useMemo(() => {
    return rows.reduce((s, r) => s + (parseFloat(r.time_spent_pct) || 0), 0);
  }, [rows]);

  const duplicates = useMemo(() => {
    const seen = new Map<string, number>();
    const dup = new Set<string>();
    rows.forEach((r) => {
      if (!r.project_id || !r.sub_project_id) return;
      const k = `${r.project_id}::${r.sub_project_id}`;
      if (seen.has(k)) dup.add(r.key).add(rows[seen.get(k)!].key);
      else seen.set(k, rows.indexOf(r));
    });
    return dup;
  }, [rows]);

  const rowErrors = (r: RowDraft) => {
    const errs: string[] = [];
    if (!r.project_id) errs.push("Project is required");
    if (!r.sub_project_id) errs.push("Sub-project is required");
    const pct = parseFloat(r.time_spent_pct);
    if (!r.time_spent_pct || isNaN(pct)) errs.push("% is required");
    else if (pct <= 0 || pct > 100) errs.push("% must be > 0 and ≤ 100");
    if (duplicates.has(r.key)) errs.push("Duplicate Project + Sub-project");
    return errs;
  };

  const allValid =
    !!personId &&
    !!teamId &&
    !!month &&
    rows.length > 0 &&
    rows.every((r) => rowErrors(r).length === 0);
  const totalOk = Math.abs(total - 100) < 0.01;

  const noProjects = projects.data && projects.data.length === 0;

  const updateRow = (key: string, patch: Partial<RowDraft>) => {
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  };
  const removeRow = (key: string) =>
    setRows((rs) => (rs.length === 1 ? rs : rs.filter((r) => r.key !== key)));
  const addRow = () => setRows((rs) => [...rs, newRow()]);

  const onSubmit = async () => {
    try {
      await upsert.mutateAsync({
        person_id: personId,
        team_id: teamId,
        month,
        lines: rows.map((r) => ({
          project_id: r.project_id,
          sub_project_id: r.sub_project_id,
          time_spent_pct: parseFloat(r.time_spent_pct),
          comments: r.comments || null,
        })),
      });
      toast.success(
        `Submission saved for ${selectedPerson?.name ?? "person"} – ${month}`,
      );
    } catch (err) {
      toast.error(extractErrorMessage(err));
    }
  };

  return (
    <>
      <PageHeader
        title="Submit Book of Work"
        subtitle="Allocate 100% of your time across projects for the month."
      />

      <TeamProgressCard month={month} />

      {/* Resource card */}
      <Card title="Resource" className="mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <Field label="Person" required>
            <Select
              value={personId}
              onChange={(e) => setPersonId(e.target.value)}
              disabled={persons.isLoading}
            >
              <option value="">Select a person…</option>
              {persons.data?.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field
            label="Team"
            required
            error={
              personId && personTeams.length === 0
                ? "This person has no team assignments. Add them in Configuration."
                : undefined
            }
          >
            <Select
              value={teamId}
              onChange={(e) => setTeamId(e.target.value)}
              disabled={!personId || personTeams.length === 0}
              invalid={!!personId && personTeams.length > 0 && !teamId}
            >
              <option value="">
                {personId
                  ? personTeams.length
                    ? "Select team…"
                    : "No teams"
                  : "Select person first"}
              </option>
              {personTeams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Month" required>
            <Input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
            />
          </Field>
        </div>
      </Card>

      {/* Projects card */}
      <Card title="Projects">
        {noProjects ? (
          <EmptyState
            title="No projects available"
            description="Please ask your admin to add projects in Configuration."
            action={
              <Link to="/config/projects">
                <Button variant="secondary">Go to Configuration</Button>
              </Link>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr>
                  <th style={{ width: "26%" }}>Project</th>
                  <th style={{ width: "22%" }}>Sub-project</th>
                  <th style={{ width: "14%" }} className="text-right">
                    Time Spent (%)
                  </th>
                  <th>Comments</th>
                  <th style={{ width: 48 }} />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const errs = rowErrors(r);
                  const invalid = errs.length > 0;
                  return (
                    <tr key={r.key} className={invalid ? "bg-[rgba(200,16,46,0.04)]" : ""}>
                      <td>
                        <ProjectActivitySelect
                          mode="project"
                          projects={projects.data ?? []}
                          projectId={r.project_id}
                          onChange={(projectId) =>
                            updateRow(r.key, { project_id: projectId, sub_project_id: "" })
                          }
                          invalid={!r.project_id}
                        />
                      </td>
                      <td>
                        <ProjectActivitySelect
                          mode="sub-project"
                          projects={projects.data ?? []}
                          projectId={r.project_id}
                          subProjectId={r.sub_project_id}
                          onChange={(subProjectId) =>
                            updateRow(r.key, { sub_project_id: subProjectId })
                          }
                          invalid={!!r.project_id && !r.sub_project_id}
                        />
                      </td>
                      <td className="text-right">
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          step="0.01"
                          value={r.time_spent_pct}
                          onChange={(e) => updateRow(r.key, { time_spent_pct: e.target.value })}
                          className="font-mono text-right"
                          invalid={
                            !r.time_spent_pct ||
                            isNaN(parseFloat(r.time_spent_pct)) ||
                            parseFloat(r.time_spent_pct) <= 0 ||
                            parseFloat(r.time_spent_pct) > 100
                          }
                        />
                      </td>
                      <td>
                        <Textarea
                          rows={1}
                          maxLength={500}
                          value={r.comments}
                          onChange={(e) => updateRow(r.key, { comments: e.target.value })}
                          placeholder="Optional"
                        />
                      </td>
                      <td className="text-right">
                        <button
                          type="button"
                          onClick={() => removeRow(r.key)}
                          disabled={rows.length === 1}
                          aria-label="Remove row"
                          className="text-ink-400 hover:text-danger disabled:opacity-30 disabled:hover:text-ink-400 text-lg"
                        >
                          ×
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <div className="mt-4">
              <Button variant="secondary" size="sm" onClick={addRow}>
                + Add Project Row
              </Button>
            </div>

            <div className="mt-6 pt-4 border-t border-ink-200 flex items-center justify-between gap-4 flex-wrap">
              <TotalStatus total={total} />
              <div className="font-mono text-base text-ink-900">
                Total{" "}
                <span
                  className={
                    totalOk ? "text-success" : total > 100 ? "text-danger" : "text-warning"
                  }
                >
                  {total.toFixed(2)} %
                </span>
              </div>
            </div>
          </div>
        )}
      </Card>

      <div className="mt-6 flex items-center justify-end gap-3">
        <Link to="/submit">
          <Button variant="secondary">Cancel</Button>
        </Link>
        <Button
          variant="primary"
          disabled={
            !allValid || !totalOk || upsert.isPending || noProjects || !personId || !teamId
          }
          onClick={onSubmit}
        >
          {upsert.isPending ? "Submitting…" : "Submit"}
        </Button>
      </div>
    </>
  );
}

function TotalStatus({ total }: { total: number }) {
  if (Math.abs(total - 100) < 0.01) {
    return (
      <div className="flex items-center gap-2 text-sm">
        <span className="w-2.5 h-2.5 rounded-full bg-success" />
        <span className="text-success font-medium">100% — ready to submit</span>
      </div>
    );
  }
  if (total < 100) {
    const diff = (100 - total).toFixed(2);
    return (
      <div className="flex items-center gap-2 text-sm">
        <span className="w-2.5 h-2.5 rounded-full bg-warning" />
        <span className="text-warning font-medium">
          Under-allocated by {diff}% — add more rows or increase percentages
        </span>
      </div>
    );
  }
  const diff = (total - 100).toFixed(2);
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="w-2.5 h-2.5 rounded-full bg-danger" />
      <span className="text-danger font-medium">
        Over-allocated by {diff}% — please adjust
      </span>
    </div>
  );
}
