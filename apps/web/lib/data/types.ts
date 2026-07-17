import type {
  Achievement,
  Attendance,
  AttendanceStatus,
  Club,
  Competition,
  DutyEntry,
  DutyRequirement,
  Equipment,
  EquipmentReservation,
  Event,
  EventAudience,
  EventType,
  Exercise,
  ExerciseCategory,
  Facility,
  FacilityBooking,
  Guardianship,
  Id,
  Invoice,
  LedgerEntry,
  Member,
  MemberRole,
  MemberStatus,
  News,
  Note,
  PlatformClubSummary,
  PlatformStats,
  PlatformUserSummary,
  ReportsSummary,
  Routine,
  RoutineMarker,
  RsvpStatus,
  Task,
  Team,
  TrainingSlot,
} from "@/lib/types";
import type {
  CreateExerciseInput,
  CreateNewsInput,
  CreateNoteInput,
  UpdateExerciseInput,
  UpdateNewsInput,
  UpdateNoteInput,
} from "./inputs-batch1";
import type {
  CreateAchievementInput,
  CreateBookingInput,
  CreateEquipmentInput,
  CreateFacilityInput,
  CreateReservationInput,
  UpdateAchievementInput,
  UpdateBookingInput,
  UpdateEquipmentInput,
  UpdateFacilityInput,
  UpdateReservationInput,
} from "./inputs-batch2";
import type {
  CreateDutyEntryInput,
  CreateDutyRequirementInput,
  CreateTrainingSlotInput,
  UpdateDutyEntryInput,
  UpdateDutyRequirementInput,
  UpdateTrainingSlotInput,
} from "./inputs-batch3";
import type { SupportRepository } from "./inputs-support";
import type { Batch4Repository } from "./inputs-batch4";
import type { Batch5Repository } from "./inputs-batch5";
import type { Cluster6aRepository } from "./inputs-cluster6a";
import type { FinanceRepository } from "./inputs-finance";
import type { FinanceBRepository } from "./inputs-financeb";
import type { FinanceCRepository } from "./inputs-financec";
import type { MeRepository } from "./inputs-me";
import type { MemberProfileRepository } from "./inputs-memberprofile";
import type { ModuleRepository } from "./inputs-clubmodules";
import type { RbacRepository } from "./inputs-rbac";
import type { RegistrierungRepository } from "./inputs-registrierung";
import type { OrgRepository } from "./inputs-org";
import type { PlatformConsoleRepository } from "./inputs-platform";
import type { WettkampfRepository } from "./inputs-wettkampf";

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
  /** Vorgabe "teams". "club" darf nur der Vorstand — der Server prüft es. */
  audience?: EventAudience;
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

export interface DataRepository
  extends Batch4Repository,
    ModuleRepository,
    Batch5Repository,
    Cluster6aRepository,
    FinanceRepository,
    FinanceBRepository,
    FinanceCRepository,
    MeRepository,
    MemberProfileRepository,
    OrgRepository,
    PlatformConsoleRepository,
    RbacRepository,
    RegistrierungRepository,
    SupportRepository,
    WettkampfRepository {
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

  /* ---------- Finanzen (Aggregat-Lesesichten; Draft-Rechnungen gefiltert) ---------- */
  getInvoices(): Promise<Invoice[]>;
  getLedger(): Promise<LedgerEntry[]>;
  // Kassenbuch-Kategorien, Rechnungs-Detail/Settle, Mahnwesen: ./inputs-finance
  // (FinanceRepository) — geerbt. Beiträge, Familienrabatte, SEPA-Mandate:
  // ./inputs-financeb (FinanceBRepository). Bankabgleich, Spenden, Jahresabschluss
  // + Datei-Export: ./inputs-financec (FinanceCRepository) — alle geerbt.

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

  /* ---------- Module: Neuigkeiten (Lesen=Mitglied, Schreiben=Trainer+) ---------- */
  /** Vereins-Neuigkeiten des aktiven Vereins (gepinnt zuerst). */
  listNews(): Promise<News[]>;
  /** Neuigkeit anlegen (is_club_trainer) — liefert die erzeugte Neuigkeit zurück. */
  createNews(input: CreateNewsInput): Promise<News>;
  /** Neuigkeit ändern (is_club_trainer). */
  updateNews(newsId: Id, patch: UpdateNewsInput): Promise<News>;
  /** Neuigkeit soft-löschen (is_club_trainer) — liefert die gelöschte ID zurück. */
  deleteNews(newsId: Id): Promise<{ id: Id }>;

  /* ---------- Module: Notizen (STRIKT privat pro Nutzer) ---------- */
  /** Eigene Notizen (owner = auth.uid(); kein Vereins-Lesepfad). */
  listNotes(): Promise<Note[]>;
  /** Notiz anlegen — liefert die erzeugte Notiz zurück. */
  createNote(input: CreateNoteInput): Promise<Note>;
  /** Notiz ändern. */
  updateNote(noteId: Id, patch: UpdateNoteInput): Promise<Note>;
  /** Notiz soft-löschen — liefert die gelöschte ID zurück. */
  deleteNote(noteId: Id): Promise<{ id: Id }>;

  /* ---------- Module: Übungen (Lesen=Mitglied, Schreiben=Trainer+) ---------- */
  /** Übungs-Katalog des aktiven Vereins, optional nach Kategorie gefiltert. */
  listExercises(category?: ExerciseCategory): Promise<Exercise[]>;
  /** Übung anlegen (is_club_trainer) — liefert die erzeugte Übung zurück. */
  createExercise(input: CreateExerciseInput): Promise<Exercise>;
  /** Übung ändern (is_club_trainer). */
  updateExercise(exerciseId: Id, patch: UpdateExerciseInput): Promise<Exercise>;
  /** Übung soft-löschen (is_club_trainer) — liefert die gelöschte ID zurück. */
  deleteExercise(exerciseId: Id): Promise<{ id: Id }>;

  /* ---------- Module: Hallen (Lesen=Mitglied, Schreiben=Trainer+) ---------- */
  /** Hallen/Trainingsstätten des aktiven Vereins. */
  listFacilities(): Promise<Facility[]>;
  /** Halle anlegen (is_club_trainer) — liefert die erzeugte Halle zurück. */
  createFacility(input: CreateFacilityInput): Promise<Facility>;
  /** Halle ändern (is_club_trainer). */
  updateFacility(facilityId: Id, patch: UpdateFacilityInput): Promise<Facility>;
  /** Halle soft-löschen (is_club_trainer) — liefert die gelöschte ID zurück. */
  deleteFacility(facilityId: Id): Promise<{ id: Id }>;

  /* ---------- Module: Hallenbuchungen (Lesen=Mitglied, Anlegen=Selbst/Trainer) ---------- */
  /** Hallenbuchungen des aktiven Vereins, optional nach Halle gefiltert. */
  listFacilityBookings(facilityId?: Id): Promise<FacilityBooking[]>;
  /** Buchung anlegen (Selbst ODER Trainer fürs Team) — liefert die Buchung zurück. */
  createBooking(input: CreateBookingInput): Promise<FacilityBooking>;
  /** Buchung ändern (Ersteller ODER Trainer). */
  updateBooking(bookingId: Id, patch: UpdateBookingInput): Promise<FacilityBooking>;
  /** Buchung soft-löschen (Ersteller ODER Trainer) — liefert die gelöschte ID zurück. */
  deleteBooking(bookingId: Id): Promise<{ id: Id }>;

  /* ---------- Module: Equipment (Lesen=Mitglied, Schreiben=Trainer+) ---------- */
  /** Ausrüstungsbestand des aktiven Vereins. */
  listEquipment(): Promise<Equipment[]>;
  /** Ausrüstung anlegen (is_club_trainer) — liefert den erzeugten Gegenstand zurück. */
  createEquipment(input: CreateEquipmentInput): Promise<Equipment>;
  /** Ausrüstung ändern (is_club_trainer). */
  updateEquipment(equipmentId: Id, patch: UpdateEquipmentInput): Promise<Equipment>;
  /** Ausrüstung soft-löschen (is_club_trainer) — liefert die gelöschte ID zurück. */
  deleteEquipment(equipmentId: Id): Promise<{ id: Id }>;

  /* ---------- Module: Equipment-Reservierungen (Lesen=Mitglied, Anlegen=Selbst/Trainer) ---------- */
  /** Reservierungen des aktiven Vereins, optional nach Gegenstand gefiltert. */
  listReservations(equipmentId?: Id): Promise<EquipmentReservation[]>;
  /** Reservierung anlegen (Selbst ODER Trainer) — liefert die Reservierung zurück. */
  createReservation(input: CreateReservationInput): Promise<EquipmentReservation>;
  /** Reservierung ändern (Ersteller ODER Trainer). */
  updateReservation(reservationId: Id, patch: UpdateReservationInput): Promise<EquipmentReservation>;
  /** Reservierung soft-löschen (Ersteller ODER Trainer) — liefert die gelöschte ID zurück. */
  deleteReservation(reservationId: Id): Promise<{ id: Id }>;

  /* ---------- Module: Erfolge/Medaillen (Lesen=Mitglied, Vergeben=Trainer+) ---------- */
  /** Erfolge des aktiven Vereins, optional nach Mitglied gefiltert. */
  listAchievements(memberId?: Id): Promise<Achievement[]>;
  /** Erfolg vergeben (is_club_trainer) — liefert den erzeugten Erfolg zurück. */
  createAchievement(input: CreateAchievementInput): Promise<Achievement>;
  /** Erfolg ändern (is_club_trainer). */
  updateAchievement(achievementId: Id, patch: UpdateAchievementInput): Promise<Achievement>;
  /** Erfolg soft-löschen (is_club_trainer) — liefert die gelöschte ID zurück. */
  deleteAchievement(achievementId: Id): Promise<{ id: Id }>;

  /* ---------- Module: Trainingsplan (Lesen=Mitglied, Schreiben=Trainer+) ---------- */
  /** Trainings-Slots des aktiven Vereins, optional nach Team gefiltert. */
  listTrainingSlots(teamId?: Id): Promise<TrainingSlot[]>;
  /** Trainings-Slot anlegen (is_club_trainer) — liefert den erzeugten Slot zurück. */
  createTrainingSlot(input: CreateTrainingSlotInput): Promise<TrainingSlot>;
  /** Trainings-Slot ändern (is_club_trainer). */
  updateTrainingSlot(slotId: Id, patch: UpdateTrainingSlotInput): Promise<TrainingSlot>;
  /** Trainings-Slot soft-löschen (is_club_trainer) — liefert die gelöschte ID zurück. */
  deleteTrainingSlot(slotId: Id): Promise<{ id: Id }>;

  /* ---------- Module: Pflichtstunden-Soll (Lesen=Mitglied, Setzen=Trainer+) ---------- */
  /** Pflichtstunden-Soll des aktiven Vereins, optional nach Team gefiltert. */
  listDutyRequirements(teamId?: Id): Promise<DutyRequirement[]>;
  /** Pflichtstunden-Soll anlegen (is_club_trainer) — liefert die erzeugte Regel zurück. */
  createDutyRequirement(input: CreateDutyRequirementInput): Promise<DutyRequirement>;
  /** Pflichtstunden-Soll ändern (is_club_trainer). */
  updateDutyRequirement(
    requirementId: Id,
    patch: UpdateDutyRequirementInput,
  ): Promise<DutyRequirement>;
  /** Pflichtstunden-Soll soft-löschen (is_club_trainer) — liefert die gelöschte ID zurück. */
  deleteDutyRequirement(requirementId: Id): Promise<{ id: Id }>;

  /* ---------- Module: Pflichtstunden-Ist (Lesen/Erfassen=Selbst ODER Trainer) ---------- */
  /**
   * Erfasste Ist-Stunden, optional nach Mitglied gefiltert. RLS liefert einem
   * einfachen Mitglied ausschließlich die EIGENEN Einträge (member_id-Filter
   * greift zusätzlich, ändert für Trainer die Sicht).
   */
  listDutyEntries(memberId?: Id): Promise<DutyEntry[]>;
  /** Ist-Stunden erfassen (eigenes Mitglied ODER Trainer). `approved` NUR Trainer (sonst 403). */
  createDutyEntry(input: CreateDutyEntryInput): Promise<DutyEntry>;
  /** Ist-Stunden ändern (eigene ODER Trainer). `approved` NUR Trainer. */
  updateDutyEntry(entryId: Id, patch: UpdateDutyEntryInput): Promise<DutyEntry>;
  /** Ist-Stunden soft-löschen (eigene ODER Trainer) — liefert die gelöschte ID zurück. */
  deleteDutyEntry(entryId: Id): Promise<{ id: Id }>;
  /* ---------- Module: Auswertung (NUR Trainer/Admin, reine Lesesicht) ---------- */
  /** Vereins-Auswertung (Mitglieder, Anwesenheit, Finanzen, Medaillen, Termine). */
  getReportsSummary(): Promise<ReportsSummary>;
  // Chat/Check-in/überregionale Events: ./inputs-batch4 (Batch4Repository) — geerbt.
  // Galerie/Dokumente/Entitlement-Gate: ./inputs-batch5 (Batch5Repository) — geerbt.
  // Abteilungen, Schließfächer, Jubiläen: ./inputs-org (OrgRepository) — geerbt.
  // Wettkampf (Rangliste, Live-Wertung, Verbandsmeldung, Kür-Teilen + Token): ./inputs-wettkampf (WettkampfRepository) — geerbt.

  /* ---------- Plattform-Konsole (nur is_platform_admin, reine Lesesicht) ---------- */
  /** Alle Vereine inkl. Mitgliederzahl. */
  platformListClubs(): Promise<PlatformClubSummary[]>;
  /** Alle Nutzerprofile inkl. Vereinszahl. */
  platformListUsers(): Promise<PlatformUserSummary[]>;
  /** Plattform-Kennzahlen. */
  platformStats(): Promise<PlatformStats>;
  // Lizenzen/Zahlungen/Produkte/System/Einstellungen ((super)): ./inputs-platform (PlatformConsoleRepository) — geerbt.
}
