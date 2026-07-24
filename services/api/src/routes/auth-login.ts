// ============================================================================
// routes/auth-login.ts — der ECHTE E-Mail/Passwort-Login.
//
// Bis hierher konnte v2 sich nur über den Dev-Persona-Login anmelden. Diese
// Route prüft ein Passwort gegen den in auth.users.password_hash gespeicherten
// scrypt-Hash und stellt bei Erfolg genau denselben JWT aus wie der Dev-Login
// (dieselben Claims: sub, role, club_roles, ggf. is_platform_admin) — die
// Auth-Middleware und die RLS-Impersonation funktionieren damit unverändert.
//
// SICHERHEIT:
//   * Öffentlich (kein Bearer nötig): in PUBLIC_PATHS/PUBLIC_ROUTES, damit
//     requireAuth diese Route überspringt.
//   * KEINE Existenz-Auskunft: falsche E-Mail und falsches Passwort ergeben
//     dieselbe Antwort (401) und dieselbe Rechenzeit — bei unbekannter E-Mail
//     wird gegen einen Dummy-Hash geprüft (password.ts), damit die Dauer nichts
//     verrät.
//   * Rate-Limit auf IP UND Konto (E-Mail), damit weder ein Konto noch die
//     ganze Instanz durchprobiert werden kann.
//   * Gelesen wird im Service-Mode (der Aufrufer hat noch keine Identität); die
//     Abfragen sind eng auf die eine E-Mail bzw. das eine Profil gescoped.
// ============================================================================

import { createRoute, z } from '@hono/zod-openapi';
import { SignJWT } from 'jose';
import { createRouter, jsonContent } from '../lib/openapi.js';
import { problemSchema } from '../lib/validation.js';
import { getConfig } from '../config.js';
import { problem } from '../middleware/error.js';
import { withServiceRole } from '../db.js';
import { clientIp, enforceRateLimits } from '../lib/rate-limit.js';
import { verifyPassword, DUMMY_PASSWORD_HASH } from '../lib/password.js';

export const authLoginRouter = createRouter();

const TOKEN_TTL_SECONDS = 12 * 60 * 60;

const loginBodySchema = z
  .object({
    email: z.string().email(),
    password: z.string().min(1),
  })
  .openapi('LoginRequest');

const loginResponseSchema = z
  .object({
    token_type: z.literal('Bearer'),
    access_token: z.string(),
    expires_in: z.number().int(),
    profile: z.object({
      sub: z.string(),
      email: z.string(),
      is_platform_admin: z.boolean(),
    }),
  })
  .openapi('LoginResponse');

interface UserRow {
  id: string;
  email: string;
  password_hash: string | null;
  is_platform_admin: boolean;
}

authLoginRouter.openapi(
  createRoute({
    method: 'post',
    path: '/auth/login',
    tags: ['auth'],
    summary: 'Email/password login — issues an access token',
    description:
      'Unauthenticated. Verifies email + password and returns a signed access token with the ' +
      'same claims as the dev persona login. Unknown email and wrong password are indistinguishable.',
    request: {
      body: { content: { 'application/json': { schema: loginBodySchema } }, required: true },
    },
    responses: {
      200: jsonContent(loginResponseSchema, 'Access token + minimal profile'),
      401: jsonContent(problemSchema, 'Invalid email or password'),
      429: jsonContent(problemSchema, 'Too many attempts'),
    },
  }),
  async (c) => {
    const { auth } = getConfig();
    const raw: unknown = await c.req.json().catch(() => undefined);
    const parsed = loginBodySchema.safeParse(raw);
    if (!parsed.success) {
      throw problem(401, 'Unauthorized', 'Ungültige Anmeldedaten. / Invalid credentials.');
    }
    const email = parsed.data.email.trim().toLowerCase();

    // Rate-Limit: IP gegen breites Durchprobieren, Konto gegen gezieltes
    // Knacken einer einzelnen Adresse.
    await enforceRateLimits(c, [
      { scope: 'ip', identifier: clientIp(c), limit: 20, window: '15 minutes' },
      { scope: 'account', identifier: email, limit: 10, window: '15 minutes' },
    ]);

    const user = await withServiceRole('login user lookup', async (tx) => {
      const rows = await tx`
        select id,
               email,
               password_hash,
               coalesce((raw_app_meta_data->>'is_platform_admin')::boolean, false) as is_platform_admin
          from auth.users
         where lower(email) = ${email}
         limit 1`;
      return rows[0] as UserRow | undefined;
    });

    // Immer eine scrypt-Prüfung fahren — auch wenn es die E-Mail nicht gibt oder
    // das Konto kein Passwort hat: sonst wäre die Antwortzeit ein Existenz-Orakel.
    const hash = user?.password_hash ?? DUMMY_PASSWORD_HASH;
    const ok = verifyPassword(parsed.data.password, hash);
    if (!user || user.password_hash === null || !ok) {
      throw problem(401, 'Unauthorized', 'Ungültige Anmeldedaten. / Invalid credentials.');
    }

    // club_roles aus der Rechtematrix ableiten (ein Eintrag je Verein, in dem
    // die Person eine Rolle trägt) — dieselbe Form wie im Dev-Login.
    const roleRows = await withServiceRole('login role lookup', async (tx) => {
      return (await tx`
        select cm.club_id, r.key as role_key
          from app.member_roles mr
          join app.club_members cm on cm.id = mr.member_id and cm.deleted_at is null
          join app.roles r on r.id = mr.role_id
         where cm.profile_id = ${user.id}`) as { club_id: string; role_key: string }[];
    });
    const clubRoles: Record<string, string> = {};
    for (const row of roleRows) clubRoles[row.club_id] = row.role_key;

    const claims: Record<string, unknown> = {
      sub: user.id,
      role: 'authenticated',
      club_roles: clubRoles,
    };
    if (user.is_platform_admin) {
      claims['app_metadata'] = { is_platform_admin: true };
      claims['is_platform_admin'] = true;
    }

    const jwt = new SignJWT(claims)
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime(Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS);
    if (auth.issuer !== '') jwt.setIssuer(auth.issuer);
    if (auth.audience !== '') jwt.setAudience(auth.audience);
    const token = await jwt.sign(new TextEncoder().encode(auth.jwtSecret));

    return c.json(
      {
        token_type: 'Bearer' as const,
        access_token: token,
        expires_in: TOKEN_TTL_SECONDS,
        profile: {
          sub: user.id,
          email: user.email,
          is_platform_admin: user.is_platform_admin,
        },
      },
      200,
    );
  },
);
