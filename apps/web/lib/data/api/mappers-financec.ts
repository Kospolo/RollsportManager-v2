import type * as M from "@/lib/api/generated";
import type {
  AnnualCategoryRow,
  AnnualReport,
  AnnualYearTotals,
  BankTransaction,
  Donation,
  DonationReceipt,
} from "@/lib/types";

/**
 * Mapper der Finanz-C-Module (Bankabgleich, Spenden/Bescheinigungen,
 * Jahresabschluss): API-Wire-Format (snake_case, `T | null`) → View-Typen
 * (lib/types, camelCase, optionale Felder). Ausgelagert aus api/mappers.ts
 * (< 400 Zeilen). Beträge bleiben Integer-Cent (Mono/tabular).
 */

export function mapBankTransaction(w: M.BankTransaction): BankTransaction {
  return {
    id: w.id,
    clubId: w.club_id,
    bookedOn: w.booked_on,
    amountCents: w.amount_cents ?? 0,
    purpose: w.purpose ?? undefined,
    counterparty: w.counterparty ?? undefined,
    matchedInvoiceId: w.matched_invoice_id ?? undefined,
    matchedLedgerEntryId: w.matched_ledger_entry_id ?? undefined,
    status: w.status,
    importedAt: w.imported_at,
    deletedAt: w.deleted_at ?? undefined,
  };
}

export function mapDonation(w: M.Donation): Donation {
  return {
    id: w.id,
    clubId: w.club_id,
    memberId: w.member_id ?? undefined,
    donorName: w.donor_name,
    donorAddress: w.donor_address ?? undefined,
    amountCents: w.amount_cents ?? 0,
    donationDate: w.donation_date,
    receiptNumber: w.receipt_number,
    purpose: w.purpose ?? undefined,
    issuedAt: w.issued_at ?? undefined,
    deletedAt: w.deleted_at ?? undefined,
  };
}

export function mapDonationReceipt(w: M.DonationReceipt): DonationReceipt {
  return {
    donationId: w.donation_id,
    receiptNumber: w.receipt_number,
    clubName: w.club_name,
    donorName: w.donor_name,
    donorAddress: w.donor_address ?? undefined,
    amountCents: w.amount_cents ?? 0,
    amountEur: w.amount_eur,
    donationDate: w.donation_date,
    purpose: w.purpose ?? undefined,
    issued: w.issued,
    text: w.text,
  };
}

function mapAnnualCategoryRow(w: M.AnnualCategoryRow): AnnualCategoryRow {
  return {
    categoryId: w.category_id ?? undefined,
    categoryName: w.category_name ?? undefined,
    kind: w.kind,
    amountCents: w.amount_cents ?? 0,
  };
}

function mapAnnualYearTotals(w: M.AnnualYearTotals, fallbackYear: number): AnnualYearTotals {
  return {
    year: w.year ?? fallbackYear,
    incomeCents: w.income_cents ?? 0,
    expenseCents: w.expense_cents ?? 0,
    netCents: w.net_cents ?? 0,
  };
}

export function mapAnnualReport(w: M.AnnualReport): AnnualReport {
  const year = w.year ?? 0;
  return {
    clubId: w.club_id,
    year,
    incomeCents: w.income_cents ?? 0,
    expenseCents: w.expense_cents ?? 0,
    netCents: w.net_cents ?? 0,
    byCategory: w.by_category.map(mapAnnualCategoryRow),
    prevYear: mapAnnualYearTotals(w.prev_year, year - 1),
    netDeltaCents: w.net_delta_cents ?? 0,
    donationsTotalCents: w.donations_total_cents ?? 0,
    donationsCount: w.donations_count ?? 0,
    openItemsCount: w.open_items_count ?? 0,
    openItemsTotalCents: w.open_items_total_cents ?? 0,
  };
}
