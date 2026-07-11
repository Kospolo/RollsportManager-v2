// ============================================================================
// routes/departments.ts - "Abteilungen" (v1 abteilungen.html).
//
// Read: every club member (is_club_member). Create/edit/delete a department:
// is_club_admin (owner/admin/moderator). Assigning members to a department is
// TRAINER work (is_club_trainer) via PUT /departments/{id}/members - a coach
// may sort skaters into departments without being a club admin (Referenz 1.3).
//
// Deletes are SOFT (deleted_at); the RLS policies (migration 0017) are the
// second line of defense behind the API role guards (Blueprint risk #16).
// ============================================================================

import { createRoute, z } from '@hono/zod-openapi';
import { createRouter, errorResponses, jsonContent } from '../lib/openapi.js';
import {
  departmentCreateSchema,
  departmentMembersSetSchema,
  departmentSchema,
  departmentUpdateSchema,
  deletedSchema,
  uuid,
} from '../lib/validation.js';
import { withUser } from '../db.js';
import type { Tx } from '../db.js';
import { problem } from '../middleware/error.js';
import { ADMIN_ROLES, COACH_ROLES, requireClubMember, requireClubRole } from '../lib/guards.js';

export const departmentsRouter = createRouter();

const departmentIdParam = z.object({
  departmentId: uuid.openapi({ param: { name: 'departmentId', in: 'path' } }),
});

/** Load one department incl. its member_ids, or 404 when invisible/absent. */
async function departmentWithMembers(tx: Tx, departmentId: string): Promise<Record<string, unknown>> {
  const rows = await tx`
    select d.*,
           coalesce(
             (select array_agg(dm.member_id order by dm.created_at)
              from app.department_members dm
              where dm.department_id = d.id and dm.deleted_at is null),
             '{}'
           ) as member_ids
    from app.departments d
    where d.id = ${departmentId} and d.deleted_at is null`;
  const row = rows[0];
  if (!row) throw problem(404, 'Not Found', 'Department not found');
  return row as Record<string, unknown>;
}

departmentsRouter.openapi(
  createRoute({
    method: 'get',
    path: '/departments',
    tags: ['departments'],
    summary: 'List club departments (is_club_member)',
    security: [{ bearerAuth: [] }],
    request: { query: z.object({ club_id: uuid }) },
    responses: {
      200: jsonContent(z.array(departmentSchema), 'Departments visible to the caller'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const { club_id } = c.req.valid('query');
    requireClubMember(c.get('claims'), club_id);
    const rows = await withUser(c.get('claims'), (tx) =>
      tx`select d.*,
                coalesce(
                  (select array_agg(dm.member_id order by dm.created_at)
                   from app.department_members dm
                   where dm.department_id = d.id and dm.deleted_at is null),
                  '{}'
                ) as member_ids
         from app.departments d
         where d.club_id = ${club_id} and d.deleted_at is null
         order by d.sort_order, d.name`,
    );
    return c.json(z.array(departmentSchema).parse(rows), 200);
  },
);

departmentsRouter.openapi(
  createRoute({
    method: 'post',
    path: '/departments',
    tags: ['departments'],
    summary: 'Create a department (is_club_admin)',
    security: [{ bearerAuth: [] }],
    request: {
      body: { content: { 'application/json': { schema: departmentCreateSchema } }, required: true },
    },
    responses: {
      201: jsonContent(departmentSchema, 'Created department'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const body = c.req.valid('json');
    const claims = c.get('claims');
    requireClubRole(claims, body.club_id, ADMIN_ROLES);

    const created = await withUser(claims, async (tx) => {
      const rows = await tx`
        insert into app.departments (club_id, name, description, lead_member_id, sort_order)
        values (${body.club_id}, ${body.name}, ${body.description ?? null},
                ${body.lead_member_id ?? null}, ${body.sort_order})
        returning id`;
      const id = rows[0]?.['id'] as string;
      return departmentWithMembers(tx, id);
    });
    return c.json(departmentSchema.parse(created), 201);
  },
);

departmentsRouter.openapi(
  createRoute({
    method: 'patch',
    path: '/departments/{departmentId}',
    tags: ['departments'],
    summary: 'Edit a department (is_club_admin)',
    security: [{ bearerAuth: [] }],
    request: {
      params: departmentIdParam,
      body: { content: { 'application/json': { schema: departmentUpdateSchema } }, required: true },
    },
    responses: {
      200: jsonContent(departmentSchema, 'Updated department'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const { departmentId } = c.req.valid('param');
    const body = c.req.valid('json');
    const claims = c.get('claims');

    const updated = await withUser(claims, async (tx) => {
      const dept = await departmentWithMembers(tx, departmentId);
      requireClubRole(claims, dept['club_id'] as string, ADMIN_ROLES);
      const rows = await tx`
        update app.departments set ${tx(body)}
        where id = ${departmentId} and deleted_at is null
        returning id`;
      if (rows.length === 0) throw problem(403, 'Forbidden', 'Editing a department requires a club admin');
      return departmentWithMembers(tx, departmentId);
    });
    return c.json(departmentSchema.parse(updated), 200);
  },
);

departmentsRouter.openapi(
  createRoute({
    method: 'delete',
    path: '/departments/{departmentId}',
    tags: ['departments'],
    summary: 'Soft-delete a department (is_club_admin)',
    security: [{ bearerAuth: [] }],
    request: { params: departmentIdParam },
    responses: {
      200: jsonContent(deletedSchema, 'Department soft-deleted'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const { departmentId } = c.req.valid('param');
    const claims = c.get('claims');

    await withUser(claims, async (tx) => {
      const dept = await departmentWithMembers(tx, departmentId);
      requireClubRole(claims, dept['club_id'] as string, ADMIN_ROLES);
      // Detach roster links so the department stops appearing in members' lists.
      await tx`
        update app.department_members set deleted_at = now()
        where department_id = ${departmentId} and deleted_at is null`;
      const rows = await tx`
        update app.departments set deleted_at = now()
        where id = ${departmentId} and deleted_at is null
        returning id`;
      if (rows.length === 0) throw problem(403, 'Forbidden', 'Deleting a department requires a club admin');
    });
    return c.json({ status: 'deleted' as const, id: departmentId }, 200);
  },
);

departmentsRouter.openapi(
  createRoute({
    method: 'put',
    path: '/departments/{departmentId}/members',
    tags: ['departments'],
    summary: 'Replace a department roster (is_club_trainer)',
    description:
      'Full replace. Member ids must belong to the department\'s club. Missing members are soft-detached; ' +
      'previously removed members are revived. Assigning is trainer work (is_club_trainer).',
    security: [{ bearerAuth: [] }],
    request: {
      params: departmentIdParam,
      body: { content: { 'application/json': { schema: departmentMembersSetSchema } }, required: true },
    },
    responses: {
      200: jsonContent(departmentSchema, 'Updated department incl. roster'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const { departmentId } = c.req.valid('param');
    const body = c.req.valid('json');
    const claims = c.get('claims');

    const desiredIds = [...new Set(body.member_ids)];

    const updated = await withUser(claims, async (tx) => {
      const dept = await departmentWithMembers(tx, departmentId);
      const clubId = dept['club_id'] as string;
      requireClubRole(claims, clubId, COACH_ROLES);

      if (desiredIds.length > 0) {
        const known = await tx`
          select id from app.club_members
          where club_id = ${clubId} and deleted_at is null and id in ${tx(desiredIds)}`;
        if (known.length !== desiredIds.length) {
          throw problem(400, 'Bad Request', 'One or more member ids are not members of this club');
        }
      }

      // Upsert desired links (revive soft-deleted ones; unique is on (department_id, member_id)).
      for (const memberId of desiredIds) {
        await tx`
          insert into app.department_members (club_id, department_id, member_id)
          values (${clubId}, ${departmentId}, ${memberId})
          on conflict (department_id, member_id)
          do update set deleted_at = null`;
      }

      // Soft-detach everyone no longer in the desired set.
      if (desiredIds.length > 0) {
        await tx`
          update app.department_members set deleted_at = now()
          where department_id = ${departmentId} and deleted_at is null
            and member_id not in ${tx(desiredIds)}`;
      } else {
        await tx`
          update app.department_members set deleted_at = now()
          where department_id = ${departmentId} and deleted_at is null`;
      }

      return departmentWithMembers(tx, departmentId);
    });
    return c.json(departmentSchema.parse(updated), 200);
  },
);
