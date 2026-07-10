// ============================================================================
// routes/duty-entries.ts - recorded actual hours ("Ist-Stunden",
// v1 portal-pflichtstunden.js). Referenz 1.3: every member records their OWN
// hours; coaching staff record for anyone and see all.
//
// Read:   own entries (member_id = caller's own club_members row) OR trainer.
// Insert: a member FOR THEMSELVES, OR trainer for anyone.
// Edit/Delete (soft): the entry's member (owner) OR trainer.
// approved: TRAINER-ONLY. Enforced twice - here (fast 403) and in the DB
//           (app.duty_entries_guard_approved, migration 0010).
// The API guard mirrors the RLS policy (app.is_own_member / is_club_trainer).
// ============================================================================

import { createRoute, z } from '@hono/zod-openapi';
import { createRouter, errorResponses, jsonContent } from '../lib/openapi.js';
import {
  deletedSchema,
  dutyEntryCreateSchema,
  dutyEntrySchema,
  dutyEntryUpdateSchema,
  uuid,
} from '../lib/validation.js';
import { withUser } from '../db.js';
import type { Tx } from '../db.js';
import { problem } from '../middleware/error.js';
import { COACH_ROLES, hasClubRole, requireClubMember } from '../lib/guards.js';
import { isOwnMember } from '../lib/ownership.js';

export const dutyEntriesRouter = createRouter();

const entryIdParam = z.object({
  entryId: uuid.openapi({ param: { name: 'entryId', in: 'path' } }),
});

async function loadEntry(
  tx: Tx,
  entryId: string,
): Promise<{ id: string; club_id: string; member_id: string }> {
  const rows = await tx`
    select id, club_id, member_id from app.duty_entries
    where id = ${entryId} and deleted_at is null`;
  const row = rows[0];
  if (!row) throw problem(404, 'Not Found', 'Duty entry not found');
  return row as { id: string; club_id: string; member_id: string };
}

dutyEntriesRouter.openapi(
  createRoute({
    method: 'get',
    path: '/duty-entries',
    tags: ['duty'],
    summary: 'List duty entries (own entries, or all for coaching staff)',
    security: [{ bearerAuth: [] }],
    request: {
      query: z.object({ club_id: uuid, member_id: uuid.optional() }),
    },
    responses: {
      200: jsonContent(z.array(dutyEntrySchema), 'Duty entries visible to the caller (RLS-filtered)'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const { club_id, member_id } = c.req.valid('query');
    requireClubMember(c.get('claims'), club_id);
    // RLS already narrows a plain member to their OWN rows; the optional
    // member_id filter is an additional narrowing (e.g. a trainer picking one).
    const rows = await withUser(c.get('claims'), (tx) =>
      tx`select * from app.duty_entries
         where club_id = ${club_id} and deleted_at is null
           and (${member_id ?? null}::uuid is null or member_id = ${member_id ?? null})
         order by activity_date desc, created_at desc`,
    );
    return c.json(z.array(dutyEntrySchema).parse(rows), 200);
  },
);

dutyEntriesRouter.openapi(
  createRoute({
    method: 'post',
    path: '/duty-entries',
    tags: ['duty'],
    summary: 'Record hours (a member for themselves, or staff for anyone)',
    security: [{ bearerAuth: [] }],
    request: {
      body: { content: { 'application/json': { schema: dutyEntryCreateSchema } }, required: true },
    },
    responses: {
      201: jsonContent(dutyEntrySchema, 'Created duty entry'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const body = c.req.valid('json');
    const claims = c.get('claims');
    requireClubMember(claims, body.club_id);
    const isTrainer = hasClubRole(claims, body.club_id, COACH_ROLES);

    // approved is trainer-only (the DB guard is the hard stop; this is the 403).
    if (body.approved && !isTrainer) {
      throw problem(403, 'Forbidden', 'Only a coaching role may approve duty entries');
    }

    const created = await withUser(claims, async (tx) => {
      if (!isTrainer && !(await isOwnMember(tx, claims, body.member_id))) {
        throw problem(403, 'Forbidden', 'Members may only record hours for themselves; recording for others needs a coaching role');
      }
      const rows = await tx`
        insert into app.duty_entries
          (club_id, member_id, hours, activity_date, kind, note, approved)
        values
          (${body.club_id}, ${body.member_id}, ${body.hours}, ${body.activity_date},
           ${body.kind}, ${body.note ?? null}, ${body.approved})
        returning *`;
      return rows[0];
    });
    return c.json(dutyEntrySchema.parse(created), 201);
  },
);

dutyEntriesRouter.openapi(
  createRoute({
    method: 'patch',
    path: '/duty-entries/{entryId}',
    tags: ['duty'],
    summary: 'Edit a duty entry (its member, or coaching staff)',
    security: [{ bearerAuth: [] }],
    request: {
      params: entryIdParam,
      body: { content: { 'application/json': { schema: dutyEntryUpdateSchema } }, required: true },
    },
    responses: {
      200: jsonContent(dutyEntrySchema, 'Updated duty entry'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const { entryId } = c.req.valid('param');
    const body = c.req.valid('json');
    const claims = c.get('claims');

    const updated = await withUser(claims, async (tx) => {
      const entry = await loadEntry(tx, entryId);
      const isTrainer = hasClubRole(claims, entry.club_id, COACH_ROLES);
      const allowed = isTrainer || (await isOwnMember(tx, claims, entry.member_id));
      if (!allowed) throw problem(403, 'Forbidden', 'Editing a duty entry requires being its member or a coaching role');
      if (body.approved !== undefined && !isTrainer) {
        throw problem(403, 'Forbidden', 'Only a coaching role may change the approval of a duty entry');
      }
      const rows = await tx`
        update app.duty_entries set ${tx(body)}
        where id = ${entryId} and deleted_at is null
        returning *`;
      if (rows.length === 0) throw problem(403, 'Forbidden', 'Editing a duty entry requires being its member or a coaching role');
      return rows[0];
    });
    return c.json(dutyEntrySchema.parse(updated), 200);
  },
);

dutyEntriesRouter.openapi(
  createRoute({
    method: 'delete',
    path: '/duty-entries/{entryId}',
    tags: ['duty'],
    summary: 'Soft-delete a duty entry (its member, or coaching staff)',
    security: [{ bearerAuth: [] }],
    request: { params: entryIdParam },
    responses: {
      200: jsonContent(deletedSchema, 'Duty entry soft-deleted'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const { entryId } = c.req.valid('param');
    const claims = c.get('claims');

    await withUser(claims, async (tx) => {
      const entry = await loadEntry(tx, entryId);
      const allowed =
        hasClubRole(claims, entry.club_id, COACH_ROLES) ||
        (await isOwnMember(tx, claims, entry.member_id));
      if (!allowed) throw problem(403, 'Forbidden', 'Deleting a duty entry requires being its member or a coaching role');
      const rows = await tx`
        update app.duty_entries set deleted_at = now()
        where id = ${entryId} and deleted_at is null
        returning id`;
      if (rows.length === 0) throw problem(403, 'Forbidden', 'Deleting a duty entry requires being its member or a coaching role');
    });
    return c.json({ status: 'deleted' as const, id: entryId }, 200);
  },
);
