"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { FilterChips, type FilterChipOption } from "@/components/ui/FilterChips";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Sparkline } from "@/components/ui/Sparkline";
import { useToast } from "@/components/ui/Toast";
import { useLocale, useT } from "@/lib/i18n";
import { formatDate, formatDurationMs, formatEUR, relativeDays } from "@/lib/format";
import { fullName } from "@/lib/mock";
import type { Competition } from "@/lib/types";
import { formatScore, type FeeStatus, type StarterEntry } from "../derive";
import { wettkampfDict, type WettkampfKey } from "../i18n";

type EntryFilter = "all" | "ready" | "missing";

const FEE_KEY: Record<FeeStatus, WettkampfKey> = {
  paid: "feePaid",
  open: "feeOpen",
  none: "feeNone",
};

type Stats = { starters: number; routines: number };

export function EntriesTab({
  competition,
  entries,
  stats,
  listSent,
  onListSent,
}: {
  competition?: Competition;
  entries: StarterEntry[];
  stats: Stats;
  listSent: boolean;
  onListSent: () => void;
}) {
  const t = useT(wettkampfDict);
  const { locale } = useLocale();
  const { showToast } = useToast();
  const [filter, setFilter] = useState<EntryFilter>("all");

  const readyCount = entries.filter((entry) => entry.routine !== undefined).length;

  const options: FilterChipOption<EntryFilter>[] = [
    { value: "all", label: t("filterAll"), count: entries.length },
    { value: "ready", label: t("filterReady"), count: readyCount },
    { value: "missing", label: t("filterMissing"), count: entries.length - readyCount },
  ];

  const rows = useMemo(() => {
    if (filter === "ready") return entries.filter((entry) => entry.routine !== undefined);
    if (filter === "missing") return entries.filter((entry) => entry.routine === undefined);
    return entries;
  }, [entries, filter]);

  /* Summenzeile folgt dem Filter (DESIGN-SYSTEM §3.3). */
  const feeSummary = useMemo(() => {
    const parts: string[] = [];
    const count = (status: FeeStatus) => rows.filter((r) => r.feeStatus === status).length;
    if (count("paid") > 0) parts.push(t("feePaidN", { n: count("paid") }));
    if (count("open") > 0) parts.push(t("feeOpenN", { n: count("open") }));
    if (count("none") > 0) parts.push(t("feeNoneN", { n: count("none") }));
    return parts.join(" · ");
  }, [rows, t]);

  function handleSend() {
    onListSent();
    showToast(
      t("sendListToast", { starters: stats.starters, routines: stats.routines }),
      { tone: "success" },
    );
  }

  const columns: Column<StarterEntry>[] = [
    {
      id: "skater",
      header: t("colSkater"),
      footer:
        rows.length === 1
          ? t("footerStartersOne")
          : t("footerStartersMany", { n: rows.length }),
      cell: (entry) => (
        <span className="flex items-center gap-2.5">
          <Avatar
            personId={entry.member.id}
            firstName={entry.member.firstName}
            lastName={entry.member.lastName}
            size="m"
          />
          <span className="grid min-w-0 gap-px">
            <b className="font-bold text-ink">{fullName(entry.member)}</b>
            {entry.team && <span className="text-caption text-ink-faint">{entry.team.name}</span>}
          </span>
        </span>
      ),
    },
    {
      id: "category",
      header: t("colCategory"),
      cell: (entry) =>
        entry.routine ? (
          <span className="text-ink-soft">{entry.routine.category}</span>
        ) : (
          <span className="text-ink-faint">—</span>
        ),
    },
    {
      id: "routine",
      header: t("colRoutine"),
      cell: (entry) =>
        entry.routine ? (
          <span className="grid min-w-0 gap-px">
            <Link href={`/kueren/${entry.routine.id}`} className="text-[14px]">
              {entry.routine.title}
            </Link>
            <span className="text-caption text-ink-faint">
              <span className="font-mono tabular-nums">
                {formatDurationMs(entry.routine.music.durationMs)}
              </span>{" "}
              · {entry.routine.music.title}
            </span>
          </span>
        ) : (
          <span className="text-caption text-ink-faint">{t("noRoutine")}</span>
        ),
    },
    {
      id: "trend",
      header: t("colTrend"),
      align: "right",
      cell: (entry) => {
        const scores = entry.routine?.scores ?? [];
        if (scores.length === 0) {
          return <span className="text-caption text-ink-faint">{t("noScores")}</span>;
        }
        const totals = scores.map((score) => score.total);
        return (
          <span className="inline-flex items-center justify-end gap-2.5">
            <Sparkline
              values={totals}
              width={84}
              height={28}
              label={t("trendAria", {
                values: totals.map((total) => formatScore(total, locale)).join(" → "),
              })}
            />
            <span className="font-mono text-mono-table tabular-nums text-ink">
              {formatScore(totals[totals.length - 1], locale)}
            </span>
          </span>
        );
      },
    },
    {
      id: "status",
      header: t("colStatus"),
      cell: (entry) =>
        entry.routine ? (
          <Badge tone="success" icon="check">
            {t("statusReady")}
          </Badge>
        ) : (
          <Badge tone="warn">{t("statusMissing")}</Badge>
        ),
    },
    {
      id: "fee",
      header: t("colFee"),
      align: "right",
      footer: feeSummary,
      cell: (entry) => (
        <span className="inline-flex items-center justify-end gap-2">
          {entry.invoice && (
            <span className="font-mono text-mono-table tabular-nums text-ink-soft">
              {formatEUR(entry.invoice.amountCents, locale)}
            </span>
          )}
          <Badge
            tone={entry.feeStatus === "paid" ? "success" : entry.feeStatus === "open" ? "warn" : "neutral"}
            icon={entry.feeStatus === "paid" ? "check" : undefined}
          >
            {t(FEE_KEY[entry.feeStatus])}
          </Badge>
        </span>
      ),
    },
  ];

  return (
    <div className="grid gap-4">
      <SectionHeader
        title={t("entriesTitle")}
        sub={
          competition?.registrationDeadline
            ? t("entriesSub", {
                date: formatDate(competition.registrationDeadline, locale),
                rel: relativeDays(competition.registrationDeadline, locale),
              })
            : undefined
        }
        action={
          listSent ? (
            <Button variant="ghost" icon="check" disabled>
              {t("sendListDone")}
            </Button>
          ) : (
            <Button icon="mail" onClick={handleSend}>
              {t("sendList")}
            </Button>
          )
        }
      />

      <FilterChips options={options} value={filter} onChange={setFilter} label={t("filterLabel")} />

      <Card padded={false} className="px-2 py-2 sm:px-3">
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(entry) => entry.member.id}
          caption={t("tableCaption", { name: competition?.name ?? "" })}
          empty={
            <EmptyState
              icon="competition"
              title={t("emptyFilterTitle")}
              body={t("emptyFilterBody")}
              action={
                <Button variant="ghost" onClick={() => setFilter("all")}>
                  {t("resetFilter")}
                </Button>
              }
            />
          }
        />
      </Card>
    </div>
  );
}
