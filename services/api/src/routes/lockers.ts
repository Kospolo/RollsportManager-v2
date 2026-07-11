// ============================================================================
// routes/lockers.ts - "Schließfächer" (v1 schliessfaecher.html).
//
// Privacy-Härtung (0021): a member SEES only their OWN locker (RLS), and only
// owner/admin/treasurer may see the whole wall or MANAGE lockers. Moderator and
// coach can neither see nor manage lockers. Managing = create/edit/delete AND
// assign/release, all gated to LOCKER_MANAGE_ROLES (owner/admin/treasurer) at
// the API layer; the DB backs this with the lockers RLS policies + the
// protect_locker trigger (migration 0021).
//
// status enum: free / assigned / broken. assign -> status='assigned' + member,
// release -> status='free' + null. Deletes are SOFT (deleted_at).
// ============================================================================

import { createRoute, z } from '@hono/zod-openapi';
import { createRouter, errorResponses, jsonContent } from '../lib/openapi.js';
import {
  deletedSchema,
  lockerAssignSchema,
  lockerCreateSchema,
  lockerSchema,
  lockerUpdateSchema,
  uuid,
} from '../lib/validation.js';
import { withUser } from '../db.js';
import type { Tx } from '../db.js';
import { problem } from '../middleware/error.js';
import { LOCKER_MANAGE_ROLES, requireClubMember, requireClubRole } from '../lib/guards.js';

export const lockersRouter = createRouter();

const lockerIdParam = z.object({
  lockerId: uuid.openapi({ param: { name: 'lockerId', in: 'path' } }),
});

/** Load a locker row or 404 when invisible/absent. */
async function loadLocker(tx: Tx, lockerId: string): Promise<{ id: string; club_id: string }> {
  const rows = await tx`
    select id, club_id from app.lockers
    where id = ${lockerId} and deleted_at is null`;
  const row = rows[0];
  if (!row) throw problem(404, 'Not Found', 'Locker not found');
  return row as { id: string; club_id: string };
}

/** Verify a member id belongs to the club (active roster row). */
async function assertClubMemberId(tx: Tx, clubId: string, memberId: string): Promise<void> {
  const rows = await tx`
    select 1 from app.club_members
    where id = ${memberId} and club_id = ${clubId} and deleted_at is null`;
  if (rows.length === 0) throw problem(400, 'Bad Request', 'member_id is not a member of this club');
}

lockersRouter.openapi(
  createRoute({
    method: 'get',
    path: '/lockers',
    tags: ['lockers'],
    summary: 'List club lockers (is_club_member)',
    security: [{ bearerAuth: [] }],
    request: { query: z.object({ club_id: uuid }) },
    responses: {
      200: jsonContent(z.array(lockerSchema), 'Lockers visible to the caller'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const { club_id } = c.req.valid('query');
    requireClubMember(c.get('claims'), club_id);
    const rows = await withUser(c.get('claims'), (tx) =>
      tx`select * from app.lockers
         where club_id = ${club_id} and deleted_at is null
         order by label`,
    );
    return c.json(z.array(lockerSchema).parse(rows), 200);
  },
);

lockersRouter.openapi(
  createRoute({
    method: 'post',
    path: '/lockers',
    tags: ['lockers'],
    summary: 'Create a locker (owner/admin/treasurer)',
    security: [{ bearerAuth: [] }],
    request: {
      body: { content: { 'application/json': { schema: lockerCreateSchema } }, required: true },
    },
    responses: {
      201: jsonContent(lockerSchema, 'Created locker'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const body = c.req.valid('json');
    const claims = c.get('claims');
    requireClubRole(claims, body.club_id, LOCKER_MANAGE_ROLES);

    const created = await withUser(claims, async (tx) => {
      if (body.assigned_member_id) await assertClubMemberId(tx, body.club_id, body.assigned_member_id);
      const rows = await tx`
        insert into app.lockers (club_id, label, location, status, assigned_member_id, note)
        values (${body.club_id}, ${body.label}, ${body.location ?? null}, ${body.status},
                ${body.assigned_member_id ?? null}, ${body.note ?? null})
        returning *`;
      return rows[0];
    });
    return c.json(lockerSchema.parse(created), 201);
  },
);

lockersRouter.openapi(
  createRoute({
    method: 'patch',
    path: '/lockers/{lockerId}',
    tags: ['lockers'],
    summary: 'Edit a locker master data (owner/admin/treasurer)',
    security: [{ bearerAuth: [] }],
    request: {
      params: lockerIdParam,
      body: { content: { 'application/json': { schema: lockerUpdateSchema } }, required: true },
    },
    responses: {
      200: jsonContent(lockerSchema, 'Updated locker'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const { lockerId } = c.req.valid('param');
    const body = c.req.valid('json');
    const claims = c.get('claims');

    const updated = await withUser(claims, async (tx) => {
      const locker = await loadLocker(tx, lockerId);
      requireClubRole(claims, locker.club_id, LOCKER_MANAGE_ROLES);
      if (body.assigned_member_id) await assertClubMemberId(tx, locker.club_id, body.assigned_member_id);
      const rows = await tx`
        update app.lockers set ${tx(body)}
        where id = ${lockerId} and deleted_at is null
        returning *`;
      if (rows.length === 0) throw problem(403, 'Forbidden', 'Editing a locker requires a club admin');
      return rows[0];
    });
    return c.json(lockerSchema.parse(updated), 200);
  },
);

lockersRouter.openapi(
  createRoute({
    method: 'delete',
    path: '/lockers/{lockerId}',
    tags: ['lockers'],
    summary: 'Soft-delete a locker (owner/admin/treasurer)',
    security: [{ bearerAuth: [] }],
    request: { params: lockerIdParam },
    responses: {
      200: jsonContent(deletedSchema, 'Locker soft-deleted'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const { lockerId } = c.req.valid('param');
    const claims = c.get('claims');

    await withUser(claims, async (tx) => {
      const locker = await loadLocker(tx, lockerId);
      requireClubRole(claims, locker.club_id, LOCKER_MANAGE_ROLES);
      const rows = await tx`
        update app.lockers set deleted_at = now()
        where id = ${lockerId} and deleted_at is null
        returning id`;
      if (rows.length === 0) throw problem(403, 'Forbidden', 'Deleting a locker requires a club admin');
    });
    return c.json({ status: 'deleted' as const, id: lockerId }, 200);
  },
);

lockersRouter.openapi(
  createRoute({
    method: 'patch',
    path: '/lockers/{lockerId}/assign',
    tags: ['lockers'],
    summary: 'Assign a locker to a member (owner/admin/treasurer)',
    security: [{ bearerAuth: [] }],
    request: {
      params: lockerIdParam,
      body: { content: { 'application/json': { schema: lockerAssignSchema } }, required: true },
    },
    responses: {
      200: jsonContent(lockerSchema, 'Locker assigned (status=assigned)'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const { lockerId } = c.req.valid('param');
    const { member_id } = c.req.valid('json');
    const claims = c.get('claims');

    const updated = await withUser(claims, async (tx) => {
      const locker = await loadLocker(tx, lockerId);
      requireClubRole(claims, locker.club_id, LOCKER_MANAGE_ROLES);
      await assertClubMemberId(tx, locker.club_id, member_id);
      const rows = await tx`
        update app.lockers
        set status = 'assigned', assigned_member_id = ${member_id}
        where id = ${lockerId} and deleted_at is null
        returning *`;
      if (rows.length === 0) throw problem(403, 'Forbidden', 'Assigning a locker requires a coaching role');
      return rows[0];
    });
    return c.json(lockerSchema.parse(updated), 200);
  },
);

lockersRouter.openapi(
  createRoute({
    method: 'patch',
    path: '/lockers/{lockerId}/release',
    tags: ['lockers'],
    summary: 'Release a locker (owner/admin/treasurer)',
    security: [{ bearerAuth: [] }],
    request: { params: lockerIdParam },
    responses: {
      200: jsonContent(lockerSchema, 'Locker released (status=free, no member)'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const { lockerId } = c.req.valid('param');
    const claims = c.get('claims');

    const updated = await withUser(claims, async (tx) => {
      const locker = await loadLocker(tx, lockerId);
      requireClubRole(claims, locker.club_id, LOCKER_MANAGE_ROLES);
      const rows = await tx`
        update app.lockers
        set status = 'free', assigned_member_id = null
        where id = ${lockerId} and deleted_at is null
        returning *`;
      if (rows.length === 0) throw problem(403, 'Forbidden', 'Releasing a locker requires a coaching role');
      return rows[0];
    });
    return c.json(lockerSchema.parse(updated), 200);
  },
);
