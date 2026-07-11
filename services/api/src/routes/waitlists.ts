// ============================================================================
// routes/waitlists.ts - Wartelisten (Referenz §4 "Wartelisten", v1
// warteliste.html). A member queues themselves for a scarce resource
// (hall/room, equipment, team slot, event); a trainer manages everyone's.
//
//   GET    /waitlists?club_id[&kind]   own entries (+ all when trainer+).
//   POST   /waitlists                  self-join (member_id = self) OR trainer
//                                      queuing anyone.
//   PATCH  /waitlists/{id}             status/note - creator (own) OR trainer.
//   DELETE /waitlists/{id}             soft-delete - creator (own) OR trainer.
//
// Rights mirror the RLS (migration 0020): read/write = own row OR is_club_trainer.
// All statements run impersonated (withUser), so RLS is the second line of
// defense (Blueprint risk #16). Deletes are SOFT (deleted_at).
// ============================================================================

import { createRoute, z } from '@hono/zod-openapi';
import { createRouter, errorResponses, jsonContent } from '../lib/openapi.js';
import {
  deletedSchema,
  waitlistCreateSchema,
  waitlistKindSchema,
  waitlistSchema,
  waitlistUpdateSchema,
  uuid,
} from '../lib/validation.js';
import { withUser } from '../db.js';
import type { Tx } from '../db.js';
import { problem } from '../middleware/error.js';
import { COACH_ROLES, hasClubRole, requireClubMember } from '../lib/guards.js';
import { isOwnMember } from '../lib/ownership.js';

export const waitlistsRouter = createRouter();

const waitlistIdParam = z.object({
  waitlistId: uuid.openapi({ param: { name: 'waitlistId', in: 'path' } }),
});

async function loadWaitlist(
  tx: Tx,
  waitlistId: string,
): Promise<{ id: string; club_id: string; member_id: string }> {
  const rows = await tx`
    select id, club_id, member_id from app.waitlists
    where id = ${waitlistId} and deleted_at is null`;
  const row = rows[0];
  if (!row) throw problem(404, 'Not Found', 'Waitlist entry not found');
  return row as { id: string; club_id: string; member_id: string };
}

waitlistsRouter.openapi(
  createRoute({
    method: 'get',
    path: '/waitlists',
    tags: ['waitlists'],
    summary: 'List waitlist entries (own, or all when trainer+)',
    description:
      'RLS-scoped: a plain member sees only their OWN entries; a trainer/admin sees the whole club queue. ' +
      'Optionally filtered by kind (facility/equipment/team/event).',
    security: [{ bearerAuth: [] }],
    request: { query: z.object({ club_id: uuid, kind: waitlistKindSchema.optional() }) },
    responses: {
      200: jsonContent(z.array(waitlistSchema), 'Waitlist entries visible to the caller'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const { club_id, kind } = c.req.valid('query');
    requireClubMember(c.get('claims'), club_id);
    const rows = await withUser(c.get('claims'), (tx) =>
      tx`select * from app.waitlists
         where club_id = ${club_id} and deleted_at is null
           and (${kind ?? null}::text is null or kind = ${kind ?? null})
         order by created_at`,
    );
    return c.json(z.array(waitlistSchema).parse(rows), 200);
  },
);

waitlistsRouter.openapi(
  createRoute({
    method: 'post',
    path: '/waitlists',
    tags: ['waitlists'],
    summary: 'Join a waitlist (self, or a trainer queuing anyone)',
    security: [{ bearerAuth: [] }],
    request: {
      body: { content: { 'application/json': { schema: waitlistCreateSchema } }, required: true },
    },
    responses: {
      201: jsonContent(waitlistSchema, 'Created waitlist entry'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const body = c.req.valid('json');
    const claims = c.get('claims');
    requireClubMember(claims, body.club_id);
    const isTrainer = hasClubRole(claims, body.club_id, COACH_ROLES);

    const created = await withUser(claims, async (tx) => {
      if (!isTrainer && !(await isOwnMember(tx, claims, body.member_id))) {
        throw problem(403, 'Forbidden', 'Members may only add themselves to a waitlist; queuing others needs a coaching role');
      }
      const rows = await tx`
        insert into app.waitlists (club_id, member_id, kind, target_id, note)
        values (${body.club_id}, ${body.member_id}, ${body.kind}, ${body.target_id ?? null}, ${body.note ?? null})
        returning *`;
      return rows[0];
    });
    return c.json(waitlistSchema.parse(created), 201);
  },
);

waitlistsRouter.openapi(
  createRoute({
    method: 'patch',
    path: '/waitlists/{waitlistId}',
    tags: ['waitlists'],
    summary: 'Update a waitlist entry (status/note) - creator or trainer',
    security: [{ bearerAuth: [] }],
    request: {
      params: waitlistIdParam,
      body: { content: { 'application/json': { schema: waitlistUpdateSchema } }, required: true },
    },
    responses: {
      200: jsonContent(waitlistSchema, 'Updated waitlist entry'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const { waitlistId } = c.req.valid('param');
    const body = c.req.valid('json');
    const claims = c.get('claims');

    const updated = await withUser(claims, async (tx) => {
      const entry = await loadWaitlist(tx, waitlistId);
      requireClubMember(claims, entry.club_id);
      const allowed =
        hasClubRole(claims, entry.club_id, COACH_ROLES) || (await isOwnMember(tx, claims, entry.member_id));
      if (!allowed) throw problem(403, 'Forbidden', 'Editing a waitlist entry requires being its creator or a coaching role');
      const rows = await tx`
        update app.waitlists set ${tx(body)}
        where id = ${waitlistId} and deleted_at is null
        returning *`;
      if (rows.length === 0) throw problem(403, 'Forbidden', 'Editing a waitlist entry requires being its creator or a coaching role');
      return rows[0];
    });
    return c.json(waitlistSchema.parse(updated), 200);
  },
);

waitlistsRouter.openapi(
  createRoute({
    method: 'delete',
    path: '/waitlists/{waitlistId}',
    tags: ['waitlists'],
    summary: 'Leave/remove a waitlist entry (creator or trainer)',
    security: [{ bearerAuth: [] }],
    request: { params: waitlistIdParam },
    responses: {
      200: jsonContent(deletedSchema, 'Waitlist entry soft-deleted'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const { waitlistId } = c.req.valid('param');
    const claims = c.get('claims');

    await withUser(claims, async (tx) => {
      const entry = await loadWaitlist(tx, waitlistId);
      requireClubMember(claims, entry.club_id);
      const allowed =
        hasClubRole(claims, entry.club_id, COACH_ROLES) || (await isOwnMember(tx, claims, entry.member_id));
      if (!allowed) throw problem(403, 'Forbidden', 'Removing a waitlist entry requires being its creator or a coaching role');
      const rows = await tx`
        update app.waitlists set deleted_at = now()
        where id = ${waitlistId} and deleted_at is null
        returning id`;
      if (rows.length === 0) throw problem(403, 'Forbidden', 'Removing a waitlist entry requires being its creator or a coaching role');
    });
    return c.json({ status: 'deleted' as const, id: waitlistId }, 200);
  },
);
