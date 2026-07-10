import { memberById } from "@/lib/data";
import type { LedgerEntry, Member } from "@/lib/types";

/**
 * Abgeleitete Ansichten des Kassenbuchs — PUR, arbeiten auf den von der Facade
 * geladenen Arrays (mock UND api identisch). GoBD-Semantik: Storno erzeugt eine
 * Gegenbuchung (reversesEntryId gesetzt, negierter Betrag); die Originalbuchung
 * bleibt erhalten. Der laufende Saldo (balanceCents) ist der echte Kontostand
 * NACH dieser Buchung — chronologisch über das GESAMTE Kassenbuch gerechnet,
 * damit Filter nur Zeilen ausblenden, den Saldo aber nicht verfälschen.
 */

export const CATEGORY_ALL = "all" as const;
export const CATEGORY_NONE = "__none__" as const;

export type PeriodKey = "all" | "d30" | "month" | "year";

export type LedgerRow = {
  entry: LedgerEntry;
  /** Echter Kontostand NACH dieser Buchung (über das gesamte Kassenbuch). */
  balanceCents: number;
  /** Gegenpartei-Mitglied (nur wenn counterparty.kind === "person"). */
  member?: Member;
  /** Diese Buchung wurde bereits durch ein Storno aufgehoben. */
  reversed: boolean;
  /** Diese Zeile IST die Storno-Gegenbuchung. */
  isReversal: boolean;
};

function isoDate(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

/** Frühestes eingeschlossenes Datum (ISO) des Zeitraums — null = ohne Grenze. */
export function periodStartISO(period: PeriodKey, now: Date = new Date()): string | null {
  if (period === "all") return null;
  if (period === "month") return isoDate(new Date(now.getFullYear(), now.getMonth(), 1));
  if (period === "year") return isoDate(new Date(now.getFullYear(), 0, 1));
  // d30: die letzten 30 Kalendertage inklusive heute.
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  d.setDate(d.getDate() - 29);
  return isoDate(d);
}

/**
 * Alle Buchungen mit laufendem Saldo — neueste zuerst (wie ein Kontoauszug).
 * Saldo läuft chronologisch auf; Storno-Ziele werden markiert.
 */
export function buildLedgerRows(ledger: LedgerEntry[], members: Member[]): LedgerRow[] {
  const reversedIds = new Set(
    ledger.map((e) => e.reversesEntryId).filter((id): id is string => id != null),
  );
  const ascending = [...ledger].sort(
    (a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id),
  );
  let running = 0;
  const rows = ascending.map<LedgerRow>((entry) => {
    running += entry.amountCents;
    return {
      entry,
      balanceCents: running,
      member:
        entry.counterparty.kind === "person"
          ? memberById(members, entry.counterparty.memberId)
          : undefined,
      reversed: reversedIds.has(entry.id),
      isReversal: entry.reversesEntryId != null,
    };
  });
  return rows.reverse();
}

export type LedgerFilter = {
  /** CATEGORY_ALL, CATEGORY_NONE oder eine categoryId. */
  categoryId: string;
  period: PeriodKey;
};

/** Zeilen nach Kategorie + Zeitraum filtern (Saldo bleibt der echte Kontostand). */
export function filterLedgerRows(
  rows: LedgerRow[],
  filter: LedgerFilter,
  now: Date = new Date(),
): LedgerRow[] {
  const start = periodStartISO(filter.period, now);
  return rows.filter((row) => {
    if (filter.categoryId === CATEGORY_NONE) {
      if (row.entry.categoryId) return false;
    } else if (filter.categoryId !== CATEGORY_ALL) {
      if (row.entry.categoryId !== filter.categoryId) return false;
    }
    if (start && row.entry.date < start) return false;
    return true;
  });
}

export type LedgerSums = {
  incomeCents: number;
  expenseCents: number;
  netCents: number;
  count: number;
};

/** Einnahmen (>0), Ausgaben (<0, als negative Summe) und Netto der Zeilen. */
export function sumLedgerRows(rows: LedgerRow[]): LedgerSums {
  let income = 0;
  let expense = 0;
  for (const row of rows) {
    if (row.entry.amountCents >= 0) income += row.entry.amountCents;
    else expense += row.entry.amountCents;
  }
  return { incomeCents: income, expenseCents: expense, netCents: income + expense, count: rows.length };
}
