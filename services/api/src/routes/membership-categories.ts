// ============================================================================
// routes/membership-categories.ts - Beitragskategorien (v1 membership-
// categories.html). The club's fee catalog: each category has an amount and a
// billing period (monthly/quarterly/yearly/once).
//
//   * GET    /membership-categories        read = any club member (the fee
//            model is public within the club); RLS is the second gate.
//   * POST   /membership-categories        create = can_manage_finance.
//   * PATCH  /membership-categories/{id}    edit   = can_manage_finance.
//   * DELETE /membership-categories/{id}    soft-delete = can_manage_finance.
//
// RLS + the finance capability helper (migration 0014) stay the second line of
// defense via impersonation (src/db.ts).
// ============================================================================

import { createRoute, z } from '@hono/zod-openapi';
import { createRouter, errorResponses, jsonContent } from '../lib/openapi.js';
import {
  deletedSchema,
  membershipCategoryCreateSchema,
  membershipCategorySchema,
  membershipCategoryUpdateSchema,
  uuid,
} from '../lib/validation.js';
import { withUser } from '../db.js';
import { problem } from '../middleware/error.js';
import { FINANCE_ROLES, requireClubMember, requireClubRole } from '../lib/guards.js';

export const membershipCategoriesRouter = createRouter();

const categoryIdParam = z.object({
  categoryId: uuid.openapi({ param: { name: 'categoryId', in: 'path' } }),
});

// ---------------------------------------------------------------------------
// GET /membership-categories - the fee catalog (active, not soft-deleted).
// ---------------------------------------------------------------------------
membershipCategoriesRouter.openapi(
  createRoute({
    method: 'get',
    path: '/membership-categories',
    tags: ['membership-categories'],
    summary: 'Fee catalog of a club (any club member may read)',
    description:
      'The public fee model of the club: name, amount_cents and billing period. ' +
      'Readable by every club member (RLS: is_club_member); only finance roles may edit.',
    security: [{ bearerAuth: [] }],
    request: { query: z.object({ club_id: uuid }) },
    responses: {
      200: jsonContent(z.array(membershipCategorySchema), 'Categories by sort_order'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const { club_id } = c.req.valid('query');
    requireClubMember(c.get('claims'), club_id);
    const rows = await withUser(c.get('claims'), (tx) =>
      tx`select * from app.membership_categories
         where club_id = ${club_id} and deleted_at is null
         order by sort_order, name`,
    );
    return c.json(z.array(membershipCategorySchema).parse(rows), 200);
  },
);

// ---------------------------------------------------------------------------
// POST /membership-categories - create a category (can_manage_finance).
// ---------------------------------------------------------------------------
membershipCategoriesRouter.openapi(
  createRoute({
    method: 'post',
    path: '/membership-categories',
    tags: ['membership-categories'],
    summary: 'Create a fee category (can_manage_finance)',
    security: [{ bearerAuth: [] }],
    request: {
      body: { content: { 'application/json': { schema: membershipCategoryCreateSchema } }, required: true },
    },
    responses: {
      201: jsonContent(membershipCategorySchema, 'The created category'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const body = c.req.valid('json');
    const claims = c.get('claims');
    requireClubRole(claims, body.club_id, FINANCE_ROLES);
    const created = await withUser(claims, async (tx) => {
      const rows = await tx`
        insert into app.membership_categories (club_id, name, amount_cents, period, is_active, sort_order)
        values (${body.club_id}, ${body.name}, ${body.amount_cents}::bigint, ${body.period},
                ${body.is_active}, ${body.sort_order})
        returning *`;
      if (rows.length === 0) throw problem(403, 'Forbidden', 'Category create rejected (finance role required)');
      return rows[0];
    });
    return c.json(membershipCategorySchema.parse(created), 201);
  },
);

// ---------------------------------------------------------------------------
// PATCH /membership-categories/{id} - edit (can_manage_finance).
// ---------------------------------------------------------------------------
membershipCategoriesRouter.openapi(
  createRoute({
    method: 'patch',
    path: '/membership-categories/{categoryId}',
    tags: ['membership-categories'],
    summary: 'Update a fee category (can_manage_finance)',
    security: [{ bearerAuth: [] }],
    request: {
      params: categoryIdParam,
      body: { content: { 'application/json': { schema: membershipCategoryUpdateSchema } }, required: true },
    },
    responses: {
      200: jsonContent(membershipCategorySchema, 'The updated category'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const { categoryId } = c.req.valid('param');
    const body = c.req.valid('json');
    const claims = c.get('claims');

    const updated = await withUser(claims, async (tx) => {
      const found = await tx`
        select club_id from app.membership_categories where id = ${categoryId} and deleted_at is null`;
      const row = found[0] as { club_id: string } | undefined;
      if (!row) throw problem(404, 'Not Found', 'Category not found');
      requireClubRole(claims, row.club_id, FINANCE_ROLES);

      const rows = await tx`
        update app.membership_categories set
          name         = coalesce(${body.name ?? null}, name),
          amount_cents = coalesce(${body.amount_cents ?? null}::bigint, amount_cents),
          period       = coalesce(${body.period ?? null}, period),
          is_active    = coalesce(${body.is_active ?? null}, is_active),
          sort_order   = coalesce(${body.sort_order ?? null}, sort_order)
        where id = ${categoryId} and deleted_at is null
        returning *`;
      if (rows.length === 0) throw problem(403, 'Forbidden', 'Update rejected (finance role required)');
      return rows[0];
    });
    return c.json(membershipCategorySchema.parse(updated), 200);
  },
);

// ---------------------------------------------------------------------------
// DELETE /membership-categories/{id} - soft-delete (can_manage_finance).
// The FK from member_fees is RESTRICT, but soft-delete only flips deleted_at,
// so historic assignments keep resolving to the retired category.
// ---------------------------------------------------------------------------
membershipCategoriesRouter.openapi(
  createRoute({
    method: 'delete',
    path: '/membership-categories/{categoryId}',
    tags: ['membership-categories'],
    summary: 'Soft-delete a fee category (can_manage_finance)',
    security: [{ bearerAuth: [] }],
    request: { params: categoryIdParam },
    responses: {
      200: jsonContent(deletedSchema, 'Category soft-deleted'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const { categoryId } = c.req.valid('param');
    const claims = c.get('claims');
    await withUser(claims, async (tx) => {
      const found = await tx`
        select club_id from app.membership_categories where id = ${categoryId} and deleted_at is null`;
      const row = found[0] as { club_id: string } | undefined;
      if (!row) throw problem(404, 'Not Found', 'Category not found');
      requireClubRole(claims, row.club_id, FINANCE_ROLES);
      const rows = await tx`
        update app.membership_categories set deleted_at = now()
        where id = ${categoryId} and deleted_at is null
        returning id`;
      if (rows.length === 0) throw problem(403, 'Forbidden', 'Delete rejected (finance role required)');
    });
    return c.json({ status: 'deleted' as const, id: categoryId }, 200);
  },
);
