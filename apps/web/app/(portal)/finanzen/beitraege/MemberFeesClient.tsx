"use client";

import { useMemo, useState } from "react";
import { useLocale, useT } from "@/lib/i18n";
import { formatEUR } from "@/lib/format";
import {
  dataSource,
  errorMessage,
  fullName,
  isNotImplemented,
  permissions,
} from "@/lib/data";
import { useData } from "@/lib/data/useData";
import type { Id, Member, MemberFee } from "@/lib/types";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { KpiTile } from "@/components/ui/KpiTile";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { FilterChips, type FilterChipOption } from "@/components/ui/FilterChips";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { SkeletonCard } from "@/components/ui/Skeleton";
import { memberFeesDict } from "./i18n";
import {
  ASSIGNMENT_FILTERS,
  FILTER_KEY,
  SEPA_KEY,
  SEPA_TONE,
  primaryFee,
  sepaStateFor,
  sumAnnualCents,
  type AssignmentFilter,
} from "./derive";
import { AssignFeeSheet } from "./_components/AssignFeeSheet";
import { FamilyDiscountsCard } from "./_components/FamilyDiscountsCard";
import {
  AmountCell,
  BackLink,
  CategoryCell,
  LoadError,
  MemberCell,
  MemberFeesSkeleton,
  Shell,
  ValidCell,
} from "./_components/MemberFeesParts";

/**
 * Mitgliedsbeiträge: lädt Person + Mitglieder über die Facade, gatet die
 * Sichtbarkeit auf can_manage_finance (verbindlich serverseitig via RLS) und
 * übergibt an die eigentliche Tabelle. NotImplemented / Forbidden / Ladefehler
 * werden als ehrlicher Leerzustand behandelt, nie als Absturz.
 */
export function MemberFeesClient() {
  const t = useT(memberFeesDict);

  const core = useData(async (repo) => {
    const [currentUser, members] = await Promise.all([
      repo.getCurrentUser(),
      repo.getMembers(),
    ]);
    return { currentUser, members, clubId: currentUser.clubId };
  });

  if (core.status === "loading") return <MemberFeesSkeleton />;

  if (core.status === "error") {
    return (
      <Shell>
        {isNotImplemented(core.error) ? (
          <EmptyState icon="sparkle" title={t("niTitle")} body={t("niBody")} />
        ) : (
          <EmptyState
            icon="zap"
            title={t("loadErrorTitle")}
            body={errorMessage(core.error)}
            action={<Button onClick={core.reload}>{t("retry")}</Button>}
          />
        )}
      </Shell>
    );
  }

  const canManage =
    permissions(core.data.currentUser).canManageFinance || dataSource === "mock";

  if (!canManage) {
    return (
      <Shell>
        <BackLink label={t("backToFinance")} />
        <EmptyState icon="lock" title={t("forbidden")} body={t("forbiddenBody")} />
      </Shell>
    );
  }

  return <MemberFeesContent clubId={core.data.clubId} members={core.data.members} />;
}

/* ------------------------------------------------------------------ */

interface Row {
  member: Member;
  fee?: MemberFee;
}

/**
 * Beitrags-Tabelle: alle Mitglieder mit ihrer (primären) Zuordnung, KPIs
 * (vereinsweit) und Filter (mit/ohne Zuordnung + Suche). Zuordnen/Ändern läuft
 * optimistisch über ein Overlay (kein Neu-Laden). Der effektive Betrag ist der
 * Basisbeitrag (custom ?? Kategorie) — Familienrabatte greifen erst bei der
 * Rechnungserstellung (siehe FamilyDiscountsCard).
 */
function MemberFeesContent({ clubId, members }: { clubId: Id; members: Member[] }) {
  const t = useT(memberFeesDict);
  const { locale } = useLocale();

  const loaded = useData(
    async (repo) => {
      const [fees, categories, mandates, discounts] = await Promise.all([
        repo.listMemberFees(clubId),
        repo.listMembershipCategories(clubId),
        repo.listSepaMandates(clubId),
        repo.listFamilyDiscounts(clubId),
      ]);
      return { fees, categories, mandates, discounts };
    },
    [clubId],
  );

  /** memberId → Zuordnung, überlagert von optimistischen Änderungen (null = entfernt). */
  const [overlay, setOverlay] = useState<Record<Id, MemberFee | null>>({});
  const [filter, setFilter] = useState<AssignmentFilter>("all");
  const [query, setQuery] = useState("");
  const [sheetMember, setSheetMember] = useState<Member | null>(null);

  const isReady = loaded.status === "ready";
  const activeCategories = useMemo(
    () => (isReady ? loaded.data.categories.filter((c) => c.isActive) : []),
    [isReady, loaded],
  );
  const mandates = isReady ? loaded.data.mandates : [];
  const discounts = isReady ? loaded.data.discounts : [];

  /** Geladene primäre Zuordnung je Mitglied (vor Overlay). */
  const loadedFeeByMember = useMemo(() => {
    const map = new Map<Id, MemberFee>();
    if (!isReady) return map;
    const byMember = new Map<Id, MemberFee[]>();
    for (const fee of loaded.data.fees) {
      const list = byMember.get(fee.memberId) ?? [];
      list.push(fee);
      byMember.set(fee.memberId, list);
    }
    for (const [memberId, list] of byMember) {
      const primary = primaryFee(list);
      if (primary) map.set(memberId, primary);
    }
    return map;
  }, [isReady, loaded]);

  /** Effektive Zuordnung je Mitglied = geladen + Overlay. */
  const feeByMember = useMemo(() => {
    const map = new Map(loadedFeeByMember);
    for (const [memberId, value] of Object.entries(overlay)) {
      if (value === null) map.delete(memberId);
      else map.set(memberId, value);
    }
    return map;
  }, [loadedFeeByMember, overlay]);

  const sortedMembers = useMemo(
    () =>
      [...members].sort(
        (a, b) =>
          a.lastName.localeCompare(b.lastName, "de") ||
          a.firstName.localeCompare(b.firstName, "de"),
      ),
    [members],
  );

  const allRows = useMemo<Row[]>(
    () => sortedMembers.map((member) => ({ member, fee: feeByMember.get(member.id) })),
    [sortedMembers, feeByMember],
  );

  const assignedCount = allRows.filter((r) => r.fee).length;
  const unassignedCount = allRows.length - assignedCount;
  const annualAllCents = sumAnnualCents(feeByMember.values());

  const normalizedQuery = query.trim().toLowerCase();
  const rows = useMemo(
    () =>
      allRows
        .filter((r) =>
          filter === "assigned" ? Boolean(r.fee) : filter === "unassigned" ? !r.fee : true,
        )
        .filter((r) =>
          normalizedQuery ? fullName(r.member).toLowerCase().includes(normalizedQuery) : true,
        ),
    [allRows, filter, normalizedQuery],
  );

  const shownAnnualCents = sumAnnualCents(
    rows.map((r) => r.fee).filter((fee): fee is MemberFee => Boolean(fee)),
  );

  const filterOptions: FilterChipOption<AssignmentFilter>[] = ASSIGNMENT_FILTERS.map((value) => ({
    value,
    label: t(FILTER_KEY[value]),
    count:
      value === "assigned"
        ? assignedCount
        : value === "unassigned"
          ? unassignedCount
          : allRows.length,
  }));

  const columns: Column<Row>[] = [
    {
      id: "member",
      header: t("colMember"),
      cell: (row) => <MemberCell member={row.member} />,
      footer: t("footShown", { shown: rows.length, total: allRows.length }),
    },
    {
      id: "category",
      header: t("colCategory"),
      cell: (row) => <CategoryCell fee={row.fee} />,
      footer: <span className="font-bold text-ink-soft">{t("footVolumeLabel")}</span>,
    },
    {
      id: "amount",
      header: t("colAmount"),
      mono: true,
      cell: (row) => <AmountCell fee={row.fee} />,
      footer: formatEUR(shownAnnualCents, locale),
    },
    {
      id: "valid",
      header: t("colValid"),
      cell: (row) => <ValidCell fee={row.fee} />,
    },
    {
      id: "sepa",
      header: t("colSepa"),
      cell: (row) => {
        const state = sepaStateFor(mandates, row.member.id);
        return <Badge tone={SEPA_TONE[state]}>{t(SEPA_KEY[state])}</Badge>;
      },
    },
    {
      id: "action",
      header: <span className="sr-only">{t("colAction")}</span>,
      align: "right",
      cell: (row) => (
        <Button
          variant={row.fee ? "ghost" : "secondary"}
          size="sm"
          icon={row.fee ? "edit" : "plus"}
          aria-label={t(row.fee ? "editAria" : "assignAria", { name: fullName(row.member) })}
          onClick={() => setSheetMember(row.member)}
        >
          {row.fee ? t("actionEdit") : t("actionAssign")}
        </Button>
      ),
    },
  ];

  const sheetFee = sheetMember ? feeByMember.get(sheetMember.id) : undefined;

  return (
    <Shell>
      <BackLink label={t("backToFinance")} />
      <SectionHeader level={1} title={t("pageTitle")} sub={t("pageSub")} />

      {/* KPI-Zeile (vereinsweit) — reconciliert mit der Tabelle, wenn Filter „Alle" */}
      <div className="grid gap-4 sm:grid-cols-3">
        <KpiTile
          label={t("kpiAssigned")}
          value={isReady ? String(assignedCount) : t("dash")}
          sub={t("kpiAssignedSub", { n: assignedCount, total: allRows.length })}
          tone="success"
        />
        <KpiTile
          label={t("kpiUnassigned")}
          value={isReady ? String(unassignedCount) : t("dash")}
          sub={unassignedCount > 0 ? t("kpiUnassignedSub") : t("kpiUnassignedNone")}
          tone={unassignedCount > 0 ? "warn" : "neutral"}
        />
        <KpiTile
          label={t("kpiVolume")}
          value={isReady ? formatEUR(annualAllCents, locale) : t("dash")}
          sub={t("kpiVolumeSub")}
          tone="brand"
        />
      </div>

      <Card>
        <div className="mb-5 grid gap-4">
          <Input
            label={t("searchLabel")}
            placeholder={t("searchPlaceholder")}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="w-full max-w-xs"
          />
          <FilterChips
            options={filterOptions}
            value={filter}
            onChange={setFilter}
            label={t("filterLabel")}
          />
        </div>

        {loaded.status === "loading" ? (
          <SkeletonCard lines={6} />
        ) : loaded.status === "error" ? (
          <LoadError error={loaded.error} onRetry={loaded.reload} />
        ) : (
          <DataTable
            columns={columns}
            rows={rows}
            rowKey={(row) => row.member.id}
            caption={t("tableCaption")}
            empty={
              <EmptyState
                icon="members"
                title={t("emptyTitle")}
                body={t("emptyBody")}
                action={
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setFilter("all");
                      setQuery("");
                    }}
                  >
                    {t("emptyReset")}
                  </Button>
                }
              />
            }
          />
        )}
      </Card>

      <FamilyDiscountsCard discounts={discounts} />

      {sheetMember && (
        <AssignFeeSheet
          open
          key={sheetMember.id}
          onClose={() => setSheetMember(null)}
          clubId={clubId}
          member={sheetMember}
          categories={activeCategories}
          existingFee={sheetFee}
          onSaved={(fee) => setOverlay((current) => ({ ...current, [fee.memberId]: fee }))}
          onRemoved={(memberId) => setOverlay((current) => ({ ...current, [memberId]: null }))}
        />
      )}
    </Shell>
  );
}
