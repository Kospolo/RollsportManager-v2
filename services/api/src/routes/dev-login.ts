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
  /** app.club_members.id from the seed (null for the platform admin: no membership row). */
  memberId: string | null;
  displayName: string;
  email: string;
  /** Role in the demo club, or null for a pure platform admin (no club role). */
  clubRole: ClubRole | null;
  /** True for the platform (super_admin) persona -> app_metadata.is_platform_admin. */
  platformAdmin?: boolean;
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
  moderator: {
    sub: '90000000-0000-4000-8000-000000000014',
    memberId: 'a0000000-0000-4000-8000-000000000014',
    displayName: 'Petra Köhler',
    email: 'petra.koehler@example.org',
    clubRole: 'moderator',
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
  // NEULING - eine ganz normale Person OHNE Verein.
  //
  // Die gab es unter den bisherigen 8 Personas NICHT: 'platform' hat zwar
  // clubRole:null, ist aber Plattform-Admin und damit das GEGENTEIL eines
  // Neulings (app.is_club_member gibt ihm den Cross-Club-READ-Bypass, 0025:92).
  // Ohne diese Persona ist die Registrierung nicht testbar - jeder vorhandene
  // Token gehoert schon zu RSV Neckarsulm.
  //
  // Sie ist damit auch der Beweis-Traeger fuer die Kernaussage: ein Neuling
  // sieht NICHTS, und nach dem Beitritt mit richtigem Code (status='pending')
  // sieht er IMMER NOCH nichts.
  neuling: {
    sub: '90000000-0000-4000-8000-000000000091',
    memberId: null,
    displayName: 'Nadja Neuling',
    email: 'nadja.neuling@example.org',
    clubRole: null,
  },
  // PLATFORM super-admin: no club_members row, no club role. Cross-club READ via
  // the app_metadata.is_platform_admin claim (seed profile ...090).
  platform: {
    sub: '90000000-0000-4000-8000-000000000090',
    memberId: null,
    displayName: 'RSM Plattform-Admin',
    email: 'platform.admin@rollsportmanager.app',
    clubRole: null,
    platformAdmin: true,
  },

  // === BENANNTE KONTEN (seed/dev-accounts.sql) =============================
  // Die Personas oben sind erfundene Vereinsleute aus dem Seed — gut zum
  // Ansehen, unpraktisch zum Arbeiten: Wer pruefen will, was ein Kassenwart
  // sieht, will "kasse" tippen und nicht wissen muessen, dass Beate Schaefer
  // die Kasse fuehrt. Die folgenden Konten heissen deshalb nach ihrem Bereich.
  //
  // Die Kennungen (sub/memberId) sind fest und stehen ebenso in
  // supabase/seed/dev-accounts.sql. Wer dort etwas aendert, muss es HIER
  // mitziehen — sonst zeigt der Login auf eine Person, die es nicht gibt.
  superadmin: {
    // Betreiber UND Vorstand: Ein reiner Betreiber sieht nur die Konsole,
    // nicht das Vereinsportal (er ist dort kein Mitglied).
    sub: '90000000-0000-4000-8000-0000000000a0',
    memberId: '90000000-0000-4000-8000-0000000000a0',
    displayName: 'Marcel Goldfuß',
    email: 'marcelgoldfuss@icloud.com',
    clubRole: 'owner',
    platformAdmin: true,
  },
  apple: {
    // Bewusst KEIN Betreiber: Die App-Store-Pruefung soll das Produkt sehen,
    // nicht die Konsole, mit der wir fremde Vereine verwalten.
    sub: '90000000-0000-4000-8000-0000000000a1',
    memberId: '90000000-0000-4000-8000-0000000000a1',
    displayName: 'Apple Review',
    email: 'apple-review@rollsportmanager.de',
    clubRole: 'owner',
  },
  vorstand: {
    sub: '90000000-0000-4000-8000-0000000000a2',
    memberId: '90000000-0000-4000-8000-0000000000a2',
    displayName: 'Demo Vorstand',
    email: 'vorstand@rollsportmanager.de',
    clubRole: 'owner',
  },
  verwaltung: {
    sub: '90000000-0000-4000-8000-0000000000a3',
    memberId: '90000000-0000-4000-8000-0000000000a3',
    displayName: 'Demo Verwaltung',
    email: 'verwaltung@rollsportmanager.de',
    clubRole: 'admin',
  },
  kasse: {
    sub: '90000000-0000-4000-8000-0000000000a4',
    memberId: '90000000-0000-4000-8000-0000000000a4',
    displayName: 'Demo Kassenwart',
    email: 'kasse@rollsportmanager.de',
    clubRole: 'treasurer',
  },
  moderation: {
    sub: '90000000-0000-4000-8000-0000000000a5',
    memberId: '90000000-0000-4000-8000-0000000000a5',
    displayName: 'Demo Moderation',
    email: 'moderation@rollsportmanager.de',
    clubRole: 'moderator',
  },
  trainer: {
    sub: '90000000-0000-4000-8000-0000000000a6',
    memberId: '90000000-0000-4000-8000-0000000000a6',
    displayName: 'Demo Trainer',
    email: 'trainer@rollsportmanager.de',
    clubRole: 'coach',
  },
  gasttrainer: {
    // Befristet (valid_until = +90 Tage, von der Datenbank erzwungen).
    sub: '90000000-0000-4000-8000-0000000000a7',
    memberId: '90000000-0000-4000-8000-0000000000a7',
    displayName: 'Demo Gasttrainer',
    email: 'gasttrainer@rollsportmanager.de',
    clubRole: 'guest_coach',
  },
  mitglied: {
    sub: '90000000-0000-4000-8000-0000000000a8',
    memberId: '90000000-0000-4000-8000-0000000000a8',
    displayName: 'Demo Mitglied',
    email: 'mitglied@rollsportmanager.de',
    clubRole: 'member',
  },
  eltern: {
    // Rolle und Rechte sind identisch mit `mitglied` — der Unterschied
    // entsteht allein durch die Sorgeberechtigung fuer Emma Gruenewald.
    // Genau daran laesst sich der Kinderschutz pruefen.
    sub: '90000000-0000-4000-8000-0000000000a9',
    memberId: '90000000-0000-4000-8000-0000000000a9',
    displayName: 'Demo Elternteil',
    email: 'eltern@rollsportmanager.de',
    clubRole: 'member',
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

    const persona: DevPersona = DEV_PERSONAS[parsed.data.persona];
    const isPlatform = persona.platformAdmin === true;
    // Mirror the GoTrue access-token hook: club_roles map + (for the platform
    // admin) app_metadata.is_platform_admin so app.is_platform_admin() fires.
    const claims: Record<string, unknown> = {
      sub: persona.sub,
      role: 'authenticated',
      club_roles: persona.clubRole ? { [DEV_CLUB_ID]: persona.clubRole } : {},
    };
    if (isPlatform) {
      claims['app_metadata'] = { is_platform_admin: true };
      claims['is_platform_admin'] = true;
    }
    const jwt = new SignJWT(claims)
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
        club_id: persona.clubRole ? DEV_CLUB_ID : null,
        club_role: persona.clubRole,
        is_platform_admin: isPlatform,
      },
    });
  });

  return router;
}
