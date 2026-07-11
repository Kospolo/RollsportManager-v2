/**
 * Datenmodell des v2-Portals — englische Typen gemäß Blueprint Abschnitt 4
 * (Englisch, camelCase im Client; Beträge in Cents; Zeiten als ISO-Strings/UTC).
 *
 * In dieser Phase werden die Typen ausschließlich von den Mock-Daten
 * (lib/mock/) erfüllt — es existiert KEINE echte API-Anbindung.
 */

export type Id = string;

// App-Shell-Selbstsicht (eigenes Profil + Präferenzen) lebt ausgelagert in
// lib/types-me.ts, ist aber weiterhin unter "@/lib/types" verfügbar.
export type * from "./types-me";

// Batch-2-Modul-Typen (Hallen, Buchungen, Equipment, Reservierungen, Erfolge)
// leben ausgelagert in lib/types-batch2.ts, sind aber weiterhin unter
// "@/lib/types" verfügbar.
export type * from "./types-batch2";

// Batch-3-Modul-Typen (Trainingsplan, Pflichtstunden, Auswertung) leben
// ausgelagert in lib/types-batch3.ts. Die Label-Maps (dutyKindLabels/
// weekdayLabels) sind Werte und werden zusätzlich als Werte re-exportiert.
export type * from "./types-batch3";
export { dutyKindLabels, weekdayLabels } from "./types-batch3";

// Batch-4-Modul-Typen (Chat, Check-in, überregionale Events) leben ausgelagert
// in lib/types-batch4.ts. Die Label-Maps (chatChannelTypeLabels/
// checkinMethodLabels) sind Werte und werden zusätzlich als Werte re-exportiert.
export type * from "./types-batch4";
export { chatChannelTypeLabels, checkinMethodLabels } from "./types-batch4";

// Batch-5-Modul-Typen (Galerie, Dokumente, Entitlement/PRO-Gate) leben
// ausgelagert in lib/types-batch5.ts. Die Label-Map galleryKindLabels ist ein
// Wert und wird zusätzlich als Wert re-exportiert.
export type * from "./types-batch5";
export { galleryKindLabels } from "./types-batch5";

// Finanz-A-Modul-Typen (Rechnungs-Detail, Kassenbuch-Kategorien, Mahnprotokoll)
// leben ausgelagert in lib/types-finance.ts, sind aber weiterhin unter
// "@/lib/types" verfügbar. InvoiceStatus/LedgerCategoryKind sowie die um Kategorie
// + reversesEntryId erweiterte LedgerEntry bleiben unten in dieser Datei.
export type * from "./types-finance";

// Finanz-B-Modul-Typen (Beitragskategorien, Beitragszuordnungen inkl. Summary,
// Familienrabatte, SEPA-Mandate) leben ausgelagert in lib/types-financeb.ts,
// sind aber weiterhin unter "@/lib/types" verfügbar. Enums (MembershipPeriod,
// FamilyDiscountKind, SepaMandateStatus) sind reine String-Unions (snake_case
// auf dem Draht) und werden als Typen re-exportiert.
export type * from "./types-financeb";

// Finanz-C-Modul-Typen (Bankabgleich, Spenden/Bescheinigungen, Jahresabschluss,
// Datei-Export) leben ausgelagert in lib/types-financec.ts, sind aber weiterhin
// unter "@/lib/types" verfügbar. BankTransactionStatus ist eine reine
// String-Union (snake_case-frei) und wird als Typ re-exportiert.
export type * from "./types-financec";

// Organisations-Modul-Typen (Abteilungen, Schließfächer, Jubiläen) leben
// ausgelagert in lib/types-org.ts, sind aber weiterhin unter "@/lib/types"
// verfügbar. LockerStatus/AnniversaryKind sind reine String-Unions und werden
// als Typen re-exportiert.
export type * from "./types-org";

// Plattform-/Betreiber-Konsolen-Typen ((super)-Bereich: Lizenzen, Zahlungen,
// Produkte, System-Info, Plattform-Einstellungen) leben ausgelagert in
// lib/types-platform.ts, sind aber weiterhin unter "@/lib/types" verfügbar.
// Die Enums (PlatformTier/PlatformEntitlementStatus/…) sind reine String-Unions
// und werden als Typen re-exportiert.
export type * from "./types-platform";

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
  /** Platzierung in der Kategorie (1-basiert); null/undefined wenn (noch) nicht platziert. */
  placement?: number | null;
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

/**
 * Rechnungs-Status. `draft` erscheint NUR in den Verwaltungssichten
 * (getInvoice/listInvoices); die aggregierende getInvoices()-Liste filtert
 * Entwürfe weiterhin heraus. paid/cancelled sind terminal (GoBD, kein Re-Open).
 */
export type InvoiceStatus = "draft" | "open" | "paid" | "cancelled";

/** Kassenbuch-Kategorie-Art: Einnahme (> 0) oder Ausgabe (< 0). */
export type LedgerCategoryKind = "income" | "expense";

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
  /** Freitext-Kategorie (Fallback). Die strukturierte Kategorie ist categoryId. */
  category: string;
  /** Strukturierte Kategorie (aus listLedgerCategories); fehlt = nur Freitext. */
  categoryId?: Id;
  /** Anzeigename der verknüpften Kategorie (aus dem Join). */
  categoryName?: string;
  /** Einnahme/Ausgabe der verknüpften Kategorie (aus dem Join). */
  categoryKind?: LedgerCategoryKind;
  invoiceId?: Id;
  /** Gesetzt = diese Zeile ist die Storno-Gegenbuchung zu reversesEntryId. */
  reversesEntryId?: Id;
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

/* ---------- Wettkampf: Rangliste (Standings) ---------- */

/**
 * Eine Ranglistenzeile — eine gewertete Kür eines Starters in einer Kategorie.
 * Der Server liefert die Zeilen bereits sortiert (category, rank, last_name);
 * fürs UI nach `category` gruppieren (Gruppen-Header). `delta` ist die Differenz
 * des total_score zur unmittelbaren Vorwertung derselben Kür (2 NK, +/-, Farbe
 * grün bei ≥ 0, rot bei < 0); null, wenn es keine Vorwertung gibt.
 */
export interface CompetitionStandingRow {
  category: string;
  /** Rang innerhalb der Kategorie (1-basiert); null, solange kein total_score vorliegt. */
  rank: number | null;
  entryId: Id;
  memberId: Id;
  firstName: string | null;
  lastName: string | null;
  routineId: Id;
  routineTitle: string;
  technicalScore: number | null;
  componentsScore: number | null;
  totalScore: number | null;
  placement: number | null;
  /** total_score minus Vorwertung derselben Kür, auf 2 NK gerundet; null ohne Vorwertung. */
  delta: number | null;
}

/** Rangliste eines Wettkampfs — pro Kategorie gruppiert + gerankt. is_club_member. */
export interface CompetitionStandings {
  competitionId: Id;
  name: string;
  rows: CompetitionStandingRow[];
}

/* ---------- Wettkampf: Kür-Teilen (öffentlicher Token-Link) ---------- */

/**
 * Ergebnis von createRoutineShare — ein öffentlich teilbarer Kür-Link.
 * `url` ist ein RELATIVER Pfad `/wettkampf/kuer/{token}`; im Web zur vollen
 * Teilen-URL zusammensetzen: `${location.origin}${url}` (Copy/QR/WhatsApp).
 * `expiresAt` null = der Link läuft nie ab.
 */
export interface RoutineShare {
  token: string;
  url: string;
  expiresAt: string | null;
}

/* ---------- Wettkampf: öffentliche Kür-Ansicht (UNAUTHENTIFIZIERT) ---------- */

/** Eine Zeitmarke der öffentlichen Kür-Ansicht (ohne interne IDs). */
export interface PublicRoutineMarker {
  timeMs: number | null;
  label: string;
  elementCode: string | null;
}

/** Eine Wertungszeile der öffentlichen Kür-Ansicht (nicht personenbezogen). */
export interface PublicRoutineScore {
  scoredOn: string;
  technicalScore: number | null;
  componentsScore: number | null;
  totalScore: number | null;
  placement: number | null;
}

/**
 * Minimale, NICHT personenbezogene Kür-Daten für die login-freie Token-Ansicht
 * (`/public/routines/{token}`). KEINE Skater-Namen, keine Kontakt-/Finanzdaten —
 * nur Titel, Disziplin, Vereinsname, Musik-Meta, Marker und Wertungen.
 */
export interface PublicRoutine {
  title: string;
  discipline: string | null;
  clubName: string;
  musicTitle: string | null;
  musicArtist: string | null;
  musicBpm: number | null;
  musicDurationMs: number | null;
  markers: PublicRoutineMarker[];
  scores: PublicRoutineScore[];
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
