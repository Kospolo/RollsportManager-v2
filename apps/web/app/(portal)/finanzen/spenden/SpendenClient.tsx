"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { dataSource, errorMessage, fullName, permissions } from "@/lib/data";
import { useData } from "@/lib/data/useData";
import { useT, useLocale } from "@/lib/i18n";
import { formatEUR, formatDateShort } from "@/lib/format";
import type { Donation, Member } from "@/lib/types";
import { Icon } from "@/components/shell/icons";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Button } from "@/components/ui/Button";
import { Card, CardFooter } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { KpiTile } from "@/components/ui/KpiTile";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton, SkeletonCard } from "@/components/ui/Skeleton";
import { spendenDict } from "./i18n";
import { sortDonations, summarizeDonations } from "./derive";
import { DonationSheet } from "./_components/DonationSheet";
import { ReceiptModal } from "./_components/ReceiptModal";

/**
 * Spenden /finanzen/spenden (Seriositätszone) — Liste der Zuwendungen über die
 * Facade (lib/data, mock|api). Lädt gemeinsam: aktuelle Person (clubId + Rechte),
 * Mitglieder (Auflösung verknüpfter Spender) und die Spenden.
 *
 * Rechte SERVERSEITIG (RLS): Spenden verwalten = can_manage_finance. Hier gaten
 * wir nur die Anzeige; im mock-Modus ist immer sichtbar. Beleg-Nr. wird beim
 * Anlegen serverseitig vergeben; ausgestellte Bescheinigungen sind eingefroren.
 */
export function SpendenClient() {
  const t = useT(spendenDict);

  const core = useData(async (repo) => {
    const currentUser = await repo.getCurrentUser();
    const clubId = currentUser.clubId;
    const [members, donations] = await Promise.all([
      repo.getMembers(),
      repo.listDonations(clubId),
    ]);
    return { currentUser, clubId, members, donations };
  });

  if (core.status === "loading") return <SpendenSkeleton />;

  if (core.status === "error") {
    return (
      <div className="mx-auto grid w-full max-w-6xl gap-5">
        <Breadcrumb label={t("back")} current={t("pageTitle")} />
        <EmptyState
          icon="zap"
          title={t("loadErrorTitle")}
          body={errorMessage(core.error) || t("loadErrorBody")}
          action={<Button onClick={core.reload}>{t("retry")}</Button>}
        />
      </div>
    );
  }

  const canManageFinance =
    permissions(core.data.currentUser).canManageFinance || dataSource === "mock";

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

  return (
    <SpendenContent
      clubId={core.data.clubId}
      members={core.data.members}
      donations={core.data.donations}
      onChanged={core.reload}
    />
  );
}

/* ------------------------------------------------------------------ */

function SpendenContent({
  clubId,
  members,
  donations,
  onChanged,
}: {
  clubId: string;
  members: Member[];
  donations: Donation[];
  onChanged: () => void;
}) {
  const t = useT(spendenDict);
  const { locale } = useLocale();

  const [sheetOpen, setSheetOpen] = useState(false);
  const [receiptFor, setReceiptFor] = useState<Donation | null>(null);

  const rows = useMemo(() => sortDonations(donations), [donations]);
  const summary = useMemo(() => summarizeDonations(donations), [donations]);
  const memberName = useMemo(() => {
    const map = new Map<string, string>();
    for (const m of members) map.set(m.id, fullName(m));
    return (id?: string) => (id ? map.get(id) : undefined);
  }, [members]);

  const totallyEmpty = donations.length === 0;

  const columns: Column<Donation>[] = [
    {
      id: "donor",
      header: t("colDonor"),
      cell: (row) => (
        <span className="grid gap-0.5">
          <span className="font-semibold text-ink">{row.donorName}</span>
          <span className="text-caption text-ink-faint">
            {row.memberId ? memberName(row.memberId) ?? t("linkedMember") : t("anonymous")}
          </span>
        </span>
      ),
    },
    {
      id: "date",
      header: t("colDate"),
      cell: (row) => (
        <span className="whitespace-nowrap text-ink-soft">
          {formatDateShort(row.donationDate, locale)}
        </span>
      ),
    },
    {
      id: "receipt",
      header: t("colReceipt"),
      cell: (row) => (
        <span className="font-mono text-mono-table tabular-nums text-ink-soft">
          {row.receiptNumber}
        </span>
      ),
    },
    {
      id: "amount",
      header: t("colAmount"),
      mono: true,
      cell: (row) => formatEUR(row.amountCents, locale),
      footer: formatEUR(summary.totalCents, locale),
    },
    {
      id: "status",
      header: t("colStatus"),
      cell: (row) =>
        row.issuedAt ? (
          <Badge tone="success" icon="check">
            {t("badgeIssued")}
          </Badge>
        ) : (
          <Badge tone="warn">{t("badgeDraft")}</Badge>
        ),
    },
    {
      id: "action",
      header: <span className="sr-only">{t("colAction")}</span>,
      align: "right",
      cell: (row) => (
        <Button variant="ghost" size="sm" onClick={() => setReceiptFor(row)}>
          {t("viewReceipt")}
        </Button>
      ),
    },
  ];

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-5">
      <Breadcrumb label={t("back")} current={t("pageTitle")} />

      <SectionHeader
        level={1}
        eyebrow={t("pageEyebrow")}
        title={t("pageTitle")}
        sub={t("pageSub", { count: summary.count, drafts: summary.draftCount })}
        action={
          <Button icon="plus" onClick={() => setSheetOpen(true)}>
            {t("newDonation")}
          </Button>
        }
      />

      {!totallyEmpty && (
        <div className="grid gap-4 sm:grid-cols-3">
          <KpiTile
            label={t("kpiTotal")}
            value={formatEUR(summary.totalCents, locale)}
            sub={t("kpiTotalSub", { n: summary.count })}
            tone="success"
          />
          <KpiTile
            label={t("kpiIssued")}
            value={String(summary.issuedCount)}
            sub={t("kpiIssuedSub", { n: summary.issuedCount })}
            tone="info"
          />
          <KpiTile
            label={t("kpiDrafts")}
            value={String(summary.draftCount)}
            sub={summary.draftCount > 0 ? t("kpiDraftsSub") : t("kpiDraftsNone")}
            tone={summary.draftCount > 0 ? "warn" : "neutral"}
          />
        </div>
      )}

      {totallyEmpty ? (
        <EmptyState
          icon="sparkle"
          title={t("emptyTitle")}
          body={t("emptyBody")}
          action={
            <Button icon="plus" onClick={() => setSheetOpen(true)}>
              {t("emptyCta")}
            </Button>
          }
        />
      ) : (
        <Card>
          <DataTable<Donation>
            columns={columns}
            rows={rows}
            rowKey={(row) => row.id}
            caption={t("tableCaption")}
          />
          <CardFooter>
            <span>{t("footCount", { n: rows.length })}</span>
            <span>{t("footTotal", { sum: formatEUR(summary.totalCents, locale) })}</span>
          </CardFooter>
        </Card>
      )}

      {sheetOpen && (
        <DonationSheet
          clubId={clubId}
          members={members}
          onClose={() => setSheetOpen(false)}
          onSaved={onChanged}
        />
      )}
      {receiptFor && (
        <ReceiptModal
          donation={receiptFor}
          onClose={() => setReceiptFor(null)}
          onIssued={onChanged}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

/** Brotkrumen zurück zum Finanz-Hub — konsistent mit Kassenbuch/SEPA. */
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

/** Lade-Zustand — spiegelt das fertige Layout (Kopf, KPI-Zeile, Tabelle). */
function SpendenSkeleton() {
  return (
    <div className="mx-auto grid w-full max-w-6xl gap-5" aria-busy="true">
      <Skeleton className="h-4 w-40" />
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="grid gap-2">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-11 w-40" />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="rounded-lg border border-line bg-surface px-5 py-[18px] shadow-card"
          >
            <Skeleton className="h-3.5 w-24" />
            <Skeleton className="mt-3 h-6 w-28" />
            <Skeleton className="mt-2 h-3 w-24" />
          </div>
        ))}
      </div>
      <SkeletonCard lines={6} />
    </div>
  );
}
