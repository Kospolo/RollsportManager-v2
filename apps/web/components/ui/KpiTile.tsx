/**
 * KPI-Kachel (Mockup .kpi): Eyebrow-Label mit Farbpunkt, Wert in
 * Display-Schrift (Display-Rounded bleibt KPI-Zahlen vorbehalten),
 * Caption darunter, optionales Delta als Wort-Chip.
 * Beträge vorher mit formatEUR(...) formatieren — nie hart codieren.
 */

export type KpiTone = "neutral" | "brand" | "info" | "success" | "warn" | "danger";

const DOT_CLASS: Record<KpiTone, string> = {
  neutral: "bg-ink-faint",
  brand: "bg-brand",
  info: "bg-info",
  success: "bg-success",
  warn: "bg-warn",
  danger: "bg-danger",
};

const DELTA_CLASS: Record<"success" | "danger" | "neutral", string> = {
  success: "bg-success-soft text-success",
  danger: "bg-danger-soft text-danger",
  neutral: "bg-sunken text-ink-soft",
};

export function KpiTile({
  label,
  value,
  sub,
  tone = "neutral",
  delta,
  className = "",
}: {
  /** Eyebrow-Label, z. B. „Offen gesamt“ */
  label: string;
  /** Fertig formatierter Wert, z. B. formatEUR(sumOpenCents, locale) */
  value: string;
  /** Caption unter dem Wert, z. B. „14 Rechnungen“ */
  sub?: string;
  /** Farbpunkt neben dem Label */
  tone?: KpiTone;
  /** Optionales Delta — immer Farbe + Wort, z. B. { text: "+3,55", tone: "success" } */
  delta?: { text: string; tone: "success" | "danger" | "neutral" };
  className?: string;
}) {
  return (
    <div
      className={`rounded-lg border border-line bg-surface px-5 py-[18px] shadow-card ${className}`.trim()}
    >
      <span className="eyebrow flex items-center gap-2">
        <span aria-hidden="true" className={`h-[9px] w-[9px] flex-none rounded-full ${DOT_CLASS[tone]}`} />
        {label}
      </span>
      <div className="mt-2 font-display text-[24px] font-extrabold leading-7 tracking-[-0.015em] text-ink tabular-nums">
        {value}
      </div>
      {(sub || delta) && (
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          {delta && (
            <span
              className={`inline-flex items-center rounded-full px-2 py-px text-[11.5px] font-bold tabular-nums ${DELTA_CLASS[delta.tone]}`}
            >
              {delta.text}
            </span>
          )}
          {sub && <span className="text-caption text-ink-faint">{sub}</span>}
        </div>
      )}
    </div>
  );
}
