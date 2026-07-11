import type { Anniversary, Department, Id, Locker, LockerStatus } from "@/lib/types";

/**
 * Eingabe-Typen + Facade-Segment der Organisations-Module (Abteilungen,
 * Schließfächer, Jubiläen). Ausgelagert aus lib/data/types.ts, damit die Datei
 * < 400 Zeilen bleibt; die DataRepository erbt OrgRepository (wie
 * Batch4Repository/FinanceRepository/MeRepository).
 *
 * Rechte sind SERVERSEITIG (RLS + Rollencheck + Trigger app.protect_locker):
 * Abteilungen/Schließfächer anlegen+verwalten = is_club_admin; Abteilungs-
 * Roster + Schließfach assign/release = is_club_trainer; Lesen/Jubiläen =
 * is_club_member. Die Facade reicht nur durch — Gating in der UI ist Anzeige.
 */

/* ---------- Abteilungen ---------- */

/** Abteilung anlegen (is_club_admin). sortOrder default 0 (Server). */
export interface CreateDepartmentInput {
  name: string;
  description?: string;
  /** Abteilungsleitung — Mitglied des Vereins. */
  leadMemberId?: Id;
  sortOrder?: number;
}

/** Abteilung ändern (is_club_admin). null leert description/leadMemberId. */
export interface UpdateDepartmentInput {
  name?: string;
  description?: string | null;
  leadMemberId?: Id | null;
  sortOrder?: number;
}

/**
 * VOLL-Replace des Abteilungs-Rosters (is_club_trainer). Fehlende Mitglieder
 * werden serverseitig soft-detached, zuvor entfernte reaktiviert (Revive per
 * on-conflict). memberIds müssen zum Verein gehören. Weggelassen = leerer Satz.
 */
export interface SetDepartmentMembersInput {
  memberIds: Id[];
}

/* ---------- Schließfächer ---------- */

/** Schließfach anlegen (is_club_admin). status default "free" (Server). */
export interface CreateLockerInput {
  label: string;
  location?: string;
  status?: LockerStatus;
  /** Direkt-Belegung optional; sonst über assignLocker. */
  assignedMemberId?: Id;
  note?: string;
}

/**
 * Schließfach-Stammdaten ändern (NUR is_club_admin). Ein Nicht-Admin-Trainer
 * wird serverseitig auf status+assignedMemberId gekappt (Trigger 42501) —
 * dafür assignLocker/releaseLocker nutzen. null leert location/note.
 */
export interface UpdateLockerInput {
  label?: string;
  location?: string | null;
  status?: LockerStatus;
  assignedMemberId?: Id | null;
  note?: string | null;
}

/** Schließfach einem Mitglied zuweisen (is_club_trainer) — status → assigned. */
export interface AssignLockerInput {
  memberId: Id;
}

/**
 * Facade-Segment der Organisations-Module. DataRepository erbt es (analog
 * FinanceRepository). Lese-Methoden scopen serverseitig über den aktiven Verein
 * (activeClubId), daher parameterlos — wie getTeams()/listFacilities().
 */
export interface OrgRepository {
  /* ---------- Abteilungen (Lesen=Mitglied, Verwalten=Admin, Roster=Trainer) ---------- */
  /** Abteilungen des aktiven Vereins (serverseitig nach sortOrder,name sortiert). */
  listDepartments(): Promise<Department[]>;
  /** Abteilung anlegen (is_club_admin) — liefert die erzeugte Abteilung zurück. */
  createDepartment(input: CreateDepartmentInput): Promise<Department>;
  /** Abteilung ändern (is_club_admin). */
  updateDepartment(departmentId: Id, patch: UpdateDepartmentInput): Promise<Department>;
  /** Abteilung soft-löschen (is_club_admin) — liefert die gelöschte ID zurück. */
  deleteDepartment(departmentId: Id): Promise<{ id: Id }>;
  /** Abteilungs-Roster als VOLL-Replace setzen (is_club_trainer). */
  setDepartmentMembers(departmentId: Id, input: SetDepartmentMembersInput): Promise<Department>;

  /* ---------- Schließfächer (Lesen=Mitglied, Stammdaten=Admin, Belegung=Trainer) ---------- */
  /** Schließfächer des aktiven Vereins. */
  listLockers(): Promise<Locker[]>;
  /** Schließfach anlegen (is_club_admin) — liefert das erzeugte Fach zurück. */
  createLocker(input: CreateLockerInput): Promise<Locker>;
  /** Schließfach-Stammdaten ändern (NUR is_club_admin). */
  updateLocker(lockerId: Id, patch: UpdateLockerInput): Promise<Locker>;
  /** Schließfach soft-löschen (is_club_admin) — liefert die gelöschte ID zurück. */
  deleteLocker(lockerId: Id): Promise<{ id: Id }>;
  /** Schließfach einem Mitglied zuweisen (is_club_trainer) — status → assigned. */
  assignLocker(lockerId: Id, input: AssignLockerInput): Promise<Locker>;
  /** Schließfach freigeben (is_club_trainer) — status → free, Mitglied → null. */
  releaseLocker(lockerId: Id): Promise<Locker>;

  /* ---------- Jubiläen (reine Lesesicht, is_club_member) ---------- */
  /** Anstehende Jubiläen + runde Geburtstage der nächsten 365 Tage. */
  getAnniversaries(): Promise<Anniversary[]>;
}
