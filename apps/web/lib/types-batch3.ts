import type { EventType, Id, MemberRole } from "./types";

/**
 * View-Typen der Batch-3-Module (Trainingsplan, Pflichtstunden, Auswertung).
 * Ausgelagert aus lib/types.ts (< 400 Zeilen) und dort per
 * `export type * from "./types-batch3"` wieder unter "@/lib/types" verfügbar.
 * Die Label-Maps (DE/EN) werden zusätzlich als Werte aus lib/types.ts
 * re-exportiert (siehe dortiges `export { dutyKindLabels, weekdayLabels }`).
 */

/* ---------- Trainingsplan (Trainings-Slots) ---------- */

/**
 * Wochentag 0..6 mit 0 = Montag … 6 = Sonntag (Backend-Konvention, migration
 * 0010). ACHTUNG: NICHT identisch mit JS `Date.getDay()` (dort 0 = Sonntag)!
 * Zum Mappen: `(getDay() + 6) % 7`.
 */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/**
 * Wiederkehrender Trainings-Slot im Wochenraster. Lesen = jedes Mitglied
 * (is_club_member), Anlegen/Ändern = Trainerstab+ (is_club_trainer).
 * team/facility/coach/location sind optional. startsTime/endsTime kommen
 * als 'HH:MM:SS'-Strings vom Server.
 */
export interface TrainingSlot {
  id: Id;
  clubId: Id;
  teamId?: Id;
  weekday: Weekday;
  /** Ortszeit 'HH:MM:SS' */
  startsTime: string;
  /** Ortszeit 'HH:MM:SS' */
  endsTime: string;
  facilityId?: Id;
  location?: string;
  coachMemberId?: Id;
  note?: string;
  createdAt: string;
  updatedAt: string;
}

/* ---------- Pflichtstunden-Soll (Duty Requirements) ---------- */

/**
 * Pflichtstunden-Soll. Kaskadierend: teamId+memberId beide leer = Vereinsregel,
 * nur teamId = Teamregel, memberId = Mitgliedsregel. Lesen = jedes Mitglied,
 * Setzen = Trainerstab+ (is_club_trainer). requiredHours ist eine Dezimalzahl.
 */
export interface DutyRequirement {
  id: Id;
  clubId: Id;
  teamId?: Id;
  memberId?: Id;
  seasonLabel: string;
  /** Soll-Stunden (Dezimal, z. B. 12.5) */
  requiredHours: number;
  /** ISO-Datum (YYYY-MM-DD) */
  periodStart: string;
  /** ISO-Datum (YYYY-MM-DD) */
  periodEnd: string;
  createdAt: string;
  updatedAt: string;
}

/* ---------- Pflichtstunden-Ist (Duty Entries) ---------- */

/** Art einer erfassten Pflichtstunde: Training/Helfer/Wettkampf/Sonstiges. */
export type DutyKind = "training" | "helper" | "competition" | "other";

/**
 * Erfasste Ist-Stunden eines Mitglieds. Lesen/Erfassen = eigenes Mitglied ODER
 * Trainerstab (RLS: Mitglied sieht nur eigene). `approved` darf NUR Trainerstab
 * setzen (DB-Trigger app.duty_entries_guard_approved → 42501, plus API-403).
 * hours > 0; kind default 'training'; approved default false.
 */
export interface DutyEntry {
  id: Id;
  clubId: Id;
  memberId: Id;
  /** Geleistete Stunden (Dezimal, > 0) */
  hours: number;
  /** ISO-Datum (YYYY-MM-DD) */
  activityDate: string;
  kind: DutyKind;
  note?: string;
  approved: boolean;
  createdAt: string;
  updatedAt: string;
}

/* ---------- Auswertung (Reports Summary) ---------- */

/** Mitgliederzahl je Vereinsrolle. */
export interface ReportRoleCount {
  role: MemberRole;
  count: number;
}

/** Läufer:innen-Zahl je Team. */
export interface ReportTeamCount {
  teamId: Id;
  teamName: string;
  memberCount: number;
}

/** Medaillenspiegel des Vereins. */
export interface ReportMedalCounts {
  gold: number;
  silver: number;
  bronze: number;
}

/** Kommender Termin in der Auswertung (die nächsten 5). */
export interface ReportUpcomingEvent {
  id: Id;
  title: string;
  type: EventType;
  /** ISO-Zeitstempel */
  startsAt: string;
}

/**
 * Vereins-Auswertung (GET /reports/summary). NUR Trainerstab/Admin
 * (requireClubRole COACH_ROLES); Aggregat ist service-mode auf die eine
 * club_id gescoped. Beträge sind Integer-Cents. attendanceRate ist ein
 * Float 0..1 ((present+late)/alle Anwesenheiten), auf 4 Stellen gerundet.
 */
export interface ReportsSummary {
  clubId: Id;
  membersTotal: number;
  membersActive: number;
  membersByRole: ReportRoleCount[];
  membersByTeam: ReportTeamCount[];
  /** Float 0..1 */
  attendanceRate: number;
  openInvoicesTotalCents: number;
  openInvoicesCount: number;
  medals: ReportMedalCounts;
  upcomingEventsCount: number;
  upcomingEvents: ReportUpcomingEvent[];
}

/* ---------- Enum-Labels (DE/EN, echte Umlaute) ---------- */

/** Anzeige-Labels für DutyKind in beiden Sprachen. */
export const dutyKindLabels: Record<DutyKind, { de: string; en: string }> = {
  training: { de: "Training", en: "Training" },
  helper: { de: "Helfer", en: "Helper" },
  competition: { de: "Wettkampf", en: "Competition" },
  other: { de: "Sonstiges", en: "Other" },
};

/** Anzeige-Labels für Weekday (0 = Montag … 6 = Sonntag) in beiden Sprachen. */
export const weekdayLabels: Record<Weekday, { de: string; en: string }> = {
  0: { de: "Montag", en: "Monday" },
  1: { de: "Dienstag", en: "Tuesday" },
  2: { de: "Mittwoch", en: "Wednesday" },
  3: { de: "Donnerstag", en: "Thursday" },
  4: { de: "Freitag", en: "Friday" },
  5: { de: "Samstag", en: "Saturday" },
  6: { de: "Sonntag", en: "Sunday" },
};
