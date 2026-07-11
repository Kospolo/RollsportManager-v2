// ============================================================================
// routes/bank-transactions.ts - Bankabgleich (v1 bankabgleich.html). All
// finance-role only (can_manage_finance). RLS + the money-op guards are the
// second line of defense via impersonation.
//
//   * GET   /bank-transactions                list (optional status filter)
//   * POST  /bank-transactions                manual single entry
//   * POST  /bank-transactions/import         bulk CSV/JSON statement rows
//   * PATCH /bank-transactions/{id}/match     link to an invoice (+ optionally
//                                             settle it + post a Kassenbuch row)
//   * PATCH /bank-transactions/{id}/ignore    mark irrelevant
// ============================================================================

import { createRoute, z } from '@hono/zod-openapi';
import { createRouter, errorResponses, jsonContent } from '../lib/openapi.js';
import {
  bankTransactionCreateSchema,
  bankTransactionIgnoreSchema,
  bankTransactionImportSchema,
  bankTransactionMatchSchema,
  bankTransactionSchema,
  bankTransactionStatusSchema,
  uuid,
} from '../lib/validation.js';
import { withUser } from '../db.js';
import { problem } from '../middleware/error.js';
import { FINANCE_ROLES, requireClubRole } from '../lib/guards.js';

export const bankTransactionsRouter = createRouter();

const txIdParam = z.object({
  transactionId: uuid.openapi({ param: { name: 'transactionId', in: 'path' } }),
});

// ---------------------------------------------------------------------------
// GET /bank-transactions - the reconciliation working set (finance only).
// ---------------------------------------------------------------------------
bankTransactionsRouter.openapi(
  createRoute({
    method: 'get',
    path: '/bank-transactions',
    tags: ['bank-transactions'],
    summary: 'List bank transactions of a club - finance roles only',
    description:
      'Optional status filter (unmatched/matched/ignored). amount_cents is signed ' +
      '(+ Eingang / - Ausgang). RLS restricts reads to can_manage_finance.',
    security: [{ bearerAuth: [] }],
    request: {
      query: z.object({ club_id: uuid, status: bankTransactionStatusSchema.optional() }),
    },
    responses: {
      200: jsonContent(z.array(bankTransactionSchema), 'Bank transactions, newest first'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const { club_id, status } = c.req.valid('query');
    requireClubRole(c.get('claims'), club_id, FINANCE_ROLES);
    const rows = await withUser(c.get('claims'), (tx) =>
      tx`select * from app.bank_transactions
         where club_id = ${club_id}
           and deleted_at is null
           and (${status ?? null}::text is null or status = ${status ?? null}::text)
         order by booked_on desc, created_at desc`,
    );
    return c.json(z.array(bankTransactionSchema).parse(rows), 200);
  },
);

// ---------------------------------------------------------------------------
// POST /bank-transactions - enter one movement by hand.
// ---------------------------------------------------------------------------
bankTransactionsRouter.openapi(
  createRoute({
    method: 'post',
    path: '/bank-transactions',
    tags: ['bank-transactions'],
    summary: 'Record a bank transaction manually (can_manage_finance)',
    security: [{ bearerAuth: [] }],
    request: {
      body: { content: { 'application/json': { schema: bankTransactionCreateSchema } }, required: true },
    },
    responses: {
      201: jsonContent(bankTransactionSchema, 'The recorded transaction (status unmatched)'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const body = c.req.valid('json');
    const claims = c.get('claims');
    requireClubRole(claims, body.club_id, FINANCE_ROLES);
    const created = await withUser(claims, async (tx) => {
      const rows = await tx`
        insert into app.bank_transactions (club_id, booked_on, amount_cents, purpose, counterparty)
        values (${body.club_id}, ${body.booked_on}, ${body.amount_cents}::bigint,
                ${body.purpose ?? null}, ${body.counterparty ?? null})
        returning *`;
      if (rows.length === 0) throw problem(403, 'Forbidden', 'Insert rejected (finance role required)');
      return rows[0];
    });
    return c.json(bankTransactionSchema.parse(created), 201);
  },
);

// ---------------------------------------------------------------------------
// POST /bank-transactions/import - bulk statement import (CSV/JSON rows).
// ---------------------------------------------------------------------------
bankTransactionsRouter.openapi(
  createRoute({
    method: 'post',
    path: '/bank-transactions/import',
    tags: ['bank-transactions'],
    summary: 'Import a bank statement (rows) - all start unmatched (can_manage_finance)',
    description:
      'Bulk insert of parsed statement lines. Each row: booked_on, signed amount_cents, ' +
      'optional purpose/counterparty. Returns the created rows (all status=unmatched).',
    security: [{ bearerAuth: [] }],
    request: {
      body: { content: { 'application/json': { schema: bankTransactionImportSchema } }, required: true },
    },
    responses: {
      201: jsonContent(z.array(bankTransactionSchema), 'The imported transactions'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const body = c.req.valid('json');
    const claims = c.get('claims');
    requireClubRole(claims, body.club_id, FINANCE_ROLES);
    const created = await withUser(claims, async (tx) => {
      const out: unknown[] = [];
      for (const row of body.rows) {
        const rows = await tx`
          insert into app.bank_transactions (club_id, booked_on, amount_cents, purpose, counterparty)
          values (${body.club_id}, ${row.booked_on}, ${row.amount_cents}::bigint,
                  ${row.purpose ?? null}, ${row.counterparty ?? null})
          returning *`;
        if (rows.length === 0) throw problem(403, 'Forbidden', 'Import rejected (finance role required)');
        out.push(rows[0]);
      }
      return out;
    });
    console.info(
      `[bank-transactions] imported ${body.rows.length} rows for club=${body.club_id} ` +
        `by=${claims.sub} (request ${c.get('requestId')})`,
    );
    return c.json(z.array(bankTransactionSchema).parse(created), 201);
  },
);

// ---------------------------------------------------------------------------
// PATCH /bank-transactions/{id}/match - link an unmatched income row to an
// open invoice; optionally settle the invoice + post a Kassenbuch income row.
// ---------------------------------------------------------------------------
bankTransactionsRouter.openapi(
  createRoute({
    method: 'patch',
    path: '/bank-transactions/{transactionId}/match',
    tags: ['bank-transactions'],
    summary: 'Match a bank transaction to an invoice (can_manage_finance)',
    description:
      'Links the transaction to an invoice of the SAME club and sets status=matched. ' +
      'post_to_ledger=true (default) additionally marks an OPEN invoice paid and appends a ' +
      'matching Kassenbuch income row (recorded as matched_ledger_entry_id). Already-paid ' +
      'invoices are linked without a second booking.',
    security: [{ bearerAuth: [] }],
    request: {
      params: txIdParam,
      body: { content: { 'application/json': { schema: bankTransactionMatchSchema } }, required: true },
    },
    responses: {
      200: jsonContent(bankTransactionSchema, 'The matched transaction'),
      409: jsonContent(z.object({}).passthrough(), 'Transaction already matched/ignored'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const { transactionId } = c.req.valid('param');
    const body = c.req.valid('json');
    const claims = c.get('claims');

    const updated = await withUser(claims, async (tx) => {
      const txRows = await tx`
        select id, club_id, amount_cents, status from app.bank_transactions
        where id = ${transactionId} and deleted_at is null`;
      const bankTx = txRows[0] as
        | { club_id: string; amount_cents: string; status: string }
        | undefined;
      if (!bankTx) throw problem(404, 'Not Found', 'Bank transaction not found');
      requireClubRole(claims, bankTx.club_id, FINANCE_ROLES);
      if (bankTx.status === 'ignored') {
        throw problem(409, 'Conflict', 'An ignored transaction cannot be matched');
      }

      // Invoice must belong to the SAME club (tenant guard on top of RLS).
      const invRows = await tx`
        select id, club_id, member_id, title, amount_cents, status
        from app.invoices where id = ${body.invoice_id} and club_id = ${bankTx.club_id}`;
      const invoice = invRows[0] as
        | { member_id: string; title: string; amount_cents: string; status: string }
        | undefined;
      if (!invoice) throw problem(422, 'Unprocessable Entity', 'invoice_id does not belong to this club');

      // Optionally settle the invoice + post the matching Kassenbuch income row.
      let ledgerEntryId: string | null = null;
      if (body.post_to_ledger && invoice.status === 'open') {
        await tx`
          update app.invoices
          set status = 'paid', paid_at = now(), paid_via = 'Bankabgleich'
          where id = ${body.invoice_id} and status = 'open'`;
        if (Number(invoice.amount_cents) > 0) {
          const ledgerRows = await tx`
            insert into app.ledger_entries
              (club_id, entry_on, description, counterparty_kind, counterparty_member_id,
               amount_cents, category_id, invoice_id, created_by)
            values
              (${bankTx.club_id}, current_date, ${`Bankabgleich: ${invoice.title}`},
               'person', ${invoice.member_id}, ${invoice.amount_cents}::bigint,
               ${body.ledger_category_id ?? null}, ${body.invoice_id}, ${claims.sub})
            returning id`;
          ledgerEntryId = (ledgerRows[0]?.['id'] as string | undefined) ?? null;
        }
      }

      const result = await tx`
        update app.bank_transactions
        set matched_invoice_id = ${body.invoice_id},
            matched_ledger_entry_id = coalesce(${ledgerEntryId}::uuid, matched_ledger_entry_id),
            status = 'matched'
        where id = ${transactionId} and deleted_at is null
        returning *`;
      if (result.length === 0) throw problem(403, 'Forbidden', 'Match rejected (role or concurrent change)');
      return result[0];
    });

    const parsed = bankTransactionSchema.parse(updated);
    console.info(
      `[bank-transactions] match tx=${transactionId} -> invoice=${body.invoice_id}` +
        (body.post_to_ledger ? ' (+settle/+ledger)' : '') +
        ` (request ${c.get('requestId')})`,
    );
    return c.json(parsed, 200);
  },
);

// ---------------------------------------------------------------------------
// PATCH /bank-transactions/{id}/ignore - mark a row irrelevant.
// ---------------------------------------------------------------------------
bankTransactionsRouter.openapi(
  createRoute({
    method: 'patch',
    path: '/bank-transactions/{transactionId}/ignore',
    tags: ['bank-transactions'],
    summary: 'Ignore a bank transaction (can_manage_finance)',
    security: [{ bearerAuth: [] }],
    request: {
      params: txIdParam,
      body: { content: { 'application/json': { schema: bankTransactionIgnoreSchema } }, required: false },
    },
    responses: {
      200: jsonContent(bankTransactionSchema, 'The ignored transaction'),
      409: jsonContent(z.object({}).passthrough(), 'Transaction is already matched'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const { transactionId } = c.req.valid('param');
    const claims = c.get('claims');

    const updated = await withUser(claims, async (tx) => {
      const rows = await tx`
        select id, club_id, status from app.bank_transactions
        where id = ${transactionId} and deleted_at is null`;
      const bankTx = rows[0] as { club_id: string; status: string } | undefined;
      if (!bankTx) throw problem(404, 'Not Found', 'Bank transaction not found');
      requireClubRole(claims, bankTx.club_id, FINANCE_ROLES);
      if (bankTx.status === 'matched') {
        throw problem(409, 'Conflict', 'A matched transaction cannot be ignored');
      }
      const result = await tx`
        update app.bank_transactions set status = 'ignored'
        where id = ${transactionId} and deleted_at is null and status <> 'matched'
        returning *`;
      if (result.length === 0) throw problem(403, 'Forbidden', 'Ignore rejected (role or concurrent change)');
      return result[0];
    });
    return c.json(bankTransactionSchema.parse(updated), 200);
  },
);
