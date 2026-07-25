import type { BadgeTone } from "@/components/ui/Badge";
import type { InvoiceDetail, InvoiceStatus } from "@/lib/types";

/**
 * Abgeleitete Ansichten der Rechnungsliste (Seriositätszone). Alle Funktionen
 * sind PUR und arbeiten auf den von der Facade geladenen Arrays — sie
 * funktionieren dadurch für mock UND api identisch. KONSISTENZ-REGEL:
 * Summen entstehen aus DENSELBEN Datensätzen wie die angezeigten Zeilen.
 */

/** Filter über der Tabelle: „Alle" plus die fünf Rechnungs-Status. */
export type InvoiceStatusFilter = "all" | InvoiceStatus;

export const STATUS_FILTERS: InvoiceStatusFilter[] = [
  "all",
  "open",
  "partially_paid",
  "paid",
  "cancelled",
  "draft",
];

/** Chip-Ton je Status (Wort + Farbe — nie nur Farbe, DESIGN-SYSTEM §3.6). */
export const STATUS_TONE: Record<InvoiceStatus, BadgeTone> = {
  draft: "neutral",
  open: "info",
  // Teilbezahlt (0072) ist bewusst NICHT "success": es ist noch etwas offen.
  partially_paid: "warn",
  paid: "success",
  cancelled: "neutral",
};

/** i18n-Schlüssel des Status-Labels (Pille + Filter) — Literale für t(). */
export const STATUS_KEY = {
  draft: "statusDraft",
  open: "statusOpen",
  partially_paid: "statusPartiallyPaid",
  paid: "statusPaid",
  cancelled: "statusCancelled",
} as const satisfies Record<InvoiceStatus, string>;

/** i18n-Schlüssel des Filter-Chip-Labels — Literale für t(). */
export const FILTER_KEY = {
  all: "fAll",
  open: "statusOpen",
  partially_paid: "statusPartiallyPaid",
  paid: "statusPaid",
  cancelled: "statusCancelled",
  draft: "statusDraft",
} as const satisfies Record<InvoiceStatusFilter, string>;

/** Summe der Beträge einer Rechnungsmenge in Cents (nie hart codiert). */
export function sumInvoiceCents(invoices: readonly InvoiceDetail[]): number {
  return invoices.reduce((sum, invoice) => sum + invoice.amountCents, 0);
}

/**
 * MwSt-Vorschläge für die Positionseingabe. KEIN Katalog und kein Zwang (0072) —
 * nur eine Bequemlichkeit; der Wert bleibt eine freie Zahl an der Position.
 */
export const VAT_RATE_OPTIONS = [0, 7, 19] as const;

/**
 * Zeilensummen einer Position mit der DB-Rundungsregel (0072): auf der ZEILE
 * gerundet (net = round(menge·preis), vat = round(net·satz/100), gross = net+vat).
 * Dient nur der Live-Vorschau/Anfangswerten im Client — die Wahrheit ist die DB.
 */
export function lineCents(
  quantity: number,
  unitPriceCents: number,
  vatRate: number,
): { net: number; vat: number; gross: number } {
  const net = Math.round(quantity * unitPriceCents);
  const vat = Math.round((net * vatRate) / 100);
  return { net, vat, gross: net + vat };
}

/**
 * Mengen-Eingabe („2", „1,5", „0.5") → Zahl. Akzeptiert Komma und Punkt als
 * Dezimaltrenner. Rückgabe null bei leerer oder ungültiger Eingabe.
 */
export function parseQuantity(input: string): number | null {
  const cleaned = input.trim().replace(",", ".").replace(/[^\d.]/g, "");
  if (!cleaned) return null;
  const value = Number(cleaned);
  if (!Number.isFinite(value) || value <= 0) return null;
  return value;
}

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
    // Komma ist Dezimaltrenner (de) — Punkte sind Tausenderpunkte.
    normalized = cleaned.replace(/\./g, "").replace(",", ".");
  } else if (lastDot > lastComma) {
    // Punkt ist Dezimaltrenner (en) — Kommata sind Tausendertrenner.
    normalized = cleaned.replace(/,/g, "");
  } else {
    normalized = cleaned;
  }
  const value = Number(normalized);
  if (!Number.isFinite(value) || value < 0) return null;
  return Math.round(value * 100);
}
