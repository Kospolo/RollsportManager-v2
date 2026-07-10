// ============================================================================
// routes/platform.ts - PLATFORM (super_admin) read console. Cross-club.
//
// Access: is_platform_admin ONLY (a JWT claim, not a club role) - every other
// caller gets 403. Reads run in SERVICE MODE: the platform admin has no `sub`
// membership rows, and app.profiles is own-row under RLS, so a cross-club
// aggregate cannot be served under the caller's own claims. This matches the
// Blueprint rule "platform-level writes go via service_role (auth.uid() null)";
// here it is read-only, and the API guard (requirePlatformAdmin) is the sole
// authorization - stated as the service-mode reason for the audit log.
// ============================================================================

import { createRoute, z } from '@hono/zod-openapi';
import { createRouter, errorResponses, jsonContent } from '../lib/openapi.js';
import {
  platformClubSchema,
  platformStatsSchema,
  platformUserSchema,
} from '../lib/validation.js';
import { withServiceRole } from '../db.js';
import { requirePlatformAdmin } from '../lib/guards.js';

export const platformRouter = createRouter();

platformRouter.openapi(
  createRoute({
    method: 'get',
    path: '/platform/clubs',
    tags: ['platform'],
    summary: 'All clubs incl. member count (platform admin only)',
    security: [{ bearerAuth: [] }],
    responses: {
      200: jsonContent(z.array(platformClubSchema), 'All non-deleted clubs'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const claims = c.get('claims');
    requirePlatformAdmin(claims);
    const rows = await withServiceRole(`platform-admin clubs overview (caller ${claims.sub})`, (tx) =>
      tx`select c.id, c.name, c.short_name, c.city, c.discipline, c.created_at,
           (select count(*) from app.club_members m
            where m.club_id = c.id and m.deleted_at is null and m.status = 'active')::int as member_count
         from app.clubs c
         where c.deleted_at is null
         order by c.name`,
    );
    return c.json(z.array(platformClubSchema).parse(rows), 200);
  },
);

platformRouter.openapi(
  createRoute({
    method: 'get',
    path: '/platform/users',
    tags: ['platform'],
    summary: 'All user profiles incl. club count (platform admin only)',
    security: [{ bearerAuth: [] }],
    responses: {
      200: jsonContent(z.array(platformUserSchema), 'All non-deleted profiles'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const claims = c.get('claims');
    requirePlatformAdmin(claims);
    const rows = await withServiceRole(`platform-admin users overview (caller ${claims.sub})`, (tx) =>
      tx`select p.id, p.display_name, p.locale, p.created_at,
           (select count(distinct m.club_id) from app.club_members m
            where m.profile_id = p.id and m.deleted_at is null)::int as club_count
         from app.profiles p
         where p.deleted_at is null
         order by p.display_name nulls last, p.id`,
    );
    return c.json(z.array(platformUserSchema).parse(rows), 200);
  },
);

platformRouter.openapi(
  createRoute({
    method: 'get',
    path: '/platform/stats',
    tags: ['platform'],
    summary: 'Platform key figures (platform admin only)',
    security: [{ bearerAuth: [] }],
    responses: {
      200: jsonContent(platformStatsSchema, 'Aggregate counts across all clubs'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const claims = c.get('claims');
    requirePlatformAdmin(claims);
    const rows = await withServiceRole(`platform-admin stats (caller ${claims.sub})`, (tx) =>
      tx`select
           (select count(*) from app.clubs where deleted_at is null)::int as clubs,
           (select count(*) from app.profiles where deleted_at is null)::int as users,
           (select count(*) from app.club_members where deleted_at is null)::int as members,
           (select count(*) from app.club_members where deleted_at is null and status = 'active')::int as active_members,
           (select count(*) from app.teams where deleted_at is null)::int as teams,
           (select count(*) from app.events where deleted_at is null)::int as events,
           (select count(*) from app.invoices where status = 'open')::int as open_invoices`,
    );
    return c.json(platformStatsSchema.parse(rows[0]), 200);
  },
);
