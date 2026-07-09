import type { ReactNode } from "react";

/**
 * Regel-Zeitleiste (DESIGN-SYSTEM §3.7, Mahn-Automatik aus A):
 * Schritte als Kacheln mit Mono-Tag-Offset („+7 Tage“), Titel und
 * Status-Chip (z. B. „automatisch“ vs. „nur mit manueller Freigabe“).
 * Jede Automatik zeigt ihre Regeln und ihren Freigabepunkt im UI.
 */

export type TimelineStep = {
  id: string;
  /** Mono-Offset, z. B. „+7 Tage“ / „+7 days“ */
  day: string;
  title: string;
  /** Status-Chip — Farbe + Wort, z. B. <Badge tone="success" icon="zap">automatisch</Badge> */
  chip?: ReactNode;
};

export function Timeline({
  steps,
  className = "",
}: {
  steps: TimelineStep[];
  className?: string;
}) {
  return (
    <ol className={`grid list-none gap-3 sm:grid-cols-2 lg:grid-cols-4 ${className}`.trim()}>
      {steps.map((step) => (
        <li
          key={step.id}
          className="grid content-start gap-2 rounded-lg border border-line bg-canvas p-4"
        >
          <span className="justify-self-start rounded-sm bg-sunken px-2 py-0.5 font-mono text-[12.5px] font-bold text-ink-soft tabular-nums">
            {step.day}
          </span>
          <span className="text-[13.5px] font-bold leading-snug text-ink">{step.title}</span>
          {step.chip && <span className="justify-self-start">{step.chip}</span>}
        </li>
      ))}
    </ol>
  );
}
