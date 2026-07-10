// ============================================================================
// routes/equipment-reservations.ts - gear borrow records ("Ausleihe").
//
// Read:   every club member (is_club_member).
// Insert: coaching staff for anyone, OR a plain member FOR THEMSELVES
//         (reserved_by_member_id = the caller's own club_members row).
// Edit/Delete (soft): the creator OR coaching staff.
// Same self-service model as facility-bookings; the API guard mirrors the RLS
// policy (app.is_own_member / is_club_trainer, migration 0009).
// ============================================================================

import { createRoute, z } from '@hono/zod-openapi';
import { createRouter, errorResponses, jsonContent } from '../lib/openapi.js';
import {
  deletedSchema,
  equipmentReservationCreateSchema,
  equipmentReservationSchema,
  equipmentReservationUpdateSchema,
  uuid,
} from '../lib/validation.js';
import { withUser } from '../db.js';
import type { Tx } from '../db.js';
import { problem } from '../middleware/error.js';
import { COACH_ROLES, hasClubRole, requireClubMember } from '../lib/guards.js';
import { isOwnMember } from '../lib/ownership.js';

export const equipmentReservationsRouter = createRouter();

const reservationIdParam = z.object({
  reservationId: uuid.openapi({ param: { name: 'reservationId', in: 'path' } }),
});

async function loadReservation(
  tx: Tx,
  reservationId: string,
): Promise<{ id: string; club_id: string; reserved_by_member_id: string }> {
  const rows = await tx`
    select id, club_id, reserved_by_member_id from app.equipment_reservations
    where id = ${reservationId} and deleted_at is null`;
  const row = rows[0];
  if (!row) throw problem(404, 'Not Found', 'Reservation not found');
  return row as { id: string; club_id: string; reserved_by_member_id: string };
}

equipmentReservationsRouter.openapi(
  createRoute({
    method: 'get',
    path: '/equipment-reservations',
    tags: ['equipment'],
    summary: 'List reservations of a club (optionally filtered by equipment)',
    security: [{ bearerAuth: [] }],
    request: {
      query: z.object({ club_id: uuid, equipment_id: uuid.optional() }),
    },
    responses: {
      200: jsonContent(z.array(equipmentReservationSchema), 'Reservations visible to the caller'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const { club_id, equipment_id } = c.req.valid('query');
    requireClubMember(c.get('claims'), club_id);
    const rows = await withUser(c.get('claims'), (tx) =>
      tx`select * from app.equipment_reservations
         where club_id = ${club_id} and deleted_at is null
           and (${equipment_id ?? null}::uuid is null or equipment_id = ${equipment_id ?? null})
         order by from_at desc`,
    );
    return c.json(z.array(equipmentReservationSchema).parse(rows), 200);
  },
);

equipmentReservationsRouter.openapi(
  createRoute({
    method: 'post',
    path: '/equipment-reservations',
    tags: ['equipment'],
    summary: 'Create a reservation (staff for anyone, or a member for themselves)',
    security: [{ bearerAuth: [] }],
    request: {
      body: {
        content: { 'application/json': { schema: equipmentReservationCreateSchema } },
        required: true,
      },
    },
    responses: {
      201: jsonContent(equipmentReservationSchema, 'Created reservation'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const body = c.req.valid('json');
    const claims = c.get('claims');
    requireClubMember(claims, body.club_id);
    const isTrainer = hasClubRole(claims, body.club_id, COACH_ROLES);

    const created = await withUser(claims, async (tx) => {
      if (!isTrainer && !(await isOwnMember(tx, claims, body.reserved_by_member_id))) {
        throw problem(403, 'Forbidden', 'Members may only reserve for themselves; reserving for others needs a coaching role');
      }
      const rows = await tx`
        insert into app.equipment_reservations
          (equipment_id, club_id, reserved_by_member_id, quantity, from_at, to_at, status)
        values
          (${body.equipment_id}, ${body.club_id}, ${body.reserved_by_member_id}, ${body.quantity},
           ${body.from_at}, ${body.to_at}, ${body.status})
        returning *`;
      return rows[0];
    });
    return c.json(equipmentReservationSchema.parse(created), 201);
  },
);

equipmentReservationsRouter.openapi(
  createRoute({
    method: 'patch',
    path: '/equipment-reservations/{reservationId}',
    tags: ['equipment'],
    summary: 'Edit a reservation (creator or coaching staff)',
    security: [{ bearerAuth: [] }],
    request: {
      params: reservationIdParam,
      body: {
        content: { 'application/json': { schema: equipmentReservationUpdateSchema } },
        required: true,
      },
    },
    responses: {
      200: jsonContent(equipmentReservationSchema, 'Updated reservation'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const { reservationId } = c.req.valid('param');
    const body = c.req.valid('json');
    const claims = c.get('claims');

    const updated = await withUser(claims, async (tx) => {
      const reservation = await loadReservation(tx, reservationId);
      requireClubMember(claims, reservation.club_id);
      const allowed =
        hasClubRole(claims, reservation.club_id, COACH_ROLES) ||
        (await isOwnMember(tx, claims, reservation.reserved_by_member_id));
      if (!allowed) throw problem(403, 'Forbidden', 'Editing a reservation requires being its creator or a coaching role');
      const rows = await tx`
        update app.equipment_reservations set ${tx(body)}
        where id = ${reservationId} and deleted_at is null
        returning *`;
      if (rows.length === 0) throw problem(403, 'Forbidden', 'Editing a reservation requires being its creator or a coaching role');
      return rows[0];
    });
    return c.json(equipmentReservationSchema.parse(updated), 200);
  },
);

equipmentReservationsRouter.openapi(
  createRoute({
    method: 'delete',
    path: '/equipment-reservations/{reservationId}',
    tags: ['equipment'],
    summary: 'Soft-delete a reservation (creator or coaching staff)',
    security: [{ bearerAuth: [] }],
    request: { params: reservationIdParam },
    responses: {
      200: jsonContent(deletedSchema, 'Reservation soft-deleted'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const { reservationId } = c.req.valid('param');
    const claims = c.get('claims');

    await withUser(claims, async (tx) => {
      const reservation = await loadReservation(tx, reservationId);
      requireClubMember(claims, reservation.club_id);
      const allowed =
        hasClubRole(claims, reservation.club_id, COACH_ROLES) ||
        (await isOwnMember(tx, claims, reservation.reserved_by_member_id));
      if (!allowed) throw problem(403, 'Forbidden', 'Deleting a reservation requires being its creator or a coaching role');
      const rows = await tx`
        update app.equipment_reservations set deleted_at = now()
        where id = ${reservationId} and deleted_at is null
        returning id`;
      if (rows.length === 0) throw problem(403, 'Forbidden', 'Deleting a reservation requires being its creator or a coaching role');
    });
    return c.json({ status: 'deleted' as const, id: reservationId }, 200);
  },
);
