import { create } from "zustand";

export type ToastKind = "success" | "error" | "info";

interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
}

interface ToastStore {
  toasts: Toast[];
  push: (kind: ToastKind, message: string) => void;
  dismiss: (id: number) => void;
}

let nextId = 1;

const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  push: (kind, message) => {
    const id = nextId++;
    set((s) => ({ toasts: [...s.toasts, { id, kind, message }] }));
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 4000);
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

export const toast = {
  success: (m: string) => useToastStore.getState().push("success", m),
  error: (m: string) => useToastStore.getState().push("error", m),
  info: (m: string) => useToastStore.getState().push("info", m),
};

export function ToastViewport() {
  const { toasts, dismiss } = useToastStore();
  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 w-[360px] max-w-[90vw]">
      {toasts.map((t) => {
        const cls =
          t.kind === "success"
            ? "border-success text-success"
            : t.kind === "error"
              ? "border-danger text-danger"
              : "border-info text-info";
        return (
          <div
            key={t.id}
            className={`bg-white border-l-4 ${cls} shadow-elev2 px-4 py-3 rounded-sm flex items-start justify-between gap-3`}
          >
            <p className="text-sm text-ink-800 flex-1">{t.message}</p>
            <button
              onClick={() => dismiss(t.id)}
              className="text-ink-400 hover:text-ink-800 text-lg leading-none"
              aria-label="Dismiss"
            >
              ×
            </button>
          </div>
        );
      })}
    </div>
  );
}
