import { useState } from "react";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { ConfirmModal, Drawer } from "@/components/Drawer";
import { Field, Input, Select } from "@/components/Form";
import { usePersonMutations, usePersons, useTeams } from "@/api/hooks";
import { toast } from "@/components/Toast";
import { extractErrorMessage } from "@/api/client";
import type { EmploymentType, Person } from "@/api/types";

const EMPLOYMENT_TYPES: EmploymentType[] = ["Permanent", "Contractor", "Intern"];

interface FormState {
  employee_id: string;
  name: string;
  email: string;
  location: string;
  line_manager: string;
  allocation: string;
  employment_type: EmploymentType;
  funding: string;
  team_ids: string[];
}

const emptyForm = (): FormState => ({
  employee_id: "",
  name: "",
  email: "",
  location: "",
  line_manager: "",
  allocation: "100",
  employment_type: "Permanent",
  funding: "",
  team_ids: [],
});

export default function PersonsTab() {
  const { data, isLoading } = usePersons();
  const teams = useTeams(true);
  const m = usePersonMutations();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [editing, setEditing] = useState<Person | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [confirm, setConfirm] = useState<Person | null>(null);

  const filtered = (data ?? []).filter((p) => {
    if (statusFilter === "active" && !p.active) return false;
    if (statusFilter === "inactive" && p.active) return false;
    const q = search.toLowerCase();
    if (
      q &&
      !p.name.toLowerCase().includes(q) &&
      !(p.email ?? "").toLowerCase().includes(q) &&
      !(p.employee_id ?? "").toLowerCase().includes(q)
    )
      return false;
    return true;
  });

  const openNew = () => {
    setEditing(null);
    setForm(emptyForm());
    setDrawerOpen(true);
  };
  const openEdit = (p: Person) => {
    setEditing(p);
    setForm({
      employee_id: p.employee_id ?? "",
      name: p.name,
      email: p.email ?? "",
      location: p.location ?? "",
      line_manager: p.line_manager ?? "",
      allocation: p.allocation != null ? String(p.allocation) : "100",
      employment_type: p.employment_type ?? "Permanent",
      funding: p.funding ?? "",
      team_ids: p.team_ids ?? p.teams?.map((t) => t.id) ?? [],
    });
    setDrawerOpen(true);
  };

  const toggleTeam = (id: string) => {
    setForm((f) =>
      f.team_ids.includes(id)
        ? { ...f, team_ids: f.team_ids.filter((x) => x !== id) }
        : { ...f, team_ids: [...f.team_ids, id] },
    );
  };

  const allocNum = parseFloat(form.allocation);
  const allocValid = !form.allocation || (!isNaN(allocNum) && allocNum >= 0 && allocNum <= 100);
  const emailValid = !form.email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email);

  const onSave = async () => {
    const payload = {
      employee_id: form.employee_id || null,
      name: form.name,
      email: form.email || null,
      location: form.location || null,
      line_manager: form.line_manager || null,
      allocation: form.allocation ? allocNum : 100,
      employment_type: form.employment_type,
      funding: form.funding || null,
      team_ids: form.team_ids,
    };
    try {
      if (editing) {
        await m.update.mutateAsync({ id: editing.id, ...payload });
        toast.success("Person updated");
      } else {
        await m.create.mutateAsync(payload);
        toast.success("Person created");
      }
      setDrawerOpen(false);
    } catch (err) {
      toast.error(extractErrorMessage(err));
    }
  };

  return (
    <>
      <Card
        bodyClassName="p-0"
        title="People"
        actions={<Button onClick={openNew}>+ New Person</Button>}
      >
        <div className="px-6 py-4 flex items-center gap-3 border-b border-ink-200">
          <Input
            placeholder="Search by name, email or employee ID…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-sm"
          />
          <select
            className="input max-w-[160px]"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
          >
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>

        <table className="table-base">
          <thead>
            <tr>
              <th>Employee ID</th>
              <th>Name</th>
              <th>Email</th>
              <th>Location</th>
              <th>Line Manager</th>
              <th className="text-right">Allocation</th>
              <th>Type</th>
              <th>Funding</th>
              <th>Teams</th>
              <th>Status</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={11} className="text-ink-600">Loading…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={11} className="text-ink-600">No people.</td></tr>
            ) : (
              filtered.map((p) => (
                <tr key={p.id}>
                  <td className="font-mono text-ink-700">{p.employee_id || "—"}</td>
                  <td className="font-medium text-ink-900">{p.name}</td>
                  <td className="text-ink-600">{p.email || "—"}</td>
                  <td className="text-ink-600">{p.location || "—"}</td>
                  <td className="text-ink-600">{p.line_manager || "—"}</td>
                  <td className="text-right font-mono text-ink-800">
                    {p.allocation != null ? `${Number(p.allocation).toFixed(0)}%` : "—"}
                  </td>
                  <td className="text-ink-700">{p.employment_type}</td>
                  <td className="text-ink-600">{p.funding || "—"}</td>
                  <td>
                    {p.teams && p.teams.length > 0
                      ? p.teams.map((t) => t.name).join(", ")
                      : "—"}
                  </td>
                  <td>
                    <span className={p.active ? "tag tag-success" : "tag tag-neutral"}>
                      {p.active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(p)}>Edit</Button>
                    {p.active ? (
                      <Button variant="ghost" size="sm" onClick={() => setConfirm(p)}>Deactivate</Button>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={async () => {
                          await m.update.mutateAsync({ id: p.id, active: true });
                          toast.success("Person activated");
                        }}
                      >
                        Activate
                      </Button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Card>

      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onSubmit={onSave}
        submitLabel={editing ? "Save" : "Create"}
        submitDisabled={!form.name.trim() || !emailValid || !allocValid}
        title={editing ? "Edit Person" : "New Person"}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Employee ID">
              <Input
                value={form.employee_id}
                onChange={(e) => setForm({ ...form, employee_id: e.target.value })}
                placeholder="E0001"
              />
            </Field>
            <Field label="Name" required>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
          </div>
          <Field label="Email" error={!emailValid ? "Invalid email format" : undefined}>
            <Input
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              invalid={!emailValid}
              placeholder="name@example.com"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Location">
              <Input
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                placeholder="Hong Kong"
              />
            </Field>
            <Field label="Line Manager">
              <Input
                value={form.line_manager}
                onChange={(e) => setForm({ ...form, line_manager: e.target.value })}
                placeholder="Manager name"
              />
            </Field>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Allocation (%)" error={!allocValid ? "0–100" : undefined}>
              <Input
                type="number"
                min={0}
                max={100}
                step="1"
                value={form.allocation}
                onChange={(e) => setForm({ ...form, allocation: e.target.value })}
                invalid={!allocValid}
              />
            </Field>
            <Field label="Employment Type">
              <Select
                value={form.employment_type}
                onChange={(e) =>
                  setForm({ ...form, employment_type: e.target.value as EmploymentType })
                }
              >
                {EMPLOYMENT_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </Select>
            </Field>
            <Field label="Funding">
              <Input
                value={form.funding}
                onChange={(e) => setForm({ ...form, funding: e.target.value })}
                placeholder="CC-12345"
              />
            </Field>
          </div>
          <Field label="Teams">
            <div className="border border-ink-300 rounded p-3 max-h-48 overflow-y-auto space-y-2">
              {teams.data?.length ? (
                teams.data.map((t) => (
                  <label key={t.id} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.team_ids.includes(t.id)}
                      onChange={() => toggleTeam(t.id)}
                    />
                    <span className="text-sm text-ink-900">{t.name}</span>
                  </label>
                ))
              ) : (
                <span className="text-sm text-ink-600">No teams available</span>
              )}
            </div>
            <p className="text-xs text-ink-600 mt-1">
              A person can belong to multiple teams. They submit one card per team.
            </p>
          </Field>
        </div>
      </Drawer>

      <ConfirmModal
        open={!!confirm}
        title="Deactivate person?"
        body={
          <>
            <strong>{confirm?.name}</strong> will no longer appear in selectors. Existing
            submissions are preserved.
          </>
        }
        confirmLabel="Deactivate"
        destructive
        onCancel={() => setConfirm(null)}
        onConfirm={async () => {
          if (!confirm) return;
          try {
            await m.deactivate.mutateAsync(confirm.id);
            toast.success("Person deactivated");
            setConfirm(null);
          } catch (err) {
            toast.error(extractErrorMessage(err));
          }
        }}
      />
    </>
  );
}
