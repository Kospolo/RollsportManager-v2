"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { dataSource, errorMessage, permissions } from "@/lib/data";
import { useData } from "@/lib/data/useData";
import { useT } from "@/lib/i18n";
import type { BankTransaction, Invoice, LedgerCategory, Member } from "@/lib/types";
import { Icon } from "@/components/shell/icons";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Button } from "@/components/ui/Button";
import { Card, CardFooter } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { FilterChips } from "@/components/ui/FilterChips";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton, SkeletonCard } from "@/components/ui/Skeleton";
import { bankabgleichDict } from "./i18n";
import {
  countByStatus,
  filterTransactions,
  matchProgress,
  type BankStatusFilter,
} from "./derive";
import { BankTable } from "./_components/BankTable";
import { MatchSheet } from "./_components/MatchSheet";
import { ManualEntrySheet } from "./_components/ManualEntrySheet";
import { ImportSheet } from "./_components/ImportSheet";
import { IgnoreModal } from "./_components/IgnoreModal";

/**
 * Bankabgleich /finanzen/bankabgleich (Seriositätszone) — Bankumsätze über die
 * Facade (lib/data, mock|api). Lädt gemeinsam: aktuelle Person (clubId +
 * Rechte), Mitglieder (Match-Vorschläge), Rechnungen (Zuordnungsziele),
 * Kassenbuch-Kategorien (optionale Einnahme-Kategorie) und die Umsätze selbst.
 *
 * Rechte SERVERSEITIG (RLS): Bankabgleich = can_manage_finance. Hier gaten wir
 * nur die Anzeige; im mock-Modus ist immer sichtbar. GoBD: Umsätze werden nie
 * gelöscht — nur zugeordnet oder ignoriert.
 */
export function BankReconClient() {
  const t = useT(bankabgleichDict);

  const core = useData(async (repo) => {
    const currentUser = await repo.getCurrentUser();
    const clubId = currentUser.clubId;
    // Rechte VOR den geschützten Umsatz-/Rechnungs-Fetches prüfen: ein Mitglied
    // bekäme sonst 403 (RLS/can_manage_finance) und landete im Lade-Fehler statt
    // in der freundlichen „Kein Zugriff"-Ansicht (wie Spenden/Jahresabschluss).
    const canManage = permissions(currentUser).canManageFinance || dataSource === "mock";
    if (!canManage) {
      return {
        currentUser,
        clubId,
        members: [] as Member[],
        invoices: [] as Invoice[],
        categories: [] as LedgerCategory[],
        transactions: [] as BankTransaction[],
      };
    }
    const [members, invoices, categories, transactions] = await Promise.all([
      repo.getMembers(),
      repo.getInvoices(),
      repo.listLedgerCategories(clubId),
      repo.listBankTransactions(clubId),
    ]);
    return { currentUser, clubId, members, invoices, categories, transactions };
  });

  if (core.status === "loading") return <BankReconSkeleton />;

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
    <BankReconContent
      clubId={core.data.clubId}
      members={core.data.members}
      invoices={core.data.invoices}
      categories={core.data.categories}
      transactions={core.data.transactions}
      onChanged={core.reload}
    />
  );
}

/* ------------------------------------------------------------------ */

function BankReconContent({
  clubId,
  members,
  invoices,
  categories,
  transactions,
  onChanged,
}: {
  clubId: string;
  members: Member[];
  invoices: Invoice[];
  categories: LedgerCategory[];
  transactions: BankTransaction[];
  onChanged: () => void;
}) {
  const t = useT(bankabgleichDict);

  const [status, setStatus] = useState<BankStatusFilter>("all");
  const [manualOpen, setManualOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [matchTarget, setMatchTarget] = useState<BankTransaction | null>(null);
  const [ignoreTarget, setIgnoreTarget] = useState<BankTransaction | null>(null);

  const counts = useMemo(() => countByStatus(transactions), [transactions]);
  const progress = useMemo(() => matchProgress(transactions), [transactions]);
  const rows = useMemo(() => filterTransactions(transactions, status), [transactions, status]);

  const totallyEmpty = transactions.length === 0;

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-5">
      <Breadcrumb label={t("back")} current={t("pageTitle")} />

      <SectionHeader
        level={1}
        eyebrow={t("pageEyebrow")}
        title={t("pageTitle")}
        sub={t("pageSub", {
          done: progress.matched,
          total: progress.total,
          ignored: progress.ignored,
        })}
        action={
          <>
            <Button variant="ghost" icon="download" onClick={() => setImportOpen(true)}>
              {t("import")}
            </Button>
            <Button icon="plus" onClick={() => setManualOpen(true)}>
              {t("addEntry")}
            </Button>
          </>
        }
      />

      {totallyEmpty ? (
        <EmptyState
          icon="bank"
          title={t("emptyTitle")}
          body={t("emptyBody")}
          action={
            <div className="flex flex-wrap justify-center gap-2.5">
              <Button variant="secondary" icon="download" onClick={() => setImportOpen(true)}>
                {t("emptyCtaImport")}
              </Button>
              <Button icon="plus" onClick={() => setManualOpen(true)}>
                {t("emptyCtaAdd")}
              </Button>
            </div>
          }
        />
      ) : (
        <>
          <ProgressCard progress={progress} />

          <div className="grid gap-1.5">
            <span className="text-[13px] font-bold text-ink">{t("filterStatus")}</span>
            <FilterChips<BankStatusFilter>
              label={t("filterStatus")}
              value={status}
              onChange={setStatus}
              options={[
                { value: "all", label: t("statusAll"), count: counts.all },
                { value: "unmatched", label: t("statusUnmatched"), count: counts.unmatched },
                { value: "matched", label: t("statusMatched"), count: counts.matched },
                { value: "ignored", label: t("statusIgnored"), count: counts.ignored },
              ]}
            />
          </div>

          <Card padded={false} className="p-5 sm:p-6">
            <BankTable
              transactions={rows}
              invoices={invoices}
              onMatch={setMatchTarget}
              onIgnore={setIgnoreTarget}
              empty={
                <EmptyState
                  icon="search"
                  title={t("emptyFilterTitle")}
                  body={t("emptyFilterBody")}
                  action={
                    <Button variant="secondary" onClick={() => setStatus("all")}>
                      {t("emptyFilterCta")}
                    </Button>
                  }
                />
              }
            />
            <CardFooter>
              <span>{t("footCount", { n: rows.length })}</span>
              <span>{t("footHint")}</span>
            </CardFooter>
          </Card>
        </>
      )}

      {manualOpen && (
        <ManualEntrySheet
          clubId={clubId}
          onClose={() => setManualOpen(false)}
          onSaved={onChanged}
        />
      )}
      {importOpen && (
        <ImportSheet clubId={clubId} onClose={() => setImportOpen(false)} onImported={onChanged} />
      )}
      {matchTarget && (
        <MatchSheet
          transaction={matchTarget}
          invoices={invoices}
          members={members}
          categories={categories}
          onClose={() => setMatchTarget(null)}
          onMatched={onChanged}
        />
      )}
      {ignoreTarget && (
        <IgnoreModal
          transaction={ignoreTarget}
          onClose={() => setIgnoreTarget(null)}
          onIgnored={onChanged}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

/** Fortschritts-Karte „X von Y zugeordnet" + Balken + Offen/Ignoriert-Chips. */
function ProgressCard({
  progress,
}: {
  progress: { matched: number; unmatched: number; ignored: number; total: number };
}) {
  const t = useT(bankabgleichDict);
  const allDone = progress.total > 0 && progress.unmatched === 0;

  return (
    <Card>
      <span className="eyebrow">{t("progressEyebrow")}</span>
      <div className="mt-1 flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
        <span className="font-display text-[24px] font-extrabold tracking-[-0.015em] tabular-nums text-ink">
          {t("progressHeadline", { done: progress.matched, total: progress.total })}
        </span>
        <span className="text-[13px] text-ink-faint">{t("progressCaption")}</span>
      </div>
      <ProgressBar
        value={progress.matched}
        max={Math.max(1, progress.total)}
        tone="success"
        label={t("progressBarLabel", { done: progress.matched, total: progress.total })}
        className="mt-3"
      />
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {allDone ? (
          <Badge tone="success" icon="check">
            {t("progressAllDone")}
          </Badge>
        ) : (
          <Badge tone="warn">{t("progressPending", { n: progress.unmatched })}</Badge>
        )}
        {progress.ignored > 0 && (
          <Badge tone="neutral">{t("progressIgnored", { n: progress.ignored })}</Badge>
        )}
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */

/** Brotkrumen zurück zum Finanz-Hub — konsistent mit dem Kassenbuch/SEPA. */
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

/** Lade-Zustand — spiegelt das fertige Layout (Kopf, Fortschritt, Filter, Tabelle). */
function BankReconSkeleton() {
  return (
    <div className="mx-auto grid w-full max-w-6xl gap-5" aria-busy="true">
      <Skeleton className="h-4 w-40" />
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="grid gap-2">
          <Skeleton className="h-7 w-56" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="h-11 w-40" />
      </div>
      <SkeletonCard lines={3} />
      <Skeleton className="h-9 w-80" />
      <SkeletonCard lines={7} />
    </div>
  );
}
