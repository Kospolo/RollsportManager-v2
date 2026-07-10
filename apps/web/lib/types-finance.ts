import type { Id, Invoice, LedgerCategoryKind } from "./types";

/**
 * View-Typen der Finanz-A-Module (Rechnungs-Detail, Kassenbuch-Kategorien,
 * Mahnprotokoll). Ausgelagert aus lib/types.ts (< 400 Zeilen) und dort per
 * `export type * from "./types-finance"` wieder unter "@/lib/types" verfügbar.
 *
 * Rechte SERVERSEITIG (RLS): alle Finanz-Reads/Writes = can_manage_finance;
 * ein Mitglied sieht nur die EIGENEN Rechnungen, NIE Kassenbuch/Kategorien/
 * Mahnprotokoll. GoBD: Finanzdaten append-only (Storno statt Löschen),
 * paid/cancelled terminal (kein Re-Open).
 */

/** Mahnprotokoll-Aktion: Routine-Erinnerung, Mahnung (Stufe 2/3), Übergabe (Stufe 4). */
export type DunningLogAction = "reminder" | "dunning" | "handover";

/**
 * Erweiterte Einzelsicht einer Rechnung (getInvoice/listInvoices/settleInvoice).
 * Wie Invoice, zusätzlich der Zahlweg — nur bei status='paid' gesetzt.
 */
export interface InvoiceDetail extends Invoice {
  /** Zahlweg bei bezahlten Rechnungen, z. B. „SEPA", „Bar" (nur status='paid'). */
  paidVia?: string;
}

/**
 * Strukturierte Kassenbuch-Kategorie (Dropdown-Quelle). GoBD: Löschen nur
 * soft (deletedAt gesetzt) — bestehende Buchungen behalten ihre Kategorie.
 */
export interface LedgerCategory {
  id: Id;
  clubId: Id;
  name: string;
  kind: LedgerCategoryKind;
  /** Sortier-Reihenfolge im Dropdown (aufsteigend). */
  sortOrder: number;
  /** Gesetzt = soft-gelöscht (GoBD: kein Hard-Delete). */
  deletedAt?: string;
}

/**
 * Eine Zeile des unveränderlichen Mahnprotokolls (append-only, GoBD).
 * fromStage/toStage können bei Alt-Datensätzen null sein; actorMemberId wird
 * durch Soft-Delete des Mitglieds ggf. gelöst (null).
 */
export interface DunningLogEntry {
  id: Id;
  clubId: Id;
  invoiceId: Id;
  fromStage?: number;
  toStage?: number;
  action: DunningLogAction;
  actorMemberId?: Id;
  note?: string;
  createdAt: string;
}

/**
 * Ergebnis eines angewandten Mahn-Laufs (applyDunning). skipped enthält
 * nicht-offene / bereits höher gestufte Rechnungen — das ist KEIN Fehler.
 */
export interface DunningApplyOutcome {
  clubId: Id;
  /** Ziel-Stufe des Laufs (1=Erinnerung · 2/3=Mahnung · 4=Übergabe). */
  toStage: number;
  action: DunningLogAction;
  /** Anzahl tatsächlich hochgestufter Rechnungen. */
  applied: number;
  /** Übersprungene Rechnungen mit Grund (nicht offen / schon höher). */
  skipped: { invoiceId: Id; reason: string }[];
  /** Neu geschriebene Mahnprotokoll-Zeilen. */
  log: DunningLogEntry[];
}
