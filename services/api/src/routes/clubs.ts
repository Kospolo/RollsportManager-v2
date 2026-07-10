// ============================================================================
// routes/clubs.ts - read own clubs, update own club (owner/admin).
// Club creation/deletion are deliberate API-less for Phase 1 (onboarding flow
// comes with the portal phase).
// ============================================================================

import { createRoute, z } from '@hono/zod-openapi';
import { createRouter, errorResponses, jsonContent } from '../lib/openapi.js';
import { clubSchema, clubUpdateSchema, uuid } from '../lib/validation.js';
import { withUser } from '../db.js';
import { problem } from '../middleware/error.js';
import { ADMIN_ROLES, requireClubMember, requireClubRole } from '../lib/guards.js';

export const clubsRouter = createRouter();

const clubIdParam = z.object({ clubId: uuid.openapi({ param: { name: 'clubId', in: 'path' } }) });

clubsRouter.openapi(
  createRoute({
    method: 'get',
    path: '/clubs',
    tags: ['clubs'],
    summary: 'List clubs of the current user (RLS-scoped)',
    security: [{ bearerAuth: [] }],
    responses: {
      200: jsonContent(z.array(clubSchema), 'Clubs the caller is a member of'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const rows = await withUser(c.get('claims'), (tx) =>
      tx`select * from app.clubs where deleted_at is null order by name`,
    );
    return c.json(z.array(clubSchema).parse(rows), 200);
  },
);

clubsRouter.openapi(
  createRoute({
    method: 'get',
    path: '/clubs/{clubId}',
    tags: ['clubs'],
    summary: 'Get a single club',
    security: [{ bearerAuth: [] }],
    request: { params: clubIdParam },
    responses: {
      200: jsonContent(clubSchema, 'The club'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const { clubId } = c.req.valid('param');
    requireClubMember(c.get('claims'), clubId);
    const rows = await withUser(c.get('claims'), (tx) =>
      tx`select * from app.clubs where id = ${clubId} and deleted_at is null`,
    );
    if (rows.length === 0) throw problem(404, 'Not Found', 'Club not found');
    return c.json(clubSchema.parse(rows[0]), 200);
  },
);

clubsRouter.openapi(
  createRoute({
    method: 'patch',
    path: '/clubs/{clubId}',
    tags: ['clubs'],
    summary: 'Update own club (owner/admin)',
    security: [{ bearerAuth: [] }],
    request: {
      params: clubIdParam,
      body: { content: { 'application/json': { schema: clubUpdateSchema } }, required: true },
    },
    responses: {
      200: jsonContent(clubSchema, 'Updated club'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const { clubId } = c.req.valid('param');
    const body = c.req.valid('json');
    requireClubRole(c.get('claims'), clubId, ADMIN_ROLES);

    const patch: Record<string, unknown> = { ...body };
    if (patch['settings'] !== undefined) patch['settings'] = JSON.stringify(patch['settings']);

    const rows = await withUser(c.get('claims'), (tx) =>
      tx`update app.clubs set ${tx(patch)}
         where id = ${clubId} and deleted_at is null
         returning *`,
    );
    if (rows.length === 0) throw problem(404, 'Not Found', 'Club not found');
    return c.json(clubSchema.parse(rows[0]), 200);
  },
);
