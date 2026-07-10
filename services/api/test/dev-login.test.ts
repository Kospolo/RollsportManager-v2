// Dev-login tests - no network, no database. Uses the REAL createApp() so the
// PUBLIC_PATHS wiring, the dev-only CORS and the 404-in-prod behaviour are
// covered exactly as they run in the server.

import { afterEach, describe, expect, it } from 'vitest';
import { jwtVerify } from 'jose';
import { resetConfigForTests } from '../src/config.js';
import { createApp } from '../src/app.js';
import { authClaimsSchema } from '../src/middleware/auth.js';
import { DEV_CLUB_ID, DEV_PERSONAS } from '../src/routes/dev-login.js';

const TEST_SECRET = 'test-secret-for-dev-login-0123456789abcdef';

function devApp() {
  process.env['AUTH_MODE'] = 'dev';
  process.env['AUTH_JWT_SECRET'] = TEST_SECRET;
  process.env['AUTH_ISSUER'] = '';
  process.env['AUTH_AUDIENCE'] = 'authenticated';
  resetConfigForTests();
  return createApp();
}

function prodApp() {
  process.env['AUTH_MODE'] = 'prod';
  process.env['AUTH_JWKS_URL'] = 'https://auth.invalid/jwks'; // never fetched here
  resetConfigForTests();
  return createApp();
}

afterEach(() => {
  process.env['AUTH_MODE'] = 'dev';
  delete process.env['AUTH_JWKS_URL'];
  resetConfigForTests();
});

async function login(app: ReturnType<typeof createApp>, body: unknown): Promise<Response> {
  return app.request('/dev/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /dev/login (AUTH_MODE=dev)', () => {
  it('returns a verifiable HS256 token with the exact middleware claims contract', async () => {
    const app = devApp();
    const res = await login(app, { persona: 'coach' });
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      token_type: string;
      access_token: string;
      expires_in: number;
      profile: { sub: string; display_name: string; club_id: string; club_role: string };
    };
    expect(json.token_type).toBe('Bearer');
    expect(json.profile.display_name).toBe('Sandra Vogel');
    expect(json.profile.club_id).toBe(DEV_CLUB_ID);

    // token verifies with the same secret + audience the middleware uses
    const { payload } = await jwtVerify(
      json.access_token,
      new TextEncoder().encode(TEST_SECRET),
      { algorithms: ['HS256'], audience: 'authenticated' },
    );
    const claims = authClaimsSchema.parse(payload);
    expect(claims.sub).toBe(DEV_PERSONAS.coach.sub);
    expect(claims.role).toBe('authenticated');
    expect(claims.club_roles[DEV_CLUB_ID]).toBe('coach');
  });

  it('maps guest to the guest_coach club role', async () => {
    const app = devApp();
    const res = await login(app, { persona: 'guest' });
    expect(res.status).toBe(200);
    const json = (await res.json()) as { profile: { club_role: string } };
    expect(json.profile.club_role).toBe('guest_coach');
  });

  it('rejects an unknown persona with 422', async () => {
    const app = devApp();
    const res = await login(app, { persona: 'superuser' });
    expect(res.status).toBe(422);
  });

  it('is reachable without a bearer token (PUBLIC_PATHS wiring)', async () => {
    const app = devApp();
    // 422 (validation), NOT 401 - proves requireAuth is skipped
    const res = await login(app, {});
    expect(res.status).toBe(422);
  });

  it('answers CORS preflight for the web portal on localhost:3021', async () => {
    const app = devApp();
    const res = await app.request('/dev/login', {
      method: 'OPTIONS',
      headers: {
        origin: 'http://localhost:3021',
        'access-control-request-method': 'POST',
        'access-control-request-headers': 'authorization,content-type',
      },
    });
    expect(res.headers.get('access-control-allow-origin')).toBe('http://localhost:3021');
    expect(res.headers.get('access-control-allow-headers') ?? '').toMatch(/authorization/i);
  });
});

describe('POST /dev/login (AUTH_MODE=prod)', () => {
  it('behaves like a non-existent route (404 problem)', async () => {
    const app = prodApp();
    const res = await login(app, { persona: 'coach' });
    expect(res.status).toBe(404);
    expect(res.headers.get('content-type')).toContain('application/problem+json');
    const body = (await res.json()) as { title: string };
    expect(body.title).toBe('Not Found');
  });

  it('sends no dev CORS headers in prod mode', async () => {
    const app = prodApp();
    const res = await app.request('/health', {
      headers: { origin: 'http://localhost:3021' },
    });
    expect(res.headers.get('access-control-allow-origin')).toBeNull();
  });
});
