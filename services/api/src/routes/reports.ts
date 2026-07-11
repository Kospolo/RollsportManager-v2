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
import { annualReportSchema, anniversarySchema, reportSummarySchema, uuid } from '../lib/validation.js';
import { withServiceRole, withUser } from '../db.js';
import { COACH_ROLES, FINANCE_ROLES, requireClubMember, requireClubRole } from '../lib/guards.js';

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

// ============================================================================
// GET /reports/annual?club_id&year - Jahresabschluss (v1 jahresabschluss.html).
//
// Finance-only (can_manage_finance). Like /reports/summary it aggregates across
// finance data a plain coach cannot read under RLS, so it is computed in SERVICE
// MODE strictly scoped to the one verified club_id; the FINANCE_ROLES gate is
// the sole authorization. Kassenbuch totals (income/expense/net) + per-category
// sums for the year, the prior-year comparison, donations booked in the year and
// the invoices still open at year end.
// ============================================================================
reportsRouter.openapi(
  createRoute({
    method: 'get',
    path: '/reports/annual',
    tags: ['reports'],
    summary: 'Annual financial close (Jahresabschluss) - can_manage_finance only',
    security: [{ bearerAuth: [] }],
    request: {
      query: z.object({
        club_id: uuid,
        year: z.coerce.number().int().min(2000).max(2100),
      }),
    },
    responses: {
      200: jsonContent(annualReportSchema, 'Annual aggregate incl. prior-year comparison'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const { club_id, year } = c.req.valid('query');
    const claims = c.get('claims');
    requireClubRole(claims, club_id, FINANCE_ROLES);

    const prevYear = year - 1;

    const report = await withServiceRole(
      `annual report club=${club_id} year=${year} (caller ${claims.sub})`,
      async (tx) => {
        // Kassenbuch totals for a given year: income = sum of positive rows,
        // expense = absolute sum of negative rows, net = income - expense.
        const yearTotals = async (y: number) => {
          const rows = await tx`
            select
              coalesce(sum(amount_cents) filter (where amount_cents > 0), 0)::bigint  as income_cents,
              coalesce(-sum(amount_cents) filter (where amount_cents < 0), 0)::bigint as expense_cents
            from app.ledger_entries
            where club_id = ${club_id} and extract(year from entry_on) = ${y}`;
          const r = rows[0] as { income_cents: string; expense_cents: string };
          const income = Number(r.income_cents);
          const expense = Number(r.expense_cents);
          return { year: y, income_cents: income, expense_cents: expense, net_cents: income - expense };
        };

        const cur = await yearTotals(year);
        const prev = await yearTotals(prevYear);

        const byCategory = await tx`
          select le.category_id,
                 cat.name as category_name,
                 cat.kind as category_kind,
                 sum(le.amount_cents)::bigint as amount_cents
          from app.ledger_entries le
          left join app.ledger_categories cat on cat.id = le.category_id
          where le.club_id = ${club_id} and extract(year from le.entry_on) = ${year}
          group by le.category_id, cat.name, cat.kind
          order by cat.kind nulls last, cat.name nulls last`;

        const donations = await tx`
          select coalesce(sum(amount_cents), 0)::bigint as total_cents, count(*)::int as cnt
          from app.donations
          where club_id = ${club_id} and deleted_at is null
            and extract(year from donation_date) = ${year}`;
        const don = donations[0] as { total_cents: string; cnt: number };

        // Open items at year end: invoices still 'open' that were issued on or
        // before Dec 31 of the year (drafts and later invoices excluded).
        const openItems = await tx`
          select coalesce(sum(amount_cents), 0)::bigint as total_cents, count(*)::int as cnt
          from app.invoices
          where club_id = ${club_id} and status = 'open'
            and (issued_on is null or issued_on <= make_date(${year}, 12, 31))`;
        const open = openItems[0] as { total_cents: string; cnt: number };

        return {
          club_id,
          year,
          income_cents: cur.income_cents,
          expense_cents: cur.expense_cents,
          net_cents: cur.net_cents,
          by_category: byCategory.map((r) => {
            const row = r as Record<string, unknown>;
            return {
              category_id: (row['category_id'] as string | null) ?? null,
              category_name: (row['category_name'] as string | null) ?? null,
              kind: (row['category_kind'] as string | null) ?? null,
              amount_cents: Number(row['amount_cents']),
            };
          }),
          prev_year: prev,
          net_delta_cents: cur.net_cents - prev.net_cents,
          donations_total_cents: Number(don.total_cents),
          donations_count: don.cnt,
          open_items_count: open.cnt,
          open_items_total_cents: Number(open.total_cents),
        };
      },
    );

    return c.json(annualReportSchema.parse(report), 200);
  },
);

// ============================================================================
// GET /reports/anniversaries?club_id - Jubiläen (v1 jubilaeen.html).
//
// A read-only DERIVED list (nothing is stored): membership anniversaries at
// 5/10/15/20/25 … years (multiples of 5) from joined_on, plus round birthdays
// (multiples of 10) from birth_date, for the next 12 months. Each entry carries
// the upcoming `date`, the milestone `years` reached, and `days_until` (the sort
// key: nearest first). Access = is_club_member (Referenz 1.3, lesend); it reads
// only the roster a member may already see under RLS, so it runs as the caller
// (withUser) - no service mode needed.
// ============================================================================
reportsRouter.openapi(
  createRoute({
    method: 'get',
    path: '/reports/anniversaries',
    tags: ['reports'],
    summary: 'Upcoming anniversaries & round birthdays (is_club_member)',
    security: [{ bearerAuth: [] }],
    request: { query: z.object({ club_id: uuid }) },
    responses: {
      200: jsonContent(z.array(anniversarySchema), 'Upcoming anniversaries, nearest first'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const { club_id } = c.req.valid('query');
    const claims = c.get('claims');
    requireClubMember(claims, club_id);

    const rows = await withUser(claims, (tx) =>
      tx`
        with roster as (
          select id, (first_name || ' ' || last_name) as member_name, joined_on, birth_date
          from app.club_members
          where club_id = ${club_id} and deleted_at is null and status = 'active'
        ),
        membership as (
          -- 5/10/15/20/25 … years of membership (multiples of 5)
          select r.id as member_id, r.member_name, 'membership'::text as kind,
                 (r.joined_on + (y * interval '1 year'))::date as date, y as years
          from roster r
          cross join generate_series(5, 80, 5) as y
          where r.joined_on is not null
            and (r.joined_on + (y * interval '1 year'))::date
                between current_date and (current_date + interval '365 days')::date
        ),
        birthdays as (
          -- round birthdays (multiples of 10): 10, 20, 30 …
          select r.id as member_id, r.member_name, 'birthday'::text as kind,
                 (r.birth_date + (a * interval '1 year'))::date as date, a as years
          from roster r
          cross join generate_series(10, 100, 10) as a
          where r.birth_date is not null
            and (r.birth_date + (a * interval '1 year'))::date
                between current_date and (current_date + interval '365 days')::date
        )
        select member_id, member_name, kind, date::text as date, years,
               (date - current_date)::int as days_until
        from (select * from membership union all select * from birthdays) ann
        order by days_until, kind, member_name`,
    );
    return c.json(z.array(anniversarySchema).parse(rows), 200);
  },
);
