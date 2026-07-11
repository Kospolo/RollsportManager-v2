"use client";

import { useT, useLocale } from "@/lib/i18n";
import { formatEUR } from "@/lib/format";
import type { AnnualReport } from "@/lib/types";
import { Card } from "@/components/ui/Card";
import { KpiTile } from "@/components/ui/KpiTile";
import { jahresabschlussDict } from "../i18n";
import { amountTone, categoryCount, deltaTone, signedEUR, type SignTone } from "../derive";

/**
 * Kopf des Jahresabschlusses: das Netto-Ergebnis groß (Fehlbetrag rot,
 * Überschuss grün) mit Vorjahres-Delta, darunter eine KPI-Zeile
 * (Einnahmen · Ausgaben · Spenden · offene Posten). Beträge Mono/tabular,
 * vorher mit formatEUR(...) formatiert (echtes Minuszeichen).
 */

const NET_TEXT_CLASS: Record<SignTone, string> = {
  success: "text-success",
  danger: "text-danger",
  neutral: "text-ink",
};

const DOT_CLASS: Record<SignTone, string> = {
  success: "bg-success",
  danger: "bg-danger",
  neutral: "bg-ink-faint",
};

const DELTA_CLASS: Record<SignTone, string> = {
  success: "bg-success-soft text-success",
  danger: "bg-danger-soft text-danger",
  neutral: "bg-sunken text-ink-soft",
};

export function AnnualSummary({ report }: { report: AnnualReport }) {
  const t = useT(jahresabschlussDict);
  const { locale } = useLocale();

  const netTone = amountTone(report.netCents);
  const resultWord =
    report.netCents > 0
      ? t("netSurplus")
      : report.netCents < 0
        ? t("netDeficit")
        : t("netBalanced");
  const netDeltaTone = deltaTone(report.netDeltaCents);

  const incomeCats = categoryCount(report.byCategory, "income");
  const expenseCats = categoryCount(report.byCategory, "expense");

  return (
    <div className="grid gap-4">
      <Card>
        <div className="grid gap-5 sm:grid-cols-[1fr_auto] sm:items-end">
          <div className="grid gap-1.5">
            <span className="eyebrow flex items-center gap-2">
              <span
                aria-hidden="true"
                className={`h-[9px] w-[9px] flex-none rounded-full ${DOT_CLASS[netTone]}`}
              />
              {t("netEyebrow", { year: report.year })}
            </span>
            <span
              className={`font-display text-[40px] font-extrabold leading-none tracking-[-0.02em] tabular-nums ${NET_TEXT_CLASS[netTone]}`}
            >
              {formatEUR(report.netCents, locale)}
            </span>
            <span className="text-caption text-ink-faint">
              <b className="font-semibold text-ink-soft">{resultWord}</b>
              {" · "}
              {t("netFormula", {
                income: formatEUR(report.incomeCents, locale),
                expense: formatEUR(report.expenseCents, locale),
              })}
            </span>
          </div>

          <div className="grid gap-1.5 sm:justify-items-end sm:text-right">
            <span className="eyebrow">{t("netDeltaLabel")}</span>
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[15px] font-bold tabular-nums ${DELTA_CLASS[netDeltaTone]}`}
            >
              {signedEUR(report.netDeltaCents, locale)}
            </span>
            <span className="text-caption text-ink-faint">
              {t("netVsPrev", { year: report.prevYear.year })}
            </span>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiTile
          tone="success"
          label={t("kpiIncome")}
          value={formatEUR(report.incomeCents, locale)}
          sub={t("kpiIncomeSub", { n: incomeCats })}
        />
        <KpiTile
          tone="danger"
          label={t("kpiExpense")}
          value={formatEUR(report.expenseCents, locale)}
          sub={t("kpiExpenseSub", { n: expenseCats })}
        />
        <KpiTile
          tone="info"
          label={t("kpiDonations")}
          value={formatEUR(report.donationsTotalCents, locale)}
          sub={
            report.donationsCount > 0
              ? t("kpiDonationsSub", { n: report.donationsCount })
              : t("kpiDonationsNone")
          }
        />
        <KpiTile
          tone="warn"
          label={t("kpiOpen")}
          value={formatEUR(report.openItemsTotalCents, locale)}
          sub={
            report.openItemsCount > 0
              ? t("kpiOpenSub", { n: report.openItemsCount })
              : t("kpiOpenNone")
          }
        />
      </div>
    </div>
  );
}
