// ============================================================================
// routes/competitions.ts - competitions incl. their start list
// (app.competition_entries: who starts with which routine).
//
// Lesen: RLS competitions_select (0050) = is_club_member AND can_read_competition.
// Schreiben (POST/PATCH/DELETE der Wettkampf-STAMMDATEN): owner/admin/moderator/
// coach — deckungsgleich mit competitions_insert/update (0004:281, 0007:337).
// Die Startliste (competition_entries) bleibt eine eigene Ressource.
// ============================================================================

import { createRoute, z } from '@hono/zod-openapi';
import { createRouter, errorResponses, jsonContent } from '../lib/openapi.js';
import {
  competitionCreateSchema,
  competitionSchema,
  competitionUpdateSchema,
  deletedSchema,
  standingsSchema,
  uuid,
} from '../lib/validation.js';
import { withUser } from '../db.js';
import type { Tx } from '../db.js';
import { problem } from '../middleware/error.js';
import { requireClubMember, requireClubRole } from '../lib/guards.js';
import type { ClubRole } from '../middleware/auth.js';

/**
 * Wer Wettkampf-Stammdaten anlegen/aendern/(soft-)loeschen darf. DECKUNGSGLEICH
 * mit den Policies competitions_insert/competitions_update (0007:337-341):
 * owner/admin/moderator/coach — OHNE guest_coach (Struktur, kein Gast). Der
 * Soft-Delete ist ein UPDATE (set deleted_at) und faellt daher unter
 * competitions_update; eine eigene DELETE-Policy gibt es bewusst nicht.
 */
const COMPETITION_WRITE_ROLES: readonly ClubRole[] = ['owner', 'admin', 'moderator', 'coach'];

export const competitionsRouter = createRouter();

const competitionIdParam = z.object({
  competitionId: uuid.openapi({ param: { name: 'competitionId', in: 'path' } }),
});

/**
 * Einen Wettkampf ueber den NORMALEN Lesepfad holen (RLS aktiv), in derselben
 * Form wie GET /competitions (inkl. entries). Genutzt zum Rueckenlesen nach
 * Anlegen/Aendern — siehe den RETURNING-Fallstrick in POST /competitions.
 */
async function selectCompetition(tx: Tx, competitionId: string): Promise<unknown | undefined> {
  const rows = await tx`
    select comp.*,
      coalesce((select jsonb_agg(jsonb_build_object(
                  'id', ce.id,
                  'member_id', ce.member_id,
                  'routine_id', ce.routine_id,
                  'status', ce.status
                ) order by ce.created_at)
                from app.competition_entries ce
                where ce.competition_id = comp.id and ce.deleted_at is null),
               '[]'::jsonb) as entries
    from app.competitions comp
    where comp.id = ${competitionId} and comp.deleted_at is null`;
  return rows[0];
}

/** club_id eines Wettkampfs lesen (RLS aktiv): 404, wenn unsichtbar/nicht da. */
async function loadCompetition(tx: Tx, competitionId: string): Promise<{ id: string; club_id: string }> {
  const rows = await tx`
    select id, club_id from app.competitions
    where id = ${competitionId} and deleted_at is null`;
  const comp = rows[0];
  if (!comp) throw problem(404, 'Not Found', 'Competition not found');
  return comp as { id: string; club_id: string };
}

competitionsRouter.openapi(
  createRoute({
    method: 'get',
    path: '/competitions',
    tags: ['competitions'],
    summary: 'List competitions of a club incl. entries (start list)',
    security: [{ bearerAuth: [] }],
    request: { query: z.object({ club_id: uuid }) },
    responses: {
      200: jsonContent(z.array(competitionSchema), 'Competitions of the club'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const { club_id } = c.req.valid('query');
    requireClubMember(c.get('claims'), club_id);
    const rows = await withUser(c.get('claims'), (tx) =>
      tx`select comp.*,
           coalesce((select jsonb_agg(jsonb_build_object(
                       'id', ce.id,
                       'member_id', ce.member_id,
                       'routine_id', ce.routine_id,
                       'status', ce.status
                     ) order by ce.created_at)
                     from app.competition_entries ce
                     where ce.competition_id = comp.id and ce.deleted_at is null),
                    '[]'::jsonb) as entries
         from app.competitions comp
         where comp.club_id = ${club_id} and comp.deleted_at is null
         order by comp.starts_at`,
    );
    return c.json(z.array(competitionSchema).parse(rows), 200);
  },
);

competitionsRouter.openapi(
  createRoute({
    method: 'post',
    path: '/competitions',
    tags: ['competitions'],
    summary: 'Create a competition (owner/admin/moderator/coach)',
    security: [{ bearerAuth: [] }],
    request: {
      body: { content: { 'application/json': { schema: competitionCreateSchema } }, required: true },
    },
    responses: {
      201: jsonContent(competitionSchema, 'Created competition'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const body = c.req.valid('json');
    const claims = c.get('claims');
    requireClubRole(claims, body.club_id, COMPETITION_WRITE_ROLES);

    const created = await withUser(claims, async (tx) => {
      // -----------------------------------------------------------------------
      // KEIN `returning` — derselbe RETURNING-Fallstrick wie in events.ts/
      // routines.ts. competitions_select haengt seit 0050 an
      // app.can_read_competition(id); die Funktion ist STABLE und liest
      // app.competitions, sieht die eben eingefuegte Zeile im Snapshot des
      // EIGENEN Statements also nicht -> Postgres meldete ein irrefuehrendes
      // 42501 ("new row violates row-level security policy"), OBWOHL der INSERT
      // erlaubt ist. Deshalb: id vorab ziehen (app.uuid_v7() haelt die
      // Zeitordnung des Spalten-Defaults), OHNE returning einfuegen und die
      // Zeile DANACH in einem SEPARATEN Statement zurueckenlesen.
      // -----------------------------------------------------------------------
      const idRows = await tx`select app.uuid_v7() as id`;
      const competitionId = (idRows[0] as { id: string }).id;

      await tx`
        insert into app.competitions
          (id, club_id, name, location, starts_at, ends_at, registration_deadline, status)
        values (${competitionId}, ${body.club_id}, ${body.name}, ${body.location ?? null},
                ${body.starts_at}, ${body.ends_at}, ${body.registration_deadline ?? null},
                ${body.status})`;

      // Rueckenlesen ueber den NORMALEN Lesepfad (RLS aktiv). Ein Schreiber
      // (owner/admin/moderator/coach) darf den Wettkampf immer auch sehen
      // (can_read_competition: Vorstand ueber Rolle, coach ueber is_club_trainer)
      // — anders als bei team-losen Terminen gibt es hier keinen Grenzfall.
      const row = await selectCompetition(tx, competitionId);
      if (row === undefined) throw problem(404, 'Not Found', 'Competition not found');
      return row;
    });
    return c.json(competitionSchema.parse(created), 201);
  },
);

competitionsRouter.openapi(
  createRoute({
    method: 'patch',
    path: '/competitions/{competitionId}',
    tags: ['competitions'],
    summary: 'Edit a competition (owner/admin/moderator/coach)',
    security: [{ bearerAuth: [] }],
    request: {
      params: competitionIdParam,
      body: { content: { 'application/json': { schema: competitionUpdateSchema } }, required: true },
    },
    responses: {
      200: jsonContent(competitionSchema, 'Updated competition'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const { competitionId } = c.req.valid('param');
    const body = c.req.valid('json');
    const claims = c.get('claims');

    const updated = await withUser(claims, async (tx) => {
      const comp = await loadCompetition(tx, competitionId); // 404 when invisible (RLS)
      requireClubRole(claims, comp.club_id, COMPETITION_WRITE_ROLES);

      // Nur mitgeschickte Felder anfassen. KEIN `returning` — derselbe
      // RETURNING-Fallstrick wie in POST; unten separat zuruecklesen.
      const scalar: Record<string, unknown> = {};
      if (body.name !== undefined) scalar.name = body.name;
      if (body.location !== undefined) scalar.location = body.location;
      if (body.starts_at !== undefined) scalar.starts_at = body.starts_at;
      if (body.ends_at !== undefined) scalar.ends_at = body.ends_at;
      if (body.registration_deadline !== undefined) {
        scalar.registration_deadline = body.registration_deadline;
      }
      if (body.status !== undefined) scalar.status = body.status;
      if (Object.keys(scalar).length > 0) {
        await tx`update app.competitions set ${tx(scalar)} where id = ${competitionId} and deleted_at is null`;
      }

      const row = await selectCompetition(tx, competitionId);
      if (row === undefined) throw problem(404, 'Not Found', 'Competition not found');
      return row;
    });
    return c.json(competitionSchema.parse(updated), 200);
  },
);

competitionsRouter.openapi(
  createRoute({
    method: 'delete',
    path: '/competitions/{competitionId}',
    tags: ['competitions'],
    summary: 'Soft-delete a competition (owner/admin/moderator/coach)',
    security: [{ bearerAuth: [] }],
    request: { params: competitionIdParam },
    responses: {
      200: jsonContent(deletedSchema, 'Competition soft-deleted'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const { competitionId } = c.req.valid('param');
    const claims = c.get('claims');

    await withUser(claims, async (tx) => {
      const comp = await loadCompetition(tx, competitionId); // 404 when invisible (RLS)
      requireClubRole(claims, comp.club_id, COMPETITION_WRITE_ROLES);
      // Soft-delete = UPDATE ... set deleted_at (das PowerSync-Tombstone; kein
      // eigener DELETE-Pfad). KEIN `returning`: der RETURNING-Fallstrick
      // (competitions_select -> can_read_competition, das deleted_at is null
      // filtert) laege auf der eben getilgten Zeile 0 rows zurueck. Autorisierung
      // (requireClubRole == competitions_update) und Existenz (loadCompetition)
      // stehen bereits.
      await tx`
        update app.competitions set deleted_at = now()
        where id = ${competitionId} and deleted_at is null`;
    });
    return c.json({ status: 'deleted' as const, id: competitionId }, 200);
  },
);

// ----------------------------------------------------------------------------
// Standings (wettkampf-live.html): per category the routine-bound starters,
// ranked by total_score, with the delta to each routine's previous score.
// Read = is_club_member (RLS filters foreign clubs to 0 rows -> 404).
// ----------------------------------------------------------------------------
competitionsRouter.openapi(
  createRoute({
    method: 'get',
    path: '/competitions/{competitionId}/standings',
    tags: ['competitions'],
    summary: 'Ranked standings of a competition (per category)',
    security: [{ bearerAuth: [] }],
    request: { params: competitionIdParam },
    responses: {
      200: jsonContent(standingsSchema, 'Standings grouped and ranked by category'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const { competitionId } = c.req.valid('param');
    const claims = c.get('claims');

    const result = await withUser(claims, async (tx) => {
      const compRows = await tx`
        select id, club_id, name from app.competitions
        where id = ${competitionId} and deleted_at is null`;
      const comp = compRows[0] as { id: string; club_id: string; name: string } | undefined;
      if (!comp) return undefined;

      const rows = await tx`
        with entry_score as (
          select
            ce.id            as entry_id,
            ce.member_id,
            m.first_name,
            m.last_name,
            r.id             as routine_id,
            r.title          as routine_title,
            coalesce(r.category, 'Ohne Kategorie') as category,
            s.technical_score,
            s.components_score,
            s.total_score,
            s.placement,
            (select ps.total_score
               from app.routine_scores ps
              where ps.routine_id = r.id and ps.deleted_at is null
                and (ps.scored_on, ps.id) < (s.scored_on, s.id)
              order by ps.scored_on desc, ps.id desc
              limit 1) as prev_total
          from app.competition_entries ce
          join app.routines r on r.id = ce.routine_id and r.deleted_at is null
          left join app.club_members m on m.id = ce.member_id
          left join lateral (
            select s2.*
              from app.routine_scores s2
             where s2.competition_id = ce.competition_id
               and s2.routine_id = r.id
               and s2.deleted_at is null
             order by s2.scored_on desc, s2.id desc
             limit 1
          ) s on true
          where ce.competition_id = ${competitionId} and ce.deleted_at is null
        )
        select
          category,
          rank() over (partition by category order by total_score desc nulls last) as rank,
          entry_id, member_id, first_name, last_name, routine_id, routine_title,
          technical_score, components_score, total_score, placement,
          case when total_score is null or prev_total is null then null
               else round(total_score - prev_total, 2) end as delta
        from entry_score
        order by category, rank, last_name nulls last`;

      return { comp, rows };
    });

    if (result === undefined) throw problem(404, 'Not Found', 'Competition not found');
    // Belt-and-suspenders: RLS already guaranteed membership by returning the row.
    requireClubMember(claims, result.comp.club_id);

    return c.json(
      standingsSchema.parse({
        competition_id: result.comp.id,
        name: result.comp.name,
        rows: result.rows,
      }),
      200,
    );
  },
);
