// ============================================================================
// modules/billing/providers.ts - provider event -> entitlement change mapping
// (pure functions, fixture-testable) + the shared processing pipeline.
//
// Mapping contract (Blueprint ADR-E6):
//   Stripe Billing subscription  -> club entitlement 'club_license'
//     (Checkout sessions are created with metadata.club_id + product_code,
//      so the subscription object carries the tenant mapping)
//   RevenueCat mobile IAP        -> personal entitlement 'personal_pro' (stub)
//     (app_user_id is configured to be profiles.id = auth.users.id)
//
// Idempotency: processProviderEvent() claims (provider, event_id) in
// internal.webhook_events first - a replay returns without touching
// entitlements. Domain rejections (illegal transition, unknown product) are
// recorded as status='failed' and answered 200 so providers stop retrying
// what can never succeed; infrastructure errors bubble up as 500 and the
// rolled-back claim lets the provider retry cleanly.
// ============================================================================

import { z } from '@hono/zod-openapi';
import type { BillingStore, WebhookProvider } from './store.js';
import type { EntitlementChange, EntitlementStatus, EntitlementTier } from './entitlements.js';
import {
  BillingError,
  ENTITLEMENT_TIERS,
  applyEntitlementChange,
} from './entitlements.js';

export type MappedEvent =
  | { kind: 'entitlement'; change: EntitlementChange }
  | { kind: 'skip'; reason: string };

const uuidCheck = z.string().uuid();

function asRecord(v: unknown): Record<string, unknown> {
  return typeof v === 'object' && v !== null ? (v as Record<string, unknown>) : {};
}

function str(obj: Record<string, unknown>, key: string): string | undefined {
  const v = obj[key];
  return typeof v === 'string' && v !== '' ? v : undefined;
}

function num(obj: Record<string, unknown>, key: string): number | undefined {
  const v = obj[key];
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
}

function epochSecondsToIso(seconds: number | undefined): string | null {
  return seconds === undefined ? null : new Date(seconds * 1000).toISOString();
}

// ---------------------------------------------------------------------------
// Stripe (club licenses via Stripe Billing - web portal only, ADR-E6)
// ---------------------------------------------------------------------------

export const stripeEventSchema = z
  .object({
    id: z.string().min(1),
    type: z.string().min(1),
    data: z.object({ object: z.record(z.unknown()).optional() }).optional(),
  })
  .passthrough();

export type StripeEvent = z.infer<typeof stripeEventSchema>;

/** products.code -> tier (single source of truth is the products catalog). */
const PRODUCT_CODE_TIERS: Record<string, EntitlementTier> = {
  club_tier_s: 'basic',
  club_tier_m: 'pro',
  club_tier_l: 'premium',
  personal_pro: 'pro',
};

const STRIPE_STATUS_MAP: Record<string, EntitlementStatus | undefined> = {
  trialing: 'trial',
  active: 'active',
  past_due: 'past_due',
  canceled: 'canceled',
  unpaid: 'canceled',
  incomplete_expired: 'canceled',
  // 'incomplete' / 'paused': no entitlement change yet
};

/**
 * Map a Stripe event to an entitlement change. Only subscription lifecycle
 * events touch entitlements - Stripe reflects payment failures/recoveries in
 * subscription.status anyway, so customer.subscription.* is sufficient.
 */
export function mapStripeEvent(event: StripeEvent): MappedEvent {
  if (!event.type.startsWith('customer.subscription.')) {
    return { kind: 'skip', reason: `unhandled event type '${event.type}'` };
  }
  const sub = asRecord(event.data?.object);
  const metadata = asRecord(sub['metadata']);

  const clubId = str(metadata, 'club_id');
  if (clubId === undefined || !uuidCheck.safeParse(clubId).success) {
    return { kind: 'skip', reason: 'subscription has no valid metadata.club_id' };
  }

  let status: EntitlementStatus | undefined;
  if (event.type === 'customer.subscription.deleted') {
    status = 'canceled';
  } else {
    const stripeStatus = str(sub, 'status') ?? '';
    status = STRIPE_STATUS_MAP[stripeStatus];
    if (status === undefined) {
      return { kind: 'skip', reason: `no entitlement change for subscription status '${stripeStatus}'` };
    }
  }

  const productCode = str(metadata, 'product_code');
  const metadataTier = str(metadata, 'tier');
  const tier: EntitlementTier =
    metadataTier !== undefined && (ENTITLEMENT_TIERS as readonly string[]).includes(metadataTier)
      ? (metadataTier as EntitlementTier)
      : (productCode !== undefined ? PRODUCT_CODE_TIERS[productCode] : undefined) ?? 'basic';

  const validUntil =
    event.type === 'customer.subscription.deleted'
      ? epochSecondsToIso(num(sub, 'ended_at') ?? num(sub, 'canceled_at') ?? num(sub, 'current_period_end'))
      : epochSecondsToIso(num(sub, 'current_period_end'));

  return {
    kind: 'entitlement',
    change: {
      subject_type: 'club',
      subject_id: clubId,
      entitlement: 'club_license',
      status,
      tier,
      source: 'stripe',
      ...(productCode !== undefined ? { product_code: productCode } : {}),
      ...(str(sub, 'id') !== undefined ? { provider_ref: str(sub, 'id') as string } : {}),
      valid_until: validUntil,
      actor: `webhook:stripe:${event.id}`,
      reason: `stripe ${event.type} (${str(sub, 'status') ?? 'deleted'})`,
    },
  };
}

// ---------------------------------------------------------------------------
// RevenueCat (personal Pro IAP - stub mapping, ADR-E6/E7)
// ---------------------------------------------------------------------------

export const revenuecatBodySchema = z
  .object({
    event: z
      .object({
        id: z.union([z.string().min(1), z.number()]).transform(String),
        type: z.string().min(1),
      })
      .passthrough(),
  })
  .passthrough();

export type RevenueCatBody = z.infer<typeof revenuecatBodySchema>;

const REVENUECAT_ACTIVE_TYPES = new Set([
  'INITIAL_PURCHASE',
  'RENEWAL',
  'UNCANCELLATION',
  'PRODUCT_CHANGE',
  'TRANSFER',
]);

/**
 * Map a RevenueCat event to the personal-Pro entitlement (stub).
 * CANCELLATION only turns auto-renew off - access runs until EXPIRATION,
 * which is the event that actually cancels the entitlement.
 */
export function mapRevenueCatEvent(event: RevenueCatBody['event']): MappedEvent {
  const ev = asRecord(event);
  const type = event.type;

  if (type === 'TEST') return { kind: 'skip', reason: 'test event' };
  if (type === 'CANCELLATION') {
    return { kind: 'skip', reason: 'auto-renew disabled - access stays until EXPIRATION' };
  }

  let status: EntitlementStatus;
  if (REVENUECAT_ACTIVE_TYPES.has(type)) {
    status = str(ev, 'period_type') === 'TRIAL' ? 'trial' : 'active';
  } else if (type === 'BILLING_ISSUE') {
    status = 'past_due';
  } else if (type === 'EXPIRATION') {
    status = 'canceled';
  } else {
    return { kind: 'skip', reason: `unhandled event type '${type}'` };
  }

  const appUserId = str(ev, 'app_user_id');
  if (appUserId === undefined || !uuidCheck.safeParse(appUserId).success) {
    return { kind: 'skip', reason: 'app_user_id is not a profile uuid' };
  }

  const expirationMs = num(ev, 'expiration_at_ms');
  const providerRef = str(ev, 'original_transaction_id') ?? str(ev, 'transaction_id') ?? event.id;

  return {
    kind: 'entitlement',
    change: {
      subject_type: 'profile',
      subject_id: appUserId,
      entitlement: 'personal_pro',
      status,
      tier: 'pro',
      source: 'revenuecat',
      product_code: 'personal_pro',
      provider_ref: providerRef,
      valid_until: expirationMs !== undefined ? new Date(expirationMs).toISOString() : null,
      actor: `webhook:revenuecat:${event.id}`,
      reason: `revenuecat ${type}`,
    },
  };
}

// ---------------------------------------------------------------------------
// Shared pipeline: claim -> apply -> finish
// ---------------------------------------------------------------------------

export interface ProviderEventInput {
  provider: WebhookProvider;
  eventId: string;
  eventType: string | undefined;
  payload: unknown;
  mapped: MappedEvent;
}

export interface ProviderEventResult {
  outcome: 'processed' | 'replay' | 'skipped' | 'failed';
  detail?: string;
}

export async function processProviderEvent(
  store: BillingStore,
  input: ProviderEventInput,
): Promise<ProviderEventResult> {
  const claimed = await store.claimEvent({
    provider: input.provider,
    eventId: input.eventId,
    eventType: input.eventType,
    payload: input.payload,
  });
  if (!claimed) {
    // replay: already claimed by an earlier delivery - never process twice
    console.info(`[billing] webhook replay ignored: ${input.provider}/${input.eventId}`);
    return { outcome: 'replay' };
  }

  if (input.mapped.kind === 'skip') {
    await store.finishEvent({
      provider: input.provider,
      eventId: input.eventId,
      status: 'skipped',
      error: input.mapped.reason,
    });
    return { outcome: 'skipped', detail: input.mapped.reason };
  }

  try {
    await applyEntitlementChange(store, input.mapped.change);
  } catch (err) {
    if (err instanceof BillingError) {
      // domain rejection (illegal transition / unknown product): record it
      // and answer 200 - retrying an out-of-order or misconfigured event
      // can never succeed, so do not make the provider hammer us.
      await store.finishEvent({
        provider: input.provider,
        eventId: input.eventId,
        status: 'failed',
        error: err.message,
      });
      console.warn(`[billing] webhook ${input.provider}/${input.eventId} failed: ${err.message}`);
      return { outcome: 'failed', detail: err.message };
    }
    throw err; // infrastructure error -> 500, tx rollback un-claims, provider retries
  }

  await store.finishEvent({ provider: input.provider, eventId: input.eventId, status: 'processed' });
  return { outcome: 'processed' };
}
