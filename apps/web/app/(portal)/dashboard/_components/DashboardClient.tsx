"use client";

import { useMemo } from "react";
import { ButtonLink } from "@/components/ui/Button";
import { KpiTile } from "@/components/ui/KpiTile";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { useLocale, useT } from "@/lib/i18n";
import { formatEUR, formatTime, relativeDays } from "@/lib/format";
import { currentUser, openInvoices, sumOpenCents } from "@/lib/mock";
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
 * Datenquelle ausschließlich lib/mock — Summen aus den abgeleiteten Exporten.
 */

function greetingKey(hour: number): DashboardKey {
  if (hour >= 5 && hour < 11) return "greetingMorning";
  if (hour >= 11 && hour < 18) return "greetingDay";
  return "greetingEvening";
}

export function DashboardClient() {
  const t = useT(dashboardDict);
  const { locale } = useLocale();
  const intlLocale = locale === "de" ? "de-DE" : "en-GB";

  const sessions = useMemo(() => upcomingSessions(3), []);
  const today = useMemo(() => todayEvents(), []);
  const competition = useMemo(() => nextCompetitionInfo(), []);
  const next = useMemo(() => nextEvent(), []);

  const greeting = t(greetingKey(new Date().getHours()), { name: currentUser.firstName });

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
    pendingMemberCount === 0
      ? t("kpiMembersAllIn")
      : pendingMemberCount === 1
        ? t("kpiMembersPendingOne")
        : t("kpiMembersPendingMany", { n: pendingMemberCount });

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
          value={String(activeMemberCount)}
          sub={membersSub}
          tone="success"
        />
        <KpiTile
          label={t("kpiOpen")}
          value={formatEUR(sumOpenCents, locale)}
          sub={
            openInvoices.length === 1
              ? t("kpiOpenSubOne")
              : t("kpiOpenSubMany", { n: openInvoices.length })
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
          <CountdownHero info={competition} />
        </div>
        <div className="grid gap-5 xl:col-start-1 xl:row-span-2 xl:row-start-1">
          <TodaySessions sessions={sessions} />
          <RoutinesCard />
        </div>
        <div className="xl:col-start-2 xl:row-start-2">
          <TasksCard />
        </div>
      </div>
    </div>
  );
}
