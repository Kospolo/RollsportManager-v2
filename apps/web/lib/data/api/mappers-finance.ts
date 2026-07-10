import type * as M from "@/lib/api/generated";
import type {
  DunningApplyOutcome,
  DunningLevel,
  DunningLogEntry,
  InvoiceDetail,
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
  return {
    id: w.id,
    clubId: w.club_id,
    number: w.number,
    memberId: w.member_id,
    title: w.title,
    amountCents: w.amount_cents ?? 0,
    currency: "EUR",
    issuedAt: w.issued_on ?? w.created_at.slice(0, 10),
    dueAt: w.due_on ?? w.issued_on ?? w.created_at.slice(0, 10),
    status: w.status,
    dunningLevel: Math.min(3, Math.max(0, w.dunning_level)) as DunningLevel,
    paidAt: w.paid_at ?? undefined,
    paidVia: w.paid_via ?? undefined,
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
