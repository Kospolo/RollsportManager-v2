/**
 * Sparkline als Inline-SVG — z. B. RollArt-Verlauf über mehrere Wettkämpfe.
 * Farbe über currentColor (Standard: text-brand), letzter Wert als Punkt.
 * Der Trend ist der motivierende Wert — die Zahlen gehören zusätzlich
 * als Klartext/Mono daneben.
 */

export function Sparkline({
  values,
  width = 120,
  height = 36,
  strokeWidth = 2,
  label,
  className = "text-brand",
}: {
  values: number[];
  width?: number;
  height?: number;
  strokeWidth?: number;
  /** Bildbeschreibung, z. B. „Wertungsverlauf: 40,55 → 42,80 → 44,10 Punkte“ */
  label?: string;
  className?: string;
}) {
  if (values.length === 0) return null;

  const pad = strokeWidth + 2;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const points = values.map((value, index) => {
    const x =
      values.length === 1
        ? width / 2
        : pad + (index / (values.length - 1)) * (width - pad * 2);
    const y = height - pad - ((value - min) / range) * (height - pad * 2);
    return { x, y };
  });

  const last = points[points.length - 1];

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      className={`inline-block align-middle ${className}`.trim()}
      {...(label ? { role: "img", "aria-label": label } : { "aria-hidden": true })}
    >
      <polyline
        points={points.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" ")}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={last.x} cy={last.y} r={strokeWidth + 1} fill="currentColor" />
    </svg>
  );
}
