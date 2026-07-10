// ============================================================================
// routes/regional-events.ts - supra-regional events ("Events überregional",
// v1 events.html). Referenz 1.3: read = every club member (is_club_member),
// write = coaching staff (is_club_trainer). Deletes are SOFT (deleted_at); the
// RLS update policy is the second line of defense behind the API role guard.
// ============================================================================

import { createRoute, z } from '@hono/zod-openapi';
import { createRouter, errorResponses, jsonContent } from '../lib/openapi.js';
import {
  deletedSchema,
  regionalEventCreateSchema,
  regionalEventSchema,
  regionalEventUpdateSchema,
  uuid,
} from '../lib/validation.js';
import { withUser } from '../db.js';
import type { Tx } from '../db.js';
import { problem } from '../middleware/error.js';
import { COACH_ROLES, requireClubMember, requireClubRole } from '../lib/guards.js';

export const regionalEventsRouter = createRouter();

const eventIdParam = z.object({
  eventId: uuid.openapi({ param: { name: 'eventId', in: 'path' } }),
});

/** Load a regional-event row (club_id) or 404 when invisible/absent. */
async function loadRegionalEvent(tx: Tx, eventId: string): Promise<{ id: string; club_id: string }> {
  const rows = await tx`
    select id, club_id from app.regional_events
    where id = ${eventId} and deleted_at is null`;
  const row = rows[0];
  if (!row) throw problem(404, 'Not Found', 'Regional event not found');
  return row as { id: string; club_id: string };
}

regionalEventsRouter.openapi(
  createRoute({
    method: 'get',
    path: '/regional-events',
    tags: ['regional-events'],
    summary: 'List supra-regional events (soonest first)',
    security: [{ bearerAuth: [] }],
    request: { query: z.object({ club_id: uuid }) },
    responses: {
      200: jsonContent(z.array(regionalEventSchema), 'Regional events visible to the caller'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const { club_id } = c.req.valid('query');
    requireClubMember(c.get('claims'), club_id);
    const rows = await withUser(c.get('claims'), (tx) =>
      tx`select * from app.regional_events
         where club_id = ${club_id} and deleted_at is null
         order by starts_on asc, created_at asc`,
    );
    return c.json(z.array(regionalEventSchema).parse(rows), 200);
  },
);

regionalEventsRouter.openapi(
  createRoute({
    method: 'post',
    path: '/regional-events',
    tags: ['regional-events'],
    summary: 'Create a regional event (coaching staff, is_club_trainer)',
    security: [{ bearerAuth: [] }],
    request: {
      body: { content: { 'application/json': { schema: regionalEventCreateSchema } }, required: true },
    },
    responses: {
      201: jsonContent(regionalEventSchema, 'Created regional event'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const body = c.req.valid('json');
    const claims = c.get('claims');
    requireClubRole(claims, body.club_id, COACH_ROLES);

    const created = await withUser(claims, async (tx) => {
      const rows = await tx`
        insert into app.regional_events
          (club_id, title, host_org, discipline, location, starts_on, ends_on,
           registration_url, description)
        values
          (${body.club_id}, ${body.title}, ${body.host_org ?? null},
           ${body.discipline ?? null}, ${body.location ?? null}, ${body.starts_on},
           ${body.ends_on ?? null}, ${body.registration_url ?? null},
           ${body.description ?? null})
        returning *`;
      return rows[0];
    });
    return c.json(regionalEventSchema.parse(created), 201);
  },
);

regionalEventsRouter.openapi(
  createRoute({
    method: 'patch',
    path: '/regional-events/{eventId}',
    tags: ['regional-events'],
    summary: 'Edit a regional event (coaching staff, is_club_trainer)',
    security: [{ bearerAuth: [] }],
    request: {
      params: eventIdParam,
      body: { content: { 'application/json': { schema: regionalEventUpdateSchema } }, required: true },
    },
    responses: {
      200: jsonContent(regionalEventSchema, 'Updated regional event'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const { eventId } = c.req.valid('param');
    const body = c.req.valid('json');
    const claims = c.get('claims');

    const updated = await withUser(claims, async (tx) => {
      const ev = await loadRegionalEvent(tx, eventId);
      requireClubRole(claims, ev.club_id, COACH_ROLES);
      const rows = await tx`
        update app.regional_events set ${tx(body)}
        where id = ${eventId} and deleted_at is null
        returning *`;
      if (rows.length === 0) throw problem(403, 'Forbidden', 'Editing a regional event requires a coaching role');
      return rows[0];
    });
    return c.json(regionalEventSchema.parse(updated), 200);
  },
);

regionalEventsRouter.openapi(
  createRoute({
    method: 'delete',
    path: '/regional-events/{eventId}',
    tags: ['regional-events'],
    summary: 'Soft-delete a regional event (coaching staff, is_club_trainer)',
    security: [{ bearerAuth: [] }],
    request: { params: eventIdParam },
    responses: {
      200: jsonContent(deletedSchema, 'Regional event soft-deleted'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const { eventId } = c.req.valid('param');
    const claims = c.get('claims');

    await withUser(claims, async (tx) => {
      const ev = await loadRegionalEvent(tx, eventId);
      requireClubRole(claims, ev.club_id, COACH_ROLES);
      const rows = await tx`
        update app.regional_events set deleted_at = now()
        where id = ${eventId} and deleted_at is null
        returning id`;
      if (rows.length === 0) throw problem(403, 'Forbidden', 'Deleting a regional event requires a coaching role');
    });
    return c.json({ status: 'deleted' as const, id: eventId }, 200);
  },
);
