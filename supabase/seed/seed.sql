-- ============================================================================
-- seed.sql — RollsportManager v2 demo data (DEV/STAGING ONLY — never prod!)
--
-- Demo club "RSV Neckarsulm", kept 1:1 consistent with the web mock data in
-- apps/web/lib/mock/ :
--   * 24 members (m-01…m-24) covering every club role — owner, admin,
--     moderator (Petra Köhler, m-14), treasurer, coach, guest_coach, member —
--     3 teams, 5 guardianships (3 families)
--   * 1 PLATFORM admin (no club_members row; app_metadata.is_platform_admin)
--   * 16 events relative to today (past trainings with attendance, upcoming
--     trainings with RSVPs, the Bezirksmeisterschaft in 9 days). 14 davon sind
--     audience='teams' (nur die zugeordneten Teams sehen sie), ZWEI sind
--     ausdrueckliche Vereinsveranstaltungen (audience='club', 0050):
--     e-14 Sommerfest und e-16 Jahreshauptversammlung — sie haben deshalb
--     KEINE event_teams-Zeile und jedes Mitglied sieht sie.
--   * 6 routines (Küren) with audio media assets, markers and score history
--   * 2 competitions with entries
--   * 10 invoices — the 5 OPEN ones sum to exactly 38,100 cents = 381.00 EUR
--   * 10 ledger entries (cash book) linked 1:1 to paid invoices
--   * 7 tasks, product catalog, one manual club entitlement (beta grandfather)
--
-- Dates are RELATIVE to today (like the mocks) so the demo never goes stale.
-- Deterministic UUIDs (hex prefixes) map to the mock ids:
--   club  c1ab…-…01      teams  b0…-01…03      members a0…-01…24
--   profiles 90…-NN      events e0…-01…15      routines d0…-01…06
--   media aa…-01…06      competitions c0…-01/02  invoices f0…-01…10
--
-- Run against a FRESH database (after all migrations), in one psql session.
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- Seed-local helper: deterministic waveform peaks (same envelope as the web
-- mock's waveformPeaks(): quiet intro, strong middle, finale spike).
-- ----------------------------------------------------------------------------
create function pg_temp.waveform_peaks(seed integer, cnt integer default 96)
returns jsonb
language sql
as $$
  select jsonb_agg(
    round(
      least(1.0, greatest(0.08,
        (0.35 + 0.45 * sin(pi() * i / cnt)
          + greatest(0.0, (i::double precision / cnt) - 0.82))
        * (0.55 + 0.45 * abs(sin(seed * i * 12.9898)))
      ))::numeric, 2)
    order by i)
  from generate_series(1, cnt) as i
$$;

-- ----------------------------------------------------------------------------
-- auth.users + profiles (adults with accounts only; children have none)
-- ----------------------------------------------------------------------------
insert into auth.users (id, email) values
  ('90000000-0000-4000-8000-000000000001', 'sandra.vogel@example.org'),
  ('90000000-0000-4000-8000-000000000002', 'juergen.haeberle@example.org'),
  ('90000000-0000-4000-8000-000000000003', 'beate.schaefer@example.org'),
  ('90000000-0000-4000-8000-000000000004', 'thomas.krueger@example.org'),
  ('90000000-0000-4000-8000-000000000005', 'annalena.boehm@example.org'),
  ('90000000-0000-4000-8000-000000000006', 'milena.oeztuerk@example.org'),
  ('90000000-0000-4000-8000-000000000009', 'katrin.gruenewald@example.org'),
  ('90000000-0000-4000-8000-000000000012', 'stefanie.mueller@example.org'),
  ('90000000-0000-4000-8000-000000000014', 'petra.koehler@example.org')
on conflict (id) do nothing;

insert into app.profiles (id, display_name) values
  ('90000000-0000-4000-8000-000000000001', 'Sandra Vogel'),
  ('90000000-0000-4000-8000-000000000002', 'Jürgen Häberle'),
  ('90000000-0000-4000-8000-000000000003', 'Beate Schäfer'),
  ('90000000-0000-4000-8000-000000000004', 'Thomas Krüger'),
  ('90000000-0000-4000-8000-000000000005', 'Anna-Lena Böhm'),
  ('90000000-0000-4000-8000-000000000006', 'Milena Öztürk'),
  ('90000000-0000-4000-8000-000000000009', 'Katrin Grünewald'),
  ('90000000-0000-4000-8000-000000000012', 'Stefanie Müller'),
  ('90000000-0000-4000-8000-000000000014', 'Petra Köhler');

-- Platform administrator ("super_admin" at PLATFORM level, Referenz 1.4). This
-- is NOT a club role: the person has NO club_members row. Identity is carried
-- by app_metadata.is_platform_admin in the JWT (GoTrue emits raw_app_meta_data
-- into the access token) and read server-side by app.is_platform_admin().
insert into auth.users (id, email, raw_app_meta_data) values
  ('90000000-0000-4000-8000-000000000090', 'platform.admin@rollsportmanager.app',
   '{"is_platform_admin": true}'::jsonb)
on conflict (id) do nothing;

insert into app.profiles (id, display_name) values
  ('90000000-0000-4000-8000-000000000090', 'RSM Plattform-Admin');

-- ----------------------------------------------------------------------------
-- NEULING — eine ganz normale Person OHNE Verein und OHNE Sonderrechte.
--
-- Die fehlte bisher: die einzige Persona ohne club_members-Zeile war der
-- Plattform-Admin (…090), und der ist das GEGENTEIL eines Neulings — er sieht
-- per Bypass in JEDEN Verein (app.is_club_member, 0025:92).
--
-- Ohne diese Person ist die Registrierung nicht pruefbar: jeder andere Token
-- gehoert schon zu RSV Neckarsulm. Sie traegt den Beweis, dass ein Neuling
-- nichts sieht — und dass er nach dem Beitritt mit RICHTIGEM Code (pending)
-- immer noch nichts sieht.
--
-- KEIN raw_app_meta_data: kein Flag, kein Bypass, keine Rolle. Genau das ist
-- der Punkt.
-- ----------------------------------------------------------------------------
insert into auth.users (id, email) values
  ('90000000-0000-4000-8000-000000000091', 'nadja.neuling@example.org')
on conflict (id) do nothing;

insert into app.profiles (id, display_name) values
  ('90000000-0000-4000-8000-000000000091', 'Nadja Neuling');

-- ----------------------------------------------------------------------------
-- Club
-- ----------------------------------------------------------------------------
insert into app.clubs (id, name, short_name, city, discipline, founded_year, join_code) values
  ('c1ab0000-0000-4000-8000-000000000001', 'RSV Neckarsulm', 'RSV', 'Neckarsulm', 'Rollkunstlauf', 1968, 'RSV-DEMO-2026');

-- ----------------------------------------------------------------------------
-- Members (mock m-01 … m-24)
-- ----------------------------------------------------------------------------
insert into app.club_members
  (id, club_id, profile_id, first_name, last_name, email, birth_date, role, status, joined_on, valid_until)
values
  -- board, administration & coaching staff
  ('a0000000-0000-4000-8000-000000000001', 'c1ab0000-0000-4000-8000-000000000001', '90000000-0000-4000-8000-000000000001', 'Sandra',    'Vogel',     'sandra.vogel@example.org',      null,         'coach',       'active',  '2015-09-01', null),
  ('a0000000-0000-4000-8000-000000000002', 'c1ab0000-0000-4000-8000-000000000001', '90000000-0000-4000-8000-000000000002', 'Jürgen',    'Häberle',   'juergen.haeberle@example.org',  null,         'owner',       'active',  '1998-03-15', null),
  ('a0000000-0000-4000-8000-000000000003', 'c1ab0000-0000-4000-8000-000000000001', '90000000-0000-4000-8000-000000000003', 'Beate',     'Schäfer',   'beate.schaefer@example.org',    null,         'treasurer',   'active',  '2006-01-10', null),
  ('a0000000-0000-4000-8000-000000000004', 'c1ab0000-0000-4000-8000-000000000001', '90000000-0000-4000-8000-000000000004', 'Thomas',    'Krüger',    'thomas.krueger@example.org',    null,         'admin',       'active',  '2011-05-02', null),
  ('a0000000-0000-4000-8000-000000000005', 'c1ab0000-0000-4000-8000-000000000001', '90000000-0000-4000-8000-000000000005', 'Anna-Lena', 'Böhm',      'annalena.boehm@example.org',    null,         'coach',       'active',  '2019-08-20', null),
  ('a0000000-0000-4000-8000-000000000006', 'c1ab0000-0000-4000-8000-000000000001', '90000000-0000-4000-8000-000000000006', 'Milena',    'Öztürk',    'milena.oeztuerk@example.org',   null,         'guest_coach', 'active',  current_date - 14, now() + interval '30 days'),
  -- family Grünewald
  ('a0000000-0000-4000-8000-000000000007', 'c1ab0000-0000-4000-8000-000000000001', null,                                   'Lina',      'Grünewald', null,                            '2014-04-12', 'member',      'active',  '2021-09-01', null),
  ('a0000000-0000-4000-8000-000000000008', 'c1ab0000-0000-4000-8000-000000000001', null,                                   'Emma',      'Grünewald', null,                            '2016-11-03', 'member',      'active',  '2023-03-01', null),
  ('a0000000-0000-4000-8000-000000000009', 'c1ab0000-0000-4000-8000-000000000001', '90000000-0000-4000-8000-000000000009', 'Katrin',    'Grünewald', 'katrin.gruenewald@example.org', null,         'member',      'active',  '2021-09-01', null),
  -- family Müller
  ('a0000000-0000-4000-8000-000000000010', 'c1ab0000-0000-4000-8000-000000000001', null,                                   'Sofia',     'Müller',    null,                            '2013-02-27', 'member',      'active',  '2020-01-15', null),
  ('a0000000-0000-4000-8000-000000000011', 'c1ab0000-0000-4000-8000-000000000001', null,                                   'Ben',       'Müller',    null,                            '2015-07-19', 'member',      'active',  '2022-04-01', null),
  ('a0000000-0000-4000-8000-000000000012', 'c1ab0000-0000-4000-8000-000000000001', '90000000-0000-4000-8000-000000000012', 'Stefanie',  'Müller',    'stefanie.mueller@example.org',  null,         'member',      'active',  '2020-01-15', null),
  -- family Köhler
  ('a0000000-0000-4000-8000-000000000013', 'c1ab0000-0000-4000-8000-000000000001', null,                                   'Finn',      'Köhler',    null,                            '2013-09-08', 'member',      'active',  '2021-02-01', null),
  ('a0000000-0000-4000-8000-000000000014', 'c1ab0000-0000-4000-8000-000000000001', '90000000-0000-4000-8000-000000000014', 'Petra',     'Köhler',    'petra.koehler@example.org',     null,         'moderator',   'active',  '2021-02-01', null),
  -- skaters
  ('a0000000-0000-4000-8000-000000000015', 'c1ab0000-0000-4000-8000-000000000001', null, 'Leonie',    'Schröder', null, '2012-05-30', 'member', 'active',  '2019-09-01', null),
  ('a0000000-0000-4000-8000-000000000016', 'c1ab0000-0000-4000-8000-000000000001', null, 'Maja',      'Weiß',     null, '2011-01-22', 'member', 'active',  '2018-09-01', null),
  ('a0000000-0000-4000-8000-000000000017', 'c1ab0000-0000-4000-8000-000000000001', null, 'Johanna',   'Bär',      null, '2010-10-14', 'member', 'active',  '2017-04-01', null),
  ('a0000000-0000-4000-8000-000000000018', 'c1ab0000-0000-4000-8000-000000000001', null, 'Charlotte', 'Vogler',   null, '2009-06-05', 'member', 'active',  '2016-09-01', null),
  ('a0000000-0000-4000-8000-000000000019', 'c1ab0000-0000-4000-8000-000000000001', null, 'Amelie',    'Jäger',    null, '2012-12-01', 'member', 'active',  '2020-09-01', null),
  ('a0000000-0000-4000-8000-000000000020', 'c1ab0000-0000-4000-8000-000000000001', null, 'Nele',      'Hoffmann', null, '2014-08-16', 'member', 'active',  '2022-09-01', null),
  ('a0000000-0000-4000-8000-000000000021', 'c1ab0000-0000-4000-8000-000000000001', null, 'Marie',     'Süß',      null, '2011-03-09', 'member', 'active',  '2018-01-15', null),
  ('a0000000-0000-4000-8000-000000000022', 'c1ab0000-0000-4000-8000-000000000001', null, 'Lukas',     'Öhler',    null, '2010-04-25', 'member', 'active',  '2017-09-01', null),
  ('a0000000-0000-4000-8000-000000000023', 'c1ab0000-0000-4000-8000-000000000001', null, 'Hanna',     'Förster',  null, '2008-09-13', 'member', 'active',  '2015-09-01', null),
  ('a0000000-0000-4000-8000-000000000024', 'c1ab0000-0000-4000-8000-000000000001', null, 'Greta',     'Lindner',  null, '2015-06-21', 'member', 'pending', current_date - 5, null);

-- ----------------------------------------------------------------------------
-- Guardianships (3 families, 5 relations)
-- ----------------------------------------------------------------------------
insert into app.guardianships (club_id, guardian_member_id, child_member_id, relation) values
  ('c1ab0000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000009', 'a0000000-0000-4000-8000-000000000007', 'parent'),
  ('c1ab0000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000009', 'a0000000-0000-4000-8000-000000000008', 'parent'),
  ('c1ab0000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000012', 'a0000000-0000-4000-8000-000000000010', 'parent'),
  ('c1ab0000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000012', 'a0000000-0000-4000-8000-000000000011', 'parent'),
  ('c1ab0000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000014', 'a0000000-0000-4000-8000-000000000013', 'parent');

-- ----------------------------------------------------------------------------
-- Teams + memberships (skaters and coaches)
-- ----------------------------------------------------------------------------
insert into app.teams (id, club_id, name, age_group) values
  ('b0000000-0000-4000-8000-000000000001', 'c1ab0000-0000-4000-8000-000000000001', 'Minis & Anfänger',    'U8–U10'),
  ('b0000000-0000-4000-8000-000000000002', 'c1ab0000-0000-4000-8000-000000000001', 'Nachwuchs Pflicht',   'U12–U15'),
  ('b0000000-0000-4000-8000-000000000003', 'c1ab0000-0000-4000-8000-000000000001', 'Kürgruppe Leistung',  'U15+');

insert into app.team_members (club_id, team_id, member_id, role)
select 'c1ab0000-0000-4000-8000-000000000001', t.id, m.id, v.role::app.team_role
from (values
  -- coaches
  ('b0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000005', 'coach'),
  ('b0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001', 'coach'),
  ('b0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000005', 'coach'),
  ('b0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000001', 'coach'),
  ('b0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000006', 'coach'),
  -- skaters t-01
  ('b0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000008', 'skater'),
  ('b0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000011', 'skater'),
  ('b0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000020', 'skater'),
  ('b0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000024', 'skater'),
  -- skaters t-02
  ('b0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000007', 'skater'),
  ('b0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000010', 'skater'),
  ('b0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000013', 'skater'),
  ('b0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000015', 'skater'),
  ('b0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000019', 'skater'),
  -- skaters t-03
  ('b0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000016', 'skater'),
  ('b0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000017', 'skater'),
  ('b0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000018', 'skater'),
  ('b0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000021', 'skater'),
  ('b0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000022', 'skater'),
  ('b0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000023', 'skater')
) as v(team_id, member_id, role)
join app.teams t on t.id = v.team_id::uuid
join app.club_members m on m.id = v.member_id::uuid;

-- ----------------------------------------------------------------------------
-- Competitions (Bezirksmeisterschaft in 9 days, Kreispokal 3 weeks ago)
-- ----------------------------------------------------------------------------
insert into app.competitions (id, club_id, name, location, starts_at, ends_at, registration_deadline, status) values
  ('c0000000-0000-4000-8000-000000000001', 'c1ab0000-0000-4000-8000-000000000001',
   'Bezirksmeisterschaft Rollkunstlauf', 'Rundsporthalle Ludwigsburg',
   (current_date + 9 + time '08:30')::timestamptz, (current_date + 9 + time '18:00')::timestamptz,
   current_date + 2, 'upcoming'),
  ('c0000000-0000-4000-8000-000000000002', 'c1ab0000-0000-4000-8000-000000000001',
   'Kreispokal Heilbronn', 'Römerhalle Bad Wimpfen',
   (current_date - 21 + time '09:00')::timestamptz, (current_date - 21 + time '17:30')::timestamptz,
   null, 'done');

-- ----------------------------------------------------------------------------
-- Events (mock e-01 … e-15, relative to today)
-- ----------------------------------------------------------------------------
insert into app.events (id, club_id, type, title, location, starts_at, ends_at, note, competition_id, audience) values
  ('e0000000-0000-4000-8000-000000000001', 'c1ab0000-0000-4000-8000-000000000001', 'training',    'Training Nachwuchs Pflicht',           'Ballei-Sporthalle, Neckarsulm', (current_date - 7 + time '17:00')::timestamptz, (current_date - 7 + time '18:30')::timestamptz, null, null, 'teams'),
  ('e0000000-0000-4000-8000-000000000002', 'c1ab0000-0000-4000-8000-000000000001', 'training',    'Training Kürgruppe Leistung',          'Ballei-Sporthalle, Neckarsulm', (current_date - 6 + time '18:30')::timestamptz, (current_date - 6 + time '20:30')::timestamptz, null, null, 'teams'),
  ('e0000000-0000-4000-8000-000000000003', 'c1ab0000-0000-4000-8000-000000000001', 'training',    'Training Minis & Anfänger',            'Pichterichhalle, Neckarsulm',   (current_date - 5 + time '16:00')::timestamptz, (current_date - 5 + time '17:00')::timestamptz, null, null, 'teams'),
  ('e0000000-0000-4000-8000-000000000004', 'c1ab0000-0000-4000-8000-000000000001', 'training',    'Training Nachwuchs Pflicht',           'Ballei-Sporthalle, Neckarsulm', (current_date - 3 + time '17:00')::timestamptz, (current_date - 3 + time '18:30')::timestamptz, null, null, 'teams'),
  ('e0000000-0000-4000-8000-000000000005', 'c1ab0000-0000-4000-8000-000000000001', 'training',    'Kür-Feinschliff Leistung',             'Ballei-Sporthalle, Neckarsulm', (current_date - 1 + time '18:30')::timestamptz, (current_date - 1 + time '20:30')::timestamptz, 'Schwerpunkt: Sprungkombinationen für die Bezirksmeisterschaft', null, 'teams'),
  ('e0000000-0000-4000-8000-000000000006', 'c1ab0000-0000-4000-8000-000000000001', 'training',    'Training Minis & Anfänger',            'Pichterichhalle, Neckarsulm',   (current_date + 0 + time '16:00')::timestamptz, (current_date + 0 + time '17:00')::timestamptz, null, null, 'teams'),
  ('e0000000-0000-4000-8000-000000000007', 'c1ab0000-0000-4000-8000-000000000001', 'training',    'Training Nachwuchs Pflicht',           'Ballei-Sporthalle, Neckarsulm', (current_date + 1 + time '17:00')::timestamptz, (current_date + 1 + time '18:30')::timestamptz, null, null, 'teams'),
  ('e0000000-0000-4000-8000-000000000008', 'c1ab0000-0000-4000-8000-000000000001', 'training',    'Training Kürgruppe Leistung',          'Ballei-Sporthalle, Neckarsulm', (current_date + 2 + time '18:30')::timestamptz, (current_date + 2 + time '20:30')::timestamptz, null, null, 'teams'),
  ('e0000000-0000-4000-8000-000000000009', 'c1ab0000-0000-4000-8000-000000000001', 'other',       'Elternabend: Saisonplanung',           'Vereinsheim RSV Neckarsulm',    (current_date + 3 + time '19:00')::timestamptz, (current_date + 3 + time '20:30')::timestamptz, null, null, 'teams'),
  ('e0000000-0000-4000-8000-000000000010', 'c1ab0000-0000-4000-8000-000000000001', 'training',    'Training Minis & Anfänger',            'Pichterichhalle, Neckarsulm',   (current_date + 4 + time '16:00')::timestamptz, (current_date + 4 + time '17:00')::timestamptz, null, null, 'teams'),
  ('e0000000-0000-4000-8000-000000000011', 'c1ab0000-0000-4000-8000-000000000001', 'training',    'Generalprobe Küren',                   'Ballei-Sporthalle, Neckarsulm', (current_date + 6 + time '18:00')::timestamptz, (current_date + 6 + time '20:30')::timestamptz, 'Mit Musik und Wettkampfkleidung — Ablauf wie am Wettkampftag', null, 'teams'),
  ('e0000000-0000-4000-8000-000000000012', 'c1ab0000-0000-4000-8000-000000000001', 'competition', 'Bezirksmeisterschaft Rollkunstlauf',   'Rundsporthalle Ludwigsburg',    (current_date + 9 + time '08:30')::timestamptz, (current_date + 9 + time '18:00')::timestamptz, 'Treffpunkt 7:45 Uhr am Vereinsheim, Fahrgemeinschaften bitte eintragen', 'c0000000-0000-4000-8000-000000000001', 'teams'),
  ('e0000000-0000-4000-8000-000000000013', 'c1ab0000-0000-4000-8000-000000000001', 'training',    'Training Nachwuchs Pflicht',           'Ballei-Sporthalle, Neckarsulm', (current_date + 11 + time '17:00')::timestamptz, (current_date + 11 + time '18:30')::timestamptz, null, null, 'teams'),
  ('e0000000-0000-4000-8000-000000000014', 'c1ab0000-0000-4000-8000-000000000001', 'other',       'Sommerfest mit Schnupperlaufen',       'Vereinsgelände RSV Neckarsulm', (current_date + 23 + time '14:00')::timestamptz, (current_date + 23 + time '20:00')::timestamptz, 'Kuchen-Slots werden im Vereinsleben-Board verteilt', null, 'club'),
  ('e0000000-0000-4000-8000-000000000015', 'c1ab0000-0000-4000-8000-000000000001', 'training',    'Training Kürgruppe Leistung',          'Ballei-Sporthalle, Neckarsulm', (current_date + 13 + time '18:30')::timestamptz, (current_date + 13 + time '20:30')::timestamptz, null, null, 'teams'),
  -- e-16: die zweite VEREINSVERANSTALTUNG. Ohne sie loege der Seed weiter —
  -- ein frisch freigegebenes Mitglied ohne Team und ohne Kind saehe sonst
  -- NULL Termine, und die neue Regel saehe am Bildschirm kaputt aus statt
  -- richtig. Genau diese Falle ("coach sieht 0 Schliessfaecher") hat hier
  -- schon zweimal zugeschlagen. Traegt zusaetzlich 99f_pending_matrix.sql:241
  -- ("nach Freigabe: sie sieht die Termine" > 0), der sonst rot fiele.
  ('e0000000-0000-4000-8000-000000000016', 'c1ab0000-0000-4000-8000-000000000001', 'other',       'Jahreshauptversammlung',               'Vereinsheim RSV Neckarsulm',    (current_date + 17 + time '19:00')::timestamptz, (current_date + 17 + time '21:30')::timestamptz, 'Mit Vorstandswahl — stimmberechtigt sind alle Mitglieder ab 16 Jahren', null, 'club');

insert into app.event_teams (club_id, event_id, team_id)
select 'c1ab0000-0000-4000-8000-000000000001', v.event_id::uuid, v.team_id::uuid
from (values
  ('e0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000002'),
  ('e0000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000003'),
  ('e0000000-0000-4000-8000-000000000003', 'b0000000-0000-4000-8000-000000000001'),
  ('e0000000-0000-4000-8000-000000000004', 'b0000000-0000-4000-8000-000000000002'),
  ('e0000000-0000-4000-8000-000000000005', 'b0000000-0000-4000-8000-000000000003'),
  ('e0000000-0000-4000-8000-000000000006', 'b0000000-0000-4000-8000-000000000001'),
  ('e0000000-0000-4000-8000-000000000007', 'b0000000-0000-4000-8000-000000000002'),
  ('e0000000-0000-4000-8000-000000000008', 'b0000000-0000-4000-8000-000000000003'),
  ('e0000000-0000-4000-8000-000000000009', 'b0000000-0000-4000-8000-000000000001'),
  ('e0000000-0000-4000-8000-000000000009', 'b0000000-0000-4000-8000-000000000002'),
  ('e0000000-0000-4000-8000-000000000009', 'b0000000-0000-4000-8000-000000000003'),
  ('e0000000-0000-4000-8000-000000000010', 'b0000000-0000-4000-8000-000000000001'),
  ('e0000000-0000-4000-8000-000000000011', 'b0000000-0000-4000-8000-000000000002'),
  ('e0000000-0000-4000-8000-000000000011', 'b0000000-0000-4000-8000-000000000003'),
  ('e0000000-0000-4000-8000-000000000012', 'b0000000-0000-4000-8000-000000000002'),
  ('e0000000-0000-4000-8000-000000000012', 'b0000000-0000-4000-8000-000000000003'),
  ('e0000000-0000-4000-8000-000000000013', 'b0000000-0000-4000-8000-000000000002'),
  -- e-14 (Sommerfest) und e-16 (Jahreshauptversammlung) stehen BEWUSST nicht
  -- hier: sie sind audience='club'. Eine Vereinsveranstaltung MIT Team-Zeile
  -- weist app.protect_event_teams_audience (0050) mit 23514 zurueck — die
  -- Zielgruppe ist die eine Wahrheit, die Team-Zuordnung waere die zweite.
  ('e0000000-0000-4000-8000-000000000015', 'b0000000-0000-4000-8000-000000000003')
) as v(event_id, team_id);

-- ----------------------------------------------------------------------------
-- RSVPs (mock: e-06 4×, e-07 5×, e-08 6×, e-09 3×, e-11 3×, e-12 7× = 28)
-- ----------------------------------------------------------------------------
insert into app.event_rsvps (club_id, event_id, member_id, status, comment, responded_at)
select 'c1ab0000-0000-4000-8000-000000000001', v.event_id::uuid, v.member_id::uuid,
       v.status::app.rsvp_status, v.comment, v.responded_at
from (values
  -- e-06 (today, Minis)
  ('e0000000-0000-4000-8000-000000000006', 'a0000000-0000-4000-8000-000000000008', 'going',    null,                                    (current_date - 1 + time '09:12')::timestamptz),
  ('e0000000-0000-4000-8000-000000000006', 'a0000000-0000-4000-8000-000000000011', 'going',    null,                                    (current_date - 1 + time '12:40')::timestamptz),
  ('e0000000-0000-4000-8000-000000000006', 'a0000000-0000-4000-8000-000000000020', 'sick',     'Erkältung, morgen wieder dabei',        (current_date + time '08:05')::timestamptz),
  ('e0000000-0000-4000-8000-000000000006', 'a0000000-0000-4000-8000-000000000024', 'maybe',    null,                                    (current_date + time '07:55')::timestamptz),
  -- e-07 (+1, Nachwuchs)
  ('e0000000-0000-4000-8000-000000000007', 'a0000000-0000-4000-8000-000000000007', 'going',    null,                                    (current_date - 1 + time '19:02')::timestamptz),
  ('e0000000-0000-4000-8000-000000000007', 'a0000000-0000-4000-8000-000000000010', 'going',    null,                                    (current_date - 1 + time '20:15')::timestamptz),
  ('e0000000-0000-4000-8000-000000000007', 'a0000000-0000-4000-8000-000000000013', 'going',    null,                                    (current_date + time '06:48')::timestamptz),
  ('e0000000-0000-4000-8000-000000000007', 'a0000000-0000-4000-8000-000000000015', 'going',    null,                                    (current_date + time '07:21')::timestamptz),
  ('e0000000-0000-4000-8000-000000000007', 'a0000000-0000-4000-8000-000000000019', 'declined', 'Klassenfahrt bis Freitag',              (current_date - 2 + time '17:30')::timestamptz),
  -- e-08 (+2, Kürgruppe)
  ('e0000000-0000-4000-8000-000000000008', 'a0000000-0000-4000-8000-000000000016', 'going',    null,                                    (current_date + time '09:00')::timestamptz),
  ('e0000000-0000-4000-8000-000000000008', 'a0000000-0000-4000-8000-000000000017', 'going',    null,                                    (current_date + time '09:05')::timestamptz),
  ('e0000000-0000-4000-8000-000000000008', 'a0000000-0000-4000-8000-000000000018', 'going',    null,                                    (current_date + time '10:11')::timestamptz),
  ('e0000000-0000-4000-8000-000000000008', 'a0000000-0000-4000-8000-000000000021', 'going',    null,                                    (current_date + time '11:45')::timestamptz),
  ('e0000000-0000-4000-8000-000000000008', 'a0000000-0000-4000-8000-000000000022', 'maybe',    'Zahnarzttermin, ich beeile mich',       (current_date + time '12:02')::timestamptz),
  ('e0000000-0000-4000-8000-000000000008', 'a0000000-0000-4000-8000-000000000023', 'going',    null,                                    (current_date + time '13:37')::timestamptz),
  -- e-09 (+3, Elternabend)
  ('e0000000-0000-4000-8000-000000000009', 'a0000000-0000-4000-8000-000000000009', 'going',    null,                                    (current_date - 1 + time '21:00')::timestamptz),
  ('e0000000-0000-4000-8000-000000000009', 'a0000000-0000-4000-8000-000000000012', 'going',    null,                                    (current_date - 1 + time '21:30')::timestamptz),
  ('e0000000-0000-4000-8000-000000000009', 'a0000000-0000-4000-8000-000000000014', 'declined', 'Spätschicht — Protokoll wäre super',    (current_date + time '14:20')::timestamptz),
  -- e-11 (+6, Generalprobe)
  ('e0000000-0000-4000-8000-000000000011', 'a0000000-0000-4000-8000-000000000016', 'going',    null,                                    (current_date + time '15:00')::timestamptz),
  ('e0000000-0000-4000-8000-000000000011', 'a0000000-0000-4000-8000-000000000017', 'going',    null,                                    (current_date + time '15:03')::timestamptz),
  ('e0000000-0000-4000-8000-000000000011', 'a0000000-0000-4000-8000-000000000023', 'going',    null,                                    (current_date + time '16:40')::timestamptz),
  -- e-12 (+9, Bezirksmeisterschaft)
  ('e0000000-0000-4000-8000-000000000012', 'a0000000-0000-4000-8000-000000000016', 'going',    null,                                    (current_date - 4 + time '18:00')::timestamptz),
  ('e0000000-0000-4000-8000-000000000012', 'a0000000-0000-4000-8000-000000000017', 'going',    null,                                    (current_date - 4 + time '18:30')::timestamptz),
  ('e0000000-0000-4000-8000-000000000012', 'a0000000-0000-4000-8000-000000000018', 'going',    null,                                    (current_date - 3 + time '09:15')::timestamptz),
  ('e0000000-0000-4000-8000-000000000012', 'a0000000-0000-4000-8000-000000000021', 'going',    null,                                    (current_date - 3 + time '10:40')::timestamptz),
  ('e0000000-0000-4000-8000-000000000012', 'a0000000-0000-4000-8000-000000000023', 'going',    null,                                    (current_date - 2 + time '08:50')::timestamptz),
  ('e0000000-0000-4000-8000-000000000012', 'a0000000-0000-4000-8000-000000000007', 'going',    null,                                    (current_date - 2 + time '16:22')::timestamptz),
  ('e0000000-0000-4000-8000-000000000012', 'a0000000-0000-4000-8000-000000000010', 'maybe',    'Warten noch auf den Arzttermin',        (current_date - 1 + time '11:05')::timestamptz)
) as v(event_id, member_id, status, comment, responded_at);

-- ----------------------------------------------------------------------------
-- Attendance of the two most recent past trainings (mock: 11 rows)
-- ----------------------------------------------------------------------------
insert into app.attendance (club_id, event_id, member_id, status, checked_in_at)
select 'c1ab0000-0000-4000-8000-000000000001', v.event_id::uuid, v.member_id::uuid,
       v.status::app.attendance_status, v.checked_in_at
from (values
  ('e0000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000007', 'present', (current_date - 3 + time '16:55')::timestamptz),
  ('e0000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000010', 'present', (current_date - 3 + time '16:58')::timestamptz),
  ('e0000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000013', 'late',    (current_date - 3 + time '17:12')::timestamptz),
  ('e0000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000015', 'present', (current_date - 3 + time '16:52')::timestamptz),
  ('e0000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000019', 'excused', null),
  ('e0000000-0000-4000-8000-000000000005', 'a0000000-0000-4000-8000-000000000016', 'present', (current_date - 1 + time '18:25')::timestamptz),
  ('e0000000-0000-4000-8000-000000000005', 'a0000000-0000-4000-8000-000000000017', 'present', (current_date - 1 + time '18:26')::timestamptz),
  ('e0000000-0000-4000-8000-000000000005', 'a0000000-0000-4000-8000-000000000018', 'present', (current_date - 1 + time '18:24')::timestamptz),
  ('e0000000-0000-4000-8000-000000000005', 'a0000000-0000-4000-8000-000000000021', 'absent',  null),
  ('e0000000-0000-4000-8000-000000000005', 'a0000000-0000-4000-8000-000000000022', 'present', (current_date - 1 + time '18:31')::timestamptz),
  ('e0000000-0000-4000-8000-000000000005', 'a0000000-0000-4000-8000-000000000023', 'present', (current_date - 1 + time '18:20')::timestamptz)
) as v(event_id, member_id, status, checked_in_at);

-- ----------------------------------------------------------------------------
-- Media assets: one audio file per routine (metadata only — Blueprint §4)
-- ----------------------------------------------------------------------------
insert into app.media_assets (id, club_id, bucket, storage_path, mime_type, size_bytes, sha256, duration_ms, waveform_peaks, created_by)
select v.id::uuid, 'c1ab0000-0000-4000-8000-000000000001', 'routine-audio', v.path, 'audio/mpeg',
       v.size_bytes, encode(sha256(('rsm2-demo-' || v.path)::bytea), 'hex'), v.duration_ms,
       pg_temp.waveform_peaks(v.seed), '90000000-0000-4000-8000-000000000001'
from (values
  ('aa000000-0000-4000-8000-000000000001', 'clubs/rsv-neckarsulm/routines/feuervogel.mp3',      3612000::bigint, 150000::bigint, 101),
  ('aa000000-0000-4000-8000-000000000002', 'clubs/rsv-neckarsulm/routines/mondlicht.mp3',       3958000::bigint, 165000::bigint, 202),
  ('aa000000-0000-4000-8000-000000000003', 'clubs/rsv-neckarsulm/routines/sommerregen.mp3',     3324000::bigint, 138000::bigint, 303),
  ('aa000000-0000-4000-8000-000000000004', 'clubs/rsv-neckarsulm/routines/tanz-der-funken.mp3', 4130000::bigint, 172000::bigint, 404),
  ('aa000000-0000-4000-8000-000000000005', 'clubs/rsv-neckarsulm/routines/kleine-welle.mp3',    2890000::bigint, 120000::bigint, 505),
  ('aa000000-0000-4000-8000-000000000006', 'clubs/rsv-neckarsulm/routines/nordwind.mp3',        3801000::bigint, 158000::bigint, 606)
) as v(id, path, size_bytes, duration_ms, seed);

-- ----------------------------------------------------------------------------
-- Routines (Küren, mock r-01 … r-06) + skaters
-- ----------------------------------------------------------------------------
insert into app.routines (id, club_id, team_id, title, status, category, music_title, music_artist, music_bpm, music_duration_ms, audio_asset_id) values
  ('d0000000-0000-4000-8000-000000000001', 'c1ab0000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000003', 'Feuervogel',      'competition', 'Jugend Kür A',              'L''Oiseau de feu (Finale)',            'Igor Strawinsky',                92, 150000, 'aa000000-0000-4000-8000-000000000001'),
  ('d0000000-0000-4000-8000-000000000002', 'c1ab0000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000003', 'Mondlicht',       'competition', 'Junioren Kür',              'Clair de Lune',                        'Claude Debussy',                 66, 165000, 'aa000000-0000-4000-8000-000000000002'),
  ('d0000000-0000-4000-8000-000000000003', 'c1ab0000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000003', 'Sommerregen',     'ready',       'Jugend Kür B',              'Riders on the Storm (Instrumental)',   'The Doors',                     104, 138000, 'aa000000-0000-4000-8000-000000000003'),
  ('d0000000-0000-4000-8000-000000000004', 'c1ab0000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000003', 'Tanz der Funken', 'ready',       'Paarlauf Nachwuchs',        'Danse Macabre',                        'Camille Saint-Saëns',           112, 172000, 'aa000000-0000-4000-8000-000000000004'),
  ('d0000000-0000-4000-8000-000000000005', 'c1ab0000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000002', 'Kleine Welle',    'draft',       'Schüler Pflichtkür',        'Die Moldau (Ausschnitt)',              'Bedřich Smetana',                80, 120000, 'aa000000-0000-4000-8000-000000000005'),
  ('d0000000-0000-4000-8000-000000000006', 'c1ab0000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000003', 'Nordwind',        'archived',    'Junioren Kür (Saison 2025)', 'Storm',                               'Antonio Vivaldi / Neuarrangement', 120, 158000, 'aa000000-0000-4000-8000-000000000006');

insert into app.routine_skaters (club_id, routine_id, member_id)
select 'c1ab0000-0000-4000-8000-000000000001', v.routine_id::uuid, v.member_id::uuid
from (values
  ('d0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000016'),
  ('d0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000018'),
  -- Katrin (a-09, plain member) skatet die Junioren-Kür mit — Basis für den
  -- Privacy-Test "Mitglied sieht NUR die eigene Kür" (+ eigenen Kreispokal-Score).
  ('d0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000009'),
  ('d0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000017'),
  ('d0000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000021'),
  ('d0000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000022'),
  ('d0000000-0000-4000-8000-000000000005', 'a0000000-0000-4000-8000-000000000007'),
  ('d0000000-0000-4000-8000-000000000006', 'a0000000-0000-4000-8000-000000000023')
) as v(routine_id, member_id);

-- ----------------------------------------------------------------------------
-- Routine markers (mock: 5+4+4+4+2+3 = 22, RollArt element codes)
-- ----------------------------------------------------------------------------
insert into app.routine_markers (club_id, routine_id, time_ms, label, element_code)
select 'c1ab0000-0000-4000-8000-000000000001', v.routine_id::uuid, v.time_ms, v.label, v.element_code
from (values
  ('d0000000-0000-4000-8000-000000000001',  12400, 'Eröffnung Feld',        'StSq'),
  ('d0000000-0000-4000-8000-000000000001',  38200, 'Doppelsalchow',         '2S'),
  ('d0000000-0000-4000-8000-000000000001',  64800, 'Sitzpirouette',         'SSp'),
  ('d0000000-0000-4000-8000-000000000001',  96500, 'Kombination Toeloop',   '2T+1Lo'),
  ('d0000000-0000-4000-8000-000000000001', 132000, 'Schlusspirouette',      'CoSp'),
  ('d0000000-0000-4000-8000-000000000002',  18000, 'Einlauf Diagonale',     null),
  ('d0000000-0000-4000-8000-000000000002',  47500, 'Doppelrittberger',      '2Lo'),
  ('d0000000-0000-4000-8000-000000000002',  88300, 'Waagepirouette',        'CSp'),
  ('d0000000-0000-4000-8000-000000000002', 141700, 'Schrittfolge Finale',   'StSq'),
  ('d0000000-0000-4000-8000-000000000003',   9800, 'Auftakt Regentropfen',  null),
  ('d0000000-0000-4000-8000-000000000003',  42100, 'Einfacher Axel',        '1A'),
  ('d0000000-0000-4000-8000-000000000003',  75400, 'Sitzpirouette',         'SSp'),
  ('d0000000-0000-4000-8000-000000000003', 118900, 'Schlussdrehung',        null),
  ('d0000000-0000-4000-8000-000000000004',  15600, 'Synchronstart',         null),
  ('d0000000-0000-4000-8000-000000000004',  58000, 'Schattenlauf',          'StSq'),
  ('d0000000-0000-4000-8000-000000000004', 104200, 'Parallelpirouette',     'PSp'),
  ('d0000000-0000-4000-8000-000000000004', 155500, 'Hebefigur Finale',      null),
  ('d0000000-0000-4000-8000-000000000005',  22000, 'Erster Bogenlauf',      null),
  ('d0000000-0000-4000-8000-000000000005',  61500, 'Einfacher Salchow',     '1S'),
  ('d0000000-0000-4000-8000-000000000006',  11000, 'Sturmauftakt',          null),
  ('d0000000-0000-4000-8000-000000000006',  49300, 'Doppelflip',            '2F'),
  ('d0000000-0000-4000-8000-000000000006', 127800, 'Schlusspose',           null)
) as v(routine_id, time_ms, label, element_code);

-- ----------------------------------------------------------------------------
-- Score history (mock: 8 scores; c-02 = Kreispokal 21 days ago). The three
-- Kreispokal scores carry a placement (final rank) — they drive the standings
-- demo (GET /competitions/{id}/standings): each Kür ranks in its own category,
-- and the Delta-zur-Vorwertung compares against the routine's previous score.
-- ----------------------------------------------------------------------------
insert into app.routine_scores (club_id, routine_id, competition_id, scored_on, technical_score, components_score, total_score, placement)
select 'c1ab0000-0000-4000-8000-000000000001', v.routine_id::uuid, v.competition_id::uuid, v.scored_on, v.tech, v.comp, v.total, v.placement
from (values
  ('d0000000-0000-4000-8000-000000000001', null,                                     current_date - 140, 21.4, 19.15, 40.55, null::int),
  ('d0000000-0000-4000-8000-000000000001', null,                                     current_date - 70,  22.6, 20.2,  42.8,  null),
  ('d0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000002',   current_date - 21,  23.3, 20.8,  44.1,  2),
  ('d0000000-0000-4000-8000-000000000002', null,                                     current_date - 70,  25.1, 23.4,  48.5,  null),
  ('d0000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000002',   current_date - 21,  24.6, 24.15, 48.75, 1),
  ('d0000000-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000002',   current_date - 21,  18.9, 17.65, 36.55, 3),
  ('d0000000-0000-4000-8000-000000000006', null,                                     current_date - 320, 26.2, 24.9,  51.1,  null),
  ('d0000000-0000-4000-8000-000000000006', null,                                     current_date - 250, 27.0, 25.3,  52.3,  null)
) as v(routine_id, competition_id, scored_on, tech, comp, total, placement);

-- ----------------------------------------------------------------------------
-- Routine shares (Kür-Teilen tokens, kuer-share.html). Two live tokens for the
-- public, unauthenticated token view (GET /public/routines/{token}) plus one
-- revoked and one expired token so the 404-paths are demonstrable from the
-- seed. created_by = Sandra (coach, 90..01 -> her club_members row).
-- ----------------------------------------------------------------------------
insert into app.routine_shares (id, club_id, routine_id, token, created_by_member_id, expires_at, revoked)
select v.id::uuid, 'c1ab0000-0000-4000-8000-000000000001', v.routine_id::uuid, v.token,
       (select id from app.club_members
          where club_id = 'c1ab0000-0000-4000-8000-000000000001'
            and profile_id = '90000000-0000-4000-8000-000000000001' and deleted_at is null limit 1),
       v.expires_at, v.revoked
from (values
  ('f5a00000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001',
   'shr_feuervogel_7Qk2mX9pLtRv3Bd', null::timestamptz, false),
  ('f5a00000-0000-4000-8000-000000000002', 'd0000000-0000-4000-8000-000000000003',
   'shr_sommerregen_Za8Wc1Ne5Yh0Uf', (current_date + 30 + time '12:00')::timestamptz, false),
  ('f5a00000-0000-4000-8000-000000000003', 'd0000000-0000-4000-8000-000000000002',
   'shr_mondlicht_REVOKED_kQ4dP', null, true),
  ('f5a00000-0000-4000-8000-000000000004', 'd0000000-0000-4000-8000-000000000006',
   'shr_nordwind_EXPIRED_9wLmT', (current_date - 2 + time '12:00')::timestamptz, false)
) as v(id, routine_id, token, expires_at, revoked);

-- ----------------------------------------------------------------------------
-- Competition entries (c-01: 8 starters, c-02: 3 starters)
-- ----------------------------------------------------------------------------
insert into app.competition_entries (club_id, competition_id, member_id, routine_id, status)
select 'c1ab0000-0000-4000-8000-000000000001', v.competition_id::uuid, v.member_id::uuid, v.routine_id::uuid, v.status::app.entry_status
from (values
  -- Bezirksmeisterschaft (upcoming)
  ('c0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000016', 'd0000000-0000-4000-8000-000000000001', 'registered'),
  ('c0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000018', 'd0000000-0000-4000-8000-000000000002', 'registered'),
  ('c0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000017', 'd0000000-0000-4000-8000-000000000003', 'registered'),
  ('c0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000021', 'd0000000-0000-4000-8000-000000000004', 'registered'),
  ('c0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000022', 'd0000000-0000-4000-8000-000000000004', 'registered'),
  ('c0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000023', null,                                   'registered'),
  ('c0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000007', null,                                   'registered'),
  ('c0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000010', null,                                   'registered'),
  -- Kreispokal (done)
  ('c0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000016', 'd0000000-0000-4000-8000-000000000001', 'confirmed'),
  ('c0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000017', 'd0000000-0000-4000-8000-000000000003', 'confirmed'),
  ('c0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000018', 'd0000000-0000-4000-8000-000000000002', 'confirmed')
) as v(competition_id, member_id, routine_id, status);

-- ----------------------------------------------------------------------------
-- Invoices (mock i-01 … i-10). The 5 OPEN invoices sum to 38,100 cents
-- = 381.00 EUR — the web mock derives its "Offene Posten" from exactly this.
-- Dunning ladder: 0 open · 1 reminder · 2 = 1st dunning · 3 = 2nd dunning.
-- ----------------------------------------------------------------------------
insert into app.invoices (id, club_id, member_id, number, title, amount_cents, status, dunning_level, issued_on, due_on, paid_at)
select v.id::uuid, 'c1ab0000-0000-4000-8000-000000000001', v.member_id::uuid,
       format('R-%s-%s', extract(year from now())::int, v.num), v.title, v.amount_cents,
       v.status::app.invoice_status, v.dunning_level, v.issued_on, v.due_on, v.paid_at
from (values
  -- open
  ('f0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000009', '0083', 'Vereinsbeitrag Q2 — Familie Grünewald',            8600::bigint, 'open', 2, current_date - 56, current_date - 42, null::timestamptz),
  ('f0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000012', '0084', 'Vereinsbeitrag Q2 — Familie Müller',               8600::bigint, 'open', 1, current_date - 32, current_date - 18, null),
  ('f0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000014', '0090', 'Wettkampfmeldung Bezirksmeisterschaft — Finn',     3500::bigint, 'open', 0, current_date - 8,  current_date + 6,  null),
  ('f0000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000022', '0088', 'Trainingslager Herbst — Anzahlung',               12000::bigint, 'open', 0, current_date - 18, current_date - 4,  null),
  ('f0000000-0000-4000-8000-000000000005', 'a0000000-0000-4000-8000-000000000018', '0071', 'Vereinsbeitrag Q2',                                5400::bigint, 'open', 3, current_date - 77, current_date - 63, null),
  -- paid
  ('f0000000-0000-4000-8000-000000000006', 'a0000000-0000-4000-8000-000000000017', '0080', 'Vereinsbeitrag Q2',                                5400::bigint, 'paid', 0, current_date - 40, current_date - 26, (current_date - 12 + time '10:00')::timestamptz),
  ('f0000000-0000-4000-8000-000000000007', 'a0000000-0000-4000-8000-000000000016', '0081', 'Vereinsbeitrag Q2',                                5400::bigint, 'paid', 0, current_date - 40, current_date - 26, (current_date - 11 + time '10:00')::timestamptz),
  ('f0000000-0000-4000-8000-000000000008', 'a0000000-0000-4000-8000-000000000023', '0082', 'Vereinsbeitrag Q2',                                5400::bigint, 'paid', 0, current_date - 40, current_date - 26, (current_date - 9  + time '10:00')::timestamptz),
  ('f0000000-0000-4000-8000-000000000009', 'a0000000-0000-4000-8000-000000000009', '0089', 'Wettkampfmeldung Bezirksmeisterschaft — Lina',     3500::bigint, 'paid', 0, current_date - 8,  current_date + 6,  (current_date - 7  + time '10:00')::timestamptz),
  ('f0000000-0000-4000-8000-000000000010', 'a0000000-0000-4000-8000-000000000012', '0087', 'Trainingslager Herbst — Anzahlung',               12000::bigint, 'paid', 0, current_date - 18, current_date - 4,  (current_date - 5  + time '10:00')::timestamptz)
) as v(id, member_id, num, title, amount_cents, status, dunning_level, issued_on, due_on, paid_at);

-- keep the number sequence consistent with the highest seeded number (0090)
insert into app.invoice_counters (club_id, year, last_value)
values ('c1ab0000-0000-4000-8000-000000000001', extract(year from now())::int, 90);

-- ----------------------------------------------------------------------------
-- Ledger categories (Kassenbuch-Kategorien, 0013). Income vs. expense buckets
-- the App filters/colours by; the ledger rows below link to them via category_id.
-- ----------------------------------------------------------------------------
insert into app.ledger_categories (id, club_id, name, kind, sort_order)
values
  ('ca100000-0000-4000-8000-000000000001', 'c1ab0000-0000-4000-8000-000000000001', 'Beitrag',   'income',  1),
  ('ca100000-0000-4000-8000-000000000002', 'c1ab0000-0000-4000-8000-000000000001', 'Spende',    'income',  2),
  ('ca100000-0000-4000-8000-000000000003', 'c1ab0000-0000-4000-8000-000000000001', 'Halle',     'expense', 3),
  ('ca100000-0000-4000-8000-000000000004', 'c1ab0000-0000-4000-8000-000000000001', 'Material',  'expense', 4),
  ('ca100000-0000-4000-8000-000000000005', 'c1ab0000-0000-4000-8000-000000000001', 'Sonstiges', 'expense', 5);

-- ----------------------------------------------------------------------------
-- Ledger (cash book, mock l-01 … l-10). Income rows for paid invoices carry
-- the invoice_id and the identical amount (consistency rule of the mocks).
-- category_id (0013) is derived from the legacy free-text category so a few
-- entries carry the structured category too (Beitrag/Halle/Material/Sonstiges).
-- ----------------------------------------------------------------------------
insert into app.ledger_entries (club_id, entry_on, description, counterparty_kind, counterparty_member_id, counterparty_name, amount_cents, category, category_id, invoice_id, created_by)
select 'c1ab0000-0000-4000-8000-000000000001', v.entry_on, v.description, v.kind::app.counterparty_kind,
       v.member_id::uuid, v.name, v.amount_cents, v.category,
       case v.category
         when 'Beiträge'      then 'ca100000-0000-4000-8000-000000000001'::uuid
         when 'Miete'         then 'ca100000-0000-4000-8000-000000000003'::uuid
         when 'Material'      then 'ca100000-0000-4000-8000-000000000004'::uuid
         else                      'ca100000-0000-4000-8000-000000000005'::uuid
       end,
       v.invoice_id::uuid,
       '90000000-0000-4000-8000-000000000003'  -- Beate Schäfer (treasurer)
from (values
  (current_date - 12, 'Vereinsbeitrag Q2 — Johanna Bär',          'person', 'a0000000-0000-4000-8000-000000000017', null,                             5400::bigint,  'Beiträge',       'f0000000-0000-4000-8000-000000000006'),
  (current_date - 11, 'Vereinsbeitrag Q2 — Maja Weiß',            'person', 'a0000000-0000-4000-8000-000000000016', null,                             5400::bigint,  'Beiträge',       'f0000000-0000-4000-8000-000000000007'),
  (current_date - 10, 'Hallenmiete Ballei-Sporthalle Juni',       'org',    null,                                   'Stadt Neckarsulm',             -68000::bigint,  'Miete',          null),
  (current_date - 9,  'Vereinsbeitrag Q2 — Hanna Förster',        'person', 'a0000000-0000-4000-8000-000000000023', null,                             5400::bigint,  'Beiträge',       'f0000000-0000-4000-8000-000000000008'),
  (current_date - 8,  'Musiklizenz Trainingsbetrieb',             'org',    null,                                   'GEMA',                          -4900::bigint,  'Lizenzen',       null),
  (current_date - 7,  'Wettkampfmeldung Lina Grünewald',          'person', 'a0000000-0000-4000-8000-000000000009', null,                             3500::bigint,  'Wettkampf',      'f0000000-0000-4000-8000-000000000009'),
  (current_date - 6,  'Meldegebühren Bezirksmeisterschaft',       'org',    null,                                   'DRIV Bezirk Nord-Württemberg', -21000::bigint,  'Wettkampf',      null),
  (current_date - 5,  'Trainingslager-Anzahlung Familie Müller',  'person', 'a0000000-0000-4000-8000-000000000012', null,                            12000::bigint,  'Trainingslager', 'f0000000-0000-4000-8000-000000000010'),
  (current_date - 4,  'Ersatzrollen und Schleifservice',          'org',    null,                                   'Sportbedarf Schmid',            -8750::bigint,  'Material',       null),
  (current_date - 3,  'SEPA-Lauf Monatsbeiträge Juni',            'org',    null,                                   'SEPA-Sammellauf',               43200::bigint,  'Beiträge',       null)
) as v(entry_on, description, kind, member_id, name, amount_cents, category, invoice_id);

-- ----------------------------------------------------------------------------
-- Dunning log (0013) — audit trail of the two escalated open invoices. Actor
-- is Beate Schäfer (treasurer, member a…-003). f…-001 sits at stage 2, f…-005
-- at stage 3, so the log mirrors how they got there (each a manual approval).
-- ----------------------------------------------------------------------------
insert into app.dunning_log (club_id, invoice_id, from_stage, to_stage, action, actor_member_id, note, created_at)
values
  ('c1ab0000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000001', 1, 2, 'dunning',
   'a0000000-0000-4000-8000-000000000003', '1. Mahnung — Familie Grünewald', now() - interval '9 days'),
  ('c1ab0000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000005', 2, 3, 'dunning',
   'a0000000-0000-4000-8000-000000000003', '2. Mahnung — Vereinsbeitrag Q2', now() - interval '3 days');

-- ----------------------------------------------------------------------------
-- Membership categories (Beitragskategorien, 0014). The club's public fee
-- model: Kind/Jugend/Erwachsen monthly, Passiv yearly. amount_cents = integer
-- cents; period drives how the summary endpoint annualises them.
-- ----------------------------------------------------------------------------
insert into app.membership_categories (id, club_id, name, amount_cents, period, is_active, sort_order)
values
  ('bc100000-0000-4000-8000-000000000001', 'c1ab0000-0000-4000-8000-000000000001', 'Kind',      800::bigint,  'monthly', true, 1),
  ('bc100000-0000-4000-8000-000000000002', 'c1ab0000-0000-4000-8000-000000000001', 'Jugend',   1200::bigint,  'monthly', true, 2),
  ('bc100000-0000-4000-8000-000000000003', 'c1ab0000-0000-4000-8000-000000000001', 'Erwachsen',1800::bigint,  'monthly', true, 3),
  ('bc100000-0000-4000-8000-000000000004', 'c1ab0000-0000-4000-8000-000000000001', 'Passiv',   6000::bigint,  'yearly',  true, 4);

-- ----------------------------------------------------------------------------
-- Member fees (Beitragszuordnung, 0014). Assigns a category to ~10 members for
-- an open-ended window (valid_until null). Two overrides: a hardship rate for
-- Katrin (custom 900) and a board waiver for the treasurer Beate (custom 0).
-- ----------------------------------------------------------------------------
insert into app.member_fees (club_id, member_id, category_id, custom_amount_cents, valid_from, valid_until)
select 'c1ab0000-0000-4000-8000-000000000001', v.member_id::uuid, v.category_id::uuid,
       v.custom_amount_cents, v.valid_from, null
from (values
  ('a0000000-0000-4000-8000-000000000007', 'bc100000-0000-4000-8000-000000000001', null::bigint, date '2021-09-01'),  -- Lina, Kind
  ('a0000000-0000-4000-8000-000000000008', 'bc100000-0000-4000-8000-000000000001', null,          date '2023-03-01'),  -- Emma, Kind
  ('a0000000-0000-4000-8000-000000000010', 'bc100000-0000-4000-8000-000000000002', null,          date '2020-01-15'),  -- Sofia, Jugend
  ('a0000000-0000-4000-8000-000000000011', 'bc100000-0000-4000-8000-000000000001', null,          date '2022-04-01'),  -- Ben, Kind
  ('a0000000-0000-4000-8000-000000000013', 'bc100000-0000-4000-8000-000000000002', null,          date '2021-02-01'),  -- Finn, Jugend
  ('a0000000-0000-4000-8000-000000000009', 'bc100000-0000-4000-8000-000000000003', 900::bigint,   date '2021-09-01'),  -- Katrin, Erwachsen (Härtefall 9,00)
  ('a0000000-0000-4000-8000-000000000012', 'bc100000-0000-4000-8000-000000000003', null,          date '2020-01-15'),  -- Stefanie, Erwachsen
  ('a0000000-0000-4000-8000-000000000014', 'bc100000-0000-4000-8000-000000000003', null,          date '2021-02-01'),  -- Petra, Erwachsen
  ('a0000000-0000-4000-8000-000000000003', 'bc100000-0000-4000-8000-000000000003', 0::bigint,     date '2006-01-10'),  -- Beate, Erwachsen (Vorstand beitragsfrei)
  ('a0000000-0000-4000-8000-000000000002', 'bc100000-0000-4000-8000-000000000004', null,          date '1998-03-15')   -- Jürgen, Passiv
) as v(member_id, category_id, custom_amount_cents, valid_from);

-- ----------------------------------------------------------------------------
-- Family discounts (Familien-Rabatte, 0014). One rebate: ab dem 2. Kind 50 %.
-- ----------------------------------------------------------------------------
insert into app.family_discounts (id, club_id, label, kind, value_numeric, applies_from_child, is_active)
values
  ('fd100000-0000-4000-8000-000000000001', 'c1ab0000-0000-4000-8000-000000000001',
   'Geschwisterrabatt ab dem 2. Kind', 'percent', 50, 2, true);

-- ----------------------------------------------------------------------------
-- SEPA mandates (0014). DATENSCHUTZ: only iban_last4 + reference are stored,
-- never the full IBAN. Three paying guardians/adults, all active.
-- ----------------------------------------------------------------------------
insert into app.sepa_mandates (id, club_id, member_id, mandate_reference, iban_last4, account_holder, signed_on, status)
values
  ('5e9a0000-0000-4000-8000-000000000001', 'c1ab0000-0000-4000-8000-000000000001',
   'a0000000-0000-4000-8000-000000000009', 'RSV-M-2021-0009', '4321', 'Katrin Grünewald',  '2021-09-01', 'active'),
  ('5e9a0000-0000-4000-8000-000000000002', 'c1ab0000-0000-4000-8000-000000000001',
   'a0000000-0000-4000-8000-000000000012', 'RSV-M-2020-0012', '8877', 'Stefanie Müller',   '2020-01-15', 'active'),
  ('5e9a0000-0000-4000-8000-000000000003', 'c1ab0000-0000-4000-8000-000000000001',
   'a0000000-0000-4000-8000-000000000014', 'RSV-M-2021-0014', '1290', 'Petra Köhler',      '2021-02-01', 'active');

-- ----------------------------------------------------------------------------
-- Bank transactions (Bankabgleich, 0015). amount_cents SIGNED: + Eingang /
-- - Ausgang. Three unmatched income rows line up 1:1 with OPEN invoices so the
-- match flow has real candidates (Müller 8600 → inv …002, Finn 3500 → …003,
-- Charlotte 5400 → …005); one outgoing hall rent, one anonymous donation-in,
-- one ignored private transfer. status starts 'unmatched' (the treasurer's inbox).
-- ----------------------------------------------------------------------------
insert into app.bank_transactions (id, club_id, booked_on, amount_cents, purpose, counterparty, status, imported_at)
values
  ('ba000000-0000-4000-8000-000000000001', 'c1ab0000-0000-4000-8000-000000000001',
   current_date - 3,  8600::bigint,  'Vereinsbeitrag Q2 Familie Müller',        'Stefanie Müller',              'unmatched', now() - interval '3 days'),
  ('ba000000-0000-4000-8000-000000000002', 'c1ab0000-0000-4000-8000-000000000001',
   current_date - 3,  3500::bigint,  'Wettkampfmeldung Bezirksmeisterschaft',   'Petra Köhler',                 'unmatched', now() - interval '3 days'),
  ('ba000000-0000-4000-8000-000000000003', 'c1ab0000-0000-4000-8000-000000000001',
   current_date - 2,  5400::bigint,  'Vereinsbeitrag Q2',                       'Charlotte Vogler',             'unmatched', now() - interval '2 days'),
  ('ba000000-0000-4000-8000-000000000004', 'c1ab0000-0000-4000-8000-000000000001',
   current_date - 2, -68000::bigint, 'Hallenmiete Ballei-Sporthalle Juli',      'Stadt Neckarsulm',             'unmatched', now() - interval '2 days'),
  ('ba000000-0000-4000-8000-000000000005', 'c1ab0000-0000-4000-8000-000000000001',
   current_date - 1,  5000::bigint,  'Spende Sommerfest',                       'Familie Weber',                'unmatched', now() - interval '1 day'),
  ('ba000000-0000-4000-8000-000000000006', 'c1ab0000-0000-4000-8000-000000000001',
   current_date - 1,  2500::bigint,  'Private Rückbuchung (kein Vereinsbezug)', 'J. Häberle',                   'ignored',   now() - interval '1 day');

-- ----------------------------------------------------------------------------
-- Donations (Spenden, 0015). receipt_number is race-free per club+year via
-- app.next_donation_receipt_number(); the seed hard-codes SP-<year>-0001…0003
-- and primes the counter to 3 so the next API-created donation gets 0004.
-- Katrin (member …009) and Petra (member …014) have a member link (each sees
-- ONLY their own under RLS); the Weber donation is anonymous (member_id null).
-- ----------------------------------------------------------------------------
insert into app.donations (id, club_id, member_id, donor_name, donor_address, amount_cents, donation_date, receipt_number, purpose, issued_at)
select v.id::uuid, 'c1ab0000-0000-4000-8000-000000000001', v.member_id::uuid,
       v.donor_name, v.donor_address, v.amount_cents, v.donation_date,
       format('SP-%s-%s', extract(year from now())::int, v.num), v.purpose, v.issued_at
from (values
  ('d1a00000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000009',
   'Katrin Grünewald', 'Marktstraße 3, 74172 Neckarsulm', 5000::bigint, current_date - 40, '0001',
   'Förderung Nachwuchsarbeit', (current_date - 38 + time '09:00')::timestamptz),
  ('d1a00000-0000-4000-8000-000000000002', null,
   'Familie Weber', 'Rathausplatz 1, 74172 Neckarsulm', 10000::bigint, current_date - 20, '0002',
   'Spende Sommerfest', null::timestamptz),
  ('d1a00000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000014',
   'Petra Köhler', 'Amorbacher Str. 9, 74172 Neckarsulm', 2500::bigint, current_date - 10, '0003',
   null, null::timestamptz)
) as v(id, member_id, donor_name, donor_address, amount_cents, donation_date, num, purpose, issued_at);

-- keep the receipt sequence consistent with the highest seeded number (0003)
insert into app.donation_receipt_counters (club_id, year, last_value)
values ('c1ab0000-0000-4000-8000-000000000001', extract(year from now())::int, 3);

-- ----------------------------------------------------------------------------
-- Tasks (mock task-01 … task-07)
-- ----------------------------------------------------------------------------
insert into app.tasks (club_id, title, done, due_on, assignee_member_id, competition_id)
select 'c1ab0000-0000-4000-8000-000000000001', v.title, v.done, v.due_on, v.assignee::uuid, v.competition_id::uuid
from (values
  ('Meldeliste an den Ausrichter senden',           false, current_date + 2,  'a0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001'),
  ('Fahrgemeinschaften für Ludwigsburg einteilen',  false, current_date + 6,  'a0000000-0000-4000-8000-000000000004', 'c0000000-0000-4000-8000-000000000001'),
  ('Musik-Sticks prüfen und beschriften',           false, current_date + 7,  'a0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001'),
  ('Hallenmiete Q3 überweisen',                     false, current_date + 12, 'a0000000-0000-4000-8000-000000000003', null),
  ('Kuchenliste fürs Sommerfest anlegen',           false, current_date + 16, 'a0000000-0000-4000-8000-000000000009', null),
  ('Wettkampfkleidung inventarisieren',             true,  null,              'a0000000-0000-4000-8000-000000000005', null),
  ('Urkunden vom Kreispokal einscannen',            true,  null,              'a0000000-0000-4000-8000-000000000004', 'c0000000-0000-4000-8000-000000000002')
) as v(title, done, due_on, assignee, competition_id);

-- ----------------------------------------------------------------------------
-- Product catalog (Spond-style club tiers + personal Pro IAP, ADR-E7)
-- ----------------------------------------------------------------------------
insert into app.products (code, kind, name, description, price_cents, billing_interval, max_members) values
  ('club_tier_s',  'club_license', 'Vereinslizenz S',  'Bis 25 Mitglieder',        900, 'month', 25),
  ('club_tier_m',  'club_license', 'Vereinslizenz M',  'Bis 75 Mitglieder',       2900, 'month', 75),
  ('club_tier_l',  'club_license', 'Vereinslizenz L',  'Bis 200 Mitglieder',      5900, 'month', 200),
  ('personal_pro', 'personal_pro', 'Pro (persönlich)', 'Eigene Küren & Trainings-Audio über das Vereinskontingent hinaus', 499, 'month', null);

-- Beta club is grandfathered via a manual entitlement (ADR-E6: source=manual).
-- metadata carries the state-machine fields (tier/status) that the API writes
-- via applyEntitlementChange(); here we grant the demo club tier 'pro' active so
-- the PRO-gated modules (Galerie & Dokumente, migration 0012 / app.is_club_pro)
-- are usable in the seed. The gate logic itself stays real (club B has NO pro).
insert into app.entitlements (subject_type, subject_id, entitlement, source, product_id, provider_ref, valid_until, metadata)
select 'club', 'c1ab0000-0000-4000-8000-000000000001', 'club_license', 'manual', p.id,
       'beta-grandfather', now() + interval '180 days',
       jsonb_build_object('tier', 'pro', 'status', 'active')
from app.products p
where p.code = 'club_tier_s';

-- ----------------------------------------------------------------------------
-- News (modules batch 1) — 3 announcements by the coaching staff
--   author m-01 = Sandra Vogel (coach), m-02 = Jürgen Häberle (owner)
-- ----------------------------------------------------------------------------
insert into app.news (id, club_id, author_member_id, title, body, is_pinned, published_at)
values
  ('e5a00000-0000-4000-8000-000000000001', 'c1ab0000-0000-4000-8000-000000000001',
   'a0000000-0000-4000-8000-000000000002',
   'Bezirksmeisterschaft in Ludwigsburg',
   'Am kommenden Wochenende starten unsere Läuferinnen und Läufer bei der Bezirksmeisterschaft. Meldeschluss für Fahrgemeinschaften ist Donnerstag — bitte im Team-Chat eintragen. Wir drücken die Daumen!',
   true,  now() - interval '2 days'),
  ('e5a00000-0000-4000-8000-000000000002', 'c1ab0000-0000-4000-8000-000000000001',
   'a0000000-0000-4000-8000-000000000001',
   'Neue Trainingszeiten ab Juli',
   'Ab Juli trainiert die Wettkampfgruppe zusätzlich am Freitagabend von 18 bis 20 Uhr in der Ballei-Sporthalle. Die Anfängergruppe bleibt beim gewohnten Dienstagstermin.',
   false, now() - interval '6 days'),
  ('e5a00000-0000-4000-8000-000000000003', 'c1ab0000-0000-4000-8000-000000000001',
   'a0000000-0000-4000-8000-000000000001',
   'Sommerfest & Vereinsgrillen',
   'Zum Saisonabschluss laden wir alle Familien zum Sommerfest ein. Für Kuchen- und Salatspenden hängt ab nächster Woche eine Liste am schwarzen Brett aus.',
   false, now() - interval '10 days');

-- ----------------------------------------------------------------------------
-- Exercises (modules batch 1) — 5 drills across categories & difficulties
--   created_by m-01 = Sandra Vogel (coach), m-05 = Anna-Lena Böhm (coach)
-- ----------------------------------------------------------------------------
insert into app.exercises
  (club_id, created_by_member_id, name, description, category, difficulty, video_url, instructions, duration_seconds)
values
  ('c1ab0000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001',
   'Einlaufen & Gelenkmobilisation', 'Lockeres Einrollen mit Fußgelenk- und Hüftkreisen zum Warmwerden.',
   'warmup', 1, null, 'Zwei ruhige Runden fahren, dann an der Bande Sprung- und Hüftgelenke mobilisieren.', 600),
  ('c1ab0000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000005',
   'Beinrückseiten-Dehnung', 'Statische Dehnung der hinteren Kette nach dem Training.',
   'stretching', 2, null, 'Gestrecktes Bein auf die Bande, Oberkörper gerade nach vorn, 30 Sekunden halten. Seitenwechsel.', 300),
  ('c1ab0000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001',
   'Ausfallschritt-Kraft', 'Kräftigung der Oberschenkel für stabile Landungen.',
   'strength', 3, null, 'Tiefe Ausfallschritte im Wechsel, Rumpf aufrecht, 3 Sätze à 12 Wiederholungen pro Seite.', 480),
  ('c1ab0000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000005',
   'Waltzsprung-Technik', 'Grundlegender Sprung mit halber Drehung — sauberer Absprung und Landung.',
   'jump', 3, 'https://example.org/videos/waltzsprung.mp4',
   'Vorwärts einfahren, vom Außenbogen abspringen, halbe Drehung, rückwärts auf dem Außenbogen landen.', 240),
  ('c1ab0000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001',
   'Standwaage-Pirouette Kombination', 'Übergang von der Standwaage in eine Aufsprungpirouette.',
   'combination', 5, null, 'Standwaage sauber halten, kontrolliert in die Pirouette eindrehen, Zentrierung halten.', 360);

-- ----------------------------------------------------------------------------
-- Notes (modules batch 1) — STRICTLY PRIVATE, owned by Sandra Vogel (coach,
-- profile 90..01). Nobody else — not even a platform admin — may read these.
-- ----------------------------------------------------------------------------
insert into app.notes (id, owner_profile_id, club_id, title, body)
values
  ('a5e00000-0000-4000-8000-000000000001', '90000000-0000-4000-8000-000000000001',
   'c1ab0000-0000-4000-8000-000000000001',
   'Wettkampf-Vorbereitung Lina',
   'Landung beim Waltzsprung noch unsicher — vor Ludwigsburg gezielt üben. Musikschnitt final abstimmen.'),
  ('a5e00000-0000-4000-8000-000000000002', '90000000-0000-4000-8000-000000000001', null,
   'Materialbestellung',
   'Neue Schleifsteine und zwei Paar Ersatzrollen bestellen. Angebot von Sportbedarf Schmid abwarten.');

-- ----------------------------------------------------------------------------
-- Facilities (modules batch 2) — 3 Hallen/Räume the club trains in
-- ----------------------------------------------------------------------------
insert into app.facilities (id, club_id, name, kind, address, capacity, notes)
values
  ('fac00000-0000-4000-8000-000000000001', 'c1ab0000-0000-4000-8000-000000000001',
   'Ballei-Sporthalle', 'hall', 'Urbanstraße 12, 74172 Neckarsulm', 120,
   'Wettkampftauglicher Boden, Musikanlage vorhanden.'),
  ('fac00000-0000-4000-8000-000000000002', 'c1ab0000-0000-4000-8000-000000000001',
   'Pichterichhalle', 'hall', 'Pichterichstraße 5, 74172 Neckarsulm', 80,
   'Für Anfänger- und Minigruppen, Dienstagnachmittag.'),
  ('fac00000-0000-4000-8000-000000000003', 'c1ab0000-0000-4000-8000-000000000001',
   'Außenbahn Vereinsgelände', 'outdoor', 'Beethovenstraße, 74172 Neckarsulm', null,
   'Nur bei trockenem Wetter, Sommertraining.');

-- ----------------------------------------------------------------------------
-- Facility bookings (modules batch 2) — 4 upcoming bookings, relative to today
--   booked by coaching staff (m-01 Sandra, m-05 Anna-Lena) for their teams
-- ----------------------------------------------------------------------------
insert into app.facility_bookings
  (id, facility_id, club_id, booked_by_member_id, team_id, title, starts_at, ends_at, status)
values
  ('b0c00000-0000-4000-8000-000000000001', 'fac00000-0000-4000-8000-000000000001',
   'c1ab0000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001',
   'b0000000-0000-4000-8000-000000000003', 'Training Kürgruppe Leistung',
   (current_date + 2 + time '18:30')::timestamptz, (current_date + 2 + time '20:30')::timestamptz, 'confirmed'),
  ('b0c00000-0000-4000-8000-000000000002', 'fac00000-0000-4000-8000-000000000002',
   'c1ab0000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000005',
   'b0000000-0000-4000-8000-000000000001', 'Training Minis & Anfänger',
   (current_date + 4 + time '16:00')::timestamptz, (current_date + 4 + time '17:00')::timestamptz, 'confirmed'),
  ('b0c00000-0000-4000-8000-000000000003', 'fac00000-0000-4000-8000-000000000001',
   'c1ab0000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001',
   'b0000000-0000-4000-8000-000000000002', 'Generalprobe Küren',
   (current_date + 6 + time '18:00')::timestamptz, (current_date + 6 + time '20:30')::timestamptz, 'pending'),
  ('b0c00000-0000-4000-8000-000000000004', 'fac00000-0000-4000-8000-000000000003',
   'c1ab0000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000006',
   null, 'Zusatztraining Außenbahn',
   (current_date + 8 + time '17:00')::timestamptz, (current_date + 8 + time '18:30')::timestamptz, 'confirmed');

-- ----------------------------------------------------------------------------
-- Equipment (modules batch 2) — 4 gear items with quantities & condition
-- ----------------------------------------------------------------------------
insert into app.equipment
  (id, club_id, name, category, total_quantity, available_quantity, condition, notes)
values
  ('e9000000-0000-4000-8000-000000000001', 'c1ab0000-0000-4000-8000-000000000001',
   'Leih-Rollschuhe (Gr. 32–40)', 'Rollschuhe', 12, 8, 'good',
   'Schnupperkurs-Bestand, gemischte Größen.'),
  ('e9000000-0000-4000-8000-000000000002', 'c1ab0000-0000-4000-8000-000000000001',
   'Schoner-Sets (Knie/Ellbogen/Hand)', 'Schoner', 10, 10, 'fair',
   'Für Anfänger, teils abgenutzt.'),
  ('e9000000-0000-4000-8000-000000000003', 'c1ab0000-0000-4000-8000-000000000001',
   'Musikanlage mobil', 'Technik', 2, 1, 'good',
   'Für Auswärts-Wettkämpfe, Akku prüfen.'),
  ('e9000000-0000-4000-8000-000000000004', 'c1ab0000-0000-4000-8000-000000000001',
   'Pylonen-Set (rot)', 'Training', 3, 3, 'defect',
   'Ein Set mit Rissen, ersetzen.');

-- ----------------------------------------------------------------------------
-- Equipment reservations (modules batch 2) — 2 borrow records
--   m-05 Anna-Lena (coach, self) borrows skates; m-09 Katrin (member, self)
--   borrows the mobile PA. Reflected in available_quantity above.
-- ----------------------------------------------------------------------------
insert into app.equipment_reservations
  (id, equipment_id, club_id, reserved_by_member_id, quantity, from_at, to_at, status)
values
  ('e9c00000-0000-4000-8000-000000000001', 'e9000000-0000-4000-8000-000000000001',
   'c1ab0000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000005', 4,
   (current_date + 4 + time '15:30')::timestamptz, (current_date + 4 + time '17:30')::timestamptz, 'active'),
  ('e9c00000-0000-4000-8000-000000000002', 'e9000000-0000-4000-8000-000000000003',
   'c1ab0000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000009', 1,
   (current_date + 9 + time '07:00')::timestamptz, (current_date + 9 + time '20:00')::timestamptz, 'active');

-- ----------------------------------------------------------------------------
-- Achievements / medals (modules batch 2) — 6 results across members & medals
--   Awarded to competition skaters; mix of gold/silver/bronze + placements.
-- ----------------------------------------------------------------------------
insert into app.achievements
  (id, club_id, member_id, title, competition_name, placement, medal, achieved_on, note)
values
  ('ac000000-0000-4000-8000-000000000001', 'c1ab0000-0000-4000-8000-000000000001',
   'a0000000-0000-4000-8000-000000000016', 'Jugend Kür A — 1. Platz',
   'Kreispokal Heilbronn', 1, 'gold', current_date - 21, 'Persönliche Bestleistung mit „Feuervogel".'),
  ('ac000000-0000-4000-8000-000000000002', 'c1ab0000-0000-4000-8000-000000000001',
   'a0000000-0000-4000-8000-000000000018', 'Junioren Kür — 2. Platz',
   'Kreispokal Heilbronn', 2, 'silver', current_date - 21, 'Saubere Pirouetten, kleiner Sturzabzug.'),
  ('ac000000-0000-4000-8000-000000000003', 'c1ab0000-0000-4000-8000-000000000001',
   'a0000000-0000-4000-8000-000000000017', 'Jugend Kür B — 3. Platz',
   'Kreispokal Heilbronn', 3, 'bronze', current_date - 21, null),
  ('ac000000-0000-4000-8000-000000000004', 'c1ab0000-0000-4000-8000-000000000001',
   'a0000000-0000-4000-8000-000000000023', 'Nachwuchspokal — 1. Platz',
   'Kreispokal Heilbronn', 1, 'gold', current_date - 21, 'Souveräner Auftritt.'),
  ('ac000000-0000-4000-8000-000000000005', 'c1ab0000-0000-4000-8000-000000000001',
   'a0000000-0000-4000-8000-000000000021', 'Paarlauf Nachwuchs — 2. Platz',
   'Landesmeisterschaft 2025', 2, 'silver', current_date - 250, 'Mit Lukas Öhler im Paarlauf.'),
  ('ac000000-0000-4000-8000-000000000006', 'c1ab0000-0000-4000-8000-000000000001',
   'a0000000-0000-4000-8000-000000000007', 'Teilnahmeurkunde Pflicht',
   'Nachwuchssichtung Stuttgart', 5, null, current_date - 90, 'Erste Wettkampferfahrung, ohne Medaille.');

-- ----------------------------------------------------------------------------
-- Training slots (modules batch 3) — the weekly plan ("Trainingsplan").
-- weekday 0=Mo … 6=So. 5 slots across the week, teams, halls and one coach each.
--   t-01 Minis (coach a-05), t-02 Nachwuchs (coach a-01), t-03 Leistung
--   (coach a-01 / guest a-06). Facilities fac..01 Ballei, fac..02 Pichterich,
--   fac..03 Außenbahn.
-- ----------------------------------------------------------------------------
insert into app.training_slots
  (id, club_id, team_id, weekday, starts_time, ends_time, facility_id, location, coach_member_id, note)
values
  ('7501a000-0000-4000-8000-000000000001', 'c1ab0000-0000-4000-8000-000000000001',
   'b0000000-0000-4000-8000-000000000001', 1, '16:00', '17:00',
   'fac00000-0000-4000-8000-000000000002', null, 'a0000000-0000-4000-8000-000000000005',
   'Minis & Anfänger — Grundlagen'),
  ('7501a000-0000-4000-8000-000000000002', 'c1ab0000-0000-4000-8000-000000000001',
   'b0000000-0000-4000-8000-000000000002', 1, '17:00', '18:30',
   'fac00000-0000-4000-8000-000000000001', null, 'a0000000-0000-4000-8000-000000000001',
   'Nachwuchs Pflicht'),
  ('7501a000-0000-4000-8000-000000000003', 'c1ab0000-0000-4000-8000-000000000001',
   'b0000000-0000-4000-8000-000000000003', 2, '18:30', '20:30',
   'fac00000-0000-4000-8000-000000000001', null, 'a0000000-0000-4000-8000-000000000001',
   'Kürgruppe Leistung — Küren & Sprünge'),
  ('7501a000-0000-4000-8000-000000000004', 'c1ab0000-0000-4000-8000-000000000001',
   'b0000000-0000-4000-8000-000000000002', 4, '17:00', '18:30',
   'fac00000-0000-4000-8000-000000000001', null, 'a0000000-0000-4000-8000-000000000005',
   null),
  ('7501a000-0000-4000-8000-000000000005', 'c1ab0000-0000-4000-8000-000000000001',
   'b0000000-0000-4000-8000-000000000003', 5, '18:00', '20:00',
   'fac00000-0000-4000-8000-000000000003', 'Außenbahn (nur bei trockenem Wetter)',
   'a0000000-0000-4000-8000-000000000006', 'Zusatztraining Wettkampfgruppe');

-- ----------------------------------------------------------------------------
-- Duty requirement (modules batch 3) — one season target for the whole club:
-- 20 Pflichtstunden je Mitglied in der laufenden Saison.
-- ----------------------------------------------------------------------------
insert into app.duty_requirements
  (id, club_id, team_id, member_id, season_label, required_hours, period_start, period_end)
values
  ('d0100000-0000-4000-8000-000000000001', 'c1ab0000-0000-4000-8000-000000000001',
   null, null, 'Saison 2025/2026', 20.00,
   date_trunc('year', current_date)::date, (date_trunc('year', current_date) + interval '1 year - 1 day')::date);

-- ----------------------------------------------------------------------------
-- Duty entries (modules batch 3) — 6 recorded actual hours across members.
-- Mix of kinds and approval state; some approved by staff, some still open.
--   a-09 Katrin (member, self-recorded), a-12 Stefanie (member), a-16/a-17/
--   a-23 skaters, a-05 Anna-Lena (coach helper hours).
-- ----------------------------------------------------------------------------
insert into app.duty_entries
  (id, club_id, member_id, hours, activity_date, kind, note, approved)
values
  ('d0e00000-0000-4000-8000-000000000001', 'c1ab0000-0000-4000-8000-000000000001',
   'a0000000-0000-4000-8000-000000000009', 3.00, current_date - 20, 'helper',
   'Kuchenverkauf beim Kreispokal', true),
  ('d0e00000-0000-4000-8000-000000000002', 'c1ab0000-0000-4000-8000-000000000001',
   'a0000000-0000-4000-8000-000000000012', 2.50, current_date - 20, 'helper',
   'Auf- und Abbau Kreispokal', true),
  ('d0e00000-0000-4000-8000-000000000003', 'c1ab0000-0000-4000-8000-000000000001',
   'a0000000-0000-4000-8000-000000000016', 4.00, current_date - 14, 'competition',
   'Wettkampfbetreuung / Meldetisch', true),
  ('d0e00000-0000-4000-8000-000000000004', 'c1ab0000-0000-4000-8000-000000000001',
   'a0000000-0000-4000-8000-000000000017', 2.00, current_date - 7, 'helper',
   'Hallendienst Freitagstraining', false),
  ('d0e00000-0000-4000-8000-000000000005', 'c1ab0000-0000-4000-8000-000000000001',
   'a0000000-0000-4000-8000-000000000023', 1.50, current_date - 3, 'other',
   'Flyer verteilen fürs Sommerfest', false),
  ('d0e00000-0000-4000-8000-000000000006', 'c1ab0000-0000-4000-8000-000000000001',
   'a0000000-0000-4000-8000-000000000005', 5.00, current_date - 10, 'training',
   'Zusatztraining Wettkampfvorbereitung', true);

-- ----------------------------------------------------------------------------
-- Chat messages (modules batch 4) — one TEAM channel + one DIRECT thread.
--
-- Team channel = Kürgruppe Leistung (team b-03). Senders are members of that
-- team: coach Sandra (a-01), skaters Maja (a-16), Johanna (a-17), Charlotte
-- (a-18). 5 messages in chronological order.
--
-- Direct thread = Sandra Vogel (coach, a-01) <-> Katrin Grünewald (member,
-- a-09). 3 messages. Both carry a profile (90..01 / 90..09) so the DM is
-- readable by exactly these two under RLS.
-- ----------------------------------------------------------------------------
insert into app.chat_messages
  (id, club_id, channel_type, team_id, sender_member_id, recipient_member_id, body, image_url, created_at)
values
  -- team channel (b-03) ------------------------------------------------------
  ('c4a70000-0000-4000-8000-000000000001', 'c1ab0000-0000-4000-8000-000000000001',
   'team', 'b0000000-0000-4000-8000-000000000003',
   'a0000000-0000-4000-8000-000000000001', null,
   'Denkt bitte an die Generalprobe am Wochenende — Musik und Wettkampfkleidung nicht vergessen!', null,
   (current_date - 2 + time '19:05')::timestamptz),
  ('c4a70000-0000-4000-8000-000000000002', 'c1ab0000-0000-4000-8000-000000000001',
   'team', 'b0000000-0000-4000-8000-000000000003',
   'a0000000-0000-4000-8000-000000000016', null,
   'Bin dabei! Soll ich meinen Ersatz-Rollensatz mitbringen?', null,
   (current_date - 2 + time '19:12')::timestamptz),
  ('c4a70000-0000-4000-8000-000000000003', 'c1ab0000-0000-4000-8000-000000000001',
   'team', 'b0000000-0000-4000-8000-000000000003',
   'a0000000-0000-4000-8000-000000000001', null,
   'Gute Idee, Maja. Johanna, klappt es bei dir zeitlich?', null,
   (current_date - 2 + time '19:20')::timestamptz),
  ('c4a70000-0000-4000-8000-000000000004', 'c1ab0000-0000-4000-8000-000000000001',
   'team', 'b0000000-0000-4000-8000-000000000003',
   'a0000000-0000-4000-8000-000000000017', null,
   'Ja, ich bin um 18 Uhr da. Bringe die Übersicht der Sprungfolgen mit.', null,
   (current_date - 1 + time '08:41')::timestamptz),
  ('c4a70000-0000-4000-8000-000000000005', 'c1ab0000-0000-4000-8000-000000000001',
   'team', 'b0000000-0000-4000-8000-000000000003',
   'a0000000-0000-4000-8000-000000000018', null,
   'Super, freue mich! Bis Samstag 🛼', null,
   (current_date - 1 + time '09:03')::timestamptz),
  -- direct thread a-01 <-> a-09 ---------------------------------------------
  ('c4a70000-0000-4000-8000-000000000011', 'c1ab0000-0000-4000-8000-000000000001',
   'direct', null,
   'a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000009',
   'Hallo Katrin, Lina macht beim Waltzsprung tolle Fortschritte. Können wir vor der Bezirksmeisterschaft kurz sprechen?', null,
   (current_date - 3 + time '17:30')::timestamptz),
  ('c4a70000-0000-4000-8000-000000000012', 'c1ab0000-0000-4000-8000-000000000001',
   'direct', null,
   'a0000000-0000-4000-8000-000000000009', 'a0000000-0000-4000-8000-000000000001',
   'Hallo Sandra, sehr gerne! Beim Elternabend am Mittwoch passt es mir gut.', null,
   (current_date - 3 + time '20:58')::timestamptz),
  ('c4a70000-0000-4000-8000-000000000013', 'c1ab0000-0000-4000-8000-000000000001',
   'direct', null,
   'a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000009',
   'Perfekt, dann machen wir das so. Danke dir!', null,
   (current_date - 2 + time '07:15')::timestamptz);

-- ----------------------------------------------------------------------------
-- Check-ins (modules batch 4) — 4 attendance records. Katrin (a-09) owns
-- exactly one (self QR check-in); the other three belong to Kürgruppe skaters
-- (Maja a-16, Johanna a-17 self-QR; Charlotte a-18 manually by the trainer).
-- ----------------------------------------------------------------------------
insert into app.checkins
  (id, club_id, member_id, event_id, method, checked_in_at)
values
  ('c4ec0000-0000-4000-8000-000000000001', 'c1ab0000-0000-4000-8000-000000000001',
   'a0000000-0000-4000-8000-000000000009', 'e0000000-0000-4000-8000-000000000004',
   'qr', (current_date - 3 + time '16:56')::timestamptz),
  ('c4ec0000-0000-4000-8000-000000000002', 'c1ab0000-0000-4000-8000-000000000001',
   'a0000000-0000-4000-8000-000000000016', 'e0000000-0000-4000-8000-000000000005',
   'qr', (current_date - 1 + time '18:24')::timestamptz),
  ('c4ec0000-0000-4000-8000-000000000003', 'c1ab0000-0000-4000-8000-000000000001',
   'a0000000-0000-4000-8000-000000000017', 'e0000000-0000-4000-8000-000000000005',
   'qr', (current_date - 1 + time '18:25')::timestamptz),
  ('c4ec0000-0000-4000-8000-000000000004', 'c1ab0000-0000-4000-8000-000000000001',
   'a0000000-0000-4000-8000-000000000018', 'e0000000-0000-4000-8000-000000000005',
   'manual', (current_date - 1 + time '18:30')::timestamptz);

-- ----------------------------------------------------------------------------
-- Regional events (modules batch 4) — 3 supra-regional events the club tracks.
-- ----------------------------------------------------------------------------
insert into app.regional_events
  (id, club_id, title, host_org, discipline, location, starts_on, ends_on, registration_url, description)
values
  ('4e670000-0000-4000-8000-000000000001', 'c1ab0000-0000-4000-8000-000000000001',
   'Süddeutsche Meisterschaft Rollkunstlauf', 'DRIV Landesverband Baden-Württemberg',
   'Rollkunstlauf', 'Rundsporthalle Ludwigsburg',
   current_date + 42, current_date + 43,
   'https://driv-bw.example.org/meldung/sddm-2026',
   'Qualifikation über die Bezirksmeisterschaften. Meldeschluss vier Wochen vorher, Meldung über den Verein.'),
  ('4e670000-0000-4000-8000-000000000002', 'c1ab0000-0000-4000-8000-000000000001',
   'Deutschland-Pokal Nachwuchs', 'Deutscher Rollsport- und Inline-Verband',
   'Rollkunstlauf', 'Sporthalle am Berg, Freiburg',
   current_date + 90, current_date + 92,
   'https://driv.example.org/deutschlandpokal',
   'Überregionaler Nachwuchswettbewerb der Pflicht- und Kürgruppen.'),
  ('4e670000-0000-4000-8000-000000000003', 'c1ab0000-0000-4000-8000-000000000001',
   'Trainer-Fortbildung Sprungtechnik', 'DRIV Trainerakademie',
   'Rollkunstlauf', 'Landessportschule Albstadt',
   current_date + 21, null,
   'https://driv.example.org/fortbildung/sprungtechnik',
   'Tagesseminar für Übungsleiter und Trainer zu Absprung- und Landetechnik.');

-- ----------------------------------------------------------------------------
-- Gallery items (modules batch 5, PRO) — 3 photos + 1 video clip.
-- storage_key points at the committed demo assets under supabase/seed/media/;
-- the API serve route (GET /media/{key}) falls back to that bundled directory
-- when a key is not in MEDIA_DIR, so seeded rows serve real bytes anywhere.
-- Uploaders: coach Sandra (a-01), owner Jürgen (a-02). Sizes match the files.
-- ----------------------------------------------------------------------------
insert into app.gallery_items
  (id, club_id, album, title, kind, storage_key, content_type, size_bytes, thumbnail_key, uploaded_by_member_id, created_at)
values
  ('6a110000-0000-4000-8000-000000000001', 'c1ab0000-0000-4000-8000-000000000001',
   'Sommerfest 2026', 'Gruppenfoto beim Vereinsgrillen', 'photo',
   'seed-gallery-sommerfest-01.png', 'image/png', 69, null,
   'a0000000-0000-4000-8000-000000000002', now() - interval '9 days'),
  ('6a110000-0000-4000-8000-000000000002', 'c1ab0000-0000-4000-8000-000000000001',
   'Wettkämpfe', 'Siegerehrung Bezirksmeisterschaft', 'photo',
   'seed-gallery-bezirksmeisterschaft-02.png', 'image/png', 69, null,
   'a0000000-0000-4000-8000-000000000001', now() - interval '5 days'),
  ('6a110000-0000-4000-8000-000000000003', 'c1ab0000-0000-4000-8000-000000000001',
   'Training', 'Pirouetten-Training der Kürgruppe', 'photo',
   'seed-gallery-training-03.png', 'image/png', 69, null,
   'a0000000-0000-4000-8000-000000000001', now() - interval '3 days'),
  ('6a110000-0000-4000-8000-000000000004', 'c1ab0000-0000-4000-8000-000000000001',
   'Wettkämpfe', 'Kür-Mitschnitt Charlotte (Ausschnitt)', 'video',
   'seed-gallery-kuer-clip-01.mp4', 'video/mp4', 38, 'seed-gallery-kuer-clip-01-thumb.png',
   'a0000000-0000-4000-8000-000000000001', now() - interval '2 days');

-- ----------------------------------------------------------------------------
-- Documents (modules batch 5, PRO) — 3 club documents across categories.
-- ----------------------------------------------------------------------------
insert into app.documents
  (id, club_id, title, category, storage_key, content_type, size_bytes, uploaded_by_member_id, created_at)
values
  ('d0c00000-0000-4000-8000-000000000001', 'c1ab0000-0000-4000-8000-000000000001',
   'Vereinssatzung 2026', 'Satzung',
   'seed-doc-satzung-2026.pdf', 'application/pdf', 411,
   'a0000000-0000-4000-8000-000000000002', now() - interval '30 days'),
  ('d0c00000-0000-4000-8000-000000000002', 'c1ab0000-0000-4000-8000-000000000001',
   'Hallenordnung Ballei-Sporthalle', 'Ordnung',
   'seed-doc-hallenordnung.pdf', 'application/pdf', 415,
   'a0000000-0000-4000-8000-000000000004', now() - interval '20 days'),
  ('d0c00000-0000-4000-8000-000000000003', 'c1ab0000-0000-4000-8000-000000000001',
   'Elterninfo Sommerfest', 'Elterninfo',
   'seed-doc-elterninfo-sommerfest.pdf', 'application/pdf', 405,
   'a0000000-0000-4000-8000-000000000001', now() - interval '8 days');

-- ----------------------------------------------------------------------------
-- User preferences (app-shell, migration 0016) — one row per login identity.
-- Every dev persona (incl. the platform admin) gets locale de + theme auto and
-- all notification toggles on, so the shell (Einstellungen, Glocke) has data.
-- ----------------------------------------------------------------------------
insert into app.user_preferences (profile_id, locale, theme, notifications)
select p.id, 'de', 'auto',
       '{"events": true, "invoices": true, "news": true, "chat": true}'::jsonb
from app.profiles p
on conflict (profile_id) do nothing;

-- ----------------------------------------------------------------------------
-- Departments (organisation, migration 0017) — 3 Abteilungen with leads.
-- ----------------------------------------------------------------------------
insert into app.departments (id, club_id, name, description, lead_member_id, sort_order) values
  ('d0000000-0000-4000-8000-000000000001', 'c1ab0000-0000-4000-8000-000000000001',
   'Leistungssport', 'Wettkampf- und Kadertraining (Pflicht & Kür).',
   'a0000000-0000-4000-8000-000000000001', 1),   -- lead: Sandra Vogel (coach)
  ('d0000000-0000-4000-8000-000000000002', 'c1ab0000-0000-4000-8000-000000000001',
   'Breitensport', 'Anfänger, Freizeit- und Gesundheitssport.',
   'a0000000-0000-4000-8000-000000000005', 2),   -- lead: Anna-Lena Böhm (coach)
  ('d0000000-0000-4000-8000-000000000003', 'c1ab0000-0000-4000-8000-000000000001',
   'Vorstand', 'Geschäftsführung, Finanzen und Organisation.',
   'a0000000-0000-4000-8000-000000000002', 3);   -- lead: Jürgen Häberle (owner)

-- Department members (n:m)
insert into app.department_members (club_id, department_id, member_id) values
  -- Leistungssport: Sandra (coach), Leonie, Maja, Johanna, Hanna
  ('c1ab0000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001'),
  ('c1ab0000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000015'),
  ('c1ab0000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000016'),
  ('c1ab0000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000017'),
  ('c1ab0000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000023'),
  -- Breitensport: Anna-Lena (coach), Lina, Emma, Sofia, Ben, Nele
  ('c1ab0000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000005'),
  ('c1ab0000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000007'),
  ('c1ab0000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000008'),
  ('c1ab0000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000010'),
  ('c1ab0000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000011'),
  ('c1ab0000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000020'),
  -- Vorstand: Jürgen (owner), Beate (treasurer), Thomas (admin), Petra (moderator)
  ('c1ab0000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000002'),
  ('c1ab0000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000003'),
  ('c1ab0000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000004'),
  ('c1ab0000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000014');

-- ----------------------------------------------------------------------------
-- Lockers (organisation, migration 0017) — 8 Schließfächer: assigned/free/broken.
-- ----------------------------------------------------------------------------
insert into app.lockers (id, club_id, label, location, status, assigned_member_id, note) values
  ('e0c00000-0000-4000-8000-000000000001', 'c1ab0000-0000-4000-8000-000000000001',
   'Fach 01', 'Umkleide A – Reihe 1', 'assigned', 'a0000000-0000-4000-8000-000000000009', null),
  ('e0c00000-0000-4000-8000-000000000002', 'c1ab0000-0000-4000-8000-000000000001',
   'Fach 02', 'Umkleide A – Reihe 1', 'assigned', 'a0000000-0000-4000-8000-000000000016', 'Schlüssel Nr. 2'),
  ('e0c00000-0000-4000-8000-000000000003', 'c1ab0000-0000-4000-8000-000000000001',
   'Fach 03', 'Umkleide A – Reihe 1', 'free', null, null),
  ('e0c00000-0000-4000-8000-000000000004', 'c1ab0000-0000-4000-8000-000000000001',
   'Fach 04', 'Umkleide A – Reihe 2', 'broken', null, 'Schloss defekt – Reparatur beauftragt'),
  ('e0c00000-0000-4000-8000-000000000005', 'c1ab0000-0000-4000-8000-000000000001',
   'Fach 05', 'Umkleide A – Reihe 2', 'assigned', 'a0000000-0000-4000-8000-000000000017', null),
  ('e0c00000-0000-4000-8000-000000000006', 'c1ab0000-0000-4000-8000-000000000001',
   'Fach 06', 'Umkleide B – Reihe 1', 'free', null, null),
  ('e0c00000-0000-4000-8000-000000000007', 'c1ab0000-0000-4000-8000-000000000001',
   'Fach 07', 'Umkleide B – Reihe 1', 'free', null, null),
  ('e0c00000-0000-4000-8000-000000000008', 'c1ab0000-0000-4000-8000-000000000001',
   'Fach 08', 'Umkleide B – Reihe 2', 'broken', 'a0000000-0000-4000-8000-000000000023', 'Tür klemmt – Inhalt noch drin');

-- ----------------------------------------------------------------------------
-- Waitlists (Cluster 6a, migration 0020) — 2 self-join entries: Lina (child)
-- waits for a hall slot, Maja for loan skates. Both queued by the member row.
-- ----------------------------------------------------------------------------
insert into app.waitlists (club_id, member_id, kind, target_id, note, status) values
  ('c1ab0000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000007',
   'facility', 'fac00000-0000-4000-8000-000000000001',
   'Wartet auf einen freien Trainingsplatz in der Ballei-Sporthalle.', 'waiting'),
  ('c1ab0000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000016',
   'equipment', null,
   'Wartet auf ein Paar Leih-Rollschuhe (Größe 38).', 'waiting');

-- ----------------------------------------------------------------------------
-- Budgets (Cluster 6a, migration 0020) — the current-year plan, one row per
-- Kassenbuch category (ledger_categories ca1…-01…05). Plan-vs-Ist is derived
-- against the ledger by GET /reports/budget.
-- ----------------------------------------------------------------------------
insert into app.budgets (club_id, year, category_id, planned_cents, note)
select 'c1ab0000-0000-4000-8000-000000000001', extract(year from now())::int, v.category_id, v.planned_cents, v.note
from (values
  ('ca100000-0000-4000-8000-000000000001'::uuid,  1200000::bigint, 'Geplante Mitgliedsbeiträge'),
  ('ca100000-0000-4000-8000-000000000002'::uuid,    80000::bigint, 'Erwartete Spenden'),
  ('ca100000-0000-4000-8000-000000000003'::uuid,  -900000::bigint, 'Hallenmiete Jahresbudget'),
  ('ca100000-0000-4000-8000-000000000004'::uuid,  -150000::bigint, 'Material & Ausrüstung'),
  ('ca100000-0000-4000-8000-000000000005'::uuid,   -60000::bigint, 'Sonstige Ausgaben')
) as v(category_id, planned_cents, note);

commit;
