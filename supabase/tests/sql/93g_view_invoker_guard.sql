-- ============================================================================
-- 93g_view_invoker_guard.sql — der Stolperdraht, diesmal BEWIESEN.
--
-- WARUM DIESE DATEI (und warum 93c nicht reicht)
-- ---------------------------------------------------------------------------
-- 93c:99-123 behauptet "keine View in app ohne security_invoker" — und das
-- stimmt auch. Was 93c NIE prueft: ob die Kontrolle ueberhaupt ROT werden
-- KANN. Waere die Erkennung kaputt (falscher Optionsname, falsches relkind,
-- falsches Schema), bliebe 93c fuer immer gruen und schuetzte NICHTS.
-- Eine gruene Kontrolle, die nicht rot werden kann, ist wertlos — genau die
-- Sorte Falschzusage, um die es hier geht.
--
-- Diese Datei stellt deshalb den Angriff NACH, statt ihn nur zu behaupten:
-- sie legt die View 'app.zukunft_test' ohne security_invoker an (exakt die
-- aus dem Befund) und verlangt, dass der Schutz anschlaegt. Alles in
-- begin/rollback — die View ueberlebt den Test nicht.
--
-- Bezug: Migration 0030 (app.insecure_views / app.assert_no_insecure_views).
-- Diese Datei ist NEU (Bestands-Tests bleiben unveraendert).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- A) Der Bestand ist sauber — und zwar in app UND api.
--    (api: 0001:48-49 grantet dort ANON select; eine View ohne
--     security_invoker waere ein Bypass fuer UNANGEMELDETE.)
-- ---------------------------------------------------------------------------
begin;
do $$
declare
  v_bad text;
begin
  select string_agg(format('%s.%s', schema_name, view_name), ', ')
    into v_bad from app.insecure_views();
  if v_bad is null then
    perform testkit.ok('view-guard: Bestand sauber — keine View in app/api ohne security_invoker');
  else
    perform testkit.fail('view-guard: Bestand sauber — keine View in app/api ohne security_invoker',
      format('RLS-Bypass durch: %s', v_bad));
  end if;

  perform testkit.succeeds('view-guard: assert_no_insecure_views() laeuft auf dem Bestand durch',
    'select app.assert_no_insecure_views()');
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- B) DER KERN: die Kontrolle KANN rot werden.
--    'app.zukunft_test' ohne security_invoker anlegen -> beide Bausteine
--    muessen anschlagen. Faellt dieser Block je um, ist der Schutz blind.
-- ---------------------------------------------------------------------------
begin;
create view app.zukunft_test as select * from app.team_members;

do $$
begin
  -- B1: der Detektor findet sie.
  perform testkit.is_eq('view-guard: der Detektor FINDET eine neue View ohne security_invoker',
    (select count(*) from app.insecure_views()
      where schema_name = 'app' and view_name = 'zukunft_test'), 1);

  -- B2: und die Zusicherung wirft. Das ist der eigentliche Dauerschutz:
  --     genau dieser Aufruf haengt am Ende kuenftiger Migrationen.
  perform testkit.throws('view-guard: assert_no_insecure_views() WIRFT dann laut (P0001)',
    'select app.assert_no_insecure_views()', 'P0001');
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- C) Die Gegenprobe: MIT security_invoker=true ist dieselbe View in Ordnung.
--    Sonst koennte der Schutz auch stumpf immer werfen (und waere ebenso
--    wertlos wie einer, der nie wirft).
-- ---------------------------------------------------------------------------
begin;
create view app.zukunft_test with (security_invoker = true) as select * from app.team_members;

do $$
begin
  perform testkit.is_eq('view-guard: dieselbe View MIT security_invoker ist sauber',
    (select count(*) from app.insecure_views()
      where schema_name = 'app' and view_name = 'zukunft_test'), 0);
  perform testkit.succeeds('view-guard: assert_no_insecure_views() laesst sie durch',
    'select app.assert_no_insecure_views()');
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- D) Der Geltungsbereich deckt auch 'api' ab — das Schema, in das laut
--    0001:32 die PostgREST-Views kommen und in dem ANON liest. Heute leer;
--    die Regel steht da, BEVOR die erste oeffentliche View entsteht.
-- ---------------------------------------------------------------------------
begin;
create view api.zukunft_test as select * from app.team_members;

do $$
begin
  perform testkit.is_eq('view-guard: der Detektor deckt auch api ab (dort liest ANON)',
    (select count(*) from app.insecure_views()
      where schema_name = 'api' and view_name = 'zukunft_test'), 1);
  perform testkit.throws('view-guard: assert_no_insecure_views() wirft auch fuer api',
    'select app.assert_no_insecure_views()', 'P0001');
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- E) Der ANGRIFF, den 0027 geschlossen hat, als Ende-zu-Ende-Beweis:
--    eine unsichere View auf app.team_members laesst eine Person OHNE jede
--    Mitgliedschaft die Zuordnungen lesen. Damit ist belegt, dass die
--    Kontrolle aus B kein Formalismus ist, sondern echten Datenabfluss
--    verhindert.
--    Zahl-Hinweis: die "5" aus dem Befund/93c:40 sind die COACH-Zeilen —
--    app.team_coaches filtert auf role='coach', diese View nicht. Hier
--    fliessen ALLE team_members ab, also mehr.
--    Die erwartete Zahl wird bewusst NICHT hart hineingeschrieben (im Harness
--    sind es 21, in .dev/pgdata 20 — die Fixture Verein B haengt daran). Ein
--    hart kodierter Wert wuerde hier nur die Fixture messen statt den Bypass.
--    Geprueft wird die AUSSAGE: Basistabelle 0 (RLS wirkt) UND View > 0
--    (RLS umgangen) — und die View sieht exakt so viel wie der Eigentuemer.
-- ---------------------------------------------------------------------------
begin;
create view app.zukunft_test as select * from app.team_members;
grant select on app.zukunft_test to authenticated;

-- Die Wahrheit VOR dem Rollenwechsel festhalten (hier gilt noch keine RLS):
-- so misst der Test den Abfluss gegen den echten Bestand statt gegen eine
-- hart kodierte Fixture-Zahl.
create temp table _wahrheit as select count(*)::bigint as n from app.team_members;
grant select on _wahrheit to authenticated;

-- Fremde: gueltiges Token, KEINE Mitgliedschaft in Verein A.
select set_config('request.jwt.claims',
  '{"sub":"99999999-0000-4000-8000-000000000099","role":"authenticated","club_roles":{}}',
  true);
set local role authenticated;

do $$
declare
  v_alle    bigint := (select n from _wahrheit);
  v_ueber_view bigint;
begin
  -- Kontrolle: ueber die Basistabelle greift RLS -> 0 Zeilen.
  perform testkit.is_eq('view-guard: Fremde sieht 0 Zeilen in app.team_members (RLS wirkt)',
    (select count(*) from app.team_members), 0);

  -- Der Bypass: dieselbe Person, dieselben Daten, ueber die unsichere View.
  select count(*) into v_ueber_view from app.zukunft_test;
  perform testkit.is_eq('view-guard: ... sieht durch die unsichere View den GANZEN Bestand (der Bypass)',
    v_ueber_view, v_alle);

  if v_ueber_view > 0 then
    perform testkit.ok(format('view-guard: der Abfluss ist real — %s Zeilen an eine Person ohne Mitgliedschaft', v_ueber_view));
  else
    perform testkit.fail('view-guard: der Abfluss ist real',
      'die View lieferte 0 Zeilen — dann belegt dieser Test den Bypass nicht');
  end if;
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- F) Aufraeum-Kontrolle: nach all den rollbacks darf nichts uebrig sein.
--    Sonst haette dieser Test selbst einen Bypass hinterlassen.
-- ---------------------------------------------------------------------------
begin;
do $$
begin
  perform testkit.is_eq('view-guard: kein zukunft_test ueberlebt diesen Test (alles rollback)',
    (select count(*) from pg_catalog.pg_class c
      join pg_catalog.pg_namespace n on n.oid = c.relnamespace
     where n.nspname in ('app', 'api') and c.relname = 'zukunft_test'), 0);
  perform testkit.is_eq('view-guard: und der Bestand ist weiterhin sauber',
    (select count(*) from app.insecure_views()), 0);
end;
$$;
rollback;
