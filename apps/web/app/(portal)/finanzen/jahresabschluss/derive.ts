import { formatEUR } from "@/lib/format";
import type { Locale } from "@/lib/i18n";
import type { AnnualCategoryRow, AnnualReport } from "@/lib/types";

/**
 * Reine Ableitungen des Jahresabschluss-Screens — testbar, ohne React. Der
 * AnnualReport kommt fertig aus der Facade (repo.getAnnualReport); hier wird
 * nur für die Darstellung sortiert, gruppiert und formatiert. amountCents ist
 * VORZEICHENBEHAFTET (Einnahme > 0, Ausgabe < 0); netCents negativ = Fehlbetrag.
 */

/** Anzahl auswählbarer Geschäftsjahre (aktuelles Jahr + Jahre zurück). */
const YEAR_SPAN = 5;

/** Auswahl-Jahre absteigend: aktuelles Jahr zuerst, YEAR_SPAN Einträge. */
export function yearOptions(now: Date = new Date()): number[] {
  const current = now.getFullYear();
  return Array.from({ length: YEAR_SPAN }, (_, index) => current - index);
}

/** Vorzeichen-Klasse für die Netto-Zahl: Fehlbetrag rot, Überschuss grün, 0 neutral. */
export type SignTone = "success" | "danger" | "neutral";

export function amountTone(cents: number): SignTone {
  return cents > 0 ? "success" : cents < 0 ? "danger" : "neutral";
}

/**
 * Delta-Ton aus Sicht der Vereinskasse: Bei Einnahmen/Netto ist „mehr" gut
 * (success), bei Ausgaben ist „mehr" schlecht (danger) — `higherIsBetter=false`
 * dreht die Bewertung um. 0 bleibt neutral.
 */
export function deltaTone(cents: number, higherIsBetter = true): SignTone {
  if (cents === 0) return "neutral";
  const good = higherIsBetter ? cents > 0 : cents < 0;
  return good ? "success" : "danger";
}

/** Betrag mit explizitem Vorzeichen: „+1.234,00 €" bzw. „−…" (echtes Minus aus formatEUR). */
export function signedEUR(cents: number, locale: Locale): string {
  const formatted = formatEUR(cents, locale);
  return cents > 0 ? `+${formatted}` : formatted;
}

/** Aufgeteilte Kategorien für die Balken-/Tabellendarstellung. */
export interface CategorySplit {
  income: AnnualCategoryRow[];
  expense: AnnualCategoryRow[];
  /** Größter Einnahme-Betrag (für die Balkenskala). */
  incomeMax: number;
  /** Größter Ausgabe-Betrag als Betrag ohne Vorzeichen (für die Balkenskala). */
  expenseMax: number;
}

/**
 * byCategory in Einnahmen/Ausgaben teilen, je nach Betrag absteigend sortiert
 * (Einnahmen nach Höhe, Ausgaben nach Betrag). Nullzeilen fallen heraus.
 */
export function splitCategories(rows: AnnualCategoryRow[]): CategorySplit {
  const income = rows
    .filter((row) => row.kind === "income" && row.amountCents !== 0)
    .sort((a, b) => b.amountCents - a.amountCents);
  const expense = rows
    .filter((row) => row.kind === "expense" && row.amountCents !== 0)
    .sort((a, b) => Math.abs(b.amountCents) - Math.abs(a.amountCents));
  const incomeMax = income.reduce((max, row) => Math.max(max, row.amountCents), 0);
  const expenseMax = expense.reduce((max, row) => Math.max(max, Math.abs(row.amountCents)), 0);
  return { income, expense, incomeMax, expenseMax };
}

/** Anzahl Kategorien einer Richtung (nur Zeilen mit Betrag ≠ 0). */
export function categoryCount(rows: AnnualCategoryRow[], kind: "income" | "expense"): number {
  return rows.filter((row) => row.kind === kind && row.amountCents !== 0).length;
}

/** Ein Jahr ganz ohne Bewegung (weder Buchungen noch Spenden noch offene Posten). */
export function isReportEmpty(report: AnnualReport): boolean {
  return (
    report.incomeCents === 0 &&
    report.expenseCents === 0 &&
    report.donationsCount === 0 &&
    report.openItemsCount === 0
  );
}

/**
 * Blob als echten Datei-Download auslösen (Client-Side): Objekt-URL an einen
 * temporären Anchor hängen, klicken, wieder freigeben. Nur aus Event-Handlern
 * aufrufen (benötigt `document`).
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
