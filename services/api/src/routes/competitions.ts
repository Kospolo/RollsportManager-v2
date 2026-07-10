// ============================================================================
// routes/competitions.ts - competitions incl. their start list
// (app.competition_entries: who starts with which routine).
//
// Read-only in v0.2: creating competitions/entries stays a later phase; the
// portal needs the read model for the Wettkampf screen, the dashboard
// countdown and score labels. RLS: every club member may read competitions.
// ============================================================================

import { createRoute, z } from '@hono/zod-openapi';
import { createRouter, errorResponses, jsonContent } from '../lib/openapi.js';
import { competitionSchema, uuid } from '../lib/validation.js';
import { withUser } from '../db.js';
import { requireClubMember } from '../lib/guards.js';

export const competitionsRouter = createRouter();

competitionsRouter.openapi(
  createRoute({
    method: 'get',
    path: '/competitions',
    tags: ['competitions'],
    summary: 'List competitions of a club incl. entries (start list)',
    security: [{ bearerAuth: [] }],
    request: { query: z.object({ club_id: uuid }) },
    responses: {
      200: jsonContent(z.array(competitionSchema), 'Competitions of the club'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const { club_id } = c.req.valid('query');
    requireClubMember(c.get('claims'), club_id);
    const rows = await withUser(c.get('claims'), (tx) =>
      tx`select comp.*,
           coalesce((select jsonb_agg(jsonb_build_object(
                       'id', ce.id,
                       'member_id', ce.member_id,
                       'routine_id', ce.routine_id,
                       'status', ce.status
                     ) order by ce.created_at)
                     from app.competition_entries ce
                     where ce.competition_id = comp.id and ce.deleted_at is null),
                    '[]'::jsonb) as entries
         from app.competitions comp
         where comp.club_id = ${club_id} and comp.deleted_at is null
         order by comp.starts_at`,
    );
    return c.json(z.array(competitionSchema).parse(rows), 200);
  },
);
