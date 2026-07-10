// ============================================================================
// modules/billing/verify.ts - webhook authenticity checks (pure, no I/O).
//
// Blueprint ADR-E6 + v1 lesson (research/09 §2.7): signature verification is
// MANDATORY - v1 processed Stripe events unverified unless attacker-supplied
// metadata said otherwise, and PayPal "continued anyway" on failure. Here a
// failed check means the request is rejected BEFORE any parsing/processing.
//
// Stripe: manual HMAC verification of the `stripe-signature` header
// (t=<unix>,v1=<hex hmac-sha256 of "<t>.<raw body>">) with a timestamp
// tolerance window - the documented scheme, no stripe SDK dependency needed.
// RevenueCat: static Authorization header compared in constant time.
// ============================================================================

import { createHmac, timingSafeEqual } from 'node:crypto';

/** Constant-time string comparison (length mismatch returns false fast). */
export function timingSafeEqualString(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export interface StripeSignatureHeader {
  timestamp: number;
  /** all v1 signatures in the header (Stripe sends several on key rotation) */
  signatures: string[];
}

/** Parse `t=...,v1=...[,v1=...]` - returns undefined for malformed headers. */
export function parseStripeSignatureHeader(header: string): StripeSignatureHeader | undefined {
  let timestamp: number | undefined;
  const signatures: string[] = [];
  for (const part of header.split(',')) {
    const eq = part.indexOf('=');
    if (eq <= 0) continue;
    const key = part.slice(0, eq).trim();
    const value = part.slice(eq + 1).trim();
    if (key === 't') {
      const t = Number.parseInt(value, 10);
      if (Number.isFinite(t)) timestamp = t;
    } else if (key === 'v1' && value !== '') {
      signatures.push(value);
    }
  }
  if (timestamp === undefined || signatures.length === 0) return undefined;
  return { timestamp, signatures };
}

export interface StripeVerifyInput {
  /** RAW request body - byte-exact, before any JSON parsing. */
  payload: string;
  /** Value of the `stripe-signature` header. */
  header: string | undefined;
  /** Webhook signing secret (whsec_...). */
  secret: string;
  /** Max accepted timestamp age in seconds (default 300, like the SDK). */
  toleranceSeconds?: number;
  /** Injectable clock for tests (unix seconds). */
  nowSeconds?: number;
}

/** True only for a well-formed, fresh, correctly signed Stripe webhook. */
export function verifyStripeSignature(input: StripeVerifyInput): boolean {
  const { payload, header, secret } = input;
  if (header === undefined || header === '' || secret === '') return false;

  const parsed = parseStripeSignatureHeader(header);
  if (!parsed) return false;

  const tolerance = input.toleranceSeconds ?? 300;
  const now = input.nowSeconds ?? Math.floor(Date.now() / 1000);
  if (Math.abs(now - parsed.timestamp) > tolerance) return false;

  const expected = createHmac('sha256', secret)
    .update(`${parsed.timestamp}.${payload}`, 'utf8')
    .digest('hex');
  return parsed.signatures.some((sig) => timingSafeEqualString(sig, expected));
}

/**
 * RevenueCat sends the exact Authorization header value configured in its
 * dashboard. Accept the configured token verbatim or as `Bearer <token>`.
 */
export function verifyRevenueCatAuthorization(
  header: string | undefined,
  configuredToken: string,
): boolean {
  if (header === undefined || header === '' || configuredToken === '') return false;
  return (
    timingSafeEqualString(header, configuredToken) ||
    timingSafeEqualString(header, `Bearer ${configuredToken}`)
  );
}
