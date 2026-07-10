// ============================================================================
// config.ts - central configuration.
//
// NOTE ON CONFIG SOURCES (user preference "Einstellungen immer ins Admin"):
// Environment variables are only the FALLBACK. Operational values (SMTP,
// provider keys, feature flags, ...) will later be loaded from an admin-UI
// backed settings table and merged over these env defaults. Keep every value
// behind this module so that swap stays a one-file change - never read
// process.env anywhere else.
// ============================================================================

export type AuthMode = 'dev' | 'prod';

export interface ApiConfig {
  /** HTTP port. 3021 is the web portal - the API defaults to 3022. */
  port: number;
  /** Postgres connection string (see src/db.ts for the role model). */
  databaseUrl: string;
  auth: {
    /** dev = HS256 shared secret; prod = ES256 via GoTrue JWKS. */
    mode: AuthMode;
    /** dev only - shared HS256 secret. */
    jwtSecret: string;
    /** prod only - JWKS URL of GoTrue. */
    jwksUrl: string;
    /** Optional issuer check (empty string = skip). */
    issuer: string;
    /** Optional audience check (empty string = skip). GoTrue default: "authenticated". */
    audience: string;
  };
  billing: {
    /**
     * Stripe webhook signing secret (whsec_...). Placeholder in dev; in prod
     * mode the webhook endpoint answers 503 until a real value is configured
     * (later via admin UI settings - .env is only the fallback).
     */
    stripeWebhookSecret: string;
    /**
     * Exact Authorization header value RevenueCat is configured to send
     * (RevenueCat dashboard -> webhook -> Authorization header).
     */
    revenuecatAuthToken: string;
    /** Max accepted age of a Stripe signature timestamp, in seconds. */
    stripeSignatureToleranceSeconds: number;
  };
}

function env(name: string, fallback = ''): string {
  const v = process.env[name];
  return v === undefined || v === '' ? fallback : v;
}

export function loadConfig(): ApiConfig {
  const mode = env('AUTH_MODE', 'dev');
  if (mode !== 'dev' && mode !== 'prod') {
    throw new Error(`AUTH_MODE must be 'dev' or 'prod', got '${mode}'`);
  }
  const config: ApiConfig = {
    port: Number.parseInt(env('PORT', '3022'), 10),
    databaseUrl: env('DATABASE_URL', 'postgres://postgres:rsm2-local-test@127.0.0.1:55432/rsm2'),
    auth: {
      mode,
      jwtSecret: env('AUTH_JWT_SECRET', 'dev-only-placeholder-secret-please-change'),
      jwksUrl: env('AUTH_JWKS_URL'),
      issuer: env('AUTH_ISSUER'),
      audience: env('AUTH_AUDIENCE', 'authenticated'),
    },
    billing: {
      stripeWebhookSecret: env('STRIPE_WEBHOOK_SECRET', 'whsec-dev-placeholder'),
      revenuecatAuthToken: env('REVENUECAT_WEBHOOK_AUTH', 'rc-dev-placeholder-token'),
      stripeSignatureToleranceSeconds: Number.parseInt(
        env('STRIPE_SIGNATURE_TOLERANCE_SECONDS', '300'),
        10,
      ),
    },
  };
  if (config.auth.mode === 'prod' && config.auth.jwksUrl === '') {
    throw new Error('AUTH_MODE=prod requires AUTH_JWKS_URL');
  }
  return config;
}

/** Lazily created singleton so tests can set env vars before first use. */
let cached: ApiConfig | undefined;
export function getConfig(): ApiConfig {
  cached ??= loadConfig();
  return cached;
}
export function resetConfigForTests(): void {
  cached = undefined;
}
