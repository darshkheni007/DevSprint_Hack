import type { ReactNode } from "react";
import { Icon } from "./icons";

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h1 className="text-xl font-semibold text-ink-900 sm:text-2xl">{title}</h1>
        {description ? (
          <p className="mt-1 max-w-2xl text-sm text-ink-500">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function Card({
  title,
  description,
  actions,
  children,
  className = "",
  bodyClassName = "p-4 sm:p-5",
}: {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={`card ${className}`}>
      {title || actions ? (
        <header className="flex flex-col gap-2 border-b border-ink-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div>
            {title ? <h2 className="text-sm font-semibold text-ink-800">{title}</h2> : null}
            {description ? (
              <p className="mt-0.5 text-xs text-ink-500">{description}</p>
            ) : null}
          </div>
          {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
        </header>
      ) : null}
      <div className={bodyClassName}>{children}</div>
    </section>
  );
}

export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = "brand",
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: string;
  tone?: "brand" | "success" | "warn" | "danger" | "neutral";
}) {
  const toneClasses: Record<string, string> = {
    brand: "bg-brand-50 text-brand-700",
    success: "bg-success-50 text-success-700",
    warn: "bg-warn-50 text-warn-700",
    danger: "bg-danger-50 text-danger-700",
    neutral: "bg-ink-100 text-ink-600",
  };
  return (
    <div className="card p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-500">
            {label}
          </p>
          <p className="mt-1.5 text-2xl font-semibold text-ink-900">{value}</p>
          {hint ? <p className="mt-1 text-xs text-ink-500">{hint}</p> : null}
        </div>
        {icon ? (
          <span className={`rounded-lg p-2 ${toneClasses[tone]}`}>
            <Icon name={icon} className="h-5 w-5" />
          </span>
        ) : null}
      </div>
    </div>
  );
}

const BADGE_TONES: Record<string, string> = {
  success: "bg-success-50 text-success-700",
  warn: "bg-warn-50 text-warn-700",
  danger: "bg-danger-50 text-danger-700",
  info: "bg-brand-50 text-brand-700",
  neutral: "bg-ink-100 text-ink-600",
};

export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: keyof typeof BADGE_TONES;
}) {
  return <span className={`badge ${BADGE_TONES[tone]}`}>{children}</span>;
}

export function Alert({
  tone = "info",
  title,
  children,
}: {
  tone?: "info" | "success" | "warn" | "danger";
  title?: string;
  children?: ReactNode;
}) {
  const tones: Record<string, string> = {
    info: "border-brand-200 bg-brand-50 text-brand-800",
    success: "border-success-500/30 bg-success-50 text-success-700",
    warn: "border-warn-500/30 bg-warn-50 text-warn-700",
    danger: "border-danger-500/30 bg-danger-50 text-danger-700",
  };
  return (
    <div className={`rounded-lg border px-4 py-3 text-sm ${tones[tone]}`} role="status">
      {title ? <p className="font-semibold">{title}</p> : null}
      {children ? <div className={title ? "mt-0.5" : ""}>{children}</div> : null}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  icon = "inbox",
}: {
  title: string;
  description?: string;
  icon?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-ink-200 px-6 py-10 text-center">
      <span className="mb-3 rounded-full bg-ink-100 p-3 text-ink-400">
        <Icon name={icon} className="h-5 w-5" />
      </span>
      <p className="text-sm font-medium text-ink-700">{title}</p>
      {description ? (
        <p className="mt-1 max-w-sm text-xs text-ink-500">{description}</p>
      ) : null}
    </div>
  );
}

export function ProgressBar({
  percent,
  tone,
}: {
  percent: number;
  tone?: "brand" | "success" | "warn" | "danger";
}) {
  const clamped = Math.max(0, Math.min(100, percent));
  const resolved =
    tone ??
    (clamped >= 75 ? "success" : clamped >= 50 ? "warn" : "danger");
  const colors: Record<string, string> = {
    brand: "bg-brand-500",
    success: "bg-success-500",
    warn: "bg-warn-500",
    danger: "bg-danger-500",
  };
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-full max-w-[10rem] overflow-hidden rounded-full bg-ink-100">
        <div
          className={`h-full rounded-full ${colors[resolved]}`}
          style={{ width: `${clamped}%` }}
        />
      </div>
      <span className="text-xs font-medium text-ink-600">{clamped}%</span>
    </div>
  );
}
