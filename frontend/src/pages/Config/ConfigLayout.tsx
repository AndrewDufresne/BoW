import { NavLink, Outlet } from "react-router-dom";
import { clsx } from "clsx";
import { PageHeader } from "@/components/PageHeader";

const TABS = [
  { to: "/config/teams", label: "Teams" },
  { to: "/config/persons", label: "People" },
  { to: "/config/projects", label: "Projects" },
  { to: "/config/activities", label: "Activities" },
];

export default function ConfigLayout() {
  return (
    <>
      <PageHeader
        title="Configuration"
        subtitle="Manage teams, people, projects, and activities."
      />
      <div className="border-b border-ink-300 mb-6">
        <div className="flex gap-6">
          {TABS.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              className={({ isActive }) =>
                clsx(
                  "pb-3 text-sm font-medium border-b-2 -mb-[2px]",
                  isActive
                    ? "text-brand border-brand"
                    : "text-ink-800 border-transparent hover:text-ink-900",
                )
              }
            >
              {t.label}
            </NavLink>
          ))}
        </div>
      </div>
      <Outlet />
    </>
  );
}
