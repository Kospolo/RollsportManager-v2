// ============================================================================
// routes/teams.ts - team read model + management of a club. Teams carry their
// skater and coach member ids (app.team_members has the role column).
//
// Reads: every club member. Writes (create/rename/soft-delete/roster): is_club_admin
// (owner/admin/moderator) - the API guard; RLS (owner/admin/moderator/coach) is
// the second line of defense.
// ============================================================================

import { createRoute, z } from '@hono/zod-openapi';
import { createRouter, errorResponses, jsonContent } from '../lib/openapi.js';
import {
  deletedSchema,
  teamCreateSchema,
  teamMembersSetSchema,
  teamSchema,
  teamUpdateSchema,
  uuid,
} from '../lib/validation.js';
import { withUser } from '../db.js';
import type { Tx } from '../db.js';
import { problem } from '../middleware/error.js';
import { ADMIN_ROLES, requireClubRole } from '../lib/guards.js';
import { requireClubMemberDb } from '../lib/capabilities.js';

export const teamsRouter = createRouter();

const clubIdParam = z.object({ clubId: uuid.openapi({ param: { name: 'clubId', in: 'path' } }) });
const teamParams = z.object({
  clubId: uuid.openapi({ param: { name: 'clubId', in: 'path' } }),
  teamId: uuid.openapi({ param: { name: 'teamId', in: 'path' } }),
});

/** Re-read one team incl. skater/coach member ids (soft-deleted links excluded). */
async function teamWithMembers(tx: Tx, clubId: string, teamId: string): Promise<unknown> {
  const rows = await tx`
    select t.*,
      coalesce((select jsonb_agg(tm.member_id order by tm.created_at)
                from app.team_members tm
                where tm.team_id = t.id and tm.role = 'skater' and tm.deleted_at is null),
               '[]'::jsonb) as skater_member_ids,
      coalesce((select jsonb_agg(tm.member_id order by tm.created_at)
                from app.team_members tm
                where tm.team_id = t.id and tm.role = 'coach' and tm.deleted_at is null),
               '[]'::jsonb) as coach_member_ids
    from app.teams t
    where t.id = ${teamId} and t.club_id = ${clubId} and t.deleted_at is null`;
  if (rows.length === 0) throw problem(404, 'Not Found', 'Team not found');
  return rows[0];
}

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
    await requireClubMemberDb(c, clubId);
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

teamsRouter.openapi(
  createRoute({
    method: 'post',
    path: '/clubs/{clubId}/teams',
    tags: ['teams'],
    summary: 'Create a team (is_club_admin)',
    security: [{ bearerAuth: [] }],
    request: {
      params: clubIdParam,
      body: { content: { 'application/json': { schema: teamCreateSchema } }, required: true },
    },
    responses: {
      201: jsonContent(teamSchema, 'Created team'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const { clubId } = c.req.valid('param');
    const body = c.req.valid('json');
    requireClubRole(c.get('claims'), clubId, ADMIN_ROLES);

    const rows = await withUser(c.get('claims'), (tx) =>
      tx`insert into app.teams (club_id, name, age_group)
         values (${clubId}, ${body.name}, ${body.age_group ?? null})
         returning *`,
    );
    return c.json(teamSchema.parse({ ...rows[0], skater_member_ids: [], coach_member_ids: [] }), 201);
  },
);

teamsRouter.openapi(
  createRoute({
    method: 'patch',
    path: '/clubs/{clubId}/teams/{teamId}',
    tags: ['teams'],
    summary: 'Rename a team / change age group (is_club_admin)',
    security: [{ bearerAuth: [] }],
    request: {
      params: teamParams,
      body: { content: { 'application/json': { schema: teamUpdateSchema } }, required: true },
    },
    responses: {
      200: jsonContent(teamSchema, 'Updated team'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const { clubId, teamId } = c.req.valid('param');
    const body = c.req.valid('json');
    requireClubRole(c.get('claims'), clubId, ADMIN_ROLES);

    const updated = await withUser(c.get('claims'), async (tx) => {
      const rows = await tx`
        update app.teams set ${tx(body)}
        where id = ${teamId} and club_id = ${clubId} and deleted_at is null
        returning *`;
      if (rows.length === 0) throw problem(404, 'Not Found', 'Team not found');
      return teamWithMembers(tx, clubId, teamId);
    });
    return c.json(teamSchema.parse(updated), 200);
  },
);

teamsRouter.openapi(
  createRoute({
    method: 'delete',
    path: '/clubs/{clubId}/teams/{teamId}',
    tags: ['teams'],
    summary: 'Soft-delete a team (is_club_admin)',
    security: [{ bearerAuth: [] }],
    request: { params: teamParams },
    responses: {
      200: jsonContent(deletedSchema, 'Team soft-deleted'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const { clubId, teamId } = c.req.valid('param');
    requireClubRole(c.get('claims'), clubId, ADMIN_ROLES);

    await withUser(c.get('claims'), async (tx) => {
      const rows = await tx`
        update app.teams set deleted_at = now()
        where id = ${teamId} and club_id = ${clubId} and deleted_at is null
        returning id`;
      if (rows.length === 0) throw problem(404, 'Not Found', 'Team not found');
      // Detach roster links so the team stops appearing in members' team_ids.
      await tx`
        update app.team_members set deleted_at = now()
        where team_id = ${teamId} and deleted_at is null`;
    });
    return c.json({ status: 'deleted' as const, id: teamId }, 200);
  },
);

teamsRouter.openapi(
  createRoute({
    method: 'put',
    path: '/clubs/{clubId}/teams/{teamId}/members',
    tags: ['teams'],
    summary: 'Replace a team roster: skaters + coaches (is_club_admin)',
    description:
      'Full replace. Member ids must belong to the club. A member may hold exactly one role per team ' +
      '(coach wins on overlap). Missing members are soft-detached.',
    security: [{ bearerAuth: [] }],
    request: {
      params: teamParams,
      body: { content: { 'application/json': { schema: teamMembersSetSchema } }, required: true },
    },
    responses: {
      200: jsonContent(teamSchema, 'Updated team incl. roster'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const { clubId, teamId } = c.req.valid('param');
    const body = c.req.valid('json');
    requireClubRole(c.get('claims'), clubId, ADMIN_ROLES);

    // Desired roster: coach wins if a member id appears in both lists.
    const desired = new Map<string, 'skater' | 'coach'>();
    for (const id of body.skater_member_ids) desired.set(id, 'skater');
    for (const id of body.coach_member_ids) desired.set(id, 'coach');
    const desiredIds = [...desired.keys()];

    const updated = await withUser(c.get('claims'), async (tx) => {
      await teamWithMembers(tx, clubId, teamId); // 404 if team missing

      if (desiredIds.length > 0) {
        const known = await tx`
          select id from app.club_members
          where club_id = ${clubId} and deleted_at is null and id in ${tx(desiredIds)}`;
        if (known.length !== desiredIds.length) {
          throw problem(400, 'Bad Request', 'One or more member ids are not members of this club');
        }
      }

      // Upsert desired links (revive soft-deleted ones; unique is on (team_id, member_id)).
      for (const [memberId, role] of desired) {
        await tx`
          insert into app.team_members (club_id, team_id, member_id, role)
          values (${clubId}, ${teamId}, ${memberId}, ${role})
          on conflict (team_id, member_id)
          do update set role = excluded.role, deleted_at = null, updated_at = now()`;
      }

      // Soft-detach everyone no longer in the desired set.
      if (desiredIds.length > 0) {
        await tx`
          update app.team_members set deleted_at = now()
          where team_id = ${teamId} and deleted_at is null and member_id not in ${tx(desiredIds)}`;
      } else {
        await tx`
          update app.team_members set deleted_at = now()
          where team_id = ${teamId} and deleted_at is null`;
      }

      return teamWithMembers(tx, clubId, teamId);
    });

    return c.json(teamSchema.parse(updated), 200);
  },
);
