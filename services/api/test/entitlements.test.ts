// Entitlement state machine + single-writer tests - pure, no database.

import { describe, expect, it } from 'vitest';
import {
  AUDIT_MAX_ENTRIES,
  BillingError,
  ENTITLEMENT_STATUSES,
  EntitlementTransitionError,
  INITIAL_STATUSES,
  applyEntitlementChange,
  canTransition,
  readEntitlementStatus,
} from '../src/modules/billing/entitlements.js';
import type { EntitlementChange, EntitlementStatus } from '../src/modules/billing/entitlements.js';
import { createMemoryBilling } from './helpers/memory-billing-store.js';

const CLUB = 'c1ab0000-0000-4000-8000-000000000001';

function change(overrides: Partial<EntitlementChange> = {}): EntitlementChange {
  return {
    subject_type: 'club',
    subject_id: CLUB,
    entitlement: 'club_license',
    status: 'active',
    tier: 'basic',
    source: 'stripe',
    product_code: 'club_tier_s',
    provider_ref: 'sub_123',
    valid_until: '2026-08-01T00:00:00.000Z',
    actor: 'test',
    reason: 'unit test',
    ...overrides,
  };
}

describe('canTransition (state machine)', () => {
  const allowed: Array<[EntitlementStatus, EntitlementStatus]> = [
    ['trial', 'active'],
    ['trial', 'canceled'],
    ['active', 'past_due'],
    ['active', 'canceled'],
    ['past_due', 'active'], // payment recovered
    ['past_due', 'canceled'],
    ['canceled', 'active'], // resubscribe
  ];
  const forbidden: Array<[EntitlementStatus, EntitlementStatus]> = [
    ['trial', 'past_due'], // nothing was ever billed
    ['active', 'trial'], // no way back into trial
    ['past_due', 'trial'],
    ['canceled', 'trial'],
    ['canceled', 'past_due'],
  ];

  it.each(allowed)('%s -> %s is allowed', (from, to) => {
    expect(canTransition(from, to)).toBe(true);
  });

  it.each(forbidden)('%s -> %s is forbidden', (from, to) => {
    expect(canTransition(from, to)).toBe(false);
  });

  it('same-status refresh is always allowed (idempotent renewals)', () => {
    for (const status of ENTITLEMENT_STATUSES) {
      expect(canTransition(status, status)).toBe(true);
    }
  });

  it('new entitlements may only start in trial or active', () => {
    expect(INITIAL_STATUSES).toEqual(['trial', 'active']);
  });
});

describe('applyEntitlementChange (the single writer)', () => {
  it('creates a new entitlement starting in trial', async () => {
    const { store, entitlements, entitlementKey } = createMemoryBilling();
    const result = await applyEntitlementChange(store, change({ status: 'trial' }));

    expect(result).toEqual({ created: true, from_status: undefined, status: 'trial', tier: 'basic' });
    const row = entitlements.get(entitlementKey('club', CLUB, 'club_license'));
    expect(row).toBeDefined();
    expect(row?.metadata['status']).toBe('trial');
    expect(row?.metadata['tier']).toBe('basic');
    expect(row?.product_id).toBe('aaaaaaaa-0000-4000-8000-000000000001');
    expect((row?.metadata['audit'] as unknown[]).length).toBe(1);
  });

  it('rejects a new entitlement starting in past_due or canceled', async () => {
    const { store } = createMemoryBilling();
    await expect(applyEntitlementChange(store, change({ status: 'past_due' }))).rejects.toThrow(
      BillingError,
    );
    await expect(applyEntitlementChange(store, change({ status: 'canceled' }))).rejects.toThrow(
      /cannot start in status 'canceled'/,
    );
  });

  it('walks trial -> active -> past_due -> active and keeps the audit trail', async () => {
    const { store, entitlements, entitlementKey } = createMemoryBilling();
    await applyEntitlementChange(store, change({ status: 'trial' }));
    await applyEntitlementChange(store, change({ status: 'active' }));
    await applyEntitlementChange(store, change({ status: 'past_due' }));
    const result = await applyEntitlementChange(store, change({ status: 'active', tier: 'pro', product_code: 'club_tier_m' }));

    expect(result.created).toBe(false);
    expect(result.from_status).toBe('past_due');
    const row = entitlements.get(entitlementKey('club', CLUB, 'club_license'))!;
    expect(row.metadata['status']).toBe('active');
    expect(row.metadata['tier']).toBe('pro'); // tier upgrade recorded
    expect(row.product_id).toBe('aaaaaaaa-0000-4000-8000-000000000002');
    const audit = row.metadata['audit'] as Array<Record<string, unknown>>;
    expect(audit.length).toBe(4);
    expect(audit[audit.length - 1]).toMatchObject({ from_status: 'past_due', to_status: 'active', tier: 'pro' });
  });

  it('throws EntitlementTransitionError on an illegal transition', async () => {
    const { store } = createMemoryBilling();
    await applyEntitlementChange(store, change({ status: 'active' }));
    await applyEntitlementChange(store, change({ status: 'canceled' }));
    await expect(
      applyEntitlementChange(store, change({ status: 'past_due' })),
    ).rejects.toThrow(EntitlementTransitionError);
  });

  it('rejects unknown product codes', async () => {
    const { store } = createMemoryBilling();
    await expect(
      applyEntitlementChange(store, change({ product_code: 'no_such_product' })),
    ).rejects.toThrow(/unknown product code/);
  });

  it('treats legacy rows without metadata.status as active (seed grandfather)', async () => {
    const { store, entitlements, entitlementKey } = createMemoryBilling();
    // simulate the seeded manual entitlement: no machine status in metadata
    entitlements.set(entitlementKey('club', CLUB, 'club_license'), {
      id: '00000000-0000-4000-8000-00000000abcd',
      subject_type: 'club',
      subject_id: CLUB,
      entitlement: 'club_license',
      source: 'manual',
      product_id: null,
      provider_ref: 'beta-grandfather',
      valid_until: null,
      metadata: {},
    });
    expect(readEntitlementStatus({})).toBe('active');

    // active -> past_due is legal, so the write must succeed (not 'new row')
    const result = await applyEntitlementChange(store, change({ status: 'past_due' }));
    expect(result.created).toBe(false);
    expect(result.from_status).toBe('active');
  });

  it('caps the audit trail length', async () => {
    const { store, entitlements, entitlementKey } = createMemoryBilling();
    await applyEntitlementChange(store, change({ status: 'active' }));
    for (let i = 0; i < AUDIT_MAX_ENTRIES + 10; i += 1) {
      await applyEntitlementChange(store, change({ status: 'active', reason: `refresh ${i}` }));
    }
    const row = entitlements.get(entitlementKey('club', CLUB, 'club_license'))!;
    expect((row.metadata['audit'] as unknown[]).length).toBe(AUDIT_MAX_ENTRIES);
  });

  it('keeps the existing valid_until when the change does not carry one', async () => {
    const { store, entitlements, entitlementKey } = createMemoryBilling();
    await applyEntitlementChange(store, change({ status: 'active', valid_until: '2026-09-01T00:00:00.000Z' }));
    const withoutValidUntil = change({ status: 'past_due' });
    delete (withoutValidUntil as Partial<EntitlementChange>).valid_until;
    await applyEntitlementChange(store, withoutValidUntil);
    const row = entitlements.get(entitlementKey('club', CLUB, 'club_license'))!;
    expect(row.valid_until).toBe('2026-09-01T00:00:00.000Z');
  });
});
