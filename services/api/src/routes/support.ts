// ============================================================================
// routes/support.ts - Support-Tickets: Verein <-> Betreiber (Migration 0052).
//
// ### WER DARF WAS ###
//   Verein   : der VORSTAND (owner/admin/moderator = app.is_club_admin).
//              Ticket aufmachen, eigene Tickets lesen, antworten.
//              KEIN einfaches Mitglied, KEIN Trainer, KEIN Kassenwart - ein
//              Ticket enthaelt Klartext-Probleme mit Namen von Mitgliedern,
//              oft Kindern. Begruendung der Rollenwahl: Kopf von 0052.
//   Betreiber: alle Tickets aller Mandanten + Status/Prioritaet.
//
// ### WARUM ROLLE STATT FAEHIGKEIT (requireClubRoleDb statt requireCap) ###
// Weil es zur Rollenmenge KEINE passende Faehigkeit gibt und keine gebaut
// werden konnte: 93j_capability_enforcement.sql:37 nagelt den Katalog auf
// exakt 32 Eintraege, und eine vorhandene Faehigkeit mitzubenutzen faellt an
// 93j Abschnitt B (Etikett 'unenforced' + Policy-Nutzung). Vollstaendig
// nachgerechnet im Kopf von 0052. Das ist genau der Fall, den
// lib/capabilities.ts (requireClubRoleDb) beschreibt - /reports/summary ist der
// Praezedenzfall.
//
// ### WARUM withUser UND NICHT withServiceRole - auch beim Betreiber ###
// routes/platform.ts liest im Service-Mode, mit einem benannten Grund: seine
// Aggregate brauchen app.profiles, und das ist own-row unter RLS - ein
// Cross-Club-Query kaeme unter den Claims des Aufrufers nicht durch.
// DIESER Grund traegt hier NICHT: die Namen kommen aus app.club_members, und
// dessen SELECT-Policy haengt an app.is_club_member (0002:317-319), das seit
// 0025:85-94 den platform-admin-Zweig traegt. Der Betreiber kommt also unter
// seinen EIGENEN Claims an alles heran, was er sehen darf - und RLS bleibt die
// zweite Verteidigungslinie, statt fuer die Bequemlichkeit abgeschaltet zu
// werden. Der Guard ist die erste Linie, nicht die einzige.
//
// ### author_name: warum der Betreiber namenlos bleibt ###
// Die Anzeigenamen kommen aus app.club_members, nicht aus app.profiles (own-row
// -> beide Seiten saehen sonst nur sich selbst). Der Betreiber HAT keine
// club_members-Zeile, seine Nachrichten liefern author_name = null, und die
// Oberflaeche schreibt "Support-Team" / "Support team" darueber. Das ist
// beabsichtigt: welcher Mensch beim Betreiber geantwortet hat, geht den Verein
// nichts an - und andersherum braucht der Verein keinen Klarnamen, um Support
// zu bekommen.
//
// ### KEIN MAILVERSAND ###
// services/api/package.json hat keinen Mail-Client. Weder ein neues Ticket noch
// eine Antwort BENACHRICHTIGT IRGENDJEMANDEN - beide Seiten muessen selbst
// hinsehen. Anflanschpunkt spaeter: app.support_touch_ticket() (0052) sieht
// jede neue Nachricht bereits.
// ============================================================================

import { createRoute, z } from '@hono/zod-openapi';
import { createRouter, errorResponses, jsonContent } from '../lib/openapi.js';
import {
  supportMessageCreateSchema,
  supportTicketCreateSchema,
  supportTicketDetailSchema,
  supportTicketSchema,
  supportTicketUpdateSchema,
  uuid,
} from '../lib/validation.js';
import { withUser } from '../db.js';
import type { Tx } from '../db.js';
import { ADMIN_ROLES, isPlatformAdmin, requirePlatformAdmin } from '../lib/guards.js';
import { requireClubRoleDb } from '../lib/capabilities.js';
import { problem } from '../middleware/error.js';

export const supportRouter = createRouter();

const ticketIdParam = z.object({
  ticketId: uuid.openapi({ param: { name: 'ticketId', in: 'path' } }),
});

/**
 * Die Ticket-Projektion. EINE Stelle, damit Vereins- und Betreiber-Liste
 * garantiert dieselben Felder liefern (der Betreiber-Trupp baut seine
 * Oberflaeche gegen genau dieses Schema).
 *
 * Namen aus app.club_members: siehe Kopf. `sql` ist ein Fragment und wird von
 * postgres.js in das umgebende Template eingesetzt - kein String-Concat, keine
 * Injektionsflaeche (es stehen ohnehin keine Nutzerdaten drin).
 */
const ticketColumns = (tx: Tx) => tx`
  t.id, t.club_id, t.created_by_member_id, t.subject, t.status, t.priority,
  t.last_reply_at, t.last_reply_by, t.closed_at, t.created_at, t.updated_at,
  (select c.name from app.clubs c where c.id = t.club_id) as club_name,
  (select nullif(btrim(concat_ws(' ', m.first_name, m.last_name)), '')
     from app.club_members m where m.id = t.created_by_member_id) as created_by_name,
  (select count(*) from app.support_messages sm where sm.ticket_id = t.id)::int as message_count`;

// ---------------------------------------------------------------------------
// GET /support/tickets?club_id=... - die Tickets EINES Vereins.
// ---------------------------------------------------------------------------
supportRouter.openapi(
  createRoute({
    method: 'get',
    path: '/support/tickets',
    tags: ['support'],
    summary: 'Support tickets of one club (club board only)',
    security: [{ bearerAuth: [] }],
    request: { query: z.object({ club_id: uuid }) },
    responses: {
      200: jsonContent(z.array(supportTicketSchema), 'Tickets of the club, most recent activity first'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const { club_id } = c.req.valid('query');
    // Ehrliches 403 statt einer leeren Liste. RLS wuerde ohnehin filtern.
    await requireClubRoleDb(c, club_id, ADMIN_ROLES, 'club_settings');

    const rows = await withUser(c.get('claims'), (tx) =>
      tx`select ${ticketColumns(tx)}
         from app.support_tickets t
         where t.club_id = ${club_id} and t.deleted_at is null
         order by coalesce(t.last_reply_at, t.created_at) desc`,
    );
    return c.json(z.array(supportTicketSchema).parse(rows), 200);
  },
);

// ---------------------------------------------------------------------------
// POST /support/tickets - ein Anliegen aufmachen (Verein).
// ---------------------------------------------------------------------------
supportRouter.openapi(
  createRoute({
    method: 'post',
    path: '/support/tickets',
    tags: ['support'],
    summary: 'Open a support ticket (club board only)',
    security: [{ bearerAuth: [] }],
    request: {
      body: { content: { 'application/json': { schema: supportTicketCreateSchema } }, required: true },
    },
    responses: {
      201: jsonContent(supportTicketDetailSchema, 'Created ticket incl. its opening message'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const body = c.req.valid('json');
    const claims = c.get('claims');
    await requireClubRoleDb(c, body.club_id, ADMIN_ROLES, 'club_settings');

    const created = await withUser(claims, async (tx) => {
      // Die EIGENE Mitgliedszeile - nie eine vom Client genannte. Der Vertrag
      // fragt gar nicht erst danach (validation.ts), und 0052 verboete es.
      const me = await tx`
        select id from app.club_members
        where club_id = ${body.club_id} and profile_id = ${claims.sub}
          and deleted_at is null and status = 'active'
        limit 1`;
      const memberId = me[0]?.['id'] as string | undefined;
      if (memberId === undefined) {
        // requireClubRoleDb war gruen -> eine aktive Mitgliedschaft MUSS es
        // geben. Kommen wir hier an, widersprechen sich member_roles und
        // club_members; dann lieber ein ehrlicher Fehler als ein Ticket ohne
        // Absender.
        throw problem(403, 'Forbidden', 'Keine aktive Mitgliedschaft in diesem Verein. / No active membership in this club.');
      }

      const ticketRows = await tx`
        insert into app.support_tickets (club_id, created_by_member_id, subject)
        values (${body.club_id}, ${memberId}, ${body.subject})
        returning id`;
      const ticketId = ticketRows[0]?.['id'] as string;

      // Die Eroeffnungsnachricht. Sie setzt per Trigger last_reply_* am Ticket.
      await tx`
        insert into app.support_messages (ticket_id, club_id, author_profile_id, author_kind, body)
        values (${ticketId}, ${body.club_id}, ${claims.sub}, 'club', ${body.body})`;

      return loadTicketDetail(tx, ticketId);
    });

    return c.json(supportTicketDetailSchema.parse(created), 201);
  },
);

// ---------------------------------------------------------------------------
// GET /support/tickets/{ticketId} - Ticket samt Verlauf.
// Vorstand UND Betreiber gehen durch dieselbe Route; wer was sieht, entscheidet
// RLS. Ein unsichtbares Ticket ist von einem nicht existierenden nicht zu
// unterscheiden -> 404, kein 403 (sonst waere die blosse Existenz eines Tickets
// bei einem fremden Verein abfragbar).
// ---------------------------------------------------------------------------
supportRouter.openapi(
  createRoute({
    method: 'get',
    path: '/support/tickets/{ticketId}',
    tags: ['support'],
    summary: 'One ticket incl. its message history (club board or operator)',
    security: [{ bearerAuth: [] }],
    request: { params: ticketIdParam },
    responses: {
      200: jsonContent(supportTicketDetailSchema, 'The ticket and its messages'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const { ticketId } = c.req.valid('param');
    const detail = await withUser(c.get('claims'), (tx) => loadTicketDetail(tx, ticketId));
    return c.json(supportTicketDetailSchema.parse(detail), 200);
  },
);

// ---------------------------------------------------------------------------
// POST /support/tickets/{ticketId}/messages - antworten. Beide Seiten.
// ---------------------------------------------------------------------------
supportRouter.openapi(
  createRoute({
    method: 'post',
    path: '/support/tickets/{ticketId}/messages',
    tags: ['support'],
    summary: 'Reply to a ticket (club board or operator)',
    security: [{ bearerAuth: [] }],
    request: {
      params: ticketIdParam,
      body: { content: { 'application/json': { schema: supportMessageCreateSchema } }, required: true },
    },
    responses: {
      201: jsonContent(supportTicketDetailSchema, 'The ticket incl. the new message'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const { ticketId } = c.req.valid('param');
    const body = c.req.valid('json');
    const claims = c.get('claims');

    // author_kind wird NICHT vom Client geglaubt und auch nicht erfragt: es
    // folgt aus dem Token. app.support_guard_message (0052) prueft es
    // zusaetzlich in der DB gegen die Wirklichkeit - ein Verein kann sich nicht
    // als Betreiber ausgeben und umgekehrt.
    const authorKind = isPlatformAdmin(claims) ? 'platform' : 'club';

    const detail = await withUser(claims, async (tx) => {
      // Zuerst das Ticket unter RLS holen: das klaert Sichtbarkeit (404) und
      // liefert den club_id, den die Nachricht denormalisiert mitfuehrt.
      const rows = await tx`
        select id, club_id from app.support_tickets
        where id = ${ticketId} and deleted_at is null`;
      const ticket = rows[0];
      if (ticket === undefined) throw problem(404, 'Not Found', 'Ticket not found');

      await tx`
        insert into app.support_messages (ticket_id, club_id, author_profile_id, author_kind, body)
        values (${ticketId}, ${ticket['club_id'] as string}, ${claims.sub}, ${authorKind}, ${body.body})`;

      return loadTicketDetail(tx, ticketId);
    });

    return c.json(supportTicketDetailSchema.parse(detail), 201);
  },
);

// ---------------------------------------------------------------------------
// PATCH /support/tickets/{ticketId} - Status/Prioritaet. NUR der Betreiber.
// Das ist seine Warteschlange; der Verein wirkt ueber Nachrichten (und ueber
// die eine Automatik waiting_on_club -> open in 0052).
// ---------------------------------------------------------------------------
supportRouter.openapi(
  createRoute({
    method: 'patch',
    path: '/support/tickets/{ticketId}',
    tags: ['support'],
    summary: 'Set status/priority of a ticket (platform operator only)',
    security: [{ bearerAuth: [] }],
    request: {
      params: ticketIdParam,
      body: { content: { 'application/json': { schema: supportTicketUpdateSchema } }, required: true },
    },
    responses: {
      200: jsonContent(supportTicketDetailSchema, 'The updated ticket'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const { ticketId } = c.req.valid('param');
    const body = c.req.valid('json');
    const claims = c.get('claims');
    requirePlatformAdmin(claims);

    const detail = await withUser(claims, async (tx) => {
      // tx(body) baut das SET aus genau den gelieferten Feldern; das Schema
      // laesst nur status/priority zu (und verlangt mindestens eines).
      const rows = await tx`
        update app.support_tickets set ${tx(body)}
        where id = ${ticketId} and deleted_at is null
        returning id`;
      if (rows.length === 0) throw problem(404, 'Not Found', 'Ticket not found');
      return loadTicketDetail(tx, ticketId);
    });

    return c.json(supportTicketDetailSchema.parse(detail), 200);
  },
);

// ---------------------------------------------------------------------------
// GET /platform/support/tickets - ALLE Tickets, mandantenuebergreifend.
// Die Warteschlange des Betreibers. Diese Route nutzt der Betreiber-Trupp.
// ---------------------------------------------------------------------------
supportRouter.openapi(
  createRoute({
    method: 'get',
    path: '/platform/support/tickets',
    tags: ['platform', 'support'],
    summary: 'All support tickets across all clubs (platform admin only)',
    security: [{ bearerAuth: [] }],
    request: {
      query: z.object({
        /** Optionaler Filter auf einen Mandanten - fuer den Verein-Umschalter. */
        club_id: uuid.optional(),
      }),
    },
    responses: {
      200: jsonContent(z.array(supportTicketSchema), 'All tickets, most recent activity first'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const claims = c.get('claims');
    requirePlatformAdmin(claims);
    const { club_id } = c.req.valid('query');

    // withUser, NICHT withServiceRole - Begruendung im Dateikopf. Die
    // SELECT-Policy (0052) laesst den Betreiber quer durch alle Mandanten, RLS
    // bleibt aktiv.
    const rows = await withUser(claims, (tx) =>
      tx`select ${ticketColumns(tx)}
         from app.support_tickets t
         where t.deleted_at is null
           and (${club_id ?? null}::uuid is null or t.club_id = ${club_id ?? null})
         order by coalesce(t.last_reply_at, t.created_at) desc`,
    );
    return c.json(z.array(supportTicketSchema).parse(rows), 200);
  },
);

/**
 * Ticket + Verlauf unter den Claims des Aufrufers. Sieht RLS das Ticket nicht,
 * gibt es das Ticket fuer diesen Aufrufer nicht -> 404.
 */
async function loadTicketDetail(tx: Tx, ticketId: string): Promise<unknown> {
  const rows = await tx`
    select ${ticketColumns(tx)}
    from app.support_tickets t
    where t.id = ${ticketId} and t.deleted_at is null`;
  const ticket = rows[0];
  if (ticket === undefined) throw problem(404, 'Not Found', 'Ticket not found');

  const messages = await tx`
    select sm.id, sm.ticket_id, sm.club_id, sm.author_profile_id, sm.author_kind, sm.body,
           sm.created_at,
           (select nullif(btrim(concat_ws(' ', m.first_name, m.last_name)), '')
              from app.club_members m
             where m.profile_id = sm.author_profile_id and m.club_id = sm.club_id
               and m.deleted_at is null
             limit 1) as author_name
    from app.support_messages sm
    where sm.ticket_id = ${ticketId}
    order by sm.created_at, sm.id`;

  return { ...ticket, messages };
}
