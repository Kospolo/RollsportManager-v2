-- ============================================================================
-- 99lA_teams_immutable.sql — teams.club_id/created_at unveraenderlich
-- (migration 0064, FIX 2 / LUECKE 2).
--
-- 0063 hat teams_update fuer can_manage_sparten geoeffnet (damit der treasurer
-- teams.sparte_id setzen kann). Zweig 2 schuetzte die Stammdaten nur per
-- Positivliste (name/age_group/deleted_at) — created_at und v.a. club_id blieben
-- aenderbar; ein club_id-Wechsel umging zudem die Zweig-1-Integritaet. 0064 macht
-- teams.club_id/created_at UNVERAENDERLICH (23514), akteurunabhaengig (Vorbild
-- club_members). Die Sparte-Zuordnung und die uebrige Team-Pflege bleiben
-- unveraendert (in 99l bereits belegt; hier die Rand-Faelle).
--
-- Fixtures (Seed): club c1ab..01, Team "Minis" b0..01 (Sparte 5a5a..01),
--   owner 90..02, treasurer 90..03, moderator 90..14. Verein B deadbeef-0000-..01.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- TREASURER (can_manage_sparten OHNE Teams-Rolle) — der geoeffnete Pfad.
-- sparte_id darf er weiter setzen/entfernen; club_id/created_at NICHT.
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000003","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"treasurer"}}', true);
set local role authenticated;
do $$ begin
  -- weiterhin erlaubt: Sparte entfernen und (auf eigene Sparte) wieder setzen
  perform testkit.affects('treasurer: MAY still clear a team''s sparte',
    $q$update app.teams set sparte_id = null
        where id = 'b0000000-0000-4000-8000-000000000001'$q$, 1);
  perform testkit.affects('treasurer: MAY still (re)assign a team''s sparte',
    $q$update app.teams set sparte_id = '5a5a0000-0000-4000-8000-000000000001'
        where id = 'b0000000-0000-4000-8000-000000000001'$q$, 1);
  -- NEU 0064: club_id ist unveraenderlich -> Trigger blockt VOR RLS (23514)
  perform testkit.throws('treasurer: MAY NOT move a team to another club (23514)',
    $q$update app.teams set club_id = 'deadbeef-0000-4000-8000-000000000001'
        where id = 'b0000000-0000-4000-8000-000000000001'$q$, '23514');
  -- NEU 0064: created_at ist unveraenderlich -> 23514 (vor 0064: nicht in der
  -- Positivliste, waere also durchgegangen)
  perform testkit.throws('treasurer: MAY NOT change a team''s created_at (23514)',
    $q$update app.teams set created_at = now() - interval '1 year'
        where id = 'b0000000-0000-4000-8000-000000000001'$q$, '23514');
end; $$;
rollback;

-- ---------------------------------------------------------------------------
-- OWNER — die Immutabilitaet gilt AKTEURUNABHAENGIG: auch der owner (volle
-- Team-Rechte) kann club_id/created_at nicht aendern, aber Stammdaten weiter.
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000002","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"owner"}}', true);
set local role authenticated;
do $$ begin
  perform testkit.throws('owner: MAY NOT change a team''s club_id either (23514, actor-independent)',
    $q$update app.teams set club_id = 'deadbeef-0000-4000-8000-000000000001'
        where id = 'b0000000-0000-4000-8000-000000000001'$q$, '23514');
  perform testkit.throws('owner: MAY NOT change a team''s created_at either (23514)',
    $q$update app.teams set created_at = now() - interval '2 years'
        where id = 'b0000000-0000-4000-8000-000000000001'$q$, '23514');
  -- Regression: normale Team-Pflege bleibt fuer den owner unangetastet.
  perform testkit.affects('owner: MAY still rename a team (structure role unchanged)',
    $q$update app.teams set name = 'Minis 0064'
        where id = 'b0000000-0000-4000-8000-000000000001'$q$, 1);
  perform testkit.affects('owner: MAY still change age_group',
    $q$update app.teams set age_group = 'U9'
        where id = 'b0000000-0000-4000-8000-000000000001'$q$, 1);
end; $$;
rollback;

-- ---------------------------------------------------------------------------
-- MODERATOR (Teams-Rolle, NICHT can_manage_sparten) — Team-Pflege unveraendert.
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000014","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"moderator"}}', true);
set local role authenticated;
do $$ begin
  perform testkit.affects('moderator: MAY still rename a team (regression, Zweig 2 pass)',
    $q$update app.teams set name = 'Minis Mod 0064'
        where id = 'b0000000-0000-4000-8000-000000000001'$q$, 1);
  perform testkit.throws('moderator: MAY NOT change a team''s club_id (23514)',
    $q$update app.teams set club_id = 'deadbeef-0000-4000-8000-000000000001'
        where id = 'b0000000-0000-4000-8000-000000000001'$q$, '23514');
end; $$;
rollback;
