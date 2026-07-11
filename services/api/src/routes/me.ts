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

import { createRoute } from '@hono/zod-openapi';
import { createRouter, errorResponses, jsonContent } from '../lib/openapi.js';
import {
  meSchema,
  meUpdateSchema,
  userPreferencesSchema,
  userPreferencesUpdateSchema,
} from '../lib/validation.js';
import { withUser } from '../db.js';
import type { Tx } from '../db.js';
import { problem } from '../middleware/error.js';
import { avatarUrlFor } from '../lib/avatar.js';

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
           m.first_name, m.last_name, m.email, m.birth_date, m.role, m.status,
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
