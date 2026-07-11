import { club } from "@/lib/mock";
import type { BankTransaction, Donation } from "@/lib/types";
import { dateFromNow } from "@/lib/mock/util";

/**
 * Mock-Seed der Finanz-C-Module (Bankabgleich + Spenden). Spiegelt die
 * DB-Seed-Absicht, damit die Screens auch ohne Dev-Stack erfahrbar sind. Kein
 * echter Rechtecheck — die Wahrheit ist im api-Modus der Server (RLS).
 * amountCents ist VORZEICHENBEHAFTET (+ Eingang / − Ausgang).
 */

const c = club.id;

/**
 * 6 Bankumsätze: unmatched-Eingänge (Match-Kandidaten zu offenen Rechnungen),
 * ein Ausgang, eine bereits gematchte und eine ignorierte Zeile.
 */
export const bankTransactionSeed: BankTransaction[] = [
  {
    id: "bt-01", clubId: c, bookedOn: dateFromNow(-6), amountCents: 8600,
    purpose: "Vereinsbeitrag Q2 R-2026-0083", counterparty: "Familie Grünewald",
    status: "unmatched", importedAt: `${dateFromNow(-5)}T07:00:00.000Z`,
  },
  {
    id: "bt-02", clubId: c, bookedOn: dateFromNow(-5), amountCents: 3500,
    purpose: "Wettkampfmeldung Bezirk Finn", counterparty: "M. Berger",
    status: "unmatched", importedAt: `${dateFromNow(-5)}T07:00:00.000Z`,
  },
  {
    id: "bt-03", clubId: c, bookedOn: dateFromNow(-5), amountCents: 12000,
    purpose: "Trainingslager Herbst Anzahlung", counterparty: "Familie Roth",
    status: "unmatched", importedAt: `${dateFromNow(-5)}T07:00:00.000Z`,
  },
  {
    id: "bt-04", clubId: c, bookedOn: dateFromNow(-4), amountCents: -68000,
    purpose: "Hallenmiete Juni", counterparty: "Stadt Neckarsulm",
    status: "unmatched", importedAt: `${dateFromNow(-4)}T07:00:00.000Z`,
  },
  {
    id: "bt-05", clubId: c, bookedOn: dateFromNow(-8), amountCents: 5400,
    purpose: "Vereinsbeitrag Q2 R-2026-0080", counterparty: "Johanna Bär",
    status: "matched", matchedInvoiceId: "i-06", matchedLedgerEntryId: "l-01",
    importedAt: `${dateFromNow(-8)}T07:00:00.000Z`,
  },
  {
    id: "bt-06", clubId: c, bookedOn: dateFromNow(-3), amountCents: -1290,
    purpose: "Kontoführungsgebühr", counterparty: "Volksbank Neckartal",
    status: "ignored", importedAt: `${dateFromNow(-3)}T07:00:00.000Z`,
  },
];

/**
 * 3 Spenden: eine ausgestellte (eingefroren), ein Entwurf mit Mitglied und
 * eine anonyme Spende (nur Finanz sichtbar). receiptNumber ist serverseitig
 * vergeben (SP-JJJJ-NNNN) — im Mock vorbelegt.
 */
export const donationSeed: Donation[] = [
  {
    id: "don-01", clubId: c, memberId: "m-09", donorName: "Petra Grünewald",
    donorAddress: "Rosenweg 4, 74172 Neckarsulm", amountCents: 15000,
    donationDate: dateFromNow(-40), receiptNumber: "SP-2026-0001",
    purpose: "Förderung Nachwuchsarbeit", issuedAt: `${dateFromNow(-38)}T10:00:00.000Z`,
  },
  {
    id: "don-02", clubId: c, memberId: "m-16", donorName: "Maja Weiß",
    donorAddress: "Lindenstraße 12, 74076 Heilbronn", amountCents: 5000,
    donationDate: dateFromNow(-12), receiptNumber: "SP-2026-0002",
    purpose: "Sachspende Trainingsmaterial",
  },
  {
    id: "don-03", clubId: c, donorName: "Anonym", amountCents: 25000,
    donationDate: dateFromNow(-20), receiptNumber: "SP-2026-0003",
    purpose: "Allgemeine Vereinsförderung",
  },
];
