"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { FilterChips, type FilterChipOption } from "@/components/ui/FilterChips";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Icon } from "@/components/shell/icons";
import { useLocale, useT, type Locale } from "@/lib/i18n";
import { dayDiff, formatDate, relativeDays } from "@/lib/format";
import { events as mockEvents } from "@/lib/mock";
import type { AttendanceStatus, Event, Rsvp, RsvpStatus } from "@/lib/types";
import { termineDict } from "../i18n";
import {
  baseAttendance,
  groupByDay,
  mergeRsvps,
  type DayGroup,
  type TypeFilter,
} from "../helpers";
import { EventCard } from "./EventCard";
import { EventDetailSheet } from "./EventDetailSheet";
import { NewEventSheet } from "./NewEventSheet";

/**
 * Termine-Screen: Tagesliste (kommend), Filter-Chips nach Art,
 * einklappbare Vergangenheit, Detail-Sheet und „Neuer Termin“-Formular.
 * Aller Zustand lebt lokal (optimistisch) — Datenquelle ist lib/mock.
 */
export function TermineScreen() {
  const t = useT(termineDict);
  const { locale } = useLocale();

  const [filter, setFilter] = useState<TypeFilter>("all");
  const [pastOpen, setPastOpen] = useState(false);
  const [created, setCreated] = useState<Event[]>([]);
  const [rsvpOverrides, setRsvpOverrides] = useState<Record<string, Record<string, Rsvp>>>({});
  const [attOverrides, setAttOverrides] = useState<
    Record<string, Record<string, AttendanceStatus>>
  >({});
  const [openId, setOpenId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  /** Einmal beim Mount eingefroren — hält Rendern pur und Gruppen stabil. */
  const [now] = useState(() => Date.now());

  const allEvents = useMemo(() => [...mockEvents, ...created], [created]);

  const { upcomingGroups, pastGroups, counts, pastCount } = useMemo(() => {
    const isPast = (event: Event) => new Date(event.endsAt).getTime() < now;
    const byType = (event: Event) => filter === "all" || event.type === filter;

    const tally: Record<TypeFilter, number> = { all: 0, training: 0, competition: 0, other: 0 };
    for (const event of allEvents) {
      tally.all += 1;
      tally[event.type] += 1;
    }

    const upcoming = allEvents.filter((event) => !isPast(event) && byType(event));
    const past = allEvents.filter((event) => isPast(event) && byType(event));
    return {
      upcomingGroups: groupByDay(upcoming),
      pastGroups: groupByDay(past).reverse(), // Jüngste zuerst
      counts: tally,
      pastCount: past.length,
    };
  }, [allEvents, filter, now]);

  const filterOptions: FilterChipOption<TypeFilter>[] = [
    { value: "all", label: t("filterAll"), count: counts.all },
    { value: "training", label: t("typeTraining"), count: counts.training },
    { value: "competition", label: t("typeCompetition"), count: counts.competition },
    { value: "other", label: t("typeOther"), count: counts.other },
  ];

  /* ----- Optimistische Updates ----- */

  const rsvpsFor = (event: Event) => mergeRsvps(event.rsvps, rsvpOverrides[event.id]);
  const attMapFor = (event: Event) => ({
    ...baseAttendance(event.id),
    ...attOverrides[event.id],
  });

  function setOwnRsvp(eventId: string, memberId: string, status: RsvpStatus, comment?: string) {
    setRsvpOverrides((previous) => ({
      ...previous,
      [eventId]: {
        ...previous[eventId],
        [memberId]: { memberId, status, comment, respondedAt: new Date().toISOString() },
      },
    }));
  }

  function toggleAttendance(eventId: string, memberId: string, present: boolean) {
    setAttOverrides((previous) => ({
      ...previous,
      [eventId]: { ...previous[eventId], [memberId]: present ? "present" : "absent" },
    }));
  }

  const openEvent = openId ? (allEvents.find((event) => event.id === openId) ?? null) : null;
  const openEventPast = openEvent ? new Date(openEvent.endsAt).getTime() < now : false;

  return (
    <div className="grid content-start gap-6">
      <SectionHeader
        level={1}
        eyebrow={t("pageEyebrow")}
        title={t("pageTitle")}
        sub={t("pageSub")}
        action={
          <Button icon="plus" onClick={() => setFormOpen(true)}>
            {t("newEvent")}
          </Button>
        }
      />

      <FilterChips
        options={filterOptions}
        value={filter}
        onChange={setFilter}
        label={t("filterLabel")}
      />

      {upcomingGroups.length === 0 ? (
        <EmptyState
          icon="events"
          title={t("emptyTitle")}
          body={t("emptyBody")}
          action={
            filter === "all" ? (
              <Button variant="secondary" icon="plus" onClick={() => setFormOpen(true)}>
                {t("newEvent")}
              </Button>
            ) : (
              <Button variant="secondary" onClick={() => setFilter("all")}>
                {t("emptyCta")}
              </Button>
            )
          }
        />
      ) : (
        upcomingGroups.map((group) => (
          <DaySection key={group.key} group={group} locale={locale}>
            {group.events.map((event) => (
              <EventCard
                key={event.id}
                event={event}
                rsvps={rsvpsFor(event)}
                onOpen={() => setOpenId(event.id)}
              />
            ))}
          </DaySection>
        ))
      )}

      {pastCount > 0 && (
        <section className="grid gap-4 border-t border-line pt-5">
          <header className="flex flex-wrap items-center gap-2.5">
            <h2 className="font-display text-h3 tracking-[-0.01em] text-ink">{t("pastTitle")}</h2>
            <Badge tone="neutral">{pastCount}</Badge>
            <Button
              variant="ghost"
              size="sm"
              className="ml-auto"
              aria-expanded={pastOpen}
              onClick={() => setPastOpen((open) => !open)}
            >
              {pastOpen ? t("pastHide") : t("pastShow")}
              <Icon
                name="chevronDown"
                className={`ic h-4 w-4 transition-transform duration-150 ${
                  pastOpen ? "rotate-180" : ""
                }`.trim()}
              />
            </Button>
          </header>

          {pastOpen &&
            pastGroups.map((group) => (
              <DaySection key={group.key} group={group} locale={locale}>
                {group.events.map((event) => (
                  <EventCard
                    key={event.id}
                    event={event}
                    rsvps={rsvpsFor(event)}
                    past
                    attendanceMap={attMapFor(event)}
                    onOpen={() => setOpenId(event.id)}
                  />
                ))}
              </DaySection>
            ))}
        </section>
      )}

      {openEvent && (
        <EventDetailSheet
          event={openEvent}
          rsvps={rsvpsFor(openEvent)}
          attendanceMap={attMapFor(openEvent)}
          past={openEventPast}
          onClose={() => setOpenId(null)}
          onSetOwnRsvp={setOwnRsvp}
          onToggleAttendance={toggleAttendance}
        />
      )}

      <NewEventSheet
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onCreate={(event) => setCreated((previous) => [...previous, event])}
      />
    </div>
  );
}

/** Tages-Gruppe: Datum als Zwischentitel, „heute“ als Beere-Chip hervorgehoben. */
function DaySection({
  group,
  locale,
  children,
}: {
  group: DayGroup;
  locale: Locale;
  children: React.ReactNode;
}) {
  const diff = dayDiff(group.iso);
  return (
    <section className="grid gap-3">
      <header className="flex flex-wrap items-center gap-2.5">
        <h2 className="font-display text-h3 tracking-[-0.01em] text-ink">
          {formatDate(group.iso, locale)}
        </h2>
        {diff === 0 ? (
          <Badge tone="brand">{relativeDays(group.iso, locale)}</Badge>
        ) : (
          <span className="text-caption font-semibold text-ink-faint">
            {relativeDays(group.iso, locale)}
          </span>
        )}
      </header>
      <div className="grid gap-3">{children}</div>
    </section>
  );
}
