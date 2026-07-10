// ============================================================================
// routes/achievements.ts - medals & competition results ("Medaillen",
// v1 achievements.html). Read: every club member (is_club_member). Award/edit/
// delete: coaching staff (is_club_trainer, Referenz 1.3). Deletes are SOFT;
// the RLS update policy backs the API role guard (Blueprint risk #16).
// ============================================================================

import { createRoute, z } from '@hono/zod-openapi';
import { createRouter, errorResponses, jsonContent } from '../lib/openapi.js';
import {
  achievementCreateSchema,
  achievementSchema,
  achievementUpdateSchema,
  deletedSchema,
  uuid,
} from '../lib/validation.js';
import { withUser } from '../db.js';
import type { Tx } from '../db.js';
import { problem } from '../middleware/error.js';
import { COACH_ROLES, requireClubMember, requireClubRole } from '../lib/guards.js';

export const achievementsRouter = createRouter();

const achievementIdParam = z.object({
  achievementId: uuid.openapi({ param: { name: 'achievementId', in: 'path' } }),
});

async function loadAchievement(tx: Tx, achievementId: string): Promise<{ id: string; club_id: string }> {
  const rows = await tx`
    select id, club_id from app.achievements
    where id = ${achievementId} and deleted_at is null`;
  const row = rows[0];
  if (!row) throw problem(404, 'Not Found', 'Achievement not found');
  return row as { id: string; club_id: string };
}

achievementsRouter.openapi(
  createRoute({
    method: 'get',
    path: '/achievements',
    tags: ['achievements'],
    summary: 'List medals of a club (optionally filtered by member)',
    security: [{ bearerAuth: [] }],
    request: {
      query: z.object({ club_id: uuid, member_id: uuid.optional() }),
    },
    responses: {
      200: jsonContent(z.array(achievementSchema), 'Achievements visible to the caller'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const { club_id, member_id } = c.req.valid('query');
    requireClubMember(c.get('claims'), club_id);
    const rows = await withUser(c.get('claims'), (tx) =>
      tx`select * from app.achievements
         where club_id = ${club_id} and deleted_at is null
           and (${member_id ?? null}::uuid is null or member_id = ${member_id ?? null})
         order by achieved_on desc, created_at desc`,
    );
    return c.json(z.array(achievementSchema).parse(rows), 200);
  },
);

achievementsRouter.openapi(
  createRoute({
    method: 'post',
    path: '/achievements',
    tags: ['achievements'],
    summary: 'Award a medal (coaching staff, is_club_trainer)',
    security: [{ bearerAuth: [] }],
    request: {
      body: { content: { 'application/json': { schema: achievementCreateSchema } }, required: true },
    },
    responses: {
      201: jsonContent(achievementSchema, 'Created achievement'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const body = c.req.valid('json');
    const claims = c.get('claims');
    requireClubRole(claims, body.club_id, COACH_ROLES);

    const created = await withUser(claims, async (tx) => {
      const rows = await tx`
        insert into app.achievements
          (club_id, member_id, title, competition_name, placement, medal, achieved_on, note)
        values
          (${body.club_id}, ${body.member_id}, ${body.title}, ${body.competition_name ?? null},
           ${body.placement ?? null}, ${body.medal ?? null}, ${body.achieved_on}, ${body.note ?? null})
        returning *`;
      return rows[0];
    });
    return c.json(achievementSchema.parse(created), 201);
  },
);

achievementsRouter.openapi(
  createRoute({
    method: 'patch',
    path: '/achievements/{achievementId}',
    tags: ['achievements'],
    summary: 'Edit a medal (coaching staff, is_club_trainer)',
    security: [{ bearerAuth: [] }],
    request: {
      params: achievementIdParam,
      body: { content: { 'application/json': { schema: achievementUpdateSchema } }, required: true },
    },
    responses: {
      200: jsonContent(achievementSchema, 'Updated achievement'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const { achievementId } = c.req.valid('param');
    const body = c.req.valid('json');
    const claims = c.get('claims');

    const updated = await withUser(claims, async (tx) => {
      const achievement = await loadAchievement(tx, achievementId);
      requireClubRole(claims, achievement.club_id, COACH_ROLES);
      const rows = await tx`
        update app.achievements set ${tx(body)}
        where id = ${achievementId} and deleted_at is null
        returning *`;
      if (rows.length === 0) throw problem(403, 'Forbidden', 'Editing medals requires a coaching role');
      return rows[0];
    });
    return c.json(achievementSchema.parse(updated), 200);
  },
);

achievementsRouter.openapi(
  createRoute({
    method: 'delete',
    path: '/achievements/{achievementId}',
    tags: ['achievements'],
    summary: 'Soft-delete a medal (coaching staff, is_club_trainer)',
    security: [{ bearerAuth: [] }],
    request: { params: achievementIdParam },
    responses: {
      200: jsonContent(deletedSchema, 'Achievement soft-deleted'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const { achievementId } = c.req.valid('param');
    const claims = c.get('claims');

    await withUser(claims, async (tx) => {
      const achievement = await loadAchievement(tx, achievementId);
      requireClubRole(claims, achievement.club_id, COACH_ROLES);
      const rows = await tx`
        update app.achievements set deleted_at = now()
        where id = ${achievementId} and deleted_at is null
        returning id`;
      if (rows.length === 0) throw problem(403, 'Forbidden', 'Deleting medals requires a coaching role');
    });
    return c.json({ status: 'deleted' as const, id: achievementId }, 200);
  },
);
