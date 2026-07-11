"use client";

import { useT, useLocale } from "@/lib/i18n";
import { formatEUR } from "@/lib/format";
import { Card, CardHeader, CardFooter } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { budgetDict } from "../i18n";
import { formatSignedEUR, subtotal, varianceTone, type BudgetRow } from "../derive";

/**
 * Eine Budget-Sektion (Einnahmen ODER Ausgaben): Tabelle mit Plan/Ist/
 * Abweichung je Kategorie plus Zeilen-Aktionen (Plan setzen/bearbeiten,
 * entfernen). Rein präsentational — Schreibzugriffe laufen im Eltern-Screen
 * über die Facade. Die Ampel folgt varianceCents (Plan − Ist), grün ≥ 0.
 */
export function BudgetSection({
  eyebrow,
  title,
  rows,
  onEdit,
  onRemove,
}: {
  eyebrow: string;
  title: string;
  rows: BudgetRow[];
  onEdit: (row: BudgetRow) => void;
  onRemove: (row: BudgetRow) => void;
}) {
  const t = useT(budgetDict);
  const { locale } = useLocale();

  if (rows.length === 0) return null;

  const totals = subtotal(rows);

  const columns: Column<BudgetRow>[] = [
    {
      id: "category",
      header: t("colCategory"),
      cell: (r) => <span className="font-semibold text-ink">{r.categoryName}</span>,
    },
    {
      id: "planned",
      header: t("colPlanned"),
      mono: true,
      cell: (r) =>
        r.hasPlan ? (
          formatEUR(r.plannedCents, locale)
        ) : (
          <span className="font-sans font-semibold text-ink-faint">{t("noPlan")}</span>
        ),
    },
    {
      id: "actual",
      header: t("colActual"),
      mono: true,
      cell: (r) => formatEUR(r.actualCents, locale),
    },
    {
      id: "variance",
      header: t("colVariance"),
      mono: true,
      cell: (r) => (
        <span
          className={
            varianceTone(r.varianceCents) === "success" ? "text-success" : "text-danger"
          }
        >
          {formatSignedEUR(r.varianceCents, locale)}
        </span>
      ),
    },
    {
      id: "actions",
      header: <span className="sr-only">{t("colActions")}</span>,
      align: "right",
      cell: (r) => (
        <span className="inline-flex justify-end gap-1.5">
          <Button
            variant="ghost"
            size="sm"
            icon={r.hasPlan ? "edit" : "plus"}
            onClick={() => onEdit(r)}
          >
            {r.hasPlan ? t("edit") : t("setPlan")}
          </Button>
          {r.hasPlan && (
            <Button
              variant="ghost"
              size="sm"
              aria-label={t("remove")}
              className="text-danger hover:bg-danger-soft"
              onClick={() => onRemove(r)}
            >
              {t("remove")}
            </Button>
          )}
        </span>
      ),
    },
  ];

  return (
    <Card padded={false}>
      <div className="p-5 sm:p-6">
        <CardHeader eyebrow={eyebrow} title={title} />
        <DataTable columns={columns} rows={rows} rowKey={(r) => r.categoryId} caption={title} />
        <CardFooter>
          <span className="font-semibold text-ink-soft">{t("subtotalLabel")}</span>
          <span className="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono tabular-nums text-ink">
            <span>{formatEUR(totals.plannedCents, locale)}</span>
            <span className="text-ink-soft">{formatEUR(totals.actualCents, locale)}</span>
            <span
              className={
                varianceTone(totals.varianceCents) === "success" ? "text-success" : "text-danger"
              }
            >
              {formatSignedEUR(totals.varianceCents, locale)}
            </span>
          </span>
        </CardFooter>
      </div>
    </Card>
  );
}
