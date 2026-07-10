"use client";

import { useT } from "@/lib/i18n";
import { uebungenDict } from "../i18n";

/**
 * Schwierigkeits-Anzeige 1..5 als gefüllte/leere Punkte. Rein visuell (die
 * fünf Punkte sind aria-hidden), die Bedeutung liefert ein einzelnes Label
 * „Schwierigkeit {n} von 5" für Screenreader.
 */
export function DifficultyDots({
  value,
  className = "",
}: {
  value: number | undefined;
  className?: string;
}) {
  const t = useT(uebungenDict);
  const level = value ? Math.min(5, Math.max(1, Math.round(value))) : 0;
  const label = level > 0 ? t("difficultyValue", { n: level }) : t("difficultyNone");

  return (
    <span
      className={`inline-flex items-center gap-1 ${className}`.trim()}
      role="img"
      aria-label={label}
      title={label}
    >
      {[1, 2, 3, 4, 5].map((step) => (
        <span
          key={step}
          aria-hidden="true"
          className={`h-2 w-2 rounded-full ${step <= level ? "bg-brand" : "bg-line-strong"}`}
        />
      ))}
    </span>
  );
}
