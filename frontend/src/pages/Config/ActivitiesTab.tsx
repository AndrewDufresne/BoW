import { useState } from "react";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { ConfirmModal, Drawer } from "@/components/Drawer";
import { Field, Input, Select } from "@/components/Form";
import { useActivities, useActivityMutations, useProjects } from "@/api/hooks";
import { toast } from "@/components/Toast";
import { extractErrorMessage } from "@/api/client";
import type { Activity } from "@/api/types";

interface FormState {
  project_id: string;
  name: string;
}

export default function ActivitiesTab() {
  const projects = useProjects(true);
  const [projectFilter, setProjectFilter] = useState<string>("");
  const { data, isLoading } = useActivities({ projectId: projectFilter || undefined });
  const m = useActivityMutations();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [editing, setEditing] = useState<Activity | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [form, setForm] = useState<FormState>({ project_id: "", name: "" });
  const [confirm, setConfirm] = useState<Activity | null>(null);

  const filtered = (data ?? []).filter((a) => {
    if (statusFilter === "active" && !a.active) return false;
    if (statusFilter === "inactive" && a.active) return false;
    if (search && !a.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const openNew = () => {
    setEditing(null);
    setForm({ project_id: projectFilter || "", name: "" });
    setDrawerOpen(true);
  };
  const openEdit = (a: Activity) => {
    setEditing(a);
    setForm({ project_id: a.project_id, name: a.name });
    setDrawerOpen(true);
  };

  const onSave = async () => {
    try {
      if (editing) {
        await m.update.mutateAsync({ id: editing.id, name: form.name });
        toast.success("Activity updated");
      } else {
        await m.create.mutateAsync(form);
        toast.success("Activity created");
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
        title="Activities"
        actions={<Button onClick={openNew}>+ New Activity</Button>}
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
              <th>Status</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={4} className="text-ink-600">Loading…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={4} className="text-ink-600">No activities.</td></tr>
            ) : (
              filtered.map((a) => (
                <tr key={a.id}>
                  <td className="font-medium text-ink-900">{a.name}</td>
                  <td className="text-ink-600">{a.project_name}</td>
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
                          toast.success("Activity activated");
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
        title={editing ? "Edit Activity" : "New Activity"}
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
        </div>
      </Drawer>

      <ConfirmModal
        open={!!confirm}
        title="Deactivate activity?"
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
            toast.success("Activity deactivated");
            setConfirm(null);
          } catch (err) {
            toast.error(extractErrorMessage(err));
          }
        }}
      />
    </>
  );
}
