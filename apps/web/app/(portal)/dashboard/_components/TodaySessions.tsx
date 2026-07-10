"use client";

import { useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { AvatarStack } from "@/components/ui/AvatarStack";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ResponseBar } from "@/components/ui/ResponseBar";
import { useToast } from "@/components/ui/Toast";
import { Icon, type IconName } from "@/components/shell/icons";
import { useLocale, useT } from "@/lib/i18n";
import { formatTime, relativeDays } from "@/lib/format";
import { data, errorMessage, fullName, isForbidden } from "@/lib/data";
import type { EventType } from "@/lib/types";
import { dashboardDict, type DashboardKey } from "../i18n";
import type { SessionInfo, SessionNote } from "../derive";
import { AttendanceSheet } from "./AttendanceSheet";

/**
 * „Heute“-Karte: heutige/nächste Einheiten mit Avatar-Stapel,
 * Response-Balken und Schnellzugriff „Anwesenheit erfassen“ (Sheet).
 */

const TYPE_TONE: Record<EventType, BadgeTone> = {
  training: "neutral",
  competition: "brand",
  other: "info",
};

const TYPE_KEY: Record<EventType, DashboardKey> = {
  training: "typeTraining",
  competition: "typeCompetition",
  other: "typeOther",
};

const NOTE_KEY: Record<SessionNote["status"], DashboardKey> = {
  declined: "noteDeclined",
  sick: "noteSick",
  maybe: "noteMaybe",
};

function Meta({ icon, children }: { icon: IconName; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <Icon name={icon} className="ic h-[15px] w-[15px] flex-none text-ink-faint" />
      {children}
    </span>
  );
}

export function TodaySessions({ sessions }: { sessions: SessionInfo[] }) {
  const t = useT(dashboardDict);
  const { locale } = useLocale();
  const { showToast } = useToast();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [presenceByEvent, setPresenceByEvent] = useState<Record<string, string[]>>({});

  if (sessions.length === 0) {
    return (
      <EmptyState
        icon="events"
        title={t("emptyEventsTitle")}
        body={t("emptyEventsBody")}
        ctaHref="/termine"
        ctaLabel={t("emptyEventsCta")}
      />
    );
  }

  const active = sessions.find((s) => s.event.id === activeId) ?? null;
  const firstTodayId = sessions.find((s) => s.isToday)?.event.id;

  /* Optimistisch: sofort lokal übernehmen + Sheet schließen, dann über die
     Facade persistieren (mock: No-op). Fehler → zurückrollen + Toast mit
     „Erneut versuchen“ — nie stilles Scheitern. */
  const handleSave = (session: SessionInfo, presentIds: string[]) => {
    const eventId = session.event.id;
    const previous = presenceByEvent[eventId];
    setPresenceByEvent((prev) => ({ ...prev, [eventId]: presentIds }));
    setActiveId(null);

    const present = new Set(presentIds);
    const checkedInAt = new Date().toISOString();
    void Promise.all(
      session.roster.map((member) =>
        data.setAttendance({
          eventId,
          memberId: member.id,
          status: present.has(member.id) ? "present" : "absent",
          checkedInAt: present.has(member.id) ? checkedInAt : undefined,
        }),
      ),
    )
      .then(() => {
        showToast(t("savedToast", { x: presentIds.length, y: session.roster.length }), {
          tone: "success",
        });
      })
      .catch((error: unknown) => {
        setPresenceByEvent((prev) => {
          const next = { ...prev };
          if (previous) next[eventId] = previous;
          else delete next[eventId];
          return next;
        });
        showToast(isForbidden(error) ? t("noPermission") : errorMessage(error), {
          tone: "danger",
          actionLabel: t("retry"),
          onAction: () => handleSave(session, presentIds),
        });
      });
  };

  return (
    <Card>
      <CardHeader
        eyebrow={t("todayEyebrow")}
        title={t("todayTitle")}
        action={
          <ButtonLink variant="ghost" size="sm" href="/termine">
            {t("todayAll")}
          </ButtonLink>
        }
      />

      {sessions.map((session) => {
        const { event } = session;
        const saved = presenceByEvent[event.id];
        return (
          <article
            key={event.id}
            className="grid gap-4 border-t border-line py-5 first:border-t-0 first:pt-0 last:pb-0 sm:grid-cols-[84px_minmax(0,1fr)] lg:grid-cols-[84px_minmax(0,1fr)_176px]"
          >
            {/* Zeit-Spalte */}
            <div>
              <b className="block font-display text-[19px] font-extrabold text-ink tabular-nums">
                {formatTime(event.startsAt, locale)}
              </b>
              <span className="block text-caption text-ink-faint">
                {t("untilTime", { time: formatTime(event.endsAt, locale) })}
              </span>
              <span className="mt-2 flex flex-wrap gap-1.5">
                <Badge tone={TYPE_TONE[event.type]}>{t(TYPE_KEY[event.type])}</Badge>
                {!session.isToday && (
                  <Badge tone="brand">{relativeDays(event.startsAt, locale)}</Badge>
                )}
              </span>
            </div>

            {/* Inhalt */}
            <div className="grid min-w-0 content-start gap-2.5">
              <h4 className="text-[15.5px] font-bold leading-snug text-ink">{event.title}</h4>
              <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-ink-soft">
                <Meta icon="pin">{event.location}</Meta>
                <Meta icon="members">{t("invited", { n: session.invitedCount })}</Meta>
              </p>

              {session.going.length > 0 && (
                <AvatarStack
                  people={session.going.map((m) => ({
                    personId: m.id,
                    firstName: m.firstName,
                    lastName: m.lastName,
                  }))}
                  max={5}
                />
              )}
              <ResponseBar yes={session.yes} no={session.no} open={session.open} />

              {session.note && (
                <div className="flex items-start gap-2.5 rounded-md bg-sunken px-3 py-2.5 text-[13px] leading-relaxed text-ink-soft">
                  <Avatar
                    personId={session.note.member.id}
                    firstName={session.note.member.firstName}
                    lastName={session.note.member.lastName}
                    size="s"
                  />
                  <p className="min-w-0">
                    <b className="font-bold text-ink">{fullName(session.note.member)}</b>{" "}
                    {t(NOTE_KEY[session.note.status], { comment: session.note.comment })}
                  </p>
                </div>
              )}
            </div>

            {/* Aktionen */}
            <div className="flex flex-wrap content-start items-start gap-2 sm:col-span-2 lg:col-span-1 lg:flex-col lg:items-stretch">
              {session.isToday && (
                <Button
                  variant={event.id === firstTodayId ? "primary" : "secondary"}
                  icon="check"
                  onClick={() => setActiveId(event.id)}
                >
                  {t("ctaAttendance")}
                </Button>
              )}
              <ButtonLink variant="ghost" size="sm" href="/termine" className="lg:w-full">
                {t("ctaDetails")}
              </ButtonLink>
              {saved && (
                <Badge tone="success" icon="check" className="lg:justify-center">
                  {t("presentCount", { x: saved.length, y: session.roster.length })}
                </Badge>
              )}
            </div>
          </article>
        );
      })}

      {active && (
        <AttendanceSheet
          session={active}
          initialPresent={presenceByEvent[active.event.id] ?? active.going.map((m) => m.id)}
          onClose={() => setActiveId(null)}
          onSave={(ids) => handleSave(active, ids)}
        />
      )}
    </Card>
  );
}
