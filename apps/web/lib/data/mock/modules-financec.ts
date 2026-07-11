import { club, invoices, ledger, members } from "@/lib/mock";
import { ApiError } from "@/lib/api/generated";
import type {
  AnnualCategoryRow,
  AnnualReport,
  AnnualYearTotals,
  BankTransaction,
  Donation,
  DonationReceipt,
  FinanceExport,
  LedgerCategoryKind,
} from "@/lib/types";
import type { DataRepository } from "../types";
import { bankTransactionSeed, donationSeed } from "./seed-financec";

/**
 * Mock-Implementierung der Finanz-C-Module (Bankabgleich, Spenden/Bescheinigungen,
 * Jahresabschluss + Datei-Export). Eigene In-Memory-Stores (Session-Lebensdauer),
 * kein echter Rechtecheck — die Wahrheit ist im api-Modus der Server (RLS). Die
 * GoBD-/Match-Semantik wird trotzdem plausibel abgebildet, inkl. Negativpfade als
 * ApiError (Match einer ignored-Zeile → 409, Ignore einer matched-Zeile → 409,
 * Patch/erneutes issue einer ausgestellten Spende → 409). Der Export erzeugt
 * echte CSV-Blobs aus den Mock-Daten (UTF-8 + BOM, Semikolon, deutsches Komma).
 */

const bankStore: BankTransaction[] = bankTransactionSeed.map((x) => ({ ...x }));
const donationStore: Donation[] = donationSeed.map((x) => ({ ...x }));

let bankSeq = bankStore.length;
let ledgerSeq = 900;
let donationSeq = donationStore.length;

/** Anzeigename einer Person (Mock) für Kassenbuch/CSV. */
function personName(memberId: string): string {
  const m = members.find((x) => x.id === memberId);
  return m ? `${m.firstName} ${m.lastName}` : "Mitglied";
}

/** Cent → deutscher Euro-String mit Komma (z. B. -68000 → „-680,00"). */
function eur(cents: number): string {
  return (cents / 100).toLocaleString("de-DE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Zeilen als UTF-8-CSV (BOM, Semikolon-getrennt) in einen Download-Blob gießen. */
function csvExport(rows: string[][], filename: string): FinanceExport {
  const body = rows.map((cols) => cols.join(";")).join("\r\n");
  const blob = new Blob([`﻿${body}\r\n`], { type: "text/csv;charset=utf-8" });
  return { blob, filename, contentType: "text/csv;charset=utf-8" };
}

/** Die 13 Finanz-C-Modul-Methoden — wird in mockRepository gespreizt. */
type ModuleMethods = Pick<
  DataRepository,
  | "listBankTransactions"
  | "createBankTransaction"
  | "importBankTransactions"
  | "matchBankTransaction"
  | "ignoreBankTransaction"
  | "listDonations"
  | "createDonation"
  | "updateDonation"
  | "markDonationIssued"
  | "getDonationReceipt"
  | "getAnnualReport"
  | "exportLedgerCsv"
  | "exportDatev"
>;

export const moduleRepositoryFinanceC: ModuleMethods = {
  /* ---------- Bankabgleich ---------- */
  async listBankTransactions(clubId, status) {
    return bankStore.filter(
      (t) => t.clubId === clubId && !t.deletedAt && (!status || t.status === status),
    );
  },
  async createBankTransaction(input) {
    const tx: BankTransaction = {
      id: `bt-local-${++bankSeq}`,
      clubId: input.clubId,
      bookedOn: input.bookedOn,
      amountCents: input.amountCents,
      purpose: input.purpose,
      counterparty: input.counterparty,
      status: "unmatched",
      importedAt: new Date().toISOString(),
    };
    bankStore.push(tx);
    return tx;
  },
  async importBankTransactions(input) {
    const importedAt = new Date().toISOString();
    const created = input.rows.map((r): BankTransaction => {
      const tx: BankTransaction = {
        id: `bt-local-${++bankSeq}`,
        clubId: input.clubId,
        bookedOn: r.bookedOn,
        amountCents: r.amountCents,
        purpose: r.purpose,
        counterparty: r.counterparty,
        status: "unmatched",
        importedAt,
      };
      bankStore.push(tx);
      return tx;
    });
    return created;
  },
  async matchBankTransaction(transactionId, input) {
    const tx = bankStore.find((t) => t.id === transactionId);
    if (!tx) throw new ApiError(404, null, "bank_transaction_not_found");
    // Nur unmatched/matched matchbar — eine ignorierte Zeile → 409.
    if (tx.status === "ignored") throw new ApiError(409, null, "cannot_match_ignored");
    const invoice = invoices.find((i) => i.id === input.invoiceId);
    if (!invoice) throw new ApiError(404, null, "invoice_not_found");
    // Rechnung muss zum selben Verein gehören (sonst 422).
    if (invoice.clubId !== tx.clubId) throw new ApiError(422, null, "invoice_other_club");
    tx.status = "matched";
    tx.matchedInvoiceId = invoice.id;
    // postToLedger (Default true) + offene Rechnung → automatische Kassenbuch-Einnahme.
    // Bereits bezahlte Rechnung wird nur verknüpft (keine Doppelbuchung).
    if (input.postToLedger !== false && invoice.status === "open") {
      tx.matchedLedgerEntryId = `l-local-${++ledgerSeq}`;
    }
    return tx;
  },
  async ignoreBankTransaction(transactionId, _input) {
    const tx = bankStore.find((t) => t.id === transactionId);
    if (!tx) throw new ApiError(404, null, "bank_transaction_not_found");
    // Bereits gematchte Zeile → 409.
    if (tx.status === "matched") throw new ApiError(409, null, "cannot_ignore_matched");
    tx.status = "ignored";
    tx.matchedInvoiceId = undefined;
    tx.matchedLedgerEntryId = undefined;
    return tx;
  },

  /* ---------- Spenden ---------- */
  async listDonations(clubId, memberId) {
    return donationStore.filter(
      (d) => d.clubId === clubId && !d.deletedAt && (!memberId || d.memberId === memberId),
    );
  },
  async createDonation(input) {
    // receiptNumber wird serverseitig race-frei vergeben (SP-JJJJ-NNNN).
    const seq = String(++donationSeq).padStart(4, "0");
    const donation: Donation = {
      id: `don-local-${donationSeq}`,
      clubId: input.clubId,
      memberId: input.memberId,
      donorName: input.donorName,
      donorAddress: input.donorAddress,
      amountCents: input.amountCents,
      donationDate: input.donationDate,
      receiptNumber: `SP-2026-${seq}`,
      purpose: input.purpose,
      // Entwurf: issuedAt bleibt leer, bis explizit ausgestellt wird.
    };
    donationStore.push(donation);
    return donation;
  },
  async updateDonation(donationId, patch) {
    const donation = donationStore.find((d) => d.id === donationId);
    if (!donation) throw new ApiError(404, null, "donation_not_found");
    // Nach Ausstellung eingefroren (GoBD): kein Stammdaten-Patch, kein Re-Issue.
    if (donation.issuedAt) {
      if (patch.issue) throw new ApiError(409, null, "donation_already_issued");
      throw new ApiError(409, null, "donation_frozen");
    }
    if (patch.issue) {
      donation.issuedAt = new Date().toISOString();
      return donation;
    }
    if (patch.donorName !== undefined) donation.donorName = patch.donorName;
    if (patch.donorAddress !== undefined) donation.donorAddress = patch.donorAddress;
    if (patch.amountCents !== undefined) donation.amountCents = patch.amountCents;
    if (patch.donationDate !== undefined) donation.donationDate = patch.donationDate;
    if (patch.purpose !== undefined) donation.purpose = patch.purpose;
    return donation;
  },
  async markDonationIssued(donationId) {
    return this.updateDonation(donationId, { issue: true });
  },
  async getDonationReceipt(donationId) {
    const d = donationStore.find((x) => x.id === donationId);
    if (!d) throw new ApiError(404, null, "donation_not_found");
    const amountEur = eur(d.amountCents);
    const addressLine = d.donorAddress ? `, ${d.donorAddress}` : "";
    const purposeLine = d.purpose ? ` Zweck: ${d.purpose}.` : "";
    const receipt: DonationReceipt = {
      donationId: d.id,
      receiptNumber: d.receiptNumber,
      clubName: club.name,
      donorName: d.donorName,
      donorAddress: d.donorAddress,
      amountCents: d.amountCents,
      amountEur,
      donationDate: d.donationDate,
      purpose: d.purpose,
      issued: Boolean(d.issuedAt),
      text:
        `Zuwendungsbestätigung Nr. ${d.receiptNumber}\n\n` +
        `${club.name} bestätigt den Erhalt einer Geldzuwendung von ` +
        `${d.donorName}${addressLine} in Höhe von ${amountEur} EUR ` +
        `vom ${d.donationDate}.${purposeLine}\n\n` +
        `Es handelt sich nicht um den Verzicht auf Erstattung von Aufwendungen.`,
    };
    return receipt;
  },

  /* ---------- Jahresabschluss ---------- */
  async getAnnualReport(clubId, year) {
    return buildAnnualReport(clubId, year);
  },

  /* ---------- Datei-Export (CSV aus Mock-Daten) ---------- */
  async exportLedgerCsv(clubId, range) {
    const rows: string[][] = [["Datum", "Beschreibung", "Gegenpartei", "Kategorie", "Betrag"]];
    for (const e of ledger) {
      if (e.clubId !== clubId || e.date < range.from || e.date > range.to) continue;
      const cp = e.counterparty.kind === "person" ? personName(e.counterparty.memberId) : e.counterparty.name;
      rows.push([e.date, e.description, cp, e.category, eur(e.amountCents)]);
    }
    return csvExport(rows, `kassenbuch_${range.from}_${range.to}.csv`);
  },
  async exportDatev(clubId, year) {
    const rows: string[][] = [["Umsatz", "Soll/Haben", "Belegdatum", "Buchungstext"]];
    for (const e of ledger) {
      if (e.clubId !== clubId || e.date.slice(0, 4) !== String(year)) continue;
      rows.push([eur(Math.abs(e.amountCents)), e.amountCents >= 0 ? "S" : "H", e.date, e.description]);
    }
    return csvExport(rows, `datev_${year}.csv`);
  },
};

/* ---------- Jahresabschluss-Ableitung (plausibel aus mock.ledger/invoices) ---------- */

function yearTotals(clubId: string, year: number): AnnualYearTotals {
  let incomeCents = 0;
  let expenseCents = 0;
  for (const e of ledger) {
    if (e.clubId !== clubId || e.date.slice(0, 4) !== String(year)) continue;
    if (e.amountCents >= 0) incomeCents += e.amountCents;
    else expenseCents += -e.amountCents;
  }
  return { year, incomeCents, expenseCents, netCents: incomeCents - expenseCents };
}

function buildAnnualReport(clubId: string, year: number): AnnualReport {
  const cur = yearTotals(clubId, year);
  const prev = yearTotals(clubId, year - 1);

  // Kategorie-Gruppierung (Freitext), Vorzeichen bestimmt kind.
  const byCat = new Map<string, number>();
  for (const e of ledger) {
    if (e.clubId !== clubId || e.date.slice(0, 4) !== String(year)) continue;
    const key = e.category || "Sonstiges";
    byCat.set(key, (byCat.get(key) ?? 0) + e.amountCents);
  }
  const byCategory: AnnualCategoryRow[] = [...byCat.entries()].map(([name, amountCents]) => ({
    categoryName: name,
    kind: (amountCents >= 0 ? "income" : "expense") as LedgerCategoryKind,
    amountCents,
  }));

  const donations = donationStore.filter(
    (d) => d.clubId === clubId && !d.deletedAt && d.donationDate.slice(0, 4) === String(year),
  );
  const openItems = invoices.filter(
    (i) => i.clubId === clubId && i.status === "open" && i.issuedAt <= `${year}-12-31`,
  );

  return {
    clubId,
    year,
    incomeCents: cur.incomeCents,
    expenseCents: cur.expenseCents,
    netCents: cur.netCents,
    byCategory,
    prevYear: prev,
    netDeltaCents: cur.netCents - prev.netCents,
    donationsTotalCents: donations.reduce((sum, d) => sum + d.amountCents, 0),
    donationsCount: donations.length,
    openItemsCount: openItems.length,
    openItemsTotalCents: openItems.reduce((sum, i) => sum + i.amountCents, 0),
  };
}
