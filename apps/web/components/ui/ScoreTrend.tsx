/**
 * ScoreTrend (DESIGN-SYSTEM §3.9, „RollArt-Verlauf" aus Konzept B):
 * Wertungs-Verlauf über mehrere Wettkämpfe als warme Balken mit Mono-Werten
 * und Delta-Chips (success bei Verbesserung). Der TREND ist der motivierende
 * Wert — nicht die Einzelzahl.
 *
 * A11y: der Balken-Block trägt role="img" + Gesamtbeschreibung; zusätzlich steht
 * jeder Wert als Mono-Klartext direkt an seinem Balken (direct labeling), sodass
 * die Information nie allein an Höhe/Farbe hängt. prefers-reduced-motion killt
 * das Aufwachsen (globals CSS-Regel greift auf transition-[height]).
 */

export type ScorePoint = {
  id: string;
  /** Bereits lokalisiert formatiertes Datum, z. B. „24.01.2026". */
  dateLabel: string;
  /** Gesamtwertung (Punkte). */
  total: number;
  /** Optionaler Platz (1 = Sieg). */
  placement?: number | null;
};

/** Delta als Wort-Chip mit echtem Minus/Plus, immer Farbe + Zahl. */
function delta(curr: number, prev: number): { text: string; tone: "success" | "danger" | "neutral" } {
  const d = Math.round((curr - prev) * 100) / 100;
  if (d > 0) return { text: `+${d.toFixed(2).replace(".", ",")}`, tone: "success" };
  if (d < 0) return { text: `−${Math.abs(d).toFixed(2).replace(".", ",")}`, tone: "danger" };
  return { text: "±0", tone: "neutral" };
}

const DELTA_CLASS: Record<"success" | "danger" | "neutral", string> = {
  success: "bg-success-soft text-success",
  danger: "bg-danger-soft text-danger",
  neutral: "bg-sunken text-ink-soft",
};

export function ScoreTrend({
  points,
  label,
  placeLabel,
  className = "",
}: {
  /** Chronologisch AUFSTEIGEND (ältester zuerst). */
  points: ScorePoint[];
  /** Gesamtbeschreibung für role="img". */
  label: string;
  /** Formatter für den Platz-Chip, z. B. (n) => `Pl. ${n}`. */
  placeLabel?: (n: number) => string;
  className?: string;
}) {
  if (points.length === 0) return null;
  const max = Math.max(...points.map((p) => p.total));
  const min = Math.min(...points.map((p) => p.total));
  // Basislinie etwas unter dem Minimum, damit die Balken sichtbar variieren.
  const floor = Math.max(0, min - (max - min) * 0.6 - 1);
  const span = max - floor || 1;

  return (
    <div
      role="img"
      aria-label={label}
      className={`grid auto-cols-fr grid-flow-col items-end gap-2 sm:gap-3 ${className}`.trim()}
    >
      {points.map((p, i) => {
        const height = 24 + ((p.total - floor) / span) * 108; // 24–132 px
        const d = i > 0 ? delta(p.total, points[i - 1].total) : null;
        return (
          <div key={p.id} className="grid content-end justify-items-center gap-1.5">
            {d ? (
              <span
                className={`rounded-full px-1.5 py-px text-[10.5px] font-bold tabular-nums ${DELTA_CLASS[d.tone]}`}
              >
                {d.text}
              </span>
            ) : (
              <span className="h-[15px]" aria-hidden="true" />
            )}
            <span className="font-mono text-[12.5px] font-bold text-ink tabular-nums">
              {p.total.toFixed(2).replace(".", ",")}
            </span>
            <div
              className="w-full max-w-[46px] rounded-t-md bg-gradient-to-t from-brand/70 to-brand transition-[height] duration-300"
              style={{ height: `${height}px` }}
              aria-hidden="true"
            />
            <span className="text-[11px] font-semibold text-ink-faint tabular-nums">
              {p.dateLabel}
            </span>
            {p.placement != null && placeLabel && (
              <span className="rounded-full bg-sunken px-1.5 py-px text-[10.5px] font-bold text-ink-soft tabular-nums">
                {placeLabel(p.placement)}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
