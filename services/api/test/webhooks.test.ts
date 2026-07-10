// Webhook tests - signature verification (valid/invalid/stale), header auth,
// full HTTP pipeline incl. replay dedupe. No network, no database: the
// billing service runner is injected with an in-memory store.

import { createHmac } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import { Hono } from 'hono';
import { resetConfigForTests } from '../src/config.js';
import type { AuthEnv } from '../src/middleware/auth.js';
import { onError, requestId } from '../src/middleware/error.js';
import { createWebhooksRouter } from '../src/modules/billing/webhooks.js';
import type { BillingServiceRunner } from '../src/modules/billing/webhooks.js';
import {
  parseStripeSignatureHeader,
  timingSafeEqualString,
  verifyRevenueCatAuthorization,
  verifyStripeSignature,
} from '../src/modules/billing/verify.js';
import { mapRevenueCatEvent, mapStripeEvent, stripeEventSchema } from '../src/modules/billing/providers.js';
import { createMemoryBilling } from './helpers/memory-billing-store.js';
import type { MemoryBilling } from './helpers/memory-billing-store.js';

const STRIPE_SECRET = 'whsec_test_0123456789abcdef0123456789abcdef';
const RC_TOKEN = 'rc-test-token-0123456789';
const CLUB = 'c1ab0000-0000-4000-8000-000000000001';
const PROFILE = '22222222-2222-4222-8222-222222222222';

function signStripe(payload: string, secret = STRIPE_SECRET, timestamp = Math.floor(Date.now() / 1000)): string {
  const signature = createHmac('sha256', secret).update(`${timestamp}.${payload}`, 'utf8').digest('hex');
  return `t=${timestamp},v1=${signature}`;
}

function stripeSubscriptionEvent(overrides: {
  eventId?: string;
  type?: string;
  status?: string;
  clubId?: string;
  productCode?: string;
} = {}): string {
  return JSON.stringify({
    id: overrides.eventId ?? 'evt_001',
    type: overrides.type ?? 'customer.subscription.created',
    data: {
      object: {
        id: 'sub_123',
        object: 'subscription',
        status: overrides.status ?? 'active',
        current_period_end: 1767225600, // 2026-01-01T00:00:00Z
        metadata: {
          club_id: overrides.clubId ?? CLUB,
          product_code: overrides.productCode ?? 'club_tier_m',
        },
      },
    },
  });
}

// ---------------------------------------------------------------------------
// pure verification functions
// ---------------------------------------------------------------------------

describe('verifyStripeSignature', () => {
  const payload = '{"id":"evt_1","type":"ping"}';

  it('accepts a correctly signed, fresh payload', () => {
    expect(verifyStripeSignature({ payload, header: signStripe(payload), secret: STRIPE_SECRET })).toBe(true);
  });

  it('rejects a signature made with the wrong secret', () => {
    const header = signStripe(payload, 'whsec_wrong_secret_wrong_secret_wrong');
    expect(verifyStripeSignature({ payload, header, secret: STRIPE_SECRET })).toBe(false);
  });

  it('rejects when the payload was tampered with', () => {
    const header = signStripe(payload);
    expect(verifyStripeSignature({ payload: payload + ' ', header, secret: STRIPE_SECRET })).toBe(false);
  });

  it('rejects stale timestamps outside the tolerance window', () => {
    const now = Math.floor(Date.now() / 1000);
    const header = signStripe(payload, STRIPE_SECRET, now - 3600);
    expect(
      verifyStripeSignature({ payload, header, secret: STRIPE_SECRET, toleranceSeconds: 300, nowSeconds: now }),
    ).toBe(false);
    // ... but accepts the same header when the clock says it is fresh
    expect(
      verifyStripeSignature({ payload, header, secret: STRIPE_SECRET, toleranceSeconds: 300, nowSeconds: now - 3600 }),
    ).toBe(true);
  });

  it('rejects missing/malformed headers and empty secrets', () => {
    expect(verifyStripeSignature({ payload, header: undefined, secret: STRIPE_SECRET })).toBe(false);
    expect(verifyStripeSignature({ payload, header: '', secret: STRIPE_SECRET })).toBe(false);
    expect(verifyStripeSignature({ payload, header: 'nonsense', secret: STRIPE_SECRET })).toBe(false);
    expect(verifyStripeSignature({ payload, header: 't=123', secret: STRIPE_SECRET })).toBe(false);
    expect(verifyStripeSignature({ payload, header: signStripe(payload), secret: '' })).toBe(false);
  });

  it('accepts any one of several v1 signatures (key rotation)', () => {
    const t = Math.floor(Date.now() / 1000);
    const good = createHmac('sha256', STRIPE_SECRET).update(`${t}.${payload}`).digest('hex');
    const header = `t=${t},v1=${'0'.repeat(64)},v1=${good}`;
    expect(verifyStripeSignature({ payload, header, secret: STRIPE_SECRET })).toBe(true);
  });

  it('parses headers leniently but never invents signatures', () => {
    expect(parseStripeSignatureHeader('t=5, v1=abc, v0=zzz')).toEqual({ timestamp: 5, signatures: ['abc'] });
    expect(parseStripeSignatureHeader('v1=abc')).toBeUndefined();
    expect(parseStripeSignatureHeader('t=notanumber,v1=abc')).toBeUndefined();
  });
});

describe('verifyRevenueCatAuthorization / timingSafeEqualString', () => {
  it('accepts the exact token and the Bearer form', () => {
    expect(verifyRevenueCatAuthorization(RC_TOKEN, RC_TOKEN)).toBe(true);
    expect(verifyRevenueCatAuthorization(`Bearer ${RC_TOKEN}`, RC_TOKEN)).toBe(true);
  });

  it('rejects wrong/missing tokens and empty configuration', () => {
    expect(verifyRevenueCatAuthorization('wrong', RC_TOKEN)).toBe(false);
    expect(verifyRevenueCatAuthorization(undefined, RC_TOKEN)).toBe(false);
    expect(verifyRevenueCatAuthorization(RC_TOKEN, '')).toBe(false);
  });

  it('compares in constant time semantics (same result, no throw on length diff)', () => {
    expect(timingSafeEqualString('abc', 'abc')).toBe(true);
    expect(timingSafeEqualString('abc', 'abd')).toBe(false);
    expect(timingSafeEqualString('abc', 'abcd')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// event mapping (fixtures - no stripe/revenuecat SDK, no network)
// ---------------------------------------------------------------------------

describe('mapStripeEvent', () => {
  it('maps an active subscription to an active club entitlement', () => {
    const event = stripeEventSchema.parse(JSON.parse(stripeSubscriptionEvent()));
    const mapped = mapStripeEvent(event);
    expect(mapped).toMatchObject({
      kind: 'entitlement',
      change: {
        subject_type: 'club',
        subject_id: CLUB,
        entitlement: 'club_license',
        status: 'active',
        tier: 'pro', // club_tier_m
        source: 'stripe',
        product_code: 'club_tier_m',
        provider_ref: 'sub_123',
        valid_until: '2026-01-01T00:00:00.000Z',
      },
    });
  });

  it('maps trialing/past_due/deleted along the state machine vocabulary', () => {
    const trial = mapStripeEvent(stripeEventSchema.parse(JSON.parse(stripeSubscriptionEvent({ status: 'trialing' }))));
    expect(trial.kind === 'entitlement' && trial.change.status).toBe('trial');

    const pastDue = mapStripeEvent(
      stripeEventSchema.parse(JSON.parse(stripeSubscriptionEvent({ type: 'customer.subscription.updated', status: 'past_due' }))),
    );
    expect(pastDue.kind === 'entitlement' && pastDue.change.status).toBe('past_due');

    const deleted = mapStripeEvent(
      stripeEventSchema.parse(JSON.parse(stripeSubscriptionEvent({ type: 'customer.subscription.deleted', status: 'canceled' }))),
    );
    expect(deleted.kind === 'entitlement' && deleted.change.status).toBe('canceled');
  });

  it('skips non-subscription events and subscriptions without club metadata', () => {
    const ping = mapStripeEvent(stripeEventSchema.parse({ id: 'evt_x', type: 'invoice.created', data: { object: {} } }));
    expect(ping.kind).toBe('skip');

    const noClub = mapStripeEvent(
      stripeEventSchema.parse({
        id: 'evt_y',
        type: 'customer.subscription.created',
        data: { object: { id: 'sub_9', status: 'active', metadata: {} } },
      }),
    );
    expect(noClub).toMatchObject({ kind: 'skip', reason: expect.stringContaining('club_id') });
  });
});

describe('mapRevenueCatEvent', () => {
  it('maps INITIAL_PURCHASE to an active personal_pro entitlement', () => {
    const mapped = mapRevenueCatEvent({
      id: 'rc_evt_1',
      type: 'INITIAL_PURCHASE',
      app_user_id: PROFILE,
      period_type: 'NORMAL',
      expiration_at_ms: 1767225600000,
      original_transaction_id: 'txn_1',
    } as never);
    expect(mapped).toMatchObject({
      kind: 'entitlement',
      change: {
        subject_type: 'profile',
        subject_id: PROFILE,
        entitlement: 'personal_pro',
        status: 'active',
        tier: 'pro',
        source: 'revenuecat',
        provider_ref: 'txn_1',
        valid_until: '2026-01-01T00:00:00.000Z',
      },
    });
  });

  it('maps TRIAL purchases, billing issues and expirations', () => {
    const trial = mapRevenueCatEvent({ id: 'e1', type: 'INITIAL_PURCHASE', app_user_id: PROFILE, period_type: 'TRIAL' } as never);
    expect(trial.kind === 'entitlement' && trial.change.status).toBe('trial');

    const billing = mapRevenueCatEvent({ id: 'e2', type: 'BILLING_ISSUE', app_user_id: PROFILE } as never);
    expect(billing.kind === 'entitlement' && billing.change.status).toBe('past_due');

    const expired = mapRevenueCatEvent({ id: 'e3', type: 'EXPIRATION', app_user_id: PROFILE } as never);
    expect(expired.kind === 'entitlement' && expired.change.status).toBe('canceled');
  });

  it('skips CANCELLATION (access until expiration), TEST and anonymous users', () => {
    expect(mapRevenueCatEvent({ id: 'e4', type: 'CANCELLATION', app_user_id: PROFILE } as never).kind).toBe('skip');
    expect(mapRevenueCatEvent({ id: 'e5', type: 'TEST' } as never).kind).toBe('skip');
    expect(mapRevenueCatEvent({ id: 'e6', type: 'RENEWAL', app_user_id: '$RCAnonymousID:abc' } as never).kind).toBe('skip');
  });
});

// ---------------------------------------------------------------------------
// full HTTP pipeline against the in-memory store (incl. replay dedupe)
// ---------------------------------------------------------------------------

let app: Hono<AuthEnv>;
let billing: MemoryBilling;

beforeAll(() => {
  process.env['AUTH_MODE'] = 'dev';
  process.env['STRIPE_WEBHOOK_SECRET'] = STRIPE_SECRET;
  process.env['REVENUECAT_WEBHOOK_AUTH'] = RC_TOKEN;
  resetConfigForTests();

  billing = createMemoryBilling();
  const memoryRunner: BillingServiceRunner = (_reason, fn) => fn(billing.store);

  app = new Hono<AuthEnv>();
  app.use('*', requestId);
  app.onError(onError);
  app.route('/', createWebhooksRouter(memoryRunner));
});

describe('POST /webhooks/stripe (HTTP)', () => {
  it('rejects missing and invalid signatures with 400 before any processing', async () => {
    const payload = stripeSubscriptionEvent();
    const noSig = await app.request('/webhooks/stripe', { method: 'POST', body: payload });
    expect(noSig.status).toBe(400);

    const badSig = await app.request('/webhooks/stripe', {
      method: 'POST',
      body: payload,
      headers: { 'stripe-signature': signStripe(payload, 'whsec_attacker_secret_attacker_sec') },
    });
    expect(badSig.status).toBe(400);
    expect(billing.events.size).toBe(0); // nothing was claimed
  });

  it('processes a correctly signed subscription event into a club entitlement', async () => {
    const payload = stripeSubscriptionEvent({ eventId: 'evt_http_1' });
    const res = await app.request('/webhooks/stripe', {
      method: 'POST',
      body: payload,
      headers: { 'stripe-signature': signStripe(payload) },
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ received: true, outcome: 'processed' });

    expect(billing.events.get('stripe/evt_http_1')?.status).toBe('processed');
    const row = billing.entitlements.get(billing.entitlementKey('club', CLUB, 'club_license'));
    expect(row?.metadata['status']).toBe('active');
    expect(row?.metadata['tier']).toBe('pro');
  });

  it('answers a replay with 200 and does NOT process twice', async () => {
    const payload = stripeSubscriptionEvent({ eventId: 'evt_http_1' }); // same event id as above
    const auditBefore = (
      billing.entitlements.get(billing.entitlementKey('club', CLUB, 'club_license'))?.metadata['audit'] as unknown[]
    ).length;

    const res = await app.request('/webhooks/stripe', {
      method: 'POST',
      body: payload,
      headers: { 'stripe-signature': signStripe(payload) },
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ received: true, outcome: 'replay' });

    const auditAfter = (
      billing.entitlements.get(billing.entitlementKey('club', CLUB, 'club_license'))?.metadata['audit'] as unknown[]
    ).length;
    expect(auditAfter).toBe(auditBefore); // no second entitlement write
  });

  it('records unhandled event types as skipped (still deduped)', async () => {
    const payload = JSON.stringify({ id: 'evt_http_2', type: 'charge.succeeded', data: { object: {} } });
    const res = await app.request('/webhooks/stripe', {
      method: 'POST',
      body: payload,
      headers: { 'stripe-signature': signStripe(payload) },
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ received: true, outcome: 'skipped' });
    expect(billing.events.get('stripe/evt_http_2')?.status).toBe('skipped');
  });

  it('records domain rejections as failed and answers 200 (no retry storm)', async () => {
    // a brand-new club may not START in past_due - illegal initial state
    const otherClub = 'c1ab0000-0000-4000-8000-000000000099';
    const payload = stripeSubscriptionEvent({
      eventId: 'evt_http_3',
      type: 'customer.subscription.updated',
      status: 'past_due',
      clubId: otherClub,
    });
    const res = await app.request('/webhooks/stripe', {
      method: 'POST',
      body: payload,
      headers: { 'stripe-signature': signStripe(payload) },
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ received: true, outcome: 'failed' });
    expect(billing.events.get('stripe/evt_http_3')?.status).toBe('failed');
    expect(billing.entitlements.has(billing.entitlementKey('club', otherClub, 'club_license'))).toBe(false);
  });
});

describe('POST /webhooks/revenuecat (HTTP)', () => {
  const rcBody = (eventId: string, type = 'INITIAL_PURCHASE'): string =>
    JSON.stringify({
      api_version: '1.0',
      event: { id: eventId, type, app_user_id: PROFILE, expiration_at_ms: 1767225600000 },
    });

  it('rejects missing/wrong Authorization with 401 before any processing', async () => {
    const eventsBefore = billing.events.size;
    const noAuth = await app.request('/webhooks/revenuecat', { method: 'POST', body: rcBody('rc_1') });
    expect(noAuth.status).toBe(401);

    const wrongAuth = await app.request('/webhooks/revenuecat', {
      method: 'POST',
      body: rcBody('rc_1'),
      headers: { authorization: 'Bearer wrong-token' },
    });
    expect(wrongAuth.status).toBe(401);
    expect(billing.events.size).toBe(eventsBefore);
  });

  it('processes an authorized purchase into a personal_pro entitlement', async () => {
    const res = await app.request('/webhooks/revenuecat', {
      method: 'POST',
      body: rcBody('rc_2'),
      headers: { authorization: `Bearer ${RC_TOKEN}` },
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ received: true, outcome: 'processed' });

    const row = billing.entitlements.get(billing.entitlementKey('profile', PROFILE, 'personal_pro'));
    expect(row?.metadata['status']).toBe('active');
    expect(row?.metadata['tier']).toBe('pro');
  });

  it('dedupes replays by event id', async () => {
    const res = await app.request('/webhooks/revenuecat', {
      method: 'POST',
      body: rcBody('rc_2'),
      headers: { authorization: `Bearer ${RC_TOKEN}` },
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ received: true, outcome: 'replay' });
  });

  it('rejects bodies without event.id/type as 400', async () => {
    const res = await app.request('/webhooks/revenuecat', {
      method: 'POST',
      body: JSON.stringify({ hello: 'world' }),
      headers: { authorization: `Bearer ${RC_TOKEN}` },
    });
    expect(res.status).toBe(400);
  });
});
