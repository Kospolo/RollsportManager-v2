"use client";

import { useMemo, useState } from "react";
import { useT } from "@/lib/i18n";
import { errorMessage } from "@/lib/data";
import { useData } from "@/lib/data/useData";
import type { Member, Sparte, Team } from "@/lib/types";
import { softNotImplemented } from "../mitglieder/derive";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { FilterChips, type FilterChipOption } from "@/components/ui/FilterChips";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton, SkeletonCard } from "@/components/ui/Skeleton";
import { Icon } from "@/components/shell/icons";
import { teamsViewDict } from "./i18n";
import { isMyTeam, sortTeams } from "./derive";
import { TeamMemberCard } from "./TeamMemberCard";

/**
 * Teams-Mitgliederansicht (REIN LESEND, is_club_member): oben „Meine Teams"
 * (Gruppen des eingeloggten Mitglieds, als Trainer:in ODER Sportler:in),
 * darunter „Alle Teams im Verein". Kein Schreibpfad — Anlegen/Kader läuft über
 * /verwaltung/teams. Alle Daten kommen ausschließlich über die Facade
 * (getTeams/getMembers/getCurrentUser).
 */

const NO_TEAMS: Team[] = [];
const NO_MEMBERS: Member[] = [];

/** Reservierte Filter-Werte neben den Sparten-Ids (die als "sp-…" nie kollidieren). */
const SPARTE_ALL = "all";
const SPARTE_NONE = "none";

function CardGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid items-stretch gap-4 sm:grid-cols-2 xl:grid-cols-3">{children}</div>;
}

export function TeamsView() {
  const t = useT(teamsViewDict);

  const [sparteFilter, setSparteFilter] = useState<string>(SPARTE_ALL);

  const state = useData((repo) =>
    Promise.all([
      repo.getTeams(),
      repo.getMembers(),
      repo.getCurrentUser(),
      softNotImplemented(repo.getSparten()),
    ] as const),
  );

  const teams = state.data?.[0] ?? NO_TEAMS;
  const members = state.data?.[1] ?? NO_MEMBERS;
  const currentUser = state.data?.[2] ?? null;
  const sparten: Sparte[] | null = state.data?.[3] ?? null;

  const spartenList = useMemo(
    () =>
      (sparten ?? [])
        .slice()
        .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "de")),
    [sparten],
  );

  const matchesSparte = useMemo(() => {
    return (team: Team): boolean => {
      if (sparteFilter === SPARTE_ALL) return true;
      if (sparteFilter === SPARTE_NONE) return !team.sparteId;
      return team.sparteId === sparteFilter;
    };
  }, [sparteFilter]);

  const allTeams = useMemo(() => sortTeams(teams), [teams]);
  const myTeams = useMemo(
    () => (currentUser ? allTeams.filter((team) => isMyTeam(team, currentUser)) : []),
    [allTeams, currentUser],
  );

  const visibleAll = useMemo(() => allTeams.filter(matchesSparte), [allTeams, matchesSparte]);
  const visibleMine = useMemo(() => myTeams.filter(matchesSparte), [myTeams, matchesSparte]);

  const spartenFilterOptions: FilterChipOption<string>[] = useMemo(() => {
    const opts: FilterChipOption<string>[] = [
      { value: SPARTE_ALL, label: t("filterAllSparten"), count: allTeams.length },
    ];
    for (const s of spartenList) {
      if (!s.active) continue;
      opts.push({
        value: s.id,
        label: s.name,
        count: allTeams.filter((tm) => tm.sparteId === s.id).length,
      });
    }
    opts.push({
      value: SPARTE_NONE,
      label: t("filterNoSparte"),
      count: allTeams.filter((tm) => !tm.sparteId).length,
    });
    return opts;
  }, [spartenList, allTeams, t]);

  const countLabel =
    visibleAll.length === 1 ? t("oneTeam") : t("teamsCount", { n: visibleAll.length });

  let body: React.ReactNode;
  if (state.status === "loading") {
    body = (
      <div className="grid gap-5" aria-hidden="true">
        <Skeleton className="h-5 w-40" />
        <CardGrid>
          <SkeletonCard lines={4} />
          <SkeletonCard lines={4} />
          <SkeletonCard lines={4} />
        </CardGrid>
      </div>
    );
  } else if (state.status === "error") {
    body = (
      <EmptyState
        icon="zap"
        title={t("loadErrorTitle")}
        body={errorMessage(state.error) || t("loadErrorBody")}
        action={<Button onClick={state.reload}>{t("retry")}</Button>}
      />
    );
  } else {
    body = (
      <div className="grid gap-8">
        {/* Sparten-Filter — additiv, nur wenn Sparten angebunden UND vorhanden. */}
        {spartenList.length > 0 && (
          <FilterChips
            options={spartenFilterOptions}
            value={sparteFilter}
            onChange={setSparteFilter}
            label={t("spartenFilterLabel")}
          />
        )}

        {/* Meine Teams */}
        <section className="grid gap-4">
          <SectionHeader level={2} title={t("myTitle")} sub={t("mySub")} />
          {visibleMine.length > 0 ? (
            <CardGrid>
              {visibleMine.map((team) => (
                <TeamMemberCard key={team.id} team={team} members={members} mine />
              ))}
            </CardGrid>
          ) : (
            <div className="grid place-items-center gap-2 rounded-xl border border-dashed border-line bg-surface px-6 py-10 text-center">
              <span className="grid h-11 w-11 place-items-center rounded-full bg-sunken text-ink-soft">
                <Icon name="teams" className="ic h-5 w-5" />
              </span>
              <b className="font-display text-[15px] text-ink">{t("myEmptyTitle")}</b>
              <p className="max-w-sm text-[13px] text-ink-soft">{t("myEmptyBody")}</p>
            </div>
          )}
        </section>

        {/* Alle Teams im Verein */}
        <section className="grid gap-4">
          <SectionHeader
            level={2}
            title={t("allTitle")}
            sub={visibleAll.length > 0 ? countLabel : undefined}
          />
          {visibleAll.length > 0 ? (
            <CardGrid>
              {visibleAll.map((team) => (
                <TeamMemberCard
                  key={team.id}
                  team={team}
                  members={members}
                  mine={currentUser ? isMyTeam(team, currentUser) : false}
                />
              ))}
            </CardGrid>
          ) : allTeams.length > 0 ? (
            <EmptyState
              icon="teams"
              title={t("allEmptyTitle")}
              body={t("allEmptyBody")}
              action={
                <Button variant="secondary" onClick={() => setSparteFilter(SPARTE_ALL)}>
                  {t("filterAllSparten")}
                </Button>
              }
            />
          ) : (
            <EmptyState icon="teams" title={t("allEmptyTitle")} body={t("allEmptyBody")} />
          )}
        </section>
      </div>
    );
  }

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-5">
      <SectionHeader level={1} eyebrow={t("eyebrow")} title={t("title")} sub={t("sub")} />

      <p className="flex items-center gap-2.5 rounded-lg border border-line bg-surface px-4 py-3 text-[13px] text-ink-soft shadow-card">
        <Icon name="lock" className="ic h-4 w-4 flex-none text-ink-faint" />
        {t("readonlyNote")}
      </p>

      {body}
    </div>
  );
}
