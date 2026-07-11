import type { Donation } from "@/lib/types";

/**
 * Reine Ableitungen des Spenden-Screens (keine React-/Facade-Abhängigkeit):
 * Datums-/Betrags-Parsing für das Erfassen-Formular, stabile Sortierung der
 * Liste und die Kennzahlen der KPI-Zeile. Beträge sind Integer-Cent
 * (amountCents); Spenden sind stets Einnahmen (positiv).
 */

/** Heutiges Datum als ISO (YYYY-MM-DD) in lokaler Zeit — Default/Max fürs Datumsfeld. */
export function todayISODate(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

/** Euro-Eingabe („50,00" / „50.00") → Cents; null bei ungültig oder ≤ 0. */
export function parseAmountCents(raw: string): number | null {
  const n = Number(raw.trim().replace(/\s/g, "").replace(",", "."));
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 100);
}

/**
 * Neueste Spenden zuerst: primär nach Spendendatum (absteigend), bei Gleichstand
 * nach Bescheinigungsnummer (absteigend) — so springt eine eben erfasste Spende
 * verlässlich nach oben, unabhängig von der Datenquelle.
 */
export function sortDonations(donations: Donation[]): Donation[] {
  return [...donations].sort((a, b) => {
    const byDate = b.donationDate.localeCompare(a.donationDate);
    return byDate !== 0 ? byDate : b.receiptNumber.localeCompare(a.receiptNumber);
  });
}

/** Kennzahlen der KPI-Zeile: Summe, Anzahl, ausgestellt, Entwürfe. */
export interface DonationSummary {
  totalCents: number;
  count: number;
  issuedCount: number;
  draftCount: number;
}

export function summarizeDonations(donations: Donation[]): DonationSummary {
  let totalCents = 0;
  let issuedCount = 0;
  for (const d of donations) {
    totalCents += d.amountCents;
    if (d.issuedAt) issuedCount += 1;
  }
  return {
    totalCents,
    count: donations.length,
    issuedCount,
    draftCount: donations.length - issuedCount,
  };
}
