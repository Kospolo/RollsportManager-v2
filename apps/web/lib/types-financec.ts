import type { Id, LedgerCategoryKind } from "./types";

/**
 * View-Typen der Finanz-C-Module (Bankabgleich, Spenden/Zuwendungs-
 * bescheinigungen, Jahresabschluss + Datei-Export). Ausgelagert aus lib/types.ts
 * (< 400 Zeilen) und dort per `export type * from "./types-financec"` wieder
 * unter "@/lib/types" verfügbar.
 *
 * Rechte SERVERSEITIG (RLS): Bankabgleich/Jahresabschluss/Export sowie anonyme
 * Spenden = STRIKT can_manage_finance (Mitglied → 403). Ein Mitglied sieht via
 * RLS nur die EIGENEN (member_id) Spenden. GoBD: Finanzdaten append-only —
 * ausgestellte Spenden sind eingefroren, kein Hard-Delete. Beträge sind
 * Integer-Cent und werden Mono/tabular gerendert (Einnahme grün, Ausgabe rot).
 */

/* ---------- Bankabgleich ---------- */

/**
 * Status einer importierten Bankumsatz-Zeile:
 * unmatched = offen · matched = einer Rechnung zugeordnet · ignored = abgehakt.
 * Nur unmatched/matched sind matchbar, nur unmatched/ignored ignorierbar.
 */
export type BankTransactionStatus = "unmatched" | "matched" | "ignored";

/**
 * Eine importierte Bankumsatz-Zeile. amountCents ist VORZEICHENBEHAFTET
 * (+ Eingang / − Ausgang) und wird tabular/mono gerendert (grün positiv,
 * rot negativ). Match-Kandidaten sind unmatched-Eingänge (amountCents > 0),
 * die gegen offene Rechnungen abgeglichen werden (Betrag/Gegenpartei als Hinweis).
 */
export interface BankTransaction {
  id: Id;
  clubId: Id;
  /** ISO-Datum (YYYY-MM-DD) der Buchung auf dem Konto. */
  bookedOn: string;
  /** VORZEICHENBEHAFTET: Eingang > 0, Ausgang < 0. */
  amountCents: number;
  /** Verwendungszweck (Freitext aus dem Kontoauszug). */
  purpose?: string;
  /** Gegenpartei (Auftraggeber/Empfänger aus dem Kontoauszug). */
  counterparty?: string;
  /** Gesetzt bei status='matched' — die zugeordnete Rechnung. */
  matchedInvoiceId?: Id;
  /** Gesetzt, wenn beim Match automatisch eine Kassenbuch-Einnahme gebucht wurde. */
  matchedLedgerEntryId?: Id;
  status: BankTransactionStatus;
  /** ISO-Zeitstempel des Imports. */
  importedAt: string;
  /** Gesetzt = soft-gelöscht (GoBD: kein Hard-Delete). */
  deletedAt?: string;
}

/* ---------- Spenden ---------- */

/**
 * Eine Spende / Zuwendung. receiptNumber wird beim Anlegen serverseitig
 * race-frei vergeben (Format SP-JJJJ-NNNN) — NIE vom Client setzen.
 * issuedAt=undefined = Entwurf; nach dem Ausstellen (PATCH issue:true) ist die
 * Spende eingefroren (GoBD): Stammdaten-Patch → 409, erneutes Ausstellen → 409.
 * memberId=undefined = anonyme Spende (nur Finanz sichtbar).
 */
export interface Donation {
  id: Id;
  clubId: Id;
  /** Verknüpftes Mitglied; fehlt = anonyme Spende (nur can_manage_finance). */
  memberId?: Id;
  donorName: string;
  donorAddress?: string;
  amountCents: number;
  /** ISO-Datum (YYYY-MM-DD) der Zuwendung. */
  donationDate: string;
  /** Serverseitig vergebene Bescheinigungsnummer (SP-JJJJ-NNNN). */
  receiptNumber: string;
  purpose?: string;
  /** ISO-Zeitstempel der Ausstellung; fehlt = Entwurf (noch nicht ausgestellt). */
  issuedAt?: string;
  /** Gesetzt = soft-gelöscht (GoBD: kein Hard-Delete). */
  deletedAt?: string;
}

/**
 * Druckfertige Zuwendungsbescheinigung (GET /donations/{id}/receipt). `text`
 * ist der fertige deutsche Bescheinigungstext; amountEur der formatierte
 * Euro-Betrag. issued spiegelt, ob die Spende bereits ausgestellt wurde.
 */
export interface DonationReceipt {
  donationId: Id;
  receiptNumber: string;
  clubName: string;
  donorName: string;
  donorAddress?: string;
  amountCents: number;
  /** Formatierter Euro-Betrag (deutsch, z. B. „54,00"). */
  amountEur: string;
  donationDate: string;
  purpose?: string;
  issued: boolean;
  text: string;
}

/* ---------- Jahresabschluss ---------- */

/**
 * Eine Kategorie-Zeile des Jahresabschlusses. amountCents ist
 * VORZEICHENBEHAFTET (Einnahme > 0, Ausgabe < 0); categoryId/-Name fehlen bei
 * unkategorisierten Buchungen (Freitext-Fallback).
 */
export interface AnnualCategoryRow {
  categoryId?: Id;
  categoryName?: string;
  kind: LedgerCategoryKind;
  /** VORZEICHENBEHAFTET (Einnahme > 0, Ausgabe < 0). */
  amountCents: number;
}

/** Jahres-Summen (aktuelles bzw. Vorjahr). income/expense positiv, net=income−expense. */
export interface AnnualYearTotals {
  year: number;
  incomeCents: number;
  expenseCents: number;
  /** = incomeCents − expenseCents (negativ = rot rendern). */
  netCents: number;
}

/**
 * Jahresabschluss (GET /reports/annual) — STRIKT can_manage_finance
 * (Mitglied: kein Zugriff). incomeCents/expenseCents beide POSITIV,
 * netCents = income − expense (negativ = rot). Beträge Mono/tabular.
 */
export interface AnnualReport {
  clubId: Id;
  year: number;
  incomeCents: number;
  expenseCents: number;
  /** = incomeCents − expenseCents (negativ = rot rendern). */
  netCents: number;
  byCategory: AnnualCategoryRow[];
  prevYear: AnnualYearTotals;
  /** Netto-Differenz gegenüber dem Vorjahr (netCents − prevYear.netCents). */
  netDeltaCents: number;
  donationsTotalCents: number;
  donationsCount: number;
  /** Offene Rechnungen mit issuedOn ≤ 31.12. des Jahres. */
  openItemsCount: number;
  openItemsTotalCents: number;
}

/* ---------- Datei-Export (CSV/DATEV) ---------- */

/**
 * Ergebnis eines Finanz-Exports (Kassenbuch-CSV / DATEV). Die Route liegt
 * AUSSERHALB der typisierten JSON-Spec (plain Hono) und wird als echter
 * Datei-Download behandelt: `blob` in eine Objekt-URL hängen, `filename` als
 * Download-Namen setzen. CSV = UTF-8 mit BOM (Excel-Umlaute), Semikolon-
 * getrennt, Betrag deutsch mit Komma. Rechte: nur can_manage_finance (403 sonst).
 */
export interface FinanceExport {
  blob: Blob;
  /** Dateiname aus dem Content-Disposition-Header (attachment; filename=…). */
  filename: string;
  /** MIME-Typ, i. d. R. „text/csv;charset=utf-8". */
  contentType: string;
}
