/**
 * Datenmodell des v2-Portals — englische Typen gemäß Blueprint Abschnitt 4
 * (Englisch, camelCase im Client; Beträge in Cents; Zeiten als ISO-Strings/UTC).
 *
 * In dieser Phase werden die Typen ausschließlich von den Mock-Daten
 * (lib/mock/) erfüllt — es existiert KEINE echte API-Anbindung.
 */

export type Id = string;

// Batch-2-Modul-Typen (Hallen, Buchungen, Equipment, Reservierungen, Erfolge)
// leben ausgelagert in lib/types-batch2.ts, sind aber weiterhin unter
// "@/lib/types" verfügbar.
export type * from "./types-batch2";

// Batch-3-Modul-Typen (Trainingsplan, Pflichtstunden, Auswertung) leben
// ausgelagert in lib/types-batch3.ts. Die Label-Maps (dutyKindLabels/
// weekdayLabels) sind Werte und werden zusätzlich als Werte re-exportiert.
export type * from "./types-batch3";
export { dutyKindLabels, weekdayLabels } from "./types-batch3";

/* ---------- Verein & Menschen ---------- */

export interface Club {
  id: Id;
  name: string;
  shortName: string;
  city: string;
  discipline: string;
  foundedYear: number;
}

export type MemberRole =
  | "owner"
  | "admin"
  | "moderator"
  | "treasurer"
  | "coach"
  | "member"
  | "guest_coach";

export type MemberStatus = "active" | "inactive" | "pending";

export interface Member {
  id: Id;
  clubId: Id;
  firstName: string;
  lastName: string;
  role: MemberRole;
  status: MemberStatus;
  /** ISO-Datum (YYYY-MM-DD) — bei Kindern relevant für Altersklassen */
  birthDate?: string;
  email?: string;
  teamIds: Id[];
  /** ISO-Datum des Vereinsbeitritts */
  joinedAt: string;
  /** Nur bei role === "guest_coach": befristeter Zugang bis (ISO-Datum) */
  guestAccessUntil?: string;
}

/** Familienmodell: Erziehungsberechtigte:r ↔ Kind (beide sind Members). */
export interface Guardianship {
  id: Id;
  guardianId: Id;
  childId: Id;
  relation: "parent" | "grandparent" | "other";
}

export interface Team {
  id: Id;
  clubId: Id;
  name: string;
  ageGroup: string;
  coachIds: Id[];
  /** Läufer:innen des Teams (Roster ohne Trainerstab). */
  skaterIds: Id[];
}

/* ---------- Termine, RSVP & Anwesenheit ---------- */

export type EventType = "training" | "competition" | "other";

/** Antwortoptionen überall identisch: Zusage/Absage/Vielleicht/Krank. */
export type RsvpStatus = "going" | "declined" | "maybe" | "sick";

export interface Rsvp {
  memberId: Id;
  status: RsvpStatus;
  /** Absagegrund/Kommentar — wird als warme Zitat-Blase gerendert */
  comment?: string;
  respondedAt?: string;
}

export interface Event {
  id: Id;
  clubId: Id;
  type: EventType;
  title: string;
  location: string;
  /** ISO-Zeitstempel */
  startsAt: string;
  endsAt: string;
  teamIds: Id[];
  rsvps: Rsvp[];
  note?: string;
  /** Verknüpfung, wenn type === "competition" */
  competitionId?: Id;
}

export type AttendanceStatus = "present" | "absent" | "excused" | "late";

export interface Attendance {
  id: Id;
  eventId: Id;
  memberId: Id;
  status: AttendanceStatus;
  checkedInAt?: string;
}

/* ---------- Küren (Routines) — der USP ---------- */

/** Zustandsautomat: draft → ready → competition → archived */
export type RoutineStatus = "draft" | "ready" | "competition" | "archived";

/** Zeitmarke in der Kür-Musik, optional mit RollArt-Element-Kürzel (2S, SSp, StSq …). */
export interface RoutineMarker {
  id: Id;
  timeMs: number;
  label: string;
  elementCode?: string;
}

/** RollArt-Wertung eines Wettkampfs — der Trend ist der motivierende Wert. */
export interface RollArtScore {
  id: Id;
  date: string;
  competitionId?: Id;
  technical: number;
  components: number;
  total: number;
}

export interface RoutineMusic {
  title: string;
  artist: string;
  durationMs: number;
  bpm?: number;
}

export interface Routine {
  id: Id;
  clubId: Id;
  title: string;
  status: RoutineStatus;
  /** Läufer:innen dieser Kür (Einzel oder Paar/Gruppe) */
  memberIds: Id[];
  teamId?: Id;
  music: RoutineMusic;
  /** Statische, normalisierte Peaks (0..1) für die Waveform-Darstellung */
  waveformPeaks: number[];
  markers: RoutineMarker[];
  scores: RollArtScore[];
  category: string;
}

/* ---------- Finanzen (Seriositätszone) ---------- */

export type InvoiceStatus = "open" | "paid" | "cancelled";

/**
 * Mahnstufen-Treppe (vierstufig, DESIGN-SYSTEM §3.6):
 * 0 = Offen (neutral) · 1 = Erinnerung (info/Petrol) ·
 * 2 = 1. Mahnung (warn) · 3 = 2. Mahnung/Übergabe (danger)
 */
export type DunningLevel = 0 | 1 | 2 | 3;

export interface Invoice {
  id: Id;
  clubId: Id;
  /** Rechnungsnummer aus Nummernkreis, z. B. "R-2026-0087" — immer Mono rendern */
  number: string;
  memberId: Id;
  title: string;
  amountCents: number;
  currency: "EUR";
  issuedAt: string;
  dueAt: string;
  status: InvoiceStatus;
  dunningLevel: DunningLevel;
  paidAt?: string;
}

/** Gegenpartei einer Buchung: Mensch (Avatar) oder Organisation (Icon-Kachel, radius-org). */
export type LedgerCounterparty =
  | { kind: "person"; memberId: Id }
  | { kind: "org"; name: string };

export interface LedgerEntry {
  id: Id;
  clubId: Id;
  date: string;
  description: string;
  counterparty: LedgerCounterparty;
  /** Vorzeichenbehaftet: Einnahmen positiv, Ausgaben negativ */
  amountCents: number;
  category: string;
  invoiceId?: Id;
}

/* ---------- Wettkampf & Aufgaben ---------- */

export type CompetitionStatus = "upcoming" | "running" | "done";

export interface Competition {
  id: Id;
  clubId: Id;
  name: string;
  location: string;
  startsAt: string;
  endsAt?: string;
  registrationDeadline?: string;
  status: CompetitionStatus;
  participantIds: Id[];
  routineIds: Id[];
}

export interface Task {
  id: Id;
  clubId: Id;
  title: string;
  done: boolean;
  dueAt?: string;
  assigneeId?: Id;
  competitionId?: Id;
}

/* ---------- Module: Neuigkeiten, Notizen, Übungen (Batch 1) ---------- */

/**
 * Vereins-Neuigkeit (Schwarzes Brett). Anlegen/Ändern nur Trainerstab+
 * (is_club_trainer), Lesen jedes Mitglied. author_member_id ist eine
 * club_members.id — für die Anzeige über die Member-Liste auflösen.
 */
export interface News {
  id: Id;
  clubId: Id;
  authorMemberId: Id;
  title: string;
  body: string;
  /** Angepinnt = oben einsortieren */
  isPinned: boolean;
  /** ISO-Zeitstempel; undefined = Entwurf (noch nicht veröffentlicht) */
  publishedAt?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Private Notiz — STRIKT nutzergebunden (owner_profile_id = auth.uid()).
 * Kein Vereins-Lesepfad: selbst Plattform-Admins sehen fremde Notizen nie.
 */
export interface Note {
  id: Id;
  ownerProfileId: Id;
  /** Optionale, lose Vereinszuordnung; undefined = ohne Vereinsbezug */
  clubId?: Id;
  title: string;
  body: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Übungs-Kategorie (Referenz §4): aufwärmen/dehnung/kraft/sprung/
 * pirouette/schritt/kombination.
 */
export type ExerciseCategory =
  | "warmup"
  | "stretching"
  | "strength"
  | "jump"
  | "spin"
  | "steps"
  | "combination";

/**
 * Übung aus dem Trainings-Katalog. Anlegen/Ändern nur Trainerstab+
 * (is_club_trainer), Lesen jedes Mitglied. created_by_member_id ist eine
 * club_members.id — für die Anzeige über die Member-Liste auflösen.
 */
export interface Exercise {
  id: Id;
  clubId: Id;
  createdByMemberId: Id;
  name: string;
  description?: string;
  category: ExerciseCategory;
  /** Schwierigkeit 1..5 */
  difficulty?: number;
  videoUrl?: string;
  instructions?: string;
  /** Dauer in Sekunden (> 0) */
  durationSeconds?: number;
  createdAt: string;
  updatedAt: string;
}

/* ---------- Plattform-Ebene (Super-Admin-Konsole, reine Lesesicht) ---------- */

/** Vereins-Übersichtszeile der Plattform-Konsole (GET /platform/clubs). */
export interface PlatformClubSummary {
  id: Id;
  name: string;
  shortName: string;
  city: string;
  discipline: string;
  memberCount: number;
  createdAt: string;
}

/** Nutzerprofil-Zeile der Plattform-Konsole (GET /platform/users). */
export interface PlatformUserSummary {
  id: Id;
  displayName: string;
  locale: string;
  clubCount: number;
  createdAt: string;
}

/** Plattform-Kennzahlen (GET /platform/stats). */
export interface PlatformStats {
  clubs: number;
  users: number;
  members: number;
  activeMembers: number;
  teams: number;
  events: number;
  openInvoices: number;
}
