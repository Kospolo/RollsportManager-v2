"use client";

import type { ReactNode } from "react";
import { useT, type Dict } from "@/lib/i18n";
import { Icon, type IconName } from "@/components/shell/icons";
import type { DunningLevel } from "@/lib/types";

/**
 * Chip-System (DESIGN-SYSTEM §3.6): Tint-Hintergrund + dunkler Ton +
 * IMMER ein Wort (Status nie nur über Farbe).
 * `honey` ist EXKLUSIV für den Musik-/Küren-Kontext reserviert.
 */

export type BadgeTone =
  | "neutral"
  | "brand"
  | "info"
  | "success"
  | "warn"
  | "danger"
  | "honey";

const TONE_CLASS: Record<BadgeTone, string> = {
  neutral: "bg-sunken text-ink-soft",
  brand: "bg-brand-soft text-brand-ink",
  info: "bg-info-soft text-info",
  success: "bg-success-soft text-success",
  warn: "bg-warn-soft text-warn",
  danger: "bg-danger-soft text-danger",
  honey: "bg-honey-soft text-honey-deep", // NUR Musik/Küren!
};

export function Badge({
  tone = "neutral",
  icon,
  children,
  className = "",
}: {
  tone?: BadgeTone;
  icon?: IconName;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-[3px] text-[12px] font-bold ${TONE_CLASS[tone]} ${className}`.trim()}
    >
      {icon && <Icon name={icon} className="ic h-[13px] w-[13px]" />}
      {children}
    </span>
  );
}

/** Alias — im Design-System heißen dieselben Pillen auch StatusPill. */
export const StatusPill = Badge;

/* ------------------------------------------------------------------
   Mahnstufen-Ampel: vierstufige Treppe, jede Stufe eigener Farbton.
   Neutral → Info (Erinnerung, Petrol — NICHT Honig) → Warn → Danger.
   ------------------------------------------------------------------ */

const dunningDict = {
  de: {
    level0: "Offen",
    level1: "Erinnerung",
    level2: "1. Mahnung",
    level3: "2. Mahnung",
  },
  en: {
    level0: "Open",
    level1: "Reminder",
    level2: "1st dunning",
    level3: "2nd dunning",
  },
} satisfies Dict;

export const DUNNING_TONE: Record<DunningLevel, BadgeTone> = {
  0: "neutral",
  1: "info",
  2: "warn",
  3: "danger",
};

export function DunningBadge({ level, className = "" }: { level: DunningLevel; className?: string }) {
  const t = useT(dunningDict);
  const key = `level${level}` as keyof (typeof dunningDict)["de"];
  return (
    <Badge tone={DUNNING_TONE[level]} className={className}>
      {t(key)}
    </Badge>
  );
}
