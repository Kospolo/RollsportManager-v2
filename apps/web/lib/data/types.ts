import type {
  Attendance,
  AttendanceStatus,
  Club,
  Competition,
  Event,
  EventType,
  Guardianship,
  Id,
  Invoice,
  LedgerEntry,
  Member,
  MemberRole,
  MemberStatus,
  PlatformClubSummary,
  PlatformStats,
  PlatformUserSummary,
  Routine,
  RoutineMarker,
  RsvpStatus,
  Task,
  Team,
} from "@/lib/types";

/**
 * Repository-Facade des Portals — die EINZIGE Datenquelle für Screens.
 *
 * Zwei Implementierungen (lib/data/mock, lib/data/api), Auswahl zentral in
 * lib/data/index.ts über NEXT_PUBLIC_DATA_SOURCE (Default: mock).
 * Alle Zugriffe sind async; die View-Typen kommen weiterhin aus lib/types.
 *
 * Fehlervertrag: fehlende API-Endpoints werfen NotImplementedError
 * (lib/data/errors), echte API-Fehler kommen als ApiError (RFC 7807).
 */

/** Rollen, die vergeben werden dürfen — owner ist nie zuweisbar. */
export type AssignableRole = Exclude<MemberRole, "owner">;

/** Zusammengefasstes Ergebnis eines Mahnlaufs (dry_run-Default: true). */
export interface DunningRunOutcome {
  dryRun: boolean;
  /** Anzahl geprüfter offener Rechnungen mit Vorschlag */
  total: number;
  /** Automatisch anwendbar (nur Stufe 1 — Zahlungserinnerung) */
  auto: number;
  /** Stufe ≥ 2 — braucht immer explizite Freigabe */
  pendingApproval: number;
  /** Keine Aktion fällig */
  none: number;
}

export interface SetRsvpInput {
  eventId: Id;
  memberId: Id;
  status: RsvpStatus;
  comment?: string;
}

export interface SetAttendanceInput {
  eventId: Id;
  memberId: Id;
  status: AttendanceStatus;
  /** ISO-Zeitstempel des Check-ins */
  checkedInAt?: string;
}

/** Eingabe zum Anlegen eines Termins (owner/admin/coach). */
export interface CreateEventInput {
  type: EventType;
  title: string;
  location?: string;
  /** ISO-Zeitstempel */
  startsAt: string;
  endsAt: string;
  teamIds?: Id[];
  note?: string;
}

/** Eingabe für eine Vereins-Einladung per E-Mail (owner/admin). */
export interface InviteMemberInput {
  email: string;
  role?: AssignableRole;
}

/** Eingabe für einen neuen Kür-Marker (Trainerstab inkl. Gasttrainer). */
export interface AddMarkerInput {
  timeMs: number;
  label: string;
  elementCode?: string;
}

/**
 * Stammdaten-Patch eines Mitglieds (can_manage_members) — OHNE Rolle.
 * Die Rolle läuft ausschließlich über changeMemberRole. null leert das Feld.
 */
export interface UpdateMemberInput {
  firstName?: string;
  lastName?: string;
  email?: string | null;
  /** ISO-Datum (YYYY-MM-DD) */
  birthDate?: string | null;
  status?: MemberStatus;
  /** Nur guest_coach: befristeter Zugang bis (ISO-Datum) */
  validUntil?: string | null;
}

/** Eingabe zum Anlegen eines Teams (is_club_admin). */
export interface CreateTeamInput {
  name: string;
  ageGroup?: string;
}

/** Team umbenennen / Altersklasse ändern (is_club_admin). null leert die Altersklasse. */
export interface UpdateTeamInput {
  name?: string;
  ageGroup?: string | null;
}

/**
 * VOLL-Replace des Team-Rosters (is_club_admin). Fehlende Mitglieder werden
 * serverseitig soft-detached; bei Überschneidung gewinnt coach. Die member_ids
 * müssen zum Verein gehören (sonst 400). Weggelassene Liste = leerer Satz.
 */
export interface SetTeamMembersInput {
  coachIds?: Id[];
  skaterIds?: Id[];
}

/** Vereins-Einstellungen ändern (owner/admin). */
export interface UpdateClubSettingsInput {
  name?: string;
  shortName?: string | null;
  city?: string | null;
  discipline?: string | null;
  /** Freies Settings-Objekt (Modulschalter etc.) — im View-Modell nicht gespiegelt. */
  settings?: Record<string, unknown>;
}

export interface DataRepository {
  /* ---------- Verein & Menschen ---------- */
  getClub(): Promise<Club>;
  getMembers(): Promise<Member[]>;
  getMemberById(id: Id): Promise<Member | undefined>;
  getTeams(): Promise<Team[]>;
  getGuardianships(): Promise<Guardianship[]>;
  /** Die eingeloggte Person als Member (mock: Sandra Vogel; api: aus dem Dev-Login-Profil). */
  getCurrentUser(): Promise<Member>;

  /* ---------- Termine, RSVP & Anwesenheit ---------- */
  getEvents(): Promise<Event[]>;
  getUpcomingEvents(withinDays?: number): Promise<Event[]>;
  getAttendance(): Promise<Attendance[]>;

  /* ---------- Küren ---------- */
  getRoutines(): Promise<Routine[]>;
  getRoutineById(id: Id): Promise<Routine | undefined>;

  /* ---------- Finanzen ---------- */
  getInvoices(): Promise<Invoice[]>;
  getLedger(): Promise<LedgerEntry[]>;

  /* ---------- Wettkampf & Aufgaben ---------- */
  getCompetitions(): Promise<Competition[]>;
  getTasks(): Promise<Task[]>;

  /* ---------- Schreibpfade ---------- */
  /** RSVP setzen/ändern (Upsert auf Event+Member). */
  setRsvp(input: SetRsvpInput): Promise<boolean>;
  /** Anwesenheit erfassen (Trainerstab inkl. Gasttrainer). */
  setAttendance(input: SetAttendanceInput): Promise<boolean>;
  /** Mitglieds-Rolle ändern (owner/admin; nie sich selbst; letzter Owner geschützt). */
  changeMemberRole(memberId: Id, role: AssignableRole): Promise<boolean>;
  /** Mahnlauf — Default dry_run=true; Stufe ≥ 2 wird nie automatisch geschrieben. */
  runDunning(options?: { dryRun?: boolean }): Promise<DunningRunOutcome>;
  /** Aufgabe abhaken/reaktivieren. */
  setTaskDone(taskId: Id, done: boolean): Promise<boolean>;
  /** Termin anlegen — liefert den erzeugten Termin (mit echter ID im api-Modus) zurück. */
  createEvent(input: CreateEventInput): Promise<Event>;
  /** Person per E-Mail in den Verein einladen. */
  inviteMember(input: InviteMemberInput): Promise<{ email: string }>;
  /** Kür-Marker hinzufügen — liefert den erzeugten Marker zurück. */
  addRoutineMarker(routineId: Id, input: AddMarkerInput): Promise<RoutineMarker>;

  /* ---------- Verwaltung: Mitglieder-Stammdaten ---------- */
  /** Stammdaten eines Mitglieds ändern (OHNE Rolle; can_manage_members). */
  updateMember(memberId: Id, patch: UpdateMemberInput): Promise<Member>;

  /* ---------- Verwaltung: Teams ---------- */
  /** Team anlegen (is_club_admin) — liefert das erzeugte Team zurück. */
  createTeam(input: CreateTeamInput): Promise<Team>;
  /** Team umbenennen / Altersklasse ändern (is_club_admin). */
  updateTeam(teamId: Id, patch: UpdateTeamInput): Promise<Team>;
  /** Team soft-löschen (is_club_admin) — liefert die gelöschte ID zurück. */
  deleteTeam(teamId: Id): Promise<{ id: Id }>;
  /** Team-Roster (Läufer:innen + Trainerstab) als VOLL-Replace setzen (is_club_admin). */
  setTeamMembers(teamId: Id, input: SetTeamMembersInput): Promise<Team>;

  /* ---------- Verwaltung: Vereins-Einstellungen ---------- */
  /** Vereins-Stammdaten/-Einstellungen ändern (owner/admin). */
  updateClubSettings(patch: UpdateClubSettingsInput): Promise<Club>;

  /* ---------- Plattform-Konsole (nur is_platform_admin, reine Lesesicht) ---------- */
  /** Alle Vereine inkl. Mitgliederzahl. */
  platformListClubs(): Promise<PlatformClubSummary[]>;
  /** Alle Nutzerprofile inkl. Vereinszahl. */
  platformListUsers(): Promise<PlatformUserSummary[]>;
  /** Plattform-Kennzahlen. */
  platformStats(): Promise<PlatformStats>;
}
