"use client";

import { useMemo } from "react";
import { useT, useLocale } from "@/lib/i18n";
import { formatEUR, formatDate } from "@/lib/format";
import type { Invoice, InvoiceStatus, Member } from "@/lib/types";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { KpiTile } from "@/components/ui/KpiTile";
import { Card, CardFooter } from "@/components/ui/Card";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { financeDict, type FinanceKey } from "../i18n";

/**
 * Schlanke Mitglieder-Ansicht der Finanzen (Bugfix): Nicht-Finanz-Rollen sehen
 * NUR ihre eigenen Rechnungen — keine Verwaltungs-Karten (Mahn-Automatik,
 * DATEV-Export, Rechnungslauf, Bankabgleich, offene-Posten-Summe des Vereins).
 *
 * Der echte Schutz bleibt serverseitig: Die RLS liefert einem Mitglied ohnehin
 * nur die EIGENEN Rechnungen. Zusätzlich filtern wir hier defensiv auf
 * `memberId === currentUser.id` und blenden interne Entwürfe aus.
 */

const STATUS_TONE: Record<InvoiceStatus, BadgeTone> = {
  draft: "neutral",
  open: "warn",
  paid: "success",
  cancelled: "neutral",
};

const STATUS_KEY: Record<InvoiceStatus, FinanceKey> = {
  draft: "mineStatusDraft",
  open: "mineStatusOpen",
  paid: "mineStatusPaid",
  cancelled: "mineStatusCancelled",
};

/** Sortierung: offen zuerst (nach Fälligkeit), dann bezahlt, dann storniert. */
const STATUS_ORDER: Record<InvoiceStatus, number> = {
  open: 0,
  draft: 1,
  paid: 2,
  cancelled: 3,
};

export function MemberFinanceView({
  invoices,
  currentUser,
}: {
  invoices: Invoice[];
  currentUser: Member;
}) {
  const t = useT(financeDict);
  const { locale } = useLocale();
  const nowIso = useMemo(() => new Date().toISOString(), []);

  /* Eigene Rechnungen (Entwürfe sind intern und bleiben ausgeblendet). */
  const mine = useMemo(
    () =>
      invoices
        .filter((invoice) => invoice.memberId === currentUser.id && invoice.status !== "draft")
        .sort(
          (a, b) =>
            STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || a.dueAt.localeCompare(b.dueAt),
        ),
    [invoices, currentUser.id],
  );

  const openInvoices = mine.filter((invoice) => invoice.status === "open");
  const paidInvoices = mine.filter((invoice) => invoice.status === "paid");
  const openSumCents = openInvoices.reduce((sum, invoice) => sum + invoice.amountCents, 0);
  const paidSumCents = paidInvoices.reduce((sum, invoice) => sum + invoice.amountCents, 0);

  const columns: Column<Invoice>[] = [
    {
      id: "invoice",
      header: t("colInvoice"),
      cell: (invoice) => (
        <span className="font-mono text-[13px] tabular-nums text-ink">{invoice.number}</span>
      ),
      footer: t("mineFootCount", { n: mine.length }),
    },
    {
      id: "title",
      header: t("mineColTitle"),
      cell: (invoice) => (
        <span className="truncate text-[14px] text-ink">{invoice.title}</span>
      ),
    },
    {
      id: "due",
      header: t("colDue"),
      cell: (invoice) => (
        <span className="whitespace-nowrap text-[13.5px] text-ink-soft">
          {formatDate(invoice.dueAt, locale)}
        </span>
      ),
    },
    {
      id: "status",
      header: t("mineColStatus"),
      cell: (invoice) => <Badge tone={STATUS_TONE[invoice.status]}>{t(STATUS_KEY[invoice.status])}</Badge>,
      footer: t("mineFootOpenLabel"),
    },
    {
      id: "amount",
      header: t("colAmount"),
      mono: true,
      cell: (invoice) => formatEUR(invoice.amountCents, locale),
      footer: formatEUR(openSumCents, locale),
    },
  ];

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-5">
      <SectionHeader
        level={1}
        eyebrow={t("mineEyebrow")}
        title={t("mineTitle")}
        sub={t("mineSub", { date: formatDate(nowIso, locale) })}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <KpiTile
          label={t("mineKpiOpen")}
          value={formatEUR(openSumCents, locale)}
          sub={t("mineKpiOpenSub", { n: openInvoices.length })}
          tone={openInvoices.length > 0 ? "warn" : "neutral"}
        />
        <KpiTile
          label={t("mineKpiPaid")}
          value={formatEUR(paidSumCents, locale)}
          sub={t("mineKpiPaidSub", { n: paidInvoices.length })}
          tone="success"
        />
      </div>

      <Card>
        <DataTable
          columns={columns}
          rows={mine}
          rowKey={(invoice) => invoice.id}
          caption={t("mineCaption")}
          empty={
            <EmptyState icon="check" title={t("mineEmptyTitle")} body={t("mineEmptyBody")} />
          }
        />
        <CardFooter>
          <span>{t("mineNote")}</span>
        </CardFooter>
      </Card>
    </div>
  );
}
