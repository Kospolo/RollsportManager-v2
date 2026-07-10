// ============================================================================
// routes/members.ts - roster of a club: list, create, invite (stub), and the
// role-change endpoint that closes the v1 gap:
//   * only owner/admin may change roles,
//   * nobody changes their OWN role,
//   * owner rows only by owners,
//   * the LAST owner can never be demoted (API-level rule).
// The UPDATE itself runs impersonated, so the protect_club_membership trigger
// fires as second line of defense.
// ============================================================================

import { createRoute, z } from '@hono/zod-openapi';
import { createRouter, errorResponses, jsonContent } from '../lib/openapi.js';
import {
  guardianshipSchema,
  inviteSchema,
  memberCreateSchema,
  memberSchema,
  roleChangeSchema,
  uuid,
} from '../lib/validation.js';
import { withUser } from '../db.js';
import type { Tx } from '../db.js';
import { problem } from '../middleware/error.js';
import {
  ADMIN_ROLES,
  checkRoleChange,
  requireClubMember,
  requireClubRole,
} from '../lib/guards.js';
import type { ClubRole } from '../middleware/auth.js';

export const membersRouter = createRouter();

const clubIdParam = z.object({ clubId: uuid.openapi({ param: { name: 'clubId', in: 'path' } }) });
const memberParams = z.object({
  clubId: uuid.openapi({ param: { name: 'clubId', in: 'path' } }),
  memberId: uuid.openapi({ param: { name: 'memberId', in: 'path' } }),
});

/** team_ids of one member (app.team_members, soft-deleted excluded). */
async function teamIdsOf(tx: Tx, memberId: string): Promise<unknown> {
  const rows = await tx`
    select coalesce(jsonb_agg(tm.team_id order by tm.created_at), '[]'::jsonb) as ids
    from app.team_members tm
    where tm.member_id = ${memberId} and tm.deleted_at is null`;
  return rows[0]?.['ids'] ?? [];
}

membersRouter.openapi(
  createRoute({
    method: 'get',
    path: '/clubs/{clubId}/members',
    tags: ['members'],
    summary: 'List the club roster',
    security: [{ bearerAuth: [] }],
    request: { params: clubIdParam },
    responses: {
      200: jsonContent(z.array(memberSchema), 'Active membership rows'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const { clubId } = c.req.valid('param');
    requireClubMember(c.get('claims'), clubId);
    const rows = await withUser(c.get('claims'), (tx) =>
      tx`select m.*,
           coalesce((select jsonb_agg(tm.team_id order by tm.created_at)
                     from app.team_members tm
                     where tm.member_id = m.id and tm.deleted_at is null),
                    '[]'::jsonb) as team_ids
         from app.club_members m
         where m.club_id = ${clubId} and m.deleted_at is null
         order by m.last_name, m.first_name`,
    );
    return c.json(z.array(memberSchema).parse(rows), 200);
  },
);

membersRouter.openapi(
  createRoute({
    method: 'post',
    path: '/clubs/{clubId}/members',
    tags: ['members'],
    summary: 'Create a membership row (owner/admin)',
    description:
      'Creates a person in the roster (e.g. a child without an account). The owner role is never assignable here.',
    security: [{ bearerAuth: [] }],
    request: {
      params: clubIdParam,
      body: { content: { 'application/json': { schema: memberCreateSchema } }, required: true },
    },
    responses: {
      201: jsonContent(memberSchema, 'Created membership'),
      409: jsonContent(z.object({}).passthrough(), 'Duplicate'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const { clubId } = c.req.valid('param');
    const body = c.req.valid('json');
    requireClubRole(c.get('claims'), clubId, ADMIN_ROLES);

    const rows = await withUser(c.get('claims'), (tx) =>
      tx`insert into app.club_members
           (club_id, first_name, last_name, email, birth_date, role, status, joined_on, valid_until)
         values
           (${clubId}, ${body.first_name}, ${body.last_name}, ${body.email ?? null},
            ${body.birth_date ?? null}, ${body.role}, 'active',
            ${body.joined_on ?? null}, ${body.valid_until ?? null})
         returning *`,
    );
    // A brand-new membership row has no team links yet.
    return c.json(memberSchema.parse({ ...rows[0], team_ids: [] }), 201);
  },
);

membersRouter.openapi(
  createRoute({
    method: 'post',
    path: '/clubs/{clubId}/members/invite',
    tags: ['members'],
    summary: 'Invite a person by e-mail (stub, owner/admin)',
    description:
      'Phase-1 stub: validates and logs the invite. Mail delivery + join-code flow land with the portal phase.',
    security: [{ bearerAuth: [] }],
    request: {
      params: clubIdParam,
      body: { content: { 'application/json': { schema: inviteSchema } }, required: true },
    },
    responses: {
      202: jsonContent(
        z.object({ status: z.literal('queued'), email: z.string() }).openapi('InviteQueued'),
        'Invite accepted (stub)',
      ),
      ...errorResponses,
    },
  }),
  (c) => {
    const { clubId } = c.req.valid('param');
    const body = c.req.valid('json');
    requireClubRole(c.get('claims'), clubId, ADMIN_ROLES);
    console.info(
      `[members] invite stub: club=${clubId} email=${body.email} role=${body.role} (request ${c.get('requestId')})`,
    );
    return c.json({ status: 'queued' as const, email: body.email }, 202);
  },
);

membersRouter.openapi(
  createRoute({
    method: 'get',
    path: '/clubs/{clubId}/guardianships',
    tags: ['members'],
    summary: 'List guardianships (family model) of a club',
    description:
      'RLS-scoped: owner/admin see all relations, guardians/children only their own family rows.',
    security: [{ bearerAuth: [] }],
    request: { params: clubIdParam },
    responses: {
      200: jsonContent(z.array(guardianshipSchema), 'Guardianships visible to the caller'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const { clubId } = c.req.valid('param');
    requireClubMember(c.get('claims'), clubId);
    const rows = await withUser(c.get('claims'), (tx) =>
      tx`select * from app.guardianships
         where club_id = ${clubId} and deleted_at is null
         order by created_at`,
    );
    return c.json(z.array(guardianshipSchema).parse(rows), 200);
  },
);

membersRouter.openapi(
  createRoute({
    method: 'patch',
    path: '/clubs/{clubId}/members/{memberId}/role',
    tags: ['members'],
    summary: 'Change a member role (owner/admin; never self; last owner protected)',
    security: [{ bearerAuth: [] }],
    request: {
      params: memberParams,
      body: { content: { 'application/json': { schema: roleChangeSchema } }, required: true },
    },
    responses: {
      200: jsonContent(memberSchema, 'Updated membership'),
      409: jsonContent(z.object({}).passthrough(), 'Would remove the last owner'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const { clubId, memberId } = c.req.valid('param');
    const { role: newRole } = c.req.valid('json');
    const claims = c.get('claims');
    const callerRole = requireClubRole(claims, clubId, ADMIN_ROLES);

    const updated = await withUser(claims, async (tx) => {
      const targets = await tx`
        select id, role, profile_id from app.club_members
        where id = ${memberId} and club_id = ${clubId} and deleted_at is null`;
      const target = targets[0];
      if (!target) throw problem(404, 'Not Found', 'Membership not found');

      const owners = await tx`
        select count(*)::int as n from app.club_members
        where club_id = ${clubId} and role = 'owner'
          and status = 'active' and deleted_at is null`;

      const denial = checkRoleChange({
        callerRole,
        callerIsTarget: target['profile_id'] === claims.sub,
        targetRole: target['role'] as ClubRole,
        newRole,
        activeOwnerCount: (owners[0]?.['n'] as number | undefined) ?? 0,
      });
      if (denial) throw denial;

      // Impersonated UPDATE: protect_club_membership fires as defense in depth.
      const rows = await tx`
        update app.club_members set role = ${newRole}
        where id = ${memberId} returning *`;
      return { ...rows[0], team_ids: await teamIdsOf(tx, memberId) };
    });

    return c.json(memberSchema.parse(updated), 200);
  },
);
