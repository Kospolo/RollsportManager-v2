import type {
  Budget,
  BudgetReport,
  ChildCreated,
  Guardianship,
  Id,
  UploadMyPhotoResult,
  WaitlistEntry,
  WaitlistKind,
  WaitlistStatus,
} from "@/lib/types";

/**
 * Eingabe-Typen + Facade-Segment des Cluster 6a (Wartelisten, Budgetplanung,
 * Familie-Selfservice, Profilfoto). Ausgelagert aus lib/data/types.ts, damit die
 * Datei < 400 Zeilen bleibt; die DataRepository erbt Cluster6aRepository (wie
 * OrgRepository/FinanceRepository/MeRepository).
 *
 * Rechte sind durchweg SERVERSEITIG (RLS + API-Autorisierung) — die Facade
 * reicht nur durch, das Gaten in der UI ist reine Anzeige:
 *  - Wartelisten: Mitglied trägt sich selbst ein/aus, Trainer+ verwaltet die
 *    ganze Queue. listWaitlists liefert per RLS die passende Sicht — NICHT
 *    clientseitig filtern.
 *  - Budget: nur can_manage_finance (owner/admin/moderator/treasurer).
 *  - Familie: Eltern verwalten EIGENE Kinder (guardianMemberId weglassen =
 *    Selfservice) ODER is_club_admin (fremde guardianMemberId setzen).
 *  - Profilfoto: jede:r fürs EIGENE Profil (/me/photo).
 *
 * clubId wird — wie bei allen Facade-Reads (listDepartments/getTeams) —
 * serverseitig über die aktive Session gescopt (activeClubId), daher tragen die
 * Signaturen kein clubId-Argument.
 */

/** Verwandtschaftsverhältnis beim Anlegen/Verlinken (Wire-Enum der Create-Route). */
export type GuardianRelation = "parent" | "guardian" | "other";

/* ---------- Familie ---------- */

/**
 * Kind (ohne Login) + Erziehungsberechtigung anlegen. guardianMemberId
 * WEGLASSEN = Selfservice (die eingeloggte Person wird selbst Guardian);
 * GESETZT = nur is_club_admin (fremder Guardian). Selfservice ist serverseitig
 * auf UNCLAIMED managed children beschränkt (kein Account-/Fremdkind-Hijack).
 */
export interface CreateChildInput {
  firstName: string;
  lastName: string;
  /** ISO-Datum (YYYY-MM-DD) */
  birthDate?: string;
  /** ISO-Datum des Vereinsbeitritts */
  joinedOn?: string;
  guardianMemberId?: Id;
  relation?: GuardianRelation;
}

/**
 * Ein bestehendes (managed, unclaimed) Mitglied als Kind verlinken.
 * guardianMemberId WEGLASSEN = Selfservice (eigene Person als Guardian);
 * GESETZT = nur is_club_admin.
 */
export interface AddGuardianshipInput {
  childMemberId: Id;
  guardianMemberId?: Id;
  relation?: GuardianRelation;
}

/* ---------- Wartelisten ---------- */

/**
 * In eine Warteliste eintragen. memberId = self für den Selbst-Eintrag; ein
 * Trainer darf beliebige Vereinsmitglieder einreihen (serverseitig geprüft).
 */
export interface JoinWaitlistInput {
  memberId: Id;
  kind: WaitlistKind;
  targetId?: Id;
  note?: string;
}

/** Wartelisten-Eintrag ändern (Status durch Trainer+, Notiz durch Ersteller/Trainer). */
export interface UpdateWaitlistInput {
  status?: WaitlistStatus;
  /** null leert die Notiz. */
  note?: string | null;
}

/* ---------- Budget ---------- */

/**
 * Budget-Planzeile anlegen ODER ändern (Upsert je Verein/Jahr/Kategorie). Ist id
 * gesetzt, wird die bestehende Zeile per PATCH geändert (nur plannedCents/note);
 * sonst per POST neu angelegt. plannedCents null = Planwert entfernen/leeren.
 */
export interface UpsertBudgetInput {
  year: number;
  categoryId: Id;
  plannedCents: number | null;
  note?: string | null;
  /** Gesetzt = bestehende Planzeile ändern (PATCH); weglassen = neu anlegen (POST). */
  id?: Id;
}

export interface Cluster6aRepository {
  /* ---------- Familie (Selfservice fürs eigene Kind ODER is_club_admin) ---------- */
  /** Kind (ohne Login) + Erziehungsberechtigung anlegen. */
  createChild(input: CreateChildInput): Promise<ChildCreated>;
  /** Bestehendes managed/unclaimed Mitglied als Kind verlinken. */
  addGuardianship(input: AddGuardianshipInput): Promise<Guardianship>;
  /** Erziehungsberechtigung entfernen (eigener Guardian, Selfservice oder Admin). */
  removeGuardianship(guardianshipId: Id): Promise<{ id: Id }>;

  /* ---------- Wartelisten (Selbst-Eintrag = Mitglied, Verwaltung = Trainer+) ---------- */
  /**
   * Wartelisten-Einträge des aktiven Vereins, optional nach Art gefiltert. RLS
   * liefert einem Mitglied NUR die eigenen Einträge, Trainer+ die ganze Queue.
   */
  listWaitlists(kind?: WaitlistKind): Promise<WaitlistEntry[]>;
  /** In eine Warteliste eintragen (Selbst-Eintrag ODER Trainer reiht ein). */
  joinWaitlist(input: JoinWaitlistInput): Promise<WaitlistEntry>;
  /** Wartelisten-Eintrag ändern (Status = Trainer+, Notiz = Ersteller/Trainer). */
  updateWaitlist(waitlistId: Id, patch: UpdateWaitlistInput): Promise<WaitlistEntry>;
  /** Warteliste verlassen / Eintrag entfernen (Ersteller ODER Trainer). */
  leaveWaitlist(waitlistId: Id): Promise<{ id: Id }>;

  /* ---------- Budget (nur can_manage_finance) ---------- */
  /** Budget-Planzeilen des aktiven Vereins für ein Jahr. */
  listBudgets(year: number): Promise<Budget[]>;
  /** Budget-Planzeile anlegen ODER ändern (Upsert je Verein/Jahr/Kategorie). */
  upsertBudget(input: UpsertBudgetInput): Promise<Budget>;
  /** Budget-Planzeile soft-löschen — liefert die gelöschte ID zurück. */
  deleteBudget(budgetId: Id): Promise<{ id: Id }>;
  /** Budget-Soll-Ist-Bericht (Plan vs. Ist je Kategorie) für ein Jahr. */
  getBudgetReport(year: number): Promise<BudgetReport>;

  /* ---------- Profilfoto (eigenes Profil, /me/photo) ---------- */
  /**
   * Eigenes Profilfoto hochladen (multipart POST /me/photo, Feld 'file', nur
   * Bilder, max 25 MB). Läuft bewusst NICHT über den generierten typed Client
   * (Route ist nicht im OpenAPI-Contract), sondern per eigenem fetch mit
   * Bearer-Token + FormData. Danach /me neu laden (getMyProfile).
   */
  uploadMyPhoto(file: File): Promise<UploadMyPhotoResult>;
}
