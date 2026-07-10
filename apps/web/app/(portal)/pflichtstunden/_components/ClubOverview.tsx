"use client";

import { useMemo, useState } from "react";
import type { DutyEntry, DutyRequirement, Id, Member, Team } from "@/lib/types";
import { fullName } from "@/lib/data";
import { useT, useLocale } from "@/lib/i18n";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { KpiTile } from "@/components/ui/KpiTile";
import { FilterChips, type FilterChipOption } from "@/components/ui/FilterChips";
import { EmptyState } from "@/components/ui/EmptyState";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Badge } from "@/components/ui/Badge";
import { pflichtstundenDict } from "../i18n";
import { computeProgress, formatHours, type DutyProgress } from "../logic";

type StatusFilter = "all" | "open" | "done";

type Row = { member: Member; progress: DutyProgress; teamName: string };

/**
 * Vereins-Übersicht (nur Trainer:innen): Soll vs. Ist aller Mitglieder mit einer
 * aktiven Pflichtstunden-Regel. KPIs (gesamt/offen/erfüllt) + Status-Filter +
 * je Mitglied ein Fortschrittsbalken. Rein lesend — Genehmigen läuft über die
 * Sektion „Offene Genehmigungen"; nach einer Freigabe lädt der Screen neu.
 */
export function ClubOverview({
  members,
  requirements,
  entries,
  teams,
}: {
  members: Member[];
  requirements: DutyRequirement[];
  entries: DutyEntry[];
  teams: Team[];
}) {
  const t = useT(pflichtstundenDict);
  const { locale } = useLocale();
  const [filter, setFilter] = useState<StatusFilter>("all");

  const teamName = useMemo(() => {
    const map = new Map<Id, string>(teams.map((team) => [team.id, team.name]));
    return (member: Member): string => {
      const first = member.teamIds.find((id) => map.has(id));
      return first ? (map.get(first) as string) : t("noTeam");
    };
  }, [teams, t]);

  const rows = useMemo<Row[]>(() => {
    const byMember = new Map<Id, DutyEntry[]>();
    for (const entry of entries) {
      const list = byMember.get(entry.memberId);
      if (list) list.push(entry);
      else byMember.set(entry.memberId, [entry]);
    }

    return members
      .filter((member) => member.status === "active")
      .map((member) => ({
        member,
        progress: computeProgress(member, requirements, byMember.get(member.id) ?? []),
        teamName: teamName(member),
      }))
      .filter((row) => row.progress.soll > 0)
      .sort((a, b) => {
        if (a.progress.fulfilled !== b.progress.fulfilled) return a.progress.fulfilled ? 1 : -1;
        if (b.progress.rest !== a.progress.rest) return b.progress.rest - a.progress.rest;
        return fullName(a.member).localeCompare(fullName(b.member), locale);
      });
  }, [members, requirements, entries, teamName, locale]);

  const openCount = rows.filter((r) => !r.progress.fulfilled).length;
  const doneCount = rows.length - openCount;

  const visible = useMemo(() => {
    if (filter === "open") return rows.filter((r) => !r.progress.fulfilled);
    if (filter === "done") return rows.filter((r) => r.progress.fulfilled);
    return rows;
  }, [rows, filter]);

  const filterOptions: FilterChipOption<StatusFilter>[] = [
    { value: "all", label: t("filterAll"), count: rows.length },
    { value: "open", label: t("filterOpen"), count: openCount },
    { value: "done", label: t("filterDone"), count: doneCount },
  ];

  return (
    <section className="grid gap-4">
      <SectionHeader level={2} title={t("overviewTitle")} sub={t("overviewSub")} />

      {rows.length === 0 ? (
        <EmptyState
          icon="members"
          title={t("overviewEmptyTitle")}
          body={t("overviewEmptyBody")}
        />
      ) : (
        <>
          <ul className="grid list-none gap-3 sm:grid-cols-3">
            <li>
              <KpiTile label={t("kpiTracked")} value={String(rows.length)} tone="neutral" />
            </li>
            <li>
              <KpiTile label={t("kpiOpen")} value={String(openCount)} tone="warn" />
            </li>
            <li>
              <KpiTile label={t("kpiDone")} value={String(doneCount)} tone="success" />
            </li>
          </ul>

          <FilterChips
            options={filterOptions}
            value={filter}
            onChange={setFilter}
            label={t("filterLabel")}
          />

          {visible.length === 0 ? (
            <EmptyState
              icon="search"
              title={t("filterEmptyTitle")}
              body={t("filterEmptyBody")}
              action={
                <button
                  type="button"
                  onClick={() => setFilter("all")}
                  className="inline-flex min-h-9 items-center rounded-full bg-brand-soft px-4 text-[13px] font-bold text-brand-ink transition-colors duration-150 hover:bg-brand hover:text-brand-contrast"
                >
                  {t("filterEmptyCta")}
                </button>
              }
            />
          ) : (
            <ul className="grid list-none gap-3">
              {visible.map(({ member, progress, teamName: team }) => (
                <li
                  key={member.id}
                  className="grid gap-2 rounded-xl border border-line bg-surface p-4 shadow-card"
                >
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                    <span className="truncate font-display text-[15px] font-bold tracking-[-0.01em] text-ink">
                      {fullName(member)}
                    </span>
                    <Badge tone="neutral">{team}</Badge>
                    <span className="ml-auto font-mono text-caption font-semibold tabular-nums text-ink-soft">
                      {t("ofTarget", {
                        done: formatHours(progress.ist, locale),
                        target: formatHours(progress.soll, locale),
                      })}
                    </span>
                    <Badge tone={progress.fulfilled ? "success" : "neutral"}>
                      {progress.fulfilled ? t("fulfilledBadge") : t("openBadge")}
                    </Badge>
                  </div>
                  <ProgressBar
                    value={progress.ist}
                    max={progress.soll}
                    tone={progress.fulfilled ? "success" : "brand"}
                    label={t("progressLabel", {
                      done: formatHours(progress.ist, locale),
                      target: formatHours(progress.soll, locale),
                    })}
                  />
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
