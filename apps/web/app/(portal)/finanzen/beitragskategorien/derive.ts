import type { Locale } from "@/lib/i18n";
import type {
  FamilyDiscount,
  MemberFeesSummary,
  MembershipCategory,
  MembershipPeriod,
} from "@/lib/types";
import type { BeitragskategorienKey } from "./i18n";

/**
 * Reine Ableitungs-Helfer des Beitragskategorien-Screens — ohne React, ohne
 * Facade. Beträge sind Integer-Cent (nie Float): Euro-Eingaben werden verlustfrei
 * in Cent geparst, Cent-Werte für die Formulare wieder als Euro-Text gerendert.
 * Perioden werden stabil sortiert (monthly → quarterly → yearly → once), damit
 * Liste und Summary quer über den Screen dieselbe Reihenfolge zeigen.
 */

/** Stabile Anzeige-Reihenfolge der Perioden (Summary + Formulare). */
export const PERIOD_ORDER: readonly MembershipPeriod[] = [
  "monthly",
  "quarterly",
  "yearly",
  "once",
];

/** i18n-Schlüssel je Periode (Anzeige-Label). */
export const PERIOD_LABEL_KEY: Record<MembershipPeriod, BeitragskategorienKey> = {
  monthly: "periodMonthly",
  quarterly: "periodQuarterly",
  yearly: "periodYearly",
  once: "periodOnce",
};

/** Kategorien: aktive zuerst, dann nach sortOrder, dann nach Name (stabil). */
export function sortCategories(list: MembershipCategory[]): MembershipCategory[] {
  return [...list].sort((a, b) => {
    if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    return a.name.localeCompare(b.name);
  });
}

/** Summary-Buckets in PERIOD_ORDER bringen (Server-Reihenfolge nicht garantiert). */
export function orderedBuckets(summary: MemberFeesSummary): MemberFeesSummary["byPeriod"] {
  return [...summary.byPeriod].sort(
    (a, b) => PERIOD_ORDER.indexOf(a.period) - PERIOD_ORDER.indexOf(b.period),
  );
}

/** Summe der laufenden (nicht-einmaligen) Zuordnungen — für die KPI-Caption. */
export function recurringCount(summary: MemberFeesSummary): number {
  return summary.byPeriod
    .filter((bucket) => bucket.period !== "once")
    .reduce((sum, bucket) => sum + bucket.count, 0);
}

/** Gibt es überhaupt eine Einmal-Zeile? (steuert den once-Hinweis). */
export function hasOnceBucket(summary: MemberFeesSummary): boolean {
  return summary.byPeriod.some((bucket) => bucket.period === "once");
}

/**
 * Euro-Eingabe → Integer-Cent. Akzeptiert deutsche (1.234,56) und englische
 * (1,234.56) Schreibweise sowie einfache Werte (93 / 93,5 / 93.50). Gibt null
 * zurück, wenn die Eingabe kein gültiger, nicht-negativer Betrag ist.
 */
export function parseAmountToCents(input: string): number | null {
  let s = input.trim().replace(/[€\s  ]/g, "");
  if (!s) return null;

  const hasComma = s.includes(",");
  const hasDot = s.includes(".");
  if (hasComma && hasDot) {
    // Das zuletzt stehende Trennzeichen ist das Dezimaltrennzeichen.
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

/** Integer-Cent → Euro-Text fürs Formular (de = „93,00“, en = „93.00“). */
export function centsToAmountInput(cents: number, locale: Locale): string {
  const s = (cents / 100).toFixed(2);
  return locale === "de" ? s.replace(".", ",") : s;
}

/**
 * Prozent-Eingabe (0..100) → Zahl. Akzeptiert Komma oder Punkt; gibt null bei
 * ungültiger Zahl und die Zahl (auch außerhalb 0..100) sonst zurück — die
 * Bereichsprüfung passiert im Formular, damit die Fehlermeldung passt.
 */
export function parsePercent(input: string): number | null {
  const s = input.trim().replace(/[%\s  ]/g, "").replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  const value = Number(s);
  return Number.isFinite(value) ? value : null;
}

/** Prozentwert 0..100 → „25 %“ (schmales Leerzeichen). */
export function formatPercentValue(value: number, locale: Locale): string {
  const num = new Intl.NumberFormat(locale === "de" ? "de-DE" : "en-GB", {
    maximumFractionDigits: 2,
  }).format(value);
  return `${num} %`;
}
