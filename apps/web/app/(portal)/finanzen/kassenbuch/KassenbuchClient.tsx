"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { data, errorMessage, ledgerBalanceCents, permissions } from "@/lib/data";
import { useData } from "@/lib/data/useData";
import { useT, useLocale } from "@/lib/i18n";
import { formatEUR } from "@/lib/format";
import type { Invoice, LedgerCategory, LedgerEntry, Member } from "@/lib/types";
import { Icon } from "@/components/shell/icons";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Button } from "@/components/ui/Button";
import { Card, CardFooter } from "@/components/ui/Card";
import { Select } from "@/components/ui/Field";
import { FilterChips } from "@/components/ui/FilterChips";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton, SkeletonCard } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { kassenbuchDict } from "./i18n";
import {
  CATEGORY_ALL,
  CATEGORY_NONE,
  buildLedgerRows,
  filterLedgerRows,
  sumLedgerRows,
  type LedgerFilter,
  type PeriodKey,
} from "./derive";
import { LedgerTable } from "./_components/LedgerTable";
import { BookingSheet } from "./_components/BookingSheet";
import { CategoriesModal } from "./_components/CategoriesModal";
import { ReverseModal } from "./_components/ReverseModal";

/**
 * Kassenbuch /finanzen/kassenbuch (Seriositätszone) — vollwertiges Kassenbuch
 * über die Facade (lib/data, mock|api). Lädt gemeinsam: aktuelle Person (für
 * clubId + Rechte), Mitglieder (Gegenparteien), Rechnungen (verknüpfte
 * Buchungen), Kategorien und das Kassenbuch selbst.
 *
 * Rechte sind SERVERSEITIG (RLS): nur can_manage_finance sieht das Kassenbuch.
 * Hier gaten wir nur die Anzeige — im mock-Modus ist immer sichtbar. GoBD:
 * Buchungen sind append-only, Korrektur ausschließlich per Storno.
 */
export function KassenbuchClient() {
  const t = useT(kassenbuchDict);

  const core = useData(async (repo) => {
    const currentUser = await repo.getCurrentUser();
    const clubId = currentUser.clubId;
    const [members, invoices, categories, ledger] = await Promise.all([
      repo.getMembers(),
      repo.getInvoices(),
      repo.listLedgerCategories(clubId),
      repo.listLedger(clubId),
    ]);
    return { currentUser, clubId, members, invoices, categories, ledger };
  });

  if (core.status === "loading") return <KassenbuchSkeleton />;

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
    permissions(core.data.currentUser).canManageFinance;

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
    <KassenbuchContent
      clubId={core.data.clubId}
      members={core.data.members}
      invoices={core.data.invoices}
      categories={core.data.categories}
      ledger={core.data.ledger}
      onChanged={core.reload}
    />
  );
}

/* ------------------------------------------------------------------ */

function KassenbuchContent({
  clubId,
  members,
  invoices,
  categories,
  ledger,
  onChanged,
}: {
  clubId: string;
  members: Member[];
  invoices: Invoice[];
  categories: LedgerCategory[];
  ledger: LedgerEntry[];
  onChanged: () => void;
}) {
  const t = useT(kassenbuchDict);
  const { locale } = useLocale();
  const { showToast } = useToast();

  const [filter, setFilter] = useState<LedgerFilter>({
    categoryId: CATEGORY_ALL,
    period: "all",
  });
  const [sheetOpen, setSheetOpen] = useState(false);
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [reverseEntry, setReverseEntry] = useState<LedgerEntry | null>(null);

  const allRows = useMemo(() => buildLedgerRows(ledger, members), [ledger, members]);
  const rows = useMemo(() => filterLedgerRows(allRows, filter), [allRows, filter]);
  const sums = useMemo(() => sumLedgerRows(rows), [rows]);
  const balanceCents = useMemo(() => ledgerBalanceCents(ledger), [ledger]);

  const totallyEmpty = ledger.length === 0;
  const resetFilter = () => setFilter({ categoryId: CATEGORY_ALL, period: "all" });

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-5">
      <Breadcrumb label={t("back")} current={t("pageTitle")} />

      <SectionHeader
        level={1}
        eyebrow={t("pageEyebrow")}
        title={t("pageTitle")}
        sub={t("pageSub", { balance: formatEUR(balanceCents, locale), n: ledger.length })}
        action={
          <>
            <Button
              variant="ghost"
              icon="download"
              disabled={totallyEmpty}
              onClick={() =>
                showToast(t("exportToast", { n: ledger.length }), { tone: "success" })
              }
            >
              {t("export")}
            </Button>
            <Button variant="ghost" icon="settings" onClick={() => setCategoriesOpen(true)}>
              {t("manageCategories")}
            </Button>
            <Button icon="plus" onClick={() => setSheetOpen(true)}>
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
            <Button icon="plus" onClick={() => setSheetOpen(true)}>
              {t("emptyCta")}
            </Button>
          }
        />
      ) : (
        <>
          {/* Filter: Kategorie (Dropdown) + Zeitraum (Chips) */}
          <div className="flex flex-wrap items-end gap-x-6 gap-y-4">
            <Select
              className="min-w-[220px]"
              label={t("filterCategory")}
              value={filter.categoryId}
              onChange={(event) =>
                setFilter((current) => ({ ...current, categoryId: event.target.value }))
              }
            >
              <option value={CATEGORY_ALL}>{t("allCategories")}</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name} · {category.kind === "income" ? t("income") : t("expense")}
                </option>
              ))}
              <option value={CATEGORY_NONE}>{t("noCategory")}</option>
            </Select>

            <div className="grid gap-1.5">
              <span className="text-[13px] font-bold text-ink">{t("filterPeriod")}</span>
              <FilterChips<PeriodKey>
                label={t("filterPeriod")}
                value={filter.period}
                onChange={(period) => setFilter((current) => ({ ...current, period }))}
                options={[
                  { value: "all", label: t("periodAll") },
                  { value: "d30", label: t("period30") },
                  { value: "month", label: t("periodMonth") },
                  { value: "year", label: t("periodYear") },
                ]}
              />
            </div>
          </div>

          <Card>
            <LedgerTable
              rows={rows}
              invoices={invoices}
              onReverse={setReverseEntry}
              empty={
                <EmptyState
                  icon="search"
                  title={t("emptyFilterTitle")}
                  body={t("emptyFilterBody")}
                  action={
                    <Button variant="secondary" onClick={resetFilter}>
                      {t("emptyFilterCta")}
                    </Button>
                  }
                />
              }
            />
            <CardFooter>
              {rows.length > 0 ? (
                <span className="flex flex-wrap gap-x-4 gap-y-1">
                  <span>
                    {t("footIncome", { sum: formatEUR(sums.incomeCents, locale) })}
                  </span>
                  <span>
                    {t("footExpense", { sum: formatEUR(sums.expenseCents, locale) })}
                  </span>
                </span>
              ) : (
                <span />
              )}
              <span>{t("footHint")}</span>
            </CardFooter>
          </Card>
        </>
      )}

      {sheetOpen && (
        <BookingSheet
          clubId={clubId}
          categories={categories}
          members={members}
          onClose={() => setSheetOpen(false)}
          onSaved={onChanged}
        />
      )}
      {categoriesOpen && (
        <CategoriesModal
          clubId={clubId}
          categories={categories}
          onClose={() => setCategoriesOpen(false)}
          onCreated={onChanged}
        />
      )}
      {reverseEntry && (
        <ReverseModal
          entry={reverseEntry}
          onClose={() => setReverseEntry(null)}
          onReversed={onChanged}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

/** Brotkrumen zurück zum Finanz-Hub — konsistent mit dem Mitglieder-Detail. */
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

/** Lade-Zustand — spiegelt das fertige Layout (Kopf, Filter, Tabelle). */
function KassenbuchSkeleton() {
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
      <div className="flex flex-wrap gap-4">
        <Skeleton className="h-11 w-56" />
        <Skeleton className="h-9 w-72" />
      </div>
      <SkeletonCard lines={8} />
    </div>
  );
}
