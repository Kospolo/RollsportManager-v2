"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { FilterChips, type FilterChipOption } from "@/components/ui/FilterChips";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Skeleton, SkeletonCard } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { Icon } from "@/components/shell/icons";
import { useLocale, useT, type Locale } from "@/lib/i18n";
import { dayDiff, formatDate, relativeDays } from "@/lib/format";
import { data, errorMessage, isForbidden, isNotImplemented } from "@/lib/data";
import { useData } from "@/lib/data/useData";
import type { AttendanceStatus, Event, Rsvp, RsvpStatus } from "@/lib/types";
import { termineDict } from "../i18n";
import {
  baseAttendance,
  groupByDay,
  mergeRsvps,
  RSVP_LABEL_KEY,
  type DayGroup,
  type TypeFilter,
} from "../helpers";
import { EventCard } from "./EventCard";
import { EventDetailSheet } from "./EventDetailSheet";
import { NewEventSheet } from "./NewEventSheet";

/** Stabiler Leer-Fallback, solange die Facade noch lädt (kein useMemo-Flackern). */
const NO_EVENTS: Event[] = [];

/**
 * Termine-Screen: Tagesliste (kommend), Filter-Chips nach Art,
 * einklappbare Vergangenheit, Detail-Sheet und „Neuer Termin“-Formular.
 * Datenquelle ist die Facade (`@/lib/data`); RSVP und Anwesenheit werden
 * optimistisch gesetzt und über die Facade geschrieben (Rollback + Toast
 * bei Fehler). Teams/Anwesenheit sind im api-Modus noch nicht lesbar
 * (NotImplemented) — der Screen zeigt dann Hinweise statt zu crashen.
 */
export function TermineScreen() {
  const t = useT(termineDict);
  const { locale } = useLocale();
  const { showToast } = useToast();

  /* ----- Facade-Reads ----- */

  // Kern-Daten: ohne sie kann der Screen nichts zeigen (Skeleton/Fehler-Gate).
  const core = useData(async (repo) => {
    const [club, events, members, currentUser] = await Promise.all([
      repo.getClub(),
      repo.getEvents(),
      repo.getMembers(),
      repo.getCurrentUser(),
    ]);
    return { club, events, members, currentUser };
  });
  // Sekundär-Daten: im api-Modus (noch) NotImplemented — nicht fatal.
  const teamsState = useData((repo) => repo.getTeams());
  const attendanceState = useData((repo) => repo.getAttendance());

  const teams = teamsState.status === "ready" ? teamsState.data : [];
  const teamsUnavailable = teamsState.status === "error";
  const attendanceRecords = attendanceState.status === "ready" ? attendanceState.data : [];
  const attendanceUnavailable = attendanceState.status === "error";

  /* ----- Lokaler (optimistischer) Zustand ----- */

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

  const events = core.status === "ready" ? core.data.events : NO_EVENTS;
  const allEvents = useMemo(() => [...events, ...created], [events, created]);

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

  /* ----- Optimistische Facade-Writes (Rollback + Toast bei Fehler) ----- */

  const rsvpsFor = (event: Event) => mergeRsvps(event.rsvps, rsvpOverrides[event.id]);
  const attMapFor = (event: Event) => ({
    ...baseAttendance(event.id, attendanceRecords),
    ...attOverrides[event.id],
  });

  function applyRsvpOverride(eventId: string, entry: Rsvp): Rsvp | undefined {
    let previous: Rsvp | undefined;
    setRsvpOverrides((current) => {
      previous = current[eventId]?.[entry.memberId];
      return { ...current, [eventId]: { ...current[eventId], [entry.memberId]: entry } };
    });
    return previous;
  }

  function restoreRsvpOverride(eventId: string, memberId: string, previous: Rsvp | undefined) {
    setRsvpOverrides((current) => {
      const forEvent = { ...current[eventId] };
      if (previous) forEvent[memberId] = previous;
      else delete forEvent[memberId];
      return { ...current, [eventId]: forEvent };
    });
  }

  /** Antwort-Pille: sofort lokal setzen, dann Facade-Write; Fehler → Rollback + Toast. */
  function setOwnRsvp(eventId: string, memberId: string, status: RsvpStatus, comment?: string) {
    const previous = applyRsvpOverride(eventId, {
      memberId,
      status,
      comment,
      respondedAt: new Date().toISOString(),
    });
    void (async () => {
      try {
        await data.setRsvp({ eventId, memberId, status, comment });
        showToast(t("savedToast", { status: t(RSVP_LABEL_KEY[status]) }), { tone: "success" });
      } catch (error) {
        restoreRsvpOverride(eventId, memberId, previous);
        showToast(isForbidden(error) ? t("noPermission") : errorMessage(error), {
          tone: "danger",
          actionLabel: t("retry"),
          onAction: () => setOwnRsvp(eventId, memberId, status, comment),
        });
      }
    })();
  }

  /** Kommentar-Tippen: nur lokal (kein Write pro Tastendruck). */
  function changeOwnComment(eventId: string, memberId: string, status: RsvpStatus, comment: string) {
    applyRsvpOverride(eventId, {
      memberId,
      status,
      comment,
      respondedAt: new Date().toISOString(),
    });
  }

  /** Kommentar-Blur: Facade-Write; Fehler → Eingabe behalten, Toast mit Retry. */
  function commitOwnComment(eventId: string, memberId: string, status: RsvpStatus, comment: string) {
    void (async () => {
      try {
        await data.setRsvp({ eventId, memberId, status, comment });
      } catch (error) {
        showToast(isForbidden(error) ? t("noPermission") : errorMessage(error), {
          tone: "danger",
          actionLabel: t("retry"),
          onAction: () => commitOwnComment(eventId, memberId, status, comment),
        });
      }
    })();
  }

  /** Anwesenheits-Schalter: sofort lokal, dann Facade-Write; Fehler → Rollback + Toast. */
  function toggleAttendance(eventId: string, memberId: string, present: boolean) {
    const status: AttendanceStatus = present ? "present" : "absent";
    let previous: AttendanceStatus | undefined;
    setAttOverrides((current) => {
      previous = current[eventId]?.[memberId];
      return { ...current, [eventId]: { ...current[eventId], [memberId]: status } };
    });
    void (async () => {
      try {
        await data.setAttendance({ eventId, memberId, status });
      } catch (error) {
        setAttOverrides((current) => {
          const forEvent = { ...current[eventId] };
          if (previous) forEvent[memberId] = previous;
          else delete forEvent[memberId];
          return { ...current, [eventId]: forEvent };
        });
        showToast(isForbidden(error) ? t("noPermission") : errorMessage(error), {
          tone: "danger",
          actionLabel: t("retry"),
          onAction: () => toggleAttendance(eventId, memberId, present),
        });
      }
    })();
  }

  /* ----- Zustands-Gates: Fehler → EmptyState, Laden → Skeleton ----- */

  function reloadAll() {
    core.reload();
    teamsState.reload();
    attendanceState.reload();
  }

  const header = (
    <SectionHeader
      level={1}
      eyebrow={t("pageEyebrow")}
      title={t("pageTitle")}
      sub={t("pageSub")}
      action={
        <Button icon="plus" disabled={core.status !== "ready"} onClick={() => setFormOpen(true)}>
          {t("newEvent")}
        </Button>
      }
    />
  );

  if (core.status === "error") {
    return (
      <div className="grid content-start gap-6">
        {header}
        {isNotImplemented(core.error) ? (
          <EmptyState icon="sparkle" title={t("niTitle")} body={t("niBody")} />
        ) : (
          <EmptyState
            icon="zap"
            title={t("loadErrorTitle")}
            body={errorMessage(core.error)}
            action={
              <Button variant="secondary" onClick={reloadAll}>
                {t("loadErrorRetry")}
              </Button>
            }
          />
        )}
      </div>
    );
  }

  if (
    core.status === "loading" ||
    teamsState.status === "loading" ||
    attendanceState.status === "loading"
  ) {
    return (
      <div className="grid content-start gap-6">
        {header}
        <Skeleton className="h-9 w-full max-w-md rounded-full" />
        <div className="grid gap-3">
          <Skeleton className="h-6 w-48" />
          <SkeletonCard lines={2} />
          <SkeletonCard lines={2} />
        </div>
        <div className="grid gap-3">
          <Skeleton className="h-6 w-48" />
          <SkeletonCard lines={2} />
        </div>
      </div>
    );
  }

  const { members, currentUser } = core.data;

  const filterOptions: FilterChipOption<TypeFilter>[] = [
    { value: "all", label: t("filterAll"), count: counts.all },
    { value: "training", label: t("typeTraining"), count: counts.training },
    { value: "competition", label: t("typeCompetition"), count: counts.competition },
    { value: "other", label: t("typeOther"), count: counts.other },
  ];

  const openEvent = openId ? (allEvents.find((event) => event.id === openId) ?? null) : null;
  const openEventPast = openEvent ? new Date(openEvent.endsAt).getTime() < now : false;

  return (
    <div className="grid content-start gap-6">
      {header}

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
                members={members}
                teams={teams}
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
                    members={members}
                    teams={teams}
                    past
                    attendanceMap={attMapFor(event)}
                    attendanceUnavailable={attendanceUnavailable}
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
          attendanceRecords={attendanceRecords}
          attendanceReadUnavailable={attendanceUnavailable}
          members={members}
          teams={teams}
          currentUser={currentUser}
          past={openEventPast}
          onClose={() => setOpenId(null)}
          onSetOwnRsvp={setOwnRsvp}
          onChangeOwnComment={changeOwnComment}
          onCommitOwnComment={commitOwnComment}
          onToggleAttendance={toggleAttendance}
        />
      )}

      <NewEventSheet
        open={formOpen}
        onClose={() => setFormOpen(false)}
        teams={teams}
        teamsUnavailable={teamsUnavailable}
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
