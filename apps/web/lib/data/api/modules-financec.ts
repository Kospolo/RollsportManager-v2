import { ApiError } from "@/lib/api/generated";
import { readSession } from "@/lib/auth/storage";
import type { FinanceExport } from "@/lib/types";
import type { DataRepository } from "../types";
import { API_BASE_URL } from "../config";
import { apiClient } from "./client";
import {
  mapAnnualReport,
  mapBankTransaction,
  mapDonation,
  mapDonationReceipt,
} from "./mappers-financec";

/**
 * API-Implementierung der Finanz-C-Module (Bankabgleich, Spenden/Bescheinigungen,
 * Jahresabschluss + Datei-Export). Ausgelagert aus api/index.ts (< 400 Zeilen).
 *
 * Rechte SERVERSEITIG (RLS): Bankabgleich/Jahresabschluss/Export sowie anonyme
 * Spenden = STRIKT can_manage_finance; ein Mitglied sieht nur die EIGENEN
 * Spenden. Fehler kommen als ApiError (RFC 7807): Match einer ignored-Zeile /
 * Ignore einer matched-Zeile → 409, fremde Rechnung → 422, ausgestellte Spende
 * → 409, fehlende Berechtigung → 403.
 *
 * EXPORT: /export/ledger.csv und /export/datev sind KEINE typisierten
 * JSON-Routen (plain Hono, außerhalb der Spec) — daher NICHT über den
 * generierten Client, sondern per Bearer-fetch als echter Datei-Download.
 */

/** Die 12 Finanz-C-Modul-Methoden — wird in apiRepository gespreizt. */
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

/** Dateinamen aus dem Content-Disposition-Header ziehen (RFC 5987 + klassisch). */
function filenameFromDisposition(disposition: string | null, fallback: string): string {
  if (!disposition) return fallback;
  const star = /filename\*=(?:UTF-8'')?"?([^";]+)"?/i.exec(disposition);
  if (star?.[1]) return decodeURIComponent(star[1]);
  const plain = /filename="?([^";]+)"?/i.exec(disposition);
  return plain?.[1] ?? fallback;
}

/**
 * Nicht-typisierten Export mit Bearer-Token holen und als Download aufbereiten.
 * Non-2xx → ApiError (403 = keine Finanzrolle). Der Dateiname steht im
 * Content-Disposition-Header; contentType i. d. R. text/csv;charset=utf-8.
 */
async function fetchExport(path: string, fallbackName: string): Promise<FinanceExport> {
  const token = readSession()?.token ?? null;
  const res = await fetch(`${API_BASE_URL}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new ApiError(res.status, null, `export_failed_${res.status}`);
  const blob = await res.blob();
  return {
    blob,
    filename: filenameFromDisposition(res.headers.get("content-disposition"), fallbackName),
    contentType: res.headers.get("content-type") ?? "text/csv;charset=utf-8",
  };
}

export const moduleApiRepositoryFinanceC: ModuleMethods = {
  /* ---------- Bankabgleich ---------- */
  async listBankTransactions(clubId, status) {
    const rows = await apiClient.getBankTransactions({ club_id: clubId, status });
    return rows.map(mapBankTransaction);
  },
  async createBankTransaction(input) {
    const created = await apiClient.postBankTransactions({
      club_id: input.clubId,
      booked_on: input.bookedOn,
      amount_cents: input.amountCents,
      purpose: input.purpose,
      counterparty: input.counterparty,
    });
    return mapBankTransaction(created);
  },
  async importBankTransactions(input) {
    const rows = await apiClient.postBankTransactionsImport({
      club_id: input.clubId,
      rows: input.rows.map((r) => ({
        booked_on: r.bookedOn,
        amount_cents: r.amountCents,
        purpose: r.purpose,
        counterparty: r.counterparty,
      })),
    });
    return rows.map(mapBankTransaction);
  },
  async matchBankTransaction(transactionId, input) {
    const updated = await apiClient.patchBankTransactionsByTransactionIdMatch(transactionId, {
      invoice_id: input.invoiceId,
      post_to_ledger: input.postToLedger,
      ledger_category_id: input.ledgerCategoryId,
    });
    return mapBankTransaction(updated);
  },
  async ignoreBankTransaction(transactionId, input) {
    const updated = await apiClient.patchBankTransactionsByTransactionIdIgnore(
      transactionId,
      input?.note ? { note: input.note } : undefined,
    );
    return mapBankTransaction(updated);
  },

  /* ---------- Spenden ---------- */
  async listDonations(clubId, memberId) {
    const rows = await apiClient.getDonations({ club_id: clubId, member_id: memberId });
    return rows.map(mapDonation);
  },
  async createDonation(input) {
    const created = await apiClient.postDonations({
      club_id: input.clubId,
      member_id: input.memberId,
      donor_name: input.donorName,
      donor_address: input.donorAddress,
      amount_cents: input.amountCents,
      donation_date: input.donationDate,
      purpose: input.purpose,
    });
    return mapDonation(created);
  },
  async updateDonation(donationId, patch) {
    const updated = await apiClient.patchDonationsByDonationId(donationId, {
      donor_name: patch.donorName,
      donor_address: patch.donorAddress,
      amount_cents: patch.amountCents,
      donation_date: patch.donationDate,
      purpose: patch.purpose,
      issue: patch.issue,
    });
    return mapDonation(updated);
  },
  async markDonationIssued(donationId) {
    // Ausstellen = issue:true patchen (Kurzform).
    const updated = await apiClient.patchDonationsByDonationId(donationId, { issue: true });
    return mapDonation(updated);
  },
  async getDonationReceipt(donationId) {
    const receipt = await apiClient.getDonationsByDonationIdReceipt(donationId);
    return mapDonationReceipt(receipt);
  },

  /* ---------- Jahresabschluss ---------- */
  async getAnnualReport(clubId, year) {
    const report = await apiClient.getReportsAnnual({ club_id: clubId, year });
    return mapAnnualReport(report);
  },

  /* ---------- Datei-Export (nicht typisiert, Bearer-fetch) ---------- */
  async exportLedgerCsv(clubId, range) {
    const query = new URLSearchParams({ club_id: clubId, from: range.from, to: range.to });
    return fetchExport(`/export/ledger.csv?${query}`, `kassenbuch_${range.from}_${range.to}.csv`);
  },
  async exportDatev(clubId, year) {
    const query = new URLSearchParams({ club_id: clubId, year: String(year) });
    return fetchExport(`/export/datev?${query}`, `datev_${year}.csv`);
  },
};
