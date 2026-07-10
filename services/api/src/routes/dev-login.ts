// ============================================================================
// routes/dev-login.ts - DEV-ONLY persona login. NOT part of the product.
//
// POST /dev/login {"persona":"coach"} -> signed HS256 JWT + profile info for
// one of the seeded demo personas (supabase/seed/seed.sql, club RSV
// Neckarsulm). Lets the web portal (localhost:3021) and manual curl sessions
// obtain a token without running GoTrue locally.
//
// SAFETY:
//   * Only active when AUTH_MODE=dev - in prod mode the route answers 404
//     exactly like a route that does not exist (checked per request, not at
//     startup, so a config swap can never leave it enabled).
//   * Plain Hono router (like the webhooks): deliberately NOT in the OpenAPI
//     spec, so codegen/contracts (packages/contracts) never see it.
//   * Tokens are signed with the same AUTH_JWT_SECRET the auth middleware
//     verifies against; claims match the GoTrue hook contract exactly
//     (sub, role=authenticated, club_roles).
// ============================================================================

import { Hono } from 'hono';
import { SignJWT } from 'jose';
import { z } from '@hono/zod-openapi';
import { getConfig } from '../config.js';
import { problem } from '../middleware/error.js';
import type { AuthEnv, ClubRole } from '../middleware/auth.js';

/** The one seeded demo club (RSV Neckarsulm). */
export const DEV_CLUB_ID = 'c1ab0000-0000-4000-8000-000000000001';

export interface DevPersona {
  /** auth.users.id / app.profiles.id from the seed -> JWT `sub`. */
  sub: string;
  /** app.club_members.id from the seed (handy for RSVP calls etc.). */
  memberId: string;
  displayName: string;
  email: string;
  clubRole: ClubRole;
}

/** Personas straight from supabase/seed/seed.sql - keep in sync with the seed. */
export const DEV_PERSONAS = {
  coach: {
    sub: '90000000-0000-4000-8000-000000000001',
    memberId: 'a0000000-0000-4000-8000-000000000001',
    displayName: 'Sandra Vogel',
    email: 'sandra.vogel@example.org',
    clubRole: 'coach',
  },
  owner: {
    sub: '90000000-0000-4000-8000-000000000002',
    memberId: 'a0000000-0000-4000-8000-000000000002',
    displayName: 'Jürgen Häberle',
    email: 'juergen.haeberle@example.org',
    clubRole: 'owner',
  },
  treasurer: {
    sub: '90000000-0000-4000-8000-000000000003',
    memberId: 'a0000000-0000-4000-8000-000000000003',
    displayName: 'Beate Schäfer',
    email: 'beate.schaefer@example.org',
    clubRole: 'treasurer',
  },
  admin: {
    sub: '90000000-0000-4000-8000-000000000004',
    memberId: 'a0000000-0000-4000-8000-000000000004',
    displayName: 'Thomas Krüger',
    email: 'thomas.krueger@example.org',
    clubRole: 'admin',
  },
  member: {
    sub: '90000000-0000-4000-8000-000000000009',
    memberId: 'a0000000-0000-4000-8000-000000000009',
    displayName: 'Katrin Grünewald',
    email: 'katrin.gruenewald@example.org',
    clubRole: 'member',
  },
  guest: {
    sub: '90000000-0000-4000-8000-000000000006',
    memberId: 'a0000000-0000-4000-8000-000000000006',
    displayName: 'Milena Öztürk',
    email: 'milena.oeztuerk@example.org',
    clubRole: 'guest_coach',
  },
} as const satisfies Record<string, DevPersona>;

export type DevPersonaName = keyof typeof DEV_PERSONAS;
const PERSONA_NAMES = Object.keys(DEV_PERSONAS) as [DevPersonaName, ...DevPersonaName[]];

const bodySchema = z.object({ persona: z.enum(PERSONA_NAMES) });

/** 12h - long enough for a dev day, tokens are worthless outside dev anyway. */
const TOKEN_TTL_SECONDS = 12 * 60 * 60;

export function createDevLoginRouter(): Hono<AuthEnv> {
  const router = new Hono<AuthEnv>();

  router.post('/dev/login', async (c) => {
    const { auth } = getConfig();
    if (auth.mode !== 'dev') {
      // behave EXACTLY like a non-existent route (same shape as onNotFound)
      throw problem(404, 'Not Found', `No route for POST ${c.req.path}`);
    }

    const raw: unknown = await c.req.json().catch(() => undefined);
    const parsed = bodySchema.safeParse(raw);
    if (!parsed.success) {
      throw problem(
        422,
        'Unprocessable Entity',
        `body must be {"persona": <one of ${PERSONA_NAMES.join('|')}>}`,
      );
    }

    const persona = DEV_PERSONAS[parsed.data.persona];
    const jwt = new SignJWT({
      sub: persona.sub,
      role: 'authenticated',
      club_roles: { [DEV_CLUB_ID]: persona.clubRole },
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime(Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS);
    // mirror the middleware's optional issuer/audience checks
    if (auth.issuer !== '') jwt.setIssuer(auth.issuer);
    if (auth.audience !== '') jwt.setAudience(auth.audience);
    const token = await jwt.sign(new TextEncoder().encode(auth.jwtSecret));

    return c.json({
      token_type: 'Bearer',
      access_token: token,
      expires_in: TOKEN_TTL_SECONDS,
      persona: parsed.data.persona,
      profile: {
        sub: persona.sub,
        member_id: persona.memberId,
        display_name: persona.displayName,
        email: persona.email,
        club_id: DEV_CLUB_ID,
        club_role: persona.clubRole,
      },
    });
  });

  return router;
}
