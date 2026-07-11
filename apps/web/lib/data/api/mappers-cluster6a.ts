import type * as M from "@/lib/api/generated";
import type {
  Budget,
  BudgetReport,
  BudgetReportRow,
  WaitlistEntry,
} from "@/lib/types";

/**
 * Mapper der Cluster-6a-Module (Wartelisten, Budgetplanung) — Wire-Format
 * (snake_case) → View-Typen (camelCase). Die nullable-Beträge des Contracts
 * (z.coerce/nullable) werden defensiv auf 0 gemappt (DB-Spalten sind NOT NULL
 * bzw. der Bericht liefert 0 statt null für leere Kategorien).
 */

export function mapWaitlistEntry(w: M.Waitlist): WaitlistEntry {
  return {
    id: w.id,
    clubId: w.club_id,
    memberId: w.member_id,
    kind: w.kind,
    targetId: w.target_id ?? undefined,
    note: w.note ?? undefined,
    status: w.status,
    createdAt: w.created_at,
    updatedAt: w.updated_at,
  };
}

export function mapBudget(w: M.Budget): Budget {
  return {
    id: w.id,
    clubId: w.club_id,
    year: w.year ?? 0,
    categoryId: w.category_id,
    plannedCents: w.planned_cents ?? 0,
    note: w.note ?? undefined,
    createdAt: w.created_at,
    updatedAt: w.updated_at,
  };
}

function mapBudgetReportRow(w: M.BudgetReportRow): BudgetReportRow {
  const planned = w.planned_cents ?? 0;
  const actual = w.actual_cents ?? 0;
  return {
    categoryId: w.category_id,
    categoryName: w.category_name ?? "",
    kind: w.kind,
    plannedCents: planned,
    actualCents: actual,
    // Server liefert variance mit; fehlt sie (null), aus planned/actual ableiten.
    varianceCents: w.variance_cents ?? planned - actual,
  };
}

export function mapBudgetReport(w: M.BudgetReport): BudgetReport {
  const rows = w.rows.map(mapBudgetReportRow);
  return {
    clubId: w.club_id,
    year: w.year ?? 0,
    rows,
    plannedTotalCents: w.planned_total_cents ?? 0,
    actualTotalCents: w.actual_total_cents ?? 0,
    varianceTotalCents: w.variance_total_cents ?? 0,
  };
}
