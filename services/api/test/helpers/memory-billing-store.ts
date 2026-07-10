// In-memory BillingStore - lets the entitlement state machine and the full
// webhook pipeline (claim -> apply -> finish, replay dedupe) run in unit
// tests without a database. Mirrors the SQL store semantics in store.ts.

import { randomUUID } from 'node:crypto';
import type {
  BillingStore,
  WebhookEventClaim,
  WebhookEventFinish,
} from '../../src/modules/billing/store.js';
import type { EntitlementRow } from '../../src/modules/billing/entitlements.js';

export interface MemoryEvent {
  provider: string;
  eventId: string;
  eventType: string | undefined;
  payload: unknown;
  status: 'received' | 'processed' | 'skipped' | 'failed';
  error?: string;
}

export interface MemoryBilling {
  store: BillingStore;
  events: Map<string, MemoryEvent>;
  entitlements: Map<string, EntitlementRow>;
  entitlementKey(subjectType: string, subjectId: string, entitlement: string): string;
}

const DEFAULT_PRODUCTS: Record<string, string> = {
  club_tier_s: 'aaaaaaaa-0000-4000-8000-000000000001',
  club_tier_m: 'aaaaaaaa-0000-4000-8000-000000000002',
  club_tier_l: 'aaaaaaaa-0000-4000-8000-000000000003',
  personal_pro: 'aaaaaaaa-0000-4000-8000-000000000004',
};

export function createMemoryBilling(products: Record<string, string> = DEFAULT_PRODUCTS): MemoryBilling {
  const events = new Map<string, MemoryEvent>();
  const entitlements = new Map<string, EntitlementRow>();
  const entitlementKey = (subjectType: string, subjectId: string, entitlement: string): string =>
    `${subjectType}/${subjectId}/${entitlement}`;

  const store: BillingStore = {
    async claimEvent(claim: WebhookEventClaim): Promise<boolean> {
      const key = `${claim.provider}/${claim.eventId}`;
      if (events.has(key)) return false;
      events.set(key, {
        provider: claim.provider,
        eventId: claim.eventId,
        eventType: claim.eventType,
        payload: claim.payload,
        status: 'received',
      });
      return true;
    },

    async finishEvent(finish: WebhookEventFinish): Promise<void> {
      const key = `${finish.provider}/${finish.eventId}`;
      const event = events.get(key);
      if (!event) throw new Error(`finishEvent for unclaimed event ${key}`);
      event.status = finish.status;
      if (finish.error !== undefined) event.error = finish.error;
    },

    async findProductByCode(code) {
      const id = products[code];
      return id === undefined ? undefined : { id };
    },

    async getEntitlement(subjectType, subjectId, entitlement) {
      return entitlements.get(entitlementKey(subjectType, subjectId, entitlement));
    },

    async insertEntitlement(row) {
      const key = entitlementKey(row.subject_type, row.subject_id, row.entitlement);
      entitlements.set(key, { id: randomUUID(), ...row });
    },

    async updateEntitlement(id, patch) {
      const row = [...entitlements.values()].find((r) => r.id === id);
      if (!row) throw new Error(`updateEntitlement for unknown id ${id}`);
      row.source = patch.source;
      row.provider_ref = patch.provider_ref;
      row.valid_until = patch.valid_until;
      row.metadata = patch.metadata;
      if (patch.product_id !== undefined) row.product_id = patch.product_id;
    },
  };

  return { store, events, entitlements, entitlementKey };
}
