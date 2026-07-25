"use client";

import { useState } from "react";
import Link from "next/link";
import { data, errorMessage, isForbidden, permissions } from "@/lib/data";
import { useData } from "@/lib/data/useData";
import { useT, useLocale } from "@/lib/i18n";
import { formatEUR } from "@/lib/format";
import { Icon } from "@/components/shell/icons";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Field";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton, SkeletonCard } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { jahresabschlussDict } from "./i18n";
import { downloadBlob, isReportEmpty, yearOptions } from "./derive";
import { AnnualSummary } from "./_components/AnnualSummary";
import { CategoryBreakdownCard } from "./_components/CategoryBreakdownCard";
import { YearComparisonCard } from "./_components/YearComparisonCard";

/**
 * Jahresabschluss /finanzen/jahresabschluss (Seriositätszone) — Einnahmen/
 * Ausgaben je Kategorie, Netto-Ergebnis, Vorjahresvergleich und offene Posten
 * zum Jahresende, plus echter CSV-/DATEV-Export. Alle Daten über die Facade
 * (lib/data, mock|api): getAnnualReport(clubId, year) + exportLedgerCsv/
 * exportDatev (Bearer-Download).
 *
 * Rechte SERVERSEITIG (RLS): STRIKT can_manage_finance (Mitglied → 403). Hier
 * gaten wir nur die Anzeige; im mock-Modus ist immer sichtbar. Beträge
 * Mono/tabular — Netto negativ (Fehlbetrag) rot.
 */
export function JahresabschlussClient() {
  const t = useT(jahresabschlussDict);
  const core = useData((repo) => repo.getCurrentUser());

  if (core.status === "loading") return <JahresabschlussSkeleton />;

  if (core.status === "error") {
    return (
      <div className="mx-auto grid w-full max-w-6xl gap-5">
        <Breadcrumb label={t("back")} current={t("pageTitle")} />
        <EmptyState
          icon="zap"
          title={t("loadErrorTitle")}
          body={errorMessage(core.error)}
          action={<Button onClick={core.reload}>{t("retry")}</Button>}
        />
      </div>
    );
  }

  const canManageFinance = permissions(core.data).canManageFinance;

  if (!canManageFinance) {
    return (
      <div className="mx-auto grid w-full max-w-6xl gap-5">
        <Breadcrumb label={t("back")} current={t("pageTitle")} />
        <EmptyState
          icon="lock"
          title={t("noAccessTitle")}
          body={t("noAccessBody")}
          ctaHref="/finanzen"
          ctaLabel={t("back")}
        />
      </div>
    );
  }

  return <JahresabschlussContent clubId={core.data.clubId} />;
}

/* ------------------------------------------------------------------ */

function JahresabschlussContent({ clubId }: { clubId: string }) {
  const t = useT(jahresabschlussDict);
  const { locale } = useLocale();
  const { showToast } = useToast();

  const [year, setYear] = useState(() => new Date().getFullYear());
  const [busy, setBusy] = useState<null | "csv" | "datev">(null);

  const report = useData((repo) => repo.getAnnualReport(clubId, year), [clubId, year]);

  async function runExport(kind: "csv" | "datev") {
    setBusy(kind);
    try {
      const file =
        kind === "csv"
          ? await data.exportLedgerCsv(clubId, { from: `${year}-01-01`, to: `${year}-12-31` })
          : await data.exportDatev(clubId, year);
      downloadBlob(file.blob, file.filename);
      showToast(
        t(kind === "csv" ? "exportDoneCsv" : "exportDoneDatev", { year, file: file.filename }),
        { tone: "success" },
      );
    } catch (error) {
      const message = isForbidden(error)
        ? t("exportForbidden")
        : t("exportError", { reason: errorMessage(error) });
      showToast(message, { tone: "danger" });
    } finally {
      setBusy(null);
    }
  }

  const years = yearOptions();

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-5">
      <Breadcrumb label={t("back")} current={t("pageTitle")} />

      <SectionHeader
        level={1}
        eyebrow={t("pageEyebrow")}
        title={t("pageTitle")}
        sub={t("pageSub", { year })}
      />

      {/* Steuerleiste: Geschäftsjahr wählen + echter Datei-Export (nur Finanz) */}
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <Select
          className="min-w-[200px]"
          label={t("yearLabel")}
          value={String(year)}
          onChange={(event) => setYear(Number(event.target.value))}
        >
          {years.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </Select>

        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            variant="ghost"
            icon="download"
            disabled={busy !== null}
            onClick={() => runExport("csv")}
          >
            {busy === "csv" ? t("exporting") : t("exportCsv")}
          </Button>
          <Button
            variant="ghost"
            icon="download"
            disabled={busy !== null}
            onClick={() => runExport("datev")}
          >
            {busy === "datev" ? t("exporting") : t("exportDatev")}
          </Button>
        </div>
      </div>

      {report.status === "loading" ? (
        <SkeletonCard lines={9} />
      ) : report.status === "error" ? (
        <EmptyState
          icon="zap"
          title={t("loadErrorTitle")}
          body={errorMessage(report.error)}
          action={<Button onClick={report.reload}>{t("retry")}</Button>}
        />
      ) : isReportEmpty(report.data) ? (
        <EmptyState
          icon="bank"
          title={t("emptyTitle", { year })}
          body={t("emptyBody")}
          ctaHref="/finanzen/kassenbuch"
          ctaLabel={t("emptyCta")}
        />
      ) : (
        <>
          <AnnualSummary report={report.data} />
          <CategoryBreakdownCard report={report.data} />
          <YearComparisonCard report={report.data} />
          <p className="text-caption text-ink-faint">
            {report.data.openItemsCount > 0 &&
              `${t("openItemsNote", {
                count: report.data.openItemsCount,
                sum: formatEUR(report.data.openItemsTotalCents, locale),
                year,
              })} `}
            {t("gobdNote", { year })}
          </p>
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

/** Brotkrumen zurück zum Finanz-Hub — konsistent mit dem Kassenbuch-Screen. */
function Breadcrumb({ label, current }: { label: string; current: string }) {
  return (
    <nav aria-label={label} className="flex items-center gap-1.5 text-[13px]">
      <Link
        href="/finanzen"
        className="inline-flex min-h-11 items-center font-semibold text-ink-soft no-underline transition-colors duration-150 hover:text-ink hover:underline"
      >
        {label}
      </Link>
      <Icon name="chevronRight" className="ic h-3.5 w-3.5 text-ink-faint" />
      <span aria-current="page" className="font-bold text-ink">
        {current}
      </span>
    </nav>
  );
}

/** Lade-Zustand — spiegelt das fertige Layout (Kopf, Steuerleiste, Karten). */
function JahresabschlussSkeleton() {
  return (
    <div className="mx-auto grid w-full max-w-6xl gap-5" aria-busy="true">
      <Skeleton className="h-4 w-40" />
      <div className="grid gap-2">
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-4 w-72" />
      </div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <Skeleton className="h-11 w-52" />
        <Skeleton className="h-11 w-64" />
      </div>
      <SkeletonCard lines={9} />
    </div>
  );
}
