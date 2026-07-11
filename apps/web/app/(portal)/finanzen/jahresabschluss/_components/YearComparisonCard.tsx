"use client";

import { useT, useLocale } from "@/lib/i18n";
import { formatEUR } from "@/lib/format";
import type { AnnualReport } from "@/lib/types";
import { Card, CardHeader } from "@/components/ui/Card";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { jahresabschlussDict } from "../i18n";
import { deltaTone, signedEUR, type SignTone } from "../derive";

/**
 * Vorjahresvergleich: Einnahmen, Ausgaben und Netto-Ergebnis nebeneinander für
 * Vorjahr und aktuelles Jahr, plus Delta. Bewertung aus Sicht der Kasse — mehr
 * Einnahmen/Netto grün, mehr Ausgaben rot. Beträge Mono/tabular; die Report-
 * Zahlen kommen fertig aus der Facade (prevYear + netDeltaCents).
 */

const DELTA_TEXT_CLASS: Record<SignTone, string> = {
  success: "text-success",
  danger: "text-danger",
  neutral: "text-ink-soft",
};

interface CmpRow {
  id: string;
  label: string;
  prevCents: number;
  currentCents: number;
  deltaCents: number;
  tone: SignTone;
}

export function YearComparisonCard({ report }: { report: AnnualReport }) {
  const t = useT(jahresabschlussDict);
  const { locale } = useLocale();
  const { prevYear } = report;

  const rows: CmpRow[] = [
    {
      id: "income",
      label: t("cmpIncome"),
      prevCents: prevYear.incomeCents,
      currentCents: report.incomeCents,
      deltaCents: report.incomeCents - prevYear.incomeCents,
      tone: deltaTone(report.incomeCents - prevYear.incomeCents, true),
    },
    {
      id: "expense",
      label: t("cmpExpense"),
      prevCents: prevYear.expenseCents,
      currentCents: report.expenseCents,
      deltaCents: report.expenseCents - prevYear.expenseCents,
      // Mehr Ausgaben ist schlecht → higherIsBetter=false.
      tone: deltaTone(report.expenseCents - prevYear.expenseCents, false),
    },
    {
      id: "net",
      label: t("cmpNet"),
      prevCents: prevYear.netCents,
      currentCents: report.netCents,
      deltaCents: report.netDeltaCents,
      tone: deltaTone(report.netDeltaCents, true),
    },
  ];

  const columns: Column<CmpRow>[] = [
    {
      id: "metric",
      header: t("cmpColMetric"),
      cell: (row) => <span className="font-semibold text-ink">{row.label}</span>,
    },
    {
      id: "prev",
      header: String(prevYear.year),
      mono: true,
      cell: (row) => <span className="text-ink-soft">{formatEUR(row.prevCents, locale)}</span>,
    },
    {
      id: "current",
      header: String(report.year),
      mono: true,
      cell: (row) => formatEUR(row.currentCents, locale),
    },
    {
      id: "delta",
      header: t("cmpColDelta"),
      mono: true,
      cell: (row) => (
        <span className={`font-semibold ${DELTA_TEXT_CLASS[row.tone]}`}>
          {signedEUR(row.deltaCents, locale)}
        </span>
      ),
    },
  ];

  return (
    <Card>
      <CardHeader
        eyebrow={t("cmpEyebrow")}
        title={t("cmpTitle", { year: report.year, prev: prevYear.year })}
      />
      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(row) => row.id}
        caption={t("cmpCaption")}
      />
    </Card>
  );
}
