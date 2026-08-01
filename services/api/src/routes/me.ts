// ============================================================================
// routes/me.ts - the app-shell "self" surface (Referenz §3.2 profile /
// *-settings; v1 profile.html, settings.html, notification-settings.html).
//
// Everything here is STRICTLY self-scoped and enforced server-side:
//   * GET  /me              - the caller's profile + their own memberships.
//   * PATCH /me             - edit the caller's OWN master data (name/e-mail/
//                             birth date). member_id = self is forced by the
//                             WHERE profile_id = auth.uid() clause; role/status
//                             are NOT editable here (the protect_club_membership
//                             trigger blocks any self-change to them anyway).
//   * GET  /me/preferences  - the caller's shell preferences (locale/theme/
//                             notifications), defaulted when no row exists yet.
//   * PATCH /me/preferences - upsert them (notifications deep-merged).
//
// All statements run through withUser (src/db.ts) so RLS applies: a member only
// ever touches their own club_members rows and their own user_preferences row.
// ============================================================================

import { createRoute, z } from '@hono/zod-openapi';
import { createRouter, errorResponses, jsonContent } from '../lib/openapi.js';
import {
  capabilityResolutionSchema,
  meSchema,
  meUpdateSchema,
  problemSchema,
  userPreferencesSchema,
  userPreferencesUpdateSchema,
} from '../lib/validation.js';
import { withUser, withServiceRole } from '../db.js';
import type { Tx } from '../db.js';
import { problem } from '../middleware/error.js';
import { avatarUrlFor } from '../lib/avatar.js';
import { capsFor } from '../lib/capabilities.js';
import { isPlatformAdmin } from '../lib/guards.js';
import { operatorMay } from '../lib/operator-capabilities.js';

export const meRouter = createRouter();

/** Assemble the /me view (profile + own memberships) for one user. */
async function loadMe(tx: Tx, profileId: string): Promise<unknown> {
  const profiles = await tx`
    select id, display_name, locale
    from app.profiles
    where id = ${profileId} and deleted_at is null`;
  const profile = profiles[0];
  if (!profile) throw problem(404, 'Not Found', 'Profile not found');

  const memberships = await tx`
    select m.id, m.club_id, c.name as club_name, c.short_name as club_short_name,
           m.first_name, m.last_name, m.email, m.birth_date,
           m.phone, m.postal_address, m.role, m.status,
           m.joined_on, m.valid_until, m.avatar_key, m.created_at, m.updated_at
    from app.club_members m
    join app.clubs c on c.id = m.club_id and c.deleted_at is null
    where m.profile_id = ${profileId} and m.deleted_at is null
    order by c.name`;

  return {
    profile_id: profile['id'],
    display_name: profile['display_name'],
    locale: profile['locale'],
    memberships: memberships.map((m) => ({
      ...m,
      avatar_url: avatarUrlFor((m['avatar_key'] as string | null) ?? null),
    })),
  };
}

meRouter.openapi(
  createRoute({
    method: 'get',
    path: '/me',
    tags: ['me'],
    summary: 'The logged-in user: profile + their own club memberships',
    security: [{ bearerAuth: [] }],
    responses: {
      200: jsonContent(meSchema, 'The caller\'s identity across the app'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const claims = c.get('claims');
    const me = await withUser(claims, (tx) => loadMe(tx, claims.sub));
    return c.json(meSchema.parse(me), 200);
  },
);

meRouter.openapi(
  createRoute({
    method: 'patch',
    path: '/me',
    tags: ['me'],
    summary: 'Edit the caller\'s OWN master data (never role/status)',
    description:
      'Updates first/last name, e-mail and birth date on the caller\'s own membership row(s). ' +
      'member_id = self is enforced server-side (WHERE profile_id = auth.uid()); a member may do ' +
      'this without can_manage_members. Role, status and validity are deliberately NOT editable ' +
      'here - the protect_club_membership trigger rejects any self-change to them.',
    security: [{ bearerAuth: [] }],
    request: {
      body: { content: { 'application/json': { schema: meUpdateSchema } }, required: true },
    },
    responses: {
      200: jsonContent(meSchema, 'The updated identity view'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const claims = c.get('claims');
    const body = c.req.valid('json');
    const me = await withUser(claims, async (tx) => {
      // Self only: RLS (club_members_update_self) + this WHERE both pin the row
      // to the caller. No caller-supplied id is ever trusted.
      const rows = await tx`
        update app.club_members set ${tx(body)}
        where profile_id = ${claims.sub} and deleted_at is null
        returning id`;
      if (rows.length === 0) {
        throw problem(404, 'Not Found', 'No editable membership for the current user');
      }
      return loadMe(tx, claims.sub);
    });
    return c.json(meSchema.parse(me), 200);
  },
);

// ---------------------------------------------------------------------------
// DELETE /me — das eigene Konto UNWIDERRUFLICH loeschen (App-Store 5.1.1(v),
// DSGVO Art. 17). Loescht auth.users (Kaskade auf Profil, Notizen, Einstellungen,
// Einwilligungen-als-Subjekt, Reset-Token) und anonymisiert vorher die PII der
// eigenen Mitgliedschaften; der Verein behaelt eine ENTKOPPELTE, namenlose Zeile
// (0087 stellte die zwei RESTRICT-FKs auf SET NULL). BLOCKIERT (409), wenn die
// Person ALLEINIGER aktiver Inhaber eines Vereins ist.
// ---------------------------------------------------------------------------
const accountDeletedSchema = z
  .object({ ok: z.literal(true) })
  .openapi('AccountDeleted');

meRouter.openapi(
  createRoute({
    method: 'delete',
    path: '/me',
    tags: ['me'],
    summary: 'Delete the caller\'s own account (irreversible)',
    description:
      'Loescht das eigene Konto unwiderruflich (Apple 5.1.1(v) / DSGVO Art. 17). 409, wenn die Person ' +
      'alleiniger aktiver Inhaber eines Vereins ist — erst Inhaberschaft uebertragen oder Verein loeschen.',
    security: [{ bearerAuth: [] }],
    responses: {
      200: jsonContent(accountDeletedSchema, 'Account deleted'),
      409: jsonContent(problemSchema, 'Sole owner of a club — transfer or delete it first'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const sub = c.get('claims').sub;

    // 1) Alleiniger-Inhaber-Schutz. Service-Mode, weil ALLE Inhaber gezaehlt
    //    werden muessen (nicht nur die RLS-sichtbaren).
    const soleOwner = await withServiceRole('account delete: sole-owner check', async (tx) => {
      return (await tx`
        select c.name
          from app.clubs c
         where c.deleted_at is null
           and exists (
             select 1 from app.club_members m
              where m.club_id = c.id and m.profile_id = ${sub}
                and m.role = 'owner' and m.status = 'active' and m.deleted_at is null)
           and (
             select count(*) from app.club_members m2
              where m2.club_id = c.id and m2.role = 'owner'
                and m2.status = 'active' and m2.deleted_at is null) = 1
      `) as { name: string }[];
    });
    if (soleOwner.length > 0) {
      const names = soleOwner.map((r) => r.name).join(', ');
      throw problem(
        409,
        'Conflict',
        `Du bist alleiniger Inhaber von: ${names}. Übertrage zuerst die Inhaberschaft oder lösche den Verein. / You are the sole owner of: ${names}. Transfer ownership or delete the club first.`,
      );
    }

    // 2) PII in den eigenen Mitgliedschaften anonymisieren, dann Konto loeschen.
    //    Eine Transaktion; der Rest raeumt sich per Kaskade/SET NULL.
    await withServiceRole('account delete', async (tx) => {
      await tx`
        update app.club_members
           set first_name = '(gelöscht)', last_name = '', email = null,
               phone = null, postal_address = null, birth_date = null
         where profile_id = ${sub}`;
      await tx`delete from auth.users where id = ${sub}`;
    });

    return c.json({ ok: true as const }, 200);
  },
);

meRouter.openapi(
  createRoute({
    method: 'get',
    path: '/me/preferences',
    tags: ['me'],
    summary: 'The caller\'s app-shell preferences (locale/theme/notifications)',
    security: [{ bearerAuth: [] }],
    responses: {
      200: jsonContent(userPreferencesSchema, 'Preferences (defaults when none stored yet)'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const claims = c.get('claims');
    const rows = await withUser(claims, (tx) =>
      tx`select profile_id, locale, theme, notifications, updated_at
         from app.user_preferences
         where profile_id = ${claims.sub}`,
    );
    // No row yet -> sensible defaults (never write on a read).
    const prefs = rows[0] ?? {
      profile_id: claims.sub,
      locale: 'de',
      theme: 'auto',
      notifications: {},
      updated_at: new Date().toISOString(),
    };
    return c.json(userPreferencesSchema.parse(prefs), 200);
  },
);

meRouter.openapi(
  createRoute({
    method: 'patch',
    path: '/me/preferences',
    tags: ['me'],
    summary: 'Upsert the caller\'s preferences (notifications deep-merged)',
    security: [{ bearerAuth: [] }],
    request: {
      body: { content: { 'application/json': { schema: userPreferencesUpdateSchema } }, required: true },
    },
    responses: {
      200: jsonContent(userPreferencesSchema, 'The stored preferences'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const claims = c.get('claims');
    const body = c.req.valid('json');
    const updated = await withUser(claims, (tx) =>
      // WITH CHECK profile_id = auth.uid() (RLS user_preferences_insert/update)
      // matches claims.sub; notifications are jsonb-merged (object || object,
      // right wins) so a partial PATCH keeps untouched flags. tx.json binds the
      // value as real jsonb (a plain string param would double-encode).
      tx`insert into app.user_preferences (profile_id, locale, theme, notifications)
         values (${claims.sub}, ${body.locale ?? 'de'}, ${body.theme ?? 'auto'},
                 ${tx.json(body.notifications ?? {})})
         on conflict (profile_id) do update set
           locale        = coalesce(${body.locale ?? null}, app.user_preferences.locale),
           theme         = coalesce(${body.theme ?? null}, app.user_preferences.theme),
           notifications = app.user_preferences.notifications || ${tx.json(body.notifications ?? {})}
         returning profile_id, locale, theme, notifications, updated_at`,
    );
    return c.json(userPreferencesSchema.parse(updated[0]), 200);
  },
);

// ---------------------------------------------------------------------------
// GET /me/capabilities — die aufgeloesten Rechte fuer das UI-Gating (§6).
//
// ### Der erste Endpunkt, der die 0025-Zusage auch API-seitig einloest ###
// Die Autorisierung kommt hier aus der DATENBANK, nicht aus dem Claim:
//   * MEHRFACHROLLEN wirken (Rechte = Vereinigung ueber alle Rollen)
//   * Aenderungen wirken SOFORT, ohne Re-Login (kein Token-Roundtrip)
//   * der Mitgliedschafts-Gate (deleted_at/status/valid_until) greift
// Deshalb wird die Mitgliedschaft NICHT ueber requireClubMember(claims, ...)
// geprueft — das laese einen Token durch, dessen Mitgliedschaft laengst
// erloschen ist. Massgeblich ist roleKeys aus app.member_role_keys.
//
// Plattform-Admins haben bewusst KEINEN Fähigkeiten-Bypass (0025:219-222,
// fixiert durch 90_roles_matrix.sql:148): sie duerfen den Verein lesen, bekommen
// aber keine Vereinsrechte. Sie erhalten daher die Aufloesung (alle Raenge 0,
// solange sie kein Mitglied sind) statt eines 403 — das UI soll den Verein
// anzeigen koennen, nur eben ohne Schaltflaechen.
// ---------------------------------------------------------------------------
meRouter.openapi(
  createRoute({
    method: 'get',
    path: '/me/capabilities',
    tags: ['me'],
    summary: 'Die aufgeloesten Rechte der eingeloggten Person in einem Verein',
    description:
      'Loest die Rechte SERVERSEITIG aus der Datenbank auf (app.cap_ranks): Mehrfachrollen werden ' +
      'vereinigt (hoechste Stufe je Faehigkeit gewinnt) und Aenderungen wirken sofort, ohne neuen ' +
      'Token. Liefert den vollstaendigen Faehigkeiten-Katalog inkl. bilingualer Labels und der im ' +
      'Admin waehlbaren Stufen — auch dort, wo der Rang 0 ist. ' +
      'HINWEIS fuer Clients: was eine Stufe WIRKLICH bewirkt, steht je Faehigkeit in `enforcement` ' +
      '(0033) — nur bei "enforced" entzieht die Stufe "none" auch den LESEZUGRIFF. Bei "partial" ' +
      '(finance, member_contact) wirkt sie nur auf einen Teil des Lesens, bei "write_only" nur auf ' +
      'das Schreiben, bei "unenforced" auf nichts. "none" darf deshalb NICHT pauschal als ' +
      '"abgeschaltet" beschriftet werden — das waere eine Zusage, die der Server nicht einloest.',
    security: [{ bearerAuth: [] }],
    request: {
      query: z.object({ club_id: z.string().uuid() }),
    },
    responses: {
      200: jsonContent(capabilityResolutionSchema, 'Die aufgeloesten Rechte im Verein'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const claims = c.get('claims');
    const { club_id } = c.req.valid('query');
    const caps = await capsFor(c, club_id);
    const platformAdmin = isPlatformAdmin(claims);

    // Autorisierung aus der DB, NICHT aus dem Claim.
    // 0075: der Durchlass fuer den Betreiber haengt an der EINGESCHALTETEN,
    // protokollierten Einsicht plus der freigegebenen Faehigkeit 'members' —
    // nicht mehr am blossen Claim. Die ausgelieferten Faehigkeiten selbst kommen
    // ohnehin aus app.cap_rank und sind seit 0074 zweckgebunden.
    if (caps.roleKeys.length === 0 && !operatorMay(claims, 'members')) {
      throw problem(
        403,
        'Forbidden',
        'Keine aktive Mitgliedschaft in diesem Verein. / No active membership in this club.',
      );
    }

    return c.json(
      capabilityResolutionSchema.parse({
        club_id,
        role_keys: caps.roleKeys,
        is_platform_admin: platformAdmin,
        capabilities: caps.caps,
      }),
      200,
    );
  },
);
