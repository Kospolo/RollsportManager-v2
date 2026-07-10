"use client";

import Link from "next/link";
import { dataSource, errorMessage, permissions } from "@/lib/data";
import { useData } from "@/lib/data/useData";
import { useT } from "@/lib/i18n";
import type { Id } from "@/lib/types";
import { Icon } from "@/components/shell/icons";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton, SkeletonCard } from "@/components/ui/Skeleton";
import { beitragskategorienDict } from "./i18n";
import { RevenueSummaryCard } from "./_components/RevenueSummaryCard";
import { CategoriesCard } from "./_components/CategoriesCard";
import { DiscountsCard } from "./_components/DiscountsCard";

/**
 * Beitragskategorien /finanzen/beitragskategorien (Seriositätszone) — Beitrags-
 * stammdaten + Familienrabatte + erwartete Jahreseinnahmen, komplett über die
 * Facade (lib/data, mock|api).
 *
 * ZWEISTUFIGES Laden: erst die eingeloggte Person (clubId + Rechte). Nur mit
 * can_manage_finance werden die Beitragsdaten geladen — so löst ein Mitglied
 * NIE den strikt geschützten Summary-Endpoint (403) aus, sondern sieht sauber
 * „Kein Zugriff". Die verbindliche Durchsetzung bleibt serverseitig (RLS).
 */
export function BeitragskategorienClient() {
  const t = useT(beitragskategorienDict);

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

  const canManageFinance =
    permissions(core.data).canManageFinance || dataSource === "mock";

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

  return <Content clubId={core.data.clubId} />;
}

/* ------------------------------------------------------------------ */

function Content({ clubId }: { clubId: Id }) {
  const t = useT(beitragskategorienDict);

  const fin = useData(
    async (repo) => {
      const [categories, discounts, summary] = await Promise.all([
        repo.listMembershipCategories(clubId),
        repo.listFamilyDiscounts(clubId),
        repo.memberFeesSummary(clubId),
      ]);
      return { categories, discounts, summary };
    },
    [clubId],
  );

  if (fin.status === "loading") return <PageSkeleton />;

  if (fin.status === "error") {
    return (
      <Shell>
        <EmptyState
          icon="zap"
          title={t("loadErrorTitle")}
          body={errorMessage(fin.error)}
          action={<Button onClick={fin.reload}>{t("retry")}</Button>}
        />
      </Shell>
    );
  }

  return (
    <Shell>
      <SectionHeader
        level={1}
        eyebrow={t("pageEyebrow")}
        title={t("pageTitle")}
        sub={t("pageSub")}
      />
      <RevenueSummaryCard summary={fin.data.summary} />
      <CategoriesCard clubId={clubId} categories={fin.data.categories} onChanged={fin.reload} />
      <DiscountsCard clubId={clubId} discounts={fin.data.discounts} onChanged={fin.reload} />
    </Shell>
  );
}

/* ------------------------------------------------------------------ */

/** Gemeinsamer Rahmen mit Brotkrume — in jedem Zustand identisch. */
function Shell({ children }: { children: React.ReactNode }) {
  const t = useT(beitragskategorienDict);
  return (
    <div className="mx-auto grid w-full max-w-6xl gap-5">
      <Breadcrumb label={t("back")} current={t("pageTitle")} />
      {children}
    </div>
  );
}

/** Brotkrumen zurück zum Finanz-Hub — konsistent mit dem Kassenbuch. */
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

/** Lade-Zustand — spiegelt Kopf, Summary-Kachel und die beiden Karten. */
function PageSkeleton() {
  return (
    <div className="mx-auto grid w-full max-w-6xl gap-5" aria-busy="true">
      <Skeleton className="h-4 w-40" />
      <div className="grid gap-2">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-80" />
      </div>
      <SkeletonCard lines={5} />
      <SkeletonCard lines={6} />
      <SkeletonCard lines={4} />
    </div>
  );
}
