"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useLocale, useT } from "@/lib/i18n";
import { formatDate, formatTime } from "@/lib/format";
import { errorMessage, fullName, permissions } from "@/lib/data";
import { useData } from "@/lib/data/useData";
import type { Event, Member, Routine, Sparte, Team } from "@/lib/types";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton, SkeletonCard } from "@/components/ui/Skeleton";
import { Icon } from "@/components/shell/icons";
import { teamsViewDict } from "../i18n";
import { isMyTeam, rosterOf } from "../derive";
import { TeamRosterCard } from "../TeamRosterCard";
import { SparteBadge } from "../../sparten/_components/SparteBadge";
import { TeamSparteSheet } from "./TeamSparteSheet";

/**
 * Team-Detailseite (REIN LESEND): Kopf mit Name/Altersband/Trainerstab, dann
 * der GANZE Kader als klickbare Karten ins 360-Profil (/mitglieder/{id}). Wenn
 * die Daten schon da sind, zusätzlich die Küren des Teams (→ /kueren) und die
 * nächsten Termine (→ /termine) — sonst weggelassen, nichts erfunden.
 *
 * RECHTE WERDEN HIER NICHT ENTSCHIEDEN: /teams ist für jedes Mitglied
 * Nur-Lese sichtbar (Namen/Avatare waren schon auf der Übersicht sichtbar).
 * Das Profil hinter jeder Karte staffelt serverseitig selbst, was der/die
 * Betrachter:in sehen darf. Wir verlinken nur.
 */

const NO_MEMBERS: Member[] = [];
const NO_ROUTINES: Routine[] = [];
const NO_EVENTS: Event[] = [];
const NO_SPARTEN: Sparte[] = [];

function CardGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid items-stretch gap-4 sm:grid-cols-2 xl:grid-cols-3">{children}</div>;
}

export function TeamDetail({ id }: { id: string }) {
  const t = useT(teamsViewDict);
  const { locale } = useLocale();
  const [sparteOpen, setSparteOpen] = useState(false);

  const state = useData(
    async (repo) => {
      const [teams, members, currentUser] = await Promise.all([
        repo.getTeams(),
        repo.getMembers(),
        repo.getCurrentUser(),
      ]);
      // Küren und Termine sind ANREICHERUNG — fehlt/scheitert die Anbindung,
      // fallen sie still weg (die Seite lebt vom Kader, nicht von diesen).
      const routines = await repo.getRoutines().catch(() => NO_ROUTINES);
      const events = await repo.getUpcomingEvents().catch(() => NO_EVENTS);
      // Sparten (Team->Sparte) sind ebenfalls Anreicherung — Contract-Lücke
      // fällt still weg. Der Kopf zeigt dann keine Sparte, kein Fehler.
      const sparten = await repo.getSparten().catch(() => NO_SPARTEN);
      return { teams, members, currentUser, routines, events, sparten };
    },
    [id],
  );

  const team: Team | undefined = useMemo(
    () => state.data?.teams.find((candidate) => candidate.id === id),
    [state.data, id],
  );

  const members = state.data?.members ?? NO_MEMBERS;
  const currentUser = state.data?.currentUser ?? null;
  const sparten = state.data?.sparten ?? NO_SPARTEN;
  const canManageSparten = permissions(currentUser).canManageSparten;

  const { coaches, skaters } = useMemo(
    () => (team ? rosterOf(team, members) : { coaches: NO_MEMBERS, skaters: NO_MEMBERS }),
    [team, members],
  );
  const mine = team && currentUser ? isMyTeam(team, currentUser) : false;

  // Küren dieses Teams (nur, wenn die teamId sauberer Weise gesetzt ist).
  const teamRoutines = useMemo(
    () => (team ? (state.data?.routines ?? NO_ROUTINES).filter((r) => r.teamId === team.id) : NO_ROUTINES),
    [team, state.data],
  );

  // Kommende Termine, die dieses Team betreffen (team-adressiert ODER
  // Vereinsveranstaltung), aufsteigend nach Start.
  const teamEvents = useMemo(() => {
    if (!team) return NO_EVENTS;
    return (state.data?.events ?? NO_EVENTS)
      .filter((e) => e.audience === "club" || e.teamIds.includes(team.id))
      .slice()
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  }, [team, state.data]);

  /* ---------- Zustände ---------- */

  if (state.status === "loading") {
    return (
      <div className="mx-auto grid w-full max-w-6xl gap-6" aria-hidden="true">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-36 w-full rounded-xl" />
        <Skeleton className="h-5 w-32" />
        <CardGrid>
          <SkeletonCard lines={2} />
          <SkeletonCard lines={2} />
          <SkeletonCard lines={2} />
        </CardGrid>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="mx-auto grid w-full max-w-6xl gap-6">
        <Breadcrumb backLabel={t("backCrumb")} current={t("title")} />
        <EmptyState
          icon="zap"
          title={t("loadErrorTitle")}
          body={errorMessage(state.error) || t("loadErrorBody")}
          action={<Button onClick={state.reload}>{t("retry")}</Button>}
        />
      </div>
    );
  }

  if (!team) {
    return (
      <div className="mx-auto grid w-full max-w-6xl gap-6">
        <Breadcrumb backLabel={t("backCrumb")} current={t("notFoundTitle")} />
        <EmptyState
          icon="teams"
          title={t("notFoundTitle")}
          body={t("notFoundBody")}
          ctaHref="/teams"
          ctaLabel={t("backToTeams")}
        />
      </div>
    );
  }

  const rosterCount =
    skaters.length === 1 ? t("membersCountOne") : t("membersCountMany", { n: skaters.length });

  // Team -> Sparte (Migration 0064): genau eine Sparte oder keine.
  const teamSparte = sparten.find((s) => s.id === team.sparteId) ?? null;

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-6">
      <Breadcrumb backLabel={t("backCrumb")} current={team.name} />

      {/* Kopf-Karte: Team-Identität + Trainerstab */}
      <Card className="grid gap-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <span className="grid h-14 w-14 flex-none place-items-center rounded-2xl bg-brand-soft text-brand-ink">
            <Icon name="teams" className="ic h-7 w-7" />
          </span>
          <div className="grid min-w-0 flex-1 gap-2">
            <span className="eyebrow">{t("eyebrow")}</span>
            <h1 className="font-display text-display tracking-tight text-ink">{team.name}</h1>
            <div className="flex flex-wrap items-center gap-1.5">
              {team.ageGroup ? (
                <Badge tone="neutral">{team.ageGroup}</Badge>
              ) : (
                <span className="text-caption text-ink-faint">{t("noAgeGroup")}</span>
              )}
              {mine && <Badge tone="brand">{t("badgeMine")}</Badge>}
              <span className="text-caption font-semibold text-ink-faint tabular-nums">
                {rosterCount}
              </span>
            </div>

            {/* Sparte des Teams — Anzeige (Badge) + für Berechtigte Zuordnen/Ändern.
                Für Unberechtigte NUR das Badge (bzw. gar nichts, wenn keine Sparte). */}
            {(teamSparte || canManageSparten) && (
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <span className="eyebrow">{t("sparteEyebrow")}</span>
                {teamSparte ? (
                  <SparteBadge sparte={teamSparte} inactiveLabel={t("sparteInactive")} />
                ) : (
                  <span className="text-caption text-ink-faint">{t("sparteNone")}</span>
                )}
                {canManageSparten && (
                  <Button
                    size="sm"
                    variant="secondary"
                    icon="edit"
                    onClick={() => setSparteOpen(true)}
                  >
                    {teamSparte ? t("sparteChangeCta") : t("sparteAssignCta")}
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Trainerstab — jede:r Trainer:in klickbar ins Profil */}
        <div className="grid gap-2 border-t border-line pt-4">
          <span className="eyebrow">{t("coachesLabel")}</span>
          {coaches.length > 0 ? (
            <ul className="flex flex-wrap gap-2">
              {coaches.map((coach) => (
                <li key={coach.id}>
                  <Link
                    href={`/mitglieder/${coach.id}`}
                    aria-label={t("openProfileAria", { name: fullName(coach) })}
                    className="flex min-h-11 items-center gap-2.5 rounded-full border border-line bg-canvas py-1.5 pl-1.5 pr-4 text-[13px] font-semibold text-ink no-underline transition-colors duration-150 hover:border-line-strong hover:bg-sunken focus-visible:border-brand active:scale-[0.98]"
                  >
                    <Avatar
                      personId={coach.id}
                      firstName={coach.firstName}
                      lastName={coach.lastName}
                      size="s"
                    />
                    <span className="min-w-0 truncate">{fullName(coach)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <span className="flex items-center gap-2.5 text-[13px] text-ink-faint">
              <span className="grid h-7 w-7 flex-none place-items-center rounded-full bg-sunken text-ink-faint">
                <Icon name="user" className="ic h-3.5 w-3.5" />
              </span>
              {t("noCoaches")}
            </span>
          )}
        </div>
      </Card>

      {/* Kader — der ganze Kader als klickbare Karten */}
      <section className="grid gap-4">
        <SectionHeader
          level={2}
          title={t("rosterTitle")}
          sub={skaters.length > 0 ? rosterCount : undefined}
        />
        {skaters.length > 0 ? (
          <ul className="grid list-none items-stretch gap-4 p-0 sm:grid-cols-2 xl:grid-cols-3">
            {skaters.map((member) => (
              <li key={member.id} className="grid">
                <TeamRosterCard member={member} />
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            icon="members"
            title={t("rosterEmptyTitle")}
            body={t("rosterEmptyBody")}
          />
        )}
      </section>

      {/* Küren des Teams — nur wenn vorhanden (nichts erfunden) */}
      {teamRoutines.length > 0 && (
        <section className="grid gap-4">
          <SectionHeader
            level={2}
            title={t("kuerenTitle")}
            sub={
              teamRoutines.length === 1
                ? t("kuerCountOne")
                : t("kuerCountMany", { n: teamRoutines.length })
            }
            action={
              <Link
                href="/kueren"
                className="inline-flex min-h-11 items-center gap-1 text-[13px] font-bold text-brand no-underline hover:underline"
              >
                {t("kuerenAllLink")}
                <Icon name="chevronRight" className="ic h-4 w-4" />
              </Link>
            }
          />
          <Card padded={false} className="divide-y divide-line">
            {teamRoutines.map((routine) => (
              <Link
                key={routine.id}
                href={`/kueren/${routine.id}`}
                aria-label={t("openRoutineAria", { title: routine.title })}
                className="flex min-h-14 items-center gap-3 px-5 py-3 no-underline transition-colors duration-150 hover:bg-sunken focus-visible:bg-sunken active:scale-[0.997]"
              >
                <span className="grid h-10 w-10 flex-none place-items-center rounded-full bg-honey-soft text-honey-deep">
                  <Icon name="routines" className="ic h-5 w-5" />
                </span>
                <span className="grid min-w-0 flex-1 gap-0.5">
                  <span className="truncate text-[14.5px] font-bold text-ink">{routine.title}</span>
                  <span className="truncate text-caption text-ink-soft">
                    {routine.music.title} · {routine.music.artist}
                  </span>
                </span>
                <Icon name="chevronRight" className="ic h-4 w-4 flex-none text-ink-faint" />
              </Link>
            ))}
          </Card>
        </section>
      )}

      {/* Nächste Termine — nur wenn vorhanden */}
      {teamEvents.length > 0 && (
        <section className="grid gap-4">
          <SectionHeader
            level={2}
            title={t("eventsTitle")}
            action={
              <Link
                href="/termine"
                className="inline-flex min-h-11 items-center gap-1 text-[13px] font-bold text-brand no-underline hover:underline"
              >
                {t("eventsAllLink")}
                <Icon name="chevronRight" className="ic h-4 w-4" />
              </Link>
            }
          />
          <Card padded={false} className="divide-y divide-line">
            {teamEvents.slice(0, 5).map((event) => (
              <div key={event.id} className="flex min-h-14 items-center gap-3 px-5 py-3">
                <span className="grid h-10 w-10 flex-none place-items-center rounded-full bg-sunken text-ink-soft">
                  <Icon name="events" className="ic h-5 w-5" />
                </span>
                <span className="grid min-w-0 flex-1 gap-0.5">
                  <span className="truncate text-[14.5px] font-bold text-ink">{event.title}</span>
                  <span className="truncate text-caption text-ink-soft">{event.location}</span>
                </span>
                <span className="flex-none text-right text-caption font-semibold text-ink-soft tabular-nums">
                  <span className="block">{formatDate(event.startsAt, locale)}</span>
                  <span className="block text-ink-faint">{formatTime(event.startsAt, locale)}</span>
                </span>
              </div>
            ))}
          </Card>
        </section>
      )}

      {sparteOpen && canManageSparten && (
        <TeamSparteSheet
          key={team.id}
          teamId={team.id}
          teamName={team.name}
          currentSparteId={team.sparteId}
          sparten={sparten}
          onClose={() => setSparteOpen(false)}
          onSaved={state.reload}
        />
      )}
    </div>
  );
}

/** Brotkrumen — zurück zur Team-Übersicht. */
function Breadcrumb({ backLabel, current }: { backLabel: string; current: string }) {
  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-[13px]">
      <Link
        href="/teams"
        className="inline-flex min-h-11 items-center font-semibold text-ink-soft no-underline transition-colors duration-150 hover:text-ink hover:underline"
      >
        {backLabel}
      </Link>
      <Icon name="chevronRight" className="ic h-3.5 w-3.5 text-ink-faint" />
      <span aria-current="page" className="min-w-0 truncate font-bold text-ink">
        {current}
      </span>
    </nav>
  );
}
