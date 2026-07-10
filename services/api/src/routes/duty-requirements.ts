// ============================================================================
// routes/duty-requirements.ts - target hours ("Pflichtstunden-Soll",
// v1 pflichtstunden.html). Read: every club member (is_club_member). Write:
// coaching staff (is_club_trainer, Referenz 1.3 "Soll setzen"). Deletes are
// SOFT; the RLS update policy backs the API role guard.
// ============================================================================

import { createRoute, z } from '@hono/zod-openapi';
import { createRouter, errorResponses, jsonContent } from '../lib/openapi.js';
import {
  deletedSchema,
  dutyRequirementCreateSchema,
  dutyRequirementSchema,
  dutyRequirementUpdateSchema,
  uuid,
} from '../lib/validation.js';
import { withUser } from '../db.js';
import type { Tx } from '../db.js';
import { problem } from '../middleware/error.js';
import { COACH_ROLES, requireClubMember, requireClubRole } from '../lib/guards.js';

export const dutyRequirementsRouter = createRouter();

const requirementIdParam = z.object({
  requirementId: uuid.openapi({ param: { name: 'requirementId', in: 'path' } }),
});

async function loadRequirement(tx: Tx, requirementId: string): Promise<{ id: string; club_id: string }> {
  const rows = await tx`
    select id, club_id from app.duty_requirements
    where id = ${requirementId} and deleted_at is null`;
  const row = rows[0];
  if (!row) throw problem(404, 'Not Found', 'Duty requirement not found');
  return row as { id: string; club_id: string };
}

dutyRequirementsRouter.openapi(
  createRoute({
    method: 'get',
    path: '/duty-requirements',
    tags: ['duty'],
    summary: 'List the duty-hour requirements of a club (optionally by team)',
    security: [{ bearerAuth: [] }],
    request: {
      query: z.object({ club_id: uuid, team_id: uuid.optional() }),
    },
    responses: {
      200: jsonContent(z.array(dutyRequirementSchema), 'Requirements visible to the caller'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const { club_id, team_id } = c.req.valid('query');
    requireClubMember(c.get('claims'), club_id);
    const rows = await withUser(c.get('claims'), (tx) =>
      tx`select * from app.duty_requirements
         where club_id = ${club_id} and deleted_at is null
           and (${team_id ?? null}::uuid is null or team_id = ${team_id ?? null})
         order by period_start desc, season_label`,
    );
    return c.json(z.array(dutyRequirementSchema).parse(rows), 200);
  },
);

dutyRequirementsRouter.openapi(
  createRoute({
    method: 'post',
    path: '/duty-requirements',
    tags: ['duty'],
    summary: 'Set a duty-hour target (coaching staff, is_club_trainer)',
    security: [{ bearerAuth: [] }],
    request: {
      body: { content: { 'application/json': { schema: dutyRequirementCreateSchema } }, required: true },
    },
    responses: {
      201: jsonContent(dutyRequirementSchema, 'Created requirement'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const body = c.req.valid('json');
    const claims = c.get('claims');
    requireClubRole(claims, body.club_id, COACH_ROLES);

    const created = await withUser(claims, async (tx) => {
      const rows = await tx`
        insert into app.duty_requirements
          (club_id, team_id, member_id, season_label, required_hours, period_start, period_end)
        values
          (${body.club_id}, ${body.team_id ?? null}, ${body.member_id ?? null}, ${body.season_label},
           ${body.required_hours}, ${body.period_start}, ${body.period_end})
        returning *`;
      return rows[0];
    });
    return c.json(dutyRequirementSchema.parse(created), 201);
  },
);

dutyRequirementsRouter.openapi(
  createRoute({
    method: 'patch',
    path: '/duty-requirements/{requirementId}',
    tags: ['duty'],
    summary: 'Edit a duty-hour target (coaching staff, is_club_trainer)',
    security: [{ bearerAuth: [] }],
    request: {
      params: requirementIdParam,
      body: { content: { 'application/json': { schema: dutyRequirementUpdateSchema } }, required: true },
    },
    responses: {
      200: jsonContent(dutyRequirementSchema, 'Updated requirement'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const { requirementId } = c.req.valid('param');
    const body = c.req.valid('json');
    const claims = c.get('claims');

    const updated = await withUser(claims, async (tx) => {
      const requirement = await loadRequirement(tx, requirementId);
      requireClubRole(claims, requirement.club_id, COACH_ROLES);
      const rows = await tx`
        update app.duty_requirements set ${tx(body)}
        where id = ${requirementId} and deleted_at is null
        returning *`;
      if (rows.length === 0) throw problem(403, 'Forbidden', 'Editing a duty requirement requires a coaching role');
      return rows[0];
    });
    return c.json(dutyRequirementSchema.parse(updated), 200);
  },
);

dutyRequirementsRouter.openapi(
  createRoute({
    method: 'delete',
    path: '/duty-requirements/{requirementId}',
    tags: ['duty'],
    summary: 'Soft-delete a duty-hour target (coaching staff, is_club_trainer)',
    security: [{ bearerAuth: [] }],
    request: { params: requirementIdParam },
    responses: {
      200: jsonContent(deletedSchema, 'Requirement soft-deleted'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const { requirementId } = c.req.valid('param');
    const claims = c.get('claims');

    await withUser(claims, async (tx) => {
      const requirement = await loadRequirement(tx, requirementId);
      requireClubRole(claims, requirement.club_id, COACH_ROLES);
      const rows = await tx`
        update app.duty_requirements set deleted_at = now()
        where id = ${requirementId} and deleted_at is null
        returning id`;
      if (rows.length === 0) throw problem(403, 'Forbidden', 'Deleting a duty requirement requires a coaching role');
    });
    return c.json({ status: 'deleted' as const, id: requirementId }, 200);
  },
);
