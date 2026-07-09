import type { Invoice, LedgerEntry } from "@/lib/types";
import { club } from "./club";
import { dateFromNow } from "./util";

const c = club.id;

/**
 * Finanzen (Seriositätszone) — KONSISTENZ-REGEL aus dem Design-System:
 * „Die Zahlen müssen quer über den Screen aufgehen."
 * Offene Posten = Summe der offenen Rechnungen (siehe sumOpenCents unten);
 * Kassenbuch-Einnahmen zu Rechnungen tragen deren invoiceId und Betrag 1:1.
 */
export const invoices: Invoice[] = [
  // --- Offen (Mahnstufen-Treppe: 0 offen · 1 Erinnerung · 2 = 1. Mahnung · 3 = 2. Mahnung) ---
  {
    id: "i-01", clubId: c, number: "R-2026-0083", memberId: "m-09",
    title: "Vereinsbeitrag Q2 — Familie Grünewald", amountCents: 8600, currency: "EUR",
    issuedAt: dateFromNow(-56), dueAt: dateFromNow(-42), status: "open", dunningLevel: 2,
  },
  {
    id: "i-02", clubId: c, number: "R-2026-0084", memberId: "m-12",
    title: "Vereinsbeitrag Q2 — Familie Müller", amountCents: 8600, currency: "EUR",
    issuedAt: dateFromNow(-32), dueAt: dateFromNow(-18), status: "open", dunningLevel: 1,
  },
  {
    id: "i-03", clubId: c, number: "R-2026-0090", memberId: "m-14",
    title: "Wettkampfmeldung Bezirksmeisterschaft — Finn", amountCents: 3500, currency: "EUR",
    issuedAt: dateFromNow(-8), dueAt: dateFromNow(6), status: "open", dunningLevel: 0,
  },
  {
    id: "i-04", clubId: c, number: "R-2026-0088", memberId: "m-22",
    title: "Trainingslager Herbst — Anzahlung", amountCents: 12000, currency: "EUR",
    issuedAt: dateFromNow(-18), dueAt: dateFromNow(-4), status: "open", dunningLevel: 0,
  },
  {
    id: "i-05", clubId: c, number: "R-2026-0071", memberId: "m-18",
    title: "Vereinsbeitrag Q2", amountCents: 5400, currency: "EUR",
    issuedAt: dateFromNow(-77), dueAt: dateFromNow(-63), status: "open", dunningLevel: 3,
  },

  // --- Bezahlt ---
  {
    id: "i-06", clubId: c, number: "R-2026-0080", memberId: "m-17",
    title: "Vereinsbeitrag Q2", amountCents: 5400, currency: "EUR",
    issuedAt: dateFromNow(-40), dueAt: dateFromNow(-26), status: "paid", dunningLevel: 0,
    paidAt: dateFromNow(-12),
  },
  {
    id: "i-07", clubId: c, number: "R-2026-0081", memberId: "m-16",
    title: "Vereinsbeitrag Q2", amountCents: 5400, currency: "EUR",
    issuedAt: dateFromNow(-40), dueAt: dateFromNow(-26), status: "paid", dunningLevel: 0,
    paidAt: dateFromNow(-11),
  },
  {
    id: "i-08", clubId: c, number: "R-2026-0082", memberId: "m-23",
    title: "Vereinsbeitrag Q2", amountCents: 5400, currency: "EUR",
    issuedAt: dateFromNow(-40), dueAt: dateFromNow(-26), status: "paid", dunningLevel: 0,
    paidAt: dateFromNow(-9),
  },
  {
    id: "i-09", clubId: c, number: "R-2026-0089", memberId: "m-09",
    title: "Wettkampfmeldung Bezirksmeisterschaft — Lina", amountCents: 3500, currency: "EUR",
    issuedAt: dateFromNow(-8), dueAt: dateFromNow(6), status: "paid", dunningLevel: 0,
    paidAt: dateFromNow(-7),
  },
  {
    id: "i-10", clubId: c, number: "R-2026-0087", memberId: "m-12",
    title: "Trainingslager Herbst — Anzahlung", amountCents: 12000, currency: "EUR",
    issuedAt: dateFromNow(-18), dueAt: dateFromNow(-4), status: "paid", dunningLevel: 0,
    paidAt: dateFromNow(-5),
  },
];

/** Kassenbuch: Menschen = Avatar, Organisationen = Icon-Kachel (radius-org). */
export const ledger: LedgerEntry[] = [
  { id: "l-01", clubId: c, date: dateFromNow(-12), description: "Vereinsbeitrag Q2 — Johanna Bär", counterparty: { kind: "person", memberId: "m-17" }, amountCents: 5400, category: "Beiträge", invoiceId: "i-06" },
  { id: "l-02", clubId: c, date: dateFromNow(-11), description: "Vereinsbeitrag Q2 — Maja Weiß", counterparty: { kind: "person", memberId: "m-16" }, amountCents: 5400, category: "Beiträge", invoiceId: "i-07" },
  { id: "l-03", clubId: c, date: dateFromNow(-10), description: "Hallenmiete Ballei-Sporthalle Juni", counterparty: { kind: "org", name: "Stadt Neckarsulm" }, amountCents: -68000, category: "Miete" },
  { id: "l-04", clubId: c, date: dateFromNow(-9), description: "Vereinsbeitrag Q2 — Hanna Förster", counterparty: { kind: "person", memberId: "m-23" }, amountCents: 5400, category: "Beiträge", invoiceId: "i-08" },
  { id: "l-05", clubId: c, date: dateFromNow(-8), description: "Musiklizenz Trainingsbetrieb", counterparty: { kind: "org", name: "GEMA" }, amountCents: -4900, category: "Lizenzen" },
  { id: "l-06", clubId: c, date: dateFromNow(-7), description: "Wettkampfmeldung Lina Grünewald", counterparty: { kind: "person", memberId: "m-09" }, amountCents: 3500, category: "Wettkampf", invoiceId: "i-09" },
  { id: "l-07", clubId: c, date: dateFromNow(-6), description: "Meldegebühren Bezirksmeisterschaft", counterparty: { kind: "org", name: "DRIV Bezirk Nord-Württemberg" }, amountCents: -21000, category: "Wettkampf" },
  { id: "l-08", clubId: c, date: dateFromNow(-5), description: "Trainingslager-Anzahlung Familie Müller", counterparty: { kind: "person", memberId: "m-12" }, amountCents: 12000, category: "Trainingslager", invoiceId: "i-10" },
  { id: "l-09", clubId: c, date: dateFromNow(-4), description: "Ersatzrollen und Schleifservice", counterparty: { kind: "org", name: "Sportbedarf Schmid" }, amountCents: -8750, category: "Material" },
  { id: "l-10", clubId: c, date: dateFromNow(-3), description: "SEPA-Lauf Monatsbeiträge Juni", counterparty: { kind: "org", name: "SEPA-Sammellauf" }, amountCents: 43200, category: "Beiträge" },
];

/* ---------- Abgeleitete, garantiert konsistente Summen ---------- */

export const openInvoices = invoices.filter((i) => i.status === "open");

/** Offene Posten — IMMER aus den offenen Rechnungen summiert, nie hart codiert. */
export const sumOpenCents = openInvoices.reduce((sum, i) => sum + i.amountCents, 0);

export const sumPaidCents = invoices
  .filter((i) => i.status === "paid")
  .reduce((sum, i) => sum + i.amountCents, 0);

/** Eskalations-Pipeline: Anzahl + Summe pro Mahnstufe (für die 4 Stufen-Kacheln). */
export const dunningPipeline = ([0, 1, 2, 3] as const).map((level) => {
  const stage = openInvoices.filter((i) => i.dunningLevel === level);
  return {
    level,
    count: stage.length,
    sumCents: stage.reduce((sum, i) => sum + i.amountCents, 0),
  };
});

/** Kassenbuch-Saldo (fortlaufend aufsummiert). */
export const ledgerBalanceCents = ledger.reduce((sum, e) => sum + e.amountCents, 0);
