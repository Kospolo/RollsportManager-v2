import type * as M from "@/lib/api/generated";
import { ApiError } from "@/lib/api/generated";
import type { DataRepository } from "../types";
import type { CreateInvoiceInput, CreateLedgerEntryInput } from "../inputs-finance";
import { apiClient } from "./client";
import { mapLedgerEntry } from "./mappers";
import {
  emptyInvoiceSettings,
  mapDunningApplyResult,
  mapDunningLogEntry,
  mapInvoiceDetail,
  mapInvoiceItem,
  mapInvoiceSettings,
  mapLedgerCategory,
} from "./mappers-finance";

/**
 * Bruttosumme einer Positionsliste mit derselben Rundungsregel wie die DB
 * (0072): net = round(menge*preis), vat = round(net*satz/100), gross = net+vat.
 * Dient NUR als Anfangswert für amount_cents beim Anlegen — die Wahrheit
 * schreibt danach der DB-Trigger fort, und die Rechnung wird neu geladen.
 */
function grossSumCents(items: NonNullable<CreateInvoiceInput["items"]>): number {
  return items.reduce((sum, it) => {
    const net = Math.round(it.quantity * it.unitPriceCents);
    const vat = Math.round((net * it.vatRate) / 100);
    return sum + net + vat;
  }, 0);
}

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
  | "issueInvoice"
  | "listInvoiceItems"
  | "createInvoiceItem"
  | "updateInvoiceItem"
  | "deleteInvoiceItem"
  | "getInvoiceSettings"
  | "updateInvoiceSettings"
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
    const items = input.items ?? [];
    // Ohne Positionen: unverändertes Verhalten (Titel + Betrag, direkt offen/Entwurf).
    if (items.length === 0) {
      const created = await apiClient.postInvoices({
        club_id: input.clubId,
        member_id: input.memberId,
        title: input.title,
        amount_cents: input.amountCents,
        due_on: input.dueOn,
        issue: input.issue,
      });
      return mapInvoiceDetail(created);
    }

    // Mit Positionen: ZWINGEND als Entwurf anlegen (Positionen nur am Entwurf),
    // Positionen anhängen (die DB schreibt amount_cents fort), dann bei issue=true
    // ausstellen. Am Ende frisch laden -> DB-Wahrheit inkl. der Positionssummen.
    const created = await apiClient.postInvoices({
      club_id: input.clubId,
      member_id: input.memberId,
      title: input.title,
      amount_cents: grossSumCents(items),
      due_on: input.dueOn,
      issue: false,
    });
    for (let idx = 0; idx < items.length; idx += 1) {
      const it = items[idx];
      await apiClient.postInvoiceItems({
        club_id: input.clubId,
        invoice_id: created.id,
        sort_order: idx,
        description: it.description,
        quantity: it.quantity,
        unit_price_cents: it.unitPriceCents,
        vat_rate: it.vatRate,
      });
    }
    if (input.issue) {
      await apiClient.patchInvoicesByInvoiceId(created.id, { status: "open" });
    }
    const fresh = await apiClient.getInvoicesByInvoiceId(created.id);
    return mapInvoiceDetail(fresh);
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
  async issueInvoice(invoiceId) {
    const updated = await apiClient.patchInvoicesByInvoiceId(invoiceId, { status: "open" });
    return mapInvoiceDetail(updated);
  },

  /* ---------- Rechnungspositionen (0072) ---------- */
  async listInvoiceItems(clubId, invoiceId) {
    const rows = await apiClient.getInvoiceItems({ club_id: clubId, invoice_id: invoiceId });
    return rows.map(mapInvoiceItem);
  },
  async createInvoiceItem(input) {
    const created = await apiClient.postInvoiceItems({
      club_id: input.clubId,
      invoice_id: input.invoiceId,
      sort_order: input.sortOrder,
      description: input.description,
      quantity: input.quantity,
      unit_price_cents: input.unitPriceCents,
      vat_rate: input.vatRate,
    });
    return mapInvoiceItem(created);
  },
  async updateInvoiceItem(itemId, input) {
    const updated = await apiClient.patchInvoiceItemsByItemId(itemId, {
      description: input.description,
      quantity: input.quantity,
      unit_price_cents: input.unitPriceCents,
      vat_rate: input.vatRate,
      sort_order: input.sortOrder,
    });
    return mapInvoiceItem(updated);
  },
  async deleteInvoiceItem(itemId) {
    await apiClient.deleteInvoiceItemsByItemId(itemId);
  },

  /* ---------- Rechnungs-Einstellungen / Briefkopf (0080) ---------- */
  async getInvoiceSettings(clubId) {
    try {
      const w = await apiClient.getInvoiceSettings({ club_id: clubId });
      return mapInvoiceSettings(w);
    } catch (caught) {
      // 404 = noch kein Briefkopf gespeichert -> Default (kein Fehler).
      if (caught instanceof ApiError && caught.status === 404) {
        return emptyInvoiceSettings(clubId);
      }
      throw caught;
    }
  },
  async updateInvoiceSettings(input) {
    const saved = await apiClient.patchInvoiceSettings({
      club_id: input.clubId,
      sender_block: input.senderBlock,
      logo_url: input.logoUrl,
      tax_number: input.taxNumber,
      vat_id: input.vatId,
      board_members: input.boardMembers,
      footer_text: input.footerText,
      bank_name: input.bankName,
      iban: input.iban,
      bic: input.bic,
      account_holder: input.accountHolder,
      number_prefix: input.numberPrefix,
      default_vat_rate: input.defaultVatRate,
    });
    return mapInvoiceSettings(saved);
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
