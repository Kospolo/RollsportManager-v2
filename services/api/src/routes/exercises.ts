// ============================================================================
// routes/exercises.ts - training-drill library ("Übungs-Bibliothek",
// v1 ubungen.html). Categories + difficulty 1..5 per Referenz §4.
//
// Read: every club member (is_club_member). Write: coaching staff
// (is_club_trainer). created_by is the caller's own club_members row. Deletes
// are SOFT; the RLS update policy backs the API role guard (Blueprint risk #16).
// ============================================================================

import { createRoute, z } from '@hono/zod-openapi';
import { createRouter, errorResponses, jsonContent } from '../lib/openapi.js';
import {
  deletedSchema,
  exerciseCategorySchema,
  exerciseCreateSchema,
  exerciseSchema,
  exerciseUpdateSchema,
  uuid,
} from '../lib/validation.js';
import { withUser } from '../db.js';
import type { Tx } from '../db.js';
import { problem } from '../middleware/error.js';
import { COACH_ROLES, requireClubMember, requireClubRole } from '../lib/guards.js';
import type { AuthClaims } from '../middleware/auth.js';

export const exercisesRouter = createRouter();

const exerciseIdParam = z.object({
  exerciseId: uuid.openapi({ param: { name: 'exerciseId', in: 'path' } }),
});

/** The caller's own club_members row in this club (the exercise author). */
async function creatorMemberId(tx: Tx, claims: AuthClaims, clubId: string): Promise<string> {
  const rows = await tx`
    select id from app.club_members
    where club_id = ${clubId} and profile_id = ${claims.sub} and deleted_at is null
    limit 1`;
  const id = rows[0]?.['id'] as string | undefined;
  if (!id) throw problem(403, 'Forbidden', 'No membership row for the author in this club');
  return id;
}

async function loadExercise(tx: Tx, exerciseId: string): Promise<{ id: string; club_id: string }> {
  const rows = await tx`
    select id, club_id from app.exercises
    where id = ${exerciseId} and deleted_at is null`;
  const row = rows[0];
  if (!row) throw problem(404, 'Not Found', 'Exercise not found');
  return row as { id: string; club_id: string };
}

exercisesRouter.openapi(
  createRoute({
    method: 'get',
    path: '/exercises',
    tags: ['exercises'],
    summary: 'List exercises of a club (optionally filtered by category)',
    security: [{ bearerAuth: [] }],
    request: {
      query: z.object({ club_id: uuid, category: exerciseCategorySchema.optional() }),
    },
    responses: {
      200: jsonContent(z.array(exerciseSchema), 'Exercises visible to the caller'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const { club_id, category } = c.req.valid('query');
    requireClubMember(c.get('claims'), club_id);
    const rows = await withUser(c.get('claims'), (tx) =>
      tx`select * from app.exercises
         where club_id = ${club_id} and deleted_at is null
           and (${category ?? null}::app.exercise_category is null or category = ${category ?? null})
         order by category, difficulty, name`,
    );
    return c.json(z.array(exerciseSchema).parse(rows), 200);
  },
);

exercisesRouter.openapi(
  createRoute({
    method: 'post',
    path: '/exercises',
    tags: ['exercises'],
    summary: 'Create an exercise (coaching staff, is_club_trainer)',
    security: [{ bearerAuth: [] }],
    request: {
      body: { content: { 'application/json': { schema: exerciseCreateSchema } }, required: true },
    },
    responses: {
      201: jsonContent(exerciseSchema, 'Created exercise'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const body = c.req.valid('json');
    const claims = c.get('claims');
    requireClubRole(claims, body.club_id, COACH_ROLES);

    const created = await withUser(claims, async (tx) => {
      const creator = await creatorMemberId(tx, claims, body.club_id);
      const rows = await tx`
        insert into app.exercises
          (club_id, created_by_member_id, name, description, category, difficulty,
           video_url, instructions, duration_seconds)
        values
          (${body.club_id}, ${creator}, ${body.name}, ${body.description ?? null},
           ${body.category}, ${body.difficulty}, ${body.video_url ?? null},
           ${body.instructions ?? null}, ${body.duration_seconds ?? null})
        returning *`;
      return rows[0];
    });
    return c.json(exerciseSchema.parse(created), 201);
  },
);

exercisesRouter.openapi(
  createRoute({
    method: 'patch',
    path: '/exercises/{exerciseId}',
    tags: ['exercises'],
    summary: 'Edit an exercise (coaching staff, is_club_trainer)',
    security: [{ bearerAuth: [] }],
    request: {
      params: exerciseIdParam,
      body: { content: { 'application/json': { schema: exerciseUpdateSchema } }, required: true },
    },
    responses: {
      200: jsonContent(exerciseSchema, 'Updated exercise'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const { exerciseId } = c.req.valid('param');
    const body = c.req.valid('json');
    const claims = c.get('claims');

    const updated = await withUser(claims, async (tx) => {
      const exercise = await loadExercise(tx, exerciseId);
      requireClubRole(claims, exercise.club_id, COACH_ROLES);
      const rows = await tx`
        update app.exercises set ${tx(body)}
        where id = ${exerciseId} and deleted_at is null
        returning *`;
      if (rows.length === 0) throw problem(403, 'Forbidden', 'Editing exercises requires a coaching role');
      return rows[0];
    });
    return c.json(exerciseSchema.parse(updated), 200);
  },
);

exercisesRouter.openapi(
  createRoute({
    method: 'delete',
    path: '/exercises/{exerciseId}',
    tags: ['exercises'],
    summary: 'Soft-delete an exercise (coaching staff, is_club_trainer)',
    security: [{ bearerAuth: [] }],
    request: { params: exerciseIdParam },
    responses: {
      200: jsonContent(deletedSchema, 'Exercise soft-deleted'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const { exerciseId } = c.req.valid('param');
    const claims = c.get('claims');

    await withUser(claims, async (tx) => {
      const exercise = await loadExercise(tx, exerciseId);
      requireClubRole(claims, exercise.club_id, COACH_ROLES);
      const rows = await tx`
        update app.exercises set deleted_at = now()
        where id = ${exerciseId} and deleted_at is null
        returning id`;
      if (rows.length === 0) throw problem(403, 'Forbidden', 'Deleting exercises requires a coaching role');
    });
    return c.json({ status: 'deleted' as const, id: exerciseId }, 200);
  },
);
