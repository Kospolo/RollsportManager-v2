-- ============================================================================
-- 99k_sparten.sql — die Sparten-Ebene (migration 0062).
--
-- Beweist den Schreib-Guard app.can_manage_sparten (Chef-Entscheidung):
--   TRUE  = owner / admin / treasurer / Plattform-Admin
--   FALSE = moderator / coach / member  (moderator BEWUSST draussen!)
-- sowie die Team->Sparte-Zuordnung (Trigger app.protect_team_sparte:
-- setzen/aendern/entfernen nur can_manage_sparten; gleicher-Verein-Integritaet)
-- und das Lesen fuer alle Vereinsmitglieder + Tenant-Isolation.
--
-- Fixtures aus dem Seed (RSV Neckarsulm c1ab..01):
--   owner      Juergen Haeberle   profile 90..02
--   admin      Thomas Krueger     profile 90..04
--   treasurer  Beate Schaefer     profile 90..03
--   moderator  Petra Koehler      profile 90..14
--   coach      Sandra Vogel       profile 90..01
--   member     Katrin Gruenewald  profile 90..09  (aktiv)
--   platform   90..90             (app_metadata.is_platform_admin)
--   Sparte     "Rollkunstlauf"    5a5a..01   · Team Minis  b0..01
-- Verein B (Fixture 01_fixture_club_b): SC Beispielstadt deadbeef-0000-..01,
--   owner Bert deadbeef-9000-..01.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- can_manage_sparten — die Beweismatrix (Boolean -> int; true=1, false=0)
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000002","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"owner"}}', true);
set local role authenticated;
do $$ begin
  perform testkit.is_eq('can_manage_sparten: owner = TRUE',
    (select app.can_manage_sparten('c1ab0000-0000-4000-8000-000000000001'))::int, 1);
end; $$;
rollback;

begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000004","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"admin"}}', true);
set local role authenticated;
do $$ begin
  perform testkit.is_eq('can_manage_sparten: admin = TRUE',
    (select app.can_manage_sparten('c1ab0000-0000-4000-8000-000000000001'))::int, 1);
end; $$;
rollback;

begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000003","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"treasurer"}}', true);
set local role authenticated;
do $$ begin
  perform testkit.is_eq('can_manage_sparten: treasurer = TRUE',
    (select app.can_manage_sparten('c1ab0000-0000-4000-8000-000000000001'))::int, 1);
end; $$;
rollback;

begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000014","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"moderator"}}', true);
set local role authenticated;
do $$ begin
  perform testkit.is_eq('can_manage_sparten: moderator = FALSE (BEWUSST draussen)',
    (select app.can_manage_sparten('c1ab0000-0000-4000-8000-000000000001'))::int, 0);
end; $$;
rollback;

begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000001","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"coach"}}', true);
set local role authenticated;
do $$ begin
  perform testkit.is_eq('can_manage_sparten: coach = FALSE',
    (select app.can_manage_sparten('c1ab0000-0000-4000-8000-000000000001'))::int, 0);
end; $$;
rollback;

begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000009","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"member"}}', true);
set local role authenticated;
do $$ begin
  perform testkit.is_eq('can_manage_sparten: member = FALSE',
    (select app.can_manage_sparten('c1ab0000-0000-4000-8000-000000000001'))::int, 0);
end; $$;
rollback;

begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000090","role":"authenticated","app_metadata":{"is_platform_admin":true}}', true);
set local role authenticated;
do $$ begin
  perform testkit.is_eq('can_manage_sparten: platform admin = TRUE',
    (select app.can_manage_sparten('c1ab0000-0000-4000-8000-000000000001'))::int, 1);
end; $$;
rollback;

-- ---------------------------------------------------------------------------
-- OWNER — darf Sparten anlegen, Sparte-Mitglieder pflegen, Team zuordnen
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000002","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"owner"}}', true);
set local role authenticated;
do $$ begin
  perform testkit.succeeds('owner: MAY create a sparte',
    $q$insert into app.sparten (id, club_id, name, icon, farbe)
       values ('a5a50000-0000-4000-8000-000000000009',
               'c1ab0000-0000-4000-8000-000000000001', 'Eiskunstlauf', 'ice', '#0EA5E9')$q$);
  perform testkit.succeeds('owner: MAY add a member to a sparte',
    $q$insert into app.sparte_members (club_id, sparte_id, member_id)
       values ('c1ab0000-0000-4000-8000-000000000001',
               'a5a50000-0000-4000-8000-000000000009',
               'a0000000-0000-4000-8000-000000000017')$q$);
  -- Team von "Rollkunstlauf" auf die neue Sparte umhaengen (Zuordnung AENDERN)
  perform testkit.affects('owner: MAY reassign a team to another sparte',
    $q$update app.teams set sparte_id = 'a5a50000-0000-4000-8000-000000000009'
        where id = 'b0000000-0000-4000-8000-000000000001'$q$, 1);
  -- soft-delete einer Sparte laeuft ueber die UPDATE-Policy
  perform testkit.affects('owner: MAY soft-delete a sparte',
    $q$update app.sparten set deleted_at = now()
        where id = 'a5a50000-0000-4000-8000-000000000009'$q$, 1);
end; $$;
rollback;

-- ---------------------------------------------------------------------------
-- ADMIN / TREASURER — duerfen ebenfalls Sparten anlegen
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000004","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"admin"}}', true);
set local role authenticated;
do $$ begin
  perform testkit.succeeds('admin: MAY create a sparte',
    $q$insert into app.sparten (club_id, name) values
       ('c1ab0000-0000-4000-8000-000000000001', 'Hockey')$q$);
end; $$;
rollback;

begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000003","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"treasurer"}}', true);
set local role authenticated;
do $$ begin
  perform testkit.succeeds('treasurer: MAY create a sparte',
    $q$insert into app.sparten (club_id, name) values
       ('c1ab0000-0000-4000-8000-000000000001', 'Kunstradfahren')$q$);
end; $$;
rollback;

-- ---------------------------------------------------------------------------
-- MODERATOR — sieht Sparten, darf aber NICHTS schreiben (BEWUSST draussen)
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000014","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"moderator"}}', true);
set local role authenticated;
do $$ begin
  perform testkit.is_eq('moderator: sees the club''s sparte (read = is_club_member)',
    (select count(*) from app.sparten
      where club_id = 'c1ab0000-0000-4000-8000-000000000001'), 1);
  perform testkit.throws('moderator: MAY NOT create a sparte (RLS 42501)',
    $q$insert into app.sparten (club_id, name) values
       ('c1ab0000-0000-4000-8000-000000000001', 'Mod-Sparte')$q$, '42501');
  perform testkit.throws('moderator: MAY NOT add a sparte member (RLS 42501)',
    $q$insert into app.sparte_members (club_id, sparte_id, member_id) values
       ('c1ab0000-0000-4000-8000-000000000001',
        '5a5a0000-0000-4000-8000-000000000001',
        'a0000000-0000-4000-8000-000000000017')$q$, '42501');
  -- moderator DARF Teams pflegen (teams_update), aber NICHT die Sparte aendern
  -- -> der Trigger blockt (42501), nicht die Policy.
  perform testkit.throws('moderator: MAY NOT reassign a team''s sparte (trigger 42501)',
    $q$update app.teams set sparte_id = null
        where id = 'b0000000-0000-4000-8000-000000000001'$q$, '42501');
end; $$;
rollback;

-- ---------------------------------------------------------------------------
-- COACH — kein Sparten-Schreiben; darf Teams pflegen, aber Sparte nicht setzen
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000001","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"coach"}}', true);
set local role authenticated;
do $$ begin
  perform testkit.throws('coach: MAY NOT create a sparte (RLS 42501)',
    $q$insert into app.sparten (club_id, name) values
       ('c1ab0000-0000-4000-8000-000000000001', 'Coach-Sparte')$q$, '42501');
  perform testkit.throws('coach: MAY NOT clear a team''s sparte (trigger 42501)',
    $q$update app.teams set sparte_id = null
        where id = 'b0000000-0000-4000-8000-000000000001'$q$, '42501');
end; $$;
rollback;

-- ---------------------------------------------------------------------------
-- MEMBER — liest Sparten (is_club_member), schreibt nichts
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000009","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"member"}}', true);
set local role authenticated;
do $$ begin
  perform testkit.is_eq('member: sees the club''s sparte',
    (select count(*) from app.sparten), 1);
  perform testkit.is_eq('member: sees the sparte roster (24 = all club members)',
    (select count(*) from app.sparte_members), 24);
  perform testkit.throws('member: MAY NOT create a sparte (RLS 42501)',
    $q$insert into app.sparten (club_id, name) values
       ('c1ab0000-0000-4000-8000-000000000001', 'Member-Sparte')$q$, '42501');
  -- member darf Teams gar nicht schreiben -> RLS USING filtert, 0 Zeilen (kein Fehler)
  perform testkit.affects('member: team-sparte update is silently filtered (0 rows)',
    $q$update app.teams set sparte_id = null
        where id = 'b0000000-0000-4000-8000-000000000001'$q$, 0);
end; $$;
rollback;

-- ---------------------------------------------------------------------------
-- PLATFORM ADMIN — Schreib-Guard schliesst ihn ein (Chef: Super-Admin darf)
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000090","role":"authenticated","app_metadata":{"is_platform_admin":true}}', true);
set local role authenticated;
do $$ begin
  perform testkit.is_eq('platform admin: sees sparten across ALL tenants',
    (select count(distinct club_id) from app.sparten), 1);  -- nur RSV hat Sparten
  perform testkit.succeeds('platform admin: MAY create a sparte',
    $q$insert into app.sparten (club_id, name) values
       ('c1ab0000-0000-4000-8000-000000000001', 'Plattform-Sparte')$q$);
end; $$;
rollback;

-- ---------------------------------------------------------------------------
-- TENANT-ISOLATION + gleicher-Verein-Integritaet (Trigger)
-- ---------------------------------------------------------------------------
begin;
-- als Plattform-Admin eine Sparte in Verein B anlegen (fuer den Cross-Club-Test)
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000090","role":"authenticated","app_metadata":{"is_platform_admin":true}}', true);
set local role authenticated;
insert into app.sparten (id, club_id, name) values
  ('bbbb0000-0000-4000-8000-000000000001', 'deadbeef-0000-4000-8000-000000000001', 'Hockey B');

-- jetzt als RSV-Owner: ein RSV-Team der FREMDEN Sparte zuordnen -> 23514
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000002","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"owner"}}', true);
set local role authenticated;
do $$ begin
  perform testkit.throws('integrity: RSV team MUST NOT get a sparte of club B (23514)',
    $q$update app.teams set sparte_id = 'bbbb0000-0000-4000-8000-000000000001'
        where id = 'b0000000-0000-4000-8000-000000000001'$q$, '23514');
  perform testkit.throws('integrity: unknown sparte id is rejected (23503)',
    $q$update app.teams set sparte_id = '00000000-0000-4000-8000-0000000000ff'
        where id = 'b0000000-0000-4000-8000-000000000001'$q$, '23503');
  -- RSV-Owner sieht die Sparte von Verein B NICHT (Tenant-Isolation)
  perform testkit.is_eq('tenant isolation: RSV owner does not see club B sparten',
    (select count(*) from app.sparten
      where club_id = 'deadbeef-0000-4000-8000-000000000001'), 0);
end; $$;
rollback;

-- ---------------------------------------------------------------------------
-- Eindeutigkeit: Sparte-Name je Verein (case-insensitiv, ohne soft-deletes)
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000002","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"owner"}}', true);
set local role authenticated;
do $$ begin
  -- "rollkunstlauf" kollidiert case-insensitiv mit dem geseedeten "Rollkunstlauf"
  perform testkit.throws('unique: duplicate sparte name per club (case-insensitive) -> 23505',
    $q$insert into app.sparten (club_id, name) values
       ('c1ab0000-0000-4000-8000-000000000001', 'rollkunstlauf')$q$, '23505');
end; $$;
rollback;
