import { useCallback, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { usePersons, useProjectsWithSubs } from "@/api/hooks";
import { Card } from "@/components/Card";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";
import { Field, Input } from "@/components/Form";
import { Combobox } from "@/components/Combobox";
import { toast } from "@/components/Toast";
import { extractErrorMessage } from "@/api/client";
import {
  PersonSubmitCard,
  type PersonSubmitCardHandle,
} from "./TeamSubmitCard";
import type { Person } from "@/api/types";

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

interface UserGroup {
  key: string;
  label: string;
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
  const [submitting, setSubmitting] = useState(false);

  const groups = useMemo(() => groupPersons(persons.data ?? []), [persons.data]);
  const selected = groups.find((g) => g.key === userKey);

  const cardRefs = useRef<Map<string, PersonSubmitCardHandle>>(new Map());
  const [validity, setValidity] = useState<Record<string, boolean>>({});

  const handleValidityChange = useCallback((personId: string, valid: boolean) => {
    setValidity((m) => (m[personId] === valid ? m : { ...m, [personId]: valid }));
  }, []);

  const setCardRef = useCallback(
    (personId: string) => (handle: PersonSubmitCardHandle | null) => {
      if (handle) cardRefs.current.set(personId, handle);
      else cardRefs.current.delete(personId);
    },
    [],
  );

  const allCardsValid =
    !!selected &&
    selected.rows.length > 0 &&
    selected.rows.every((r) => validity[r.id]);

  const onSubmitAll = async () => {
    if (!selected) return;
    setSubmitting(true);
    try {
      // Submit each card sequentially so errors are clearly attributable.
      for (const row of selected.rows) {
        const handle = cardRefs.current.get(row.id);
        if (!handle) continue;
        await handle.submit();
      }
      toast.success(
        `Submitted ${selected.name} for ${month} (${selected.rows.length} team${
          selected.rows.length > 1 ? "s" : ""
        })`,
      );
    } catch (err) {
      toast.error(extractErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const personOptions = groups.map((g) => ({
    value: g.key,
    label: g.label,
    hint: g.rows.map((r) => r.team?.name).filter(Boolean).join(", "),
  }));

  return (
    <>
      <PageHeader
        title="Submit Book of Work"
        subtitle="Select a person, allocate 100% per team, then submit all teams together."
      />

      <Card title="Resource" className="mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <Field label="Person" required>
            <Combobox
              value={userKey}
              onChange={setUserKey}
              options={personOptions}
              placeholder={
                persons.isLoading ? "Loading…" : "Search by name or employee ID…"
              }
              disabled={persons.isLoading}
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
        <>
          {selected.rows.map((row) => (
            <PersonSubmitCard
              key={`${row.id}-${month}`}
              ref={setCardRef(row.id)}
              personId={row.id}
              teamName={row.team?.name ?? ""}
              allocationPct={row.allocation != null ? Number(row.allocation) : null}
              projects={projects.data!}
              month={month}
              onValidityChange={handleValidityChange}
            />
          ))}

          <Card className="mb-6">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="text-sm text-ink-700">
                {allCardsValid ? (
                  <span className="text-success font-medium">
                    All {selected.rows.length} team
                    {selected.rows.length > 1 ? "s" : ""} ready to submit.
                  </span>
                ) : (
                  <span className="text-warning">
                    Each team card must total 100% before you can submit.
                  </span>
                )}
              </div>
              <Button
                variant="primary"
                disabled={!allCardsValid || submitting}
                onClick={onSubmitAll}
              >
                {submitting ? "Submitting…" : "Submit All"}
              </Button>
            </div>
          </Card>
        </>
      )}
    </>
  );
}