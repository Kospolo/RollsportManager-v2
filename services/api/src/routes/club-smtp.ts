// ============================================================================
// routes/club-smtp.ts — der EIGENE SMTP-Absender eines Vereins (Migration 0081,
// app.clubs.smtp_*). Fuer Anmeldungs-/Info-Mails, die aus dem Verein selbst
// kommen sollen statt vom Plattform-Absender (v1-Modell).
//
//   GET   /clubs/{clubId}/smtp   die SMTP-Konfiguration (is_club_admin).
//   PATCH /clubs/{clubId}/smtp   Aendern der Konfiguration (is_club_admin).
//
// ADMIN-ONLY, an DREI Stellen (Tiefenstaffelung, siehe Migration 0081):
//   1. requireClubRoleDb(ADMIN_ROLES) hier — ehrliches 403 + Betreiber-Zweck.
//   2. RLS clubs_update = app.is_club_admin (die zweite Linie fuer Schreiben).
//   3. Der SMTP-Block steht NICHT in der allgemeinen (mitglieds-lesbaren)
//      Vereinsansicht (CLUB_COLUMNS) — er ist NUR ueber diesen Endpunkt sichtbar.
//
// DATENSCHUTZ: das Passwort ist WRITE-ONLY. Der Response traegt nur
// smtp_password_set:boolean, NIE den Klartext — exakt wie platform-settings.ts.
// PATCH nimmt es entgegen und ERSETZT das gespeicherte nur, wenn ein Wert kam;
// weglassen behaelt das bestehende.
// ============================================================================

import { createRoute, z } from '@hono/zod-openapi';
import { createRouter, errorResponses, jsonContent } from '../lib/openapi.js';
import { clubSmtpSchema, clubSmtpUpdateSchema, uuid } from '../lib/validation.js';
import { withUser } from '../db.js';
import { problem } from '../middleware/error.js';
import { ADMIN_ROLES } from '../lib/guards.js';
import { requireClubRoleDb } from '../lib/capabilities.js';

export const clubSmtpRouter = createRouter();

const clubIdParam = z.object({ clubId: uuid.openapi({ param: { name: 'clubId', in: 'path' } }) });

/** Die mitglieds-lesbaren SMTP-Spalten + der maskierte Passwort-Zustand. */
const SMTP_SELECT = `id as club_id, smtp_host, smtp_port, smtp_user, smtp_from,
                     smtp_secure, (smtp_password <> '') as smtp_password_set`;

clubSmtpRouter.openapi(
  createRoute({
    method: 'get',
    path: '/clubs/{clubId}/smtp',
    tags: ['clubs'],
    summary: 'Vereins-SMTP lesen (is_club_admin) / Read a club SMTP config',
    description:
      'Liefert die SMTP-Konfiguration des Vereins (Host/Port/User/Absender/SSL). Das Passwort ' +
      'wird NIE im Klartext geliefert — nur smtp_password_set:boolean zeigt, ob eines hinterlegt ist. ' +
      'Erfordert is_club_admin (owner/admin/moderator). / Returns the club SMTP config; password masked.',
    security: [{ bearerAuth: [] }],
    request: { params: clubIdParam },
    responses: {
      200: jsonContent(clubSmtpSchema, 'Die SMTP-Konfiguration (Passwort maskiert)'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const { clubId } = c.req.valid('param');
    await requireClubRoleDb(c, clubId, ADMIN_ROLES, 'club_settings');
    const rows = await withUser(c.get('claims'), (tx) =>
      tx`select ${tx.unsafe(SMTP_SELECT)} from app.clubs where id = ${clubId} and deleted_at is null`,
    );
    if (rows.length === 0) throw problem(404, 'Not Found', 'Club not found');
    return c.json(clubSmtpSchema.parse(rows[0]), 200);
  },
);

clubSmtpRouter.openapi(
  createRoute({
    method: 'patch',
    path: '/clubs/{clubId}/smtp',
    tags: ['clubs'],
    summary: 'Vereins-SMTP aendern (is_club_admin) / Update a club SMTP config',
    description:
      'Schreibt nur die uebergebenen Felder; fehlende behalten ihren Wert. Das Passwort ist ' +
      'WRITE-ONLY: senden ersetzt (leerer String loescht), weglassen behaelt das gespeicherte. ' +
      'Der Response maskiert es zu smtp_password_set. Erfordert is_club_admin.',
    security: [{ bearerAuth: [] }],
    request: {
      params: clubIdParam,
      body: { content: { 'application/json': { schema: clubSmtpUpdateSchema } }, required: true },
    },
    responses: {
      200: jsonContent(clubSmtpSchema, 'Die gespeicherte SMTP-Konfiguration (Passwort maskiert)'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const { clubId } = c.req.valid('param');
    const body = c.req.valid('json');
    await requireClubRoleDb(c, clubId, ADMIN_ROLES, 'club_settings');

    // Nur die uebergebenen Felder schreiben. smtp_password steht (als einziges)
    // im Patch-Schema optional und geht 1:1 mit — kommt es nicht, bleibt das
    // gespeicherte Passwort unangetastet (WRITE-ONLY).
    const fields: Record<string, unknown> = { ...body };

    const rows = await withUser(c.get('claims'), (tx) =>
      tx`update app.clubs set ${tx(fields)}
         where id = ${clubId} and deleted_at is null
         returning ${tx.unsafe(SMTP_SELECT)}`,
    );
    if (rows.length === 0) throw problem(404, 'Not Found', 'Club not found');
    return c.json(clubSmtpSchema.parse(rows[0]), 200);
  },
);
