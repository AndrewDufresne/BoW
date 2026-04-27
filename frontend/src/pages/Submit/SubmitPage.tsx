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

interface RowDraft {
  key: string;
  project_id: string;
  activity_id: string;
  time_spent_pct: string;
  comments: string;
}

let rowSeed = 1;
const newRow = (): RowDraft => ({
  key: `row-${rowSeed++}`,
  project_id: "",
  activity_id: "",
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
  const [month, setMonth] = useState<string>(currentMonth());
  const [rows, setRows] = useState<RowDraft[]>([newRow()]);

  const existing = useSubmissionByPersonMonth(personId, month);
  const upsert = useUpsertSubmission();

  const selectedPerson = persons.data?.find((p) => p.id === personId);

  // Hydrate rows when existing submission loads
  useEffect(() => {
    if (!personId || !month) return;
    if (existing.isFetching) return;
    if (existing.data && existing.data.lines.length > 0) {
      setRows(
        existing.data.lines.map((l) => ({
          key: `row-${rowSeed++}`,
          project_id: l.project_id,
          activity_id: l.activity_id,
          time_spent_pct: String(l.time_spent_pct),
          comments: l.comments ?? "",
        })),
      );
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
      if (!r.project_id || !r.activity_id) return;
      const k = `${r.project_id}::${r.activity_id}`;
      if (seen.has(k)) dup.add(r.key).add(rows[seen.get(k)!].key);
      else seen.set(k, rows.indexOf(r));
    });
    return dup;
  }, [rows]);

  const rowErrors = (r: RowDraft) => {
    const errs: string[] = [];
    if (!r.project_id) errs.push("Project is required");
    if (!r.activity_id) errs.push("Activity is required");
    const pct = parseFloat(r.time_spent_pct);
    if (!r.time_spent_pct || isNaN(pct)) errs.push("% is required");
    else if (pct <= 0 || pct > 100) errs.push("% must be > 0 and ≤ 100");
    if (duplicates.has(r.key)) errs.push("Duplicate Project + Activity");
    return errs;
  };

  const allValid =
    !!personId &&
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
        month,
        lines: rows.map((r) => ({
          project_id: r.project_id,
          activity_id: r.activity_id,
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
          <Field label="Team">
            <Input
              value={selectedPerson?.team_name ?? ""}
              readOnly
              placeholder="Auto-filled from person"
              className="bg-ink-100"
            />
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
                  <th style={{ width: "22%" }}>Activity</th>
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
                            updateRow(r.key, { project_id: projectId, activity_id: "" })
                          }
                          invalid={!r.project_id}
                        />
                      </td>
                      <td>
                        <ProjectActivitySelect
                          mode="activity"
                          projects={projects.data ?? []}
                          projectId={r.project_id}
                          activityId={r.activity_id}
                          onChange={(activityId) => updateRow(r.key, { activity_id: activityId })}
                          invalid={!!r.project_id && !r.activity_id}
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
          disabled={!allValid || !totalOk || upsert.isPending || noProjects || !personId}
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
