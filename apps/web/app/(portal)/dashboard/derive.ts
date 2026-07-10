import type { Competition, Event, Member, Routine, RsvpStatus } from "@/lib/types";
import { memberById } from "@/lib/data";
import { dayDiff } from "@/lib/format";

/**
 * Abgeleitete Dashboard-Daten — pure Funktionen über den von der
 * Daten-Facade (lib/data) geladenen Arrays, nie hart codiert. Alle
 * Funktionen sind reine Ableitungen ohne eigenen Datenzugriff und
 * funktionieren dadurch für Mock- und api-Quelle identisch.
 */

/* ---------- Einheiten (Heute-Karte) ---------- */

export interface SessionNote {
  member: Member;
  status: Extract<RsvpStatus, "declined" | "sick" | "maybe">;
  comment: string;
}

export interface SessionInfo {
  event: Event;
  isToday: boolean;
  /** Eingeladene Aktive (role=member) der verknüpften Teams */
  roster: Member[];
  invitedCount: number;
  yes: number;
  no: number;
  open: number;
  /** Zugesagte Personen für den Avatar-Stapel */
  going: Member[];
  note?: SessionNote;
  rsvpByMember: Record<string, RsvpStatus>;
}

function toSessionInfo(event: Event, members: Member[]): SessionInfo {
  const roster = members.filter(
    (m) =>
      m.role === "member" &&
      m.status !== "inactive" &&
      m.teamIds.some((teamId) => event.teamIds.includes(teamId)),
  );

  const rsvpByMember: Record<string, RsvpStatus> = {};
  for (const rsvp of event.rsvps) rsvpByMember[rsvp.memberId] = rsvp.status;

  /* Eingeladen = Team-Roster ∪ alle, die geantwortet haben (z. B. Eltern). */
  const invitedIds = new Set(roster.map((m) => m.id));
  for (const rsvp of event.rsvps) invitedIds.add(rsvp.memberId);

  const yes = event.rsvps.filter((r) => r.status === "going").length;
  const no = event.rsvps.filter((r) => r.status === "declined" || r.status === "sick").length;
  const open = Math.max(0, invitedIds.size - yes - no);

  const going = event.rsvps
    .filter((r) => r.status === "going")
    .map((r) => memberById(members, r.memberId))
    .filter((m): m is Member => Boolean(m));

  /* Absagegrund-Blase: Absage/Krank zuerst, sonst ein „Vielleicht“-Kommentar. */
  const noteRsvp =
    event.rsvps.find((r) => (r.status === "declined" || r.status === "sick") && r.comment) ??
    event.rsvps.find((r) => r.status === "maybe" && r.comment);
  const noteMember = noteRsvp ? memberById(members, noteRsvp.memberId) : undefined;

  return {
    event,
    isToday: dayDiff(event.startsAt) === 0,
    roster,
    invitedCount: invitedIds.size,
    yes,
    no,
    open,
    going,
    note:
      noteRsvp && noteMember && noteRsvp.comment
        ? {
            member: noteMember,
            status: noteRsvp.status as SessionNote["status"],
            comment: noteRsvp.comment,
          }
        : undefined,
    rsvpByMember,
  };
}

/** Heutige und nächste Einheiten (heutige bleiben auch nach Ende sichtbar). */
export function upcomingSessions(events: Event[], members: Member[], limit = 3): SessionInfo[] {
  return events
    .filter((e) => dayDiff(e.startsAt) >= 0)
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
    .slice(0, limit)
    .map((event) => toSessionInfo(event, members));
}

/** Alle heutigen Termine (für die Kopfzeile „n Einheiten heute“). */
export function todayEvents(events: Event[]): Event[] {
  return events
    .filter((e) => dayDiff(e.startsAt) === 0)
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

/** Der zeitlich nächste, noch nicht gestartete Termin (KPI-Kachel). */
export function nextEvent(events: Event[]): Event | undefined {
  const now = Date.now();
  return events
    .filter((e) => new Date(e.startsAt).getTime() >= now)
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))[0];
}

/* ---------- Countdown-Hero ---------- */

export interface CompetitionInfo {
  competition: Competition;
  days: number;
  participants: Member[];
  /** Hinweis aus dem verknüpften Termin (z. B. Treffpunkt) */
  note?: string;
}

export function nextCompetitionInfo(
  competitions: Competition[],
  events: Event[],
  members: Member[],
): CompetitionInfo | null {
  const upcoming = competitions
    .filter((c) => c.status === "upcoming" && dayDiff(c.startsAt) >= 0)
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))[0];
  if (!upcoming) return null;

  const participants = upcoming.participantIds
    .map((id) => memberById(members, id))
    .filter((m): m is Member => Boolean(m));

  const linkedEvent = events.find((e) => e.competitionId === upcoming.id);

  return {
    competition: upcoming,
    days: dayDiff(upcoming.startsAt),
    participants,
    note: linkedEvent?.note,
  };
}

/* ---------- KPI-Zeile ---------- */

export function activeMemberCount(members: Member[]): number {
  return members.filter((m) => m.status === "active").length;
}

export function pendingMemberCount(members: Member[]): number {
  return members.filter((m) => m.status === "pending").length;
}

/* ---------- Küren-Schnellzugriff ---------- */

const ROUTINE_ORDER: Record<Routine["status"], number> = {
  competition: 0,
  ready: 1,
  draft: 2,
  archived: 3,
};

/** Aktive Küren, Wettkampf-Küren zuerst — die erste gilt als „zuletzt geübt“. */
export function recentRoutines(routines: Routine[], limit = 3): Routine[] {
  return [...routines]
    .filter((r) => r.status !== "archived")
    .sort((a, b) => ROUTINE_ORDER[a.status] - ROUTINE_ORDER[b.status])
    .slice(0, limit);
}
