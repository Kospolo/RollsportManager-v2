"use client";

import { useT, useLocale } from "@/lib/i18n";
import { formatEUR } from "@/lib/format";
import type { MemberFeesSummary } from "@/lib/types";
import { Card, CardHeader } from "@/components/ui/Card";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Badge } from "@/components/ui/Badge";
import { beitragskategorienDict } from "../i18n";
import {
  PERIOD_LABEL_KEY,
  hasOnceBucket,
  orderedBuckets,
  recurringCount,
} from "../derive";

type Bucket = MemberFeesSummary["byPeriod"][number];

/**
 * Erwartete-Jahreseinnahmen-Kachel (memberFeesSummary, strikt
 * can_manage_finance). Zeigt die Jahressumme groß in Display-Schrift und eine
 * Aufschlüsselung je Periode (annualisiert: monthly ×12, quarterly ×4, yearly
 * ×1, once ×0). Einmalbeiträge sind bewusst nicht Teil der Jahressumme.
 * Beträge Mono/tabular.
 */
export function RevenueSummaryCard({ summary }: { summary: MemberFeesSummary }) {
  const t = useT(beitragskategorienDict);
  const { locale } = useLocale();
  const buckets = orderedBuckets(summary);

  const columns: Column<Bucket>[] = [
    {
      id: "period",
      header: t("summaryBucketCol"),
      cell: (b) => (
        <span className="inline-flex items-center gap-2">
          <span className="font-semibold text-ink">{t(PERIOD_LABEL_KEY[b.period])}</span>
          {b.period === "once" && <Badge tone="neutral">{t("periodOnce")}</Badge>}
        </span>
      ),
    },
    {
      id: "count",
      header: t("summaryCountCol"),
      align: "right",
      cell: (b) => <span className="tabular-nums text-ink-soft">{b.count}</span>,
    },
    {
      id: "sum",
      header: t("summarySumCol"),
      mono: true,
      cell: (b) => formatEUR(b.amountCents, locale),
    },
    {
      id: "annual",
      header: t("summaryAnnualCol"),
      mono: true,
      cell: (b) =>
        b.period === "once" ? (
          <span className="text-ink-faint">—</span>
        ) : (
          <span className="font-semibold text-ink">{formatEUR(b.annualCents, locale)}</span>
        ),
      footer: formatEUR(summary.totalAnnualCents, locale),
    },
  ];

  return (
    <Card>
      <CardHeader eyebrow={t("summaryEyebrow")} title={t("summaryTitle")} />

      {buckets.length === 0 ? (
        <div className="rounded-lg border border-dashed border-line bg-sunken/40 px-5 py-8 text-center">
          <p className="font-display text-h3 text-ink">{t("summaryEmptyTitle")}</p>
          <p className="mx-auto mt-1 max-w-md text-body text-ink-soft">{t("summaryEmptyBody")}</p>
        </div>
      ) : (
        <div className="grid gap-5">
          <div className="grid gap-1">
            <span className="eyebrow flex items-center gap-2">
              <span aria-hidden="true" className="h-[9px] w-[9px] flex-none rounded-full bg-brand" />
              {t("summaryTotalLabel")}
            </span>
            <span className="font-display text-[34px] font-extrabold leading-none tracking-[-0.02em] text-ink tabular-nums">
              {formatEUR(summary.totalAnnualCents, locale)}
            </span>
            <span className="text-caption text-ink-faint">
              {t("summaryTotalSub", { n: recurringCount(summary) })}
            </span>
          </div>

          <DataTable
            columns={columns}
            rows={buckets}
            rowKey={(b) => b.period}
            caption={t("summaryTitle")}
          />

          {hasOnceBucket(summary) && (
            <p className="text-caption text-ink-faint">{t("summaryOnceHint")}</p>
          )}
        </div>
      )}
    </Card>
  );
}
