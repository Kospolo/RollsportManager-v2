// ============================================================================
// routes/member-fees.ts - Beitragszuordnung (v1 mitglieder-beitraege.html).
// Assigns a fee category to a member for a validity window, with an optional
// per-member override amount.
//
//   * GET    /member-fees?club_id[&member_id]  RLS: finance sees all, a member
//            sees only their OWN (and a guardian their children's) assignments.
//   * GET    /member-fees/summary?club_id       expected annual fee income by
//            period (can_manage_finance).
//   * POST   /member-fees                        create = can_manage_finance.
//   * PATCH  /member-fees/{feeId}                edit   = can_manage_finance.
//   * DELETE /member-fees/{feeId}                soft-delete = can_manage_finance.
// ============================================================================

import { createRoute, z } from '@hono/zod-openapi';
import { createRouter, errorResponses, jsonContent } from '../lib/openapi.js';
import {
  deletedSchema,
  memberFeeCreateSchema,
  memberFeeSchema,
  memberFeeSummarySchema,
  memberFeeUpdateSchema,
  membershipPeriodSchema,
  uuid,
} from '../lib/validation.js';
import { withUser } from '../db.js';
import type { Tx } from '../db.js';
import { problem } from '../middleware/error.js';
import { FINANCE_ROLES, requireClubMember, requireClubRole } from '../lib/guards.js';
import type { AuthClaims } from '../middleware/auth.js';

export const memberFeesRouter = createRouter();

const feeIdParam = z.object({ feeId: uuid.openapi({ param: { name: 'feeId', in: 'path' } }) });

/** Annualisation multiplier per billing period (once = not recurring). */
const ANNUAL_MULTIPLIER: Record<z.infer<typeof membershipPeriodSchema>, number> = {
  monthly: 12,
  quarterly: 4,
  yearly: 1,
  once: 0,
};

/** A given category must belong to the SAME club (avoid cross-tenant leaks). */
async function assertCategoryInClub(tx: Tx, categoryId: string, clubId: string): Promise<void> {
  const cats = await tx`
    select 1 from app.membership_categories
    where id = ${categoryId} and club_id = ${clubId} and deleted_at is null`;
  if (cats.length === 0) throw problem(422, 'Unprocessable Entity', 'category_id does not belong to this club');
}

/** The member row must belong to the SAME club. */
async function assertMemberInClub(tx: Tx, memberId: string, clubId: string): Promise<void> {
  const members = await tx`
    select 1 from app.club_members
    where id = ${memberId} and club_id = ${clubId} and deleted_at is null`;
  if (members.length === 0) throw problem(422, 'Unprocessable Entity', 'member_id does not belong to this club');
}

// ---------------------------------------------------------------------------
// GET /member-fees/summary - expected annual fee income by period. Registered
// before the parameterised routes so "summary" is never read as an id.
// ---------------------------------------------------------------------------
memberFeesRouter.openapi(
  createRoute({
    method: 'get',
    path: '/member-fees/summary',
    tags: ['member-fees'],
    summary: 'Expected annual fee income by period (can_manage_finance)',
    description:
      'Aggregates the currently valid, active fee assignments. Effective amount = ' +
      'custom_amount_cents when set, else the category amount. annual_cents annualises ' +
      'each period (monthly×12, quarterly×4, yearly×1, once excluded from the recurring total).',
    security: [{ bearerAuth: [] }],
    request: { query: z.object({ club_id: uuid }) },
    responses: {
      200: jsonContent(memberFeeSummarySchema, 'Per-period breakdown + total annual income'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const { club_id } = c.req.valid('query');
    const claims = c.get('claims');
    requireClubRole(claims, club_id, FINANCE_ROLES);

    const rows = await withUser(claims, (tx) =>
      tx`select mc.period,
                count(*)::bigint as count,
                sum(coalesce(mf.custom_amount_cents, mc.amount_cents))::bigint as amount_cents,
                sum(coalesce(mf.custom_amount_cents, mc.amount_cents)
                    * case mc.period
                        when 'monthly'   then 12
                        when 'quarterly' then 4
                        when 'yearly'    then 1
                        else 0
                      end)::bigint as annual_cents
         from app.member_fees mf
         join app.membership_categories mc on mc.id = mf.category_id
         where mf.club_id = ${club_id}
           and mf.deleted_at is null
           and (mf.valid_until is null or mf.valid_until >= current_date)
         group by mc.period`,
    );

    const by_period = (rows as unknown as Array<{ period: string; count: string; amount_cents: string; annual_cents: string }>).map(
      (r) => ({
        period: r.period as z.infer<typeof membershipPeriodSchema>,
        count: Number(r.count),
        amount_cents: Number(r.amount_cents),
        annual_cents: Number(r.annual_cents),
      }),
    );
    const total_annual_cents = by_period.reduce((sum, b) => sum + b.annual_cents, 0);

    return c.json(memberFeeSummarySchema.parse({ club_id, by_period, total_annual_cents }), 200);
  },
);

// ---------------------------------------------------------------------------
// GET /member-fees - RLS restricts a plain member to their own assignments.
// ---------------------------------------------------------------------------
memberFeesRouter.openapi(
  createRoute({
    method: 'get',
    path: '/member-fees',
    tags: ['member-fees'],
    summary: 'List fee assignments (RLS: finance sees all, members their own/children)',
    description:
      'Optional member_id filter. A plain member only ever sees their own / their ' +
      "children's assignments regardless of the filter (RLS). Left-joins the category.",
    security: [{ bearerAuth: [] }],
    request: {
      query: z.object({ club_id: uuid, member_id: uuid.optional() }),
    },
    responses: {
      200: jsonContent(z.array(memberFeeSchema), 'Fee assignments visible to the caller'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const { club_id, member_id } = c.req.valid('query');
    requireClubMember(c.get('claims'), club_id);
    const rows = await withUser(c.get('claims'), (tx) =>
      tx`select mf.*, mc.name as category_name, mc.amount_cents as category_amount_cents,
                mc.period as category_period
         from app.member_fees mf
         join app.membership_categories mc on mc.id = mf.category_id
         where mf.club_id = ${club_id}
           and mf.deleted_at is null
           and (${member_id ?? null}::uuid is null or mf.member_id = ${member_id ?? null}::uuid)
         order by mf.valid_from desc, mf.created_at desc`,
    );
    return c.json(z.array(memberFeeSchema).parse(rows), 200);
  },
);

// ---------------------------------------------------------------------------
// POST /member-fees - create an assignment (can_manage_finance).
// ---------------------------------------------------------------------------
memberFeesRouter.openapi(
  createRoute({
    method: 'post',
    path: '/member-fees',
    tags: ['member-fees'],
    summary: 'Assign a fee category to a member (can_manage_finance)',
    security: [{ bearerAuth: [] }],
    request: {
      body: { content: { 'application/json': { schema: memberFeeCreateSchema } }, required: true },
    },
    responses: {
      201: jsonContent(memberFeeSchema, 'The created assignment'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const body = c.req.valid('json');
    const claims = c.get('claims');
    requireClubRole(claims, body.club_id, FINANCE_ROLES);
    const created = await withUser(claims, async (tx) => {
      await assertMemberInClub(tx, body.member_id, body.club_id);
      await assertCategoryInClub(tx, body.category_id, body.club_id);
      const rows = await tx`
        insert into app.member_fees
          (club_id, member_id, category_id, custom_amount_cents, valid_from, valid_until)
        values
          (${body.club_id}, ${body.member_id}, ${body.category_id},
           ${body.custom_amount_cents ?? null}::bigint, ${body.valid_from}, ${body.valid_until ?? null})
        returning *`;
      if (rows.length === 0) throw problem(403, 'Forbidden', 'Assignment rejected (finance role required)');
      return rows[0];
    });
    return c.json(memberFeeSchema.parse(created), 201);
  },
);

// ---------------------------------------------------------------------------
// PATCH /member-fees/{feeId} - edit (can_manage_finance).
// ---------------------------------------------------------------------------
memberFeesRouter.openapi(
  createRoute({
    method: 'patch',
    path: '/member-fees/{feeId}',
    tags: ['member-fees'],
    summary: 'Update a fee assignment (can_manage_finance)',
    security: [{ bearerAuth: [] }],
    request: {
      params: feeIdParam,
      body: { content: { 'application/json': { schema: memberFeeUpdateSchema } }, required: true },
    },
    responses: {
      200: jsonContent(memberFeeSchema, 'The updated assignment'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const { feeId } = c.req.valid('param');
    const body = c.req.valid('json');
    const claims = c.get('claims');

    const updated = await withUser(claims, async (tx) => {
      const found = await tx`
        select club_id from app.member_fees where id = ${feeId} and deleted_at is null`;
      const row = found[0] as { club_id: string } | undefined;
      if (!row) throw problem(404, 'Not Found', 'Fee assignment not found');
      requireClubRole(claims, row.club_id, FINANCE_ROLES);
      if (body.category_id !== undefined) await assertCategoryInClub(tx, body.category_id, row.club_id);

      const rows = await tx`
        update app.member_fees set
          category_id         = coalesce(${body.category_id ?? null}, category_id),
          custom_amount_cents = ${body.custom_amount_cents === undefined ? tx`custom_amount_cents` : body.custom_amount_cents}::bigint,
          valid_from          = coalesce(${body.valid_from ?? null}, valid_from),
          valid_until         = ${body.valid_until === undefined ? tx`valid_until` : body.valid_until}
        where id = ${feeId} and deleted_at is null
        returning *`;
      if (rows.length === 0) throw problem(403, 'Forbidden', 'Update rejected (finance role required)');
      return rows[0];
    });
    return c.json(memberFeeSchema.parse(updated), 200);
  },
);

// ---------------------------------------------------------------------------
// DELETE /member-fees/{feeId} - soft-delete (can_manage_finance).
// ---------------------------------------------------------------------------
memberFeesRouter.openapi(
  createRoute({
    method: 'delete',
    path: '/member-fees/{feeId}',
    tags: ['member-fees'],
    summary: 'Soft-delete a fee assignment (can_manage_finance)',
    security: [{ bearerAuth: [] }],
    request: { params: feeIdParam },
    responses: {
      200: jsonContent(deletedSchema, 'Assignment soft-deleted'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const { feeId } = c.req.valid('param');
    const claims = c.get('claims');
    await withUser(claims, async (tx) => {
      const found = await tx`
        select club_id from app.member_fees where id = ${feeId} and deleted_at is null`;
      const row = found[0] as { club_id: string } | undefined;
      if (!row) throw problem(404, 'Not Found', 'Fee assignment not found');
      requireClubRole(claims, row.club_id, FINANCE_ROLES);
      const rows = await tx`
        update app.member_fees set deleted_at = now()
        where id = ${feeId} and deleted_at is null
        returning id`;
      if (rows.length === 0) throw problem(403, 'Forbidden', 'Delete rejected (finance role required)');
    });
    return c.json({ status: 'deleted' as const, id: feeId }, 200);
  },
);
