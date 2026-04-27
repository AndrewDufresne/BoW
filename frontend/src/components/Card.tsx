import { clsx } from "clsx";

interface CardProps {
  title?: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}

export function Card({ title, subtitle, actions, children, className, bodyClassName }: CardProps) {
  return (
    <section className={clsx("card", className)}>
      {(title || actions) && (
        <header className="flex items-center justify-between gap-4 px-6 py-4 border-b border-ink-200">
          <div>
            {title ? <h2 className="text-base font-semibold text-ink-900">{title}</h2> : null}
            {subtitle ? <p className="text-xs text-ink-600 mt-0.5">{subtitle}</p> : null}
          </div>
          {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
        </header>
      )}
      <div className={clsx("p-6", bodyClassName)}>{children}</div>
    </section>
  );
}
