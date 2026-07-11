"use client";

import { useT, useLocale } from "@/lib/i18n";
import { formatEUR } from "@/lib/format";
import type { AnnualCategoryRow, AnnualReport } from "@/lib/types";
import { Card, CardHeader } from "@/components/ui/Card";
import { ProgressBar, type ProgressTone } from "@/components/ui/ProgressBar";
import { jahresabschlussDict } from "../i18n";
import { splitCategories } from "../derive";

/**
 * Aufschlüsselung der Einnahmen und Ausgaben nach Kategorie: je Richtung eine
 * Liste aus Kategorie-Name, Balken (Anteil am jeweils größten Betrag) und
 * Mono-Betrag, plus Summenzeile. Einnahmen grüner Balken, Ausgaben roter
 * Balken; die Beträge selbst bleiben tabular-Mono (Ausgaben mit −). Der Report
 * kommt fertig aus der Facade — hier wird nur sortiert und dargestellt.
 */
export function CategoryBreakdownCard({ report }: { report: AnnualReport }) {
  const t = useT(jahresabschlussDict);
  const { income, expense, incomeMax, expenseMax } = splitCategories(report.byCategory);

  return (
    <Card>
      <CardHeader eyebrow={t("catEyebrow")} title={t("catTitle")} />
      <div className="grid gap-8 lg:grid-cols-2">
        <CategoryGroup
          heading={t("catIncomeHead")}
          rows={income}
          max={incomeMax}
          totalCents={report.incomeCents}
          tone="success"
          emptyText={t("catEmptyIncome", { year: report.year })}
        />
        <CategoryGroup
          heading={t("catExpenseHead")}
          rows={expense}
          max={expenseMax}
          totalCents={-report.expenseCents}
          tone="danger"
          emptyText={t("catEmptyExpense", { year: report.year })}
        />
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */

function CategoryGroup({
  heading,
  rows,
  max,
  totalCents,
  tone,
  emptyText,
}: {
  heading: string;
  rows: AnnualCategoryRow[];
  max: number;
  /** Summe der Gruppe, vorzeichenbehaftet (Ausgaben negativ). */
  totalCents: number;
  tone: ProgressTone;
  emptyText: string;
}) {
  const t = useT(jahresabschlussDict);
  const { locale } = useLocale();

  return (
    <section className="grid content-start gap-3">
      <div className="flex items-baseline justify-between gap-3 border-b border-line pb-2">
        <h4 className="font-display text-h3 tracking-[-0.01em] text-ink">{heading}</h4>
        <span className="whitespace-nowrap font-mono text-mono-table font-semibold tabular-nums text-ink">
          {formatEUR(totalCents, locale)}
        </span>
      </div>

      {rows.length === 0 ? (
        <p className="py-2 text-body text-ink-faint">{emptyText}</p>
      ) : (
        <ul className="grid gap-3.5">
          {rows.map((row) => {
            const name = row.categoryName ?? t("catUncategorised");
            const amount = formatEUR(row.amountCents, locale);
            return (
              <li key={row.categoryId ?? name} className="grid gap-1.5">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="truncate text-[14px] font-semibold text-ink">{name}</span>
                  <span className="whitespace-nowrap font-mono text-mono-table tabular-nums text-ink">
                    {amount}
                  </span>
                </div>
                <ProgressBar
                  tone={tone}
                  value={Math.abs(row.amountCents)}
                  max={max}
                  label={t("catBarLabel", { name, amount })}
                />
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
