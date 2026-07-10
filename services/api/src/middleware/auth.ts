// ============================================================================
// middleware/auth.ts - JWT verification (Blueprint ADR-E3).
//
//   * dev : HS256 with a shared secret from config (local harness / GoTrue
//           legacy default style).
//   * prod: ES256 via the GoTrue JWKS endpoint (asymmetric - the private key
//           never leaves the auth container). jose caches + refreshes JWKS.
//
// Claims contract (written by the GoTrue custom access token hook):
//   sub        - auth.users.id (uuid)
//   role       - postgres role, must be 'authenticated' for end users
//   club_roles - { "<club_id>": "owner|admin|treasurer|coach|member|guest_coach" }
//
// The verified claims object is stored on the Hono context and later becomes
// `request.jwt.claims` inside the impersonated transaction (src/db.ts) - the
// database sees EXACTLY what the token said, nothing more.
// ============================================================================

import { createMiddleware } from 'hono/factory';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import type { JWTPayload } from 'jose';
import { z } from '@hono/zod-openapi';
import { getConfig } from '../config.js';
import { problem } from './error.js';

// Enum order mirrors the DB (app.club_member_role): rank owner > admin >
// moderator > treasurer > coach ... ('moderator' re-added in migration 0007).
export const CLUB_ROLES = [
  'owner',
  'admin',
  'moderator',
  'treasurer',
  'coach',
  'member',
  'guest_coach',
] as const;
export type ClubRole = (typeof CLUB_ROLES)[number];

/**
 * PLATFORM admin ("super_admin" level) is NOT a club role - it is a JWT claim.
 * GoTrue emits raw_app_meta_data into the access token, so the flag arrives as
 * app_metadata.is_platform_admin (the custom access-token hook must copy it in;
 * see supabase migration 0007 / dev-login). We also accept the top-level and
 * platform_role variants that app.is_platform_admin() reads, so the API guard
 * mirrors the DB helper exactly.
 */
const platformMetaSchema = z
  .object({
    is_platform_admin: z.boolean().optional(),
    role: z.string().optional(),
  })
  .passthrough();

export const authClaimsSchema = z
  .object({
    sub: z.string().uuid(),
    role: z.literal('authenticated'),
    club_roles: z.record(z.string().uuid(), z.enum(CLUB_ROLES)).default({}),
    // platform-admin claim variants (all optional; end users simply omit them)
    is_platform_admin: z.boolean().optional(),
    platform_role: z.string().optional(),
    app_metadata: platformMetaSchema.optional(),
  })
  .passthrough();

export type AuthClaims = z.infer<typeof authClaimsSchema>;

export interface AuthEnv {
  Variables: {
    claims: AuthClaims;
    requestId: string;
  };
}

let jwks: ReturnType<typeof createRemoteJWKSet> | undefined;

async function verifyToken(token: string): Promise<JWTPayload> {
  const { auth } = getConfig();
  const options = {
    ...(auth.issuer !== '' ? { issuer: auth.issuer } : {}),
    ...(auth.audience !== '' ? { audience: auth.audience } : {}),
  };
  if (auth.mode === 'prod') {
    jwks ??= createRemoteJWKSet(new URL(auth.jwksUrl));
    const { payload } = await jwtVerify(token, jwks, { ...options, algorithms: ['ES256'] });
    return payload;
  }
  const secret = new TextEncoder().encode(auth.jwtSecret);
  const { payload } = await jwtVerify(token, secret, { ...options, algorithms: ['HS256'] });
  return payload;
}

/**
 * Bearer-token middleware. Rejects missing/invalid/expired tokens with a
 * RFC 7807 problem. Service-role tokens are NOT accepted here - the API
 * itself is the service; end users always carry role=authenticated.
 */
export const requireAuth = createMiddleware<AuthEnv>(async (c, next) => {
  const header = c.req.header('authorization') ?? '';
  const [scheme, token] = header.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) {
    throw problem(401, 'Unauthorized', 'Missing bearer token');
  }

  let payload: JWTPayload;
  try {
    payload = await verifyToken(token);
  } catch {
    throw problem(401, 'Unauthorized', 'Invalid or expired token');
  }

  const parsed = authClaimsSchema.safeParse(payload);
  if (!parsed.success) {
    throw problem(401, 'Unauthorized', 'Token claims do not match the expected contract');
  }

  c.set('claims', parsed.data);
  await next();
});
