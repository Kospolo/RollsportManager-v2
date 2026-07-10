import { Card, CardHeader } from "@/components/ui/Card";

/**
 * Einfache horizontale Verteilungs-Balken (CSS, keine Chart-Bibliothek) für
 * die Auswertung. Jede Zeile trägt ihre Zahl als Klartext in Mono — der Balken
 * ist rein visuell (aria-hidden), die Information steht nie nur in der Farbe.
 * Die Breite ist relativ zum größten Wert der Liste skaliert.
 */

export type BarTone = "brand" | "info" | "success" | "warn";

const FILL_CLASS: Record<BarTone, string> = {
  brand: "bg-brand",
  info: "bg-info",
  success: "bg-success",
  warn: "bg-warn",
};

export interface BarDatum {
  key: string;
  label: string;
  value: number;
}

export function BarList({
  eyebrow,
  title,
  data,
  tone = "brand",
  unit,
  emptyLabel,
  ariaTemplate,
  className = "",
}: {
  eyebrow: string;
  title: string;
  data: BarDatum[];
  tone?: BarTone;
  /** Einheit hinter der Zahl in der aria-Beschriftung, z. B. „Mitglieder“ */
  unit: string;
  emptyLabel: string;
  /** Template mit {label} und {value} für die Screenreader-Zeile */
  ariaTemplate: string;
  className?: string;
}) {
  const max = data.reduce((peak, item) => Math.max(peak, item.value), 0);
  const width = (value: number) => (max > 0 ? `${Math.max((value / max) * 100, value > 0 ? 6 : 0)}%` : "0%");

  return (
    <Card className={className}>
      <CardHeader eyebrow={eyebrow} title={title} />
      {data.length === 0 ? (
        <p className="text-body text-ink-soft">{emptyLabel}</p>
      ) : (
        <ul className="grid gap-3.5">
          {data.map((item) => (
            <li
              key={item.key}
              aria-label={ariaTemplate
                .replace("{label}", item.label)
                .replace("{value}", `${item.value} ${unit}`)}
            >
              <div className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 truncate text-[13.5px] font-medium text-ink-soft">
                  {item.label}
                </span>
                <span className="font-mono text-[13.5px] font-semibold tabular-nums text-ink">
                  {item.value}
                </span>
              </div>
              <div
                aria-hidden="true"
                className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-sunken"
              >
                <div
                  className={`h-full rounded-full ${FILL_CLASS[tone]} transition-[width] duration-200`}
                  style={{ width: width(item.value) }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
