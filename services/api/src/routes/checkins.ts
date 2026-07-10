// ============================================================================
// routes/checkins.ts - attendance check-in (QR / manual), v1 checkin.html,
// my-qrcode.html, checkin-history.html. Referenz 1.3:
//   Read:   own check-ins (member_id = caller's own club_members row) OR a
//           coaching role sees all check-ins of the club.
//   Insert: a member checks THEMSELVES in; coaching staff check anyone in.
//   Delete (soft): coaching role only (a member cannot tilt the history).
// The API guard mirrors the RLS policy (app.is_own_member / is_club_trainer).
// ============================================================================

import { createRoute, z } from '@hono/zod-openapi';
import { createRouter, errorResponses, jsonContent } from '../lib/openapi.js';
import { checkinCreateSchema, checkinSchema, deletedSchema, uuid } from '../lib/validation.js';
import { withUser } from '../db.js';
import type { Tx } from '../db.js';
import { problem } from '../middleware/error.js';
import { COACH_ROLES, hasClubRole, requireClubMember, requireClubRole } from '../lib/guards.js';
import { isOwnMember } from '../lib/ownership.js';

export const checkinsRouter = createRouter();

const checkinIdParam = z.object({
  checkinId: uuid.openapi({ param: { name: 'checkinId', in: 'path' } }),
});

async function loadCheckin(tx: Tx, checkinId: string): Promise<{ id: string; club_id: string }> {
  const rows = await tx`
    select id, club_id from app.checkins
    where id = ${checkinId} and deleted_at is null`;
  const row = rows[0];
  if (!row) throw problem(404, 'Not Found', 'Check-in not found');
  return row as { id: string; club_id: string };
}

checkinsRouter.openapi(
  createRoute({
    method: 'get',
    path: '/checkins',
    tags: ['checkins'],
    summary: 'List check-ins (own history, or the whole club for coaching staff)',
    security: [{ bearerAuth: [] }],
    request: {
      query: z.object({ club_id: uuid, member_id: uuid.optional() }),
    },
    responses: {
      200: jsonContent(z.array(checkinSchema), 'Check-ins visible to the caller (RLS-filtered)'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const { club_id, member_id } = c.req.valid('query');
    requireClubMember(c.get('claims'), club_id);
    // RLS already narrows a plain member to their OWN rows; the optional
    // member_id filter is an additional narrowing (e.g. a trainer picking one).
    const rows = await withUser(c.get('claims'), (tx) =>
      tx`select * from app.checkins
         where club_id = ${club_id} and deleted_at is null
           and (${member_id ?? null}::uuid is null or member_id = ${member_id ?? null})
         order by checked_in_at desc, created_at desc`,
    );
    return c.json(z.array(checkinSchema).parse(rows), 200);
  },
);

checkinsRouter.openapi(
  createRoute({
    method: 'post',
    path: '/checkins',
    tags: ['checkins'],
    summary: 'Check in (a member for themselves, or staff for anyone)',
    security: [{ bearerAuth: [] }],
    request: {
      body: { content: { 'application/json': { schema: checkinCreateSchema } }, required: true },
    },
    responses: {
      201: jsonContent(checkinSchema, 'Created check-in'),
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
        throw problem(403, 'Forbidden', 'Members may only check themselves in; checking others in needs a coaching role');
      }
      const rows = await tx`
        insert into app.checkins (club_id, member_id, event_id, method, checked_in_at)
        values (${body.club_id}, ${body.member_id}, ${body.event_id ?? null},
                ${body.method}, ${body.checked_in_at ?? null})
        returning *`;
      return rows[0];
    });
    return c.json(checkinSchema.parse(created), 201);
  },
);

checkinsRouter.openapi(
  createRoute({
    method: 'delete',
    path: '/checkins/{checkinId}',
    tags: ['checkins'],
    summary: 'Soft-delete a check-in (coaching staff only)',
    security: [{ bearerAuth: [] }],
    request: { params: checkinIdParam },
    responses: {
      200: jsonContent(deletedSchema, 'Check-in soft-deleted'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const { checkinId } = c.req.valid('param');
    const claims = c.get('claims');

    await withUser(claims, async (tx) => {
      const checkin = await loadCheckin(tx, checkinId);
      requireClubRole(claims, checkin.club_id, COACH_ROLES);
      const rows = await tx`
        update app.checkins set deleted_at = now()
        where id = ${checkinId} and deleted_at is null
        returning id`;
      if (rows.length === 0) throw problem(403, 'Forbidden', 'Deleting a check-in requires a coaching role');
    });
    return c.json({ status: 'deleted' as const, id: checkinId }, 200);
  },
);
