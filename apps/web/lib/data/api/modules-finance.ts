import type * as M from "@/lib/api/generated";
import type { DataRepository } from "../types";
import type { CreateLedgerEntryInput } from "../inputs-finance";
import { apiClient } from "./client";
import { mapLedgerEntry } from "./mappers";
import {
  mapDunningApplyResult,
  mapDunningLogEntry,
  mapInvoiceDetail,
  mapLedgerCategory,
} from "./mappers-finance";

/**
 * API-Implementierung der Finanz-A-Module (Kassenbuch inkl. Kategorien,
 * Rechnungs-Detail/Settle, Mahnwesen). Ausgelagert aus api/index.ts
 * (< 400 Zeilen).
 *
 * Rechte SERVERSEITIG (RLS): alle Reads/Writes = can_manage_finance; ein
 * Mitglied sieht nur die EIGENEN Rechnungen. Fehler kommen als ApiError
 * (RFC 7807): Doppel-Storno / ungültiger Settle-Übergang → 409, Eskalation
 * ohne Freigabe → 403, fehlende Berechtigung → 403.
 */

/** Die 11 Finanz-A-Modul-Methoden — wird in apiRepository gespreizt. */
type ModuleMethods = Pick<
  DataRepository,
  | "listLedger"
  | "createLedgerEntry"
  | "reverseLedgerEntry"
  | "listLedgerCategories"
  | "createLedgerCategory"
  | "listInvoices"
  | "getInvoice"
  | "createInvoice"
  | "settleInvoice"
  | "applyDunning"
  | "listDunningLog"
>;

/** View-Gegenpartei → Wire-Felder (person→member_id, org→name). */
function counterpartyWire(
  cp: CreateLedgerEntryInput["counterparty"],
): Pick<M.LedgerEntryCreate, "counterparty_kind" | "counterparty_member_id" | "counterparty_name"> {
  return cp.kind === "person"
    ? { counterparty_kind: "person", counterparty_member_id: cp.memberId }
    : { counterparty_kind: "org", counterparty_name: cp.name };
}

export const moduleApiRepositoryFinance: ModuleMethods = {
  /* ---------- Kassenbuch ---------- */
  async listLedger(clubId) {
    const rows = await apiClient.getLedger({ club_id: clubId });
    return rows.map(mapLedgerEntry);
  },
  async createLedgerEntry(input) {
    const created = await apiClient.postLedger({
      club_id: input.clubId,
      entry_on: input.entryOn,
      description: input.description,
      ...counterpartyWire(input.counterparty),
      amount_cents: input.amountCents,
      category: input.category,
      category_id: input.categoryId,
      invoice_id: input.invoiceId,
    });
    return mapLedgerEntry(created);
  },
  async reverseLedgerEntry(entryId, input) {
    const created = await apiClient.postLedgerByEntryIdReverse(
      entryId,
      input?.description ? { description: input.description } : undefined,
    );
    return mapLedgerEntry(created);
  },
  async listLedgerCategories(clubId) {
    const rows = await apiClient.getLedgerCategories({ club_id: clubId });
    return rows.map(mapLedgerCategory);
  },
  async createLedgerCategory(input) {
    const created = await apiClient.postLedgerCategories({
      club_id: input.clubId,
      name: input.name,
      kind: input.kind,
      sort_order: input.sortOrder,
    });
    return mapLedgerCategory(created);
  },

  /* ---------- Rechnungen ---------- */
  async listInvoices(clubId, filter) {
    const rows = await apiClient.getInvoices({
      club_id: clubId,
      status: filter?.status,
      member_id: filter?.memberId,
    });
    return rows.map(mapInvoiceDetail);
  },
  async getInvoice(invoiceId) {
    const w = await apiClient.getInvoicesByInvoiceId(invoiceId);
    return mapInvoiceDetail(w);
  },
  async createInvoice(input) {
    const created = await apiClient.postInvoices({
      club_id: input.clubId,
      member_id: input.memberId,
      title: input.title,
      amount_cents: input.amountCents,
      due_on: input.dueOn,
      issue: input.issue,
    });
    return mapInvoiceDetail(created);
  },
  async settleInvoice(invoiceId, input) {
    const updated = await apiClient.patchInvoicesByInvoiceId(invoiceId, {
      status: input.status,
      paid_via: input.paidVia,
      post_to_ledger: input.postToLedger,
      ledger_category_id: input.ledgerCategoryId,
    });
    return mapInvoiceDetail(updated);
  },

  /* ---------- Mahnwesen ---------- */
  async applyDunning(clubId, input) {
    const result = await apiClient.postClubsByClubIdDunningApply(clubId, {
      invoice_ids: input.invoiceIds,
      to_stage: input.toStage,
      approve_escalation: input.approveEscalation,
      note: input.note,
    });
    return mapDunningApplyResult(result);
  },
  async listDunningLog(clubId, filter) {
    const rows = await apiClient.getClubsByClubIdDunningLog(
      clubId,
      filter?.invoiceId ? { invoice_id: filter.invoiceId } : undefined,
    );
    return rows.map(mapDunningLogEntry);
  },
};
