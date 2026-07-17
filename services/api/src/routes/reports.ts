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
import { assertModuleEnabled, isModuleEnabled } from '../lib/module-gate.js';
import { COACH_ROLES, FINANCE_ROLES, requireClubMember, requireClubRole } from '../lib/guards.js';
// Die EINE Referenz fuer "darf joined_on sehen" — bewusst aus members.ts
// importiert und hier nicht nachgebaut (siehe /reports/anniversaries unten).
import { maySeeJoinedOn } from './members.js';
import {
  capRankOf,
  rankOf,
  requireCap,
  requireClubMemberDb,
  requireClubRoleDb,
} from '../lib/capabilities.js';

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
    // SERVICE-MODE-ROUTE: RLS ist hier AUS -> dieser Guard ist die ALLEINIGE
    // Autorisierung, ein Fehler hat kein Netz. Seit Phase 2 loest er aus der
    // DATENBANK auf: Mehrfachrollen wirken, und der Mitgliedschafts-Gate aus
    // 0025 (deleted_at/status/valid_until) greift erstmals auch hier.
    // Rollenmenge unveraendert (COACH_ROLES) -> keine Rechteaenderung.
    // Bewusst KEINE Faehigkeit: der Katalog kennt keine "Auswertung", und eine
    // fremde zu missbrauchen, die zufaellig dieselbe Menge trifft, waere eine
    // stille Bedeutungsverschiebung (siehe requireClubRoleDb).
    await requireClubRoleDb(c, club_id, COACH_ROLES);

    const summary = await withServiceRole(
      `club evaluation summary for ${club_id} (caller ${claims.sub})`,
      async (tx) => {
        // SERVICE-MODE umgeht die restriktiven Finanz-Gates (0061). Ist das
        // Finanzmodul aus, duerfen die offenen Rechnungen hier NICHT auftauchen
        // — die Auswertung ist gemischt (Mitglieder/Medaillen bleiben), nur der
        // Finanzteil wird auf 0 gesetzt. So bleibt 'enforced' auch hier ehrlich.
        const financeOn = await isModuleEnabled(tx, club_id, 'finance');
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
          open_invoices_total_cents: financeOn ? Number(counts['open_invoices_total_cents']) : 0,
          open_invoices_count: financeOn ? counts['open_invoices_count'] : 0,
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
    // SERVICE-MODE-ROUTE: alleinige Autorisierung (RLS aus).
    // finance >= manage ist im Seed exakt FINANCE_ROLES -> deckungsgleich.
    await requireCap(c, club_id, 'finance', 'manage');

    const prevYear = year - 1;

    const report = await withServiceRole(
      `annual report club=${club_id} year=${year} (caller ${claims.sub})`,
      async (tx) => {
        // SERVICE-MODE umgeht die Finanz-Gates (0061). Der Jahresabschluss ist
        // REIN Finanz: ist das Modul aus, gibt es nichts auszuweisen -> 403.
        await assertModuleEnabled(tx, club_id, 'finance');

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
// key: nearest first).
//
// ### HAERTUNG Phase 2 — hier war ein belegtes Datenleck (RBAC Schritt 5) ###
// Der alte Kommentar behauptete, der Report lese "only the roster a member may
// already see under RLS". Das ist ZEILENWEISE wahr und SPALTENWEISE falsch:
// club_members_select ist app.is_club_member (0002:317-319) — RLS filtert hier
// gar keine Spalten. Den Spaltenschutz macht AUSSCHLIESSLICH members.ts:59-70
// (SENSITIVE_MEMBER_FIELDS: birth_date, joined_on, …). Dieser Report las genau
// diese beiden Spalten und gab `date` + `years` zurueck — `date - years`
// rekonstruiert das Original EXAKT.
//
// Live gegen die Dev-API belegt, Persona guest_coach (kein Familienbezug):
//   GET /clubs/{id}/members    -> Emma Gruenewald birth_date = null  (redigiert)
//   GET /reports/anniversaries -> Emma Gruenewald birthday 2026-11-03, years=10
//                                 => rekonstruiert 2016-11-03
//   app.club_members.birth_date =  2016-11-03                        (exakt)
// Also: das Geburtsdatum eines 10-jaehrigen Kindes, ausgeliefert an eine
// familienfremde Person, an der eigenen Redigierung vorbei.
//
// Die Regel dahinter ist NICHT "API an die DB angleichen" (die DB schuetzt hier
// gar nichts), sondern: DIE API DARF IHREN EIGENEN SPALTENSCHUTZ NICHT
// HINTERGEHEN.
//
// ###########################################################################
// NACHTRAG (Registrierung/0034): DER SCHUTZ WAR RICHTIG, DIE ANTWORT WAR FALSCH
// ###########################################################################
// Die Haertung oben sperrte coach/member/guest_coach komplett aus (403). Damit
// war die Luecke zu — aber auch das Feature: ein Verein, der nicht mehr weiss,
// wer Geburtstag hat, hat kein Datenschutzproblem geloest, sondern eine
// Vereinsfunktion abgeschafft. Beides ist gleichzeitig zu haben, wenn man
// aufhoert, GEBURTSTAGE und VEREINSJUBILAEEN in einen Topf zu werfen:
//
//   GEBURTSTAG:  'years' ist das ALTER. `date` minus `years` = Geburtsdatum.
//                Der Verein braucht "Emma hat am 3. November Geburtstag" —
//                NICHT "Emma wird 10". -> years = null, Tag+Monat genuegen.
//
//                ACHTUNG, DER SUBTILE TEIL: 'years' wegzulassen reicht NICHT,
//                solange der Report nur RUNDE Geburtstage zeigt (Vielfache von
//                10). Wer in der Liste steht, ist an diesem Tag nachweislich
//                10/20/30/… — das Geburtsjahr schrumpft auf eine Handvoll
//                Kandidaten, und bei einem Kind bleibt genau einer uebrig. Die
//                Rundheit selbst IST die Auskunft. Deshalb faellt der
//                10er-Filter weg: es werden ALLE Geburtstage gezeigt. Erst
//                "jeder ist dabei" macht die Anwesenheit in der Liste
//                aussagelos.
//
//   JUBILAEUM:   'years' ist der ganze Sinn ("10 Jahre dabei") — ohne die Zahl
//                gibt es nichts zu feiern. Es bleibt erhalten.
//
// Damit braucht der Report member_contact >= read_all nicht mehr: er leitet aus
// birth_date nur noch Tag+Monat ab, und das ist keine der redigierten Spalten.
// Es bleibt EIN Gate: anniversaries >= read_team (die Faehigkeit selbst, im
// Admin abschaltbar).
//
// JUBILAEEN SIND DESHALB AN "darf joined_on im Roster sehen" GEBUNDEN, Geburtstage
// nicht. (Bis 0045 hiess diese Bedingung member_contact >= read_all; seither ist es
// woertlich maySeeJoinedOn() aus members.ts — siehe den Nachtrag am Ende dieses Kopfs
// und die Begruendung an der Fundstelle im Handler.)
// Ein frueherer Stand liess die Jubilaeums-Zeilen fuer alle stehen und nannte das
// im Kommentar "eine bewusste Entscheidung des Betreibers". Das war es nicht — es
// war ein Leck, und zwar ein gemessenes: aus `date` minus `years` wurde joined_on
// fuer 5 Personen TAGESGENAU rekonstruiert, waehrend GET /clubs/{id}/members
// denselben Aufrufern fuer dieselben Personen joined_on=null lieferte.
// Betroffen war auch guest_coach — eine vereinsexterne Person.
//
// Warum die Zeile nicht reicht, nur `years` zu nullen: bei einem 5-Jahres-Raster
// erscheint eine Person UEBERHAUPT NUR, wenn joined_on ein Vielfaches von 5 zurueck
// liegt. Die blosse Anwesenheit in der Liste engt joined_on damit auf eine Handvoll
// Jahrgaenge ein — dieselbe Rundheits-Falle, die bei den Geburtstagen erkannt und
// durch "ALLE statt nur runde" geschlossen wurde. Bei Jubilaeen geht das nicht, denn
// ein Jubilaeum IST das 5-Jahres-Raster. Also: ganze Zeilen weg statt Zahl weg.
//
// Die Regel ist dieselbe wie ueberall sonst hier:
//   Die API darf ihren eigenen Spaltenschutz nicht hintergehen.
//
// ### NACHTRAG 0045 — DIESER KOPF SAGTE DAS GEGENTEIL DES CODES ###
// Hier stand: "member_contact >= read_all ist im Seed deckungsgleich mit
// maySeeFullRoster (members.ts:67-70)" und "VERHALTEN: coach/member/guest_coach
// sehen ALLE Geburtstage und KEINE Jubilaeen".
// Beides stimmt seit 0045 nicht mehr: der coach sieht joined_on im Roster
// (JOINED_ON_ROLES) und bekommt damit auch die Jubilaeen — nachgemessen, 5 Zeilen.
// Der Handler wurde von Trupp 4 richtig umgestellt (maySeeJoinedOn), nur dieser
// Kopf blieb stehen. Ein Kommentar, der das Gegenteil des Codes behauptet, ist
// schlimmer als keiner: der naechste Leser "korrigiert" sonst den Code auf den
// Kommentar. Beim Zusammenfuehren nachgezogen.
//
// VERHALTEN (gemessen, dev-stack + Seed):
//   owner/admin/moderator/treasurer/coach -> Geburtstage UND Jubilaeen (5 Zeilen)
//   member/guest_coach                    -> NUR Geburtstage (years=null), 0 Jubilaeen
// Die Zusicherung dahinter ist unveraendert und gilt woertlich fuer alle 7 Rollen:
//   Jubilaeums-Zeilen genau dann, wenn derselben Person der Roster joined_on zeigt.
// ============================================================================
reportsRouter.openapi(
  createRoute({
    method: 'get',
    path: '/reports/anniversaries',
    tags: ['reports'],
    summary: 'Jubilaeen & Geburtstage / Upcoming anniversaries & birthdays (anniversaries)',
    description:
      'Zwei verschiedene Dinge in einer Liste: ' +
      'kind=birthday liefert Tag und Monat OHNE Jahre (years=null) — der Verein soll wissen, WANN ' +
      'jemand Geburtstag hat, nicht WIE ALT er wird. Es werden bewusst ALLE Geburtstage gezeigt und ' +
      'nicht nur runde: waeren es nur runde, verriete schon die Anwesenheit in der Liste das Alter. ' +
      'kind=membership ("10 Jahre dabei") erscheint NUR fuer Aufrufer mit member_contact >= read_all: ' +
      'aus dem Jubilaeumsdatum laesst sich joined_on rekonstruieren, und joined_on ist eine redigierte ' +
      'Roster-Spalte. Alle anderen bekommen ausschliesslich Geburtstage. ' +
      'Abschaltbar ueber die Faehigkeit `anniversaries` im Admin.',
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
    // Die Faehigkeit selbst — der Ein/Aus-Schalter im Admin. Sie ist jetzt das
    // EINZIGE Gate: der Report leitet aus birth_date nur noch Tag+Monat ab
    // (siehe Kopf), und das ist keine redigierte Spalte mehr.
    await requireClubMemberDb(c, club_id);
    await requireCap(c, club_id, 'anniversaries', 'read_team');

    // Darf die aufrufende Person joined_on ueberhaupt sehen? Wenn nein, fallen die
    // Jubilaeums-Zeilen ganz weg (siehe Kopf) — pruefen ohne zu werfen, denn die
    // Geburtstage bleiben ja.
    //
    // ### 0045: DIESELBE FUNKTION WIE DER ROSTER, NICHT NUR DIESELBE ABSICHT ###
    // Hier stand `capRankOf(member_contact) >= read_all` mit dem Kommentar "im
    // Seed deckungsgleich mit maySeeFullRoster". Das war zwei Mal fragil:
    //  1. Es waren ZWEI Mechanismen (DB-aufgeloeste Faehigkeit hier, Rollen-Claim
    //     im Roster). "Deckungsgleich im SEED" heisst: sie laufen auseinander,
    //     sobald ein Verein member_contact im Admin-UI anfasst — dann zeigt der
    //     Roster joined_on und der Report verweigert das Jubilaeum (oder
    //     umgekehrt, und dann ist es ein Leck).
    //  2. Mit 0045 stimmt es ohnehin nicht mehr: der coach sieht joined_on im
    //     Roster, hat aber member_contact = 'none' (0023:180, damit er E-Mail und
    //     Geburtsdatum der Kinder NICHT sieht).
    // Die Zusicherung ist unveraendert scharf ("Jubilaeum genau dann, wenn der
    // Roster joined_on zeigt") — sie ist jetzt nur nicht mehr nachgebaut,
    // sondern es ist woertlich dieselbe Funktion. Zwei Kopien einer Regel sind
    // eine Kopie zu viel.
    const joinedOnVisible = maySeeJoinedOn(claims, club_id);

    const rows = await withUser(claims, (tx) =>
      tx`
        with roster as (
          select id, (first_name || ' ' || last_name) as member_name, joined_on, birth_date
          from app.club_members
          where club_id = ${club_id} and deleted_at is null and status = 'active'
        ),
        membership as (
          -- 5/10/15/20/25 … Jahre Mitgliedschaft. 'years' bleibt: ohne die Zahl
          -- gibt es kein Jubilaeum.
          --
          -- Der Filter ${joinedOnVisible} schaltet den ganzen Zweig ab, wenn die
          -- aufrufende Person joined_on nicht sehen darf. Bewusst hier und nicht
          -- erst beim Serialisieren: was nicht selektiert wird, kann auch nicht
          -- ueber einen spaeteren Umweg (Sortierung, Anzahl, Timing) durchsickern.
          select r.id as member_id, r.member_name, 'membership'::text as kind,
                 (r.joined_on + (y * interval '1 year'))::date as date, y as years
          from roster r
          cross join generate_series(5, 80, 5) as y
          where ${joinedOnVisible}
            and r.joined_on is not null
            and (r.joined_on + (y * interval '1 year'))::date
                between current_date and (current_date + interval '365 days')::date
        ),
        birthdays as (
          -- ALLE Geburtstage (nicht nur runde — siehe Kopf: die Rundheit selbst
          -- waere die Auskunft), als naechstes Vorkommen von Tag+Monat.
          --
          -- Die Jahresdifferenz 'yd' bleibt hier drin und wird NICHT selektiert:
          -- sie dient nur dazu, den Tag zu finden. Postgres klemmt dabei den
          -- 29. Februar in Nicht-Schaltjahren von selbst auf den 28. —
          -- deshalb Datums-Arithmetik und nicht make_date(), das dort
          -- schlicht mit einem Fehler abbraeche.
          select r.id as member_id, r.member_name, 'birthday'::text as kind,
                 o.next_date as date, null::int as years
          from roster r
          cross join lateral (
            select case
                     when (r.birth_date + (yd.d * interval '1 year'))::date >= current_date
                       then (r.birth_date + (yd.d * interval '1 year'))::date
                     else (r.birth_date + ((yd.d + 1) * interval '1 year'))::date
                   end as next_date
            from (select (extract(year from current_date)
                          - extract(year from r.birth_date))::int as d) yd
          ) o
          where r.birth_date is not null
            and o.next_date between current_date and (current_date + interval '365 days')::date
        )
        select member_id, member_name, kind, date::text as date, years,
               (date - current_date)::int as days_until
        from (select * from membership union all select * from birthdays) ann
        order by days_until, kind, member_name`,
    );
    return c.json(z.array(anniversarySchema).parse(rows), 200);
  },
);
