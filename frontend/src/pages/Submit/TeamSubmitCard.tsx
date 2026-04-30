import { useEffect, useMemo, useState } from "react";
import {
  useSubmissionByPersonMonth,
  useUpsertSubmission,
} from "@/api/hooks";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { Input, Select, Textarea } from "@/components/Form";
import { toast } from "@/components/Toast";
import { extractErrorMessage } from "@/api/client";
import type { ProjectWithSubs } from "@/api/types";

interface RowDraft {
  key: string;
  project_id: string;
  sub_project_id: string;
  time_spent_pct: string;
  comments: string;
}

let seed = 1;
const newRow = (): RowDraft => ({
  key: `r-${seed++}`,
  project_id: "",
  sub_project_id: "",
  time_spent_pct: "",
  comments: "",
});

interface Props {
  personId: string;
  personName: string;
  teamName: string;
  allocationPct?: number | null;
  projects: ProjectWithSubs[];
  month: string;
}

export function PersonSubmitCard({
  personId,
  personName,
  teamName,
  allocationPct,
  projects,
  month,
}: Props) {
  const existing = useSubmissionByPersonMonth(personId, month);
  const upsert = useUpsertSubmission();

  const [rows, setRows] = useState<RowDraft[]>([newRow()]);

  useEffect(() => {
    if (existing.isFetching) return;
    if (existing.data && existing.data.lines.length > 0) {
      setRows(
        existing.data.lines.map((l) => ({
          key: `r-${seed++}`,
          project_id: l.project_id,
          sub_project_id: l.sub_project_id,
          time_spent_pct: String(l.time_spent_pct),
          comments: l.comments ?? "",
        })),
      );
    } else {
      setRows([newRow()]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [personId, month, existing.dataUpdatedAt]);

  const subProjectsByProject = useMemo(() => {
    const m = new Map<string, ProjectWithSubs["sub_projects"]>();
    projects.forEach((p) => m.set(p.id, p.sub_projects));
    return m;
  }, [projects]);

  const total = rows.reduce((s, r) => s + (parseFloat(r.time_spent_pct) || 0), 0);
  const totalOk = Math.abs(total - 100) < 0.01;

  const duplicates = useMemo(() => {
    const seen = new Map<string, number>();
    const dup = new Set<string>();
    rows.forEach((r, idx) => {
      if (!r.project_id || !r.sub_project_id) return;
      const k = `${r.project_id}::${r.sub_project_id}`;
      if (seen.has(k)) {
        dup.add(r.key);
        dup.add(rows[seen.get(k)!].key);
      } else {
        seen.set(k, idx);
      }
    });
    return dup;
  }, [rows]);

  const rowErrors = (r: RowDraft) => {
    const errs: string[] = [];
    if (!r.project_id) errs.push("Project required");
    if (!r.sub_project_id) errs.push("Sub-project required");
    const pct = parseFloat(r.time_spent_pct);
    if (!r.time_spent_pct || isNaN(pct)) errs.push("% required");
    else if (pct <= 0 || pct > 100) errs.push("% must be > 0 and ≤ 100");
    if (duplicates.has(r.key)) errs.push("Duplicate");
    return errs;
  };

  const allValid = rows.length > 0 && rows.every((r) => rowErrors(r).length === 0);

  const updateRow = (key: string, patch: Partial<RowDraft>) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const removeRow = (key: string) =>
    setRows((rs) => (rs.length === 1 ? rs : rs.filter((r) => r.key !== key)));
  const addRow = () => setRows((rs) => [...rs, newRow()]);

  const noProjects = projects.length === 0;

  const onSubmit = async () => {
    try {
      await upsert.mutateAsync({
        person_id: personId,
        month,
        lines: rows.map((r) => ({
          project_id: r.project_id,
          sub_project_id: r.sub_project_id,
          time_spent_pct: parseFloat(r.time_spent_pct),
          comments: r.comments || null,
        })),
      });
      toast.success(`Saved ${personName}${teamName ? " · " + teamName : ""} · ${month}`);
    } catch (err) {
      toast.error(extractErrorMessage(err));
    }
  };

  const submitted = !!existing.data;

  return (
    <Card
      title={teamName ? `${teamName} · Projects` : "Projects"}
      actions={
        <span className="text-sm text-ink-600">
          {allocationPct != null ? <>Allocation: {allocationPct.toFixed(0)}%</> : null}
          {submitted && (
            <span className="ml-3 tag tag-success">Submitted</span>
          )}
        </span>
      }
      className="mb-6"
    >
      {noProjects ? (
        <div className="text-sm text-ink-600">
          No active projects. Add some in Configuration.
        </div>
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
                const subs = subProjectsByProject.get(r.project_id) ?? [];
                return (
                  <tr
                    key={r.key}
                    className={invalid ? "bg-[rgba(200,16,46,0.04)]" : ""}
                  >
                    <td>
                      <Select
                        value={r.project_id}
                        onChange={(e) =>
                          updateRow(r.key, {
                            project_id: e.target.value,
                            sub_project_id: "",
                          })
                        }
                        invalid={!r.project_id}
                      >
                        <option value="">Select project…</option>
                        {projects.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.code} · {p.name}
                          </option>
                        ))}
                      </Select>
                    </td>
                    <td>
                      <Select
                        value={r.sub_project_id}
                        onChange={(e) =>
                          updateRow(r.key, { sub_project_id: e.target.value })
                        }
                        disabled={!r.project_id}
                        invalid={!!r.project_id && !r.sub_project_id}
                      >
                        <option value="">
                          {r.project_id ? "Select sub-project…" : "Select project first"}
                        </option>
                        {subs.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </Select>
                    </td>
                    <td className="text-right">
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        step="0.01"
                        value={r.time_spent_pct}
                        onChange={(e) =>
                          updateRow(r.key, { time_spent_pct: e.target.value })
                        }
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
            <div className="flex items-center gap-4">
              <div className="font-mono text-base text-ink-900">
                Total{" "}
                <span
                  className={
                    totalOk
                      ? "text-success"
                      : total > 100
                        ? "text-danger"
                        : "text-warning"
                  }
                >
                  {total.toFixed(2)} %
                </span>
              </div>
              <Button
                variant="primary"
                disabled={!allValid || !totalOk || upsert.isPending}
                onClick={onSubmit}
              >
                {upsert.isPending ? "Submitting…" : submitted ? "Update" : "Submit"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </Card>
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
          Under-allocated by {diff}%
        </span>
      </div>
    );
  }
  const diff = (total - 100).toFixed(2);
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="w-2.5 h-2.5 rounded-full bg-danger" />
      <span className="text-danger font-medium">
        Over-allocated by {diff}%
      </span>
    </div>
  );
}