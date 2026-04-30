import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useState,
} from "react";
import {
  useSubmissionByPersonMonth,
  useUpsertSubmission,
} from "@/api/hooks";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { Input, Textarea } from "@/components/Form";
import { Combobox } from "@/components/Combobox";
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

export interface PersonSubmitCardHandle {
  submit: () => Promise<void>;
}

interface Props {
  personId: string;
  teamName: string;
  allocationPct?: number | null;
  projects: ProjectWithSubs[];
  month: string;
  onValidityChange: (personId: string, valid: boolean) => void;
}

export const PersonSubmitCard = forwardRef<PersonSubmitCardHandle, Props>(
  function PersonSubmitCard(
    { personId, teamName, allocationPct, projects, month, onValidityChange },
    ref,
  ) {
    const existing = useSubmissionByPersonMonth(personId, month);
    const upsert = useUpsertSubmission();

    const [rows, setRows] = useState<RowDraft[]>([newRow()]);

    // Hydrate from server snapshot once per fetch.
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

    const total = rows.reduce(
      (s, r) => s + (parseFloat(r.time_spent_pct) || 0),
      0,
    );
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

    const allRowsValid =
      rows.length > 0 && rows.every((r) => rowErrors(r).length === 0);
    const cardValid = allRowsValid && totalOk;

    useEffect(() => {
      onValidityChange(personId, cardValid);
    }, [cardValid, personId, onValidityChange]);

    useImperativeHandle(
      ref,
      () => ({
        submit: async () => {
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
        },
      }),
      [personId, month, rows, upsert],
    );

    const updateRow = (key: string, patch: Partial<RowDraft>) =>
      setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
    const removeRow = (key: string) =>
      setRows((rs) => (rs.length === 1 ? rs : rs.filter((r) => r.key !== key)));
    const addRow = () => setRows((rs) => [...rs, newRow()]);

    const projectOptions = projects.map((p) => ({
      value: p.id,
      label: `${p.code} · ${p.name}`,
      hint: p.funding ?? undefined,
    }));

    const noProjects = projects.length === 0;
    const submitted = !!existing.data;

    return (
      <Card
        title={teamName ? `${teamName} · Projects` : "Projects"}
        actions={
          <span className="text-sm text-ink-600">
            {allocationPct != null ? <>Allocation: {allocationPct.toFixed(0)}%</> : null}
            {submitted && (
              <span className="ml-3 tag tag-success">Previously submitted</span>
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
                  <th style={{ width: "28%" }}>Project</th>
                  <th style={{ width: "24%" }}>Sub-project</th>
                  <th style={{ width: "12%" }} className="text-right">
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
                  const subOptions = subs.map((s) => ({
                    value: s.id,
                    label: s.name,
                    hint: s.funding ?? undefined,
                  }));
                  return (
                    <tr
                      key={r.key}
                      className={invalid ? "bg-[rgba(200,16,46,0.04)]" : ""}
                    >
                      <td>
                        <Combobox
                          value={r.project_id}
                          onChange={(v) =>
                            updateRow(r.key, { project_id: v, sub_project_id: "" })
                          }
                          options={projectOptions}
                          placeholder="Search project…"
                          invalid={!r.project_id}
                        />
                      </td>
                      <td>
                        <Combobox
                          value={r.sub_project_id}
                          onChange={(v) => updateRow(r.key, { sub_project_id: v })}
                          options={subOptions}
                          placeholder={
                            r.project_id
                              ? "Search sub-project…"
                              : "Select project first"
                          }
                          disabled={!r.project_id}
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

            <div className="mt-4 flex items-center justify-between flex-wrap gap-3">
              <Button variant="secondary" size="sm" onClick={addRow}>
                + Add Project Row
              </Button>
              <TotalStatus total={total} />
            </div>
          </div>
        )}
      </Card>
    );
  },
);

function TotalStatus({ total }: { total: number }) {
  const totalOk = Math.abs(total - 100) < 0.01;
  if (totalOk) {
    return (
      <div className="flex items-center gap-2 text-sm">
        <span className="w-2.5 h-2.5 rounded-full bg-success" />
        <span className="text-success font-medium font-mono">
          Total {total.toFixed(2)}% — OK
        </span>
      </div>
    );
  }
  if (total < 100) {
    const diff = (100 - total).toFixed(2);
    return (
      <div className="flex items-center gap-2 text-sm">
        <span className="w-2.5 h-2.5 rounded-full bg-warning" />
        <span className="text-warning font-medium font-mono">
          Total {total.toFixed(2)}% (under by {diff}%)
        </span>
      </div>
    );
  }
  const diff = (total - 100).toFixed(2);
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="w-2.5 h-2.5 rounded-full bg-danger" />
      <span className="text-danger font-medium font-mono">
        Total {total.toFixed(2)}% (over by {diff}%)
      </span>
    </div>
  );
}