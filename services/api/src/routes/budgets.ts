// ============================================================================
// routes/budgets.ts - Budget(-planung) (Referenz §4 "Budget", v1 budget.html).
//
//   GET    /budgets?club_id&year   the year's plan rows (per category).
//   POST   /budgets                create a plan row.
//   PATCH  /budgets/{id}           edit planned_cents / note.
//   DELETE /budgets/{id}           soft-delete a plan row.
//   GET    /reports/budget?club_id&year   PLAN vs. IST per category (variance).
//
// Rights: can_manage_finance (owner/admin/moderator/treasurer) throughout
// (Referenz 1.3). The CRUD runs impersonated (withUser) so the budgets RLS
// (migration 0020) is the second line of defense. The report aggregates the
// LEDGER too, which under RLS only owner/admin/treasurer may read (a moderator
// manages finance but not the Kassenbuch), so - like /reports/annual - it is
// computed in SERVICE MODE strictly scoped to the one verified club_id, with
// the FINANCE_ROLES gate as the sole authorization (logged reason).
// ============================================================================

import { createRoute, z } from '@hono/zod-openapi';
import { createRouter, errorResponses, jsonContent } from '../lib/openapi.js';
import {
  budgetCreateSchema,
  budgetReportSchema,
  budgetSchema,
  budgetUpdateSchema,
  deletedSchema,
  uuid,
} from '../lib/validation.js';
import { withServiceRole, withUser } from '../db.js';
import type { Tx } from '../db.js';
import { problem } from '../middleware/error.js';
import { FINANCE_ROLES, requireClubRole } from '../lib/guards.js';
import { requireCap } from '../lib/capabilities.js';

export const budgetsRouter = createRouter();

const budgetIdParam = z.object({
  budgetId: uuid.openapi({ param: { name: 'budgetId', in: 'path' } }),
});

async function loadBudget(tx: Tx, budgetId: string): Promise<{ id: string; club_id: string }> {
  const rows = await tx`
    select id, club_id from app.budgets
    where id = ${budgetId} and deleted_at is null`;
  const row = rows[0];
  if (!row) throw problem(404, 'Not Found', 'Budget not found');
  return row as { id: string; club_id: string };
}

budgetsRouter.openapi(
  createRoute({
    method: 'get',
    path: '/budgets',
    tags: ['budgets'],
    summary: 'List budget plan rows for a club/year (can_manage_finance)',
    security: [{ bearerAuth: [] }],
    request: {
      query: z.object({ club_id: uuid, year: z.coerce.number().int().min(2000).max(2100) }),
    },
    responses: {
      200: jsonContent(z.array(budgetSchema), 'Budget plan rows'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const { club_id, year } = c.req.valid('query');
    requireClubRole(c.get('claims'), club_id, FINANCE_ROLES);
    const rows = await withUser(c.get('claims'), (tx) =>
      tx`select * from app.budgets
         where club_id = ${club_id} and year = ${year} and deleted_at is null
         order by category_id`,
    );
    return c.json(z.array(budgetSchema).parse(rows), 200);
  },
);

budgetsRouter.openapi(
  createRoute({
    method: 'post',
    path: '/budgets',
    tags: ['budgets'],
    summary: 'Create a budget plan row (can_manage_finance)',
    security: [{ bearerAuth: [] }],
    request: {
      body: { content: { 'application/json': { schema: budgetCreateSchema } }, required: true },
    },
    responses: {
      201: jsonContent(budgetSchema, 'Created budget'),
      409: jsonContent(z.object({}).passthrough(), 'A plan for this club/year/category already exists'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const body = c.req.valid('json');
    requireClubRole(c.get('claims'), body.club_id, FINANCE_ROLES);
    const created = await withUser(c.get('claims'), async (tx) => {
      // The category must belong to the same club (integrity + tenancy).
      const cat = await tx`
        select id from app.ledger_categories
        where id = ${body.category_id} and club_id = ${body.club_id} and deleted_at is null`;
      if (cat.length === 0) throw problem(404, 'Not Found', 'Ledger category not found in this club');
      const rows = await tx`
        insert into app.budgets (club_id, year, category_id, planned_cents, note)
        values (${body.club_id}, ${body.year}, ${body.category_id}, ${body.planned_cents}, ${body.note ?? null})
        returning *`;
      return rows[0];
    });
    return c.json(budgetSchema.parse(created), 201);
  },
);

budgetsRouter.openapi(
  createRoute({
    method: 'patch',
    path: '/budgets/{budgetId}',
    tags: ['budgets'],
    summary: 'Edit a budget plan row (can_manage_finance)',
    security: [{ bearerAuth: [] }],
    request: {
      params: budgetIdParam,
      body: { content: { 'application/json': { schema: budgetUpdateSchema } }, required: true },
    },
    responses: {
      200: jsonContent(budgetSchema, 'Updated budget'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const { budgetId } = c.req.valid('param');
    const body = c.req.valid('json');
    const claims = c.get('claims');
    const updated = await withUser(claims, async (tx) => {
      const budget = await loadBudget(tx, budgetId);
      requireClubRole(claims, budget.club_id, FINANCE_ROLES);
      const rows = await tx`
        update app.budgets set ${tx(body)}
        where id = ${budgetId} and deleted_at is null
        returning *`;
      if (rows.length === 0) throw problem(404, 'Not Found', 'Budget not found');
      return rows[0];
    });
    return c.json(budgetSchema.parse(updated), 200);
  },
);

budgetsRouter.openapi(
  createRoute({
    method: 'delete',
    path: '/budgets/{budgetId}',
    tags: ['budgets'],
    summary: 'Soft-delete a budget plan row (can_manage_finance)',
    security: [{ bearerAuth: [] }],
    request: { params: budgetIdParam },
    responses: {
      200: jsonContent(deletedSchema, 'Budget soft-deleted'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const { budgetId } = c.req.valid('param');
    const claims = c.get('claims');
    await withUser(claims, async (tx) => {
      const budget = await loadBudget(tx, budgetId);
      requireClubRole(claims, budget.club_id, FINANCE_ROLES);
      await tx`update app.budgets set deleted_at = now() where id = ${budgetId}`;
    });
    return c.json({ status: 'deleted' as const, id: budgetId }, 200);
  },
);

// ---------------------------------------------------------------------------
// GET /reports/budget?club_id&year - PLAN vs. IST per category.
// planned_cents from app.budgets, actual_cents = signed ledger sum for the year
// per category, variance = actual - planned. Categories with a plan OR any
// booked amount appear; totals sum the rows.
// ---------------------------------------------------------------------------
budgetsRouter.openapi(
  createRoute({
    method: 'get',
    path: '/reports/budget',
    tags: ['budgets'],
    summary: 'Budget plan vs. actual per category (can_manage_finance)',
    security: [{ bearerAuth: [] }],
    request: {
      query: z.object({ club_id: uuid, year: z.coerce.number().int().min(2000).max(2100) }),
    },
    responses: {
      200: jsonContent(budgetReportSchema, 'Plan vs. actual, per category + totals'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const { club_id, year } = c.req.valid('query');
    const claims = c.get('claims');
    // SERVICE-MODE-ROUTE: RLS ist hier AUS -> dieser Guard ist die ALLEINIGE
    // Autorisierung. Seit Phase 2 DB-aufgeloest: Mehrfachrollen wirken und der
    // Mitgliedschafts-Gate aus 0025 greift. finance >= manage ist im Seed exakt
    // FINANCE_ROLES -> Rollenmenge unveraendert, keine Rechteaenderung.
    await requireCap(c, club_id, 'finance', 'manage');

    const report = await withServiceRole(
      `budget report club=${club_id} year=${year} (caller ${claims.sub})`,
      async (tx) => {
        // Full outer join of plan (budgets) and actual (ledger) per category so
        // a planned-but-unbooked and a booked-but-unplanned category both show.
        const rows = await tx`
          with plan as (
            select category_id, sum(planned_cents)::bigint as planned_cents
            from app.budgets
            where club_id = ${club_id} and year = ${year} and deleted_at is null
            group by category_id
          ),
          actual as (
            select category_id, sum(amount_cents)::bigint as actual_cents
            from app.ledger_entries
            where club_id = ${club_id} and extract(year from entry_on) = ${year}
              and category_id is not null
            group by category_id
          )
          select
            coalesce(p.category_id, a.category_id) as category_id,
            cat.name as category_name,
            cat.kind as kind,
            coalesce(p.planned_cents, 0)::bigint as planned_cents,
            coalesce(a.actual_cents, 0)::bigint  as actual_cents
          from plan p
          full outer join actual a on a.category_id = p.category_id
          left join app.ledger_categories cat on cat.id = coalesce(p.category_id, a.category_id)
          order by cat.kind nulls last, cat.name nulls last`;

        let plannedTotal = 0;
        let actualTotal = 0;
        const mapped = rows.map((r) => {
          const row = r as Record<string, unknown>;
          const planned = Number(row['planned_cents']);
          const actual = Number(row['actual_cents']);
          plannedTotal += planned;
          actualTotal += actual;
          return {
            category_id: row['category_id'] as string,
            category_name: (row['category_name'] as string | null) ?? null,
            kind: (row['kind'] as string | null) ?? null,
            planned_cents: planned,
            actual_cents: actual,
            variance_cents: actual - planned,
          };
        });

        return {
          club_id,
          year,
          rows: mapped,
          planned_total_cents: plannedTotal,
          actual_total_cents: actualTotal,
          variance_total_cents: actualTotal - plannedTotal,
        };
      },
    );

    return c.json(budgetReportSchema.parse(report), 200);
  },
);
