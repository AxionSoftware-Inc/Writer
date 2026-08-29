import * as React from "react";

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export type AxButtonVariant = "primary" | "secondary" | "quiet" | "danger";
export type AxButtonSize = "sm" | "md";

function actionClasses(variant: AxButtonVariant, size: AxButtonSize, className?: string) {
  const variants: Record<AxButtonVariant, string> = {
    primary: "border-transparent bg-[var(--ax-accent-strong)] text-white hover:bg-[var(--ax-accent)]",
    secondary: "border-[var(--ax-line-strong)] bg-[var(--ax-surface)] text-[var(--ax-text)] hover:bg-[var(--ax-surface-soft)]",
    quiet: "border-transparent bg-transparent text-[var(--ax-text-soft)] hover:bg-[var(--ax-surface-soft)] hover:text-[var(--ax-text)]",
    danger: "border-transparent bg-[var(--ax-danger)] text-white hover:opacity-90",
  };
  const sizes: Record<AxButtonSize, string> = { sm: "h-8 px-3 text-[11px]", md: "h-10 px-4 text-xs" };
  return cx("inline-flex shrink-0 items-center justify-center gap-2 rounded-[var(--ax-radius-control)] border font-semibold transition-[background-color,color,border-color,box-shadow] duration-[var(--ax-motion-fast)] ease-[var(--ax-ease-standard)] outline-none focus-visible:shadow-[var(--ax-focus-ring)]", variants[variant], sizes[size], className);
}

export const AxButton = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: AxButtonVariant; size?: AxButtonSize }>(
  ({ className, variant = "secondary", size = "md", type = "button", ...props }, ref) => (
    <button ref={ref} type={type} className={cx(actionClasses(variant, size, className), "disabled:pointer-events-none disabled:opacity-45")} {...props} />
  ),
);
AxButton.displayName = "AxButton";

export const AxActionLink = React.forwardRef<HTMLAnchorElement, React.AnchorHTMLAttributes<HTMLAnchorElement> & { variant?: AxButtonVariant; size?: AxButtonSize }>(
  ({ className, variant = "secondary", size = "md", ...props }, ref) => <a ref={ref} className={actionClasses(variant, size, className)} {...props} />,
);
AxActionLink.displayName = "AxActionLink";

export const AxIconButton = React.forwardRef<
  HTMLButtonElement,
  Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "aria-label"> & { "aria-label": string; variant?: "secondary" | "quiet"; size?: AxButtonSize }
>(({ className, variant = "quiet", size = "md", type = "button", ...props }, ref) => {
  const dimensions = size === "sm" ? "h-8 w-8" : "h-10 w-10";
  const treatment = variant === "secondary"
    ? "border-[var(--ax-line-strong)] bg-[var(--ax-surface)] text-[var(--ax-text-soft)] hover:bg-[var(--ax-surface-soft)] hover:text-[var(--ax-text)]"
    : "border-transparent bg-transparent text-[var(--ax-text-soft)] hover:bg-[var(--ax-surface-soft)] hover:text-[var(--ax-text)]";
  return <button ref={ref} type={type} className={cx("inline-flex shrink-0 items-center justify-center rounded-[var(--ax-radius-control)] border outline-none transition-[background-color,color,border-color,box-shadow] duration-[var(--ax-motion-fast)] focus-visible:shadow-[var(--ax-focus-ring)] disabled:pointer-events-none disabled:opacity-45", dimensions, treatment, className)} {...props} />;
});
AxIconButton.displayName = "AxIconButton";

export function AxToolbar({ children, className, label = "Tools" }: { children: React.ReactNode; className?: string; label?: string }) {
  return <div role="toolbar" aria-label={label} className={cx("inline-flex min-h-10 items-center gap-1 rounded-[var(--ax-radius-control)] border border-[var(--ax-line)] bg-[var(--ax-surface-soft)] p-1", className)}>{children}</div>;
}

export const AxInput = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(({ className, ...props }, ref) => (
  <input ref={ref} className={cx("h-10 w-full rounded-[var(--ax-radius-control)] border border-[var(--ax-line-strong)] bg-[var(--ax-surface)] px-3 text-sm text-[var(--ax-text)] outline-none transition-[border-color,box-shadow] duration-[var(--ax-motion-fast)] placeholder:text-[var(--ax-text-faint)] focus:border-[var(--ax-accent)] focus:shadow-[var(--ax-focus-ring)]", className)} {...props} />
));
AxInput.displayName = "AxInput";

export const AxTextarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(({ className, ...props }, ref) => (
  <textarea ref={ref} className={cx("min-h-28 w-full resize-y rounded-[var(--ax-radius-control)] border border-[var(--ax-line-strong)] bg-[var(--ax-surface)] px-3 py-2.5 text-sm leading-6 text-[var(--ax-text)] outline-none transition-[border-color,box-shadow] duration-[var(--ax-motion-fast)] placeholder:text-[var(--ax-text-faint)] focus:border-[var(--ax-accent)] focus:shadow-[var(--ax-focus-ring)]", className)} {...props} />
));
AxTextarea.displayName = "AxTextarea";

export const AxSelect = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(({ className, ...props }, ref) => (
  <select ref={ref} className={cx("h-10 w-full rounded-[var(--ax-radius-control)] border border-[var(--ax-line-strong)] bg-[var(--ax-surface)] px-3 text-sm text-[var(--ax-text)] outline-none transition-[border-color,box-shadow] duration-[var(--ax-motion-fast)] focus:border-[var(--ax-accent)] focus:shadow-[var(--ax-focus-ring)]", className)} {...props} />
));
AxSelect.displayName = "AxSelect";

export function AxField({ label, hint, children, className }: { label: React.ReactNode; hint?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return <label className={cx("grid gap-2", className)}><span className="flex items-baseline justify-between gap-3"><span className="text-[11px] font-semibold text-[var(--ax-text)]">{label}</span>{hint ? <span className="text-[10px] text-[var(--ax-text-faint)]">{hint}</span> : null}</span>{children}</label>;
}

export function AxBadge({ children, tone = "neutral", className }: { children: React.ReactNode; tone?: "neutral" | "accent" | "success" | "warning" | "danger"; className?: string }) {
  const tones = {
    neutral: "border-[var(--ax-line)] bg-[var(--ax-surface-soft)] text-[var(--ax-text-soft)]",
    accent: "border-transparent bg-[var(--ax-accent-soft)] text-[var(--ax-accent-strong)]",
    success: "border-transparent bg-[var(--ax-surface-soft)] text-[var(--ax-success)]",
    warning: "border-transparent bg-[var(--ax-surface-soft)] text-[var(--ax-warning)]",
    danger: "border-transparent bg-[var(--ax-surface-soft)] text-[var(--ax-danger)]",
  };
  return <span className={cx("inline-flex h-6 items-center rounded-full border px-2.5 text-[10px] font-semibold", tones[tone], className)}>{children}</span>;
}

export function AxPanel({ children, className, elevated = false }: { children: React.ReactNode; className?: string; elevated?: boolean }) {
  return <section className={cx("rounded-[var(--ax-radius-panel)] border border-[var(--ax-line)] bg-[var(--ax-surface)]", elevated && "shadow-[var(--ax-shadow-subtle)]", className)}>{children}</section>;
}

export function AxSectionHeader({ eyebrow, title, description, actions, className }: { eyebrow?: React.ReactNode; title: React.ReactNode; description?: React.ReactNode; actions?: React.ReactNode; className?: string }) {
  return <div className={cx("flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between", className)}><div className="min-w-0">{eyebrow ? <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--ax-accent)]">{eyebrow}</div> : null}<h2 className="mt-1 text-xl font-semibold tracking-[-0.025em] text-[var(--ax-text)]">{title}</h2>{description ? <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--ax-text-soft)]">{description}</p> : null}</div>{actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}</div>;
}

export function AxTabList({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div role="tablist" className={cx("inline-flex h-9 items-center gap-1 rounded-[var(--ax-radius-control)] border border-[var(--ax-line)] bg-[var(--ax-surface-soft)] p-1", className)}>{children}</div>;
}

export function AxTab({ active, children, className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return <button role="tab" aria-selected={active} className={cx("h-7 rounded-[7px] px-3 text-[11px] font-semibold transition-colors duration-[var(--ax-motion-fast)]", active ? "bg-[var(--ax-surface)] text-[var(--ax-text)] shadow-[0_1px_2px_rgb(23_36_54_/_0.06)]" : "text-[var(--ax-text-soft)] hover:text-[var(--ax-text)]", className)} {...props}>{children}</button>;
}

export function AxDisclosure({ title, hint, children, className, ...props }: React.DetailsHTMLAttributes<HTMLDetailsElement> & { title: React.ReactNode; hint?: React.ReactNode }) {
  return (
    <details className={cx("group rounded-[var(--ax-radius-panel)] border border-[var(--ax-line)] bg-[var(--ax-surface)]", className)} {...props}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-3 outline-none focus-visible:shadow-[var(--ax-focus-ring)]">
        <div className="min-w-0">
          <div className="text-[11px] font-semibold text-[var(--ax-text)]">{title}</div>
          {hint ? <div className="mt-1 text-[10px] leading-4 text-[var(--ax-text-faint)]">{hint}</div> : null}
        </div>
        <span className="shrink-0 text-[10px] font-semibold text-[var(--ax-accent)] group-open:hidden">Show</span>
        <span className="hidden shrink-0 text-[10px] font-semibold text-[var(--ax-accent)] group-open:inline">Hide</span>
      </summary>
      <div className="border-t border-[var(--ax-line)] p-4">{children}</div>
    </details>
  );
}

export function AxEmptyState({ title, description, action, className }: { title: React.ReactNode; description?: React.ReactNode; action?: React.ReactNode; className?: string }) {
  return <div className={cx("flex min-h-52 flex-col items-center justify-center border-y border-[var(--ax-line)] px-6 py-12 text-center", className)}><div className="max-w-md"><h3 className="text-base font-semibold tracking-[-0.015em] text-[var(--ax-text)]">{title}</h3>{description ? <p className="mt-2 text-sm leading-6 text-[var(--ax-text-soft)]">{description}</p> : null}{action ? <div className="mt-5 flex justify-center">{action}</div> : null}</div></div>;
}

export function AxInspector({ title, subtitle, children, footer, className }: { title: React.ReactNode; subtitle?: React.ReactNode; children: React.ReactNode; footer?: React.ReactNode; className?: string }) {
  return <aside className={cx("flex min-h-0 flex-col border-l border-[var(--ax-line)] bg-[var(--ax-surface)]", className)}><header className="border-b border-[var(--ax-line)] px-4 py-3"><div className="text-xs font-semibold text-[var(--ax-text)]">{title}</div>{subtitle ? <div className="mt-1 text-[10px] leading-4 text-[var(--ax-text-faint)]">{subtitle}</div> : null}</header><div className="min-h-0 flex-1 overflow-y-auto p-4">{children}</div>{footer ? <footer className="border-t border-[var(--ax-line)] p-3">{footer}</footer> : null}</aside>;
}
