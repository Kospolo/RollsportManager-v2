// ============================================================================
// routes/assessments.ts - Trainer:innen-Beurteilung eines/einer (oft
// minderjährigen) Sportler:in (migration 0055, app.member_assessments).
//
// Sichtbarkeit ist STRENG serverseitig (RLS), nie nur im UI:
//   READ  : Familie (can_act_for_member) sieht die eigene / die des Kindes;
//           Staff (can_manage_members = owner/admin/moderator/treasurer) alles;
//           coach/guest_coach (coaches_member) nur die eigener Teams.
//   WRITE : Team-Trainer:in der Person (coaches_member) ODER Vorstand
//           (is_club_admin). Ein fremder Trainer schreibt NICHT.
//   PATCH/DELETE: nur der/die Autor:in oder der Vorstand (is_club_admin).
//
// Die API ist der Durchsetzungspunkt; die DB-RLS + der Immutabilitäts-Trigger
// sind die zweite Verteidigungslinie (Impersonation in src/db.ts). Der
// Team-genaue Schreib-Gate steckt in app.coaches_member (SECURITY DEFINER) —
// der einzige Ort, der aus team_members auflöst; das Token trägt die Teams
// nicht, deshalb fragt der Handler die DB direkt und liefert ein sauberes 403.
// ============================================================================

import { createRoute, z } from '@hono/zod-openapi';
import { createRouter, errorResponses, jsonContent } from '../lib/openapi.js';
import {
  assessmentCreateSchema,
  assessmentSchema,
  assessmentUpdateSchema,
  deletedSchema,
  uuid,
} from '../lib/validation.js';
import { withUser } from '../db.js';
import type { Tx } from '../db.js';
import { problem } from '../middleware/error.js';
import { ADMIN_ROLES, hasClubRole, requireClubMember } from '../lib/guards.js';
import type { AuthClaims } from '../middleware/auth.js';

export const assessmentsRouter = createRouter();

const assessmentIdParam = z.object({
  assessmentId: uuid.openapi({ param: { name: 'assessmentId', in: 'path' } }),
});

/** The caller's own club_members row in this club (the assessment author). */
async function authorMemberId(tx: Tx, claims: AuthClaims, clubId: string): Promise<string> {
  const rows = await tx`
    select id from app.club_members
    where club_id = ${clubId} and profile_id = ${claims.sub} and deleted_at is null
    limit 1`;
  const id = rows[0]?.['id'] as string | undefined;
  if (!id) throw problem(403, 'Forbidden', 'No membership row for the author in this club');
  return id;
}

/**
 * Load an assessment the caller is allowed to SEE (RLS decides). A caller who
 * may not see it gets 0 rows -> 404, so a stranger cannot probe existence.
 */
async function loadAssessment(
  tx: Tx,
  assessmentId: string,
): Promise<{ id: string; club_id: string; author_member_id: string }> {
  const rows = await tx`
    select id, club_id, author_member_id from app.member_assessments
    where id = ${assessmentId} and deleted_at is null`;
  const row = rows[0];
  if (!row) throw problem(404, 'Not Found', 'Assessment not found');
  return row as { id: string; club_id: string; author_member_id: string };
}

// GET /assessments?club_id&member_id -----------------------------------------
// Liefert die (rollen-gefilterten) Beurteilungen EINER Person. RLS filtert die
// Zeilen: die Familie sieht die eigenen, Staff alle, Team-Trainer:innen ihre.
assessmentsRouter.openapi(
  createRoute({
    method: 'get',
    path: '/assessments',
    tags: ['assessments'],
    summary: 'List the (role-filtered) assessments of one member',
    security: [{ bearerAuth: [] }],
    request: {
      query: z.object({ club_id: uuid, member_id: uuid }),
    },
    responses: {
      200: jsonContent(z.array(assessmentSchema), 'Assessments visible to the caller'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const { club_id, member_id } = c.req.valid('query');
    const claims = c.get('claims');
    // Muss Mitglied des Vereins sein; WAS zurückkommt, entscheidet die RLS.
    requireClubMember(claims, club_id);
    const rows = await withUser(claims, (tx) =>
      tx`select * from app.member_assessments
         where club_id = ${club_id} and member_id = ${member_id} and deleted_at is null
         order by assessed_on desc, created_at desc`,
    );
    return c.json(z.array(assessmentSchema).parse(rows), 200);
  },
);

// POST /assessments ----------------------------------------------------------
assessmentsRouter.openapi(
  createRoute({
    method: 'post',
    path: '/assessments',
    tags: ['assessments'],
    summary: 'Write an assessment (team coach of the member, or the board)',
    security: [{ bearerAuth: [] }],
    request: {
      body: { content: { 'application/json': { schema: assessmentCreateSchema } }, required: true },
    },
    responses: {
      201: jsonContent(assessmentSchema, 'Created assessment'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const body = c.req.valid('json');
    const claims = c.get('claims');
    requireClubMember(claims, body.club_id);

    const created = await withUser(claims, async (tx) => {
      // Der team-genaue Schreib-Gate lebt in der DB (SECURITY DEFINER): darf
      // ich (Vorstand ODER Trainer:in DES Teams dieser Person) schreiben?
      const gate = await tx`
        select (app.is_club_admin(${body.club_id})
             or app.coaches_member(${body.club_id}, ${body.member_id})) as ok`;
      if (!gate[0]?.['ok']) {
        throw problem(
          403,
          'Forbidden',
          'Writing an assessment requires being a coach of the member\'s team or a board member',
        );
      }
      const author = await authorMemberId(tx, claims, body.club_id);
      const rows = await tx`
        insert into app.member_assessments
          (club_id, member_id, author_member_id, body, rating_technik, rating_ausdruck, assessed_on)
        values
          (${body.club_id}, ${body.member_id}, ${author}, ${body.body},
           ${body.rating_technik ?? null}, ${body.rating_ausdruck ?? null},
           ${body.assessed_on ?? null}::date)
        returning *`;
      return rows[0];
    });
    return c.json(assessmentSchema.parse(created), 201);
  },
);

/** True when the caller may edit/delete the loaded assessment (author or board). */
async function requireEditor(
  tx: Tx,
  claims: AuthClaims,
  row: { club_id: string; author_member_id: string },
): Promise<void> {
  if (hasClubRole(claims, row.club_id, ADMIN_ROLES)) return;
  const mine = await tx`
    select id from app.club_members
    where club_id = ${row.club_id} and profile_id = ${claims.sub} and deleted_at is null
    limit 1`;
  if (mine[0]?.['id'] === row.author_member_id) return;
  throw problem(403, 'Forbidden', 'Only the author or a board member may change an assessment');
}

// PATCH /assessments/{assessmentId} ------------------------------------------
assessmentsRouter.openapi(
  createRoute({
    method: 'patch',
    path: '/assessments/{assessmentId}',
    tags: ['assessments'],
    summary: 'Edit an assessment (author or board)',
    security: [{ bearerAuth: [] }],
    request: {
      params: assessmentIdParam,
      body: { content: { 'application/json': { schema: assessmentUpdateSchema } }, required: true },
    },
    responses: {
      200: jsonContent(assessmentSchema, 'Updated assessment'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const { assessmentId } = c.req.valid('param');
    const body = c.req.valid('json');
    const claims = c.get('claims');

    const updated = await withUser(claims, async (tx) => {
      const row = await loadAssessment(tx, assessmentId);
      await requireEditor(tx, claims, row);
      const rows = await tx`
        update app.member_assessments set ${tx(body)}
        where id = ${assessmentId} and deleted_at is null
        returning *`;
      if (rows.length === 0) throw problem(403, 'Forbidden', 'Editing this assessment is not allowed');
      return rows[0];
    });
    return c.json(assessmentSchema.parse(updated), 200);
  },
);

// DELETE /assessments/{assessmentId} (soft) ----------------------------------
assessmentsRouter.openapi(
  createRoute({
    method: 'delete',
    path: '/assessments/{assessmentId}',
    tags: ['assessments'],
    summary: 'Soft-delete an assessment (author or board)',
    security: [{ bearerAuth: [] }],
    request: { params: assessmentIdParam },
    responses: {
      200: jsonContent(deletedSchema, 'Assessment soft-deleted'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const { assessmentId } = c.req.valid('param');
    const claims = c.get('claims');

    await withUser(claims, async (tx) => {
      const row = await loadAssessment(tx, assessmentId);
      await requireEditor(tx, claims, row);
      const rows = await tx`
        update app.member_assessments set deleted_at = now()
        where id = ${assessmentId} and deleted_at is null
        returning id`;
      if (rows.length === 0) throw problem(403, 'Forbidden', 'Deleting this assessment is not allowed');
    });
    return c.json({ status: 'deleted' as const, id: assessmentId }, 200);
  },
);
