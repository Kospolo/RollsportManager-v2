// ============================================================================
// routes/equipment.ts - club gear inventory ("Ausrüstung", v1 equipment.html).
// Read: every club member (is_club_member). Write: coaching staff
// (is_club_trainer). Deletes are SOFT; the RLS update policy backs the API
// role guard (Blueprint risk #16).
// ============================================================================

import { createRoute, z } from '@hono/zod-openapi';
import { createRouter, errorResponses, jsonContent } from '../lib/openapi.js';
import {
  deletedSchema,
  equipmentCreateSchema,
  equipmentSchema,
  equipmentUpdateSchema,
  uuid,
} from '../lib/validation.js';
import { withUser } from '../db.js';
import type { Tx } from '../db.js';
import { problem } from '../middleware/error.js';
import { COACH_ROLES, requireClubMember, requireClubRole } from '../lib/guards.js';

export const equipmentRouter = createRouter();

const equipmentIdParam = z.object({
  equipmentId: uuid.openapi({ param: { name: 'equipmentId', in: 'path' } }),
});

async function loadEquipment(tx: Tx, equipmentId: string): Promise<{ id: string; club_id: string }> {
  const rows = await tx`
    select id, club_id from app.equipment
    where id = ${equipmentId} and deleted_at is null`;
  const row = rows[0];
  if (!row) throw problem(404, 'Not Found', 'Equipment not found');
  return row as { id: string; club_id: string };
}

equipmentRouter.openapi(
  createRoute({
    method: 'get',
    path: '/equipment',
    tags: ['equipment'],
    summary: 'List equipment of a club',
    security: [{ bearerAuth: [] }],
    request: { query: z.object({ club_id: uuid }) },
    responses: {
      200: jsonContent(z.array(equipmentSchema), 'Equipment visible to the caller'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const { club_id } = c.req.valid('query');
    requireClubMember(c.get('claims'), club_id);
    const rows = await withUser(c.get('claims'), (tx) =>
      tx`select * from app.equipment
         where club_id = ${club_id} and deleted_at is null
         order by category nulls last, name`,
    );
    return c.json(z.array(equipmentSchema).parse(rows), 200);
  },
);

equipmentRouter.openapi(
  createRoute({
    method: 'post',
    path: '/equipment',
    tags: ['equipment'],
    summary: 'Create an equipment item (coaching staff, is_club_trainer)',
    security: [{ bearerAuth: [] }],
    request: {
      body: { content: { 'application/json': { schema: equipmentCreateSchema } }, required: true },
    },
    responses: {
      201: jsonContent(equipmentSchema, 'Created equipment item'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const body = c.req.valid('json');
    const claims = c.get('claims');
    requireClubRole(claims, body.club_id, COACH_ROLES);

    // Default available = total when the caller does not specify it.
    const available = body.available_quantity ?? body.total_quantity;
    const created = await withUser(claims, async (tx) => {
      const rows = await tx`
        insert into app.equipment
          (club_id, name, category, total_quantity, available_quantity, condition, notes)
        values
          (${body.club_id}, ${body.name}, ${body.category ?? null}, ${body.total_quantity},
           ${available}, ${body.condition}, ${body.notes ?? null})
        returning *`;
      return rows[0];
    });
    return c.json(equipmentSchema.parse(created), 201);
  },
);

equipmentRouter.openapi(
  createRoute({
    method: 'patch',
    path: '/equipment/{equipmentId}',
    tags: ['equipment'],
    summary: 'Edit an equipment item (coaching staff, is_club_trainer)',
    security: [{ bearerAuth: [] }],
    request: {
      params: equipmentIdParam,
      body: { content: { 'application/json': { schema: equipmentUpdateSchema } }, required: true },
    },
    responses: {
      200: jsonContent(equipmentSchema, 'Updated equipment item'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const { equipmentId } = c.req.valid('param');
    const body = c.req.valid('json');
    const claims = c.get('claims');

    const updated = await withUser(claims, async (tx) => {
      const equipment = await loadEquipment(tx, equipmentId);
      requireClubRole(claims, equipment.club_id, COACH_ROLES);
      const rows = await tx`
        update app.equipment set ${tx(body)}
        where id = ${equipmentId} and deleted_at is null
        returning *`;
      if (rows.length === 0) throw problem(403, 'Forbidden', 'Editing equipment requires a coaching role');
      return rows[0];
    });
    return c.json(equipmentSchema.parse(updated), 200);
  },
);

equipmentRouter.openapi(
  createRoute({
    method: 'delete',
    path: '/equipment/{equipmentId}',
    tags: ['equipment'],
    summary: 'Soft-delete an equipment item (coaching staff, is_club_trainer)',
    security: [{ bearerAuth: [] }],
    request: { params: equipmentIdParam },
    responses: {
      200: jsonContent(deletedSchema, 'Equipment item soft-deleted'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const { equipmentId } = c.req.valid('param');
    const claims = c.get('claims');

    await withUser(claims, async (tx) => {
      const equipment = await loadEquipment(tx, equipmentId);
      requireClubRole(claims, equipment.club_id, COACH_ROLES);
      const rows = await tx`
        update app.equipment set deleted_at = now()
        where id = ${equipmentId} and deleted_at is null
        returning id`;
      if (rows.length === 0) throw problem(403, 'Forbidden', 'Deleting equipment requires a coaching role');
    });
    return c.json({ status: 'deleted' as const, id: equipmentId }, 200);
  },
);
