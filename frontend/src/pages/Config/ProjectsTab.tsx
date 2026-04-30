import { useState } from "react";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { ConfirmModal, Drawer } from "@/components/Drawer";
import { Field, Input, Textarea } from "@/components/Form";
import { useProjectMutations, useProjects, useTeams } from "@/api/hooks";
import { toast } from "@/components/Toast";
import { extractErrorMessage } from "@/api/client";
import type { Project } from "@/api/types";

interface FormState {
  code: string;
  name: string;
  description: string;
  funding: string;
  team_ids: string[];
}

const emptyForm = (): FormState => ({
  code: "",
  name: "",
  description: "",
  funding: "",
  team_ids: [],
});

export default function ProjectsTab() {
  const { data, isLoading } = useProjects();
  const teams = useTeams(true);
  const m = useProjectMutations();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [editing, setEditing] = useState<Project | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [confirm, setConfirm] = useState<Project | null>(null);

  const filtered = (data ?? []).filter((p) => {
    if (statusFilter === "active" && !p.active) return false;
    if (statusFilter === "inactive" && p.active) return false;
    const q = search.toLowerCase();
    if (q && !p.name.toLowerCase().includes(q) && !p.code.toLowerCase().includes(q)) return false;
    return true;
  });

  const codeValid = !form.code || /^[A-Z0-9-]{2,20}$/.test(form.code);

  const openNew = () => {
    setEditing(null);
    setForm(emptyForm());
    setDrawerOpen(true);
  };
  const openEdit = (p: Project) => {
    setEditing(p);
    setForm({
      code: p.code,
      name: p.name,
      description: p.description ?? "",
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

  const onSave = async () => {
    const payload = {
      code: form.code,
      name: form.name,
      description: form.description || null,
      funding: form.funding || null,
      team_ids: form.team_ids,
    };
    try {
      if (editing) {
        await m.update.mutateAsync({ id: editing.id, ...payload });
        toast.success("Project updated");
      } else {
        await m.create.mutateAsync(payload);
        toast.success("Project created");
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
        title="Projects"
        actions={<Button onClick={openNew}>+ New Project</Button>}
      >
        <div className="px-6 py-4 flex items-center gap-3 border-b border-ink-200">
          <Input
            placeholder="Search by code or name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-xs"
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
              <th>Code</th>
              <th>Name</th>
              <th>Funding</th>
              <th>Teams</th>
              <th>Sub-projects</th>
              <th>Status</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={7} className="text-ink-600">Loading…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={7} className="text-ink-600">No projects.</td></tr>
            ) : (
              filtered.map((p) => (
                <tr key={p.id}>
                  <td className="font-mono text-ink-900">{p.code}</td>
                  <td className="font-medium">{p.name}</td>
                  <td className="text-ink-600">{p.funding || "—"}</td>
                  <td className="text-ink-700">
                    {p.teams?.length ? p.teams.map((t) => t.name).join(", ") : "—"}
                  </td>
                  <td className="font-mono">{p.sub_project_count}</td>
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
                          toast.success("Project activated");
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
        submitDisabled={!form.code.trim() || !form.name.trim() || !codeValid}
        title={editing ? "Edit Project" : "New Project"}
      >
        <div className="space-y-4">
          <Field
            label="Code"
            required
            error={!codeValid ? "2–20 chars, uppercase letters / digits / dash" : undefined}
          >
            <Input
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
              invalid={!codeValid}
              placeholder="e.g. RSK-001"
              className="font-mono"
            />
          </Field>
          <Field label="Name" required>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label="Description">
            <Textarea
              rows={3}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </Field>
          <Field label="Funding">
            <Input
              value={form.funding}
              onChange={(e) => setForm({ ...form, funding: e.target.value })}
              placeholder="CC-12345"
            />
          </Field>
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
              A project can be shared by multiple teams; each team will see it on their Submit card.
            </p>
          </Field>
        </div>
      </Drawer>

      <ConfirmModal
        open={!!confirm}
        title="Deactivate project?"
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
            toast.success("Project deactivated");
            setConfirm(null);
          } catch (err) {
            toast.error(extractErrorMessage(err));
          }
        }}
      />
    </>
  );
}
