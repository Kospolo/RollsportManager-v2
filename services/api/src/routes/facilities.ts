// ============================================================================
// routes/facilities.ts - halls, rooms & outdoor areas ("Belegungsplan",
// v1 facilities.html). Read: every club member (is_club_member). Write:
// coaching staff (is_club_trainer). Deletes are SOFT; the RLS update policy
// backs the API role guard (Blueprint risk #16).
// ============================================================================

import { createRoute, z } from '@hono/zod-openapi';
import { createRouter, errorResponses, jsonContent } from '../lib/openapi.js';
import {
  deletedSchema,
  facilityCreateSchema,
  facilitySchema,
  facilityUpdateSchema,
  uuid,
} from '../lib/validation.js';
import { withUser } from '../db.js';
import type { Tx } from '../db.js';
import { problem } from '../middleware/error.js';
import { COACH_ROLES, requireClubMember, requireClubRole } from '../lib/guards.js';

export const facilitiesRouter = createRouter();

const facilityIdParam = z.object({
  facilityId: uuid.openapi({ param: { name: 'facilityId', in: 'path' } }),
});

async function loadFacility(tx: Tx, facilityId: string): Promise<{ id: string; club_id: string }> {
  const rows = await tx`
    select id, club_id from app.facilities
    where id = ${facilityId} and deleted_at is null`;
  const row = rows[0];
  if (!row) throw problem(404, 'Not Found', 'Facility not found');
  return row as { id: string; club_id: string };
}

facilitiesRouter.openapi(
  createRoute({
    method: 'get',
    path: '/facilities',
    tags: ['facilities'],
    summary: 'List facilities of a club',
    security: [{ bearerAuth: [] }],
    request: { query: z.object({ club_id: uuid }) },
    responses: {
      200: jsonContent(z.array(facilitySchema), 'Facilities visible to the caller'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const { club_id } = c.req.valid('query');
    requireClubMember(c.get('claims'), club_id);
    const rows = await withUser(c.get('claims'), (tx) =>
      tx`select * from app.facilities
         where club_id = ${club_id} and deleted_at is null
         order by name`,
    );
    return c.json(z.array(facilitySchema).parse(rows), 200);
  },
);

facilitiesRouter.openapi(
  createRoute({
    method: 'post',
    path: '/facilities',
    tags: ['facilities'],
    summary: 'Create a facility (coaching staff, is_club_trainer)',
    security: [{ bearerAuth: [] }],
    request: {
      body: { content: { 'application/json': { schema: facilityCreateSchema } }, required: true },
    },
    responses: {
      201: jsonContent(facilitySchema, 'Created facility'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const body = c.req.valid('json');
    const claims = c.get('claims');
    requireClubRole(claims, body.club_id, COACH_ROLES);

    const created = await withUser(claims, async (tx) => {
      const rows = await tx`
        insert into app.facilities (club_id, name, kind, address, capacity, notes)
        values (${body.club_id}, ${body.name}, ${body.kind}, ${body.address ?? null},
                ${body.capacity ?? null}, ${body.notes ?? null})
        returning *`;
      return rows[0];
    });
    return c.json(facilitySchema.parse(created), 201);
  },
);

facilitiesRouter.openapi(
  createRoute({
    method: 'patch',
    path: '/facilities/{facilityId}',
    tags: ['facilities'],
    summary: 'Edit a facility (coaching staff, is_club_trainer)',
    security: [{ bearerAuth: [] }],
    request: {
      params: facilityIdParam,
      body: { content: { 'application/json': { schema: facilityUpdateSchema } }, required: true },
    },
    responses: {
      200: jsonContent(facilitySchema, 'Updated facility'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const { facilityId } = c.req.valid('param');
    const body = c.req.valid('json');
    const claims = c.get('claims');

    const updated = await withUser(claims, async (tx) => {
      const facility = await loadFacility(tx, facilityId);
      requireClubRole(claims, facility.club_id, COACH_ROLES);
      const rows = await tx`
        update app.facilities set ${tx(body)}
        where id = ${facilityId} and deleted_at is null
        returning *`;
      if (rows.length === 0) throw problem(403, 'Forbidden', 'Editing facilities requires a coaching role');
      return rows[0];
    });
    return c.json(facilitySchema.parse(updated), 200);
  },
);

facilitiesRouter.openapi(
  createRoute({
    method: 'delete',
    path: '/facilities/{facilityId}',
    tags: ['facilities'],
    summary: 'Soft-delete a facility (coaching staff, is_club_trainer)',
    security: [{ bearerAuth: [] }],
    request: { params: facilityIdParam },
    responses: {
      200: jsonContent(deletedSchema, 'Facility soft-deleted'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const { facilityId } = c.req.valid('param');
    const claims = c.get('claims');

    await withUser(claims, async (tx) => {
      const facility = await loadFacility(tx, facilityId);
      requireClubRole(claims, facility.club_id, COACH_ROLES);
      const rows = await tx`
        update app.facilities set deleted_at = now()
        where id = ${facilityId} and deleted_at is null
        returning id`;
      if (rows.length === 0) throw problem(403, 'Forbidden', 'Deleting facilities requires a coaching role');
    });
    return c.json({ status: 'deleted' as const, id: facilityId }, 200);
  },
);
