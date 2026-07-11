"use client";

import { useMemo } from "react";
import { useT } from "@/lib/i18n";
import { errorMessage } from "@/lib/data";
import { useData } from "@/lib/data/useData";
import type { Member, Team } from "@/lib/types";
import { SectionHeader } from "@/components/ui/SectionHeader";
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

function CardGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid items-stretch gap-4 sm:grid-cols-2 xl:grid-cols-3">{children}</div>;
}

export function TeamsView() {
  const t = useT(teamsViewDict);

  const state = useData((repo) =>
    Promise.all([repo.getTeams(), repo.getMembers(), repo.getCurrentUser()] as const),
  );

  const teams = state.data?.[0] ?? NO_TEAMS;
  const members = state.data?.[1] ?? NO_MEMBERS;
  const currentUser = state.data?.[2] ?? null;

  const allTeams = useMemo(() => sortTeams(teams), [teams]);
  const myTeams = useMemo(
    () => (currentUser ? allTeams.filter((team) => isMyTeam(team, currentUser)) : []),
    [allTeams, currentUser],
  );

  const countLabel =
    allTeams.length === 1 ? t("oneTeam") : t("teamsCount", { n: allTeams.length });

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
        {/* Meine Teams */}
        <section className="grid gap-4">
          <SectionHeader level={2} title={t("myTitle")} sub={t("mySub")} />
          {myTeams.length > 0 ? (
            <CardGrid>
              {myTeams.map((team) => (
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
            sub={allTeams.length > 0 ? countLabel : undefined}
          />
          {allTeams.length > 0 ? (
            <CardGrid>
              {allTeams.map((team) => (
                <TeamMemberCard
                  key={team.id}
                  team={team}
                  members={members}
                  mine={currentUser ? isMyTeam(team, currentUser) : false}
                />
              ))}
            </CardGrid>
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
