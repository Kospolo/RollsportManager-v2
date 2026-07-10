-- ============================================================================
-- seed.sql — RollsportManager v2 demo data (DEV/STAGING ONLY — never prod!)
--
-- Demo club "RSV Neckarsulm", kept 1:1 consistent with the web mock data in
-- apps/web/lib/mock/ :
--   * 24 members (m-01…m-24) covering every club role — owner, admin,
--     moderator (Petra Köhler, m-14), treasurer, coach, guest_coach, member —
--     3 teams, 5 guardianships (3 families)
--   * 1 PLATFORM admin (no club_members row; app_metadata.is_platform_admin)
--   * 15 events relative to today (past trainings with attendance, upcoming
--     trainings with RSVPs, the Bezirksmeisterschaft in 9 days)
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
insert into app.events (id, club_id, type, title, location, starts_at, ends_at, note, competition_id) values
  ('e0000000-0000-4000-8000-000000000001', 'c1ab0000-0000-4000-8000-000000000001', 'training',    'Training Nachwuchs Pflicht',           'Ballei-Sporthalle, Neckarsulm', (current_date - 7 + time '17:00')::timestamptz, (current_date - 7 + time '18:30')::timestamptz, null, null),
  ('e0000000-0000-4000-8000-000000000002', 'c1ab0000-0000-4000-8000-000000000001', 'training',    'Training Kürgruppe Leistung',          'Ballei-Sporthalle, Neckarsulm', (current_date - 6 + time '18:30')::timestamptz, (current_date - 6 + time '20:30')::timestamptz, null, null),
  ('e0000000-0000-4000-8000-000000000003', 'c1ab0000-0000-4000-8000-000000000001', 'training',    'Training Minis & Anfänger',            'Pichterichhalle, Neckarsulm',   (current_date - 5 + time '16:00')::timestamptz, (current_date - 5 + time '17:00')::timestamptz, null, null),
  ('e0000000-0000-4000-8000-000000000004', 'c1ab0000-0000-4000-8000-000000000001', 'training',    'Training Nachwuchs Pflicht',           'Ballei-Sporthalle, Neckarsulm', (current_date - 3 + time '17:00')::timestamptz, (current_date - 3 + time '18:30')::timestamptz, null, null),
  ('e0000000-0000-4000-8000-000000000005', 'c1ab0000-0000-4000-8000-000000000001', 'training',    'Kür-Feinschliff Leistung',             'Ballei-Sporthalle, Neckarsulm', (current_date - 1 + time '18:30')::timestamptz, (current_date - 1 + time '20:30')::timestamptz, 'Schwerpunkt: Sprungkombinationen für die Bezirksmeisterschaft', null),
  ('e0000000-0000-4000-8000-000000000006', 'c1ab0000-0000-4000-8000-000000000001', 'training',    'Training Minis & Anfänger',            'Pichterichhalle, Neckarsulm',   (current_date + 0 + time '16:00')::timestamptz, (current_date + 0 + time '17:00')::timestamptz, null, null),
  ('e0000000-0000-4000-8000-000000000007', 'c1ab0000-0000-4000-8000-000000000001', 'training',    'Training Nachwuchs Pflicht',           'Ballei-Sporthalle, Neckarsulm', (current_date + 1 + time '17:00')::timestamptz, (current_date + 1 + time '18:30')::timestamptz, null, null),
  ('e0000000-0000-4000-8000-000000000008', 'c1ab0000-0000-4000-8000-000000000001', 'training',    'Training Kürgruppe Leistung',          'Ballei-Sporthalle, Neckarsulm', (current_date + 2 + time '18:30')::timestamptz, (current_date + 2 + time '20:30')::timestamptz, null, null),
  ('e0000000-0000-4000-8000-000000000009', 'c1ab0000-0000-4000-8000-000000000001', 'other',       'Elternabend: Saisonplanung',           'Vereinsheim RSV Neckarsulm',    (current_date + 3 + time '19:00')::timestamptz, (current_date + 3 + time '20:30')::timestamptz, null, null),
  ('e0000000-0000-4000-8000-000000000010', 'c1ab0000-0000-4000-8000-000000000001', 'training',    'Training Minis & Anfänger',            'Pichterichhalle, Neckarsulm',   (current_date + 4 + time '16:00')::timestamptz, (current_date + 4 + time '17:00')::timestamptz, null, null),
  ('e0000000-0000-4000-8000-000000000011', 'c1ab0000-0000-4000-8000-000000000001', 'training',    'Generalprobe Küren',                   'Ballei-Sporthalle, Neckarsulm', (current_date + 6 + time '18:00')::timestamptz, (current_date + 6 + time '20:30')::timestamptz, 'Mit Musik und Wettkampfkleidung — Ablauf wie am Wettkampftag', null),
  ('e0000000-0000-4000-8000-000000000012', 'c1ab0000-0000-4000-8000-000000000001', 'competition', 'Bezirksmeisterschaft Rollkunstlauf',   'Rundsporthalle Ludwigsburg',    (current_date + 9 + time '08:30')::timestamptz, (current_date + 9 + time '18:00')::timestamptz, 'Treffpunkt 7:45 Uhr am Vereinsheim, Fahrgemeinschaften bitte eintragen', 'c0000000-0000-4000-8000-000000000001'),
  ('e0000000-0000-4000-8000-000000000013', 'c1ab0000-0000-4000-8000-000000000001', 'training',    'Training Nachwuchs Pflicht',           'Ballei-Sporthalle, Neckarsulm', (current_date + 11 + time '17:00')::timestamptz, (current_date + 11 + time '18:30')::timestamptz, null, null),
  ('e0000000-0000-4000-8000-000000000014', 'c1ab0000-0000-4000-8000-000000000001', 'other',       'Sommerfest mit Schnupperlaufen',       'Vereinsgelände RSV Neckarsulm', (current_date + 23 + time '14:00')::timestamptz, (current_date + 23 + time '20:00')::timestamptz, 'Kuchen-Slots werden im Vereinsleben-Board verteilt', null),
  ('e0000000-0000-4000-8000-000000000015', 'c1ab0000-0000-4000-8000-000000000001', 'training',    'Training Kürgruppe Leistung',          'Ballei-Sporthalle, Neckarsulm', (current_date + 13 + time '18:30')::timestamptz, (current_date + 13 + time '20:30')::timestamptz, null, null);

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
  ('e0000000-0000-4000-8000-000000000014', 'b0000000-0000-4000-8000-000000000001'),
  ('e0000000-0000-4000-8000-000000000014', 'b0000000-0000-4000-8000-000000000002'),
  ('e0000000-0000-4000-8000-000000000014', 'b0000000-0000-4000-8000-000000000003'),
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
-- Score history (mock: 8 scores; c-02 = Kreispokal 21 days ago)
-- ----------------------------------------------------------------------------
insert into app.routine_scores (club_id, routine_id, competition_id, scored_on, technical_score, components_score, total_score)
select 'c1ab0000-0000-4000-8000-000000000001', v.routine_id::uuid, v.competition_id::uuid, v.scored_on, v.tech, v.comp, v.total
from (values
  ('d0000000-0000-4000-8000-000000000001', null,                                     current_date - 140, 21.4, 19.15, 40.55),
  ('d0000000-0000-4000-8000-000000000001', null,                                     current_date - 70,  22.6, 20.2,  42.8),
  ('d0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000002',   current_date - 21,  23.3, 20.8,  44.1),
  ('d0000000-0000-4000-8000-000000000002', null,                                     current_date - 70,  25.1, 23.4,  48.5),
  ('d0000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000002',   current_date - 21,  24.6, 24.15, 48.75),
  ('d0000000-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000002',   current_date - 21,  18.9, 17.65, 36.55),
  ('d0000000-0000-4000-8000-000000000006', null,                                     current_date - 320, 26.2, 24.9,  51.1),
  ('d0000000-0000-4000-8000-000000000006', null,                                     current_date - 250, 27.0, 25.3,  52.3)
) as v(routine_id, competition_id, scored_on, tech, comp, total);

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
-- Ledger (cash book, mock l-01 … l-10). Income rows for paid invoices carry
-- the invoice_id and the identical amount (consistency rule of the mocks).
-- ----------------------------------------------------------------------------
insert into app.ledger_entries (club_id, entry_on, description, counterparty_kind, counterparty_member_id, counterparty_name, amount_cents, category, invoice_id, created_by)
select 'c1ab0000-0000-4000-8000-000000000001', v.entry_on, v.description, v.kind::app.counterparty_kind,
       v.member_id::uuid, v.name, v.amount_cents, v.category, v.invoice_id::uuid,
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

-- Beta club is grandfathered via a manual entitlement (ADR-E6: source=manual)
insert into app.entitlements (subject_type, subject_id, entitlement, source, product_id, provider_ref, valid_until)
select 'club', 'c1ab0000-0000-4000-8000-000000000001', 'club_license', 'manual', p.id,
       'beta-grandfather', now() + interval '180 days'
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

commit;
