import type { ReactNode } from "react";

/**
 * Karte (DESIGN-SYSTEM §3.2): Surface, Hairline-Rand, radius-xl 20,
 * warm getönter Schatten. Struktur: Eyebrow → H3-Titel → Inhalt →
 * max. EINE Beere-Aktion.
 */

export function Card({
  children,
  className = "",
  padded = true,
}: {
  children: ReactNode;
  className?: string;
  /** false z. B. für randlose Tabellen — Padding dann selbst setzen */
  padded?: boolean;
}) {
  return (
    <section
      className={`rounded-xl border border-line bg-surface shadow-card ${
        padded ? "p-5 sm:p-6" : ""
      } ${className}`.trim()}
    >
      {children}
    </section>
  );
}

/** Karten-Kopf: Eyebrow (Einordnung) + H3 (Menschensprache) + Aktions-Slot rechts. */
export function CardHeader({
  eyebrow,
  title,
  action,
  className = "",
}: {
  eyebrow?: string;
  title: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <header className={`mb-4 flex items-center gap-3 ${className}`.trim()}>
      <div className="grid min-w-0 gap-0.5">
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h3 className="font-display text-h3 tracking-[-0.01em] text-ink">{title}</h3>
      </div>
      {action && <div className="ml-auto flex flex-none flex-wrap items-center gap-2.5">{action}</div>}
    </header>
  );
}

/** Karten-Fuß: Meta-Zeile (Links, Summen, Hinweise) unter dem Inhalt. */
export function CardFooter({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <footer
      className={`mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3 text-caption text-ink-faint ${className}`.trim()}
    >
      {children}
    </footer>
  );
}
