// ============================================================================
// routes/reports.ts - GET /reports/summary ("Auswertung", v1 statistiken/
// berichte). A server-computed cross-cutting aggregate for one club.
//
// Access: is_club_trainer/is_club_admin ONLY (Referenz 1.3 "Auswertung").
// The guard is requireClubRole(COACH_ROLES) - owner/admin/moderator/coach/
// guest_coach. The aggregate spans finance (open invoices) which a plain coach
// cannot read under RLS, so - like the platform console - it is computed in
// SERVICE MODE, strictly scoped to the single verified club_id. The role gate
// is therefore the sole authorization (stated as the service-mode reason).
// ============================================================================

import { createRoute, z } from '@hono/zod-openapi';
import { createRouter, errorResponses, jsonContent } from '../lib/openapi.js';
import { reportSummarySchema, uuid } from '../lib/validation.js';
import { withServiceRole } from '../db.js';
import { COACH_ROLES, requireClubRole } from '../lib/guards.js';

export const reportsRouter = createRouter();

reportsRouter.openapi(
  createRoute({
    method: 'get',
    path: '/reports/summary',
    tags: ['reports'],
    summary: 'Club evaluation summary (is_club_trainer / is_club_admin only)',
    security: [{ bearerAuth: [] }],
    request: { query: z.object({ club_id: uuid }) },
    responses: {
      200: jsonContent(reportSummarySchema, 'Aggregate key figures for the club'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const { club_id } = c.req.valid('query');
    const claims = c.get('claims');
    requireClubRole(claims, club_id, COACH_ROLES);

    const summary = await withServiceRole(
      `club evaluation summary for ${club_id} (caller ${claims.sub})`,
      async (tx) => {
        const countRows = await tx`
          select
            (select count(*) from app.club_members
               where club_id = ${club_id} and deleted_at is null)::int as members_total,
            (select count(*) from app.club_members
               where club_id = ${club_id} and deleted_at is null and status = 'active')::int as members_active,
            (select coalesce(sum(amount_cents), 0) from app.invoices
               where club_id = ${club_id} and status = 'open')::bigint as open_invoices_total_cents,
            (select count(*) from app.invoices
               where club_id = ${club_id} and status = 'open')::int as open_invoices_count,
            (select count(*) from app.achievements
               where club_id = ${club_id} and deleted_at is null and medal = 'gold')::int as gold,
            (select count(*) from app.achievements
               where club_id = ${club_id} and deleted_at is null and medal = 'silver')::int as silver,
            (select count(*) from app.achievements
               where club_id = ${club_id} and deleted_at is null and medal = 'bronze')::int as bronze,
            (select count(*) from app.events
               where club_id = ${club_id} and deleted_at is null and starts_at >= now())::int as upcoming_events_count,
            (select coalesce(
                round(
                  count(*) filter (where status in ('present', 'late'))::numeric
                  / nullif(count(*), 0), 4), 0)
               from app.attendance
               where club_id = ${club_id} and deleted_at is null)::float8 as attendance_rate`;
        const counts = countRows[0] as Record<string, number>;

        const byRole = await tx`
          select role::text as role, count(*)::int as count
          from app.club_members
          where club_id = ${club_id} and deleted_at is null and status = 'active'
          group by role
          order by role`;

        const byTeam = await tx`
          select t.id as team_id, t.name as team_name, count(tm.member_id)::int as member_count
          from app.teams t
          left join app.team_members tm
            on tm.team_id = t.id and tm.role = 'skater'
          where t.club_id = ${club_id} and t.deleted_at is null
          group by t.id, t.name
          order by t.name`;

        const upcoming = await tx`
          select id, title, type::text as type, starts_at
          from app.events
          where club_id = ${club_id} and deleted_at is null and starts_at >= now()
          order by starts_at
          limit 5`;

        return {
          club_id,
          members_total: counts['members_total'],
          members_active: counts['members_active'],
          members_by_role: byRole.map((r) => ({ role: r['role'], count: r['count'] })),
          members_by_team: byTeam.map((r) => ({
            team_id: r['team_id'],
            team_name: r['team_name'],
            member_count: r['member_count'],
          })),
          attendance_rate: counts['attendance_rate'],
          open_invoices_total_cents: Number(counts['open_invoices_total_cents']),
          open_invoices_count: counts['open_invoices_count'],
          medals: { gold: counts['gold'], silver: counts['silver'], bronze: counts['bronze'] },
          upcoming_events_count: counts['upcoming_events_count'],
          upcoming_events: upcoming.map((e) => ({
            id: e['id'],
            title: e['title'],
            type: e['type'],
            starts_at: e['starts_at'],
          })),
        };
      },
    );

    return c.json(reportSummarySchema.parse(summary), 200);
  },
);
