-- ============================================================================
-- 93c_rbac_view_isolation.sql — die Test-BLINDSTELLE, durch die der
-- team_coaches-Bypass gekommen ist (Phase 2, Schritt 1 / Migration 0027).
--
-- ### Warum 94_rbac_escalation.sql das Loch nicht sehen konnte ###
-- 94:171-190 fragt app.team_coaches als LEGITIMER OWNER ab. Dort haette die RLS
-- von app.team_members ohnehin keine Zeile gefiltert — der Test war also auch
-- mit kaputter View gruen. Ein Bypass zeigt sich ausschliesslich gegenueber
-- jemandem, der NICHTS sehen darf. Genau das prueft diese Datei.
--
-- Vor 0027 (gegen rsm2-pg-dev reproduziert, Person ohne jede Mitgliedschaft):
--   select app.team_coaches -> 5 Zeilen · update -> UPDATE 5 · delete -> DELETE 5
--   (danach 0 coach-Zeilen in app.team_members — HARTES, mandantenfremdes
--   Loeschen durch eine voellig unbeteiligte Person).
-- Nach 0027 muss all das 0 bzw. 42501 sein.
--
-- Personas: Katrin m-09 (member club A, 90..09) · Bert (owner club B,
-- deadbeef-9000-..-01, Fixture 01_fixture_club_b.sql).
-- Seed club A: 5 Trainer-Zuordnungen (= die Zahl aus 94:179).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- A) DER KERN: eine Person mit gueltigem Token und KEINER Mitgliedschaft.
--    Sie darf die View weder lesen noch beschreiben.
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claims',
  '{"sub":"99999999-0000-4000-8000-0000000000ff","role":"authenticated","club_roles":{}}',
  true);
set local role authenticated;

do $$
begin
  -- Kontrolle: so verhaelt sich die Basistabelle (RLS greift) — 0.
  perform testkit.is_eq('view-isolation: Fremde sieht 0 Zeilen in app.team_members (Kontrolle)',
    (select count(*) from app.team_members), 0);

  -- Der eigentliche Beweis: die VIEW muss sich genauso verhalten.
  -- Vor 0027 stand hier 5 -> mandantenuebergreifender Lese-Bypass.
  perform testkit.is_eq('view-isolation: Fremde sieht 0 Zeilen in app.team_coaches (war 5)',
    (select count(*) from app.team_coaches), 0);

  -- Schreiben ist auf der View entzogen (0027): die Basistabelle hat bewusst
  -- KEINE delete-Policy, ueber die View war HARTES Loeschen moeglich.
  perform testkit.throws('view-isolation: Fremde darf nicht in die View schreiben',
    $q$insert into app.team_coaches (club_id, team_id, member_id)
       values ('c1ab0000-0000-4000-8000-000000000001',
               'b0000000-0000-4000-8000-000000000002',
               'a0000000-0000-4000-8000-000000000001')$q$, '42501');
  perform testkit.throws('view-isolation: Fremde darf die View nicht aendern (war UPDATE 5)',
    $q$update app.team_coaches set member_id = member_id$q$, '42501');
  perform testkit.throws('view-isolation: Fremde darf die View nicht loeschen (war DELETE 5)',
    $q$delete from app.team_coaches$q$, '42501');
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- B) GEGENPROBE: wer die Zeilen sehen darf, sieht sie weiterhin.
--    0027 darf ausschliesslich dem etwas nehmen, der es nie durfte.
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000009","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"member"}}',
  true);
set local role authenticated;

do $$
begin
  perform testkit.is_eq('view-isolation: Katrin (member) sieht die 5 Trainer-Zuordnungen weiterhin',
    (select count(*) from app.team_coaches
      where club_id = 'c1ab0000-0000-4000-8000-000000000001'), 5);
  -- Schreiben ist auch fuer Mitglieder entzogen — Schreibpfad ist team_members.
  perform testkit.throws('view-isolation: auch das Mitglied schreibt nicht ueber die View',
    $q$delete from app.team_coaches$q$, '42501');
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- C) MANDANTENTRENNUNG: der Owner des ANDEREN Vereins sieht nichts aus A.
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claims',
  '{"sub":"deadbeef-9000-4000-8000-000000000001","role":"authenticated","club_roles":{"deadbeef-0000-4000-8000-000000000001":"owner"}}',
  true);
set local role authenticated;

do $$
begin
  perform testkit.is_eq('view-isolation: Owner Verein B sieht 0 Trainer-Zuordnungen aus Verein A',
    (select count(*) from app.team_coaches
      where club_id = 'c1ab0000-0000-4000-8000-000000000001'), 0);
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- D) DER STOLPERDRAHT als Test: keine View in app ohne security_invoker.
--    0001:41-43 grantet authenticated automatisch DML auf JEDE neue Tabelle
--    UND View in app. Eine View ohne security_invoker laeuft mit den Rechten
--    ihres Eigentuemers (postgres) -> jede kuenftige View waere per
--    Konstruktion wieder ein RLS-Bypass. Diese Assertion faellt dann sofort.
-- ---------------------------------------------------------------------------
begin;
do $$
declare
  v_bad text;
begin
  select string_agg(c.relname, ', ') into v_bad
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'app'
    and c.relkind = 'v'
    and coalesce((select option_value
                  from pg_options_to_table(c.reloptions)
                  where option_name = 'security_invoker'), 'false') <> 'true';

  if v_bad is not null then
    perform testkit.fail('view-isolation: keine View in app ohne security_invoker',
      format('RLS-Bypass durch: %s', v_bad));
  end if;
  perform testkit.ok('view-isolation: keine View in app ohne security_invoker');
end;
$$;
rollback;
