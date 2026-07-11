"use client";

import { useState } from "react";
import Link from "next/link";
import { dataSource, errorMessage, permissions } from "@/lib/data";
import { useData } from "@/lib/data/useData";
import { useT } from "@/lib/i18n";
import { Icon } from "@/components/shell/icons";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Select } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton, SkeletonCard } from "@/components/ui/Skeleton";
import { budgetDict } from "./i18n";
import { budgetYears, computeTotals, mergeRows, splitByKind, type BudgetRow } from "./derive";
import { BudgetKpis } from "./_components/BudgetKpis";
import { BudgetSection } from "./_components/BudgetSection";
import { BudgetPlanModal } from "./_components/BudgetPlanModal";
import { ConfirmClearModal } from "./_components/ConfirmClearModal";

/**
 * Budgetplanung /finanzen/budget (Seriositätszone) — Jahres-Plan gegen Ist je
 * Kategorie, komplett über die Facade (lib/data, mock|api).
 *
 * ZWEISTUFIGES Laden: erst die eingeloggte Person (Rechte). Nur mit
 * can_manage_finance werden Bericht + Planzeilen geladen — so löst ein Mitglied
 * NIE den geschützten Budget-Endpoint (403) aus, sondern sieht sauber „Kein
 * Zugriff". Die verbindliche Durchsetzung bleibt serverseitig (RLS + DB-Check).
 */
export function BudgetClient() {
  const t = useT(budgetDict);
  const core = useData((repo) => repo.getCurrentUser());

  if (core.status === "loading") return <PageSkeleton />;

  if (core.status === "error") {
    return (
      <Shell>
        <EmptyState
          icon="zap"
          title={t("loadErrorTitle")}
          body={errorMessage(core.error)}
          action={<Button onClick={core.reload}>{t("retry")}</Button>}
        />
      </Shell>
    );
  }

  const canManageFinance = permissions(core.data).canManageFinance || dataSource === "mock";

  if (!canManageFinance) {
    return (
      <Shell>
        <EmptyState
          icon="lock"
          title={t("noAccessTitle")}
          body={t("noAccessBody")}
          ctaHref="/finanzen"
          ctaLabel={t("back")}
        />
      </Shell>
    );
  }

  return <Content />;
}

/* ------------------------------------------------------------------ */

type ModalState =
  | { kind: "closed" }
  | { kind: "edit"; row: BudgetRow }
  | { kind: "remove"; row: BudgetRow };

function Content() {
  const t = useT(budgetDict);
  const years = budgetYears();
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [modal, setModal] = useState<ModalState>({ kind: "closed" });

  const state = useData(
    async (repo) => {
      const [report, budgets] = await Promise.all([
        repo.getBudgetReport(year),
        repo.listBudgets(year),
      ]);
      return { report, budgets };
    },
    [year],
  );

  const yearSelect = (
    <Select
      label={t("yearLabel")}
      value={String(year)}
      onChange={(event) => setYear(Number(event.target.value))}
    >
      {years.map((y) => (
        <option key={y} value={y}>
          {y}
        </option>
      ))}
    </Select>
  );

  if (state.status === "loading") return <PageSkeleton yearSelect={yearSelect} />;

  if (state.status === "error") {
    return (
      <Shell>
        <SectionHeader
          level={1}
          eyebrow={t("pageEyebrow")}
          title={t("pageTitle")}
          sub={t("pageSub", { year })}
          action={yearSelect}
        />
        <EmptyState
          icon="zap"
          title={t("loadErrorTitle")}
          body={errorMessage(state.error)}
          action={<Button onClick={state.reload}>{t("retry")}</Button>}
        />
      </Shell>
    );
  }

  const rows = mergeRows(state.data.report, state.data.budgets);
  const { income, expense } = splitByKind(rows);
  const totals = computeTotals(rows);

  return (
    <Shell>
      <SectionHeader
        level={1}
        eyebrow={t("pageEyebrow")}
        title={t("pageTitle")}
        sub={t("pageSub", { year })}
        action={yearSelect}
      />

      {rows.length === 0 ? (
        <EmptyState icon="bank" title={t("emptyTitle")} body={t("emptyBody")} />
      ) : (
        <>
          <BudgetKpis totals={totals} />
          <BudgetSection
            eyebrow={t("incomeEyebrow")}
            title={t("incomeTitle")}
            rows={income}
            onEdit={(row) => setModal({ kind: "edit", row })}
            onRemove={(row) => setModal({ kind: "remove", row })}
          />
          <BudgetSection
            eyebrow={t("expenseEyebrow")}
            title={t("expenseTitle")}
            rows={expense}
            onEdit={(row) => setModal({ kind: "edit", row })}
            onRemove={(row) => setModal({ kind: "remove", row })}
          />
          <p className="text-caption text-ink-faint">{t("varianceHint")}</p>
        </>
      )}

      {modal.kind === "edit" && (
        <BudgetPlanModal
          year={year}
          row={modal.row}
          onClose={() => setModal({ kind: "closed" })}
          onSaved={state.reload}
        />
      )}
      {modal.kind === "remove" && (
        <ConfirmClearModal
          row={modal.row}
          onClose={() => setModal({ kind: "closed" })}
          onCleared={state.reload}
        />
      )}
    </Shell>
  );
}

/* ------------------------------------------------------------------ */

/** Gemeinsamer Rahmen mit Brotkrume — in jedem Zustand identisch. */
function Shell({ children }: { children: React.ReactNode }) {
  const t = useT(budgetDict);
  return (
    <div className="mx-auto grid w-full max-w-6xl gap-5">
      <Breadcrumb label={t("back")} current={t("pageTitle")} />
      {children}
    </div>
  );
}

/** Brotkrumen zurück zum Finanz-Hub — konsistent mit den übrigen Unterbereichen. */
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

/** Lade-Zustand — spiegelt Kopf, KPI-Leiste und die beiden Sektionen. */
function PageSkeleton({ yearSelect }: { yearSelect?: React.ReactNode }) {
  const t = useT(budgetDict);
  return (
    <div className="mx-auto grid w-full max-w-6xl gap-5" aria-busy="true">
      <Skeleton className="h-4 w-40" />
      <div className="flex flex-wrap items-end gap-x-5 gap-y-3">
        <div className="grid gap-2">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-4 w-72" />
        </div>
        {yearSelect ? <div className="ml-auto w-28">{yearSelect}</div> : null}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
      </div>
      <SkeletonCard lines={5} />
      <SkeletonCard lines={5} />
      <span className="sr-only">{t("pageTitle")}</span>
    </div>
  );
}
