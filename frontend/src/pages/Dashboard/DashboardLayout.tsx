import { NavLink, Outlet } from "react-router-dom";
import { clsx } from "clsx";
import { PageHeader } from "@/components/PageHeader";

const TABS = [
  { to: "/dashboard/statistics", label: "Statistics" },
  { to: "/dashboard/insights", label: "Insights" },
];

export default function DashboardLayout() {
  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle="Track submission progress and explore aggregated insights."
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
