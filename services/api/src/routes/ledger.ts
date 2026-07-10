// ============================================================================
// routes/ledger.ts - Kassenbuch (cash book) money ops. All finance-role only
// (can_manage_finance = owner/admin/moderator/treasurer). RLS + the GoBD
// immutability trigger (0005) stay the second line of defense via impersonation.
//
//   * GET  /ledger                  journal + category join (newest first)
//   * POST /ledger                  append an entry (GoBD: append-only)
//   * GET  /ledger/categories       category catalog (0013)
//   * POST /ledger/categories       add a category
//   * POST /ledger/{entryId}/reverse  Storno = mirror row, never DELETE/UPDATE
// ============================================================================

import { createRoute, z } from '@hono/zod-openapi';
import { createRouter, errorResponses, jsonContent } from '../lib/openapi.js';
import {
  ledgerCategoryCreateSchema,
  ledgerCategorySchema,
  ledgerEntryCreateSchema,
  ledgerEntrySchema,
  ledgerReverseSchema,
  uuid,
} from '../lib/validation.js';
import { withUser } from '../db.js';
import { problem } from '../middleware/error.js';
import { FINANCE_ROLES, requireClubRole } from '../lib/guards.js';

export const ledgerRouter = createRouter();

const entryIdParam = z.object({ entryId: uuid.openapi({ param: { name: 'entryId', in: 'path' } }) });

// ---------------------------------------------------------------------------
// GET /ledger - the cash book with the structured category joined in.
// ---------------------------------------------------------------------------
ledgerRouter.openapi(
  createRoute({
    method: 'get',
    path: '/ledger',
    tags: ['ledger'],
    summary: 'Cash book (Kassenbuch) of a club - finance roles only',
    description:
      'Append-only GoBD journal (app.ledger_entries): income positive, expenses negative, ' +
      'corrections via reversal entries. Left-joins app.ledger_categories for the label. ' +
      'RLS restricts reads to can_manage_finance.',
    security: [{ bearerAuth: [] }],
    request: { query: z.object({ club_id: uuid }) },
    responses: {
      200: jsonContent(z.array(ledgerEntrySchema), 'Ledger entries, newest first'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const { club_id } = c.req.valid('query');
    requireClubRole(c.get('claims'), club_id, FINANCE_ROLES);
    const rows = await withUser(c.get('claims'), (tx) =>
      tx`select le.*, cat.name as category_name, cat.kind as category_kind
         from app.ledger_entries le
         left join app.ledger_categories cat on cat.id = le.category_id
         where le.club_id = ${club_id}
         order by le.entry_on desc, le.created_at desc`,
    );
    return c.json(z.array(ledgerEntrySchema).parse(rows), 200);
  },
);

// ---------------------------------------------------------------------------
// POST /ledger - append a journal entry (GoBD: append-only; no edit path).
// ---------------------------------------------------------------------------
ledgerRouter.openapi(
  createRoute({
    method: 'post',
    path: '/ledger',
    tags: ['ledger'],
    summary: 'Append a cash-book entry (can_manage_finance)',
    description:
      'GoBD append-only booking: amount_cents is signed (income > 0, expense < 0). ' +
      'Corrections are never edits - use POST /ledger/{entryId}/reverse.',
    security: [{ bearerAuth: [] }],
    request: {
      body: { content: { 'application/json': { schema: ledgerEntryCreateSchema } }, required: true },
    },
    responses: {
      201: jsonContent(ledgerEntrySchema, 'The appended entry'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const body = c.req.valid('json');
    const claims = c.get('claims');
    requireClubRole(claims, body.club_id, FINANCE_ROLES);

    const created = await withUser(claims, async (tx) => {
      // A given category must belong to the SAME club (avoids cross-tenant leaks).
      if (body.category_id !== undefined) {
        const cats = await tx`
          select 1 from app.ledger_categories
          where id = ${body.category_id} and club_id = ${body.club_id} and deleted_at is null`;
        if (cats.length === 0) throw problem(422, 'Unprocessable Entity', 'category_id does not belong to this club');
      }
      const rows = await tx`
        insert into app.ledger_entries
          (club_id, entry_on, description, counterparty_kind, counterparty_member_id,
           counterparty_name, amount_cents, category, category_id, invoice_id, created_by)
        values
          (${body.club_id}, ${body.entry_on}, ${body.description}, ${body.counterparty_kind},
           ${body.counterparty_member_id ?? null}, ${body.counterparty_name ?? null},
           ${body.amount_cents}::bigint, ${body.category ?? null}, ${body.category_id ?? null},
           ${body.invoice_id ?? null}, ${claims.sub})
        returning *`;
      if (rows.length === 0) throw problem(403, 'Forbidden', 'Cash-book write rejected (finance role required)');
      return rows[0];
    });
    return c.json(ledgerEntrySchema.parse(created), 201);
  },
);

// ---------------------------------------------------------------------------
// GET /ledger/categories - the category catalog (active, not soft-deleted).
// ---------------------------------------------------------------------------
ledgerRouter.openapi(
  createRoute({
    method: 'get',
    path: '/ledger/categories',
    tags: ['ledger'],
    summary: 'Cash-book categories of a club (can_manage_finance)',
    security: [{ bearerAuth: [] }],
    request: { query: z.object({ club_id: uuid }) },
    responses: {
      200: jsonContent(z.array(ledgerCategorySchema), 'Categories, income first then expense, by sort_order'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const { club_id } = c.req.valid('query');
    requireClubRole(c.get('claims'), club_id, FINANCE_ROLES);
    const rows = await withUser(c.get('claims'), (tx) =>
      tx`select * from app.ledger_categories
         where club_id = ${club_id} and deleted_at is null
         order by kind, sort_order, name`,
    );
    return c.json(z.array(ledgerCategorySchema).parse(rows), 200);
  },
);

// ---------------------------------------------------------------------------
// POST /ledger/categories - add a category.
// ---------------------------------------------------------------------------
ledgerRouter.openapi(
  createRoute({
    method: 'post',
    path: '/ledger/categories',
    tags: ['ledger'],
    summary: 'Create a cash-book category (can_manage_finance)',
    security: [{ bearerAuth: [] }],
    request: {
      body: { content: { 'application/json': { schema: ledgerCategoryCreateSchema } }, required: true },
    },
    responses: {
      201: jsonContent(ledgerCategorySchema, 'The created category'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const body = c.req.valid('json');
    const claims = c.get('claims');
    requireClubRole(claims, body.club_id, FINANCE_ROLES);
    const created = await withUser(claims, async (tx) => {
      const rows = await tx`
        insert into app.ledger_categories (club_id, name, kind, sort_order)
        values (${body.club_id}, ${body.name}, ${body.kind}, ${body.sort_order})
        returning *`;
      if (rows.length === 0) throw problem(403, 'Forbidden', 'Category create rejected (finance role required)');
      return rows[0];
    });
    return c.json(ledgerCategorySchema.parse(created), 201);
  },
);

// ---------------------------------------------------------------------------
// POST /ledger/{entryId}/reverse - Storno. Never edits/deletes the original;
// appends a mirror row with the negated amount and reverses_entry_id set.
// ---------------------------------------------------------------------------
ledgerRouter.openapi(
  createRoute({
    method: 'post',
    path: '/ledger/{entryId}/reverse',
    tags: ['ledger'],
    summary: 'Reverse a cash-book entry (Storno, GoBD-safe)',
    description:
      'Appends a counter-entry (negated amount, reverses_entry_id set) instead of deleting the ' +
      'original - the documented GoBD correction path. Finance roles only.',
    security: [{ bearerAuth: [] }],
    request: {
      params: entryIdParam,
      body: { content: { 'application/json': { schema: ledgerReverseSchema } }, required: false },
    },
    responses: {
      201: jsonContent(ledgerEntrySchema, 'The appended reversal entry'),
      409: jsonContent(z.object({}).passthrough(), 'Entry is itself a reversal / already reversed'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const { entryId } = c.req.valid('param');
    const body = (c.req.valid('json') as z.infer<typeof ledgerReverseSchema> | undefined) ?? {};
    const claims = c.get('claims');

    const created = await withUser(claims, async (tx) => {
      const rows = await tx`
        select id, club_id, entry_on, description, counterparty_kind, counterparty_member_id,
               counterparty_name, amount_cents, category, category_id, invoice_id, reverses_entry_id
        from app.ledger_entries where id = ${entryId}`;
      const orig = rows[0] as
        | {
            club_id: string;
            description: string;
            counterparty_kind: string;
            counterparty_member_id: string | null;
            counterparty_name: string | null;
            amount_cents: string;
            category: string | null;
            category_id: string | null;
            invoice_id: string | null;
            reverses_entry_id: string | null;
          }
        | undefined;
      if (!orig) throw problem(404, 'Not Found', 'Ledger entry not found');
      requireClubRole(claims, orig.club_id, FINANCE_ROLES);
      if (orig.reverses_entry_id !== null) {
        throw problem(409, 'Conflict', 'Cannot reverse a reversal entry');
      }
      const existing = await tx`
        select 1 from app.ledger_entries where reverses_entry_id = ${entryId}`;
      if (existing.length > 0) throw problem(409, 'Conflict', 'Entry has already been reversed');

      const description = body.description ?? `Storno: ${orig.description}`;
      const inserted = await tx`
        insert into app.ledger_entries
          (club_id, entry_on, description, counterparty_kind, counterparty_member_id,
           counterparty_name, amount_cents, category, category_id, invoice_id,
           reverses_entry_id, created_by)
        values
          (${orig.club_id}, current_date, ${description}, ${orig.counterparty_kind},
           ${orig.counterparty_member_id}, ${orig.counterparty_name},
           ${-Number(orig.amount_cents)}::bigint, ${orig.category}, ${orig.category_id},
           ${orig.invoice_id}, ${entryId}, ${claims.sub})
        returning *`;
      if (inserted.length === 0) throw problem(403, 'Forbidden', 'Reversal rejected (finance role required)');
      return inserted[0];
    });
    return c.json(ledgerEntrySchema.parse(created), 201);
  },
);
