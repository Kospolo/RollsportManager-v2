"use client";

import { useMemo } from "react";
import { Button, ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { KpiTile } from "@/components/ui/KpiTile";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Skeleton, SkeletonCard } from "@/components/ui/Skeleton";
import { useLocale, useT } from "@/lib/i18n";
import { formatEUR, formatTime, relativeDays } from "@/lib/format";
import { errorMessage, isNotImplemented, openInvoices, sumOpenCents } from "@/lib/data";
import { useData, type DataState } from "@/lib/data/useData";
import type { Competition, Event, Invoice, Member, Routine } from "@/lib/types";
import { dashboardDict, type DashboardKey } from "../i18n";
import {
  activeMemberCount,
  nextCompetitionInfo,
  nextEvent,
  pendingMemberCount,
  todayEvents,
  upcomingSessions,
} from "../derive";
import { CountdownHero } from "./CountdownHero";
import { TodaySessions } from "./TodaySessions";
import { RoutinesCard } from "./RoutinesCard";
import { TasksCard } from "./TasksCard";

/**
 * Trainer-Dashboard (Mockup Screen 1): Begrüßung, KPI-Zeile,
 * Countdown-Hero, „Heute“-Karte, Küren-Schnellzugriff, Aufgaben.
 * Datenquelle ausschließlich die Facade lib/data (Mock oder api) —
 * Summen aus den puren Ableitungs-Helfern, nie hart codiert.
 */

function greetingKey(hour: number): DashboardKey {
  if (hour >= 5 && hour < 11) return "greetingMorning";
  if (hour >= 11 && hour < 18) return "greetingDay";
  return "greetingEvening";
}

/** Gemeinsame Kern-Ladung — alles, was es in beiden Datenquellen gibt. */
interface CoreData {
  me: Member;
  members: Member[];
  events: Event[];
  invoices: Invoice[];
  routines: Routine[];
}

type CompetitionsState = DataState<Competition[]> & { reload: () => void };

export function DashboardClient() {
  const t = useT(dashboardDict);

  const core = useData<CoreData>(async (repo) => {
    const [me, members, events, invoices, routines] = await Promise.all([
      repo.getCurrentUser(),
      repo.getMembers(),
      repo.getEvents(),
      repo.getInvoices(),
      repo.getRoutines(),
    ]);
    return { me, members, events, invoices, routines };
  });

  /* Wettkämpfe separat laden: im api-Modus (noch) NotImplemented —
     das darf den Rest des Dashboards nicht blockieren. */
  const competitions = useData((repo) => repo.getCompetitions());

  if (core.status === "loading") return <DashboardSkeleton />;

  if (core.status === "error") {
    return isNotImplemented(core.error) ? (
      <EmptyState
        icon="sparkle"
        title={t("notConnectedTitle")}
        body={t("notConnectedBody")}
      />
    ) : (
      <EmptyState
        icon="zap"
        title={t("loadErrorTitle")}
        body={errorMessage(core.error)}
        action={<Button onClick={core.reload}>{t("retry")}</Button>}
      />
    );
  }

  return <DashboardReady core={core.data} competitions={competitions} />;
}

/* Getrennt vom Lade-Gerüst, damit die abgeleiteten Memos nur mit
   fertig geladenen Daten rechnen (keine bedingten Hooks). */
function DashboardReady({
  core,
  competitions,
}: {
  core: CoreData;
  competitions: CompetitionsState;
}) {
  const t = useT(dashboardDict);
  const { locale } = useLocale();
  const intlLocale = locale === "de" ? "de-DE" : "en-GB";
  const { me, members, events, invoices, routines } = core;

  const sessions = useMemo(() => upcomingSessions(events, members, 3), [events, members]);
  const today = useMemo(() => todayEvents(events), [events]);
  const next = useMemo(() => nextEvent(events), [events]);
  const open = useMemo(() => openInvoices(invoices), [invoices]);
  const openCents = useMemo(() => sumOpenCents(invoices), [invoices]);
  const pendingCount = useMemo(() => pendingMemberCount(members), [members]);

  const greeting = t(greetingKey(new Date().getHours()), { name: me.firstName });

  const dateLine = new Intl.DateTimeFormat(intlLocale, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());

  const sessionsPhrase =
    today.length === 0
      ? t("subSessionsNone")
      : today.length === 1
        ? t("subSessionsOne")
        : t("subSessionsMany", { n: today.length });

  const hall = today[0]?.location.split(",")[0];
  const sub = [dateLine, sessionsPhrase, hall].filter(Boolean).join(" · ");

  const membersSub =
    pendingCount === 0
      ? t("kpiMembersAllIn")
      : pendingCount === 1
        ? t("kpiMembersPendingOne")
        : t("kpiMembersPendingMany", { n: pendingCount });

  return (
    <div className="grid gap-6">
      <SectionHeader
        level={1}
        title={<span suppressHydrationWarning>{greeting}</span>}
        sub={<span suppressHydrationWarning>{sub}</span>}
        action={
          <ButtonLink variant="ghost" icon="events" href="/termine">
            {t("actionWeek")}
          </ButtonLink>
        }
      />

      {/* KPI-Zeile */}
      <div className="grid gap-3.5 sm:grid-cols-3">
        <KpiTile
          label={t("kpiMembers")}
          value={String(activeMemberCount(members))}
          sub={membersSub}
          tone="success"
        />
        <KpiTile
          label={t("kpiOpen")}
          value={formatEUR(openCents, locale)}
          sub={
            open.length === 1
              ? t("kpiOpenSubOne")
              : t("kpiOpenSubMany", { n: open.length })
          }
          tone="warn"
        />
        <KpiTile
          label={t("kpiNext")}
          value={next ? formatTime(next.startsAt, locale) : "—"}
          sub={
            next
              ? `${relativeDays(next.startsAt, locale)} · ${next.title}`
              : t("kpiNextNone")
          }
          tone="brand"
        />
      </div>

      {/* Hauptraster: links Einheiten + Küren, rechts Countdown + Aufgaben */}
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="xl:col-start-2 xl:row-start-1">
          <CompetitionSlot competitions={competitions} events={events} members={members} />
        </div>
        <div className="grid gap-5 xl:col-start-1 xl:row-span-2 xl:row-start-1">
          <TodaySessions sessions={sessions} />
          <RoutinesCard routines={routines} members={members} />
        </div>
        <div className="xl:col-start-2 xl:row-start-2">
          <TasksCard
            members={members}
            competitions={competitions.status === "ready" ? competitions.data : []}
          />
        </div>
      </div>
    </div>
  );
}

/** Hero-Slot mit eigenem Lade-/Fehlerzustand (Wettkämpfe laden separat). */
function CompetitionSlot({
  competitions,
  events,
  members,
}: {
  competitions: CompetitionsState;
  events: Event[];
  members: Member[];
}) {
  const t = useT(dashboardDict);

  if (competitions.status === "loading") return <SkeletonCard lines={5} />;

  if (competitions.status === "error") {
    return isNotImplemented(competitions.error) ? (
      <EmptyState
        icon="competition"
        title={t("notConnectedTitle")}
        body={t("notConnectedBody")}
      />
    ) : (
      <EmptyState
        icon="zap"
        title={t("loadErrorTitle")}
        body={errorMessage(competitions.error)}
        action={<Button onClick={competitions.reload}>{t("retry")}</Button>}
      />
    );
  }

  return <CountdownHero info={nextCompetitionInfo(competitions.data, events, members)} />;
}

/** Lade-Gerüst in der Geometrie des fertigen Dashboards — kein Layout-Sprung. */
function DashboardSkeleton() {
  return (
    <div className="grid gap-6" aria-busy="true">
      {/* Kopfzeile */}
      <div className="grid gap-2.5">
        <Skeleton className="h-8 w-72 max-w-full" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>

      {/* KPI-Zeile */}
      <div className="grid gap-3.5 sm:grid-cols-3">
        <SkeletonCard lines={1} />
        <SkeletonCard lines={1} />
        <SkeletonCard lines={1} />
      </div>

      {/* Hauptraster */}
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="xl:col-start-2 xl:row-start-1">
          <SkeletonCard lines={5} />
        </div>
        <div className="grid gap-5 xl:col-start-1 xl:row-span-2 xl:row-start-1">
          <SkeletonCard lines={8} />
          <SkeletonCard lines={4} />
        </div>
        <div className="xl:col-start-2 xl:row-start-2">
          <SkeletonCard lines={6} />
        </div>
      </div>
    </div>
  );
}
