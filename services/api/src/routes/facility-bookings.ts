// ============================================================================
// routes/facility-bookings.ts - facility reservations ("Belegungsplan",
// v1 bookings.html).
//
// Read:   every club member (is_club_member) — the plan stays visible to all.
// Insert: coaching staff ONLY (is_club_trainer). Privacy-Härtung (0021): plain
//         members may no longer create bookings (they previously could book for
//         themselves).
// Edit/Delete (soft): the creator OR coaching staff.
// The API guard mirrors the RLS policy (is_club_trainer, migration 0021) - RLS
// stays the second line of defense (Blueprint risk #16).
// No DB overlap constraint: the App surfaces conflicts (task spec).
// ============================================================================

import { createRoute, z } from '@hono/zod-openapi';
import { createRouter, errorResponses, jsonContent } from '../lib/openapi.js';
import {
  deletedSchema,
  facilityBookingCreateSchema,
  facilityBookingSchema,
  facilityBookingUpdateSchema,
  uuid,
} from '../lib/validation.js';
import { withUser } from '../db.js';
import type { Tx } from '../db.js';
import { problem } from '../middleware/error.js';
import { COACH_ROLES, hasClubRole, requireClubMember, requireClubRole } from '../lib/guards.js';
import { isOwnMember } from '../lib/ownership.js';

export const facilityBookingsRouter = createRouter();

const bookingIdParam = z.object({
  bookingId: uuid.openapi({ param: { name: 'bookingId', in: 'path' } }),
});

async function loadBooking(
  tx: Tx,
  bookingId: string,
): Promise<{ id: string; club_id: string; booked_by_member_id: string }> {
  const rows = await tx`
    select id, club_id, booked_by_member_id from app.facility_bookings
    where id = ${bookingId} and deleted_at is null`;
  const row = rows[0];
  if (!row) throw problem(404, 'Not Found', 'Booking not found');
  return row as { id: string; club_id: string; booked_by_member_id: string };
}

facilityBookingsRouter.openapi(
  createRoute({
    method: 'get',
    path: '/facility-bookings',
    tags: ['facilities'],
    summary: 'List bookings of a club (optionally filtered by facility)',
    security: [{ bearerAuth: [] }],
    request: {
      query: z.object({ club_id: uuid, facility_id: uuid.optional() }),
    },
    responses: {
      200: jsonContent(z.array(facilityBookingSchema), 'Bookings visible to the caller'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const { club_id, facility_id } = c.req.valid('query');
    requireClubMember(c.get('claims'), club_id);
    const rows = await withUser(c.get('claims'), (tx) =>
      tx`select * from app.facility_bookings
         where club_id = ${club_id} and deleted_at is null
           and (${facility_id ?? null}::uuid is null or facility_id = ${facility_id ?? null})
         order by starts_at`,
    );
    return c.json(z.array(facilityBookingSchema).parse(rows), 200);
  },
);

facilityBookingsRouter.openapi(
  createRoute({
    method: 'post',
    path: '/facility-bookings',
    tags: ['facilities'],
    summary: 'Create a booking (coaching staff only, is_club_trainer)',
    security: [{ bearerAuth: [] }],
    request: {
      body: { content: { 'application/json': { schema: facilityBookingCreateSchema } }, required: true },
    },
    responses: {
      201: jsonContent(facilityBookingSchema, 'Created booking'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const body = c.req.valid('json');
    const claims = c.get('claims');
    // Privacy-Härtung (0021): only coaching staff (is_club_trainer) may create a
    // booking. Plain members can no longer book (not even for themselves) — the
    // RLS INSERT policy (migration 0021) enforces the same as second line.
    requireClubRole(claims, body.club_id, COACH_ROLES);

    const created = await withUser(claims, async (tx) => {
      const rows = await tx`
        insert into app.facility_bookings
          (facility_id, club_id, booked_by_member_id, team_id, title, starts_at, ends_at, status)
        values
          (${body.facility_id}, ${body.club_id}, ${body.booked_by_member_id}, ${body.team_id ?? null},
           ${body.title}, ${body.starts_at}, ${body.ends_at}, ${body.status})
        returning *`;
      return rows[0];
    });
    return c.json(facilityBookingSchema.parse(created), 201);
  },
);

facilityBookingsRouter.openapi(
  createRoute({
    method: 'patch',
    path: '/facility-bookings/{bookingId}',
    tags: ['facilities'],
    summary: 'Edit a booking (creator or coaching staff)',
    security: [{ bearerAuth: [] }],
    request: {
      params: bookingIdParam,
      body: { content: { 'application/json': { schema: facilityBookingUpdateSchema } }, required: true },
    },
    responses: {
      200: jsonContent(facilityBookingSchema, 'Updated booking'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const { bookingId } = c.req.valid('param');
    const body = c.req.valid('json');
    const claims = c.get('claims');

    const updated = await withUser(claims, async (tx) => {
      const booking = await loadBooking(tx, bookingId);
      requireClubMember(claims, booking.club_id);
      const allowed =
        hasClubRole(claims, booking.club_id, COACH_ROLES) ||
        (await isOwnMember(tx, claims, booking.booked_by_member_id));
      if (!allowed) throw problem(403, 'Forbidden', 'Editing a booking requires being its creator or a coaching role');
      const rows = await tx`
        update app.facility_bookings set ${tx(body)}
        where id = ${bookingId} and deleted_at is null
        returning *`;
      if (rows.length === 0) throw problem(403, 'Forbidden', 'Editing a booking requires being its creator or a coaching role');
      return rows[0];
    });
    return c.json(facilityBookingSchema.parse(updated), 200);
  },
);

facilityBookingsRouter.openapi(
  createRoute({
    method: 'delete',
    path: '/facility-bookings/{bookingId}',
    tags: ['facilities'],
    summary: 'Soft-delete a booking (creator or coaching staff)',
    security: [{ bearerAuth: [] }],
    request: { params: bookingIdParam },
    responses: {
      200: jsonContent(deletedSchema, 'Booking soft-deleted'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const { bookingId } = c.req.valid('param');
    const claims = c.get('claims');

    await withUser(claims, async (tx) => {
      const booking = await loadBooking(tx, bookingId);
      requireClubMember(claims, booking.club_id);
      const allowed =
        hasClubRole(claims, booking.club_id, COACH_ROLES) ||
        (await isOwnMember(tx, claims, booking.booked_by_member_id));
      if (!allowed) throw problem(403, 'Forbidden', 'Deleting a booking requires being its creator or a coaching role');
      const rows = await tx`
        update app.facility_bookings set deleted_at = now()
        where id = ${bookingId} and deleted_at is null
        returning id`;
      if (rows.length === 0) throw problem(403, 'Forbidden', 'Deleting a booking requires being its creator or a coaching role');
    });
    return c.json({ status: 'deleted' as const, id: bookingId }, 200);
  },
);
