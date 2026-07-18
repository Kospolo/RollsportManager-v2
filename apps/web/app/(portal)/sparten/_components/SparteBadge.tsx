import type { Sparte } from "@/lib/types";
import { Icon } from "@/components/shell/icons";
import { DEFAULT_SPARTE_COLOR, safeIcon } from "./options";

/**
 * Kompaktes, wiederverwendbares Sparten-Abzeichen: farbiger Icon-Chip in der
 * Akzentfarbe der Sparte + Name. Wird überall dort benutzt, wo eine Sparte nur
 * ANGEZEIGT wird (Mitglieder-Profil, Team-Kopf, Filter-Legende) — die volle
 * Verwaltungs-Karte bleibt SparteCard. Inaktive Sparten werden gedämpft
 * dargestellt (gestrichelter Rand), damit sie sichtbar abgesetzt sind.
 */

/** #RRGGBB → rgba(...) mit Alpha — für den zarten Chip-Hintergrund. */
function tint(hex: string, alpha: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return `rgba(178, 58, 92, ${alpha})`;
  const int = parseInt(m[1], 16);
  return `rgba(${(int >> 16) & 255}, ${(int >> 8) & 255}, ${int & 255}, ${alpha})`;
}

export function SparteBadge({
  sparte,
  inactiveLabel,
}: {
  sparte: Sparte;
  /** Zusatz-Label für inaktive Sparten (z. B. „Inaktiv"). Weglassen = kein Zusatz. */
  inactiveLabel?: string;
}) {
  const color = sparte.color ?? DEFAULT_SPARTE_COLOR;
  return (
    <span
      className={`inline-flex min-h-8 max-w-full items-center gap-2 rounded-full border py-1 pl-1.5 pr-3 text-[13px] font-semibold text-ink ${
        sparte.active ? "border-line bg-surface" : "border-dashed border-line-strong bg-sunken/60 opacity-80"
      }`}
    >
      <span
        className="grid h-6 w-6 flex-none place-items-center rounded-full"
        style={{ backgroundColor: tint(color, 0.18), color }}
        aria-hidden="true"
      >
        <Icon name={safeIcon(sparte.icon)} className="ic h-3.5 w-3.5" />
      </span>
      <span className="min-w-0 truncate">{sparte.name}</span>
      {!sparte.active && inactiveLabel && (
        <span className="flex-none text-caption font-bold uppercase tracking-wide text-ink-faint">
          {inactiveLabel}
        </span>
      )}
    </span>
  );
}
