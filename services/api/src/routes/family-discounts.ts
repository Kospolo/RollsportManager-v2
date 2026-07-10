// ============================================================================
// routes/family-discounts.ts - Familien-Rabatte (v1 familien-rabatte.html).
// Sibling/family rebates: a percentage (e.g. "ab dem 2. Kind 50 %") or a fixed
// cent amount, kicking in from the applies_from_child-th child.
//
//   * GET    /family-discounts       read = any club member (part of the fee
//            model); RLS is the second gate.
//   * POST   /family-discounts       create = can_manage_finance.
//   * PATCH  /family-discounts/{id}   edit   = can_manage_finance.
//   * DELETE /family-discounts/{id}   soft-delete = can_manage_finance.
// ============================================================================

import { createRoute, z } from '@hono/zod-openapi';
import { createRouter, errorResponses, jsonContent } from '../lib/openapi.js';
import {
  deletedSchema,
  familyDiscountCreateSchema,
  familyDiscountSchema,
  familyDiscountUpdateSchema,
  uuid,
} from '../lib/validation.js';
import { withUser } from '../db.js';
import { problem } from '../middleware/error.js';
import { FINANCE_ROLES, requireClubMember, requireClubRole } from '../lib/guards.js';

export const familyDiscountsRouter = createRouter();

const discountIdParam = z.object({
  discountId: uuid.openapi({ param: { name: 'discountId', in: 'path' } }),
});

// ---------------------------------------------------------------------------
// GET /family-discounts - the active rebates (not soft-deleted).
// ---------------------------------------------------------------------------
familyDiscountsRouter.openapi(
  createRoute({
    method: 'get',
    path: '/family-discounts',
    tags: ['family-discounts'],
    summary: 'Family/sibling discounts of a club (any club member may read)',
    description:
      'kind=percent → value_numeric is a percentage (0–100); kind=fixed → value_numeric ' +
      'is a fixed cent amount. applies_from_child = the ordinal the rebate starts at ("ab ' +
      'dem 2. Kind" → 2). Readable by every member; only finance may edit.',
    security: [{ bearerAuth: [] }],
    request: { query: z.object({ club_id: uuid }) },
    responses: {
      200: jsonContent(z.array(familyDiscountSchema), 'Discounts by applies_from_child'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const { club_id } = c.req.valid('query');
    requireClubMember(c.get('claims'), club_id);
    const rows = await withUser(c.get('claims'), (tx) =>
      tx`select * from app.family_discounts
         where club_id = ${club_id} and deleted_at is null
         order by applies_from_child, label`,
    );
    return c.json(z.array(familyDiscountSchema).parse(rows), 200);
  },
);

// ---------------------------------------------------------------------------
// POST /family-discounts - create a rebate (can_manage_finance).
// ---------------------------------------------------------------------------
familyDiscountsRouter.openapi(
  createRoute({
    method: 'post',
    path: '/family-discounts',
    tags: ['family-discounts'],
    summary: 'Create a family discount (can_manage_finance)',
    security: [{ bearerAuth: [] }],
    request: {
      body: { content: { 'application/json': { schema: familyDiscountCreateSchema } }, required: true },
    },
    responses: {
      201: jsonContent(familyDiscountSchema, 'The created discount'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const body = c.req.valid('json');
    const claims = c.get('claims');
    requireClubRole(claims, body.club_id, FINANCE_ROLES);
    const created = await withUser(claims, async (tx) => {
      const rows = await tx`
        insert into app.family_discounts (club_id, label, kind, value_numeric, applies_from_child, is_active)
        values (${body.club_id}, ${body.label}, ${body.kind}, ${body.value_numeric},
                ${body.applies_from_child}, ${body.is_active})
        returning *`;
      if (rows.length === 0) throw problem(403, 'Forbidden', 'Discount create rejected (finance role required)');
      return rows[0];
    });
    return c.json(familyDiscountSchema.parse(created), 201);
  },
);

// ---------------------------------------------------------------------------
// PATCH /family-discounts/{id} - edit (can_manage_finance).
// ---------------------------------------------------------------------------
familyDiscountsRouter.openapi(
  createRoute({
    method: 'patch',
    path: '/family-discounts/{discountId}',
    tags: ['family-discounts'],
    summary: 'Update a family discount (can_manage_finance)',
    security: [{ bearerAuth: [] }],
    request: {
      params: discountIdParam,
      body: { content: { 'application/json': { schema: familyDiscountUpdateSchema } }, required: true },
    },
    responses: {
      200: jsonContent(familyDiscountSchema, 'The updated discount'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const { discountId } = c.req.valid('param');
    const body = c.req.valid('json');
    const claims = c.get('claims');

    const updated = await withUser(claims, async (tx) => {
      const found = await tx`
        select club_id from app.family_discounts where id = ${discountId} and deleted_at is null`;
      const row = found[0] as { club_id: string } | undefined;
      if (!row) throw problem(404, 'Not Found', 'Discount not found');
      requireClubRole(claims, row.club_id, FINANCE_ROLES);

      const rows = await tx`
        update app.family_discounts set
          label              = coalesce(${body.label ?? null}, label),
          kind               = coalesce(${body.kind ?? null}, kind),
          value_numeric      = coalesce(${body.value_numeric ?? null}, value_numeric),
          applies_from_child = coalesce(${body.applies_from_child ?? null}, applies_from_child),
          is_active          = coalesce(${body.is_active ?? null}, is_active)
        where id = ${discountId} and deleted_at is null
        returning *`;
      if (rows.length === 0) throw problem(403, 'Forbidden', 'Update rejected (finance role required)');
      return rows[0];
    });
    return c.json(familyDiscountSchema.parse(updated), 200);
  },
);

// ---------------------------------------------------------------------------
// DELETE /family-discounts/{id} - soft-delete (can_manage_finance).
// ---------------------------------------------------------------------------
familyDiscountsRouter.openapi(
  createRoute({
    method: 'delete',
    path: '/family-discounts/{discountId}',
    tags: ['family-discounts'],
    summary: 'Soft-delete a family discount (can_manage_finance)',
    security: [{ bearerAuth: [] }],
    request: { params: discountIdParam },
    responses: {
      200: jsonContent(deletedSchema, 'Discount soft-deleted'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const { discountId } = c.req.valid('param');
    const claims = c.get('claims');
    await withUser(claims, async (tx) => {
      const found = await tx`
        select club_id from app.family_discounts where id = ${discountId} and deleted_at is null`;
      const row = found[0] as { club_id: string } | undefined;
      if (!row) throw problem(404, 'Not Found', 'Discount not found');
      requireClubRole(claims, row.club_id, FINANCE_ROLES);
      const rows = await tx`
        update app.family_discounts set deleted_at = now()
        where id = ${discountId} and deleted_at is null
        returning id`;
      if (rows.length === 0) throw problem(403, 'Forbidden', 'Delete rejected (finance role required)');
    });
    return c.json({ status: 'deleted' as const, id: discountId }, 200);
  },
);
