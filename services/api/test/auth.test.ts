// Auth middleware tests - no network, no database. A minimal Hono app wraps
// requireAuth and echoes the verified claims.

import { beforeAll, describe, expect, it } from 'vitest';
import { Hono } from 'hono';
import { SignJWT } from 'jose';
import { resetConfigForTests } from '../src/config.js';
import { requireAuth } from '../src/middleware/auth.js';
import type { AuthEnv } from '../src/middleware/auth.js';
import { onError, requestId } from '../src/middleware/error.js';

const TEST_SECRET = 'test-secret-for-vitest-0123456789abcdef';
const CLUB = '11111111-1111-4111-8111-111111111111';
const SUB = '22222222-2222-4222-8222-222222222222';

function key(secret = TEST_SECRET): Uint8Array {
  return new TextEncoder().encode(secret);
}

async function sign(
  claims: Record<string, unknown>,
  opts: { secret?: string; expiresIn?: string | number } = {},
): Promise<string> {
  return new SignJWT(claims)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setAudience('authenticated') // GoTrue sets aud=authenticated
    .setExpirationTime(opts.expiresIn ?? '5m')
    .sign(key(opts.secret));
}

let app: Hono<AuthEnv>;

beforeAll(() => {
  process.env['AUTH_MODE'] = 'dev';
  process.env['AUTH_JWT_SECRET'] = TEST_SECRET;
  process.env['AUTH_ISSUER'] = '';
  process.env['AUTH_AUDIENCE'] = 'authenticated';
  resetConfigForTests();

  app = new Hono<AuthEnv>();
  app.use('*', requestId);
  app.use('*', requireAuth);
  app.onError(onError);
  app.get('/whoami', (c) => c.json(c.get('claims')));
});

async function get(token?: string): Promise<Response> {
  const headers: Record<string, string> = token ? { authorization: `Bearer ${token}` } : {};
  return await app.request('/whoami', { headers });
}

describe('requireAuth', () => {
  it('rejects a missing token with a RFC 7807 problem', async () => {
    const res = await get();
    expect(res.status).toBe(401);
    expect(res.headers.get('content-type')).toContain('application/problem+json');
    const body = (await res.json()) as { title: string; request_id?: string };
    expect(body.title).toBe('Unauthorized');
    expect(body.request_id).toBeTruthy();
  });

  it('accepts a valid token and exposes the claims', async () => {
    const token = await sign({ sub: SUB, role: 'authenticated', club_roles: { [CLUB]: 'coach' } });
    const res = await get(token);
    expect(res.status).toBe(200);
    const claims = (await res.json()) as { sub: string; club_roles: Record<string, string> };
    expect(claims.sub).toBe(SUB);
    expect(claims.club_roles[CLUB]).toBe('coach');
  });

  it('rejects an expired token', async () => {
    const token = await sign(
      { sub: SUB, role: 'authenticated', club_roles: {} },
      { expiresIn: Math.floor(Date.now() / 1000) - 60 },
    );
    const res = await get(token);
    expect(res.status).toBe(401);
  });

  it('rejects a token signed with the wrong secret', async () => {
    const token = await sign(
      { sub: SUB, role: 'authenticated', club_roles: {} },
      { secret: 'wrong-secret-wrong-secret-wrong-secret' },
    );
    const res = await get(token);
    expect(res.status).toBe(401);
  });

  it('rejects service-role tokens (the API itself is the service)', async () => {
    const token = await sign({ sub: SUB, role: 'service_role', club_roles: {} });
    const res = await get(token);
    expect(res.status).toBe(401);
  });

  it('rejects tokens whose club_roles have an unknown role value', async () => {
    const token = await sign({ sub: SUB, role: 'authenticated', club_roles: { [CLUB]: 'superadmin' } });
    const res = await get(token);
    expect(res.status).toBe(401);
  });

  it('preserves an incoming x-request-id in error responses', async () => {
    const res = await app.request('/whoami', { headers: { 'x-request-id': 'req-abc-123' } });
    expect(res.status).toBe(401);
    const body = (await res.json()) as { request_id?: string };
    expect(body.request_id).toBe('req-abc-123');
  });
});
