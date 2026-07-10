-- ============================================================================
-- 01_fixture_club_b.sql — second tenant "SC Beispielstadt" (club B).
--
-- The seed ships exactly ONE club, so tenant-isolation tests need a second
-- one with at least one row in EVERY tenant table. Inserted as superuser
-- (fixture setup, not a policy test) and COMMITTED — later suites rely on
-- club B existing. IDs use the deadbeef- prefix; the club id matches the
-- foreign-club token already used by scripts/db-test.sh.
--
-- People:
--   Bert Beispiel  (owner,  profile deadbeef-9000-...-01, member ...-a000-...-01)
--   Paula Probe    (member, profile deadbeef-9000-...-02, member ...-a000-...-02)
--   Clara Probe    (child without account,               member ...-a000-...-03)
--   guardianship: Paula -> Clara
-- ============================================================================

begin;

insert into auth.users (id, email) values
  ('deadbeef-9000-4000-8000-000000000001', 'bert.beispiel@example.org'),
  ('deadbeef-9000-4000-8000-000000000002', 'paula.probe@example.org')
on conflict (id) do nothing;

insert into app.profiles (id, display_name) values
  ('deadbeef-9000-4000-8000-000000000001', 'Bert Beispiel'),
  ('deadbeef-9000-4000-8000-000000000002', 'Paula Probe');

insert into app.clubs (id, name, short_name, city, discipline, join_code) values
  ('deadbeef-0000-4000-8000-000000000001', 'SC Beispielstadt', 'SCB',
   'Beispielstadt', 'Rollkunstlauf', 'SCB-TEST-0001');

insert into app.club_members
  (id, club_id, profile_id, first_name, last_name, role, status, joined_on)
values
  ('deadbeef-a000-4000-8000-000000000001', 'deadbeef-0000-4000-8000-000000000001',
   'deadbeef-9000-4000-8000-000000000001', 'Bert',  'Beispiel', 'owner',  'active', '2020-01-01'),
  ('deadbeef-a000-4000-8000-000000000002', 'deadbeef-0000-4000-8000-000000000001',
   'deadbeef-9000-4000-8000-000000000002', 'Paula', 'Probe',    'member', 'active', '2021-01-01'),
  ('deadbeef-a000-4000-8000-000000000003', 'deadbeef-0000-4000-8000-000000000001',
   null,                                   'Clara', 'Probe',    'member', 'active', '2021-01-01');

insert into app.guardianships (club_id, guardian_member_id, child_member_id, relation) values
  ('deadbeef-0000-4000-8000-000000000001',
   'deadbeef-a000-4000-8000-000000000002',
   'deadbeef-a000-4000-8000-000000000003', 'parent');

insert into app.teams (id, club_id, name, age_group) values
  ('deadbeef-b000-4000-8000-000000000001', 'deadbeef-0000-4000-8000-000000000001',
   'Testgruppe B', 'U12');

insert into app.team_members (club_id, team_id, member_id, role) values
  ('deadbeef-0000-4000-8000-000000000001', 'deadbeef-b000-4000-8000-000000000001',
   'deadbeef-a000-4000-8000-000000000003', 'skater');

insert into app.competitions (id, club_id, name, location, starts_at, ends_at, status) values
  ('deadbeef-c000-4000-8000-000000000001', 'deadbeef-0000-4000-8000-000000000001',
   'Stadtpokal Beispielstadt', 'Halle B',
   (current_date + 30 + time '09:00')::timestamptz,
   (current_date + 30 + time '17:00')::timestamptz, 'upcoming');

insert into app.events (id, club_id, type, title, starts_at, ends_at) values
  ('deadbeef-e000-4000-8000-000000000001', 'deadbeef-0000-4000-8000-000000000001',
   'training', 'Training Testgruppe B',
   (current_date + 1 + time '17:00')::timestamptz,
   (current_date + 1 + time '18:00')::timestamptz);

insert into app.event_teams (club_id, event_id, team_id) values
  ('deadbeef-0000-4000-8000-000000000001', 'deadbeef-e000-4000-8000-000000000001',
   'deadbeef-b000-4000-8000-000000000001');

insert into app.event_rsvps (club_id, event_id, member_id, status) values
  ('deadbeef-0000-4000-8000-000000000001', 'deadbeef-e000-4000-8000-000000000001',
   'deadbeef-a000-4000-8000-000000000003', 'going');

insert into app.attendance (club_id, event_id, member_id, status) values
  ('deadbeef-0000-4000-8000-000000000001', 'deadbeef-e000-4000-8000-000000000001',
   'deadbeef-a000-4000-8000-000000000003', 'present');

insert into app.media_assets (id, club_id, bucket, storage_path, mime_type, size_bytes, duration_ms) values
  ('deadbeef-aa00-4000-8000-000000000001', 'deadbeef-0000-4000-8000-000000000001',
   'routine-audio', 'clubs/sc-beispielstadt/routines/test.mp3', 'audio/mpeg', 1000000, 90000);

insert into app.routines (id, club_id, team_id, title, status, audio_asset_id) values
  ('deadbeef-d000-4000-8000-000000000001', 'deadbeef-0000-4000-8000-000000000001',
   'deadbeef-b000-4000-8000-000000000001', 'Testkuer B', 'draft',
   'deadbeef-aa00-4000-8000-000000000001');

insert into app.routine_skaters (club_id, routine_id, member_id) values
  ('deadbeef-0000-4000-8000-000000000001', 'deadbeef-d000-4000-8000-000000000001',
   'deadbeef-a000-4000-8000-000000000003');

insert into app.routine_markers (club_id, routine_id, time_ms, label) values
  ('deadbeef-0000-4000-8000-000000000001', 'deadbeef-d000-4000-8000-000000000001',
   10000, 'Test marker B');

insert into app.routine_scores (club_id, routine_id, scored_on, technical_score, components_score, total_score) values
  ('deadbeef-0000-4000-8000-000000000001', 'deadbeef-d000-4000-8000-000000000001',
   current_date - 10, 10.0, 9.5, 19.5);

insert into app.competition_entries (club_id, competition_id, member_id, routine_id, status) values
  ('deadbeef-0000-4000-8000-000000000001', 'deadbeef-c000-4000-8000-000000000001',
   'deadbeef-a000-4000-8000-000000000003', 'deadbeef-d000-4000-8000-000000000001', 'registered');

insert into app.invoices (id, club_id, member_id, number, title, amount_cents, status, issued_on, due_on) values
  ('deadbeef-f000-4000-8000-000000000001', 'deadbeef-0000-4000-8000-000000000001',
   'deadbeef-a000-4000-8000-000000000002', 'R-B-0001', 'Beitrag Testfamilie',
   4200, 'open', current_date - 5, current_date + 9);

insert into app.invoice_counters (club_id, year, last_value) values
  ('deadbeef-0000-4000-8000-000000000001', extract(year from now())::int, 1);

insert into app.ledger_entries
  (club_id, entry_on, description, counterparty_kind, counterparty_name, amount_cents, category, created_by)
values
  ('deadbeef-0000-4000-8000-000000000001', current_date - 2, 'Hallenmiete Halle B',
   'org', 'Stadt Beispielstadt', -12300, 'Miete', 'deadbeef-9000-4000-8000-000000000001');

insert into app.tasks (club_id, title, done, assignee_member_id) values
  ('deadbeef-0000-4000-8000-000000000001', 'Testaufgabe B', false,
   'deadbeef-a000-4000-8000-000000000001');

insert into app.entitlements (subject_type, subject_id, entitlement, source, provider_ref) values
  ('club', 'deadbeef-0000-4000-8000-000000000001', 'club_license', 'manual', 'test-fixture-club-b');

commit;
