import { useState } from "react";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { ConfirmModal, Drawer } from "@/components/Drawer";
import { Field, Input, Textarea } from "@/components/Form";
import { useProjectMutations, useProjects } from "@/api/hooks";
import { toast } from "@/components/Toast";
import { extractErrorMessage } from "@/api/client";
import type { Project } from "@/api/types";

interface FormState {
  code: string;
  name: string;
  description: string;
}

export default function ProjectsTab() {
  const { data, isLoading } = useProjects();
  const m = useProjectMutations();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [editing, setEditing] = useState<Project | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [form, setForm] = useState<FormState>({ code: "", name: "", description: "" });
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
    setForm({ code: "", name: "", description: "" });
    setDrawerOpen(true);
  };
  const openEdit = (p: Project) => {
    setEditing(p);
    setForm({ code: p.code, name: p.name, description: p.description ?? "" });
    setDrawerOpen(true);
  };

  const onSave = async () => {
    try {
      if (editing) {
        await m.update.mutateAsync({ id: editing.id, ...form });
        toast.success("Project updated");
      } else {
        await m.create.mutateAsync(form);
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
              <th>Sub-projects</th>
              <th>Status</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={5} className="text-ink-600">Loading…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={5} className="text-ink-600">No projects.</td></tr>
            ) : (
              filtered.map((p) => (
                <tr key={p.id}>
                  <td className="font-mono text-ink-900">{p.code}</td>
                  <td className="font-medium">{p.name}</td>
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
              rows={4}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
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
