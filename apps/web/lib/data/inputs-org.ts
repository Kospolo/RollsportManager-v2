import type {
  Anniversary,
  Department,
  Id,
  Locker,
  LockerRental,
  LockerRentalStatus,
  LockerSize,
  LockerStatus,
} from "@/lib/types";

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

/** Schließfach anlegen (is_club_admin). status default "free", size "mittel". */
export interface CreateLockerInput {
  label: string;
  location?: string;
  status?: LockerStatus;
  /** Baugröße; Server-Default "mittel". */
  size?: LockerSize;
  /**
   * LISTENPREIS je Monat in Cent. Weggelassen = Server-Default (null, „kein
   * Preis festgelegt"); explizit null setzt ihn zurück; 0 heißt „kostenlos".
   */
  pricePerMonthCents?: number | null;
  /** Direkt-Belegung optional; sonst über assignLocker. */
  assignedMemberId?: Id;
  note?: string;
}

/**
 * Schließfach-Stammdaten ändern (NUR is_club_admin). Ein Nicht-Admin-Trainer
 * wird serverseitig auf status+assignedMemberId gekappt (Trigger 42501) —
 * dafür assignLocker/releaseLocker nutzen. null leert location/note bzw. setzt
 * den Listenpreis auf „nicht festgelegt" zurück.
 */
export interface UpdateLockerInput {
  label?: string;
  location?: string | null;
  status?: LockerStatus;
  size?: LockerSize;
  pricePerMonthCents?: number | null;
  assignedMemberId?: Id | null;
  note?: string | null;
}

/** Schließfach einem Mitglied zuweisen (is_club_trainer) — status → assigned. */
export interface AssignLockerInput {
  memberId: Id;
}

/* ---------- Vermietung (0070) ---------- */

/**
 * Fach vermieten (owner/admin/treasurer). `pricePerMonthCents` ist der
 * VEREINBARTE Preis — die Oberfläche belegt ihn mit dem Listenpreis des Fachs
 * vor, ein Mensch entscheidet. Weggelassen ≠ null ≠ 0:
 *   weggelassen → Server-Default (null),
 *   null        → ausdrücklich „nicht festgelegt",
 *   0           → ausdrücklich kostenlos.
 * Ein Fach kann nur EINEN aktiven Vertrag haben (Teilindex) → sonst 409.
 */
export interface CreateLockerRentalInput {
  lockerId: Id;
  memberId: Id;
  pricePerMonthCents?: number | null;
  /** ISO-Datum (YYYY-MM-DD). */
  startOn: string;
  endOn?: string | null;
  /** Default "aktiv" (Server). */
  status?: LockerRentalStatus;
  note?: string | null;
}

/**
 * Vermietung ändern (owner/admin/treasurer): Preis, Zeitraum, Status.
 * clubId/lockerId/memberId sind serverseitig unveränderlich — ein anderes Fach
 * ist ein NEUER Vertrag, damit die Zahlungshistorie zuordenbar bleibt.
 */
export interface UpdateLockerRentalInput {
  pricePerMonthCents?: number | null;
  startOn?: string;
  endOn?: string | null;
  status?: LockerRentalStatus;
  note?: string | null;
}

/** Filter für listLockerRentals. Die RLS kürzt das Ergebnis zusätzlich ein. */
export interface ListLockerRentalsFilter {
  memberId?: Id;
  lockerId?: Id;
  status?: LockerRentalStatus;
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

  /* ---------- Vermietung (0070; Verwaltung=owner/admin/treasurer) ---------- */
  /**
   * Mietverträge des aktiven Vereins, serverseitig nach start_on absteigend.
   *
   * WICHTIG: das Ergebnis ist KEINE vollständige Liste — die RLS kürzt es auf
   * das ein, was die aufrufende Person sehen darf (Verwaltung: alles; alle
   * anderen: nur eigene bzw. die des eigenen Kindes). Die Ansicht darf daraus
   * also nie schließen „für dieses Fach gibt es keinen Vertrag"; dafür trägt
   * das Fach selbst `hasActiveRental`.
   */
  listLockerRentals(filter?: ListLockerRentalsFilter): Promise<LockerRental[]>;
  /** Fach vermieten (owner/admin/treasurer). 409, wenn schon aktiv vermietet. */
  createLockerRental(input: CreateLockerRentalInput): Promise<LockerRental>;
  /** Vermietung ändern — Preis/Zeitraum/Status (owner/admin/treasurer). */
  updateLockerRental(rentalId: Id, patch: UpdateLockerRentalInput): Promise<LockerRental>;
  /**
   * Vermietung soft-löschen — NUR für versehentlich erfasste Verträge.
   * Ein Vertrag, den es wirklich gab, wird BEENDET (status), nicht gelöscht:
   * die Historie ist das, was Geld nachvollziehbar macht.
   */
  deleteLockerRental(rentalId: Id): Promise<{ id: Id }>;

  /* ---------- Jubiläen (reine Lesesicht, is_club_member) ---------- */
  /** Anstehende Jubiläen + runde Geburtstage der nächsten 365 Tage. */
  getAnniversaries(): Promise<Anniversary[]>;
}
