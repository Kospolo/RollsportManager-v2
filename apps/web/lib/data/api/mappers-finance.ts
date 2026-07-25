import type * as M from "@/lib/api/generated";
import type {
  DunningApplyOutcome,
  DunningLevel,
  DunningLogEntry,
  InvoiceDetail,
  InvoiceItem,
  InvoiceSettings,
  LedgerCategory,
} from "@/lib/types";

/**
 * Mapper der Finanz-A-Module (Kassenbuch-Kategorien, Rechnungs-Detail, Mahnwesen):
 * API-Wire-Format (snake_case, `T | null`) → View-Typen (lib/types, camelCase,
 * optionale Felder). Ausgelagert aus api/mappers.ts (< 400 Zeilen). Der
 * Kassenbuch-Eintrag selbst wird vom bestehenden mapLedgerEntry gemappt (jetzt
 * inkl. Kategorie-Join + reversesEntryId).
 */

/**
 * Rechnungs-Detailsicht — im Gegensatz zu mapInvoice (aggregierte Liste) werden
 * Entwürfe NICHT ausgefiltert, und der Zahlweg (paid_via) wird mitgeführt.
 */
export function mapInvoiceDetail(w: M.Invoice): InvoiceDetail {
  const amountCents = w.amount_cents ?? 0;
  return {
    id: w.id,
    clubId: w.club_id,
    number: w.number,
    memberId: w.member_id,
    title: w.title,
    amountCents,
    currency: "EUR",
    issuedAt: w.issued_on ?? w.created_at.slice(0, 10),
    dueAt: w.due_on ?? w.issued_on ?? w.created_at.slice(0, 10),
    status: w.status,
    dunningLevel: Math.min(3, Math.max(0, w.dunning_level)) as DunningLevel,
    paidAt: w.paid_at ?? undefined,
    paidVia: w.paid_via ?? undefined,
    vatTotalCents: w.vat_total_cents ?? 0,
    totalCents: w.total_cents ?? amountCents,
    paidCents: w.paid_cents ?? 0,
    openCents: w.open_cents ?? amountCents,
  };
}

export function mapInvoiceItem(w: M.InvoiceItem): InvoiceItem {
  return {
    id: w.id,
    clubId: w.club_id,
    invoiceId: w.invoice_id,
    sortOrder: w.sort_order ?? 0,
    description: w.description,
    quantity: w.quantity ?? 0,
    unitPriceCents: w.unit_price_cents ?? 0,
    vatRate: w.vat_rate ?? 0,
    netCents: w.net_cents ?? 0,
    vatCents: w.vat_cents ?? 0,
    grossCents: w.gross_cents ?? 0,
  };
}

export function mapInvoiceSettings(w: M.InvoiceSettings): InvoiceSettings {
  return {
    clubId: w.club_id,
    senderBlock: w.sender_block,
    logoUrl: w.logo_url,
    taxNumber: w.tax_number,
    vatId: w.vat_id,
    boardMembers: w.board_members,
    footerText: w.footer_text,
    bankName: w.bank_name,
    iban: w.iban,
    bic: w.bic,
    accountHolder: w.account_holder,
    numberPrefix: w.number_prefix,
    defaultVatRate: w.default_vat_rate ?? 0,
    configured: true,
  };
}

/** Default-Briefkopf (noch nichts gespeichert) — alle Felder leer. */
export function emptyInvoiceSettings(clubId: string): InvoiceSettings {
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

export function mapLedgerCategory(w: M.LedgerCategory): LedgerCategory {
  return {
    id: w.id,
    clubId: w.club_id,
    name: w.name,
    kind: w.kind,
    sortOrder: w.sort_order ?? 0,
    deletedAt: w.deleted_at ?? undefined,
  };
}

export function mapDunningLogEntry(w: M.DunningLogEntry): DunningLogEntry {
  return {
    id: w.id,
    clubId: w.club_id,
    invoiceId: w.invoice_id,
    fromStage: w.from_stage ?? undefined,
    toStage: w.to_stage ?? undefined,
    action: w.action,
    actorMemberId: w.actor_member_id ?? undefined,
    note: w.note ?? undefined,
    createdAt: w.created_at,
  };
}

export function mapDunningApplyResult(w: M.DunningApplyResult): DunningApplyOutcome {
  return {
    clubId: w.club_id,
    toStage: w.to_stage,
    action: w.action,
    applied: w.applied,
    skipped: w.skipped.map((s) => ({ invoiceId: s.invoice_id, reason: s.reason })),
    log: w.log.map(mapDunningLogEntry),
  };
}
