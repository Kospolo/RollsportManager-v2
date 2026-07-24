// ============================================================================
// routes/invoice-items.ts — RECHNUNGSPOSITIONEN (Migration 0072,
// app.invoice_items). Menge x Einzelpreis + Umsatzsteuersatz.
//
// ### DIESE DATEI RECHNET NICHT ###
// net_cents, vat_cents und gross_cents sind GENERATED-Spalten der Datenbank.
// Der Client schickt sie nicht, und dieser Handler berechnet sie nicht. Das ist
// der ganze Punkt: es gibt genau eine Rundungsregel, und sie steht in 0072.
// Drei Plattformen, die dieselbe Multiplikation je selbst runden, ergeben
// irgendwann drei Beträge — und dann streitet ein Verein mit einer Familie über
// einen Cent, weil zwei Programme unterschiedlich gerundet haben.
//
// Aus demselben Grund schreibt auch niemand hier app.invoices.amount_cents:
// sobald eine Rechnung Positionen hat, schreibt der DB-Trigger
// app.invoice_items_recalc die Summe fort. Ein zweiter, frei tippbarer Betrag
// daneben wäre eine zweite Wahrheit.
//
// ### NUR AM ENTWURF (GoBD) ###
// Positionen sind nur veränderbar, solange die Rechnung 'draft' ist — das
// erzwingt der Trigger app.protect_invoice_item, nicht dieser Handler. Der
// Handler prüft es trotzdem VORHER, damit die Antwort ein verständliches 409
// ist und kein nacktes 42501.
//
// ### LESEN FOLGT DER RECHNUNG ###
// invoice_items_select hängt an der Sichtbarkeit der Rechnung: wer die Rechnung
// sieht — auch die Mutter für ihr Kind —, sieht ihre Positionen. Es gibt hier
// keine zweite Lesart, die beim nächsten Umbau vergessen werden könnte.
// ============================================================================

import { createRoute, z } from '@hono/zod-openapi';
import { createRouter, errorResponses, jsonContent } from '../lib/openapi.js';
import {
  deletedSchema,
  invoiceItemCreateSchema,
  invoiceItemSchema,
  invoiceItemUpdateSchema,
  uuid,
} from '../lib/validation.js';
import { withUser } from '../db.js';
import type { Tx } from '../db.js';
import { problem } from '../middleware/error.js';
import { FINANCE_ROLES, requireClubMember, requireClubRole } from '../lib/guards.js';

export const invoiceItemsRouter = createRouter();

const itemIdParam = z.object({
  itemId: uuid.openapi({ param: { name: 'itemId', in: 'path' } }),
});

/** Lädt die Rechnung, soweit sichtbar. 0 Zeilen -> 404 (keine Existenzauskunft). */
async function loadInvoice(
  tx: Tx,
  invoiceId: string,
): Promise<{ id: string; club_id: string; status: string; number: string }> {
  const rows = await tx`
    select id, club_id, status, number from app.invoices where id = ${invoiceId}`;
  const row = rows[0];
  if (!row) throw problem(404, 'Not Found', 'Invoice not found');
  return row as { id: string; club_id: string; status: string; number: string };
}

/** Der GoBD-Zwang als sprechende Antwort, bevor der DB-Trigger 42501 wirft. */
function assertDraft(invoice: { status: string; number: string }): void {
  if (invoice.status !== 'draft') {
    throw problem(
      409,
      'Conflict',
      `Rechnung ${invoice.number} ist kein Entwurf mehr (Status: ${invoice.status}) — ` +
        'Positionen einer ausgestellten Rechnung sind unveränderlich. Stornieren und neu ausstellen. ' +
        `/ Invoice ${invoice.number} is no longer a draft; items of an issued invoice are immutable.`,
    );
  }
}

// GET /invoice-items?invoice_id ---------------------------------------------
invoiceItemsRouter.openapi(
  createRoute({
    method: 'get',
    path: '/invoice-items',
    tags: ['invoices'],
    summary: 'List the line items of one invoice (visible to whoever may see the invoice)',
    security: [{ bearerAuth: [] }],
    request: { query: z.object({ club_id: uuid, invoice_id: uuid }) },
    responses: {
      200: jsonContent(z.array(invoiceItemSchema), 'Line items visible to the caller'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const { club_id, invoice_id } = c.req.valid('query');
    const claims = c.get('claims');
    requireClubMember(claims, club_id);
    const rows = await withUser(claims, (tx) =>
      tx`select * from app.invoice_items
         where club_id = ${club_id} and invoice_id = ${invoice_id}
         order by sort_order, created_at`,
    );
    return c.json(z.array(invoiceItemSchema).parse(rows), 200);
  },
);

// POST /invoice-items --------------------------------------------------------
invoiceItemsRouter.openapi(
  createRoute({
    method: 'post',
    path: '/invoice-items',
    tags: ['invoices'],
    summary: 'Add a line item to a DRAFT invoice (finance roles)',
    description:
      'Line net/VAT/gross are computed by the database (generated columns) and must not be sent. ' +
      'Adding an item rewrites invoices.amount_cents and invoices.vat_total_cents from the items.',
    security: [{ bearerAuth: [] }],
    request: {
      body: { content: { 'application/json': { schema: invoiceItemCreateSchema } }, required: true },
    },
    responses: {
      201: jsonContent(invoiceItemSchema, 'Created line item'),
      409: jsonContent(z.object({}).passthrough(), 'The invoice is no longer a draft'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const body = c.req.valid('json');
    const claims = c.get('claims');
    requireClubRole(claims, body.club_id, FINANCE_ROLES);

    const created = await withUser(claims, async (tx) => {
      const invoice = await loadInvoice(tx, body.invoice_id);
      if (invoice.club_id !== body.club_id) {
        throw problem(400, 'Bad Request', 'invoice_id does not belong to club_id');
      }
      assertDraft(invoice);

      // uuid_v7 vorab + INSERT OHNE RETURNING (Repo-Muster gegen die
      // RETURNING-Falle: invoice_items hat eine eigene SELECT-Policy und ein
      // Modul-Gate obendrauf).
      const [{ id: itemId }] = (await tx`select app.uuid_v7() as id`) as unknown as [{ id: string }];
      await tx`
        insert into app.invoice_items
          (id, club_id, invoice_id, sort_order, description, quantity, unit_price_cents, vat_rate)
        values
          (${itemId}, ${body.club_id}, ${body.invoice_id}, ${body.sort_order}, ${body.description},
           ${body.quantity}, ${body.unit_price_cents}, ${body.vat_rate})`;
      const rows = await tx`select * from app.invoice_items where id = ${itemId}`;
      return rows[0];
    });
    return c.json(invoiceItemSchema.parse(created), 201);
  },
);

// PATCH /invoice-items/{itemId} ---------------------------------------------
invoiceItemsRouter.openapi(
  createRoute({
    method: 'patch',
    path: '/invoice-items/{itemId}',
    tags: ['invoices'],
    summary: 'Edit a line item of a DRAFT invoice (finance roles)',
    security: [{ bearerAuth: [] }],
    request: {
      params: itemIdParam,
      body: { content: { 'application/json': { schema: invoiceItemUpdateSchema } }, required: true },
    },
    responses: {
      200: jsonContent(invoiceItemSchema, 'Updated line item'),
      409: jsonContent(z.object({}).passthrough(), 'The invoice is no longer a draft'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const { itemId } = c.req.valid('param');
    const body = c.req.valid('json');
    const claims = c.get('claims');

    const updated = await withUser(claims, async (tx) => {
      const rows = await tx`
        select id, club_id, invoice_id from app.invoice_items where id = ${itemId}`;
      const item = rows[0] as { club_id: string; invoice_id: string } | undefined;
      if (!item) throw problem(404, 'Not Found', 'Invoice item not found');
      requireClubRole(claims, item.club_id, FINANCE_ROLES);
      assertDraft(await loadInvoice(tx, item.invoice_id));

      const changed = await tx`
        update app.invoice_items set ${tx(body)} where id = ${itemId} returning id`;
      if (changed.length === 0) throw problem(403, 'Forbidden', 'Editing this line item is not allowed');
      const after = await tx`select * from app.invoice_items where id = ${itemId}`;
      return after[0];
    });
    return c.json(invoiceItemSchema.parse(updated), 200);
  },
);

// DELETE /invoice-items/{itemId} --------------------------------------------
invoiceItemsRouter.openapi(
  createRoute({
    method: 'delete',
    path: '/invoice-items/{itemId}',
    tags: ['invoices'],
    summary: 'Remove a line item from a DRAFT invoice (finance roles)',
    description:
      'Hard delete — a draft is not a booking. Removing the LAST item leaves the invoice at ' +
      'amount_cents = 0, which is the only honest answer for an invoice without items.',
    security: [{ bearerAuth: [] }],
    request: { params: itemIdParam },
    responses: {
      200: jsonContent(deletedSchema, 'Line item removed'),
      409: jsonContent(z.object({}).passthrough(), 'The invoice is no longer a draft'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const { itemId } = c.req.valid('param');
    const claims = c.get('claims');

    await withUser(claims, async (tx) => {
      const rows = await tx`
        select id, club_id, invoice_id from app.invoice_items where id = ${itemId}`;
      const item = rows[0] as { club_id: string; invoice_id: string } | undefined;
      if (!item) throw problem(404, 'Not Found', 'Invoice item not found');
      requireClubRole(claims, item.club_id, FINANCE_ROLES);
      assertDraft(await loadInvoice(tx, item.invoice_id));

      const gone = await tx`delete from app.invoice_items where id = ${itemId} returning id`;
      if (gone.length === 0) throw problem(403, 'Forbidden', 'Deleting this line item is not allowed');
    });
    return c.json({ status: 'deleted' as const, id: itemId }, 200);
  },
);
