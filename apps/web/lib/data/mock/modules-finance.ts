import { currentUser, invoices, ledger, onViewerChange } from "@/lib/mock";
import { ApiError } from "@/lib/api/generated";
import type {
  DunningLevel,
  DunningLogAction,
  DunningLogEntry,
  Id,
  InvoiceDetail,
  InvoiceItem,
  InvoiceSettings,
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
// let + Melderegister: /entwickler kann die eingeloggte Person wechseln.
let currentMemberId = currentUser.id;
onViewerChange(() => {
  currentMemberId = currentUser.id;
});

const categoryStore: LedgerCategory[] = ledgerCategorySeed.map((cat) => ({ ...cat }));

/** mock.ledger mit strukturierter Kategorie (Join) anreichern. */
const ledgerStore: LedgerEntry[] = ledger.map((e) => {
  const catId = legacyCategoryMap[e.category];
  const cat = catId ? categoryStore.find((c) => c.id === catId) : undefined;
  return { ...e, categoryId: cat?.id, categoryName: cat?.name, categoryKind: cat?.kind };
});

const invoiceStore: InvoiceDetail[] = invoices.map((i) => ({
  ...i,
  vatTotalCents: 0,
  totalCents: i.amountCents,
  paidCents: i.status === "paid" ? i.amountCents : 0,
  openCents: i.status === "paid" ? 0 : i.amountCents,
}));
const dunningLogStore: DunningLogEntry[] = dunningLogSeed.map((d) => ({ ...d }));
const invoiceItemStore: InvoiceItem[] = [];
const invoiceSettingsStore: InvoiceSettings[] = [];

let ledgerSeq = ledgerStore.length;
let categorySeq = categoryStore.length;
let invoiceSeq = invoiceStore.length;
let dunningSeq = dunningLogStore.length;
let invoiceItemSeq = 0;

/** Zeilensummen mit der DB-Rundungsregel (0072): auf der ZEILE gerundet. */
function lineCents(quantity: number, unitPriceCents: number, vatRate: number) {
  const net = Math.round(quantity * unitPriceCents);
  const vat = Math.round((net * vatRate) / 100);
  return { net, vat, gross: net + vat };
}

/** Rechnung aus ihren Positionen fortschreiben (spiegelt app.invoice_items_recalc). */
function recomputeInvoiceFromItems(invoiceId: Id): void {
  const inv = invoiceStore.find((i) => i.id === invoiceId);
  if (!inv) return;
  const items = invoiceItemStore.filter((it) => it.invoiceId === invoiceId);
  if (items.length === 0) return; // ohne Positionen bleibt der Handbetrag stehen
  const gross = items.reduce((s, it) => s + it.grossCents, 0);
  const vat = items.reduce((s, it) => s + it.vatCents, 0);
  inv.amountCents = gross;
  inv.vatTotalCents = vat;
  inv.totalCents = gross;
  inv.openCents = gross - (inv.paidCents ?? 0);
}

/** Default-Briefkopf (noch nichts gespeichert). */
function defaultInvoiceSettings(clubId: Id): InvoiceSettings {
  return {
    clubId,
    senderBlock: "",
    logoUrl: "",
    taxNumber: "",
    vatId: "",
    boardMembers: "",
    footerText: "",
    bankName: "",
    iban: "",
    bic: "",
    accountHolder: "",
    numberPrefix: "",
    defaultVatRate: 0,
    configured: false,
  };
}

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
    const items = input.items ?? [];
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
      // Mit Positionen ZWINGEND als Entwurf (Positionen nur am Entwurf).
      status: items.length > 0 ? "draft" : input.issue ? "open" : "draft",
      dunningLevel: 0,
      vatTotalCents: 0,
      totalCents: input.amountCents,
      paidCents: 0,
      openCents: input.amountCents,
    };
    invoiceStore.push(inv);
    if (items.length > 0) {
      items.forEach((it, idx) => {
        const line = lineCents(it.quantity, it.unitPriceCents, it.vatRate);
        invoiceItemStore.push({
          id: `ii-local-${++invoiceItemSeq}`,
          clubId: input.clubId,
          invoiceId: inv.id,
          sortOrder: idx,
          description: it.description,
          quantity: it.quantity,
          unitPriceCents: it.unitPriceCents,
          vatRate: it.vatRate,
          netCents: line.net,
          vatCents: line.vat,
          grossCents: line.gross,
        });
      });
      recomputeInvoiceFromItems(inv.id);
      if (input.issue) inv.status = "open";
    }
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
  async issueInvoice(invoiceId) {
    const inv = invoiceStore.find((i) => i.id === invoiceId);
    if (!inv) throw new ApiError(404, null, "invoice_not_found");
    // Ausstellen nur aus 'draft' (GoBD — kein Re-Open).
    if (inv.status !== "draft") throw new ApiError(409, null, "invoice_not_draft");
    inv.status = "open";
    inv.issuedAt = today();
    return inv;
  },

  /* ---------- Rechnungspositionen (0072; nur am Entwurf) ---------- */
  async listInvoiceItems(clubId, invoiceId) {
    return invoiceItemStore
      .filter((it) => it.clubId === clubId && it.invoiceId === invoiceId)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  },
  async createInvoiceItem(input) {
    const inv = invoiceStore.find((i) => i.id === input.invoiceId);
    if (!inv) throw new ApiError(404, null, "invoice_not_found");
    if (inv.status !== "draft") throw new ApiError(409, null, "invoice_not_draft");
    const line = lineCents(input.quantity, input.unitPriceCents, input.vatRate);
    const item: InvoiceItem = {
      id: `ii-local-${++invoiceItemSeq}`,
      clubId: input.clubId,
      invoiceId: input.invoiceId,
      sortOrder:
        input.sortOrder ??
        invoiceItemStore.filter((x) => x.invoiceId === input.invoiceId).length,
      description: input.description,
      quantity: input.quantity,
      unitPriceCents: input.unitPriceCents,
      vatRate: input.vatRate,
      netCents: line.net,
      vatCents: line.vat,
      grossCents: line.gross,
    };
    invoiceItemStore.push(item);
    recomputeInvoiceFromItems(input.invoiceId);
    return item;
  },
  async updateInvoiceItem(itemId, input) {
    const item = invoiceItemStore.find((x) => x.id === itemId);
    if (!item) throw new ApiError(404, null, "invoice_item_not_found");
    const inv = invoiceStore.find((i) => i.id === item.invoiceId);
    if (inv && inv.status !== "draft") throw new ApiError(409, null, "invoice_not_draft");
    if (input.description !== undefined) item.description = input.description;
    if (input.quantity !== undefined) item.quantity = input.quantity;
    if (input.unitPriceCents !== undefined) item.unitPriceCents = input.unitPriceCents;
    if (input.vatRate !== undefined) item.vatRate = input.vatRate;
    if (input.sortOrder !== undefined) item.sortOrder = input.sortOrder;
    const line = lineCents(item.quantity, item.unitPriceCents, item.vatRate);
    item.netCents = line.net;
    item.vatCents = line.vat;
    item.grossCents = line.gross;
    recomputeInvoiceFromItems(item.invoiceId);
    return item;
  },
  async deleteInvoiceItem(itemId) {
    const idx = invoiceItemStore.findIndex((x) => x.id === itemId);
    if (idx === -1) throw new ApiError(404, null, "invoice_item_not_found");
    const item = invoiceItemStore[idx];
    const inv = invoiceStore.find((i) => i.id === item.invoiceId);
    if (inv && inv.status !== "draft") throw new ApiError(409, null, "invoice_not_draft");
    invoiceItemStore.splice(idx, 1);
    recomputeInvoiceFromItems(item.invoiceId);
  },

  /* ---------- Rechnungs-Einstellungen / Briefkopf (0080) ---------- */
  async getInvoiceSettings(clubId) {
    const found = invoiceSettingsStore.find((s) => s.clubId === clubId);
    return found ? { ...found } : defaultInvoiceSettings(clubId);
  },
  async updateInvoiceSettings(input) {
    let s = invoiceSettingsStore.find((x) => x.clubId === input.clubId);
    if (!s) {
      s = defaultInvoiceSettings(input.clubId);
      invoiceSettingsStore.push(s);
    }
    if (input.senderBlock !== undefined) s.senderBlock = input.senderBlock;
    if (input.logoUrl !== undefined) s.logoUrl = input.logoUrl;
    if (input.taxNumber !== undefined) s.taxNumber = input.taxNumber;
    if (input.vatId !== undefined) s.vatId = input.vatId;
    if (input.boardMembers !== undefined) s.boardMembers = input.boardMembers;
    if (input.footerText !== undefined) s.footerText = input.footerText;
    if (input.bankName !== undefined) s.bankName = input.bankName;
    if (input.iban !== undefined) s.iban = input.iban;
    if (input.bic !== undefined) s.bic = input.bic;
    if (input.accountHolder !== undefined) s.accountHolder = input.accountHolder;
    if (input.numberPrefix !== undefined) s.numberPrefix = input.numberPrefix;
    if (input.defaultVatRate !== undefined) s.defaultVatRate = input.defaultVatRate;
    s.configured = true;
    return { ...s };
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
