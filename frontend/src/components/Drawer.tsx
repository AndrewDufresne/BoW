import { useEffect } from "react";
import { Button } from "./Button";

interface DrawerProps {
  open: boolean;
  title: string;
  onClose: () => void;
  onSubmit?: () => void;
  submitLabel?: string;
  submitDisabled?: boolean;
  children: React.ReactNode;
}

export function Drawer({
  open,
  title,
  onClose,
  onSubmit,
  submitLabel = "Save",
  submitDisabled,
  children,
}: DrawerProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40">
      <div
        className="absolute inset-0 bg-[rgba(16,24,40,0.45)]"
        onClick={onClose}
        aria-hidden
      />
      <aside
        className="absolute right-0 top-0 h-full w-full sm:w-[480px] bg-white shadow-elev3 flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <header className="px-6 h-14 flex items-center justify-between border-b border-ink-200">
          <h2 className="text-base font-semibold text-ink-900">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-ink-600 hover:text-ink-900 text-xl leading-none"
          >
            ×
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
        <footer className="px-6 h-16 flex items-center justify-end gap-2 border-t border-ink-200">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          {onSubmit ? (
            <Button variant="primary" onClick={onSubmit} disabled={submitDisabled}>
              {submitLabel}
            </Button>
          ) : null}
        </footer>
      </aside>
    </div>
  );
}

interface ConfirmModalProps {
  open: boolean;
  title: string;
  body: React.ReactNode;
  confirmLabel?: string;
  destructive?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function ConfirmModal({
  open,
  title,
  body,
  confirmLabel = "Confirm",
  destructive,
  onCancel,
  onConfirm,
}: ConfirmModalProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-[rgba(16,24,40,0.45)]" onClick={onCancel} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        className="relative bg-white shadow-elev3 rounded w-[480px] max-w-[90vw]"
      >
        <header className="px-6 py-4 border-b border-ink-200">
          <h2 className="text-base font-semibold text-ink-900">{title}</h2>
        </header>
        <div className="px-6 py-5 text-sm text-ink-800">{body}</div>
        <footer className="px-6 py-4 flex justify-end gap-2 border-t border-ink-200">
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant={destructive ? "danger" : "primary"} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </footer>
      </div>
    </div>
  );
}
