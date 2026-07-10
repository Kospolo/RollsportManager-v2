"use client";

import { useT, useLocale } from "@/lib/i18n";
import { formatEUR } from "@/lib/format";
import type { FamilyDiscount } from "@/lib/types";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { memberFeesDict } from "../i18n";

/**
 * Informations-Karte zu den hinterlegten Familien-/Geschwisterrabatten
 * (Stammdaten). WICHTIG: Die Rabatte werden hier NICHT auf die effektiven
 * Beiträge der Tabelle gerechnet — ihre tatsächliche Anwendung passiert bei
 * der Rechnungserstellung (Backend, in Vorbereitung). Die Karte macht die
 * Regeln nur transparent; ohne aktive Regel rendert sie nichts.
 */
export function FamilyDiscountsCard({ discounts }: { discounts: FamilyDiscount[] }) {
  const t = useT(memberFeesDict);
  const { locale } = useLocale();

  if (discounts.length === 0) return null;

  return (
    <Card>
      <div className="mb-3 grid gap-0.5">
        <span className="eyebrow">{t("discountsEyebrow")}</span>
        <h2 className="font-display text-h3 tracking-[-0.01em] text-ink">{t("discountsTitle")}</h2>
      </div>

      <ul className="grid gap-2.5">
        {discounts.map((d) => (
          <li
            key={d.id}
            className="flex flex-wrap items-center gap-2 rounded-md bg-sunken px-3.5 py-2.5"
          >
            <span className="font-semibold text-ink">{d.label}</span>
            <span className="font-mono text-mono-table tabular-nums text-ink-soft">
              {d.kind === "percent"
                ? t("discountPercent", { value: d.valueNumeric })
                : t("discountFixed", { amount: formatEUR(d.valueNumeric, locale) })}
            </span>
            <Badge tone="info">{t("discountFromChild", { n: d.appliesFromChild })}</Badge>
            {!d.isActive && <Badge tone="neutral">{t("discountInactive")}</Badge>}
          </li>
        ))}
      </ul>

      <p className="mt-3 text-caption text-ink-faint">{t("discountsNote")}</p>
    </Card>
  );
}
