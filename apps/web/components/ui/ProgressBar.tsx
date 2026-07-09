/**
 * Fortschrittsbalken (Mockup .recon-bar, z. B. Bankabgleich):
 * 8 px, Pill-Form, Sunken-Mulde. Der Balken ist visuell — die Zahl
 * gehört zusätzlich als Klartext daneben („31 von 34“).
 */

export type ProgressTone = "success" | "brand" | "info" | "warn" | "danger";

const TONE_CLASS: Record<ProgressTone, string> = {
  success: "bg-success",
  brand: "bg-brand",
  info: "bg-info",
  warn: "bg-warn",
  danger: "bg-danger",
};

export function ProgressBar({
  value,
  max = 100,
  tone = "success",
  label,
  className = "",
}: {
  value: number;
  max?: number;
  tone?: ProgressTone;
  /** Pflicht-Beschreibung, z. B. „31 von 34 Umsätzen automatisch zugeordnet“ */
  label: string;
  className?: string;
}) {
  const percent = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  return (
    <div
      role="img"
      aria-label={label}
      className={`h-2 w-full overflow-hidden rounded-full bg-sunken ${className}`.trim()}
    >
      <div
        className={`h-full rounded-full ${TONE_CLASS[tone]} transition-[width] duration-150`}
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}
