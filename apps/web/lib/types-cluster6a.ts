import type { Guardianship, Id, LedgerCategoryKind, Member } from "./types";

/**
 * View-Typen des Cluster 6a (Wartelisten, Budgetplanung, Familie-Selfservice,
 * Profilfoto). Ausgelagert aus lib/types.ts und über "@/lib/types" re-exportiert
 * (analog types-org/types-financeb). Gespiegelt aus dem Wire-Format (snake_case)
 * in die camelCase-Konvention des Portals (mappers-cluster6a.ts).
 *
 * Rechte sind durchweg SERVERSEITIG: Wartelisten = Mitglied trägt sich selbst
 * ein/aus, Trainer+ verwaltet die ganze Queue (RLS liefert die passende Sicht,
 * NICHT clientseitig filtern). Budget = can_manage_finance. Familie = eigene
 * Kinder (Selfservice) ODER is_club_admin. Profilfoto = eigenes Profil.
 */

/* ---------- Wartelisten ---------- */

/** Art des Warteschlangen-Ziels — deckungsgleich mit dem Wire-Enum. */
export type WaitlistKind = "facility" | "equipment" | "team" | "event";

/** Zustand eines Wartelisten-Eintrags (waiting → offered → fulfilled | cancelled). */
export type WaitlistStatus = "waiting" | "offered" | "fulfilled" | "cancelled";

/**
 * Ein Wartelisten-Eintrag. Ein einfaches Mitglied sieht (per RLS) nur die
 * EIGENEN Einträge, Trainer+ die ganze Queue — den UI-Zustand daher aus der
 * Response ableiten, nicht clientseitig nachfiltern. targetId verweist je nach
 * kind auf Halle/Equipment/Team/Event (undefined = allgemeine Warteliste).
 */
export interface WaitlistEntry {
  id: Id;
  clubId: Id;
  memberId: Id;
  kind: WaitlistKind;
  targetId?: Id;
  note?: string;
  status: WaitlistStatus;
  createdAt: string;
  updatedAt: string;
}

/* ---------- Budgetplanung ---------- */

/**
 * Eine Budget-Planzeile (eindeutig je Verein/Jahr/Kategorie). plannedCents ist
 * der geplante Jahresbetrag in Cent (Einnahme positiv, Ausgabe positiv — das
 * Vorzeichen steckt in der Kategorie-Art, siehe BudgetReportRow.kind). Nur
 * can_manage_finance (owner/admin/moderator/treasurer).
 */
export interface Budget {
  id: Id;
  clubId: Id;
  year: number;
  categoryId: Id;
  plannedCents: number;
  note?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Eine Zeile des Budget-Soll-Ist-Berichts. varianceCents = plannedCents −
 * actualCents (Auslegung: übrig/über). Für die EUR-Anzeige cents/100; variance
 * grün (≥ 0) bzw. rot (< 0). kind trennt Einnahme/Ausgabe für die Gruppierung.
 */
export interface BudgetReportRow {
  categoryId: Id;
  categoryName: string;
  kind: LedgerCategoryKind;
  plannedCents: number;
  actualCents: number;
  varianceCents: number;
}

/** Budget-Soll-Ist-Bericht eines Vereins-Jahres (can_manage_finance). */
export interface BudgetReport {
  clubId: Id;
  year: number;
  rows: BudgetReportRow[];
  plannedTotalCents: number;
  actualTotalCents: number;
  varianceTotalCents: number;
}

/* ---------- Familie: Kind + Erziehungsberechtigung ---------- */

/**
 * Ergebnis von createChild: das neu angelegte Kind (club_members-Zeile ohne
 * Login) plus die erzeugte Erziehungsberechtigung.
 */
export interface ChildCreated {
  child: Member;
  guardianship: Guardianship;
}

/* ---------- Profilfoto ---------- */

/**
 * Ergebnis von uploadMyPhoto. avatarUrl ist bereits mit der API-Basis
 * präfixiert (im api-Modus) bzw. eine Demo-URL (mock). updatedMemberIds sind
 * alle club_members-Zeilen der eingeloggten Person, deren Avatar aktualisiert
 * wurde — danach /me neu laden.
 */
export interface UploadMyPhotoResult {
  avatarKey: string;
  avatarUrl: string;
  updatedMemberIds: Id[];
}
