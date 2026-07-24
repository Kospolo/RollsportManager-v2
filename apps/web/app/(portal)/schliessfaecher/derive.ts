import type { Locale } from "@/lib/i18n";
import { formatEUR } from "@/lib/format";
import type { LockerRental, LockerRentalStatus, LockerSize } from "@/lib/types";
import type { BadgeTone } from "@/components/ui/Badge";
import type { SchliessfaecherKey } from "./i18n";

/**
 * Reine Ableitungs-Helfer des Schließfach-Screens — ohne React, ohne Facade.
 *
 * ### DIE EINE REGEL, DIE DIESE DATEI TRÄGT ###
 * Ein Preis hat DREI Zustände, nicht zwei:
 *   null → „noch kein Preis festgelegt"
 *   0    → „ausdrücklich kostenlos"
 *   > 0  → ein Betrag
 * Die API verschmilzt sie nie (services/api/src/routes/locker-rentals.ts), und
 * hier passiert dasselbe. Ein bequemes `price ?? 0` würde aus „wir haben uns
 * noch nicht entschieden" ein „das kostet nichts" machen — eine Aussage, die
 * ein Verein später gegen sich gelten lassen müsste. Deshalb gibt es
 * priceState() statt eines nackten Formatierers.
 *
 * Beträge kommen und gehen als Integer-Cent, nie als Float.
 */

/* ---------- Größen ---------- */

/** Anzeige-Reihenfolge der Größen (klein → mittel → groß). */
export const SIZE_ORDER: readonly LockerSize[] = ["klein", "mittel", "gross"];

/** LockerSize → i18n-Schlüssel des Labels (DE+EN). */
export const SIZE_KEY: Record<LockerSize, SchliessfaecherKey> = {
  klein: "sizeSmall",
  mittel: "sizeMedium",
  gross: "sizeLarge",
};

/* ---------- Miet-Status ---------- */

/** Anzeige-Reihenfolge der Vertrags-Zustände. */
export const RENTAL_STATUS_ORDER: readonly LockerRentalStatus[] = [
  "aktiv",
  "gekuendigt",
  "beendet",
];

/** LockerRentalStatus → i18n-Schlüssel. */
export const RENTAL_STATUS_KEY: Record<LockerRentalStatus, SchliessfaecherKey> = {
  aktiv: "rentalStatusActive",
  beendet: "rentalStatusEnded",
  gekuendigt: "rentalStatusCancelled",
};

/**
 * Ton des Vertrags-Badges. „gekündigt" ist bewusst `warn` und nicht `danger`:
 * eine Kündigung ist ein normaler Vorgang, kein Fehler. Rot wäre hier eine
 * Wertung, die dem Mitglied gilt, das gekündigt hat.
 */
export const RENTAL_STATUS_TONE: Record<LockerRentalStatus, BadgeTone> = {
  aktiv: "success",
  beendet: "neutral",
  gekuendigt: "warn",
};

/* ---------- Preis: die drei Zustände ---------- */

export type PriceState =
  | { kind: "unset" }
  | { kind: "free" }
  | { kind: "amount"; cents: number };

/** Cent-Wert (oder null) → einer der drei Zustände. Nie ein stiller Fallback. */
export function priceState(cents: number | null): PriceState {
  if (cents === null) return { kind: "unset" };
  if (cents === 0) return { kind: "free" };
  return { kind: "amount", cents };
}

/**
 * Preis als Text. Braucht die Übersetzerfunktion, weil zwei der drei Zustände
 * WORTE sind und keine Zahlen — „—" als Platzhalter für „nicht festgelegt"
 * wäre für eine Vorsitzende mit 60 nicht lesbar, und „0,00 €" wäre schlicht
 * falsch.
 */
export function priceLabel(
  cents: number | null,
  locale: Locale,
  t: (key: SchliessfaecherKey) => string,
): string {
  const state = priceState(cents);
  if (state.kind === "unset") return t("priceUnset");
  if (state.kind === "free") return t("priceFree");
  return formatEUR(state.cents, locale);
}

/** Nur Beträge werden mono/tabular gesetzt; Wörter bleiben Fließtext. */
export function isPriceNumeric(cents: number | null): boolean {
  return priceState(cents).kind === "amount";
}

/* ---------- Verträge ---------- */

/**
 * Der laufende Vertrag eines Fachs aus einer (möglicherweise RLS-gekürzten)
 * Liste. `undefined` heißt „ich sehe keinen" — NICHT „es gibt keinen". Für die
 * zweite Aussage trägt das Fach `hasActiveRental`.
 */
export function activeRentalOf(
  rentals: LockerRental[],
  lockerId: string,
): LockerRental | undefined {
  return rentals.find((r) => r.lockerId === lockerId && r.status === "aktiv");
}

/** Alle Verträge eines Fachs, laufende zuerst, dann nach Beginn absteigend. */
export function rentalHistoryOf(rentals: LockerRental[], lockerId: string): LockerRental[] {
  return rentals
    .filter((r) => r.lockerId === lockerId)
    .sort((a, b) => {
      if (a.status !== b.status) {
        if (a.status === "aktiv") return -1;
        if (b.status === "aktiv") return 1;
      }
      return b.startOn.localeCompare(a.startOn);
    });
}

/**
 * Summe der laufenden Mieten je Monat — für die Kopfzeile der Verwaltung.
 *
 * Verträge OHNE festgelegten Preis werden nicht als 0 mitgezählt, sondern
 * separat gemeldet: „1.200,00 € aus 14 Verträgen, 2 ohne Preis" ist eine
 * ehrliche Zahl, „1.200,00 € aus 16 Verträgen" wäre eine falsche.
 */
export function monthlyRentalTotal(rentals: LockerRental[]): {
  cents: number;
  counted: number;
  withoutPrice: number;
} {
  let cents = 0;
  let counted = 0;
  let withoutPrice = 0;
  for (const rental of rentals) {
    if (rental.status !== "aktiv") continue;
    if (rental.pricePerMonthCents === null) {
      withoutPrice += 1;
      continue;
    }
    cents += rental.pricePerMonthCents;
    counted += 1;
  }
  return { cents, counted, withoutPrice };
}

/* ---------- Euro-Eingabe ---------- */

/**
 * Euro-Eingabe → Integer-Cent. Akzeptiert deutsche (1.234,56) und englische
 * (1,234.56) Schreibweise sowie einfache Werte (5 / 4,5 / 4.50).
 *
 * Rückgabe:
 *   { ok: true, cents: null }  bei LEERER Eingabe → „nicht festgelegt"
 *   { ok: true, cents: n }     bei gültigem Betrag (0 erlaubt = kostenlos)
 *   { ok: false }              bei Unsinn
 * Leer und 0 sind damit unterscheidbar — genau der Punkt oben im Kopf.
 */
export function parsePriceInput(input: string): { ok: true; cents: number | null } | { ok: false } {
  const raw = input.trim();
  if (!raw) return { ok: true, cents: null };

  let s = raw.replace(/[€\s  ]/g, "");
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

  if (!/^\d+(\.\d+)?$/.test(s)) return { ok: false };
  const euros = Number(s);
  if (!Number.isFinite(euros) || euros < 0) return { ok: false };
  return { ok: true, cents: Math.round(euros * 100) };
}

/**
 * Integer-Cent → Euro-Text fürs Formular. null → LEERER String, nicht „0,00":
  * das Formular soll denselben Unterschied tragen wie die Daten.
 */
export function priceToInput(cents: number | null, locale: Locale): string {
  if (cents === null) return "";
  const s = (cents / 100).toFixed(2);
  return locale === "de" ? s.replace(".", ",") : s;
}

/** Heute als ISO-Datum (YYYY-MM-DD) — Vorbelegung für Beginn/Ende. */
export function todayIso(): string {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

/** ISO-Datum (YYYY-MM-DD) → lokalisiert; leere/ungültige Eingabe → undefined. */
export function formatIsoDate(iso: string | null, locale: Locale): string | undefined {
  if (!iso) return undefined;
  const parsed = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return new Intl.DateTimeFormat(locale === "de" ? "de-DE" : "en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(parsed);
}
