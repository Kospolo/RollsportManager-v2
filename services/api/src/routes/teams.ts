// ============================================================================
// routes/teams.ts - team read model of a club: teams with their skater and
// coach member ids (app.team_members carries the role column).
//
// Read-only in v0.2: team management (create/rename/assign) is a later phase;
// the portal needs the read model for roster columns, event scoping and
// routine/team labels. RLS: every club member may read teams.
// ============================================================================

import { createRoute, z } from '@hono/zod-openapi';
import { createRouter, errorResponses, jsonContent } from '../lib/openapi.js';
import { teamSchema, uuid } from '../lib/validation.js';
import { withUser } from '../db.js';
import { requireClubMember } from '../lib/guards.js';

export const teamsRouter = createRouter();

const clubIdParam = z.object({ clubId: uuid.openapi({ param: { name: 'clubId', in: 'path' } }) });

teamsRouter.openapi(
  createRoute({
    method: 'get',
    path: '/clubs/{clubId}/teams',
    tags: ['teams'],
    summary: 'List teams of a club incl. skater/coach member ids',
    security: [{ bearerAuth: [] }],
    request: { params: clubIdParam },
    responses: {
      200: jsonContent(z.array(teamSchema), 'Teams of the club'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const { clubId } = c.req.valid('param');
    requireClubMember(c.get('claims'), clubId);
    const rows = await withUser(c.get('claims'), (tx) =>
      tx`select t.*,
           coalesce((select jsonb_agg(tm.member_id order by tm.created_at)
                     from app.team_members tm
                     where tm.team_id = t.id and tm.role = 'skater' and tm.deleted_at is null),
                    '[]'::jsonb) as skater_member_ids,
           coalesce((select jsonb_agg(tm.member_id order by tm.created_at)
                     from app.team_members tm
                     where tm.team_id = t.id and tm.role = 'coach' and tm.deleted_at is null),
                    '[]'::jsonb) as coach_member_ids
         from app.teams t
         where t.club_id = ${clubId} and t.deleted_at is null
         order by t.name`,
    );
    return c.json(z.array(teamSchema).parse(rows), 200);
  },
);
