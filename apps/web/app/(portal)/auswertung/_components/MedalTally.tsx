"use client";

import { Card, CardHeader } from "@/components/ui/Card";
import { useT } from "@/lib/i18n";
import type { ReportMedalCounts } from "@/lib/types";
import { auswertungDict, type AuswertungKey } from "../i18n";

/**
 * Medaillenspiegel des Vereins als KPI-artige Stat-Zellen: metallische Scheibe
 * (Gold/Silber/Bronze — gesättigte Verläufe, funktionieren in Light + Dark)
 * mit großer Mono-Zahl. Rein lesend; die Farbe steht nie allein, jede Zelle
 * trägt ihr Wort als Label.
 */

type Metal = { key: "gold" | "silver" | "bronze"; labelKey: AuswertungKey; from: string; to: string; ring: string };

const METALS: Metal[] = [
  { key: "gold", labelKey: "medalGold", from: "#FCE9A6", to: "#B9821B", ring: "#8F6415" },
  { key: "silver", labelKey: "medalSilver", from: "#F3F5F9", to: "#8A94A3", ring: "#6E7889" },
  { key: "bronze", labelKey: "medalBronze", from: "#F2D3B4", to: "#9C5E2E", ring: "#7C4922" },
];

export function MedalTally({ medals, className = "" }: { medals: ReportMedalCounts; className?: string }) {
  const t = useT(auswertungDict);
  const total = medals.gold + medals.silver + medals.bronze;

  return (
    <Card className={className}>
      <CardHeader eyebrow={t("medalEyebrow")} title={t("medalTitle")} />
      {total === 0 ? (
        <p className="text-body text-ink-soft">{t("medalEmpty")}</p>
      ) : (
        <div className="grid grid-cols-3 gap-3">
          {METALS.map((metal) => (
            <div
              key={metal.key}
              className="grid place-items-center gap-2 rounded-lg border border-line bg-canvas px-2 py-4 text-center"
            >
              <span
                aria-hidden="true"
                className="h-9 w-9 rounded-full"
                style={{
                  background: `radial-gradient(circle at 36% 30%, ${metal.from}, ${metal.to})`,
                  boxShadow: `inset 0 0 0 1.5px ${metal.ring}`,
                }}
              />
              <span className="font-mono text-[22px] font-extrabold leading-none tabular-nums text-ink">
                {medals[metal.key]}
              </span>
              <span className="eyebrow">{t(metal.labelKey)}</span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
