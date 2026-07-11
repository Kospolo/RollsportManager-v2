"use client";

import { useT, useLocale } from "@/lib/i18n";
import { formatEUR } from "@/lib/format";
import { KpiTile } from "@/components/ui/KpiTile";
import { budgetDict } from "../i18n";
import { formatSignedEUR, type BudgetTotals } from "../derive";

/**
 * KPI-Leiste der Budgetplanung: geplante Einnahmen/Ausgaben (jeweils mit Ist
 * darunter), das geplante Ergebnis (Einnahmen − Ausgaben) und die Abweichung
 * des Ergebnisses (Ist − Plan; positiv = besser als geplant → grün). Alle
 * Beträge über formatEUR — nie hart codiert.
 */
export function BudgetKpis({ totals }: { totals: BudgetTotals }) {
  const t = useT(budgetDict);
  const { locale } = useLocale();

  const deltaTone =
    totals.resultDeltaCents > 0 ? "success" : totals.resultDeltaCents < 0 ? "danger" : "neutral";
  const deltaWord =
    totals.resultDeltaCents > 0
      ? t("kpiDeltaAhead")
      : totals.resultDeltaCents < 0
        ? t("kpiDeltaBehind")
        : t("kpiDeltaEven");

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <KpiTile
        tone="success"
        label={t("kpiPlannedIncome")}
        value={formatEUR(totals.plannedIncomeCents, locale)}
        sub={`${t("kpiActualPrefix")} ${formatEUR(totals.actualIncomeCents, locale)}`}
      />
      <KpiTile
        tone="danger"
        label={t("kpiPlannedExpense")}
        value={formatEUR(totals.plannedExpenseCents, locale)}
        sub={`${t("kpiActualPrefix")} ${formatEUR(totals.actualExpenseCents, locale)}`}
      />
      <KpiTile
        tone="brand"
        label={t("kpiPlannedResult")}
        value={formatEUR(totals.plannedResultCents, locale)}
        sub={`${t("kpiActualPrefix")} ${formatEUR(totals.actualResultCents, locale)}`}
      />
      <KpiTile
        tone={deltaTone === "neutral" ? "neutral" : deltaTone}
        label={t("kpiResultDelta")}
        value={formatSignedEUR(totals.resultDeltaCents, locale)}
        sub={t("kpiResultSub")}
        delta={{ text: deltaWord, tone: deltaTone }}
      />
    </div>
  );
}
