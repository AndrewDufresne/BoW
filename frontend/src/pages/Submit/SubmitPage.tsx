import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { usePersons, usePersonTeamsWithProjects } from "@/api/hooks";
import { Card } from "@/components/Card";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";
import { Field, Input, Select } from "@/components/Form";
import { TeamSubmitCard } from "./TeamSubmitCard";

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function SubmitPage() {
  const persons = usePersons({ active: true });
  const [personId, setPersonId] = useState<string>("");
  const [month, setMonth] = useState<string>(currentMonth());

  const teams = usePersonTeamsWithProjects(personId || undefined);
  const selectedPerson = persons.data?.find((p) => p.id === personId);

  // Reset on person change handled implicitly via key prop on cards.
  useEffect(() => {
    // No-op: kept for any future side-effects on person change.
  }, [personId]);

  return (
    <>
      <PageHeader
        title="Submit Book of Work"
        subtitle="Allocate 100% of your time per team for the month."
      />

      {/* Resource card */}
      <Card title="Resource" className="mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
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
                  {p.employee_id ? ` (${p.employee_id})` : ""}
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

        {selectedPerson && (
          <div className="mt-5 grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-2 text-sm">
            <Detail label="Employee ID" value={selectedPerson.employee_id} />
            <Detail label="Location" value={selectedPerson.location} />
            <Detail label="Line Manager" value={selectedPerson.line_manager} />
            <Detail
              label="Allocation"
              value={
                selectedPerson.allocation != null
                  ? `${Number(selectedPerson.allocation).toFixed(0)}%`
                  : null
              }
            />
            <Detail label="Employment Type" value={selectedPerson.employment_type} />
            <Detail label="Funding" value={selectedPerson.funding} />
            <Detail
              label="Teams"
              value={selectedPerson.teams.map((t) => t.name).join(", ") || "—"}
            />
          </div>
        )}
      </Card>

      {!personId ? (
        <Card>
          <EmptyState
            title="Select a person to begin"
            description="Pick a person above. We'll show one Projects card per team they belong to."
          />
        </Card>
      ) : teams.isLoading ? (
        <Card>
          <div className="text-sm text-ink-600">Loading teams…</div>
        </Card>
      ) : !teams.data || teams.data.length === 0 ? (
        <Card>
          <EmptyState
            title="No teams assigned"
            description="This person isn't a member of any team. Add them in Configuration."
            action={
              <Link to="/config/persons">
                <Button variant="secondary">Go to Configuration</Button>
              </Link>
            }
          />
        </Card>
      ) : (
        teams.data.map((t) => (
          <TeamSubmitCard
            key={`${personId}-${t.id}-${month}`}
            personId={personId}
            personName={selectedPerson?.name ?? ""}
            team={t}
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
