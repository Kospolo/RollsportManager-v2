// ============================================================================
// modules/billing/webhooks.ts - THE one webhook service (Blueprint ADR-E6:
// all provider events run through ONE service in the API layer).
//
//   POST /webhooks/stripe      - signature verification (HMAC, verify.ts) is
//                                MANDATORY; anything unsigned/missigned/stale
//                                is 400 before any processing.
//   POST /webhooks/revenuecat  - static Authorization header (constant-time
//                                compare); mismatch is 401 before processing.
//
// These routes are server-to-server: no bearer JWT (they are PUBLIC_PATHS in
// app.ts), no CORS, and deliberately NOT part of the OpenAPI client contract
// (plain Hono router - codegen never sees them).
//
// Both handlers share the pipeline in providers.ts: idempotency via
// internal.webhook_events unique(provider, event_id) - replays return 200
// without double-processing. Entitlement writes happen exclusively through
// applyEntitlementChange() inside ONE withServiceRole() transaction.
//
// The service runner is injectable so unit tests can exercise the full HTTP
// path (valid signature -> processed -> replay) against an in-memory store.
// ============================================================================

import { Hono } from 'hono';
import type { AuthEnv } from '../../middleware/auth.js';
import { problem } from '../../middleware/error.js';
import { getConfig } from '../../config.js';
import { withServiceRole } from '../../db.js';
import type { BillingStore } from './store.js';
import { createSqlBillingStore } from './store.js';
import {
  mapRevenueCatEvent,
  mapStripeEvent,
  processProviderEvent,
  revenuecatBodySchema,
  stripeEventSchema,
} from './providers.js';
import { verifyRevenueCatAuthorization, verifyStripeSignature } from './verify.js';

/** Runs a billing operation in service mode against a BillingStore. */
export type BillingServiceRunner = <T>(
  reason: string,
  fn: (store: BillingStore) => Promise<T>,
) => Promise<T>;

const sqlRunner: BillingServiceRunner = (reason, fn) =>
  withServiceRole(reason, (tx) => fn(createSqlBillingStore(tx)));

/** True for values that must never be accepted in prod mode. */
function isPlaceholderSecret(value: string): boolean {
  return value === '' || value.includes('placeholder');
}

export function createWebhooksRouter(runner: BillingServiceRunner = sqlRunner): Hono<AuthEnv> {
  const router = new Hono<AuthEnv>();

  router.post('/webhooks/stripe', async (c) => {
    const { auth, billing } = getConfig();
    if (auth.mode === 'prod' && isPlaceholderSecret(billing.stripeWebhookSecret)) {
      throw problem(503, 'Service Unavailable', 'Stripe webhook secret is not configured');
    }

    // signature covers the RAW bytes - read text BEFORE JSON parsing
    const payload = await c.req.text();
    const signatureOk = verifyStripeSignature({
      payload,
      header: c.req.header('stripe-signature'),
      secret: billing.stripeWebhookSecret,
      toleranceSeconds: billing.stripeSignatureToleranceSeconds,
    });
    if (!signatureOk) {
      throw problem(400, 'Bad Request', 'Invalid Stripe webhook signature');
    }

    let body: unknown;
    try {
      body = JSON.parse(payload);
    } catch {
      throw problem(400, 'Bad Request', 'Body is not valid JSON');
    }
    const parsed = stripeEventSchema.safeParse(body);
    if (!parsed.success) {
      throw problem(400, 'Bad Request', 'Unexpected Stripe event shape (id/type missing)');
    }

    const event = parsed.data;
    const result = await runner(`stripe webhook ${event.id} (${event.type})`, (store) =>
      processProviderEvent(store, {
        provider: 'stripe',
        eventId: event.id,
        eventType: event.type,
        payload: body,
        mapped: mapStripeEvent(event),
      }),
    );

    return c.json(
      {
        received: true,
        outcome: result.outcome,
        ...(result.detail !== undefined ? { detail: result.detail } : {}),
      },
      200,
    );
  });

  router.post('/webhooks/revenuecat', async (c) => {
    const { auth, billing } = getConfig();
    if (auth.mode === 'prod' && isPlaceholderSecret(billing.revenuecatAuthToken)) {
      throw problem(503, 'Service Unavailable', 'RevenueCat webhook authorization is not configured');
    }

    if (!verifyRevenueCatAuthorization(c.req.header('authorization'), billing.revenuecatAuthToken)) {
      throw problem(401, 'Unauthorized', 'Invalid webhook authorization');
    }

    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      throw problem(400, 'Bad Request', 'Body is not valid JSON');
    }
    const parsed = revenuecatBodySchema.safeParse(body);
    if (!parsed.success) {
      throw problem(400, 'Bad Request', 'Unexpected RevenueCat payload shape (event.id/type missing)');
    }

    const event = parsed.data.event;
    const result = await runner(`revenuecat webhook ${event.id} (${event.type})`, (store) =>
      processProviderEvent(store, {
        provider: 'revenuecat',
        eventId: event.id,
        eventType: event.type,
        payload: body,
        mapped: mapRevenueCatEvent(event),
      }),
    );

    return c.json(
      {
        received: true,
        outcome: result.outcome,
        ...(result.detail !== undefined ? { detail: result.detail } : {}),
      },
      200,
    );
  });

  return router;
}
