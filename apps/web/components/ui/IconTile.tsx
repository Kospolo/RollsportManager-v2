import { Icon, type IconName } from "@/components/shell/icons";

/**
 * Icon-Kachel für Organisationen & Sammelbuchungen (Jury-Fix §2.3):
 * Stadt, Verband, SEPA-Lauf, Vereinsfest bekommen KEINE Pseudo-Monogramme,
 * sondern eine eckigere Kachel (radius-org = 9 px) mit Icon.
 */

export type IconTileTone = "neutral" | "brand" | "info" | "success" | "warn" | "danger";

const TONE_CLASS: Record<IconTileTone, string> = {
  neutral: "bg-sunken text-ink-soft",
  brand: "bg-brand-soft text-brand-ink",
  info: "bg-info-soft text-info",
  success: "bg-success-soft text-success",
  warn: "bg-warn-soft text-warn",
  danger: "bg-danger-soft text-danger",
};

const SIZE_CLASS = {
  /** 28 px — Tabellenzeilen (Kassenbuch), radius-org */
  s: "h-7 w-7 rounded-org",
  /** 38 px — Listen-Items in Karten */
  m: "h-[38px] w-[38px] rounded-md",
} as const;

const ICON_CLASS = {
  s: "ic h-[15px] w-[15px]",
  m: "ic h-5 w-5",
} as const;

export function IconTile({
  icon,
  tone = "neutral",
  size = "s",
  label,
  className = "",
}: {
  icon: IconName;
  tone?: IconTileTone;
  size?: keyof typeof SIZE_CLASS;
  /** Optionale Beschreibung; ohne Label ist die Kachel dekorativ (aria-hidden) */
  label?: string;
  className?: string;
}) {
  return (
    <span
      className={`grid flex-none place-items-center ${SIZE_CLASS[size]} ${TONE_CLASS[tone]} ${className}`.trim()}
      {...(label ? { role: "img", "aria-label": label } : { "aria-hidden": true })}
    >
      <Icon name={icon} className={ICON_CLASS[size]} />
    </span>
  );
}
