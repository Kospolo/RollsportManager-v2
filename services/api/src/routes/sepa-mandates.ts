// ============================================================================
// routes/sepa-mandates.ts - SEPA-Lastschriftmandate (v1 sepa.html).
//
// DATENSCHUTZ (Blueprint): the full IBAN is NEVER stored or accepted here -
// only iban_last4 (the last 4 digits, for the member to recognise the account)
// plus the mandate_reference. Encrypted full-IBAN storage lands later.
//
//   * GET    /sepa-mandates?club_id[&member_id]  RLS: finance sees all, a member
//            sees only their OWN (and a guardian their children's) mandate.
//   * POST   /sepa-mandates                        create = can_manage_finance.
//   * PATCH  /sepa-mandates/{mandateId}            edit   = can_manage_finance.
//   * DELETE /sepa-mandates/{mandateId}            soft-delete = can_manage_finance.
// ============================================================================

import { createRoute, z } from '@hono/zod-openapi';
import { createRouter, errorResponses, jsonContent } from '../lib/openapi.js';
import {
  deletedSchema,
  sepaMandateCreateSchema,
  sepaMandateSchema,
  sepaMandateUpdateSchema,
  uuid,
} from '../lib/validation.js';
import { withUser } from '../db.js';
import { problem } from '../middleware/error.js';
import { FINANCE_ROLES, requireClubMember, requireClubRole } from '../lib/guards.js';

export const sepaMandatesRouter = createRouter();

const mandateIdParam = z.object({
  mandateId: uuid.openapi({ param: { name: 'mandateId', in: 'path' } }),
});

// ---------------------------------------------------------------------------
// GET /sepa-mandates - RLS restricts a plain member to their own mandate.
// ---------------------------------------------------------------------------
sepaMandatesRouter.openapi(
  createRoute({
    method: 'get',
    path: '/sepa-mandates',
    tags: ['sepa-mandates'],
    summary: 'List SEPA mandates (RLS: finance sees all, members their own/children)',
    description:
      'Only iban_last4 is ever returned (never a full IBAN). Optional member_id filter; ' +
      "a plain member only ever sees their own / their children's mandate (RLS).",
    security: [{ bearerAuth: [] }],
    request: {
      query: z.object({ club_id: uuid, member_id: uuid.optional() }),
    },
    responses: {
      200: jsonContent(z.array(sepaMandateSchema), 'Mandates visible to the caller'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const { club_id, member_id } = c.req.valid('query');
    requireClubMember(c.get('claims'), club_id);
    const rows = await withUser(c.get('claims'), (tx) =>
      tx`select * from app.sepa_mandates
         where club_id = ${club_id}
           and deleted_at is null
           and (${member_id ?? null}::uuid is null or member_id = ${member_id ?? null}::uuid)
         order by created_at desc`,
    );
    return c.json(z.array(sepaMandateSchema).parse(rows), 200);
  },
);

// ---------------------------------------------------------------------------
// POST /sepa-mandates - create a mandate (can_manage_finance).
// ---------------------------------------------------------------------------
sepaMandatesRouter.openapi(
  createRoute({
    method: 'post',
    path: '/sepa-mandates',
    tags: ['sepa-mandates'],
    summary: 'Create a SEPA mandate (can_manage_finance)',
    description: 'DATENSCHUTZ: pass ONLY iban_last4 (4 digits) - a full IBAN is rejected by validation.',
    security: [{ bearerAuth: [] }],
    request: {
      body: { content: { 'application/json': { schema: sepaMandateCreateSchema } }, required: true },
    },
    responses: {
      201: jsonContent(sepaMandateSchema, 'The created mandate'),
      409: jsonContent(z.object({}).passthrough(), 'mandate_reference already exists in this club'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const body = c.req.valid('json');
    const claims = c.get('claims');
    requireClubRole(claims, body.club_id, FINANCE_ROLES);
    const created = await withUser(claims, async (tx) => {
      const members = await tx`
        select 1 from app.club_members
        where id = ${body.member_id} and club_id = ${body.club_id} and deleted_at is null`;
      if (members.length === 0) throw problem(422, 'Unprocessable Entity', 'member_id does not belong to this club');

      const dup = await tx`
        select 1 from app.sepa_mandates
        where club_id = ${body.club_id} and mandate_reference = ${body.mandate_reference}`;
      if (dup.length > 0) throw problem(409, 'Conflict', 'mandate_reference already exists in this club');

      const rows = await tx`
        insert into app.sepa_mandates
          (club_id, member_id, mandate_reference, iban_last4, account_holder, signed_on, status)
        values
          (${body.club_id}, ${body.member_id}, ${body.mandate_reference}, ${body.iban_last4 ?? null},
           ${body.account_holder}, ${body.signed_on ?? null}, ${body.status})
        returning *`;
      if (rows.length === 0) throw problem(403, 'Forbidden', 'Mandate create rejected (finance role required)');
      return rows[0];
    });
    return c.json(sepaMandateSchema.parse(created), 201);
  },
);

// ---------------------------------------------------------------------------
// PATCH /sepa-mandates/{mandateId} - edit / revoke (can_manage_finance).
// ---------------------------------------------------------------------------
sepaMandatesRouter.openapi(
  createRoute({
    method: 'patch',
    path: '/sepa-mandates/{mandateId}',
    tags: ['sepa-mandates'],
    summary: 'Update or revoke a SEPA mandate (can_manage_finance)',
    security: [{ bearerAuth: [] }],
    request: {
      params: mandateIdParam,
      body: { content: { 'application/json': { schema: sepaMandateUpdateSchema } }, required: true },
    },
    responses: {
      200: jsonContent(sepaMandateSchema, 'The updated mandate'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const { mandateId } = c.req.valid('param');
    const body = c.req.valid('json');
    const claims = c.get('claims');

    const updated = await withUser(claims, async (tx) => {
      const found = await tx`
        select club_id from app.sepa_mandates where id = ${mandateId} and deleted_at is null`;
      const row = found[0] as { club_id: string } | undefined;
      if (!row) throw problem(404, 'Not Found', 'Mandate not found');
      requireClubRole(claims, row.club_id, FINANCE_ROLES);

      const rows = await tx`
        update app.sepa_mandates set
          mandate_reference = coalesce(${body.mandate_reference ?? null}, mandate_reference),
          iban_last4        = ${body.iban_last4 === undefined ? tx`iban_last4` : body.iban_last4},
          account_holder    = coalesce(${body.account_holder ?? null}, account_holder),
          signed_on         = ${body.signed_on === undefined ? tx`signed_on` : body.signed_on},
          status            = coalesce(${body.status ?? null}, status)
        where id = ${mandateId} and deleted_at is null
        returning *`;
      if (rows.length === 0) throw problem(403, 'Forbidden', 'Update rejected (finance role required)');
      return rows[0];
    });
    return c.json(sepaMandateSchema.parse(updated), 200);
  },
);

// ---------------------------------------------------------------------------
// DELETE /sepa-mandates/{mandateId} - soft-delete (can_manage_finance).
// ---------------------------------------------------------------------------
sepaMandatesRouter.openapi(
  createRoute({
    method: 'delete',
    path: '/sepa-mandates/{mandateId}',
    tags: ['sepa-mandates'],
    summary: 'Soft-delete a SEPA mandate (can_manage_finance)',
    security: [{ bearerAuth: [] }],
    request: { params: mandateIdParam },
    responses: {
      200: jsonContent(deletedSchema, 'Mandate soft-deleted'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const { mandateId } = c.req.valid('param');
    const claims = c.get('claims');
    await withUser(claims, async (tx) => {
      const found = await tx`
        select club_id from app.sepa_mandates where id = ${mandateId} and deleted_at is null`;
      const row = found[0] as { club_id: string } | undefined;
      if (!row) throw problem(404, 'Not Found', 'Mandate not found');
      requireClubRole(claims, row.club_id, FINANCE_ROLES);
      const rows = await tx`
        update app.sepa_mandates set deleted_at = now()
        where id = ${mandateId} and deleted_at is null
        returning id`;
      if (rows.length === 0) throw problem(403, 'Forbidden', 'Delete rejected (finance role required)');
    });
    return c.json({ status: 'deleted' as const, id: mandateId }, 200);
  },
);
