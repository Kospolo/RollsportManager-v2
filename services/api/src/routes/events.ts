// ============================================================================
// routes/events.ts - events, RSVPs (self / children via guardianship) and
// attendance (coaching staff incl. time-boxed guest_coach).
//
// RSVP/attendance writes run impersonated: the RLS policies
// (can_act_for_member / has_club_role with server-side guest expiry) are the
// final arbiter - a stale guest_coach claim is rejected by the DB even if it
// passes the claim-based guard here (Blueprint risk #16).
// ============================================================================

import { createRoute, z } from '@hono/zod-openapi';
import { createRouter, errorResponses, jsonContent } from '../lib/openapi.js';
import {
  attendanceSchema,
  attendanceUpsertSchema,
  eventCreateSchema,
  eventSchema,
  rsvpSchema,
  rsvpUpsertSchema,
  uuid,
} from '../lib/validation.js';
import { withUser } from '../db.js';
import type { Tx } from '../db.js';
import { problem } from '../middleware/error.js';
import { COACH_ROLES, hasClubRole, requireClubMember, requireClubRole } from '../lib/guards.js';
import type { ClubRole } from '../middleware/auth.js';

/** Structure changes (creating events) exclude guest_coach by design. */
const EVENT_WRITE_ROLES: readonly ClubRole[] = ['owner', 'admin', 'coach'];

export const eventsRouter = createRouter();

const eventIdParam = z.object({ eventId: uuid.openapi({ param: { name: 'eventId', in: 'path' } }) });

async function loadEvent(tx: Tx, eventId: string): Promise<{ id: string; club_id: string }> {
  const rows = await tx`
    select id, club_id from app.events
    where id = ${eventId} and deleted_at is null`;
  const event = rows[0];
  if (!event) throw problem(404, 'Not Found', 'Event not found');
  return event as { id: string; club_id: string };
}

eventsRouter.openapi(
  createRoute({
    method: 'get',
    path: '/events',
    tags: ['events'],
    summary: 'List events of a club (optionally time-windowed)',
    security: [{ bearerAuth: [] }],
    request: {
      query: z.object({
        club_id: uuid,
        from: z.string().datetime({ offset: true }).optional(),
        to: z.string().datetime({ offset: true }).optional(),
      }),
    },
    responses: {
      200: jsonContent(z.array(eventSchema), 'Events visible to the caller'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const { club_id, from, to } = c.req.valid('query');
    requireClubMember(c.get('claims'), club_id);
    const rows = await withUser(c.get('claims'), (tx) =>
      tx`select * from app.events
         where club_id = ${club_id} and deleted_at is null
           and (${from ?? null}::timestamptz is null or starts_at >= ${from ?? null})
           and (${to ?? null}::timestamptz is null or starts_at <= ${to ?? null})
         order by starts_at`,
    );
    return c.json(z.array(eventSchema).parse(rows), 200);
  },
);

eventsRouter.openapi(
  createRoute({
    method: 'post',
    path: '/events',
    tags: ['events'],
    summary: 'Create an event (owner/admin/coach) with optional team links',
    security: [{ bearerAuth: [] }],
    request: {
      body: { content: { 'application/json': { schema: eventCreateSchema } }, required: true },
    },
    responses: {
      201: jsonContent(eventSchema, 'Created event'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const body = c.req.valid('json');
    requireClubRole(c.get('claims'), body.club_id, EVENT_WRITE_ROLES);

    const created = await withUser(c.get('claims'), async (tx) => {
      const rows = await tx`
        insert into app.events (club_id, type, title, note, location, starts_at, ends_at)
        values (${body.club_id}, ${body.type}, ${body.title}, ${body.note ?? null},
                ${body.location ?? null}, ${body.starts_at}, ${body.ends_at})
        returning *`;
      const event = rows[0] as { id: string };
      for (const teamId of body.team_ids) {
        await tx`
          insert into app.event_teams (club_id, event_id, team_id)
          values (${body.club_id}, ${event.id}, ${teamId})`;
      }
      return rows[0];
    });
    return c.json(eventSchema.parse(created), 201);
  },
);

eventsRouter.openapi(
  createRoute({
    method: 'put',
    path: '/events/{eventId}/rsvp',
    tags: ['events'],
    summary: 'Set an RSVP for the own membership or an own child (guardianship)',
    description:
      'Upsert on (event, member). RLS enforces can_act_for_member: own row or own child - coaches may answer for anyone in the club.',
    security: [{ bearerAuth: [] }],
    request: {
      params: eventIdParam,
      body: { content: { 'application/json': { schema: rsvpUpsertSchema } }, required: true },
    },
    responses: {
      200: jsonContent(rsvpSchema, 'Stored RSVP'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const { eventId } = c.req.valid('param');
    const body = c.req.valid('json');
    const claims = c.get('claims');

    const stored = await withUser(claims, async (tx) => {
      const event = await loadEvent(tx, eventId); // 404 when invisible (RLS)
      requireClubMember(claims, event.club_id);
      const rows = await tx`
        insert into app.event_rsvps (club_id, event_id, member_id, status, comment, responded_at)
        values (${event.club_id}, ${eventId}, ${body.member_id}, ${body.status},
                ${body.comment ?? null}, now())
        on conflict (event_id, member_id) do update
          set status = excluded.status,
              comment = excluded.comment,
              responded_at = now(),
              deleted_at = null
        returning *`;
      return rows[0];
    });
    return c.json(rsvpSchema.parse(stored), 200);
  },
);

eventsRouter.openapi(
  createRoute({
    method: 'put',
    path: '/events/{eventId}/attendance',
    tags: ['events'],
    summary: 'Record attendance for a member (coach and above, incl. guest_coach)',
    security: [{ bearerAuth: [] }],
    request: {
      params: eventIdParam,
      body: { content: { 'application/json': { schema: attendanceUpsertSchema } }, required: true },
    },
    responses: {
      200: jsonContent(attendanceSchema, 'Stored attendance record'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const { eventId } = c.req.valid('param');
    const body = c.req.valid('json');
    const claims = c.get('claims');

    const stored = await withUser(claims, async (tx) => {
      const event = await loadEvent(tx, eventId);
      if (!hasClubRole(claims, event.club_id, COACH_ROLES)) {
        throw problem(403, 'Forbidden', 'Attendance requires a coaching role');
      }
      const checkedInAt =
        body.checked_in_at ?? (body.status === 'present' || body.status === 'late' ? new Date().toISOString() : null);
      const rows = await tx`
        insert into app.attendance (club_id, event_id, member_id, status, checked_in_at)
        values (${event.club_id}, ${eventId}, ${body.member_id}, ${body.status}, ${checkedInAt})
        on conflict (event_id, member_id) do update
          set status = excluded.status,
              checked_in_at = excluded.checked_in_at,
              deleted_at = null
        returning *`;
      return rows[0];
    });
    return c.json(attendanceSchema.parse(stored), 200);
  },
);
