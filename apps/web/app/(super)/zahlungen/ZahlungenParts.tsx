"use client";

import type { ReactNode } from "react";
import { useT, type Locale } from "@/lib/i18n";
import { formatDateTime } from "@/lib/format";
import type {
  PlatformPayment,
  PlatformPaymentsResult,
  PlatformSubscriptionSummary,
} from "@/lib/types";
import { KpiTile } from "@/components/ui/KpiTile";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { EmptyState } from "@/components/ui/EmptyState";
import { zahlungenDict, type ZahlungenKey } from "./i18n";

/**
 * Präsentations-Bausteine der Betreiber-Ansicht „Zahlungen": Abo-Kennzahlen,
 * Ereignis-Tabelle, Paging und Detail-Modal. Reine Lesesicht, keine Mutationen.
 * Aus ZahlungenClient.tsx ausgelagert (< 400 Zeilen je Datei).
 */

export type TFunc = (key: ZahlungenKey, params?: Record<string, string | number>) => string;
export type ProviderFilter = "all" | "stripe" | "revenuecat";
export type StatusFilter = "all" | "received" | "processed" | "failed" | "skipped";

const INTL_LOCALE: Record<Locale, string> = { de: "de-DE", en: "en-GB" };

function formatCount(value: number, locale: Locale): string {
  return new Intl.NumberFormat(INTL_LOCALE[locale]).format(value);
}

export function providerLabel(provider: string, t: TFunc): string {
  if (provider === "stripe") return t("pStripe");
  if (provider === "revenuecat") return t("pRevenuecat");
  return provider;
}

export function statusMeta(status: string, t: TFunc): { tone: BadgeTone; label: string } {
  switch (status) {
    case "processed":
      return { tone: "success", label: t("stProcessed") };
    case "failed":
      return { tone: "danger", label: t("stFailed") };
    case "received":
      return { tone: "info", label: t("stReceived") };
    case "skipped":
      return { tone: "neutral", label: t("stSkipped") };
    default:
      return { tone: "neutral", label: status };
  }
}

/* ------------------------------------------------------------------ */

export function SummaryGrid({
  summary,
  locale,
}: {
  summary: PlatformSubscriptionSummary;
  locale: Locale;
}) {
  const t = useT(zahlungenDict);
  const n = (value: number) => formatCount(value, locale);
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <KpiTile label={t("kpiActive")} value={n(summary.active)} tone="success" sub={t("kpiActiveSub")} />
      <KpiTile label={t("kpiTrial")} value={n(summary.trial)} tone="info" sub={t("kpiTrialSub")} />
      <KpiTile
        label={t("kpiPastDue")}
        value={n(summary.pastDue)}
        tone={summary.pastDue > 0 ? "warn" : "neutral"}
        sub={t("kpiPastDueSub")}
      />
      <KpiTile label={t("kpiCanceled")} value={n(summary.canceled)} tone="neutral" sub={t("kpiCanceledSub")} />
      <KpiTile
        label={t("kpiLicensed")}
        value={n(summary.licensedClubs)}
        tone="brand"
        sub={t("kpiLicensedSub")}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */

export function EventsTable({
  rows,
  locale,
  onDetail,
}: {
  rows: PlatformPayment[];
  locale: Locale;
  onDetail: (payment: PlatformPayment) => void;
}) {
  const t = useT(zahlungenDict);

  const columns: Column<PlatformPayment>[] = [
    {
      id: "provider",
      header: t("colProvider"),
      cell: (row) => <Badge tone="neutral">{providerLabel(row.provider, t)}</Badge>,
    },
    {
      id: "event",
      header: t("colEvent"),
      cell: (row) => (
        <span className="grid min-w-0 gap-0.5">
          <span className="truncate font-mono text-[13px] font-semibold text-ink">
            {row.eventType ?? t("notProcessed")}
          </span>
          <span className="truncate font-mono text-[11.5px] text-ink-faint">{row.eventId}</span>
        </span>
      ),
    },
    {
      id: "status",
      header: t("colStatus"),
      cell: (row) => {
        const meta = statusMeta(row.status, t);
        return (
          <span className="grid gap-1">
            <Badge tone={meta.tone}>{meta.label}</Badge>
            {row.error && <span className="text-[11.5px] text-danger">{row.error}</span>}
          </span>
        );
      },
    },
    {
      id: "received",
      header: t("colReceived"),
      cell: (row) => (
        <span className="whitespace-nowrap text-[13px] text-ink-soft tabular-nums">
          {formatDateTime(row.receivedAt, locale)}
        </span>
      ),
    },
    {
      id: "processed",
      header: t("colProcessed"),
      cell: (row) => (
        <span className="whitespace-nowrap text-[13px] text-ink-soft tabular-nums">
          {row.processedAt ? formatDateTime(row.processedAt, locale) : t("notProcessed")}
        </span>
      ),
    },
    {
      id: "detail",
      header: <span className="sr-only">{t("colDetail")}</span>,
      align: "right",
      cell: (row) => (
        <Button
          size="sm"
          variant="ghost"
          icon="chevronRight"
          onClick={() => onDetail(row)}
          aria-label={`${t("detailAction")}: ${row.eventId}`}
        >
          {t("detailAction")}
        </Button>
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={rows}
      rowKey={(row) => row.id}
      caption={t("eventsCaption")}
      empty={<EmptyState icon="bank" title={t("eventsEmpty")} body={t("eventsEmptyBody")} />}
    />
  );
}

/* ------------------------------------------------------------------ */

export function Pagination({
  page,
  count,
  onOffset,
}: {
  page: PlatformPaymentsResult["page"];
  count: number;
  onOffset: (offset: number) => void;
}) {
  const t = useT(zahlungenDict);
  if (page.total <= page.limit) return null;

  const from = page.total === 0 ? 0 : page.offset + 1;
  const to = page.offset + count;
  const hasPrev = page.offset > 0;
  const hasNext = page.offset + page.limit < page.total;

  return (
    <div className="mt-4 flex items-center justify-between gap-3 border-t border-line pt-3">
      <span className="text-caption text-ink-faint tabular-nums">
        {t("pageInfo", { from, to, total: page.total })}
      </span>
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="ghost"
          disabled={!hasPrev}
          onClick={() => onOffset(Math.max(0, page.offset - page.limit))}
        >
          {t("pagePrev")}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={!hasNext}
          onClick={() => onOffset(page.offset + page.limit)}
        >
          {t("pageNext")}
        </Button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-1 border-b border-line py-3 last:border-b-0 sm:grid-cols-[9rem_1fr] sm:items-center sm:gap-4">
      <dt className="eyebrow">{label}</dt>
      <dd className="min-w-0 text-[14px] text-ink">{children}</dd>
    </div>
  );
}

export function EventDetail({
  payment,
  locale,
  onClose,
}: {
  payment: PlatformPayment | null;
  locale: Locale;
  onClose: () => void;
}) {
  const t = useT(zahlungenDict);
  if (!payment) return null;
  const meta = statusMeta(payment.status, t);

  return (
    <Modal
      open={payment !== null}
      onClose={onClose}
      eyebrow={t("detailEyebrow")}
      title={providerLabel(payment.provider, t)}
    >
      <dl className="grid">
        <DetailRow label={t("dProvider")}>{providerLabel(payment.provider, t)}</DetailRow>
        <DetailRow label={t("dEventType")}>
          <span className="font-mono text-[13px]">{payment.eventType ?? t("notProcessed")}</span>
        </DetailRow>
        <DetailRow label={t("dEventId")}>
          <span className="break-all font-mono text-[13px]">{payment.eventId}</span>
        </DetailRow>
        <DetailRow label={t("dStatus")}>
          <Badge tone={meta.tone}>{meta.label}</Badge>
        </DetailRow>
        <DetailRow label={t("dError")}>
          {payment.error ? (
            <span className="text-danger">{payment.error}</span>
          ) : (
            <span className="text-ink-faint">{t("dNoError")}</span>
          )}
        </DetailRow>
        <DetailRow label={t("dReceived")}>
          <span className="tabular-nums">{formatDateTime(payment.receivedAt, locale)}</span>
        </DetailRow>
        <DetailRow label={t("dProcessed")}>
          {payment.processedAt ? (
            <span className="tabular-nums">{formatDateTime(payment.processedAt, locale)}</span>
          ) : (
            <span className="text-ink-faint">{t("dNotProcessed")}</span>
          )}
        </DetailRow>
      </dl>
    </Modal>
  );
}
