import { fullName, memberById, openInvoices } from "@/lib/data";
import type { BankTransactionImportRowInput } from "@/lib/data";
import type { BankTransaction, BankTransactionStatus, Invoice, Member } from "@/lib/types";

/**
 * Abgeleitete Ansichten des Bankabgleichs — PUR, arbeiten auf den von der
 * Facade geladenen Arrays (mock UND api identisch). amountCents ist
 * VORZEICHENBEHAFTET (+ Eingang / − Ausgang). Match-Kandidaten sind
 * unmatched-Eingänge (amountCents > 0), die gegen offene Rechnungen
 * abgeglichen werden (Betrag/Gegenpartei als Hinweis). GoBD: Umsätze werden
 * nicht gelöscht — „ignorieren" setzt sie nur beiseite.
 */

export type BankStatusFilter = "all" | BankTransactionStatus;

/* ---------- Filter & Zählung ---------- */

/** Umsätze nach Status filtern; „all" lässt alles durch. */
export function filterTransactions(
  transactions: BankTransaction[],
  status: BankStatusFilter,
): BankTransaction[] {
  const rows = status === "all" ? transactions : transactions.filter((t) => t.status === status);
  return [...rows].sort(
    (a, b) => b.bookedOn.localeCompare(a.bookedOn) || b.importedAt.localeCompare(a.importedAt),
  );
}

export type StatusCounts = Record<BankStatusFilter, number>;

/** Anzahl je Status (für die Filter-Chips) — inkl. „all". */
export function countByStatus(transactions: BankTransaction[]): StatusCounts {
  const counts: StatusCounts = { all: transactions.length, unmatched: 0, matched: 0, ignored: 0 };
  for (const t of transactions) counts[t.status] += 1;
  return counts;
}

export type MatchProgress = {
  matched: number;
  unmatched: number;
  ignored: number;
  /** Zu bearbeitende Umsätze (matched + unmatched — ignorierte zählen nicht). */
  total: number;
};

/** Fortschritt „X von Y zugeordnet" — ignorierte Umsätze bleiben außen vor. */
export function matchProgress(transactions: BankTransaction[]): MatchProgress {
  const counts = countByStatus(transactions);
  return {
    matched: counts.matched,
    unmatched: counts.unmatched,
    ignored: counts.ignored,
    total: counts.matched + counts.unmatched,
  };
}

/** Nur unmatched-Eingänge (amountCents > 0) sind einer Rechnung zuordenbar. */
export function isMatchableIncoming(transaction: BankTransaction): boolean {
  return transaction.amountCents > 0 && transaction.status !== "ignored";
}

/* ---------- Match-Vorschläge (Betrag/Name) ---------- */

export type MatchConfidence = "high" | "medium" | "low";

export type ScoredInvoice = {
  invoice: Invoice;
  member?: Member;
  score: number;
  /** high = Betrag + Name/Nummer · medium = nur Betrag · low = nur Name/Nummer. */
  confidence: MatchConfidence;
};

/** Nur Buchstaben/Ziffern, kleingeschrieben — für robusten Text-Vergleich. */
function normalize(value: string | undefined): string {
  return (value ?? "").toLowerCase().replace(/[^a-z0-9äöüß]/g, "");
}

/**
 * Offene Rechnungen als Kandidaten für einen Eingang bewerten — absteigend
 * sortiert, bester zuerst. Betragsgleichheit wiegt am schwersten, gefolgt von
 * der Rechnungsnummer bzw. dem Mitgliedsnamen im Verwendungszweck/der Gegenpartei.
 */
export function rankInvoices(
  transaction: BankTransaction,
  invoices: Invoice[],
  members: Member[],
): ScoredInvoice[] {
  const haystack = `${normalize(transaction.purpose)} ${normalize(transaction.counterparty)}`;
  return openInvoices(invoices)
    .map((invoice): ScoredInvoice => {
      const member = memberById(members, invoice.memberId);
      const amountMatch = invoice.amountCents === transaction.amountCents;
      const numberMatch = normalize(invoice.number).length > 0 && haystack.includes(normalize(invoice.number));
      const nameMatch = Boolean(
        member &&
          (haystack.includes(normalize(member.lastName)) ||
            haystack.includes(normalize(fullName(member)))),
      );
      let score = 0;
      if (amountMatch) score += 100;
      if (numberMatch) score += 50;
      if (nameMatch) score += 25;
      const strongText = numberMatch || nameMatch;
      const confidence: MatchConfidence =
        amountMatch && strongText ? "high" : amountMatch ? "medium" : "low";
      return { invoice, member, score, confidence };
    })
    .sort((a, b) => b.score - a.score || a.invoice.number.localeCompare(b.invoice.number));
}

/** Bester Kandidat mit Signal (score > 0) — sonst undefined (freie Auswahl). */
export function bestSuggestion(scored: ScoredInvoice[]): ScoredInvoice | undefined {
  const top = scored[0];
  return top && top.score > 0 ? top : undefined;
}

/* ---------- Eingaben (manuell + CSV-Import) ---------- */

/** Heutiges ISO-Datum (YYYY-MM-DD), lokale Zeit. */
export function todayISODate(now: Date = new Date()): string {
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${m}-${day}`;
}

/**
 * Euro-Eingabe → Cents (VORZEICHENBEHAFTET). Akzeptiert deutsches und
 * englisches Trennzeichen, führendes/nachgestelltes Minus (Bank-Exporte).
 * Rückgabe null bei leer/ungültig; 0 gilt als ungültig.
 */
export function parseSignedEuroCents(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const negative = trimmed.startsWith("-") || trimmed.endsWith("-");
  const cleaned = trimmed.replace(/[^\d.,]/g, "");
  if (!cleaned) return null;
  const lastComma = cleaned.lastIndexOf(",");
  const lastDot = cleaned.lastIndexOf(".");
  let normalized: string;
  if (lastComma > lastDot) normalized = cleaned.replace(/\./g, "").replace(",", ".");
  else if (lastDot > lastComma) normalized = cleaned.replace(/,/g, "");
  else normalized = cleaned;
  const value = Number(normalized);
  if (!Number.isFinite(value) || value === 0) return null;
  const cents = Math.round(Math.abs(value) * 100);
  if (cents === 0) return null;
  return negative ? -cents : cents;
}

/** Positive Euro-Magnitude in Cents (manuelle Erfassung; Vorzeichen via Richtung). */
export function parseMagnitudeCents(raw: string): number | null {
  const signed = parseSignedEuroCents(raw);
  return signed === null ? null : Math.abs(signed);
}

/** Datum aus TT.MM.JJJJ, TT/MM/JJJJ oder JJJJ-MM-TT → ISO (YYYY-MM-DD); null sonst. */
export function parseImportDate(raw: string): string | null {
  const value = raw.trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (iso) return isValidYmd(iso[1], iso[2], iso[3]) ? `${iso[1]}-${iso[2]}-${iso[3]}` : null;
  const de = /^(\d{1,2})[.\/](\d{1,2})[.\/](\d{4})$/.exec(value);
  if (de) {
    const day = de[1].padStart(2, "0");
    const month = de[2].padStart(2, "0");
    return isValidYmd(de[3], month, day) ? `${de[3]}-${month}-${day}` : null;
  }
  return null;
}

function isValidYmd(y: string, m: string, d: string): boolean {
  const month = Number(m);
  const day = Number(d);
  return month >= 1 && month <= 12 && day >= 1 && day <= 31 && Number(y) >= 1900;
}

export type ImportRowErrorCode = "columns" | "date" | "amount";
export type ImportRowError = { line: number; raw: string; code: ImportRowErrorCode };
export type ParsedBankCsv = {
  rows: BankTransactionImportRowInput[];
  errors: ImportRowError[];
};

/** Verzichtbare Kopfzeile: erste Zelle ist kein Datum (z. B. „Datum"/„Buchungstag"). */
function looksLikeHeader(firstCell: string): boolean {
  return parseImportDate(firstCell) === null && /[a-zA-Zäöü]/.test(firstCell);
}

function splitColumns(line: string): string[] {
  const delimiter = line.includes(";") ? ";" : line.includes("\t") ? "\t" : ",";
  return line.split(delimiter).map((cell) => cell.trim().replace(/^"|"$/g, ""));
}

/**
 * Eingefügtes/geladenes CSV in Import-Zeilen zerlegen. Spalten:
 * Datum; Betrag; Zweck?; Gegenpartei?. Delimiter automatisch (;, Tab oder ,).
 * Eine erkennbare Kopfzeile wird übersprungen; ungültige Zeilen sammeln einen
 * Fehler (mit Zeilennummer), statt den ganzen Import zu kippen.
 */
export function parseBankCsv(text: string): ParsedBankCsv {
  const rows: BankTransactionImportRowInput[] = [];
  const errors: ImportRowError[] = [];
  const lines = text.split(/\r?\n/);
  lines.forEach((rawLine, index) => {
    const line = rawLine.trim();
    if (!line) return;
    const cols = splitColumns(line);
    if (index === 0 && looksLikeHeader(cols[0] ?? "")) return;
    if (cols.length < 2 || !cols[0] || !cols[1]) {
      errors.push({ line: index + 1, raw: line, code: "columns" });
      return;
    }
    const bookedOn = parseImportDate(cols[0]);
    if (!bookedOn) {
      errors.push({ line: index + 1, raw: line, code: "date" });
      return;
    }
    const amountCents = parseSignedEuroCents(cols[1]);
    if (amountCents === null) {
      errors.push({ line: index + 1, raw: line, code: "amount" });
      return;
    }
    rows.push({
      bookedOn,
      amountCents,
      purpose: cols[2] || undefined,
      counterparty: cols[3] || undefined,
    });
  });
  return { rows, errors };
}

/** Summe der Import-Zeilen (VORZEICHENBEHAFTET) — für die Vorschau. */
export function sumImportRows(rows: BankTransactionImportRowInput[]): number {
  return rows.reduce((sum, row) => sum + row.amountCents, 0);
}
