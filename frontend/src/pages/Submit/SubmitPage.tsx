import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { usePersons, useProjectsWithSubs } from "@/api/hooks";
import { Card } from "@/components/Card";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";
import { Field, Input, Select } from "@/components/Form";
import { PersonSubmitCard } from "./TeamSubmitCard";
import type { Person } from "@/api/types";

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

interface UserGroup {
  key: string;
  label: string;
  employee_id: string | null;
  name: string;
  rows: Person[];
}

function groupPersons(persons: Person[]): UserGroup[] {
  const map = new Map<string, UserGroup>();
  for (const p of persons) {
    const key = p.employee_id ? `emp::${p.employee_id}` : `id::${p.id}`;
    let g = map.get(key);
    if (!g) {
      g = {
        key,
        label: `${p.name}${p.employee_id ? ` (${p.employee_id})` : ""}`,
        employee_id: p.employee_id ?? null,
        name: p.name,
        rows: [],
      };
      map.set(key, g);
    }
    g.rows.push(p);
  }
  return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
}

export default function SubmitPage() {
  const persons = usePersons({ active: true });
  const projects = useProjectsWithSubs();
  const [userKey, setUserKey] = useState<string>("");
  const [month, setMonth] = useState<string>(currentMonth());

  const groups = useMemo(() => groupPersons(persons.data ?? []), [persons.data]);
  const selected = groups.find((g) => g.key === userKey);
  const sample = selected?.rows[0];

  return (
    <>
      <PageHeader
        title="Submit Book of Work"
        subtitle="Select a person, then allocate 100% per team for the month."
      />

      <Card title="Resource" className="mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <Field label="Person" required>
            <Select
              value={userKey}
              onChange={(e) => setUserKey(e.target.value)}
              disabled={persons.isLoading}
            >
              <option value="">Select a person…</option>
              {groups.map((g) => (
                <option key={g.key} value={g.key}>
                  {g.label}
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

        {selected && sample && (
          <div className="mt-5 grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-2 text-sm">
            <Detail label="Employee ID" value={selected.employee_id} />
            <Detail label="Location" value={sample.location} />
            <Detail label="Line Manager" value={sample.line_manager} />
            <Detail label="Employment Type" value={sample.employment_type} />
            <Detail label="Email" value={sample.email} />
            <Detail label="Funding" value={sample.funding} />
            <Detail
              label="Teams"
              value={
                selected.rows
                  .map(
                    (r) =>
                      `${r.team?.name ?? "—"} (${
                        r.allocation != null ? Number(r.allocation).toFixed(0) : "0"
                      }%)`,
                  )
                  .join(", ") || "—"
              }
            />
          </div>
        )}
      </Card>

      {!selected ? (
        <Card>
          <EmptyState
            title="Select a person to begin"
            description="Pick a person above. We'll show one Projects card per team they belong to."
          />
        </Card>
      ) : projects.isLoading ? (
        <Card>
          <div className="text-sm text-ink-600">Loading projects…</div>
        </Card>
      ) : !projects.data || projects.data.length === 0 ? (
        <Card>
          <EmptyState
            title="No projects available"
            description="There are no active projects. Add some in Configuration."
            action={
              <Link to="/config/projects">
                <Button variant="secondary">Go to Configuration</Button>
              </Link>
            }
          />
        </Card>
      ) : (
        selected.rows.map((row) => (
          <PersonSubmitCard
            key={`${row.id}-${month}`}
            personId={row.id}
            personName={selected.name}
            teamName={row.team?.name ?? ""}
            allocationPct={row.allocation != null ? Number(row.allocation) : null}
            projects={projects.data}
            month={month}
          />
        ))
      )}
    </>
  );
}

function Detail({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <div className="text-ink-500 text-xs uppercase tracking-wide">{label}</div>
      <div className="text-ink-900">{value || "—"}</div>
    </div>
  );
}