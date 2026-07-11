"use client";

import { AvatarStack } from "@/components/ui/AvatarStack";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { errorMessage, isNotImplemented } from "@/lib/data";
import type { DataState } from "@/lib/data/useData";
import { useLocale, useT } from "@/lib/i18n";
import type { CompetitionStandingRow, CompetitionStandings } from "@/lib/types";
import { formatScore, formatScoreDelta, groupStandingsByCategory } from "../derive";
import { wettkampfDict } from "../i18n";

type StandingsState = DataState<CompetitionStandings | null> & { reload: () => void };

/**
 * Live-Rangliste über die Facade (`getCompetitionStandings`) — je Kategorie
 * gruppiert (Gruppen-Header) mit Rang, RollArt-Wertung und Delta-Chip (▲▼=)
 * zur Vorwertung derselben Kür. Lesen = is_club_member (Trainer + Mitglieder).
 */
export function LiveStandings({ state }: { state: StandingsState }) {
  const t = useT(wettkampfDict);

  if (state.status === "loading") {
    return (
      <Card padded={false} className="p-5 sm:p-6">
        <CardHeader title={t("standingsTitle")} />
        <div aria-hidden="true" className="grid gap-2.5">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-lg" />
          ))}
        </div>
      </Card>
    );
  }

  if (state.status === "error") {
    return (
      <Card>
        <CardHeader title={t("standingsTitle")} />
        <EmptyState
          icon={isNotImplemented(state.error) ? "sparkle" : "zap"}
          title={isNotImplemented(state.error) ? t("notConnectedTitle") : t("standingsErrorTitle")}
          body={isNotImplemented(state.error) ? t("notConnectedBody") : errorMessage(state.error)}
          action={
            isNotImplemented(state.error) ? undefined : (
              <Button variant="secondary" onClick={state.reload}>
                {t("retry")}
              </Button>
            )
          }
        />
      </Card>
    );
  }

  const rows = state.data?.rows ?? [];
  const groups = groupStandingsByCategory(rows);
  /** Solange keine Kür gewertet ist, freundlicher Leerzustand statt Strich-Tabelle. */
  const hasAnyScore = rows.some((row) => row.totalScore != null);
  /** Endstand, sobald jede gemeldete Kür eine Gesamtwertung trägt. */
  const final = hasAnyScore && rows.every((row) => row.totalScore != null);

  return (
    <Card padded={false} className="px-2 py-4 sm:px-4">
      <CardHeader
        className="px-3 pt-1 sm:px-2"
        title={final ? t("standingsFinalTitle") : t("standingsTitle")}
      />
      {groups.length === 0 || !hasAnyScore ? (
        <div className="grid gap-1 px-3 pb-4 sm:px-2">
          <b className="text-[14.5px] font-bold text-ink">{t("standingsEmptyTitle")}</b>
          <p className="text-body text-ink-soft">{t("standingsEmptyBody")}</p>
        </div>
      ) : (
        <div className="grid gap-5 px-1 pb-1 sm:px-2">
          {groups.map((group) => (
            <CategoryStandings key={group.category || "—"} category={group.category} rows={group.rows} />
          ))}
        </div>
      )}
    </Card>
  );
}

/* ---------- Eine Kategorie: Kopf + Tabelle ---------- */

function CategoryStandings({ category, rows }: { category: string; rows: CompetitionStandingRow[] }) {
  const t = useT(wettkampfDict);
  const { locale } = useLocale();

  const score = (value: number | null) =>
    value == null ? <span className="text-ink-faint">—</span> : formatScore(value, locale);

  const columns: Column<CompetitionStandingRow>[] = [
    {
      id: "rank",
      header: t("colRank"),
      cellClassName: "w-14",
      cell: (row) => (
        <span className="font-mono text-mono-table tabular-nums text-ink">
          {row.rank == null ? "—" : `${row.rank}.`}
        </span>
      ),
    },
    {
      id: "skater",
      header: t("colSkater"),
      cell: (row) => {
        const name = [row.firstName, row.lastName].filter(Boolean).join(" ");
        return (
          <span className="flex items-center gap-2.5">
            <AvatarStack
              people={[
                {
                  personId: row.memberId || row.routineId,
                  firstName: row.firstName ?? "",
                  lastName: row.lastName ?? "",
                },
              ]}
              size="s"
            />
            <span className="grid min-w-0 gap-px">
              <b className="font-bold text-ink">{name || row.routineTitle}</b>
              <span className="text-caption text-ink-faint">
                {name ? row.routineTitle : t("noRoutine")}
              </span>
            </span>
            {row.placement != null && (
              <Badge tone={row.placement <= 3 ? "brand" : "neutral"}>
                {t("placementBadge", { n: row.placement })}
              </Badge>
            )}
          </span>
        );
      },
    },
    { id: "technical", header: t("colTechnical"), mono: true, cell: (row) => score(row.technicalScore) },
    { id: "components", header: t("colComponents"), mono: true, cell: (row) => score(row.componentsScore) },
    {
      id: "total",
      header: t("colTotal"),
      mono: true,
      cellClassName: "font-extrabold",
      cell: (row) => score(row.totalScore),
    },
    {
      id: "delta",
      header: t("colDelta"),
      align: "right",
      cell: (row) => <DeltaChip delta={row.delta} />,
    },
  ];

  return (
    <div className="grid gap-1">
      <div className="flex items-baseline justify-between gap-3 px-2">
        <span className="eyebrow">{category || t("colCategory")}</span>
        <span className="text-caption tabular-nums text-ink-faint">
          {rows.length === 1 ? t("footerStartersOne") : t("footerStartersMany", { n: rows.length })}
        </span>
      </div>
      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(row) => row.entryId}
        caption={t("standingsLiveCaption")}
      />
    </div>
  );
}

/* ---------- Delta-Chip: total_score minus Vorwertung (▲▼=, grün/rot) ---------- */

function DeltaChip({ delta }: { delta: number | null }) {
  const t = useT(wettkampfDict);
  const { locale } = useLocale();

  if (delta == null) {
    return (
      <Badge tone="neutral">
        <span aria-hidden="true">—</span>
        <span className="sr-only">{t("deltaNoneAria")}</span>
      </Badge>
    );
  }
  const value = formatScoreDelta(delta, locale);
  if (delta > 0) {
    return (
      <Badge tone="success">
        <span aria-hidden="true">▲ {value}</span>
        <span className="sr-only">{t("deltaUpAria", { v: value })}</span>
      </Badge>
    );
  }
  if (delta < 0) {
    return (
      <Badge tone="danger">
        <span aria-hidden="true">▼ {value}</span>
        <span className="sr-only">{t("deltaDownAria", { v: value })}</span>
      </Badge>
    );
  }
  return (
    <Badge tone="neutral">
      <span aria-hidden="true">= {formatScore(0, locale)}</span>
      <span className="sr-only">{t("deltaSameAria")}</span>
    </Badge>
  );
}
