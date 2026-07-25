// ============================================================================
// routes/invoice-settings.ts — der BRIEFKOPF eines Vereins (Migration 0080,
// app.invoice_settings). EIN Satz je Verein.
//
//   GET   /invoice-settings?club_id   der Briefkopf (jedes Vereinsmitglied).
//   PATCH /invoice-settings           Upsert des Briefkopfs (is_club_admin).
//
// Schreiben = is_club_admin (owner/admin/moderator) — der Briefkopf ist eine
// Vereins-Grunddarstellung, kein Finanz-Buchungsvorgang; ein Kassenwart fuehrt
// die Kasse, aendert aber nicht die Aussendarstellung. Lesen = Mitglied: wer
// eine Rechnung sieht, sieht auch ihren Briefkopf (die Druckansicht braucht ihn).
// Beide laufen impersoniert (withUser) — die RLS aus 0080 ist die zweite Linie.
// ============================================================================

import { createRoute, z } from '@hono/zod-openapi';
import { createRouter, errorResponses, jsonContent } from '../lib/openapi.js';
import { invoiceSettingsSchema, invoiceSettingsUpdateSchema, uuid } from '../lib/validation.js';
import { withUser } from '../db.js';
import { problem } from '../middleware/error.js';
import { ADMIN_ROLES, requireClubMember, requireClubRole } from '../lib/guards.js';

export const invoiceSettingsRouter = createRouter();

invoiceSettingsRouter.openapi(
  createRoute({
    method: 'get',
    path: '/invoice-settings',
    tags: ['invoices'],
    summary: 'Invoice letterhead/settings of a club (any club member)',
    description:
      'Returns the single per-club letterhead row. 404 when the club has not configured one yet — ' +
      'the client treats that as "use defaults".',
    security: [{ bearerAuth: [] }],
    request: { query: z.object({ club_id: uuid }) },
    responses: {
      200: jsonContent(invoiceSettingsSchema, 'The club letterhead/settings'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const { club_id } = c.req.valid('query');
    requireClubMember(c.get('claims'), club_id);
    const row = await withUser(c.get('claims'), async (tx) => {
      const rows = await tx`select * from app.invoice_settings where club_id = ${club_id}`;
      return rows[0];
    });
    if (!row) throw problem(404, 'Not Found', 'No invoice settings configured for this club');
    return c.json(invoiceSettingsSchema.parse(row), 200);
  },
);

invoiceSettingsRouter.openapi(
  createRoute({
    method: 'patch',
    path: '/invoice-settings',
    tags: ['invoices'],
    summary: 'Create or update a club letterhead (is_club_admin)',
    description:
      'Upsert (one row per club, keyed by club_id). Only the fields sent are written; omitted ' +
      'fields keep their value (or the default on first creation).',
    security: [{ bearerAuth: [] }],
    request: {
      body: { content: { 'application/json': { schema: invoiceSettingsUpdateSchema } }, required: true },
    },
    responses: {
      200: jsonContent(invoiceSettingsSchema, 'The stored letterhead'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const body = c.req.valid('json');
    const claims = c.get('claims');
    requireClubRole(claims, body.club_id, ADMIN_ROLES);

    const { club_id, ...fields } = body;

    const saved = await withUser(claims, async (tx) => {
      // 1. Sicherstellen, dass ein Satz existiert (Defaults fuer alle Spalten).
      //    on conflict do nothing -> die INSERT-Policy (is_club_admin) greift nur
      //    beim erstmaligen Anlegen; danach ist es ein reines UPDATE.
      await tx`
        insert into app.invoice_settings (club_id)
        values (${club_id})
        on conflict (club_id) do nothing`;

      // 2. Nur die uebergebenen Felder schreiben (leeres Objekt -> reines Lesen).
      if (Object.keys(fields).length > 0) {
        const rows = await tx`
          update app.invoice_settings set ${tx(fields)}
          where club_id = ${club_id}
          returning *`;
        if (rows.length === 0) throw problem(403, 'Forbidden', 'Update rejected (role or module gate)');
        return rows[0];
      }
      const rows = await tx`select * from app.invoice_settings where club_id = ${club_id}`;
      if (rows.length === 0) throw problem(403, 'Forbidden', 'Insert rejected (role or module gate)');
      return rows[0];
    });

    return c.json(invoiceSettingsSchema.parse(saved), 200);
  },
);
