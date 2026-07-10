import { invoices, ledger, members } from "@/lib/mock";
import { ApiError } from "@/lib/api/generated";
import type {
  DunningLevel,
  DunningLogAction,
  DunningLogEntry,
  InvoiceDetail,
  LedgerCategory,
  LedgerEntry,
} from "@/lib/types";
import type { DataRepository } from "../types";
import {
  dunningLogSeed,
  ledgerCategorySeed,
  legacyCategoryMap,
} from "./seed-finance";

/**
 * Mock-Implementierung der Finanz-A-Module (Kassenbuch inkl. Kategorien,
 * Rechnungs-Detail/Settle, Mahnwesen). Eigene In-Memory-Stores
 * (Session-Lebensdauer), kein echter Rechtecheck — die Wahrheit ist im
 * api-Modus der Server (RLS). Die GoBD-Semantik (Storno statt Löschen,
 * terminaler Settle, Eskalations-Freigabe) wird trotzdem plausibel abgebildet,
 * inkl. der Negativpfade als ApiError (Doppel-Storno → 409, ungültiger
 * Settle-Übergang → 409, Stufe ≥ 2 ohne Freigabe → 403).
 */

const today = (): string => new Date().toISOString().slice(0, 10);
/** Aktuelle Person (Mock) — spiegelt mockRepository.getCurrentUser (m-01). */
const currentMemberId = members[0].id;

const categoryStore: LedgerCategory[] = ledgerCategorySeed.map((cat) => ({ ...cat }));

/** mock.ledger mit strukturierter Kategorie (Join) anreichern. */
const ledgerStore: LedgerEntry[] = ledger.map((e) => {
  const catId = legacyCategoryMap[e.category];
  const cat = catId ? categoryStore.find((c) => c.id === catId) : undefined;
  return { ...e, categoryId: cat?.id, categoryName: cat?.name, categoryKind: cat?.kind };
});

const invoiceStore: InvoiceDetail[] = invoices.map((i) => ({ ...i }));
const dunningLogStore: DunningLogEntry[] = dunningLogSeed.map((d) => ({ ...d }));

let ledgerSeq = ledgerStore.length;
let categorySeq = categoryStore.length;
let invoiceSeq = invoiceStore.length;
let dunningSeq = dunningLogStore.length;

/** Die 11 Finanz-A-Modul-Methoden — wird in mockRepository gespreizt. */
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

export const moduleRepositoryFinance: ModuleMethods = {
  /* ---------- Kassenbuch ---------- */
  async listLedger(clubId) {
    return ledgerStore.filter((e) => e.clubId === clubId);
  },
  async createLedgerEntry(input) {
    const cat = input.categoryId
      ? categoryStore.find((c) => c.id === input.categoryId)
      : undefined;
    const entry: LedgerEntry = {
      id: `l-local-${++ledgerSeq}`,
      clubId: input.clubId,
      date: input.entryOn,
      description: input.description,
      counterparty: input.counterparty,
      amountCents: input.amountCents,
      category: input.category ?? cat?.name ?? "",
      categoryId: input.categoryId,
      categoryName: cat?.name,
      categoryKind: cat?.kind,
      invoiceId: input.invoiceId,
    };
    ledgerStore.push(entry);
    return entry;
  },
  async reverseLedgerEntry(entryId, input) {
    const orig = ledgerStore.find((e) => e.id === entryId);
    if (!orig) throw new ApiError(404, null, "ledger_entry_not_found");
    // Storno einer Storno oder eines bereits stornierten Eintrags → 409.
    if (orig.reversesEntryId) throw new ApiError(409, null, "cannot_reverse_reversal");
    if (ledgerStore.some((e) => e.reversesEntryId === entryId)) {
      throw new ApiError(409, null, "already_reversed");
    }
    const reversal: LedgerEntry = {
      id: `l-local-${++ledgerSeq}`,
      clubId: orig.clubId,
      date: today(),
      description: input?.description ?? `Storno: ${orig.description}`,
      counterparty: orig.counterparty,
      amountCents: -orig.amountCents,
      category: orig.category,
      categoryId: orig.categoryId,
      categoryName: orig.categoryName,
      categoryKind: orig.categoryKind,
      invoiceId: orig.invoiceId,
      reversesEntryId: orig.id,
    };
    ledgerStore.push(reversal);
    return reversal;
  },
  async listLedgerCategories(clubId) {
    return categoryStore
      .filter((c) => c.clubId === clubId && !c.deletedAt)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  },
  async createLedgerCategory(input) {
    const cat: LedgerCategory = {
      id: `cat-local-${++categorySeq}`,
      clubId: input.clubId,
      name: input.name,
      kind: input.kind,
      sortOrder: input.sortOrder ?? categoryStore.length + 1,
    };
    categoryStore.push(cat);
    return cat;
  },

  /* ---------- Rechnungen ---------- */
  async listInvoices(clubId, filter) {
    return invoiceStore.filter(
      (i) =>
        i.clubId === clubId &&
        (!filter?.status || i.status === filter.status) &&
        (!filter?.memberId || i.memberId === filter.memberId),
    );
  },
  async getInvoice(invoiceId) {
    const inv = invoiceStore.find((i) => i.id === invoiceId);
    if (!inv) throw new ApiError(404, null, "invoice_not_found");
    return inv;
  },
  async createInvoice(input) {
    const inv: InvoiceDetail = {
      id: `i-local-${++invoiceSeq}`,
      clubId: input.clubId,
      number: `R-2026-${String(9000 + invoiceSeq).padStart(4, "0")}`,
      memberId: input.memberId,
      title: input.title,
      amountCents: input.amountCents,
      currency: "EUR",
      issuedAt: today(),
      dueAt: input.dueOn ?? today(),
      status: input.issue ? "open" : "draft",
      dunningLevel: 0,
    };
    invoiceStore.push(inv);
    return inv;
  },
  async settleInvoice(invoiceId, input) {
    const inv = invoiceStore.find((i) => i.id === invoiceId);
    if (!inv) throw new ApiError(404, null, "invoice_not_found");
    if (input.status === "paid") {
      // paid nur aus 'open' — terminal, kein Re-Open (GoBD).
      if (inv.status !== "open") throw new ApiError(409, null, "invoice_not_open");
      inv.status = "paid";
      inv.paidAt = today();
      inv.paidVia = input.paidVia;
      if (input.postToLedger !== false) {
        const cat = input.ledgerCategoryId
          ? categoryStore.find((c) => c.id === input.ledgerCategoryId)
          : undefined;
        ledgerStore.push({
          id: `l-local-${++ledgerSeq}`,
          clubId: inv.clubId,
          date: today(),
          description: `Zahlung ${inv.number} — ${inv.title}`,
          counterparty: { kind: "person", memberId: inv.memberId },
          amountCents: inv.amountCents,
          category: cat?.name ?? "Beitrag",
          categoryId: input.ledgerCategoryId,
          categoryName: cat?.name,
          categoryKind: cat?.kind,
          invoiceId: inv.id,
        });
      }
    } else {
      // cancelled nur aus draft/open — terminal.
      if (inv.status !== "draft" && inv.status !== "open") {
        throw new ApiError(409, null, "invoice_not_cancellable");
      }
      inv.status = "cancelled";
    }
    return inv;
  },

  /* ---------- Mahnwesen ---------- */
  async applyDunning(clubId, input) {
    // Stufe ≥ 2 NIE automatisch — nur mit expliziter Freigabe (sonst 403).
    if (input.toStage >= 2 && !input.approveEscalation) {
      throw new ApiError(403, null, "escalation_requires_approval");
    }
    const level = Math.min(3, input.toStage) as DunningLevel;
    const action: DunningLogAction =
      input.toStage === 1 ? "reminder" : input.toStage >= 4 ? "handover" : "dunning";
    const skipped: { invoiceId: string; reason: string }[] = [];
    const log: DunningLogEntry[] = [];
    let applied = 0;
    for (const id of input.invoiceIds) {
      const inv = invoiceStore.find((i) => i.id === id && i.clubId === clubId);
      if (!inv) {
        skipped.push({ invoiceId: id, reason: "not_found" });
        continue;
      }
      if (inv.status !== "open") {
        skipped.push({ invoiceId: id, reason: "not_open" });
        continue;
      }
      // dunning_level nur nach oben (cap 3).
      if (inv.dunningLevel >= level) {
        skipped.push({ invoiceId: id, reason: "already_higher" });
        continue;
      }
      const entry: DunningLogEntry = {
        id: `dl-local-${++dunningSeq}`,
        clubId,
        invoiceId: id,
        fromStage: inv.dunningLevel,
        toStage: input.toStage,
        action,
        actorMemberId: currentMemberId,
        note: input.note,
        createdAt: new Date().toISOString(),
      };
      inv.dunningLevel = level;
      dunningLogStore.push(entry);
      log.push(entry);
      applied += 1;
    }
    return { clubId, toStage: input.toStage, action, applied, skipped, log };
  },
  async listDunningLog(clubId, filter) {
    return dunningLogStore
      .filter(
        (d) => d.clubId === clubId && (!filter?.invoiceId || d.invoiceId === filter.invoiceId),
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },
};
