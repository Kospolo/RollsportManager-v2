// ============================================================================
// routes/donations.ts - Spenden + Spendenbescheinigung (v1 spenden.html).
//
//   * GET   /donations                 finance sees all; a member sees ONLY
//                                       their own donation(s) - pure RLS.
//   * POST  /donations                 SERVICE-MODE: the receipt number comes
//                                       from app.next_donation_receipt_number()
//                                       (service_role only, race-free per
//                                       club+year). The finance role is
//                                       re-verified against the DB, not just
//                                       claims (Blueprint risk #16).
//   * PATCH /donations/{id}            edit unissued master data / issue the
//                                       Bescheinigung (issued_at). Frozen once
//                                       issued (GoBD).
//   * GET   /donations/{id}/receipt    printable Spendenbescheinigung text.
// ============================================================================

import { createRoute, z } from '@hono/zod-openapi';
import { createRouter, errorResponses, jsonContent } from '../lib/openapi.js';
import {
  donationCreateSchema,
  donationReceiptSchema,
  donationSchema,
  donationUpdateSchema,
  uuid,
} from '../lib/validation.js';
import { withServiceRole, withUser } from '../db.js';
import type { Tx } from '../db.js';
import { problem } from '../middleware/error.js';
import { FINANCE_ROLES, requireClubMember, requireClubRole } from '../lib/guards.js';
import type { AuthClaims } from '../middleware/auth.js';

export const donationsRouter = createRouter();

const donationIdParam = z.object({
  donationId: uuid.openapi({ param: { name: 'donationId', in: 'path' } }),
});

/** Defense in depth for money ops (Blueprint risk #16): verify finance in the DB. */
async function assertFinanceRoleInDb(tx: Tx, clubId: string, claims: AuthClaims): Promise<void> {
  const rows = await tx`
    select 1 from app.club_members
    where club_id = ${clubId}
      and profile_id = ${claims.sub}
      and deleted_at is null
      and status = 'active'
      and role in ('owner', 'admin', 'moderator', 'treasurer')
      and (valid_until is null or valid_until >= now())`;
  if (rows.length === 0) {
    throw problem(403, 'Forbidden', 'Finance role not confirmed by the database (stale claims?)');
  }
}

function euro(cents: number): string {
  return (cents / 100).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ---------------------------------------------------------------------------
// GET /donations - finance sees all; a member sees their own (RLS).
// ---------------------------------------------------------------------------
donationsRouter.openapi(
  createRoute({
    method: 'get',
    path: '/donations',
    tags: ['donations'],
    summary: 'List donations (RLS: finance all, member their own)',
    description:
      'Optional member_id filter. A plain member only ever sees their own donation(s) ' +
      'regardless of the filter (RLS); finance sees everything.',
    security: [{ bearerAuth: [] }],
    request: {
      query: z.object({ club_id: uuid, member_id: uuid.optional() }),
    },
    responses: {
      200: jsonContent(z.array(donationSchema), 'Donations visible to the caller, newest first'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const { club_id, member_id } = c.req.valid('query');
    requireClubMember(c.get('claims'), club_id);
    const rows = await withUser(c.get('claims'), (tx) =>
      tx`select * from app.donations
         where club_id = ${club_id}
           and deleted_at is null
           and (${member_id ?? null}::uuid is null or member_id = ${member_id ?? null}::uuid)
         order by donation_date desc, created_at desc`,
    );
    return c.json(z.array(donationSchema).parse(rows), 200);
  },
);

// ---------------------------------------------------------------------------
// POST /donations - service-mode create with a race-free receipt number.
// ---------------------------------------------------------------------------
donationsRouter.openapi(
  createRoute({
    method: 'post',
    path: '/donations',
    tags: ['donations'],
    summary: 'Create a donation (can_manage_finance) with a race-free receipt number',
    description:
      'Service-mode operation: receipt_number comes from app.next_donation_receipt_number() ' +
      '(service_role only). The finance role is re-verified against the database, not just claims.',
    security: [{ bearerAuth: [] }],
    request: {
      body: { content: { 'application/json': { schema: donationCreateSchema } }, required: true },
    },
    responses: {
      201: jsonContent(donationSchema, 'The created donation (unissued)'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const body = c.req.valid('json');
    const claims = c.get('claims');
    requireClubRole(claims, body.club_id, FINANCE_ROLES); // fast fail on claims

    const created = await withServiceRole(
      `donation create club=${body.club_id} by=${claims.sub}`,
      async (tx) => {
        await assertFinanceRoleInDb(tx, body.club_id, claims); // DB truth, not claims

        if (body.member_id !== undefined) {
          const members = await tx`
            select 1 from app.club_members
            where id = ${body.member_id} and club_id = ${body.club_id} and deleted_at is null`;
          if (members.length === 0) {
            throw problem(422, 'Unprocessable Entity', 'member_id does not belong to this club');
          }
        }

        const numbers = await tx`select app.next_donation_receipt_number(${body.club_id}) as number`;
        const receiptNumber = (numbers[0] as { number: string }).number;

        const rows = await tx`
          insert into app.donations
            (club_id, member_id, donor_name, donor_address, amount_cents, donation_date, receipt_number, purpose)
          values
            (${body.club_id}, ${body.member_id ?? null}, ${body.donor_name}, ${body.donor_address ?? null},
             ${body.amount_cents}::bigint, ${body.donation_date}, ${receiptNumber}, ${body.purpose ?? null})
          returning *`;
        return rows[0];
      },
    );
    return c.json(donationSchema.parse(created), 201);
  },
);

// ---------------------------------------------------------------------------
// PATCH /donations/{id} - edit unissued master data / issue the receipt.
// ---------------------------------------------------------------------------
donationsRouter.openapi(
  createRoute({
    method: 'patch',
    path: '/donations/{donationId}',
    tags: ['donations'],
    summary: 'Edit or issue a donation (can_manage_finance)',
    description:
      'Edit the master data (only while unissued) and/or issue the Spendenbescheinigung ' +
      '(issue=true → issued_at=now). An already-issued donation is frozen (GoBD): master-data ' +
      'edits are rejected, re-issuing is a no-op conflict.',
    security: [{ bearerAuth: [] }],
    request: {
      params: donationIdParam,
      body: { content: { 'application/json': { schema: donationUpdateSchema } }, required: true },
    },
    responses: {
      200: jsonContent(donationSchema, 'The updated donation'),
      409: jsonContent(z.object({}).passthrough(), 'Donation already issued (frozen)'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const { donationId } = c.req.valid('param');
    const body = c.req.valid('json');
    const claims = c.get('claims');

    const updated = await withUser(claims, async (tx) => {
      const rows = await tx`
        select id, club_id, issued_at from app.donations
        where id = ${donationId} and deleted_at is null`;
      const donation = rows[0] as { club_id: string; issued_at: string | null } | undefined;
      if (!donation) throw problem(404, 'Not Found', 'Donation not found');
      requireClubRole(claims, donation.club_id, FINANCE_ROLES);

      const wantsMasterEdit =
        body.donor_name !== undefined ||
        body.donor_address !== undefined ||
        body.amount_cents !== undefined ||
        body.donation_date !== undefined ||
        body.purpose !== undefined;

      if (donation.issued_at !== null) {
        if (wantsMasterEdit) {
          throw problem(409, 'Conflict', 'An issued donation is frozen (GoBD) — master data cannot change');
        }
        if (body.issue === true) {
          throw problem(409, 'Conflict', 'Donation is already issued');
        }
      }

      const result = await tx`
        update app.donations set
          donor_name    = coalesce(${body.donor_name ?? null}, donor_name),
          donor_address = coalesce(${body.donor_address ?? null}, donor_address),
          amount_cents  = coalesce(${body.amount_cents ?? null}::bigint, amount_cents),
          donation_date = coalesce(${body.donation_date ?? null}::date, donation_date),
          purpose       = coalesce(${body.purpose ?? null}, purpose),
          issued_at     = case when ${body.issue === true} then now() else issued_at end
        where id = ${donationId} and deleted_at is null
        returning *`;
      if (result.length === 0) throw problem(403, 'Forbidden', 'Update rejected (role or concurrent change)');
      return result[0];
    });

    return c.json(donationSchema.parse(updated), 200);
  },
);

// ---------------------------------------------------------------------------
// GET /donations/{id}/receipt - printable Spendenbescheinigung text.
// ---------------------------------------------------------------------------
donationsRouter.openapi(
  createRoute({
    method: 'get',
    path: '/donations/{donationId}/receipt',
    tags: ['donations'],
    summary: 'Printable Spendenbescheinigung (RLS: finance or the donor)',
    description:
      'Renders the donation into a ready-to-print Bescheinigungstext (DE). Visible to finance ' +
      'or the donor member themselves (RLS on app.donations).',
    security: [{ bearerAuth: [] }],
    request: { params: donationIdParam },
    responses: {
      200: jsonContent(donationReceiptSchema, 'The rendered receipt'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const { donationId } = c.req.valid('param');
    const data = await withUser(c.get('claims'), async (tx) => {
      const rows = await tx`
        select d.*, cl.name as club_name
        from app.donations d
        join app.clubs cl on cl.id = d.club_id
        where d.id = ${donationId} and d.deleted_at is null`;
      return rows[0];
    });
    if (!data) throw problem(404, 'Not Found', 'Donation not found');

    const d = data as Record<string, unknown>;
    const amountCents = Number(d['amount_cents']);
    const amountEur = euro(amountCents);
    const clubName = String(d['club_name']);
    const donorName = String(d['donor_name']);
    const donorAddress = (d['donor_address'] as string | null) ?? null;
    const donationDate = String(d['donation_date']);
    const purpose = (d['purpose'] as string | null) ?? null;
    const receiptNumber = String(d['receipt_number']);
    const issued = d['issued_at'] !== null;

    const text = [
      `Zuwendungsbestätigung / Spendenbescheinigung`,
      ``,
      `Aussteller: ${clubName}`,
      `Bescheinigungs-Nr.: ${receiptNumber}`,
      ``,
      `Wir bestätigen, dass die nachfolgend genannte Zuwendung ausschließlich zur`,
      `Förderung der satzungsgemäßen gemeinnützigen Zwecke verwendet wird.`,
      ``,
      `Zuwendende/r: ${donorName}`,
      ...(donorAddress ? [`Anschrift: ${donorAddress}`] : []),
      `Betrag: ${amountEur} EUR`,
      `Tag der Zuwendung: ${donationDate}`,
      ...(purpose ? [`Zweck: ${purpose}`] : []),
      ``,
      issued
        ? `Diese Bestätigung wurde ausgestellt.`
        : `ENTWURF — noch nicht ausgestellt.`,
    ].join('\n');

    return c.json(
      donationReceiptSchema.parse({
        donation_id: donationId,
        receipt_number: receiptNumber,
        club_name: clubName,
        donor_name: donorName,
        donor_address: donorAddress,
        amount_cents: amountCents,
        amount_eur: amountEur,
        donation_date: donationDate,
        purpose,
        issued,
        text,
      }),
      200,
    );
  },
);
