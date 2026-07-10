// ============================================================================
// routes/training-slots.ts - the weekly training schedule ("Trainingsplan",
// v1 trainingsplan.html). Read: every club member (is_club_member). Write:
// coaching staff (is_club_trainer, Referenz 1.3). Deletes are SOFT; the RLS
// update policy backs the API role guard (Blueprint risk #16).
// ============================================================================

import { createRoute, z } from '@hono/zod-openapi';
import { createRouter, errorResponses, jsonContent } from '../lib/openapi.js';
import {
  deletedSchema,
  trainingSlotCreateSchema,
  trainingSlotSchema,
  trainingSlotUpdateSchema,
  uuid,
} from '../lib/validation.js';
import { withUser } from '../db.js';
import type { Tx } from '../db.js';
import { problem } from '../middleware/error.js';
import { COACH_ROLES, requireClubMember, requireClubRole } from '../lib/guards.js';

export const trainingSlotsRouter = createRouter();

const slotIdParam = z.object({
  slotId: uuid.openapi({ param: { name: 'slotId', in: 'path' } }),
});

async function loadSlot(tx: Tx, slotId: string): Promise<{ id: string; club_id: string }> {
  const rows = await tx`
    select id, club_id from app.training_slots
    where id = ${slotId} and deleted_at is null`;
  const row = rows[0];
  if (!row) throw problem(404, 'Not Found', 'Training slot not found');
  return row as { id: string; club_id: string };
}

trainingSlotsRouter.openapi(
  createRoute({
    method: 'get',
    path: '/training-slots',
    tags: ['training-slots'],
    summary: 'List the weekly training slots of a club (optionally by team)',
    security: [{ bearerAuth: [] }],
    request: {
      query: z.object({ club_id: uuid, team_id: uuid.optional() }),
    },
    responses: {
      200: jsonContent(z.array(trainingSlotSchema), 'Training slots visible to the caller'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const { club_id, team_id } = c.req.valid('query');
    requireClubMember(c.get('claims'), club_id);
    const rows = await withUser(c.get('claims'), (tx) =>
      tx`select * from app.training_slots
         where club_id = ${club_id} and deleted_at is null
           and (${team_id ?? null}::uuid is null or team_id = ${team_id ?? null})
         order by weekday, starts_time`,
    );
    return c.json(z.array(trainingSlotSchema).parse(rows), 200);
  },
);

trainingSlotsRouter.openapi(
  createRoute({
    method: 'post',
    path: '/training-slots',
    tags: ['training-slots'],
    summary: 'Create a training slot (coaching staff, is_club_trainer)',
    security: [{ bearerAuth: [] }],
    request: {
      body: { content: { 'application/json': { schema: trainingSlotCreateSchema } }, required: true },
    },
    responses: {
      201: jsonContent(trainingSlotSchema, 'Created training slot'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const body = c.req.valid('json');
    const claims = c.get('claims');
    requireClubRole(claims, body.club_id, COACH_ROLES);

    const created = await withUser(claims, async (tx) => {
      const rows = await tx`
        insert into app.training_slots
          (club_id, team_id, weekday, starts_time, ends_time, facility_id, location, coach_member_id, note)
        values
          (${body.club_id}, ${body.team_id ?? null}, ${body.weekday}, ${body.starts_time}, ${body.ends_time},
           ${body.facility_id ?? null}, ${body.location ?? null}, ${body.coach_member_id ?? null}, ${body.note ?? null})
        returning *`;
      return rows[0];
    });
    return c.json(trainingSlotSchema.parse(created), 201);
  },
);

trainingSlotsRouter.openapi(
  createRoute({
    method: 'patch',
    path: '/training-slots/{slotId}',
    tags: ['training-slots'],
    summary: 'Edit a training slot (coaching staff, is_club_trainer)',
    security: [{ bearerAuth: [] }],
    request: {
      params: slotIdParam,
      body: { content: { 'application/json': { schema: trainingSlotUpdateSchema } }, required: true },
    },
    responses: {
      200: jsonContent(trainingSlotSchema, 'Updated training slot'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const { slotId } = c.req.valid('param');
    const body = c.req.valid('json');
    const claims = c.get('claims');

    const updated = await withUser(claims, async (tx) => {
      const slot = await loadSlot(tx, slotId);
      requireClubRole(claims, slot.club_id, COACH_ROLES);
      const rows = await tx`
        update app.training_slots set ${tx(body)}
        where id = ${slotId} and deleted_at is null
        returning *`;
      if (rows.length === 0) throw problem(403, 'Forbidden', 'Editing a training slot requires a coaching role');
      return rows[0];
    });
    return c.json(trainingSlotSchema.parse(updated), 200);
  },
);

trainingSlotsRouter.openapi(
  createRoute({
    method: 'delete',
    path: '/training-slots/{slotId}',
    tags: ['training-slots'],
    summary: 'Soft-delete a training slot (coaching staff, is_club_trainer)',
    security: [{ bearerAuth: [] }],
    request: { params: slotIdParam },
    responses: {
      200: jsonContent(deletedSchema, 'Training slot soft-deleted'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const { slotId } = c.req.valid('param');
    const claims = c.get('claims');

    await withUser(claims, async (tx) => {
      const slot = await loadSlot(tx, slotId);
      requireClubRole(claims, slot.club_id, COACH_ROLES);
      const rows = await tx`
        update app.training_slots set deleted_at = now()
        where id = ${slotId} and deleted_at is null
        returning id`;
      if (rows.length === 0) throw problem(403, 'Forbidden', 'Deleting a training slot requires a coaching role');
    });
    return c.json({ status: 'deleted' as const, id: slotId }, 200);
  },
);
