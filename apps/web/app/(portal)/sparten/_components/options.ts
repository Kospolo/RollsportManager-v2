import type { IconName } from "@/components/shell/icons";

/**
 * Kuratiertes Icon-Angebot für Sparten — eine sinnvolle Teilmenge der
 * Shell-IconNames (Disziplinen/Bereiche). Die Auswahl deckt die typischen
 * Rollsport-/Eissport-Sparten ab, ohne den Nutzer mit UI-Glyphen (chevron,
 * close …) zu überfordern.
 */
export const SPARTE_ICONS: readonly IconName[] = [
  "routines",
  "competition",
  "teams",
  "events",
  "sparkle",
  "zap",
  "globe",
  "play",
  "shield",
  "members",
  "clock",
  "dashboard",
];

/** Standard-Icon, wenn (noch) keins gewählt ist. */
export const DEFAULT_SPARTE_ICON: IconName = "sparkle";

/**
 * Feste Farbpalette (Hex, funktioniert in Light + Dark gleich). Abgeleitet aus
 * den Marken-/Avatar-Tokens (DESIGN-SYSTEM) — als Hex gespeichert, damit die
 * Sparte in beiden Themes dieselbe Akzentfarbe trägt.
 */
export const SPARTE_COLORS: readonly string[] = [
  "#B23A5C", // Berry (Marke)
  "#C25B3F", // Koralle
  "#B4741C", // Honig
  "#4C8555", // Moos
  "#3E7D83", // Petrol
  "#8A4E9C", // Pflaume
  "#2F6B72", // Info-Tiefe
  "#BC3D30", // Rot
];

/** Standard-Farbe, wenn (noch) keine gewählt ist. */
export const DEFAULT_SPARTE_COLOR = SPARTE_COLORS[0];

const ICON_SET = new Set<string>(SPARTE_ICONS);

/**
 * Sicheres Auflösen des gespeicherten Icon-Strings auf einen bekannten
 * IconName — ein unbekannter oder leerer Wert fällt auf das Standard-Icon
 * zurück (nie ein Render-Crash bei Alt-/Fremddaten).
 */
export function safeIcon(icon: string | undefined | null): IconName {
  return icon && ICON_SET.has(icon) ? (icon as IconName) : DEFAULT_SPARTE_ICON;
}
