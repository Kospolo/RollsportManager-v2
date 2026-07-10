// ============================================================================
// modules/dunning/engine.ts - dunning run calculation (pure, no I/O).
//
// Blueprint timeline for open invoices, days after due_on:
//   +7  -> stage 1: payment reminder      (may be applied automatically)
//   +21 -> stage 2: 1st dunning notice    (NEVER automatic - approval needed)
//   +35 -> stage 3: 2nd dunning notice    (NEVER automatic - approval needed)
//   +49 -> stage 4: escalation/hand-over  (NEVER automatic - approval needed)
//
// v1 lesson (research/09 §2.6): the escalation logic was triplicated in the
// clients with conflicting level ranges. In v2 it lives ONCE, server-side.
//
// The invoices.dunning_level column is constrained to 0..3 (0005_finance.sql),
// so stage 4 keeps proposed_level at 3 and flags `escalation` instead - the
// 5-stage enum normalization is an ETL/Phase-2 concern.
//
// Rule (task requirement): only stage 1 may be applied automatically;
// every stage >= 2 is returned as 'pending_approval' and never written by
// the run itself. Dates are compared as UTC calendar days.
// ============================================================================

/** Days overdue at which the next dunning stage becomes due. */
export const DUNNING_TIMELINE_DAYS: readonly number[] = [7, 21, 35, 49];

/** DB check constraint: invoices.dunning_level between 0 and 3. */
export const MAX_DB_DUNNING_LEVEL = 3;

export interface DunningInvoiceInput {
  id: string;
  number: string;
  member_id: string;
  status: string;
  /** 'YYYY-MM-DD' or null (invoices without a due date never enter dunning) */
  due_on: string | null;
  dunning_level: number;
  amount_cents: number;
}

export type DunningActionKind = 'auto' | 'pending_approval' | 'none';

export interface DunningAction {
  invoice_id: string;
  number: string;
  member_id: string;
  amount_cents: number;
  days_overdue: number;
  current_level: number;
  /** timeline stage due today: 1..4 (4 = escalation beyond the DB levels) */
  proposed_stage: number;
  /** what would be written to invoices.dunning_level (capped at 3) */
  proposed_level: number;
  /** stage 4 (+49 days): hand-over proposal - always needs approval */
  escalation: boolean;
  action: DunningActionKind;
}

/** Whole days between due date and `asOf`, on UTC calendar days. */
export function daysOverdue(dueOn: string, asOf: Date): number {
  const due = Date.parse(`${dueOn}T00:00:00Z`);
  if (Number.isNaN(due)) return 0;
  const today = Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth(), asOf.getUTCDate());
  return Math.floor((today - due) / 86_400_000);
}

/** Timeline stage (0..4) that is due after `days` days overdue. */
export function dueStage(days: number): number {
  let stage = 0;
  for (const threshold of DUNNING_TIMELINE_DAYS) {
    if (days >= threshold) stage += 1;
  }
  return stage;
}

/**
 * Compute the dunning actions for a set of invoices as of a given date.
 * Only OPEN invoices with a due date and at least one day overdue appear in
 * the result; invoices whose stage is already reached get action 'none'.
 */
export function computeDunningRun(
  invoices: readonly DunningInvoiceInput[],
  asOf: Date,
): DunningAction[] {
  const actions: DunningAction[] = [];

  for (const invoice of invoices) {
    if (invoice.status !== 'open' || invoice.due_on === null) continue;

    const days = daysOverdue(invoice.due_on, asOf);
    if (days < 1) continue; // not overdue (yet)

    const stage = dueStage(days);
    const proposedLevel = Math.min(stage, MAX_DB_DUNNING_LEVEL);
    const escalation = stage > MAX_DB_DUNNING_LEVEL;

    let action: DunningActionKind;
    if (stage <= invoice.dunning_level && !escalation) {
      action = 'none'; // already at (or past) the due stage
    } else if (stage === 1) {
      action = 'auto'; // reminder (stage 1) is the ONLY automatic step
    } else {
      action = 'pending_approval'; // stage >= 2 is never set automatically
    }

    actions.push({
      invoice_id: invoice.id,
      number: invoice.number,
      member_id: invoice.member_id,
      amount_cents: invoice.amount_cents,
      days_overdue: days,
      current_level: invoice.dunning_level,
      proposed_stage: stage,
      proposed_level: proposedLevel,
      escalation,
      action,
    });
  }

  return actions;
}
