// ============================================================================
// routes/locker-rentals.ts — die VERMIETUNG eines Schließfachs (Migration 0070,
// app.locker_rentals). v1-Vorbild: schliessfach_vermietungen.
//
// ### DIE ZWEITE PREISEBENE — UND WARUM SIE NICHT WEGOPTIMIERT WIRD ###
// Das Fach trägt einen LISTENPREIS (app.lockers.price_per_month_cents), die
// Vermietung den TATSÄCHLICH VEREINBARTEN Preis. Der Vorschlag beim Anlegen
// kommt aus dem Listenpreis, die Entscheidung trifft ein Mensch. Diese Datei
// setzt deshalb NIRGENDS ein coalesce(rental.price, locker.price): der
// Listenpreis kann sich ändern, nachdem der Vertrag läuft — ein stiller
// Rückfall würde alte Verträge rückwirkend teurer machen.
//
// null = „Nicht festgelegt", 0 = „kostenlos". Zwei verschiedene Aussagen; die
// API verschmilzt sie nie.
//
// ### WER SIEHT WAS ###
// Die Sichtbarkeit liegt in der RLS (locker_rentals_select, 0070):
//   * lockers/read_all (Voreinstellung owner/admin/treasurer) -> alle Verträge.
//   * alle übrigen -> NUR den eigenen bzw. den des eigenen Kindes
//     (app.can_act_for_member — eine Miete ist eine Zahlungspflicht, und wer
//     zahlt, muss sie sehen; genau wie bei Rechnungen).
// Diese Datei filtert nicht nach, sie fragt ab. Ein Fehler hier kostet eine
// gute Fehlermeldung, nicht die Vertraulichkeit.
//
// ### KINDERSCHUTZ ###
// Es gibt hier BEWUSST keine Route „alle Mieten je Mitglied für die
// Mitgliederliste". Mietpreise und Rückstände gehören nicht in eine Liste von
// Kindern. Die Miete erscheint in der Monatsübersicht DES MITGLIEDS — dafür
// reicht der Filter member_id, den die RLS ohnehin auf das Erlaubte einkürzt.
//
// ### RETURNING-FALLE ###
// Repo-Muster: app.uuid_v7() vorab, INSERT OHNE RETURNING, danach getrennt
// lesen. locker_rentals hat eine restriktive SELECT-Policy (und obendrauf ein
// Modul-Gate) — ein RETURNING liefe hier in ein 42501, sobald jemand die
// Lese-Regel enger zieht als die Schreib-Regel.
// ============================================================================

import { createRoute, z } from '@hono/zod-openapi';
import { createRouter, errorResponses, jsonContent } from '../lib/openapi.js';
import {
  deletedSchema,
  lockerRentalCreateSchema,
  lockerRentalSchema,
  lockerRentalUpdateSchema,
  lockerRentalStatusSchema,
  uuid,
} from '../lib/validation.js';
import { withUser } from '../db.js';
import type { Tx } from '../db.js';
import { problem } from '../middleware/error.js';
import { LOCKER_MANAGE_ROLES, requireClubMember, requireClubRole } from '../lib/guards.js';

export const lockerRentalsRouter = createRouter();

const rentalIdParam = z.object({
  rentalId: uuid.openapi({ param: { name: 'rentalId', in: 'path' } }),
});

/**
 * Lädt eine Vermietung, die die aufrufende Person SEHEN darf (RLS entscheidet).
 * 0 Zeilen -> 404: wer den Vertrag nicht sehen darf, soll auch seine Existenz
 * nicht erschliessen können.
 */
async function loadRental(
  tx: Tx,
  rentalId: string,
): Promise<{ id: string; club_id: string; locker_id: string; member_id: string; status: string }> {
  const rows = await tx`
    select id, club_id, locker_id, member_id, status from app.locker_rentals
    where id = ${rentalId} and deleted_at is null`;
  const row = rows[0];
  if (!row) throw problem(404, 'Not Found', 'Locker rental not found');
  return row as { id: string; club_id: string; locker_id: string; member_id: string; status: string };
}

// GET /locker-rentals?club_id&member_id?&locker_id?&status? ------------------
lockerRentalsRouter.openapi(
  createRoute({
    method: 'get',
    path: '/locker-rentals',
    tags: ['lockers'],
    summary: 'List locker rentals (RLS: locker managers see all, members their own / their children\'s)',
    description:
      'Optional filters: member_id, locker_id, status. A member only ever sees their own or their ' +
      'child\'s rental regardless of the filter — the RLS policy locker_rentals_select decides.',
    security: [{ bearerAuth: [] }],
    request: {
      query: z.object({
        club_id: uuid,
        member_id: uuid.optional(),
        locker_id: uuid.optional(),
        status: lockerRentalStatusSchema.optional(),
      }),
    },
    responses: {
      200: jsonContent(z.array(lockerRentalSchema), 'Rentals visible to the caller'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const { club_id, member_id, locker_id, status } = c.req.valid('query');
    const claims = c.get('claims');
    requireClubMember(claims, club_id);

    const rows = await withUser(claims, (tx) =>
      tx`select * from app.locker_rentals
         where club_id = ${club_id}
           and deleted_at is null
           and (${member_id ?? null}::uuid is null or member_id = ${member_id ?? null})
           and (${locker_id ?? null}::uuid is null or locker_id = ${locker_id ?? null})
           and (${status ?? null}::app.locker_rental_status is null or status = ${status ?? null})
         order by start_on desc`,
    );
    return c.json(z.array(lockerRentalSchema).parse(rows), 200);
  },
);

// POST /locker-rentals -------------------------------------------------------
lockerRentalsRouter.openapi(
  createRoute({
    method: 'post',
    path: '/locker-rentals',
    tags: ['lockers'],
    summary: 'Rent out a locker (owner/admin/treasurer)',
    description:
      'The agreed price may differ from the locker list price and may be null ("not set") or 0 ' +
      '(explicitly free). A locker can only have ONE active rental at a time (unique index).',
    security: [{ bearerAuth: [] }],
    request: {
      body: { content: { 'application/json': { schema: lockerRentalCreateSchema } }, required: true },
    },
    responses: {
      201: jsonContent(lockerRentalSchema, 'Created rental'),
      409: jsonContent(z.object({}).passthrough(), 'This locker already has an active rental'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const body = c.req.valid('json');
    const claims = c.get('claims');
    requireClubRole(claims, body.club_id, LOCKER_MANAGE_ROLES);

    const created = await withUser(claims, async (tx) => {
      // Sprechende 409 statt eines nackten 23505 aus dem Teilindex.
      if (body.status === 'aktiv') {
        const busy = await tx`
          select 1 from app.locker_rentals
          where locker_id = ${body.locker_id} and status = 'aktiv' and deleted_at is null`;
        if (busy.length > 0) {
          throw problem(
            409,
            'Conflict',
            'Dieses Fach ist bereits vermietet — die laufende Vermietung zuerst beenden. ' +
              '/ This locker already has an active rental; end it first.',
          );
        }
      }

      // uuid_v7 vorab + INSERT OHNE RETURNING (RETURNING-Falle, siehe Kopf).
      const [{ id: rentalId }] = (await tx`select app.uuid_v7() as id`) as unknown as [{ id: string }];
      await tx`
        insert into app.locker_rentals
          (id, club_id, locker_id, member_id, price_per_month_cents, start_on, end_on, status, note)
        values
          (${rentalId}, ${body.club_id}, ${body.locker_id}, ${body.member_id},
           ${body.price_per_month_cents ?? null}, ${body.start_on}, ${body.end_on ?? null},
           ${body.status}, ${body.note ?? null})`;
      const rows = await tx`select * from app.locker_rentals where id = ${rentalId}`;
      return rows[0];
    });
    return c.json(lockerRentalSchema.parse(created), 201);
  },
);

// PATCH /locker-rentals/{rentalId} ------------------------------------------
lockerRentalsRouter.openapi(
  createRoute({
    method: 'patch',
    path: '/locker-rentals/{rentalId}',
    tags: ['lockers'],
    summary: 'Edit a locker rental: price, period, status (owner/admin/treasurer)',
    description:
      'club_id, locker_id and member_id are immutable in the database — a different locker means a ' +
      'NEW rental and ending the old one. That keeps payment history attributable.',
    security: [{ bearerAuth: [] }],
    request: {
      params: rentalIdParam,
      body: { content: { 'application/json': { schema: lockerRentalUpdateSchema } }, required: true },
    },
    responses: {
      200: jsonContent(lockerRentalSchema, 'Updated rental'),
      409: jsonContent(z.object({}).passthrough(), 'This locker already has another active rental'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const { rentalId } = c.req.valid('param');
    const body = c.req.valid('json');
    const claims = c.get('claims');

    const updated = await withUser(claims, async (tx) => {
      const rental = await loadRental(tx, rentalId);
      requireClubRole(claims, rental.club_id, LOCKER_MANAGE_ROLES);

      if (body.status === 'aktiv' && rental.status !== 'aktiv') {
        const busy = await tx`
          select 1 from app.locker_rentals
          where locker_id = ${rental.locker_id} and status = 'aktiv'
            and deleted_at is null and id <> ${rentalId}`;
        if (busy.length > 0) {
          throw problem(
            409,
            'Conflict',
            'Dieses Fach hat bereits eine andere laufende Vermietung. ' +
              '/ This locker already has another active rental.',
          );
        }
      }

      const rows = await tx`
        update app.locker_rentals set ${tx(body)}
        where id = ${rentalId} and deleted_at is null
        returning id`;
      if (rows.length === 0) {
        throw problem(403, 'Forbidden', 'Editing a locker rental requires the lockers capability at manage');
      }
      const after = await tx`select * from app.locker_rentals where id = ${rentalId}`;
      return after[0];
    });
    return c.json(lockerRentalSchema.parse(updated), 200);
  },
);

// DELETE /locker-rentals/{rentalId} (soft) ----------------------------------
lockerRentalsRouter.openapi(
  createRoute({
    method: 'delete',
    path: '/locker-rentals/{rentalId}',
    tags: ['lockers'],
    summary: 'Soft-delete a locker rental (owner/admin/treasurer)',
    description:
      'Use this only for a rental entered by mistake. A rental that really happened is ENDED ' +
      '(status beendet/gekuendigt), not deleted — the history is what makes the money traceable.',
    security: [{ bearerAuth: [] }],
    request: { params: rentalIdParam },
    responses: {
      200: jsonContent(deletedSchema, 'Rental soft-deleted'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const { rentalId } = c.req.valid('param');
    const claims = c.get('claims');

    await withUser(claims, async (tx) => {
      const rental = await loadRental(tx, rentalId);
      requireClubRole(claims, rental.club_id, LOCKER_MANAGE_ROLES);
      const rows = await tx`
        update app.locker_rentals set deleted_at = now()
        where id = ${rentalId} and deleted_at is null
        returning id`;
      if (rows.length === 0) {
        throw problem(403, 'Forbidden', 'Deleting a locker rental requires the lockers capability at manage');
      }
    });
    return c.json({ status: 'deleted' as const, id: rentalId }, 200);
  },
);
