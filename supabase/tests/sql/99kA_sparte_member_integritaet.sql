-- ============================================================================
-- 99kA_sparte_member_integritaet.sql — die gleicher-Verein-Integritaet fuer
-- app.sparte_members (migration 0064, FIX 1 / LUECKE 1).
--
-- 0062 liess einen club-owner per direktem SQL ein Mitglied eines FREMDEN
-- Vereins in seine eigene Sparte eintragen (ROWS=1) — der FK auf club_members
-- garantiert nur Existenz, nicht Vereinszugehoerigkeit; die RLS-with_check
-- prueft nur can_manage_sparten(club_id) des EIGENEN Vereins. 0064 ergaenzt den
-- Trigger app.protect_sparte_member: member_id UND sparte_id muessen zum club_id
-- der Zuordnung gehoeren (Verstoss 23514), analog zu protect_team_sparte.
--
-- Fixtures: RSV club c1ab..01, Sparte "Rollkunstlauf" 5a5a..01, owner 90..02,
--   RSV-Mitglied a0..17. Verein B (01_fixture_club_b) deadbeef-0000-..01 mit
--   Mitglied Bert deadbeef-a000-..01 und Plattform-Admin 90..90.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- ANGRIFF — Fremd-Verein-Mitglied in die eigene Sparte haengen. Vor 0064
-- ROWS=1, jetzt 23514 (gleicher-Verein-Integritaet, member-Zweig).
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000002","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"owner"}}', true);
set local role authenticated;
do $$ begin
  perform testkit.throws('integrity: owner MUST NOT add a FOREIGN-club member to his sparte (23514)',
    $q$insert into app.sparte_members (club_id, sparte_id, member_id) values
       ('c1ab0000-0000-4000-8000-000000000001',
        '5a5a0000-0000-4000-8000-000000000001',
        'deadbeef-a000-4000-8000-000000000001')$q$, '23514');
  -- unbekannte member_id -> FK/Existenz (23503)
  perform testkit.throws('integrity: unknown member id is rejected (23503)',
    $q$insert into app.sparte_members (club_id, sparte_id, member_id) values
       ('c1ab0000-0000-4000-8000-000000000001',
        '5a5a0000-0000-4000-8000-000000000001',
        'a0000000-0000-4000-8000-0000000000fe')$q$, '23503');
end; $$;
rollback;

-- ---------------------------------------------------------------------------
-- ANGRIFF #2 — eigenes Mitglied, aber auf eine FREMDE Sparte (club_id = eigen,
-- sparte gehoert Verein B). Jetzt 23514 (sparte-Zweig).
-- ---------------------------------------------------------------------------
begin;
-- Plattform-Admin legt eine Sparte in Verein B an.
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000090","role":"authenticated","app_metadata":{"is_platform_admin":true}}', true);
set local role authenticated;
insert into app.sparten (id, club_id, name) values
  ('bbbb0000-0000-4000-8000-000000000064', 'deadbeef-0000-4000-8000-000000000001', 'Hockey B64');

select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000002","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"owner"}}', true);
set local role authenticated;
do $$ begin
  perform testkit.throws('integrity: own member on a FOREIGN-club sparte is rejected (23514)',
    $q$insert into app.sparte_members (club_id, sparte_id, member_id) values
       ('c1ab0000-0000-4000-8000-000000000001',
        'bbbb0000-0000-4000-8000-000000000064',
        'a0000000-0000-4000-8000-000000000017')$q$, '23514');
end; $$;
rollback;

-- ---------------------------------------------------------------------------
-- LEGITIM — gleicher-Verein-Zuordnung + Soft-Delete + Revive (on conflict).
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000002","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"owner"}}', true);
set local role authenticated;
-- eigene neue Sparte (die geseedete Rollkunstlauf-Sparte hat schon alle Mitglieder)
insert into app.sparten (id, club_id, name) values
  ('a5a50000-0000-4000-8000-000000000064', 'c1ab0000-0000-4000-8000-000000000001', 'Kunstrad 0064');
do $$ begin
  perform testkit.succeeds('legit: owner MAY add a SAME-club member to a sparte',
    $q$insert into app.sparte_members (club_id, sparte_id, member_id) values
       ('c1ab0000-0000-4000-8000-000000000001',
        'a5a50000-0000-4000-8000-000000000064',
        'a0000000-0000-4000-8000-000000000017')$q$);
  -- Soft-Delete der Zuordnung (RLS update-Policy, can_manage_sparten)
  perform testkit.affects('legit: owner MAY soft-delete a sparte membership',
    $q$update app.sparte_members set deleted_at = now()
        where sparte_id = 'a5a50000-0000-4000-8000-000000000064'
          and member_id = 'a0000000-0000-4000-8000-000000000017'$q$, 1);
  -- Revive per on-conflict do update set deleted_at=null (aendert NUR deleted_at
  -- -> der Trigger ueberspringt die Integritaetspruefung, bleibt also heil)
  perform testkit.succeeds('legit: revive via on-conflict (deleted_at=null) still works',
    $q$insert into app.sparte_members (club_id, sparte_id, member_id) values
       ('c1ab0000-0000-4000-8000-000000000001',
        'a5a50000-0000-4000-8000-000000000064',
        'a0000000-0000-4000-8000-000000000017')
       on conflict (sparte_id, member_id) do update set deleted_at = null$q$);
  perform testkit.is_eq('legit: the revived membership is active again',
    (select count(*) from app.sparte_members
      where sparte_id = 'a5a50000-0000-4000-8000-000000000064'
        and member_id = 'a0000000-0000-4000-8000-000000000017'
        and deleted_at is null), 1);
end; $$;
rollback;
