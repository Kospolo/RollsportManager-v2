// ============================================================================
// modules/billing/store.ts - storage contract of the webhook/billing service
// plus its SQL implementation.
//
// createSqlBillingStore(tx) must ONLY be constructed inside withServiceRole()
// (db.ts): internal.webhook_events is invisible to client roles and
// app.entitlements is read-only for them - both by design (Blueprint ADR-E6).
// Keeping claim + entitlement write in ONE service transaction makes webhook
// processing atomic: a failed run rolls back the claim, so the provider's
// retry re-processes cleanly; a committed run dedupes every replay.
// ============================================================================

import type { Tx } from '../../db.js';
import type {
  EntitlementPatch,
  EntitlementRow,
  EntitlementStore,
  NewEntitlementRow,
} from './entitlements.js';

export type WebhookProvider = 'stripe' | 'revenuecat';

export interface WebhookEventClaim {
  provider: WebhookProvider;
  eventId: string;
  eventType: string | undefined;
  payload: unknown;
}

export interface WebhookEventFinish {
  provider: WebhookProvider;
  eventId: string;
  status: 'processed' | 'skipped' | 'failed';
  error?: string;
}

export interface BillingStore extends EntitlementStore {
  /**
   * Insert the event into internal.webhook_events. Returns false when the
   * (provider, event_id) pair already exists - i.e. this delivery is a
   * REPLAY and must not be processed again.
   */
  claimEvent(claim: WebhookEventClaim): Promise<boolean>;
  /** Record the processing outcome on the claimed event row. */
  finishEvent(finish: WebhookEventFinish): Promise<void>;
}

/** SQL-backed store - construct only inside withServiceRole(). */
export function createSqlBillingStore(tx: Tx): BillingStore {
  return {
    async claimEvent(claim) {
      const rows = await tx`
        insert into internal.webhook_events (provider, event_id, event_type, payload)
        values (${claim.provider}, ${claim.eventId}, ${claim.eventType ?? null},
                ${tx.json(claim.payload as never)})
        on conflict (provider, event_id) do nothing
        returning id`;
      return rows.length > 0;
    },

    async finishEvent(finish) {
      await tx`
        update internal.webhook_events
        set status = ${finish.status},
            error = ${finish.error ?? null},
            processed_at = now()
        where provider = ${finish.provider} and event_id = ${finish.eventId}`;
    },

    async findProductByCode(code) {
      const rows = await tx`select id from app.products where code = ${code}`;
      return rows[0] as { id: string } | undefined;
    },

    async getEntitlement(subjectType, subjectId, entitlement) {
      const rows = await tx`
        select id, subject_type, subject_id, entitlement, source, product_id,
               provider_ref, valid_until, metadata
        from app.entitlements
        where subject_type = ${subjectType}
          and subject_id = ${subjectId}
          and entitlement = ${entitlement}
        order by created_at desc
        limit 1`;
      return rows[0] as EntitlementRow | undefined;
    },

    async insertEntitlement(row: NewEntitlementRow) {
      await tx`
        insert into app.entitlements
          (subject_type, subject_id, entitlement, source, product_id,
           provider_ref, valid_until, metadata)
        values
          (${row.subject_type}, ${row.subject_id}, ${row.entitlement}, ${row.source},
           ${row.product_id}, ${row.provider_ref}, ${row.valid_until},
           ${tx.json(row.metadata as never)})`;
    },

    async updateEntitlement(id: string, patch: EntitlementPatch) {
      await tx`
        update app.entitlements
        set source = ${patch.source},
            provider_ref = ${patch.provider_ref},
            valid_until = ${patch.valid_until},
            metadata = ${tx.json(patch.metadata as never)}
            ${patch.product_id !== undefined ? tx`, product_id = ${patch.product_id}` : tx``}
        where id = ${id}`;
    },
  };
}
