import type { BadgeTone } from "@/components/ui/Badge";
import type { Id, MemberFee, MembershipPeriod, SepaMandate } from "@/lib/types";

/**
 * Abgeleitete Ansichten der Mitgliedsbeiträge (Seriositätszone). Alle
 * Funktionen sind PUR und arbeiten auf den von der Facade geladenen Arrays —
 * sie funktionieren dadurch für mock UND api identisch. KONSISTENZ-REGEL:
 * Summen entstehen aus DENSELBEN Datensätzen wie die angezeigten Zeilen.
 *
 * DATENSCHUTZ (SEPA): hier wird nur der Mandats-STATUS je Mitglied abgeleitet
 * (aktiv/widerrufen/keins) — nie eine IBAN.
 */

/* ---------- Zuordnungs-Filter über der Tabelle ---------- */

/** „Alle" plus Mitglieder mit bzw. ohne Beitragszuordnung. */
export type AssignmentFilter = "all" | "assigned" | "unassigned";

export const ASSIGNMENT_FILTERS: AssignmentFilter[] = ["all", "assigned", "unassigned"];

/** i18n-Schlüssel des Filter-Chip-Labels — Literale für t(). */
export const FILTER_KEY = {
  all: "fAll",
  assigned: "fAssigned",
  unassigned: "fUnassigned",
} as const satisfies Record<AssignmentFilter, string>;

/* ---------- Perioden (Label, Suffix, Ton, Annualisierung) ---------- */

export const PERIOD_ORDER: MembershipPeriod[] = ["monthly", "quarterly", "yearly", "once"];

/** Annualisierungs-Faktor je Periode (once = 0 → nicht wiederkehrend). */
export const ANNUAL_FACTOR: Record<MembershipPeriod, number> = {
  monthly: 12,
  quarterly: 4,
  yearly: 1,
  once: 0,
};

/** i18n-Schlüssel des Perioden-Labels (Badge + Kategorie-Auswahl). */
export const PERIOD_LABEL_KEY = {
  monthly: "periodMonthly",
  quarterly: "periodQuarterly",
  yearly: "periodYearly",
  once: "periodOnce",
} as const satisfies Record<MembershipPeriod, string>;

/** i18n-Schlüssel des Perioden-Suffix am Betrag („/Monat" …). */
export const PERIOD_SUFFIX_KEY = {
  monthly: "perMonth",
  quarterly: "perQuarter",
  yearly: "perYear",
  once: "perOnce",
} as const satisfies Record<MembershipPeriod, string>;

/** Chip-Ton je Periode (Wort + Farbe — nie nur Farbe, DESIGN-SYSTEM §3.6). */
export const PERIOD_TONE: Record<MembershipPeriod, BadgeTone> = {
  monthly: "brand",
  quarterly: "info",
  yearly: "success",
  once: "neutral",
};

/** Annualisierter Beitrag einer Zuordnung in Cent (once → 0). */
export function annualCents(
  fee: Pick<MemberFee, "effectiveAmountCents" | "categoryPeriod">,
): number {
  const period = fee.categoryPeriod ?? "monthly";
  return fee.effectiveAmountCents * ANNUAL_FACTOR[period];
}

/** Jahres-Beitragsvolumen einer Zuordnungsmenge in Cent (once ausgeschlossen). */
export function sumAnnualCents(fees: Iterable<MemberFee>): number {
  let sum = 0;
  for (const fee of fees) sum += annualCents(fee);
  return sum;
}

/**
 * „Primäre" Zuordnung eines Mitglieds, falls es mehrere gibt: wiederkehrend vor
 * once, offenes Ende vor befristetem, dann jüngstes validFrom. Deckt den
 * Regelfall (genau eine Zuordnung) mit ab.
 */
export function primaryFee(fees: readonly MemberFee[]): MemberFee | undefined {
  if (fees.length === 0) return undefined;
  return [...fees].sort((a, b) => {
    const aOnce = (a.categoryPeriod ?? "monthly") === "once" ? 1 : 0;
    const bOnce = (b.categoryPeriod ?? "monthly") === "once" ? 1 : 0;
    if (aOnce !== bOnce) return aOnce - bOnce;
    const aOpen = a.validUntil ? 1 : 0;
    const bOpen = b.validUntil ? 1 : 0;
    if (aOpen !== bOpen) return aOpen - bOpen;
    return b.validFrom.localeCompare(a.validFrom);
  })[0];
}

/* ---------- SEPA-Status je Mitglied (nur Status, keine IBAN) ---------- */

export type SepaState = "active" | "revoked" | "none";

/** Aktives Mandat gewinnt; sonst „widerrufen"; sonst „keins". */
export function sepaStateFor(mandates: readonly SepaMandate[], memberId: Id): SepaState {
  const own = mandates.filter((m) => m.memberId === memberId);
  if (own.some((m) => m.status === "active")) return "active";
  if (own.length > 0) return "revoked";
  return "none";
}

export const SEPA_TONE: Record<SepaState, BadgeTone> = {
  active: "success",
  revoked: "warn",
  none: "neutral",
};

export const SEPA_KEY = {
  active: "sepaActive",
  revoked: "sepaRevoked",
  none: "sepaNone",
} as const satisfies Record<SepaState, string>;

/* ---------- Euro-Eingabe (Sonderbetrag) ---------- */

/**
 * Euro-Eingabe („86,00" / „86" / „1.234,50" / „86.50") → Cents. Akzeptiert
 * deutsche und englische Trennzeichen; das letzte Komma/Punkt gilt als
 * Dezimaltrenner. Rückgabe null bei leerer oder ungültiger Eingabe.
 */
export function parseEuroToCents(input: string): number | null {
  const cleaned = input.trim().replace(/[^\d.,]/g, "");
  if (!cleaned) return null;
  const lastComma = cleaned.lastIndexOf(",");
  const lastDot = cleaned.lastIndexOf(".");
  let normalized: string;
  if (lastComma > lastDot) {
    normalized = cleaned.replace(/\./g, "").replace(",", ".");
  } else if (lastDot > lastComma) {
    normalized = cleaned.replace(/,/g, "");
  } else {
    normalized = cleaned;
  }
  const value = Number(normalized);
  if (!Number.isFinite(value) || value < 0) return null;
  return Math.round(value * 100);
}

/** Cent → „93,00" für die Vorbefüllung des Sonderbetrag-Felds (de-Komma). */
export function centsToEuroInput(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",");
}
