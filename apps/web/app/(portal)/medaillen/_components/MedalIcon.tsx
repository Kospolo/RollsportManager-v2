"use client";

import { useId } from "react";
import type { Medal } from "@/lib/types";

/**
 * Dekoratives Medaillen-Symbol mit Trophäen-Optik: Band + metallische Scheibe
 * mit Stern. Gold/Silber/Bronze bekommen eigene Metall-Verläufe (bewusst
 * gesättigt, funktioniert in Light + Dark); `undefined` = Teilnahme ohne
 * Medaille → gedämpfte Scheibe aus Theme-Tokens.
 *
 * Rein visuell (aria-hidden) — die Bedeutung steht immer als Wort daneben
 * (Badge/Label), nie allein über die Farbe (DESIGN-SYSTEM §3.6).
 */

type Metal = { from: string; via: string; to: string; ring: string; star: string };

const METAL: Record<Medal, Metal> = {
  gold: { from: "#FCE9A6", via: "#F1C24C", to: "#B9821B", ring: "#8F6415", star: "#7A5410" },
  silver: { from: "#F3F5F9", via: "#C7CED9", to: "#8A94A3", ring: "#6E7889", star: "#59616F" },
  bronze: { from: "#F2D3B4", via: "#D69A63", to: "#9C5E2E", ring: "#7C4922", star: "#5E3717" },
};

const SIZE: Record<"sm" | "md" | "lg", { w: number; h: number }> = {
  sm: { w: 26, h: 31 },
  md: { w: 34, h: 40 },
  lg: { w: 44, h: 52 },
};

/** 5-zackiger Stern, zentriert um (0,0). */
const STAR =
  "M0 -10 L2.35 -3.24 L9.51 -3.09 L3.8 1.24 L5.88 8.09 L0 4 " +
  "L-5.88 8.09 L-3.8 1.24 L-9.51 -3.09 L-2.35 -3.24 Z";

export function MedalIcon({
  medal,
  size = "md",
  className = "",
}: {
  /** undefined = Teilnahme ohne Medaille (gedämpft) */
  medal?: Medal;
  size?: keyof typeof SIZE;
  className?: string;
}) {
  const gid = useId();
  const { w, h } = SIZE[size];
  const metal = medal ? METAL[medal] : null;

  const discFill = metal ? `url(#${gid})` : "var(--bg-sunken)";
  const ring = metal ? metal.ring : "var(--line-strong)";
  const star = metal ? metal.star : "var(--ink-faint)";
  const ribbon = metal ? metal.via : "var(--line-strong)";

  return (
    <svg
      viewBox="0 0 44 52"
      width={w}
      height={h}
      className={`flex-none ${className}`.trim()}
      aria-hidden="true"
      role="presentation"
    >
      {metal && (
        <defs>
          <radialGradient id={gid} cx="38%" cy="30%" r="80%">
            <stop offset="0%" stopColor={metal.from} />
            <stop offset="55%" stopColor={metal.via} />
            <stop offset="100%" stopColor={metal.to} />
          </radialGradient>
        </defs>
      )}

      {/* Band — zwei Streifen zur Scheibe */}
      <path d="M13 3 L22 22 L18 24 L9 5 Z" fill={ribbon} opacity="0.9" />
      <path d="M31 3 L22 22 L26 24 L35 5 Z" fill={ribbon} opacity="0.7" />

      {/* Scheibe */}
      <circle cx="22" cy="34" r="15" fill={discFill} stroke={ring} strokeWidth="1.5" />
      <circle cx="22" cy="34" r="10.5" fill="none" stroke={ring} strokeWidth="1" opacity="0.55" />

      {/* Stern */}
      <path d={STAR} transform="translate(22 34) scale(0.82)" fill={star} opacity="0.92" />
    </svg>
  );
}
