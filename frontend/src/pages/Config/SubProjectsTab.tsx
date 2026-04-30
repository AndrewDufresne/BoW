import { useState } from "react";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { ConfirmModal, Drawer } from "@/components/Drawer";
import { Field, Input, Select, Textarea } from "@/components/Form";
import { useSubProjects, useSubProjectMutations, useProjects } from "@/api/hooks";
import { toast } from "@/components/Toast";
import { extractErrorMessage } from "@/api/client";
import type { SubProject } from "@/api/types";

interface FormState {
  project_id: string;
  name: string;
  description: string;
  funding: string;
}

export default function SubProjectsTab() {
  const projects = useProjects(true);
  const [projectFilter, setProjectFilter] = useState<string>("");
  const { data, isLoading } = useSubProjects({ projectId: projectFilter || undefined });
  const m = useSubProjectMutations();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [editing, setEditing] = useState<SubProject | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [form, setForm] = useState<FormState>({ project_id: "", name: "", description: "", funding: "" });
  const [confirm, setConfirm] = useState<SubProject | null>(null);

  const filtered = (data ?? []).filter((a) => {
    if (statusFilter === "active" && !a.active) return false;
    if (statusFilter === "inactive" && a.active) return false;
    if (search && !a.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const openNew = () => {
    setEditing(null);
    setForm({ project_id: projectFilter || "", name: "", description: "", funding: "" });
    setDrawerOpen(true);
  };
  const openEdit = (a: SubProject) => {
    setEditing(a);
    setForm({
      project_id: a.project_id,
      name: a.name,
      description: a.description ?? "",
      funding: a.funding ?? "",
    });
    setDrawerOpen(true);
  };

  const onSave = async () => {
    const payload = {
      project_id: form.project_id,
      name: form.name,
      description: form.description || null,
      funding: form.funding || null,
    };
    try {
      if (editing) {
        await m.update.mutateAsync({
          id: editing.id,
          name: form.name,
          description: form.description || null,
          funding: form.funding || null,
        });
        toast.success("Sub-project updated");
      } else {
        await m.create.mutateAsync(payload);
        toast.success("Sub-project created");
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
        title="Sub-projects"
        actions={<Button onClick={openNew}>+ New Sub-project</Button>}
      >
        <div className="px-6 py-4 flex items-center gap-3 border-b border-ink-200 flex-wrap">
          <Input
            placeholder="Search by name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-xs"
          />
          <select
            className="input max-w-[220px]"
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
          >
            <option value="">All projects</option>
            {projects.data?.map((p) => (
              <option key={p.id} value={p.id}>{p.code} · {p.name}</option>
            ))}
          </select>
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
              <th>Name</th>
              <th>Project</th>
              <th>Funding</th>
              <th>Description</th>
              <th>Status</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={6} className="text-ink-600">Loading…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={6} className="text-ink-600">No sub-projects.</td></tr>
            ) : (
              filtered.map((a) => (
                <tr key={a.id}>
                  <td className="font-medium text-ink-900">{a.name}</td>
                  <td className="text-ink-600">{a.project_name}</td>
                  <td className="text-ink-600">{a.funding || "—"}</td>
                  <td className="text-ink-600 max-w-xs truncate" title={a.description ?? ""}>
                    {a.description || "—"}
                  </td>
                  <td>
                    <span className={a.active ? "tag tag-success" : "tag tag-neutral"}>
                      {a.active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(a)}>Edit</Button>
                    {a.active ? (
                      <Button variant="ghost" size="sm" onClick={() => setConfirm(a)}>Deactivate</Button>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={async () => {
                          await m.update.mutateAsync({ id: a.id, active: true });
                          toast.success("Sub-project activated");
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
        submitDisabled={!form.name.trim() || (!editing && !form.project_id)}
        title={editing ? "Edit Sub-project" : "New Sub-project"}
      >
        <div className="space-y-4">
          <Field label="Project" required>
            <Select
              value={form.project_id}
              onChange={(e) => setForm({ ...form, project_id: e.target.value })}
              disabled={!!editing}
            >
              <option value="">Select project…</option>
              {projects.data?.map((p) => (
                <option key={p.id} value={p.id}>{p.code} · {p.name}</option>
              ))}
            </Select>
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
        </div>
      </Drawer>

      <ConfirmModal
        open={!!confirm}
        title="Deactivate sub-project?"
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
            toast.success("Sub-project deactivated");
            setConfirm(null);
          } catch (err) {
            toast.error(extractErrorMessage(err));
          }
        }}
      />
    </>
  );
}
