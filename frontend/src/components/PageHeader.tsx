import { clsx } from "clsx";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  className?: string;
}

export function PageHeader({ title, subtitle, actions, className }: PageHeaderProps) {
  return (
    <div className={clsx("flex items-start justify-between gap-4 mb-6", className)}>
      <div>
        <h1 className="text-[32px] leading-10 font-semibold text-ink-900">{title}</h1>
        {subtitle ? <p className="mt-1 text-ink-600">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}
