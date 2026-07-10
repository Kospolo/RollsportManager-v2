// Dunning engine tests - pure calculation with time-travel fixtures.
// Timeline: +7 reminder / +21 1st notice / +35 2nd notice / +49 escalation.

import { describe, expect, it } from 'vitest';
import {
  DUNNING_TIMELINE_DAYS,
  MAX_DB_DUNNING_LEVEL,
  computeDunningRun,
  daysOverdue,
  dueStage,
} from '../src/modules/dunning/engine.js';
import type { DunningInvoiceInput } from '../src/modules/dunning/engine.js';

const DUE = '2026-06-01';

function invoice(overrides: Partial<DunningInvoiceInput> = {}): DunningInvoiceInput {
  return {
    id: '10000000-0000-4000-8000-000000000001',
    number: 'R-2026-0001',
    member_id: '20000000-0000-4000-8000-000000000001',
    status: 'open',
    due_on: DUE,
    dunning_level: 0,
    amount_cents: 12_000,
    ...overrides,
  };
}

/** time travel helper: due 2026-06-01 + n days */
function asOf(daysAfterDue: number): Date {
  return new Date(Date.parse(`${DUE}T00:00:00Z`) + daysAfterDue * 86_400_000);
}

describe('daysOverdue / dueStage', () => {
  it('counts whole UTC days', () => {
    expect(daysOverdue(DUE, asOf(0))).toBe(0);
    expect(daysOverdue(DUE, asOf(1))).toBe(1);
    expect(daysOverdue(DUE, asOf(49))).toBe(49);
    expect(daysOverdue(DUE, new Date('2026-06-08T23:59:59Z'))).toBe(7); // time of day is irrelevant
  });

  it('maps days to timeline stages (thresholds are inclusive)', () => {
    expect(DUNNING_TIMELINE_DAYS).toEqual([7, 21, 35, 49]);
    expect(dueStage(6)).toBe(0);
    expect(dueStage(7)).toBe(1);
    expect(dueStage(20)).toBe(1);
    expect(dueStage(21)).toBe(2);
    expect(dueStage(35)).toBe(3);
    expect(dueStage(48)).toBe(3);
    expect(dueStage(49)).toBe(4);
    expect(dueStage(500)).toBe(4);
  });
});

describe('computeDunningRun (time-travel fixtures)', () => {
  it('ignores invoices that are not overdue yet', () => {
    expect(computeDunningRun([invoice()], asOf(0))).toEqual([]);
    expect(computeDunningRun([invoice()], asOf(-10))).toEqual([]);
  });

  it('proposes nothing actionable before day 7 but lists the overdue invoice', () => {
    const actions = computeDunningRun([invoice()], asOf(3));
    expect(actions).toHaveLength(1);
    expect(actions[0]).toMatchObject({ days_overdue: 3, proposed_stage: 0, proposed_level: 0, action: 'none' });
  });

  it('day +7: stage 1 (reminder) is auto-applicable', () => {
    const actions = computeDunningRun([invoice()], asOf(7));
    expect(actions[0]).toMatchObject({
      days_overdue: 7,
      current_level: 0,
      proposed_stage: 1,
      proposed_level: 1,
      escalation: false,
      action: 'auto',
    });
  });

  it('day +21: stage 2 is NEVER automatic - pending approval', () => {
    const actions = computeDunningRun([invoice({ dunning_level: 1 })], asOf(21));
    expect(actions[0]).toMatchObject({ proposed_stage: 2, proposed_level: 2, action: 'pending_approval' });
  });

  it('day +35: stage 3 pending approval', () => {
    const actions = computeDunningRun([invoice({ dunning_level: 2 })], asOf(35));
    expect(actions[0]).toMatchObject({ proposed_stage: 3, proposed_level: 3, action: 'pending_approval' });
  });

  it('day +49: stage 4 = escalation, level stays capped at the DB maximum', () => {
    const actions = computeDunningRun([invoice({ dunning_level: 3 })], asOf(49));
    expect(actions[0]).toMatchObject({
      proposed_stage: 4,
      proposed_level: MAX_DB_DUNNING_LEVEL,
      escalation: true,
      action: 'pending_approval', // hand-over is never automatic
    });
  });

  it('a big overdue jump (level 0, day +40) needs approval - no silent catch-up', () => {
    const actions = computeDunningRun([invoice({ dunning_level: 0 })], asOf(40));
    expect(actions[0]).toMatchObject({ current_level: 0, proposed_stage: 3, proposed_level: 3, action: 'pending_approval' });
  });

  it('does not re-propose a stage that is already set', () => {
    const actions = computeDunningRun([invoice({ dunning_level: 1 })], asOf(10));
    expect(actions[0]).toMatchObject({ proposed_stage: 1, action: 'none' });
  });

  it('skips paid/draft/cancelled invoices and invoices without due date', () => {
    const fixtures = [
      invoice({ id: '10000000-0000-4000-8000-000000000002', status: 'paid' }),
      invoice({ id: '10000000-0000-4000-8000-000000000003', status: 'draft' }),
      invoice({ id: '10000000-0000-4000-8000-000000000004', status: 'cancelled' }),
      invoice({ id: '10000000-0000-4000-8000-000000000005', due_on: null }),
    ];
    expect(computeDunningRun(fixtures, asOf(30))).toEqual([]);
  });

  it('handles a mixed batch in one run', () => {
    const fixtures = [
      invoice({ id: '10000000-0000-4000-8000-000000000011', number: 'R-2026-0011', dunning_level: 0 }), // +8 -> auto
      invoice({ id: '10000000-0000-4000-8000-000000000012', number: 'R-2026-0012', dunning_level: 1, due_on: '2026-05-15' }), // +25 -> stage 2 pending
      invoice({ id: '10000000-0000-4000-8000-000000000013', number: 'R-2026-0013', dunning_level: 1 }), // +8 -> none
      invoice({ id: '10000000-0000-4000-8000-000000000014', number: 'R-2026-0014', status: 'paid' }), // ignored
    ];
    const actions = computeDunningRun(fixtures, asOf(8)); // 2026-06-09
    expect(actions.map((a) => [a.number, a.action])).toEqual([
      ['R-2026-0011', 'auto'],
      ['R-2026-0012', 'pending_approval'],
      ['R-2026-0013', 'none'],
    ]);
  });
});
