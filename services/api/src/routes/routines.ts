// ============================================================================
// routes/routines.ts - Küren (the USP): routines, time markers on the
// training audio, and score history. Routine work explicitly includes
// guest_coach (that is what guest coaches are invited for) - the RLS
// policies mirror this and additionally enforce guest expiry server-side.
// ============================================================================

import { createRoute, z } from '@hono/zod-openapi';
import { createRouter, errorResponses, jsonContent } from '../lib/openapi.js';
import {
  markerCreateSchema,
  markerSchema,
  routineCreateSchema,
  routineSchema,
  scoreCreateSchema,
  scoreSchema,
  uuid,
} from '../lib/validation.js';
import { withUser } from '../db.js';
import type { Tx } from '../db.js';
import { problem } from '../middleware/error.js';
import { COACH_ROLES, hasClubRole, requireClubMember, requireClubRole } from '../lib/guards.js';

export const routinesRouter = createRouter();

const routineIdParam = z.object({
  routineId: uuid.openapi({ param: { name: 'routineId', in: 'path' } }),
});

async function loadRoutine(tx: Tx, routineId: string): Promise<{ id: string; club_id: string }> {
  const rows = await tx`
    select id, club_id from app.routines
    where id = ${routineId} and deleted_at is null`;
  const routine = rows[0];
  if (!routine) throw problem(404, 'Not Found', 'Routine not found');
  return routine as { id: string; club_id: string };
}

routinesRouter.openapi(
  createRoute({
    method: 'get',
    path: '/routines',
    tags: ['routines'],
    summary: 'List routines of a club',
    security: [{ bearerAuth: [] }],
    request: { query: z.object({ club_id: uuid }) },
    responses: {
      200: jsonContent(z.array(routineSchema), 'Routines visible to the caller'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const { club_id } = c.req.valid('query');
    requireClubMember(c.get('claims'), club_id);
    const rows = await withUser(c.get('claims'), (tx) =>
      tx`select * from app.routines
         where club_id = ${club_id} and deleted_at is null
         order by title`,
    );
    return c.json(z.array(routineSchema).parse(rows), 200);
  },
);

routinesRouter.openapi(
  createRoute({
    method: 'post',
    path: '/routines',
    tags: ['routines'],
    summary: 'Create a routine (coaching staff incl. guest_coach)',
    security: [{ bearerAuth: [] }],
    request: {
      body: { content: { 'application/json': { schema: routineCreateSchema } }, required: true },
    },
    responses: {
      201: jsonContent(routineSchema, 'Created routine'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const body = c.req.valid('json');
    requireClubRole(c.get('claims'), body.club_id, COACH_ROLES);

    const created = await withUser(c.get('claims'), async (tx) => {
      const rows = await tx`
        insert into app.routines
          (club_id, team_id, title, category, music_title, music_artist, music_bpm, music_duration_ms)
        values
          (${body.club_id}, ${body.team_id ?? null}, ${body.title}, ${body.category ?? null},
           ${body.music_title ?? null}, ${body.music_artist ?? null},
           ${body.music_bpm ?? null}, ${body.music_duration_ms ?? null})
        returning *`;
      const routine = rows[0] as { id: string };
      // n:m skaters - pair/group routines have several (design deviation, documented)
      for (const memberId of body.skater_member_ids) {
        await tx`
          insert into app.routine_skaters (club_id, routine_id, member_id)
          values (${body.club_id}, ${routine.id}, ${memberId})`;
      }
      return rows[0];
    });
    return c.json(routineSchema.parse(created), 201);
  },
);

routinesRouter.openapi(
  createRoute({
    method: 'get',
    path: '/routines/{routineId}',
    tags: ['routines'],
    summary: 'Get a routine',
    security: [{ bearerAuth: [] }],
    request: { params: routineIdParam },
    responses: {
      200: jsonContent(routineSchema, 'The routine'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const { routineId } = c.req.valid('param');
    const rows = await withUser(c.get('claims'), (tx) =>
      tx`select * from app.routines where id = ${routineId} and deleted_at is null`,
    );
    if (rows.length === 0) throw problem(404, 'Not Found', 'Routine not found');
    return c.json(routineSchema.parse(rows[0]), 200);
  },
);

routinesRouter.openapi(
  createRoute({
    method: 'get',
    path: '/routines/{routineId}/markers',
    tags: ['routines'],
    summary: 'List time markers of a routine',
    security: [{ bearerAuth: [] }],
    request: { params: routineIdParam },
    responses: {
      200: jsonContent(z.array(markerSchema), 'Markers ordered by time'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const { routineId } = c.req.valid('param');
    const rows = await withUser(c.get('claims'), async (tx) => {
      await loadRoutine(tx, routineId);
      return tx`
        select * from app.routine_markers
        where routine_id = ${routineId} and deleted_at is null
        order by time_ms`;
    });
    return c.json(z.array(markerSchema).parse(rows), 200);
  },
);

routinesRouter.openapi(
  createRoute({
    method: 'post',
    path: '/routines/{routineId}/markers',
    tags: ['routines'],
    summary: 'Add a time marker (coaching staff incl. guest_coach)',
    security: [{ bearerAuth: [] }],
    request: {
      params: routineIdParam,
      body: { content: { 'application/json': { schema: markerCreateSchema } }, required: true },
    },
    responses: {
      201: jsonContent(markerSchema, 'Created marker'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const { routineId } = c.req.valid('param');
    const body = c.req.valid('json');
    const claims = c.get('claims');

    const created = await withUser(claims, async (tx) => {
      const routine = await loadRoutine(tx, routineId);
      if (!hasClubRole(claims, routine.club_id, COACH_ROLES)) {
        throw problem(403, 'Forbidden', 'Markers require a coaching role');
      }
      const rows = await tx`
        insert into app.routine_markers (club_id, routine_id, time_ms, label, element_code)
        values (${routine.club_id}, ${routineId}, ${body.time_ms}, ${body.label},
                ${body.element_code ?? null})
        returning *`;
      return rows[0];
    });
    return c.json(markerSchema.parse(created), 201);
  },
);

routinesRouter.openapi(
  createRoute({
    method: 'get',
    path: '/routines/{routineId}/scores',
    tags: ['routines'],
    summary: 'Score history of a routine',
    security: [{ bearerAuth: [] }],
    request: { params: routineIdParam },
    responses: {
      200: jsonContent(z.array(scoreSchema), 'Scores, newest first'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const { routineId } = c.req.valid('param');
    const rows = await withUser(c.get('claims'), async (tx) => {
      await loadRoutine(tx, routineId);
      return tx`
        select * from app.routine_scores
        where routine_id = ${routineId} and deleted_at is null
        order by scored_on desc`;
    });
    return c.json(z.array(scoreSchema).parse(rows), 200);
  },
);

routinesRouter.openapi(
  createRoute({
    method: 'post',
    path: '/routines/{routineId}/scores',
    tags: ['routines'],
    summary: 'Record a score (coaching staff incl. guest_coach)',
    security: [{ bearerAuth: [] }],
    request: {
      params: routineIdParam,
      body: { content: { 'application/json': { schema: scoreCreateSchema } }, required: true },
    },
    responses: {
      201: jsonContent(scoreSchema, 'Created score'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const { routineId } = c.req.valid('param');
    const body = c.req.valid('json');
    const claims = c.get('claims');

    const created = await withUser(claims, async (tx) => {
      const routine = await loadRoutine(tx, routineId);
      if (!hasClubRole(claims, routine.club_id, COACH_ROLES)) {
        throw problem(403, 'Forbidden', 'Scores require a coaching role');
      }
      const rows = await tx`
        insert into app.routine_scores
          (club_id, routine_id, competition_id, scored_on, scoring_system,
           technical_score, components_score, total_score, note)
        values
          (${routine.club_id}, ${routineId}, ${body.competition_id ?? null}, ${body.scored_on},
           ${body.scoring_system}, ${body.technical_score ?? null},
           ${body.components_score ?? null}, ${body.total_score ?? null}, ${body.note ?? null})
        returning *`;
      return rows[0];
    });
    return c.json(scoreSchema.parse(created), 201);
  },
);
