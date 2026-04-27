import { useState } from "react";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { ConfirmModal, Drawer } from "@/components/Drawer";
import { Field, Input, Textarea } from "@/components/Form";
import { useTeamMutations, useTeams } from "@/api/hooks";
import { toast } from "@/components/Toast";
import { extractErrorMessage } from "@/api/client";
import type { Team } from "@/api/types";

interface FormState {
  name: string;
  description: string;
}

export default function TeamsTab() {
  const { data, isLoading } = useTeams();
  const m = useTeamMutations();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [editing, setEditing] = useState<Team | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [form, setForm] = useState<FormState>({ name: "", description: "" });
  const [confirm, setConfirm] = useState<Team | null>(null);

  const filtered = (data ?? []).filter((t) => {
    if (statusFilter === "active" && !t.active) return false;
    if (statusFilter === "inactive" && t.active) return false;
    if (search && !t.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const openNew = () => {
    setEditing(null);
    setForm({ name: "", description: "" });
    setDrawerOpen(true);
  };
  const openEdit = (t: Team) => {
    setEditing(t);
    setForm({ name: t.name, description: t.description ?? "" });
    setDrawerOpen(true);
  };

  const onSave = async () => {
    try {
      if (editing) {
        await m.update.mutateAsync({ id: editing.id, ...form });
        toast.success("Team updated");
      } else {
        await m.create.mutateAsync(form);
        toast.success("Team created");
      }
      setDrawerOpen(false);
    } catch (err) {
      toast.error(extractErrorMessage(err));
    }
  };

  const onDeactivate = async () => {
    if (!confirm) return;
    try {
      await m.deactivate.mutateAsync(confirm.id);
      toast.success("Team deactivated");
      setConfirm(null);
    } catch (err) {
      toast.error(extractErrorMessage(err));
    }
  };

  return (
    <>
      <Card
        bodyClassName="p-0"
        title="Teams"
        actions={<Button onClick={openNew}>+ New Team</Button>}
      >
        <div className="px-6 py-4 flex items-center gap-3 border-b border-ink-200">
          <Input
            placeholder="Search by name…"
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
              <th>Name</th>
              <th>Members</th>
              <th>Description</th>
              <th>Status</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={5} className="text-ink-600">Loading…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={5} className="text-ink-600">No teams.</td></tr>
            ) : (
              filtered.map((t) => (
                <tr key={t.id}>
                  <td className="font-medium text-ink-900">{t.name}</td>
                  <td className="font-mono">{t.member_count}</td>
                  <td className="text-ink-600">{t.description || "—"}</td>
                  <td>
                    <span className={t.active ? "tag tag-success" : "tag tag-neutral"}>
                      {t.active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(t)}>Edit</Button>
                    {t.active ? (
                      <Button variant="ghost" size="sm" onClick={() => setConfirm(t)}>
                        Deactivate
                      </Button>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={async () => {
                          await m.update.mutateAsync({ id: t.id, active: true });
                          toast.success("Team activated");
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
        submitDisabled={!form.name.trim()}
        title={editing ? "Edit Team" : "New Team"}
      >
        <div className="space-y-4">
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
        title="Deactivate team?"
        body={
          <>
            <strong>{confirm?.name}</strong> will no longer appear in selectors. Existing
            submissions are preserved.
          </>
        }
        confirmLabel="Deactivate"
        destructive
        onCancel={() => setConfirm(null)}
        onConfirm={onDeactivate}
      />
    </>
  );
}
