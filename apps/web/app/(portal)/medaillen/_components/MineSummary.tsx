"use client";

import { useT } from "@/lib/i18n";
import type { Achievement, Medal } from "@/lib/types";
import { MEDAL_ORDER, medaillenDict } from "../i18n";
import { MedalIcon } from "./MedalIcon";

/**
 * Trophäen-Zusammenfassung der eigenen Vitrine: je eine Kachel für Gold,
 * Silber und Bronze mit Medaillen-Symbol und Anzahl. Rein informativ; die
 * Detailkarten stehen darunter.
 */
export function MineSummary({ achievements }: { achievements: Achievement[] }) {
  const t = useT(medaillenDict);
  const countOf = (medal: Medal) => achievements.filter((a) => a.medal === medal).length;

  const LABEL: Record<Medal, string> = {
    gold: t("countGold"),
    silver: t("countSilver"),
    bronze: t("countBronze"),
  };

  return (
    <ul className="grid list-none grid-cols-3 gap-3 sm:max-w-md">
      {MEDAL_ORDER.map((medal) => (
        <li
          key={medal}
          className="flex items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3 shadow-card"
        >
          <MedalIcon medal={medal} size="md" />
          <span className="grid min-w-0">
            <span className="font-display text-[22px] font-extrabold leading-6 tracking-[-0.015em] text-ink tabular-nums">
              {countOf(medal)}
            </span>
            <span className="eyebrow">{LABEL[medal]}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
