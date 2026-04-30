import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api, extractErrorMessage } from "@/api/client";
import { Button } from "@/components/Button";
import { toast } from "@/components/Toast";

interface ImportError {
  sheet: string;
  row: number;
  message: string;
}
interface ImportSummary {
  teams_created: number;
  teams_updated: number;
  persons_created: number;
  persons_updated: number;
  projects_created: number;
  projects_updated: number;
  sub_projects_created: number;
  sub_projects_updated: number;
}
interface ImportResult {
  ok: boolean;
  errors: ImportError[];
  summary: ImportSummary;
}

interface Props {
  open: boolean;
  onClose: () => void;
}

export function BulkImportModal({ open, onClose }: Props) {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState<"download" | "validate" | "import" | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);

  if (!open) return null;

  const reset = () => {
    setFile(null);
    setResult(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const onDownload = async () => {
    setBusy("download");
    try {
      const res = await api.get("/config/template", { responseType: "blob" });
      const blob = new Blob([res.data], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `bow-config-${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("Template downloaded");
    } catch (err) {
      toast.error(extractErrorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const upload = async (mode: "validate" | "import") => {
    if (!file) return;
    setBusy(mode);
    setResult(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await api.post<ImportResult>(
        `/config/import?dry_run=${mode === "validate"}`,
        fd,
        { headers: { "Content-Type": "multipart/form-data" } },
      );
      setResult(res.data);
      if (res.data.ok && mode === "import") {
        const s = res.data.summary;
        toast.success(
          `Imported: teams +${s.teams_created}/~${s.teams_updated}, ` +
            `persons +${s.persons_created}/~${s.persons_updated}, ` +
            `projects +${s.projects_created}/~${s.projects_updated}, ` +
            `sub-projects +${s.sub_projects_created}/~${s.sub_projects_updated}`,
        );
        qc.invalidateQueries();
      } else if (res.data.ok) {
        toast.success(`Validation passed (${file.name})`);
      } else {
        toast.error(`${res.data.errors.length} validation error(s)`);
      }
    } catch (err) {
      toast.error(extractErrorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const close = () => {
    reset();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-[rgba(16,24,40,0.45)]"
        onClick={close}
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Bulk import"
        className="relative bg-white shadow-elev3 rounded w-[720px] max-w-[92vw] max-h-[88vh] flex flex-col"
      >
        <header className="px-6 h-14 flex items-center justify-between border-b border-ink-200">
          <h2 className="text-base font-semibold text-ink-900">
            Bulk Import / Export
          </h2>
          <button
            type="button"
            onClick={close}
            aria-label="Close"
            className="text-ink-600 hover:text-ink-900 text-xl leading-none"
          >
            ×
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {/* Step 1: Download */}
          <section>
            <h3 className="text-sm font-semibold text-ink-900 mb-1">
              1. Download template
            </h3>
            <p className="text-sm text-ink-600 mb-3">
              The Excel file contains all current Teams, Persons, Projects and
              Sub-projects. Edit it and re-upload to apply changes in bulk.
            </p>
            <Button
              variant="secondary"
              onClick={onDownload}
              disabled={busy === "download"}
            >
              {busy === "download" ? "Preparing…" : "Download Excel"}
            </Button>
          </section>

          <hr className="border-ink-200" />

          {/* Step 2: Upload */}
          <section>
            <h3 className="text-sm font-semibold text-ink-900 mb-1">
              2. Upload edited file
            </h3>
            <p className="text-sm text-ink-600 mb-3">
              Leave the <code>id</code> column blank to create new rows.
              Existing rows are matched by id and updated. Rows are never
              deleted — set <code>active</code> to FALSE to retire.
            </p>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xlsm"
              onChange={(e) => {
                setFile(e.target.files?.[0] ?? null);
                setResult(null);
              }}
              className="block text-sm text-ink-800 file:mr-3 file:px-3 file:py-1.5 file:rounded file:border file:border-ink-300 file:bg-white file:text-ink-900 file:cursor-pointer hover:file:bg-ink-100"
            />
            <div className="mt-3 flex items-center gap-2">
              <Button
                variant="secondary"
                onClick={() => upload("validate")}
                disabled={!file || busy !== null}
              >
                {busy === "validate" ? "Validating…" : "Validate"}
              </Button>
              <Button
                variant="primary"
                onClick={() => upload("import")}
                disabled={!file || busy !== null || (result != null && !result.ok)}
              >
                {busy === "import" ? "Importing…" : "Import"}
              </Button>
            </div>
          </section>

          {/* Result */}
          {result && (
            <section>
              <h3 className="text-sm font-semibold text-ink-900 mb-2">
                {result.ok ? "✓ No errors" : `✗ ${result.errors.length} error(s)`}
              </h3>
              {result.ok ? (
                <div className="text-sm text-ink-700 space-y-1 font-mono">
                  <div>
                    Teams: +{result.summary.teams_created} created, ~
                    {result.summary.teams_updated} updated
                  </div>
                  <div>
                    Persons: +{result.summary.persons_created} created, ~
                    {result.summary.persons_updated} updated
                  </div>
                  <div>
                    Projects: +{result.summary.projects_created} created, ~
                    {result.summary.projects_updated} updated
                  </div>
                  <div>
                    Sub-projects: +{result.summary.sub_projects_created} created,
                    ~{result.summary.sub_projects_updated} updated
                  </div>
                </div>
              ) : (
                <div className="border border-ink-300 rounded overflow-hidden">
                  <table className="table-base">
                    <thead>
                      <tr>
                        <th>Sheet</th>
                        <th>Row</th>
                        <th>Message</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.errors.map((e, i) => (
                        <tr key={i}>
                          <td className="font-mono">{e.sheet}</td>
                          <td className="font-mono text-right">{e.row}</td>
                          <td className="text-danger">{e.message}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}
        </div>

        <footer className="px-6 h-14 flex items-center justify-end gap-2 border-t border-ink-200">
          <Button variant="secondary" onClick={close}>
            Close
          </Button>
        </footer>
      </div>
    </div>
  );
}
