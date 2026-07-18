import { memberById } from "@/lib/data";
import type {
  Attendance,
  AttendanceStatus,
  Event,
  EventType,
  Member,
  Rsvp,
  RsvpStatus,
  Team,
} from "@/lib/types";
import type { BadgeTone } from "@/components/ui/Badge";
import type { termineDict } from "./i18n";

/**
 * Kolokalisierte Helfer des Termine-Screens — reine Ableitungen.
 * Alle Daten (Mitglieder, Teams, Anwesenheit) kommen als Parameter aus der
 * Facade (`@/lib/data`) — hier gibt es KEINEN lib/mock-Import mehr.
 */

export type TermineKey = keyof (typeof termineDict)["de"];

export type TypeFilter = "all" | EventType;

/** Badge-Ton je Termin-Art — Honig bleibt exklusiv der Musik vorbehalten. */
export const TYPE_TONE: Record<EventType, BadgeTone> = {
  training: "neutral",
  competition: "brand",
  other: "info",
};

export const TYPE_LABEL_KEY: Record<EventType, TermineKey> = {
  training: "typeTraining",
  competition: "typeCompetition",
  other: "typeOther",
};

export const RSVP_LABEL_KEY: Record<RsvpStatus | "none", TermineKey> = {
  going: "rsvpGoing",
  maybe: "rsvpMaybe",
  declined: "rsvpDeclined",
  sick: "rsvpSick",
  none: "rsvpOpen",
};

export const RSVP_TONE: Record<RsvpStatus | "none", BadgeTone> = {
  going: "success",
  maybe: "info",
  declined: "danger",
  sick: "warn",
  none: "neutral",
};

/** Sortierreihenfolge in der Teilnehmerliste: Zusagen zuerst, Offene zuletzt. */
export const RSVP_ORDER: Record<RsvpStatus | "none", number> = {
  going: 0,
  maybe: 1,
  sick: 2,
  declined: 3,
  none: 4,
};

/** Eingeladen sind alle aktiven Mitglieder der Termin-Teams plus alle, die geantwortet haben. */
export function participantsOf(event: Event, rsvps: Rsvp[], members: Member[]): Member[] {
  const map = new Map<string, Member>();
  for (const member of members) {
    if (member.role !== "member") continue;
    if (member.teamIds.some((teamId) => event.teamIds.includes(teamId))) {
      map.set(member.id, member);
    }
  }
  for (const rsvp of rsvps) {
    const member = memberById(members, rsvp.memberId);
    if (member) map.set(member.id, member);
  }
  return [...map.values()];
}

/** Klartext-Zahlen für Legende und Balken: Krank zählt wie Absage, Vielleicht wie offen. */
export function rsvpCounts(participantCount: number, rsvps: Rsvp[]) {
  let yes = 0;
  let no = 0;
  for (const rsvp of rsvps) {
    if (rsvp.status === "going") yes += 1;
    else if (rsvp.status === "declined" || rsvp.status === "sick") no += 1;
  }
  return { yes, no, open: Math.max(participantCount - yes - no, 0) };
}

/** Basis-RSVPs + lokale (optimistische) Überschreibungen, Reihenfolge stabil. */
export function mergeRsvps(base: Rsvp[], overrides?: Record<string, Rsvp>): Rsvp[] {
  if (!overrides) return base;
  const seen = new Set<string>();
  const merged = base.map((rsvp) => {
    seen.add(rsvp.memberId);
    return overrides[rsvp.memberId] ?? rsvp;
  });
  for (const override of Object.values(overrides)) {
    if (!seen.has(override.memberId)) merged.push(override);
  }
  return merged;
}

export function teamsOf(event: Event, teams: Team[]): Team[] {
  return teams.filter((team) => event.teamIds.includes(team.id));
}

export function teamNameOf(member: Member, teams: Team[]): string | undefined {
  return teams.find((team) => member.teamIds.includes(team.id))?.name;
}

/** Erfasste Anwesenheit eines Termins aus den geladenen Datensätzen (memberId → Status). */
export function baseAttendance(
  eventId: string,
  records: Attendance[],
): Record<string, AttendanceStatus> {
  const map: Record<string, AttendanceStatus> = {};
  for (const record of records) {
    if (record.eventId === eventId) map[record.memberId] = record.status;
  }
  return map;
}

/** Check-in-Zeitstempel aus den geladenen Datensätzen, falls vorhanden. */
export function checkinIso(
  eventId: string,
  memberId: string,
  records: Attendance[],
): string | undefined {
  return records.find(
    (record) => record.eventId === eventId && record.memberId === memberId,
  )?.checkedInAt;
}

export function attendanceCounts(
  participants: Member[],
  map: Record<string, AttendanceStatus>,
) {
  let present = 0;
  let recorded = 0;
  for (const participant of participants) {
    const status = map[participant.id];
    if (status) recorded += 1;
    if (status === "present" || status === "late") present += 1;
  }
  return { present, recorded };
}

export type DayGroup = { key: string; iso: string; events: Event[] };

/** Termine nach Kalendertag gruppieren (lokale Zeit), aufsteigend sortiert. */
export function groupByDay(list: Event[]): DayGroup[] {
  const groups = new Map<string, DayGroup>();
  const sorted = [...list].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  for (const event of sorted) {
    const d = new Date(event.startsAt);
    const key = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
    const group = groups.get(key);
    if (group) group.events.push(event);
    else groups.set(key, { key, iso: event.startsAt, events: [event] });
  }
  return [...groups.values()];
}

/**
 * Volljährig? Grundlage der Anzeige-Regel „Minderjährige bieten keine Fahrt an"
 * (Fahrgemeinschaften, Migration 0066).
 *
 * OHNE Geburtsdatum wird ERLAUBT — dieselbe Richtung wie der DB-Trigger. Das
 * ist bewusst und nicht bequem: im Bestand fehlt das Geburtsdatum ausgerechnet
 * bei den Erwachsenen, fail-closed würde also die Fahrer aussperren. Der Riegel
 * greift, sobald das Datum gepflegt ist — und die Datenbank entscheidet ohnehin
 * noch einmal selbst.
 */
export function isAdultMember(member: Member): boolean {
  if (!member.birthDate) return true;
  const birth = new Date(member.birthDate);
  const eighteenth = new Date(birth.getFullYear() + 18, birth.getMonth(), birth.getDate());
  return eighteenth.getTime() <= Date.now();
}
