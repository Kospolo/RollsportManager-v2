import type { ReactNode } from "react";

/**
 * Seiten-/Sektions-Kopf: optionales Eyebrow, Display- oder H2-Titel,
 * Untertitel in Menschensprache und Aktions-Slot rechts (page-head im Mockup).
 */
export function SectionHeader({
  eyebrow,
  title,
  sub,
  action,
  level = 2,
  className = "",
}: {
  eyebrow?: string;
  title: ReactNode;
  sub?: ReactNode;
  /** Aktionen rechts — max. EINE Beere-Primäraktion pro Sichtbereich */
  action?: ReactNode;
  /** 1 = Seiten-Titel (display), 2 = Sektion (h2) */
  level?: 1 | 2;
  className?: string;
}) {
  const Heading = level === 1 ? "h1" : "h2";
  const headingClass =
    level === 1
      ? "font-display text-display tracking-tight text-ink"
      : "font-display text-h2 tracking-[-0.015em] text-ink";

  return (
    <header className={`flex flex-wrap items-end gap-x-5 gap-y-3 ${className}`.trim()}>
      <div className="grid min-w-0 gap-1">
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <Heading className={headingClass}>{title}</Heading>
        {sub && <p className="text-[14px] text-ink-soft">{sub}</p>}
      </div>
      {action && <div className="ml-auto flex flex-none flex-wrap items-center gap-2.5">{action}</div>}
    </header>
  );
}
