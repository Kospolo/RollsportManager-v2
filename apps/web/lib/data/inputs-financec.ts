import type {
  AnnualReport,
  BankTransaction,
  BankTransactionStatus,
  Donation,
  DonationReceipt,
  FinanceExport,
  Id,
} from "@/lib/types";

/**
 * Eingabe-Typen + Repository-Slice der Finanz-C-Module (Bankabgleich, Spenden/
 * Zuwendungsbescheinigungen, Jahresabschluss + Datei-Export). Ausgelagert aus
 * lib/data/types.ts (< 400 Zeilen). Re-exportiert über lib/data/index.ts;
 * DataRepository erbt FinanceCRepository.
 *
 * Rechte sind SERVERSEITIG (RLS): Bankabgleich/Jahresabschluss/Export sowie
 * anonyme Spenden = STRIKT can_manage_finance (Mitglied → 403). Ein Mitglied
 * sieht via RLS nur die EIGENEN Spenden. GoBD: append-only — ausgestellte
 * Spenden eingefroren (Stammdaten-Patch → 409, erneutes issue → 409), kein
 * Hard-Delete. amountCents ist Integer-Cent (Mono/tabular). Der Export ist
 * NICHT typisiert (plain Hono) — echter Datei-Download via Bearer-fetch.
 */

/* ---------- Bankabgleich (can_manage_finance) ---------- */

/**
 * Neue Bankumsatz-Zeile von Hand (can_manage_finance). amountCents ist
 * VORZEICHENBEHAFTET (Eingang > 0, Ausgang < 0).
 */
export interface CreateBankTransactionInput {
  clubId: Id;
  /** ISO-Datum (YYYY-MM-DD). */
  bookedOn: string;
  /** VORZEICHENBEHAFTET: Eingang > 0, Ausgang < 0. */
  amountCents: number;
  purpose?: string;
  counterparty?: string;
}

/** Eine Zeile eines Bank-CSV-Imports (amountCents VORZEICHENBEHAFTET). */
export interface BankTransactionImportRowInput {
  /** ISO-Datum (YYYY-MM-DD). */
  bookedOn: string;
  /** VORZEICHENBEHAFTET: Eingang > 0, Ausgang < 0. */
  amountCents: number;
  purpose?: string;
  counterparty?: string;
}

/** Stapel-Import mehrerer Bankumsätze (can_manage_finance). */
export interface ImportBankTransactionsInput {
  clubId: Id;
  rows: BankTransactionImportRowInput[];
}

/**
 * Bankumsatz einer Rechnung zuordnen (can_manage_finance). Nur unmatched/
 * matched sind matchbar (ignored → 409); die Rechnung muss zum selben Verein
 * gehören (sonst 422). postToLedger (Default true) UND Rechnung noch open →
 * Rechnung wird paid (paid_via='Bankabgleich') + Kassenbuch-Einnahme gebucht
 * (matchedLedgerEntryId gefüllt); bereits bezahlte Rechnung wird nur verknüpft
 * (keine Doppelbuchung). ledgerCategoryId optional für die Kassenbuch-Einnahme.
 */
export interface MatchBankTransactionInput {
  invoiceId: Id;
  /** Default true: bei offener Rechnung automatisch auf paid setzen + Kassenbuch-Einnahme. */
  postToLedger?: boolean;
  /** Optionale Kategorie für die automatische Kassenbuch-Einnahme. */
  ledgerCategoryId?: Id;
}

/** Bankumsatz als „ignoriert" abhaken (can_manage_finance). matched → 409. */
export interface IgnoreBankTransactionInput {
  note?: string;
}

/* ---------- Spenden (can_manage_finance; Mitglied nur eigene) ---------- */

/**
 * Neue Spende (can_manage_finance). receiptNumber NICHT setzen — wird
 * serverseitig race-frei vergeben (SP-JJJJ-NNNN). memberId weglassen = anonyme
 * Spende. Die Spende ist zunächst Entwurf (issuedAt=null); Ausstellen per
 * updateDonation({issue:true}) / markDonationIssued.
 */
export interface CreateDonationInput {
  clubId: Id;
  /** Verknüpftes Mitglied; weglassen = anonyme Spende (nur Finanz). */
  memberId?: Id;
  donorName: string;
  donorAddress?: string;
  amountCents: number;
  /** ISO-Datum (YYYY-MM-DD). */
  donationDate: string;
  purpose?: string;
}

/**
 * Spende ändern (can_manage_finance). issue=true stellt die Bescheinigung aus
 * (einfrieren). Nach Ausstellung ist die Spende eingefroren (GoBD): ein
 * Stammdaten-Patch → 409, erneutes issue → 409.
 */
export interface UpdateDonationInput {
  donorName?: string;
  donorAddress?: string;
  amountCents?: number;
  donationDate?: string;
  purpose?: string;
  /** true = Zuwendungsbescheinigung ausstellen (einfrieren). */
  issue?: boolean;
}

/* ---------- Datei-Export (can_manage_finance) ---------- */

/** Datumsbereich (ISO YYYY-MM-DD) für den Kassenbuch-CSV-Export. */
export interface LedgerExportRange {
  from: string;
  to: string;
}

/* ---------- Repository-Slice der Finanz-C-Module ---------- */

/**
 * Facade-Methoden der Finanz-C-Module. Ausgelagert aus lib/data/types.ts
 * (< 400 Zeilen); DataRepository erbt davon. Rechte SERVERSEITIG — die UI
 * gatet nur zur Anzeige (permissions.canManageFinance; Export-Button nur für
 * Finanzrollen). Der Export ruft NICHT den generierten Client, sondern fetcht
 * mit Bearer-Token und liefert einen Blob + Dateinamen zurück.
 */
export interface FinanceCRepository {
  /* ---------- Bankabgleich (can_manage_finance) ---------- */
  /** Bankumsätze des Vereins, optional nach Status gefiltert. */
  listBankTransactions(clubId: Id, status?: BankTransactionStatus): Promise<BankTransaction[]>;
  /** Bankumsatz von Hand anlegen — liefert die erzeugte Zeile zurück. */
  createBankTransaction(input: CreateBankTransactionInput): Promise<BankTransaction>;
  /** Bankumsätze im Stapel importieren — liefert die erzeugten Zeilen zurück. */
  importBankTransactions(input: ImportBankTransactionsInput): Promise<BankTransaction[]>;
  /**
   * Bankumsatz einer Rechnung zuordnen. ignored → 409, fremder Verein → 422.
   * postToLedger (Default true) + offene Rechnung → paid + Kassenbuch-Einnahme.
   */
  matchBankTransaction(
    transactionId: Id,
    input: MatchBankTransactionInput,
  ): Promise<BankTransaction>;
  /** Bankumsatz als „ignoriert" abhaken. Bereits gematchte Zeile → 409. */
  ignoreBankTransaction(
    transactionId: Id,
    input?: IgnoreBankTransactionInput,
  ): Promise<BankTransaction>;

  /* ---------- Spenden (can_manage_finance; Mitglied nur eigene) ---------- */
  /**
   * Spenden des Vereins, optional nach Mitglied gefiltert. RLS liefert einem
   * Mitglied nur die EIGENEN (member_id) Spenden; anonyme nur Finanz.
   */
  listDonations(clubId: Id, memberId?: Id): Promise<Donation[]>;
  /** Spende anlegen (receiptNumber serverseitig vergeben) — liefert die Spende zurück. */
  createDonation(input: CreateDonationInput): Promise<Donation>;
  /**
   * Spende ändern / ausstellen (issue=true). Nach Ausstellung eingefroren
   * (GoBD): Stammdaten-Patch → 409, erneutes issue → 409.
   */
  updateDonation(donationId: Id, patch: UpdateDonationInput): Promise<Donation>;
  /** Kurzform für updateDonation({issue:true}) — Zuwendungsbescheinigung ausstellen. */
  markDonationIssued(donationId: Id): Promise<Donation>;
  /** Druckfertige Zuwendungsbescheinigung (inkl. deutschem Bescheinigungstext). */
  getDonationReceipt(donationId: Id): Promise<DonationReceipt>;

  /* ---------- Jahresabschluss (STRIKT can_manage_finance) ---------- */
  /** Jahresabschluss des Vereins für ein Kalenderjahr (Mitglied: kein Zugriff). */
  getAnnualReport(clubId: Id, year: number): Promise<AnnualReport>;

  /* ---------- Datei-Export (can_manage_finance) ---------- */
  /**
   * Kassenbuch als CSV exportieren (Bearer-fetch, NICHT über den Client).
   * UTF-8 mit BOM, Semikolon-getrennt, Betrag deutsch mit Komma. Liefert
   * Blob + Dateiname (aus Content-Disposition) für einen echten Download.
   */
  exportLedgerCsv(clubId: Id, range: LedgerExportRange): Promise<FinanceExport>;
  /** DATEV-Export eines Kalenderjahres (Bearer-fetch, echter Datei-Download). */
  exportDatev(clubId: Id, year: number): Promise<FinanceExport>;
}
