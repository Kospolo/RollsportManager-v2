// ============================================================================
// routes/competitions.ts - competitions incl. their start list
// (app.competition_entries: who starts with which routine).
//
// Read-only in v0.2: creating competitions/entries stays a later phase; the
// portal needs the read model for the Wettkampf screen, the dashboard
// countdown and score labels. RLS: every club member may read competitions.
// ============================================================================

import { createRoute, z } from '@hono/zod-openapi';
import { createRouter, errorResponses, jsonContent } from '../lib/openapi.js';
import { competitionSchema, standingsSchema, uuid } from '../lib/validation.js';
import { withUser } from '../db.js';
import { problem } from '../middleware/error.js';
import { requireClubMember } from '../lib/guards.js';

export const competitionsRouter = createRouter();

const competitionIdParam = z.object({
  competitionId: uuid.openapi({ param: { name: 'competitionId', in: 'path' } }),
});

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
