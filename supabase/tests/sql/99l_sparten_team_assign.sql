-- ============================================================================
-- 99l_sparten_team_assign.sql — die 0062-Luecke und ihr Fix (migration 0063).
--
-- 0062 wollte, dass der KASSENWART (treasurer) ein Team einer Sparte zuordnen
-- darf (Chef-Entscheidung: owner/admin/treasurer/Plattform-Admin). Faktisch
-- konnte er es NICHT: teams_update (0007) fuehrt den treasurer nicht, die
-- Zuordnung wurde von RLS still herausgefiltert (0 Zeilen) — genau die Falle,
-- die 99k fuer den member zeigt, fuer den treasurer aber ungeprueft liess.
--
-- 0063 weitet teams_update um `OR can_manage_sparten` UND schuetzt die Team-
-- Stammdaten im Trigger (Zweig 2). Diese Suite beweist beide Seiten:
--   * treasurer DARF jetzt die Sparte eines Teams setzen/entfernen (affects 1),
--   * treasurer DARF WEITERHIN NICHT Team-Stammdaten aendern (42501),
--   * die Struktur-Rollen (moderator) pflegen Teams unveraendert weiter,
--   * member bleibt still gefiltert (0 Zeilen) — 0063 aendert daran nichts,
--   * Plattform-Admin darf zuordnen.
--
-- Fixtures (Seed): club c1ab..01, Team "Minis" b0..01 (auf Sparte 5a5a..01),
--   treasurer 90..03, moderator 90..14, member 90..09, platform 90..90.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- TREASURER — der eigentliche Fix: darf die Team->Sparte-Zuordnung entfernen
-- und wieder setzen, aber KEINE Stammdaten aendern.
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000003","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"treasurer"}}', true);
set local role authenticated;
do $$ begin
  -- ENTFERNEN (sparte_id = null): vor 0063 still gefiltert (0), jetzt 1 Zeile.
  perform testkit.affects('treasurer: MAY clear a team''s sparte (0063 fix)',
    $q$update app.teams set sparte_id = null
        where id = 'b0000000-0000-4000-8000-000000000001'$q$, 1);
  -- WIEDER SETZEN auf die (eigene) Sparte: erlaubt, Integritaet erfuellt.
  perform testkit.affects('treasurer: MAY (re)assign a team to a sparte of its club',
    $q$update app.teams set sparte_id = '5a5a0000-0000-4000-8000-000000000001'
        where id = 'b0000000-0000-4000-8000-000000000001'$q$, 1);
  -- STAMMDATEN bleiben tabu: Zweig 2 des Triggers blockt (42501).
  perform testkit.throws('treasurer: MAY NOT rename a team (trigger 42501)',
    $q$update app.teams set name = 'Kassenwart-Umbenennung'
        where id = 'b0000000-0000-4000-8000-000000000001'$q$, '42501');
  perform testkit.throws('treasurer: MAY NOT change a team''s age_group (trigger 42501)',
    $q$update app.teams set age_group = 'U99'
        where id = 'b0000000-0000-4000-8000-000000000001'$q$, '42501');
  -- Soft-Delete eines Teams ist Team-Pflege -> ebenfalls tabu fuer den treasurer.
  perform testkit.throws('treasurer: MAY NOT soft-delete a team (trigger 42501)',
    $q$update app.teams set deleted_at = now()
        where id = 'b0000000-0000-4000-8000-000000000001'$q$, '42501');
end; $$;
rollback;

-- ---------------------------------------------------------------------------
-- TREASURER — die Integritaet greift auch fuer ihn: fremde/unbekannte Sparte.
-- ---------------------------------------------------------------------------
begin;
-- als Plattform-Admin eine Sparte in Verein B anlegen
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000090","role":"authenticated","app_metadata":{"is_platform_admin":true}}', true);
set local role authenticated;
insert into app.sparten (id, club_id, name) values
  ('bbbb0000-0000-4000-8000-000000000002', 'deadbeef-0000-4000-8000-000000000001', 'Hockey B2');

select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000003","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"treasurer"}}', true);
set local role authenticated;
do $$ begin
  perform testkit.throws('treasurer: RSV team MUST NOT get a sparte of club B (23514)',
    $q$update app.teams set sparte_id = 'bbbb0000-0000-4000-8000-000000000002'
        where id = 'b0000000-0000-4000-8000-000000000001'$q$, '23514');
  perform testkit.throws('treasurer: unknown sparte id is rejected (23503)',
    $q$update app.teams set sparte_id = '00000000-0000-4000-8000-0000000000fe'
        where id = 'b0000000-0000-4000-8000-000000000001'$q$, '23503');
end; $$;
rollback;

-- ---------------------------------------------------------------------------
-- STRUKTUR-ROLLE (moderator) — Team-Pflege bleibt unveraendert (Zweig 2 laesst
-- Struktur-Rollen durch), die Sparte-Zuordnung bleibt tabu (Zweig 1).
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000014","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"moderator"}}', true);
set local role authenticated;
do $$ begin
  perform testkit.affects('moderator: MAY still rename a team (structure role, Zweig 2 pass)',
    $q$update app.teams set name = 'Minis umbenannt'
        where id = 'b0000000-0000-4000-8000-000000000001'$q$, 1);
  perform testkit.throws('moderator: still MAY NOT change a team''s sparte (Zweig 1, 42501)',
    $q$update app.teams set sparte_id = null
        where id = 'b0000000-0000-4000-8000-000000000001'$q$, '42501');
end; $$;
rollback;

-- ---------------------------------------------------------------------------
-- MEMBER — 0063 aendert nichts: weder Struktur-Rolle noch can_manage_sparten,
-- teams_update filtert weiter still (0 Zeilen).
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000009","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"member"}}', true);
set local role authenticated;
do $$ begin
  perform testkit.affects('member: team-sparte update still silently filtered (0 rows)',
    $q$update app.teams set sparte_id = null
        where id = 'b0000000-0000-4000-8000-000000000001'$q$, 0);
end; $$;
rollback;

-- ---------------------------------------------------------------------------
-- PLATFORM ADMIN — darf zuordnen (can_manage_sparten via is_platform_admin()).
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000090","role":"authenticated","app_metadata":{"is_platform_admin":true}}', true);
set local role authenticated;
do $$ begin
  perform testkit.affects('platform admin: MAY clear a team''s sparte',
    $q$update app.teams set sparte_id = null
        where id = 'b0000000-0000-4000-8000-000000000001'$q$, 1);
end; $$;
rollback;
