import type {
  DunningApplyOutcome,
  DunningLogEntry,
  Id,
  InvoiceDetail,
  InvoiceStatus,
  LedgerCategory,
  LedgerCategoryKind,
  LedgerCounterparty,
  LedgerEntry,
} from "@/lib/types";

/**
 * Eingabe-Typen + Repository-Slice der Finanz-A-Module (Kassenbuch inkl.
 * Kategorien, Rechnungs-Detail/Settle, Mahnwesen). Ausgelagert aus
 * lib/data/types.ts, damit beide Dateien < 400 Zeilen bleiben. Re-exportiert
 * über lib/data/index.ts; DataRepository erbt FinanceRepository.
 *
 * Rechte sind SERVERSEITIG (RLS): alle Reads/Writes = can_manage_finance
 * (treasurer/moderator/admin/owner). Ein einfaches Mitglied sieht ausschließlich
 * die EIGENEN Rechnungen, NIE Kassenbuch/Kategorien/Mahnprotokoll. GoBD:
 * Finanzdaten sind append-only — Korrektur nur per Storno (reverseLedgerEntry),
 * kein Hard-Delete, paid/cancelled terminal (kein Re-Open).
 */

/* ---------- Kassenbuch (GoBD-append-only) ---------- */

/**
 * Neue Kassenbuch-Buchung (can_manage_finance). amountCents ist SIGNED:
 * Einnahme > 0, Ausgabe < 0. counterparty='person' braucht memberId,
 * 'org' braucht name (siehe LedgerCounterparty). categoryId ist die
 * strukturierte Kategorie (Dropdown), category der Freitext-Fallback.
 */
export interface CreateLedgerEntryInput {
  clubId: Id;
  /** ISO-Datum (YYYY-MM-DD). */
  entryOn: string;
  description: string;
  counterparty: LedgerCounterparty;
  /** SIGNED: Einnahme > 0, Ausgabe < 0. */
  amountCents: number;
  /** Freitext-Kategorie (Fallback). */
  category?: string;
  /** Strukturierte Kategorie-ID (aus listLedgerCategories). */
  categoryId?: Id;
  /** Verknüpfte Rechnung (z. B. bei Beitrags-Einnahme). */
  invoiceId?: Id;
}

/** Neue Kassenbuch-Kategorie (can_manage_finance). */
export interface CreateLedgerCategoryInput {
  clubId: Id;
  name: string;
  kind: LedgerCategoryKind;
  /** Sortier-Reihenfolge im Dropdown (Default serverseitig). */
  sortOrder?: number;
}

/**
 * Storno einer Buchung (Gegenbuchung mit negiertem Betrag). Ohne description
 * setzt der Server „Storno: <Original>". Reversal einer Reversal ODER eines
 * bereits stornierten Eintrags → 409.
 */
export interface ReverseLedgerInput {
  description?: string;
}

/* ---------- Rechnungen ---------- */

/** Filter für listInvoices (beide optional; RLS gilt zusätzlich). */
export interface ListInvoicesFilter {
  status?: InvoiceStatus;
  memberId?: Id;
}

/**
 * Neue Rechnung (can_manage_finance). issue=true stellt direkt „offen"
 * (statt Entwurf).
 */
export interface CreateInvoiceInput {
  clubId: Id;
  memberId: Id;
  title: string;
  amountCents: number;
  /** ISO-Datum (YYYY-MM-DD). */
  dueOn?: string;
  /** true = sofort „offen" stellen statt Entwurf. */
  issue?: boolean;
}

/**
 * Rechnung abschließen (PATCH status). paid NUR aus 'open' (sonst 409),
 * cancelled NUR aus draft/open (sonst 409) — terminal, kein Re-Open (GoBD).
 * Bei paid (postToLedger≠false) bucht der Server automatisch eine
 * Kassenbuch-Einnahme in Höhe amountCents; ledgerCategoryId optional dafür.
 */
export interface SettleInvoiceInput {
  status: "paid" | "cancelled";
  /** Zahlweg (nur bei paid), z. B. „SEPA". */
  paidVia?: string;
  /** Default true: bei paid automatisch Kassenbuch-Einnahme posten. */
  postToLedger?: boolean;
  /** Optionale Kategorie für die automatische Kassenbuch-Einnahme. */
  ledgerCategoryId?: Id;
}

/* ---------- Mahnwesen ---------- */

/**
 * Mahn-Lauf anwenden (schreibt Mahnprotokoll + Stub-Mail). toStage:
 * 1=Erinnerung (Routine) · 2/3=Mahnung · 4=Übergabe. WICHTIG: toStage ≥ 2
 * NUR mit approveEscalation=true (sonst 403) — die UI muss diese Freigabe
 * explizit vom Nutzer holen (kein Auto-Confirm). Nicht-offene / schon höhere
 * Rechnungen kommen als skipped zurück (kein Fehler).
 */
export interface ApplyDunningInput {
  invoiceIds: Id[];
  /** 1=Erinnerung · 2/3=Mahnung · 4=Übergabe. */
  toStage: number;
  /** PFLICHT true ab toStage ≥ 2 (sonst 403). */
  approveEscalation?: boolean;
  note?: string;
}

/** Filter für listDunningLog (optional nach Rechnung). */
export interface ListDunningLogFilter {
  invoiceId?: Id;
}

/* ---------- Repository-Slice der Finanz-A-Module ---------- */

/**
 * Facade-Methoden der Finanz-A-Module. Ausgelagert aus lib/data/types.ts
 * (< 400 Zeilen); DataRepository erbt davon. Rechte SERVERSEITIG — die UI
 * gatet nur zur Anzeige (permissions.canManageFinance).
 */
export interface FinanceRepository {
  /* ---------- Kassenbuch (can_manage_finance) ---------- */
  /** Kassenbuch des Vereins inkl. Kategorie-Join (categoryName/categoryKind). */
  listLedger(clubId: Id): Promise<LedgerEntry[]>;
  /** Buchung anlegen (GoBD-Append) — liefert die erzeugte Zeile zurück. */
  createLedgerEntry(input: CreateLedgerEntryInput): Promise<LedgerEntry>;
  /**
   * Buchung stornieren (Gegenbuchung, negierter Betrag). Nur wenn die Zeile
   * selbst KEINE Reversal ist und noch nicht storniert wurde (sonst 409).
   * Liefert die erzeugte Storno-Zeile zurück.
   */
  reverseLedgerEntry(entryId: Id, input?: ReverseLedgerInput): Promise<LedgerEntry>;
  /** Kassenbuch-Kategorien des Vereins (aktive zuerst, nach sortOrder). */
  listLedgerCategories(clubId: Id): Promise<LedgerCategory[]>;
  /** Kategorie anlegen — liefert die erzeugte Kategorie zurück. */
  createLedgerCategory(input: CreateLedgerCategoryInput): Promise<LedgerCategory>;

  /* ---------- Rechnungen (can_manage_finance; Mitglied nur eigene) ---------- */
  /** Rechnungen des Vereins, optional nach Status/Mitglied gefiltert. */
  listInvoices(clubId: Id, filter?: ListInvoicesFilter): Promise<InvoiceDetail[]>;
  /** Einzel-Rechnung (404 → wirft ApiError). */
  getInvoice(invoiceId: Id): Promise<InvoiceDetail>;
  /** Rechnung anlegen (issue=true → sofort „offen"). */
  createInvoice(input: CreateInvoiceInput): Promise<InvoiceDetail>;
  /**
   * Rechnung abschließen (bezahlen/stornieren). paid postet optional automatisch
   * eine Kassenbuch-Einnahme. Ungültige Übergänge → 409 (terminal, kein Re-Open).
   */
  settleInvoice(invoiceId: Id, input: SettleInvoiceInput): Promise<InvoiceDetail>;

  /* ---------- Mahnwesen (can_manage_finance) ---------- */
  /**
   * Mahn-Lauf anwenden — schreibt je Rechnung eine Mahnprotokoll-Zeile + Stub-Mail
   * und stuft dunning_level (cap 3) nur nach oben. toStage ≥ 2 braucht
   * approveEscalation=true (sonst 403).
   */
  applyDunning(clubId: Id, input: ApplyDunningInput): Promise<DunningApplyOutcome>;
  /** Unveränderliches Mahnprotokoll des Vereins, optional nach Rechnung. */
  listDunningLog(clubId: Id, filter?: ListDunningLogFilter): Promise<DunningLogEntry[]>;
}
