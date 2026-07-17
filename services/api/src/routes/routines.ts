// ============================================================================
// routes/routines.ts - Küren (the USP): routines, time markers on the
// training audio, and score history. Routine work explicitly includes
// guest_coach (that is what guest coaches are invited for) - the RLS
// policies mirror this and additionally enforce guest expiry server-side.
// ============================================================================

import { createRoute, z } from '@hono/zod-openapi';
import { createRouter, errorResponses, jsonContent } from '../lib/openapi.js';
import { randomBytes } from 'node:crypto';
import {
  markerCreateSchema,
  markerSchema,
  routineCreateSchema,
  routineSchema,
  scoreCreateSchema,
  scoreSchema,
  shareCreateSchema,
  shareCreatedSchema,
  uuid,
} from '../lib/validation.js';
import { withUser } from '../db.js';
import type { Tx } from '../db.js';
import { problem } from '../middleware/error.js';
import { COACH_ROLES, hasClubRole, requireClubMember, requireClubRole } from '../lib/guards.js';
import { ownMemberId } from '../lib/ownership.js';

/** URL-safe, high-entropy share token (kuer-share.html). */
function generateShareToken(): string {
  return 'shr_' + randomBytes(24).toString('base64url');
}

/** Relative public path the web app renders for a share token. */
export function shareUrlFor(token: string): string {
  return `/wettkampf/kuer/${token}`;
}

export const routinesRouter = createRouter();

const routineIdParam = z.object({
  routineId: uuid.openapi({ param: { name: 'routineId', in: 'path' } }),
});

export async function loadRoutine(tx: Tx, routineId: string): Promise<{ id: string; club_id: string }> {
  const rows = await tx`
    select id, club_id from app.routines
    where id = ${routineId} and deleted_at is null`;
  const routine = rows[0];
  if (!routine) throw problem(404, 'Not Found', 'Routine not found');
  return routine as { id: string; club_id: string };
}

/** One enriched routine row (skaters + waveform + served media urls). */
export async function selectRoutine(tx: Tx, routineId: string): Promise<unknown | undefined> {
  const rows = await tx`
    select r.*,
      coalesce((select jsonb_agg(rs.member_id order by rs.created_at)
                from app.routine_skaters rs
                where rs.routine_id = r.id and rs.deleted_at is null),
               '[]'::jsonb) as skater_member_ids,
      (select ma.waveform_peaks from app.media_assets ma
        where ma.id = r.audio_asset_id and ma.deleted_at is null) as waveform_peaks,
      (select '/media/' || ma.storage_path from app.media_assets ma
        where ma.id = r.audio_asset_id and ma.deleted_at is null) as audio_url,
      (select '/media/' || ma.storage_path from app.media_assets ma
        where ma.id = r.image_asset_id and ma.deleted_at is null) as image_url
    from app.routines r
    where r.id = ${routineId} and r.deleted_at is null`;
  return rows[0];
}

routinesRouter.openapi(
  createRoute({
    method: 'get',
    path: '/routines',
    tags: ['routines'],
    summary: 'List routines of a club',
    security: [{ bearerAuth: [] }],
    request: { query: z.object({ club_id: uuid }) },
    responses: {
      200: jsonContent(z.array(routineSchema), 'Routines visible to the caller'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const { club_id } = c.req.valid('query');
    requireClubMember(c.get('claims'), club_id);
    const rows = await withUser(c.get('claims'), (tx) =>
      tx`select r.*,
           coalesce((select jsonb_agg(rs.member_id order by rs.created_at)
                     from app.routine_skaters rs
                     where rs.routine_id = r.id and rs.deleted_at is null),
                    '[]'::jsonb) as skater_member_ids,
           (select ma.waveform_peaks from app.media_assets ma
             where ma.id = r.audio_asset_id and ma.deleted_at is null) as waveform_peaks,
           (select '/media/' || ma.storage_path from app.media_assets ma
             where ma.id = r.audio_asset_id and ma.deleted_at is null) as audio_url,
           (select '/media/' || ma.storage_path from app.media_assets ma
             where ma.id = r.image_asset_id and ma.deleted_at is null) as image_url
         from app.routines r
         where r.club_id = ${club_id} and r.deleted_at is null
         order by r.title`,
    );
    return c.json(z.array(routineSchema).parse(rows), 200);
  },
);

routinesRouter.openapi(
  createRoute({
    method: 'post',
    path: '/routines',
    tags: ['routines'],
    summary: 'Create a routine (coaching staff incl. guest_coach)',
    security: [{ bearerAuth: [] }],
    request: {
      body: { content: { 'application/json': { schema: routineCreateSchema } }, required: true },
    },
    responses: {
      201: jsonContent(routineSchema, 'Created routine'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const body = c.req.valid('json');
    requireClubRole(c.get('claims'), body.club_id, COACH_ROLES);

    const created = await withUser(c.get('claims'), async (tx) => {
      // ---------------------------------------------------------------------
      // KEIN `returning` auf diesem INSERT - das war der Bug (Altbestand seit
      // der Privacy-Haertung 0021, KEINE Phase-2-Regression).
      //
      // RETURNING zieht ZUSAETZLICH die SELECT-Policy heran
      // (routines_select using app.can_read_routine(id)). can_read_routine ist
      // STABLE security definer und liest app.routines - im Snapshot des
      // eigenen Statements ist die gerade eingefuegte Zeile aber unsichtbar.
      // Ergebnis: Postgres meldet irrefuehrend "new row violates row-level
      // security policy", obwohl der INSERT selbst erlaubt ist.
      // Empirisch gegen rsm2-pg-dev belegt (als owner, has_cap=true):
      //     insert ... values (...)              -> INSERT 0 1   OK
      //     insert ... values (...) returning id -> ERROR 42501
      // ACHTUNG: `returning id` genuegt NICHT als Ausweg - JEDES returning
      // loest die SELECT-Policy aus, auch auf einer einzelnen Spalte.
      //
      // Der Weg: id vorab ziehen (app.uuid_v7() erhaelt die Zeitordnung des
      // Spalten-Defaults, keine v4-UUID), OHNE returning einfuegen und die
      // Zeile in einem SEPARATEN Statement zurueckenlesen. Ein spaeteres
      // Statement derselben Transaktion sieht die Schreibvorgaenge der
      // frueheren Kommandos - damit greift can_read_routine normal.
      // Die SELECT-Policy bleibt unangetastet (keine Aufweichung).
      // ---------------------------------------------------------------------
      const idRows = await tx`select app.uuid_v7() as id`;
      const routineId = (idRows[0] as { id: string }).id;

      await tx`
        insert into app.routines
          (id, club_id, team_id, title, category, music_title, music_artist, music_bpm, music_duration_ms)
        values
          (${routineId}, ${body.club_id}, ${body.team_id ?? null}, ${body.title}, ${body.category ?? null},
           ${body.music_title ?? null}, ${body.music_artist ?? null},
           ${body.music_bpm ?? null}, ${body.music_duration_ms ?? null})`;

      // n:m skaters - pair/group routines have several (design deviation, documented)
      for (const memberId of body.skater_member_ids) {
        await tx`
          insert into app.routine_skaters (club_id, routine_id, member_id)
          values (${body.club_id}, ${routineId}, ${memberId})`;
      }

      // Rueckenlesen ueber den NORMALEN Lesepfad (RLS aktiv). Liefert er
      // nichts, hat der Aufrufer eine Kuer angelegt, die er selbst nicht
      // sehen darf - moeglich, weil das Schreibrecht (routines_edit) bewusst
      // WEITER ist als das Leserecht (can_read_routine): ein coach/guest_coach
      // fuer ein FREMDES Team oder ganz OHNE Team. Statt eine unsichtbare
      // Geisterzeile zu hinterlassen, wird die Transaktion abgebrochen.
      const row = await selectRoutine(tx, routineId);
      if (row === undefined) {
        throw problem(
          422,
          'Unprocessable Entity',
          'You may only create a routine you can also see: pick a team you coach.',
        );
      }
      return row;
    });
    return c.json(routineSchema.parse(created), 201);
  },
);

routinesRouter.openapi(
  createRoute({
    method: 'get',
    path: '/routines/{routineId}',
    tags: ['routines'],
    summary: 'Get a routine',
    security: [{ bearerAuth: [] }],
    request: { params: routineIdParam },
    responses: {
      200: jsonContent(routineSchema, 'The routine'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const { routineId } = c.req.valid('param');
    const row = await withUser(c.get('claims'), (tx) => selectRoutine(tx, routineId));
    if (row === undefined) throw problem(404, 'Not Found', 'Routine not found');
    return c.json(routineSchema.parse(row), 200);
  },
);

routinesRouter.openapi(
  createRoute({
    method: 'get',
    path: '/routines/{routineId}/markers',
    tags: ['routines'],
    summary: 'List time markers of a routine',
    security: [{ bearerAuth: [] }],
    request: { params: routineIdParam },
    responses: {
      200: jsonContent(z.array(markerSchema), 'Markers ordered by time'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const { routineId } = c.req.valid('param');
    const rows = await withUser(c.get('claims'), async (tx) => {
      await loadRoutine(tx, routineId);
      return tx`
        select * from app.routine_markers
        where routine_id = ${routineId} and deleted_at is null
        order by time_ms`;
    });
    return c.json(z.array(markerSchema).parse(rows), 200);
  },
);

routinesRouter.openapi(
  createRoute({
    method: 'post',
    path: '/routines/{routineId}/markers',
    tags: ['routines'],
    summary: 'Add a time marker (coaching staff incl. guest_coach)',
    security: [{ bearerAuth: [] }],
    request: {
      params: routineIdParam,
      body: { content: { 'application/json': { schema: markerCreateSchema } }, required: true },
    },
    responses: {
      201: jsonContent(markerSchema, 'Created marker'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const { routineId } = c.req.valid('param');
    const body = c.req.valid('json');
    const claims = c.get('claims');

    const created = await withUser(claims, async (tx) => {
      const routine = await loadRoutine(tx, routineId);
      if (!hasClubRole(claims, routine.club_id, COACH_ROLES)) {
        throw problem(403, 'Forbidden', 'Markers require a coaching role');
      }
      const rows = await tx`
        insert into app.routine_markers (club_id, routine_id, time_ms, label, element_code)
        values (${routine.club_id}, ${routineId}, ${body.time_ms}, ${body.label},
                ${body.element_code ?? null})
        returning *`;
      return rows[0];
    });
    return c.json(markerSchema.parse(created), 201);
  },
);

routinesRouter.openapi(
  createRoute({
    method: 'get',
    path: '/routines/{routineId}/scores',
    tags: ['routines'],
    summary: 'Score history of a routine',
    security: [{ bearerAuth: [] }],
    request: { params: routineIdParam },
    responses: {
      200: jsonContent(z.array(scoreSchema), 'Scores, newest first'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const { routineId } = c.req.valid('param');
    const rows = await withUser(c.get('claims'), async (tx) => {
      await loadRoutine(tx, routineId);
      return tx`
        select * from app.routine_scores
        where routine_id = ${routineId} and deleted_at is null
        order by scored_on desc`;
    });
    return c.json(z.array(scoreSchema).parse(rows), 200);
  },
);

routinesRouter.openapi(
  createRoute({
    method: 'post',
    path: '/routines/{routineId}/scores',
    tags: ['routines'],
    summary: 'Record a score (coaching staff incl. guest_coach)',
    security: [{ bearerAuth: [] }],
    request: {
      params: routineIdParam,
      body: { content: { 'application/json': { schema: scoreCreateSchema } }, required: true },
    },
    responses: {
      201: jsonContent(scoreSchema, 'Created score'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const { routineId } = c.req.valid('param');
    const body = c.req.valid('json');
    const claims = c.get('claims');

    const created = await withUser(claims, async (tx) => {
      const routine = await loadRoutine(tx, routineId);
      if (!hasClubRole(claims, routine.club_id, COACH_ROLES)) {
        throw problem(403, 'Forbidden', 'Scores require a coaching role');
      }
      const rows = await tx`
        insert into app.routine_scores
          (club_id, routine_id, competition_id, scored_on, scoring_system,
           technical_score, components_score, total_score, placement, note)
        values
          (${routine.club_id}, ${routineId}, ${body.competition_id ?? null}, ${body.scored_on},
           ${body.scoring_system}, ${body.technical_score ?? null},
           ${body.components_score ?? null}, ${body.total_score ?? null},
           ${body.placement ?? null}, ${body.note ?? null})
        returning *`;
      return rows[0];
    });
    return c.json(scoreSchema.parse(created), 201);
  },
);

// ----------------------------------------------------------------------------
// Kür teilen (kuer-share.html): create / revoke an opaque share token. Both
// are is_club_trainer (Referenz 1.3). The PUBLIC token view lives in
// routes/public-routines.ts and is unauthenticated.
// ----------------------------------------------------------------------------
routinesRouter.openapi(
  createRoute({
    method: 'post',
    path: '/routines/{routineId}/share',
    tags: ['routines'],
    summary: 'Create a public share link for a routine (coaching staff)',
    security: [{ bearerAuth: [] }],
    request: {
      params: routineIdParam,
      body: { content: { 'application/json': { schema: shareCreateSchema } }, required: true },
    },
    responses: {
      201: jsonContent(shareCreatedSchema, 'Created share token'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const { routineId } = c.req.valid('param');
    const body = c.req.valid('json');
    const claims = c.get('claims');

    const created = await withUser(claims, async (tx) => {
      const routine = await loadRoutine(tx, routineId);
      if (!hasClubRole(claims, routine.club_id, COACH_ROLES)) {
        throw problem(403, 'Forbidden', 'Sharing requires a coaching role');
      }
      const memberId = await ownMemberId(tx, claims, routine.club_id);
      const token = generateShareToken();
      const rows = await tx`
        insert into app.routine_shares
          (club_id, routine_id, token, created_by_member_id, expires_at)
        values
          (${routine.club_id}, ${routineId}, ${token}, ${memberId},
           ${body.expires_at ?? null})
        returning token, expires_at`;
      return rows[0] as { token: string; expires_at: string | null };
    });
    return c.json(
      shareCreatedSchema.parse({
        token: created.token,
        url: shareUrlFor(created.token),
        expires_at: created.expires_at,
      }),
      201,
    );
  },
);

routinesRouter.openapi(
  createRoute({
    method: 'delete',
    path: '/routines/{routineId}/share/{token}',
    tags: ['routines'],
    summary: 'Revoke a share link (coaching staff)',
    security: [{ bearerAuth: [] }],
    request: {
      params: z.object({
        routineId: uuid.openapi({ param: { name: 'routineId', in: 'path' } }),
        token: z.string().openapi({ param: { name: 'token', in: 'path' } }),
      }),
    },
    responses: {
      200: jsonContent(z.object({ revoked: z.boolean() }).openapi('RoutineShareRevoked'), 'Revoked'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const { routineId, token } = c.req.valid('param');
    const claims = c.get('claims');

    await withUser(claims, async (tx) => {
      const routine = await loadRoutine(tx, routineId);
      if (!hasClubRole(claims, routine.club_id, COACH_ROLES)) {
        throw problem(403, 'Forbidden', 'Revoking requires a coaching role');
      }
      // RLS (is_club_trainer) is the second line of defense on this UPDATE.
      const rows = await tx`
        update app.routine_shares
           set revoked = true
         where token = ${token} and routine_id = ${routineId} and deleted_at is null
        returning id`;
      if (rows.length === 0) throw problem(404, 'Not Found', 'Share token not found');
    });
    return c.json({ revoked: true }, 200);
  },
);
