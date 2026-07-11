// ============================================================================
// platform.test.ts - Betreiber-Konsole authorization (no network, no DB).
//
// Every /platform/* endpoint is is_platform_admin ONLY. requirePlatformAdmin
// throws 403 BEFORE any database access, so the negative authz path is fully
// testable in-process: an anonymous caller gets 401, and every non-platform
// caller (club owner/admin/member) gets 403. The positive path (200 + SMTP
// masking) needs a database and is covered by scripts/smoke.mjs / api-db-test.
// ============================================================================

import { beforeAll, describe, expect, it } from 'vitest';
import { SignJWT } from 'jose';
import { resetConfigForTests } from '../src/config.js';
import { createApp } from '../src/app.js';
import type { OpenAPIHono } from '@hono/zod-openapi';
import type { AuthEnv } from '../src/middleware/auth.js';

const TEST_SECRET = 'test-secret-for-vitest-0123456789abcdef';
const CLUB = '11111111-1111-4111-8111-111111111111';
const PRODUCT = '22222222-2222-4222-8222-222222222222';

async function sign(claims: Record<string, unknown>): Promise<string> {
  return new SignJWT(claims)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setAudience('authenticated')
    .setExpirationTime('5m')
    .sign(new TextEncoder().encode(TEST_SECRET));
}

let app: OpenAPIHono<AuthEnv>;
let ownerToken: string;
let memberToken: string;
let adminToken: string;

beforeAll(async () => {
  process.env['AUTH_MODE'] = 'dev';
  process.env['AUTH_JWT_SECRET'] = TEST_SECRET;
  process.env['AUTH_ISSUER'] = '';
  process.env['AUTH_AUDIENCE'] = 'authenticated';
  resetConfigForTests();
  app = createApp();
  ownerToken = await sign({ sub: '00000000-0000-4000-8000-000000000001', role: 'authenticated', club_roles: { [CLUB]: 'owner' } });
  adminToken = await sign({ sub: '00000000-0000-4000-8000-000000000002', role: 'authenticated', club_roles: { [CLUB]: 'admin' } });
  memberToken = await sign({ sub: '00000000-0000-4000-8000-000000000003', role: 'authenticated', club_roles: { [CLUB]: 'member' } });
});

function req(method: string, path: string, token?: string, body?: unknown): Response | Promise<Response> {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (token) headers.authorization = `Bearer ${token}`;
  return app.request(path, {
    method,
    headers,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

// [method, path, valid-body-or-undefined]
const READS: Array<[string, string]> = [
  ['GET', '/platform/settings'],
  ['GET', '/platform/entitlements'],
  ['GET', '/platform/payments'],
  ['GET', '/platform/products'],
  ['GET', '/platform/system'],
];

const WRITES: Array<[string, string, unknown]> = [
  ['PATCH', '/platform/settings', { feature_flags: { maintenance_mode: true } }],
  ['PATCH', `/platform/entitlements/${CLUB}`, { tier: 'pro', status: 'active' }],
  ['PATCH', `/platform/products/${PRODUCT}`, { active: true }],
];

describe('platform console: authentication', () => {
  it('rejects every endpoint without a token (401)', async () => {
    for (const [method, path] of READS) {
      expect((await req(method, path)).status).toBe(401);
    }
    for (const [method, path, body] of WRITES) {
      expect((await req(method, path, undefined, body)).status).toBe(401);
    }
  });
});

describe('platform console: is_platform_admin only (non-platform -> 403)', () => {
  it('forbids club owner on every read + write (403, before any DB access)', async () => {
    for (const [method, path] of READS) {
      expect((await req(method, path, ownerToken)).status).toBe(403);
    }
    for (const [method, path, body] of WRITES) {
      expect((await req(method, path, ownerToken, body)).status).toBe(403);
    }
  });

  it('forbids club admin and plain member alike (403)', async () => {
    for (const token of [adminToken, memberToken]) {
      for (const [method, path] of READS) {
        expect((await req(method, path, token)).status).toBe(403);
      }
      for (const [method, path, body] of WRITES) {
        expect((await req(method, path, token, body)).status).toBe(403);
      }
    }
  });

  it('returns an RFC 7807 problem body on the 403', async () => {
    const res = await req('GET', '/platform/settings', ownerToken);
    expect(res.status).toBe(403);
    expect(res.headers.get('content-type')).toContain('application/problem+json');
    const body = (await res.json()) as { title: string; status: number };
    expect(body.title).toBe('Forbidden');
    expect(body.status).toBe(403);
  });
});
