// ============================================================================
// routes/invoices.ts - money ops (Blueprint ADR-E2: ALL money ops live in the
// API layer).
//
//   * List runs impersonated: treasurers see everything, members see their
//     own / their children's invoices - pure RLS.
//   * CREATE is the one explicitly marked SERVICE-MODE operation here,
//     because app.next_invoice_number() is EXECUTE service_role only
//     (race-free per-club/per-year counter). Because service mode bypasses
//     RLS, the handler re-verifies the caller's finance role AGAINST THE
//     DATABASE (not just claims) before touching anything - Blueprint risk
//     #16 (claim staleness <= 15 min).
//   * send-reminder is a stub: bumps dunning_level (max 3) + logs. Real
//     dunning mail lands with the portal phase.
// ============================================================================

import { createRoute, z } from '@hono/zod-openapi';
import { createRouter, errorResponses, jsonContent } from '../lib/openapi.js';
import { invoiceCreateSchema, invoiceSchema, uuid } from '../lib/validation.js';
import { withServiceRole, withUser } from '../db.js';
import type { Tx } from '../db.js';
import { problem } from '../middleware/error.js';
import { FINANCE_ROLES, requireClubMember, requireClubRole } from '../lib/guards.js';
import type { AuthClaims } from '../middleware/auth.js';

export const invoicesRouter = createRouter();

const invoiceIdParam = z.object({
  invoiceId: uuid.openapi({ param: { name: 'invoiceId', in: 'path' } }),
});

/**
 * Defense in depth for money ops (Blueprint risk #16): claims may be up to
 * 15 min stale, so verify the finance role against club_members in the DB.
 */
async function assertFinanceRoleInDb(tx: Tx, clubId: string, claims: AuthClaims): Promise<void> {
  const rows = await tx`
    select 1 from app.club_members
    where club_id = ${clubId}
      and profile_id = ${claims.sub}
      and deleted_at is null
      and status = 'active'
      and role in ('owner', 'admin', 'treasurer')
      and (valid_until is null or valid_until >= now())`;
  if (rows.length === 0) {
    throw problem(403, 'Forbidden', 'Finance role not confirmed by the database (stale claims?)');
  }
}

invoicesRouter.openapi(
  createRoute({
    method: 'get',
    path: '/invoices',
    tags: ['invoices'],
    summary: 'List invoices (RLS: finance roles see all, members their own/children)',
    security: [{ bearerAuth: [] }],
    request: { query: z.object({ club_id: uuid }) },
    responses: {
      200: jsonContent(z.array(invoiceSchema), 'Invoices visible to the caller'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const { club_id } = c.req.valid('query');
    requireClubMember(c.get('claims'), club_id);
    const rows = await withUser(c.get('claims'), (tx) =>
      tx`select * from app.invoices
         where club_id = ${club_id}
         order by number desc`,
    );
    return c.json(z.array(invoiceSchema).parse(rows), 200);
  },
);

invoicesRouter.openapi(
  createRoute({
    method: 'post',
    path: '/invoices',
    tags: ['invoices'],
    summary: 'Create an invoice (owner/admin/treasurer) with a race-free number',
    description:
      'Service-mode operation: the invoice number comes from app.next_invoice_number() (service_role only). The finance role is re-verified against the database, not just claims.',
    security: [{ bearerAuth: [] }],
    request: {
      body: { content: { 'application/json': { schema: invoiceCreateSchema } }, required: true },
    },
    responses: {
      201: jsonContent(invoiceSchema, 'Created invoice (draft or open)'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const body = c.req.valid('json');
    const claims = c.get('claims');
    requireClubRole(claims, body.club_id, FINANCE_ROLES); // fast fail on claims

    const created = await withServiceRole(
      `invoice create club=${body.club_id} by=${claims.sub}`,
      async (tx) => {
        await assertFinanceRoleInDb(tx, body.club_id, claims); // DB truth, not claims

        // member must belong to the SAME club (service mode sees everything,
        // so tenant checks are explicit here)
        const members = await tx`
          select 1 from app.club_members
          where id = ${body.member_id} and club_id = ${body.club_id} and deleted_at is null`;
        if (members.length === 0) {
          throw problem(422, 'Unprocessable Entity', 'member_id does not belong to this club');
        }

        const numbers = await tx`select app.next_invoice_number(${body.club_id}) as number`;
        const number = (numbers[0] as { number: string }).number;

        const rows = await tx`
          insert into app.invoices
            (club_id, member_id, number, title, amount_cents, status, issued_on, due_on)
          values
            (${body.club_id}, ${body.member_id}, ${number}, ${body.title}, ${body.amount_cents},
             ${body.issue ? 'open' : 'draft'},
             ${body.issue ? new Date().toISOString().slice(0, 10) : null},
             ${body.due_on ?? null})
          returning *`;
        return rows[0];
      },
    );
    return c.json(invoiceSchema.parse(created), 201);
  },
);

invoicesRouter.openapi(
  createRoute({
    method: 'post',
    path: '/invoices/{invoiceId}/send-reminder',
    tags: ['invoices'],
    summary: 'Send a payment reminder (stub: bumps dunning_level + logs)',
    security: [{ bearerAuth: [] }],
    request: { params: invoiceIdParam },
    responses: {
      200: jsonContent(invoiceSchema, 'Invoice with the new dunning level'),
      409: jsonContent(z.object({}).passthrough(), 'Invoice is not open'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const { invoiceId } = c.req.valid('param');
    const claims = c.get('claims');

    const updated = await withUser(claims, async (tx) => {
      const rows = await tx`
        select id, club_id, status from app.invoices where id = ${invoiceId}`;
      const invoice = rows[0] as { club_id: string; status: string } | undefined;
      if (!invoice) throw problem(404, 'Not Found', 'Invoice not found');
      requireClubRole(claims, invoice.club_id, FINANCE_ROLES);
      if (invoice.status !== 'open') {
        throw problem(409, 'Conflict', `Reminders only for open invoices (status: ${invoice.status})`);
      }
      // Impersonated UPDATE - the invoices_update RLS policy is the second gate.
      const result = await tx`
        update app.invoices
        set dunning_level = least(dunning_level + 1, 3)
        where id = ${invoiceId} and status = 'open'
        returning *`;
      return result[0];
    });

    const parsed = invoiceSchema.parse(updated);
    console.info(
      `[invoices] reminder stub: invoice=${parsed.number} new dunning_level=${parsed.dunning_level} (request ${c.get('requestId')}) - mail delivery lands with the portal phase`,
    );
    return c.json(parsed, 200);
  },
);
