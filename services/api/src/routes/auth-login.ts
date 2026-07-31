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
import { verifyPassword, hashPassword, DUMMY_PASSWORD_HASH } from '../lib/password.js';

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

// ---------------------------------------------------------------------------
// POST /auth/register — Selbstanlage eines Kontos mit E-Mail + Passwort.
//
// Der Gegenpart zum Login: legt auth.users (+ app.profiles) an und stellt
// SOFORT denselben Token aus wie /auth/login — die Person ist danach angemeldet
// und kann einen Verein gruenden (POST /clubs) oder per Code beitreten. Noch
// KEINE Vereinsrolle (club_roles = {}), noch KEINE E-Mail-Bestaetigung erzwungen
// (0085: email_confirmed_at ist vorbereitet, der Verify-Flow folgt).
//
// SICHERHEIT:
//   * Oeffentlich (PUBLIC_PATHS/PUBLIC_ROUTES) — vor der Anmeldung gibt es keine
//     Identitaet.
//   * Rate-Limit IP + E-Mail gegen Konto-Spam.
//   * Eine E-Mail = ein Konto: die Route prueft, und der DB-Unique-Index
//     (0085, lower(email)) schliesst das Wettlauf-Loch (23505 -> 409).
//   * Service-Mode: der Aufrufer hat noch keine Identitaet; Konto + Profil
//     entstehen in EINER Transaktion (kein halbes Konto).
// ---------------------------------------------------------------------------
const registerBodySchema = z
  .object({
    email: z.string().email(),
    password: z.string().min(8, 'Mindestens 8 Zeichen.').max(200),
    display_name: z.string().trim().min(1).max(120),
  })
  .openapi('RegisterRequest');

authLoginRouter.openapi(
  createRoute({
    method: 'post',
    path: '/auth/register',
    tags: ['auth'],
    summary: 'Register a new account with email + password',
    description:
      'Unauthenticated. Creates an account (auth.users + profile) and returns an access token with ' +
      'the same shape as /auth/login. The caller is signed in immediately and can then create or join ' +
      'a club. Fails with 409 if the email is already registered.',
    request: {
      body: { content: { 'application/json': { schema: registerBodySchema } }, required: true },
    },
    responses: {
      200: jsonContent(loginResponseSchema, 'Access token + minimal profile'),
      400: jsonContent(problemSchema, 'Invalid registration data'),
      409: jsonContent(problemSchema, 'Email already registered'),
      429: jsonContent(problemSchema, 'Too many attempts'),
    },
  }),
  async (c) => {
    const { auth } = getConfig();
    const raw: unknown = await c.req.json().catch(() => undefined);
    const parsed = registerBodySchema.safeParse(raw);
    if (!parsed.success) {
      throw problem(400, 'Bad Request', 'Ungültige Registrierungsdaten. / Invalid registration data.');
    }
    const email = parsed.data.email.trim().toLowerCase();
    const displayName = parsed.data.display_name.trim();

    // Konto-Spam bremsen: IP breit, E-Mail gezielt.
    await enforceRateLimits(c, [
      { scope: 'ip', identifier: clientIp(c), limit: 10, window: '1 hour' },
      { scope: 'account', identifier: email, limit: 5, window: '1 hour' },
    ]);

    const passwordHash = hashPassword(parsed.data.password);

    let userId: string;
    try {
      userId = await withServiceRole('register account', async (tx) => {
        const rows = (await tx`
          insert into auth.users (id, email, password_hash, raw_app_meta_data, raw_user_meta_data)
          values (app.uuid_v7(), ${email}, ${passwordHash}, '{}'::jsonb,
                  jsonb_build_object('display_name', ${displayName}::text))
          returning id`) as { id: string }[];
        const id = rows[0]!.id;
        await tx`insert into app.profiles (id, display_name, locale)
                 values (${id}, ${displayName}, 'de')`;
        return id;
      });
    } catch (e) {
      // Unique-Verletzung (lower(email)) = Adresse existiert schon.
      if (e && typeof e === 'object' && 'code' in e && (e as { code?: string }).code === '23505') {
        throw problem(409, 'Conflict', 'Diese E-Mail ist bereits registriert. / This email is already registered.');
      }
      throw e;
    }

    const claims: Record<string, unknown> = {
      sub: userId,
      role: 'authenticated',
      club_roles: {},
    };
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
        profile: { sub: userId, email, is_platform_admin: false },
      },
      200,
    );
  },
);
