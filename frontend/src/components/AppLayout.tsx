import { NavLink, Outlet } from "react-router-dom";
import { clsx } from "clsx";
import { ToastViewport } from "@/components/Toast";

const NAV = [
  { to: "/submit", label: "Submit" },
  { to: "/dashboard", label: "Dashboard" },
  { to: "/config", label: "Configuration" },
];

export function AppLayout() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Top bar 1 — black with brand mark */}
      <div className="h-14 bg-ink-black text-white flex items-center px-6">
        <div className="flex items-center gap-3 max-w-page mx-auto w-full">
          <div className="w-7 h-7 bg-brand flex items-center justify-center font-bold text-white text-xs">
            BW
          </div>
          <span className="font-semibold tracking-wide">Book of Work</span>
          <span className="text-xs text-ink-400 ml-2 hidden sm:inline">PoC</span>
        </div>
      </div>

      {/* Top bar 2 — primary navigation */}
      <nav className="h-12 bg-white border-b border-ink-300">
        <div className="max-w-page mx-auto h-full px-6 flex items-center gap-6">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              className={({ isActive }) =>
                clsx(
                  "h-full inline-flex items-center text-sm font-medium border-b-2",
                  isActive
                    ? "text-brand border-brand"
                    : "text-ink-800 border-transparent hover:text-ink-900",
                )
              }
            >
              {n.label}
            </NavLink>
          ))}
        </div>
      </nav>

      <main className="flex-1 w-full">
        <div className="max-w-page mx-auto px-6 py-8">
          <Outlet />
        </div>
      </main>

      <footer className="h-10 border-t border-ink-200 bg-white">
        <div className="max-w-page mx-auto h-full px-6 flex items-center text-xs text-ink-600">
          © 2026 Book of Work · PoC
        </div>
      </footer>

      <ToastViewport />
    </div>
  );
}
