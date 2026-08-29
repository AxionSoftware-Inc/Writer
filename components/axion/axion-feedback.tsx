import * as React from "react";

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export type AxNoticeTone = "info" | "success" | "warning" | "danger" | "neutral";

export function AxNotice({
  tone = "neutral",
  title,
  children,
  action,
  className,
}: {
  tone?: AxNoticeTone;
  title?: React.ReactNode;
  children: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  const tones: Record<AxNoticeTone, string> = {
    neutral: "border-[var(--ax-line)] bg-[var(--ax-surface-soft)]",
    info: "border-[color-mix(in_srgb,var(--ax-accent)_24%,var(--ax-line))] bg-[var(--ax-accent-soft)]",
    success: "border-[color-mix(in_srgb,var(--ax-success)_24%,var(--ax-line))] bg-[color-mix(in_srgb,var(--ax-success)_7%,var(--ax-surface))]",
    warning: "border-[color-mix(in_srgb,var(--ax-warning)_28%,var(--ax-line))] bg-[color-mix(in_srgb,var(--ax-warning)_7%,var(--ax-surface))]",
    danger: "border-[color-mix(in_srgb,var(--ax-danger)_28%,var(--ax-line))] bg-[color-mix(in_srgb,var(--ax-danger)_7%,var(--ax-surface))]",
  };

  return (
    <div className={cx("flex items-start justify-between gap-4 rounded-[var(--ax-radius-control)] border px-3 py-2.5", tones[tone], className)}>
      <div className="min-w-0">
        {title ? <div className="text-[11px] font-semibold text-[var(--ax-text)]">{title}</div> : null}
        <div className={cx("text-[11px] leading-5 text-[var(--ax-text-soft)]", title && "mt-1")}>{children}</div>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function AxLoadingState({
  label = "Loading…",
  detail,
  className,
}: {
  label?: React.ReactNode;
  detail?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cx("flex min-h-32 items-center justify-center px-6 py-10 text-center", className)} role="status" aria-live="polite">
      <div>
        <div className="mx-auto h-4 w-4 animate-pulse rounded-full bg-[var(--ax-accent)] motion-reduce:animate-none" aria-hidden="true" />
        <div className="mt-3 text-xs font-semibold text-[var(--ax-text)]">{label}</div>
        {detail ? <div className="mt-1 text-[11px] leading-5 text-[var(--ax-text-faint)]">{detail}</div> : null}
      </div>
    </div>
  );
}

export function AxMetaRow({
  label,
  value,
  action,
  className,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cx("grid min-h-9 grid-cols-[minmax(92px,0.38fr)_minmax(0,1fr)_auto] items-center gap-3 border-b border-[var(--ax-line)] py-2 last:border-b-0", className)}>
      <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--ax-text-faint)]">{label}</div>
      <div className="min-w-0 text-[11px] leading-5 text-[var(--ax-text)]">{value}</div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
