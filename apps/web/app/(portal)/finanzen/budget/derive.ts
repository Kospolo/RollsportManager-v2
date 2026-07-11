import type { Locale } from "@/lib/i18n";
import { formatEUR } from "@/lib/format";
import type { Budget, BudgetReport, BudgetReportRow, Id, LedgerCategoryKind } from "@/lib/types";

/**
 * Reine Ableitungs-Helfer der Budgetplanung — ohne React, ohne Facade. Der
 * Soll-Ist-Bericht (getBudgetReport) liefert je Kategorie Plan + Ist +
 * Abweichung; die Planzeilen (listBudgets) liefern zusätzlich die budgetId
 * (PATCH vs. POST beim Upsert) und die Notiz. Beide werden hier zu einer
 * Anzeige-Zeile verschmolzen. Beträge sind durchweg Integer-Cent.
 *
 * Abweichung folgt bewusst dem Backend-Contract: varianceCents = Plan − Ist,
 * grün bei ≥ 0, rot bei < 0 (bei Ausgaben = „im Budget geblieben"). Das
 * Ergebnis (Einnahmen − Ausgaben) wird separat als Saldo gezeigt.
 */

/** Anzeige-Zeile: Bericht-Zeile plus Herkunft aus der Planzeile (budgetId/Notiz). */
export interface BudgetRow extends BudgetReportRow {
  /** Gesetzt = es existiert eine Planzeile (Upsert → PATCH, Entfernen möglich). */
  budgetId?: Id;
  note?: string;
  /** Existiert eine Planzeile? (unabhängig davon, ob plannedCents 0 ist) */
  hasPlan: boolean;
}

/** Einnahmen/Ausgaben getrennt — jeweils stabil nach Kategoriename sortiert. */
export interface SplitRows {
  income: BudgetRow[];
  expense: BudgetRow[];
}

/** Aggregierte Kennzahlen für die KPI-Leiste. */
export interface BudgetTotals {
  plannedIncomeCents: number;
  plannedExpenseCents: number;
  actualIncomeCents: number;
  actualExpenseCents: number;
  /** Geplantes Ergebnis = geplante Einnahmen − geplante Ausgaben. */
  plannedResultCents: number;
  /** Ist-Ergebnis = Ist-Einnahmen − Ist-Ausgaben. */
  actualResultCents: number;
  /** Abweichung des Ergebnisses = Ist − Plan (positiv = besser als geplant). */
  resultDeltaCents: number;
}

/** Summe (Plan/Ist/Abweichung) einer Zeilengruppe — für den Sektionsfuß. */
export interface SectionSubtotal {
  plannedCents: number;
  actualCents: number;
  varianceCents: number;
}

/** Auswahljahre: Vorjahr, laufendes Jahr, Folgejahr (Planung ist vorwärtsgerichtet). */
export function budgetYears(thisYear: number = new Date().getFullYear()): number[] {
  return [thisYear - 1, thisYear, thisYear + 1];
}

/** Bericht + Planzeilen zu Anzeige-Zeilen verschmelzen (budgetId/Notiz anreichern). */
export function mergeRows(report: BudgetReport, budgets: Budget[]): BudgetRow[] {
  const byCategory = new Map(budgets.map((b) => [b.categoryId, b]));
  return report.rows.map((row) => {
    const plan = byCategory.get(row.categoryId);
    return { ...row, budgetId: plan?.id, note: plan?.note, hasPlan: plan != null };
  });
}

/** Nach Art trennen (Einnahmen zuerst) und je Gruppe nach Kategoriename sortieren. */
export function splitByKind(rows: BudgetRow[]): SplitRows {
  const byName = (a: BudgetRow, b: BudgetRow) => a.categoryName.localeCompare(b.categoryName);
  return {
    income: rows.filter((r) => r.kind === "income").sort(byName),
    expense: rows.filter((r) => r.kind === "expense").sort(byName),
  };
}

/** Kennzahlen über alle Zeilen (Einnahmen/Ausgaben getrennt, plus Ergebnis-Saldo). */
export function computeTotals(rows: BudgetRow[]): BudgetTotals {
  const sum = (kind: LedgerCategoryKind, pick: (r: BudgetRow) => number) =>
    rows.filter((r) => r.kind === kind).reduce((acc, r) => acc + pick(r), 0);

  const plannedIncomeCents = sum("income", (r) => r.plannedCents);
  const plannedExpenseCents = sum("expense", (r) => r.plannedCents);
  const actualIncomeCents = sum("income", (r) => r.actualCents);
  const actualExpenseCents = sum("expense", (r) => r.actualCents);
  const plannedResultCents = plannedIncomeCents - plannedExpenseCents;
  const actualResultCents = actualIncomeCents - actualExpenseCents;

  return {
    plannedIncomeCents,
    plannedExpenseCents,
    actualIncomeCents,
    actualExpenseCents,
    plannedResultCents,
    actualResultCents,
    resultDeltaCents: actualResultCents - plannedResultCents,
  };
}

/** Zeilengruppe zu Plan-/Ist-/Abweichungs-Summe verdichten (Sektionsfuß). */
export function subtotal(rows: BudgetRow[]): SectionSubtotal {
  return rows.reduce<SectionSubtotal>(
    (acc, r) => ({
      plannedCents: acc.plannedCents + r.plannedCents,
      actualCents: acc.actualCents + r.actualCents,
      varianceCents: acc.varianceCents + r.varianceCents,
    }),
    { plannedCents: 0, actualCents: 0, varianceCents: 0 },
  );
}

/** Ampel: Abweichung ≥ 0 (Plan − Ist) → grün, sonst rot — Contract-treu. */
export function varianceTone(varianceCents: number): "success" | "danger" {
  return varianceCents >= 0 ? "success" : "danger";
}

/** Betrag mit Vorzeichen: „+1.234,56 €" bzw. „−…" (formatEUR liefert echtes Minus). */
export function formatSignedEUR(cents: number, locale: Locale): string {
  return cents > 0 ? `+${formatEUR(cents, locale)}` : formatEUR(cents, locale);
}

/**
 * Euro-Eingabe → Integer-Cent. Akzeptiert deutsche (1.234,56) und englische
 * (1,234.56) Schreibweise sowie einfache Werte. null = kein gültiger,
 * nicht-negativer Betrag. Verlustfrei (nie Float-Speicherung).
 */
export function parseAmountToCents(input: string): number | null {
  let s = input.trim().replace(/[€\s  ]/g, "");
  if (!s) return null;

  const hasComma = s.includes(",");
  const hasDot = s.includes(".");
  if (hasComma && hasDot) {
    s =
      s.lastIndexOf(",") > s.lastIndexOf(".")
        ? s.replace(/\./g, "").replace(",", ".")
        : s.replace(/,/g, "");
  } else if (hasComma) {
    s = s.replace(",", ".");
  }

  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  const euros = Number(s);
  if (!Number.isFinite(euros) || euros < 0) return null;
  return Math.round(euros * 100);
}

/** Integer-Cent → Euro-Text fürs Formular (de = „93,00", en = „93.00"). */
export function centsToAmountInput(cents: number, locale: Locale): string {
  const s = (cents / 100).toFixed(2);
  return locale === "de" ? s.replace(".", ",") : s;
}
