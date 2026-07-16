-- ============================================================================
-- 0030_view_invoker_guard.sql — aus dem einmaligen Stolperdraht einen echten,
-- WIEDERVERWENDBAREN und BEWEISBAREN Dauerschutz machen.
--
-- ### DER BEFUND (korrigiert die Zusage aus dem RBAC-DESIGN) ###
-- Der Korrekturblock Phase 2, Punkt 3 versprach: "ein Stolperdraht
-- (Migration + Test) laesst jede kuenftige View in app ohne security_invoker
-- scheitern." Die Zusage war zur HAELFTE falsch:
--   * MIGRATION (0027:57-71): ein do-Block, der EINMAL zum Anwendungszeitpunkt
--     lief. Er prueft den Bestand von damals. Eine kuenftige Migration, die
--     eine unsichere View anlegt, laeuft anstandslos durch — der Block ist
--     laengst Geschichte. Diese Haelfte der Zusage war eine Falschzusage.
--   * TEST (93c:99-123): der EXISTIERT und WIRKT. Selbst geprueft: die
--     Erkennungslogik findet die View 'app.zukunft_test' aus dem Befund
--     sofort. Die Behauptung "der Stolperdraht existiert nicht" ist also
--     fuer die Test-Haelfte NICHT haltbar.
-- Was 93c aber NIE geprueft hat: ob die Kontrolle ueberhaupt ROT werden KANN.
-- Sie behauptet "es gibt keine unsichere View" — waere die Erkennung selbst
-- kaputt (z. B. falscher Optionsname), bliebe sie fuer immer gruen und
-- schuetzte nichts. Eine gruene Kontrolle, die nicht rot werden kann, ist
-- wertlos. Genau diese Selbstkontrolle liefert 93g.
--
-- ### WARUM KEIN EVENT-TRIGGER (ddl_command_end) ###
-- Geprueft statt vermutet, gegen rsm2-pg-dev:
--     set role prod_migrator;  -- Nicht-Superuser, wie Supabase' postgres
--     create event trigger ... -> ERROR: permission denied to create event
--                                 trigger  HINT: Must be superuser
-- Ein Event-Trigger in einer Migration wuerde die Migration auf einer
-- Supabase-Instanz (dort ist 'postgres' KEIN Superuser) SCHEITERN lassen.
-- Ihn "nur wenn Superuser" anzulegen waere die naechste Falschzusage: er
-- existierte lokal und fehlte in Prod — also genau dort, wo man sich auf ihn
-- verlaesst. Deshalb bewusst NICHT.
-- Der Testlauf ist ohnehin der wirksamere Ort: unsichere Views entstehen
-- durch MIGRATIONEN aus diesem Repo, und die kommen alle an 93g vorbei —
-- vor dem Deploy. Ein Event-Trigger schuetzte nur gegen Ad-hoc-DDL in Prod,
-- die ohnehin Superuser-Rechte braucht (und den Trigger gleich mit droppen
-- koennte).
--
-- ### WAS DIESE MIGRATION LIEFERT ###
-- Zwei dauerhafte, auch OHNE Superuser nutzbare Bausteine:
--   app.insecure_views()           -> die Fundstellen (fuer Tests + Menschen)
--   app.assert_no_insecure_views() -> wirft; ans ENDE kuenftiger Migrationen
-- Damit ist die Kontrolle EINE Wahrheit statt copy-paste in jeder Migration.
--
-- ### GELTUNGSBEREICH: app UND api ###
-- 'app'  — 0001:42-44 grantet authenticated automatisch select/insert/update/
--          delete auf JEDE neue Tabelle UND View. Eine View ohne
--          security_invoker laeuft mit den Rechten ihres Eigentuemers
--          (postgres) -> RLS-Bypass. Das war der Fall app.team_coaches (0027).
-- 'api'  — SCHAERFER als bisher geprueft, bewusst ergaenzt: 0001:48-49 grantet
--          dort ANON und authenticated select. Eine View in api ohne
--          security_invoker ist damit ein Bypass fuer UNANGEMELDETE. api ist
--          heute leer (0 Objekte), die Regel kostet also nichts — sie steht
--          da, BEVOR die erste PostgREST-View entsteht. Braucht eine kuenftige
--          oeffentliche View wirklich Eigentuemerrechte, muss das eine
--          bewusste Entscheidung sein und nicht ein Versehen; diese Kontrolle
--          erzwingt das Gespraech.
-- 'internal' bewusst NICHT: dort hat nur service_role Rechte (0001:37,47),
--          service_role hat ohnehin BYPASSRLS. Kein Bypass-Zuwachs.
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 1. Die Fundstellen. EINE Wahrheit fuer Migration, Test und Mensch.
--    'stable', damit die Funktion in Prueffunktionen/Views nutzbar bleibt.
-- ----------------------------------------------------------------------------
create or replace function app.insecure_views()
returns table (schema_name text, view_name text)
language sql
stable
set search_path = ''
as $$
  select n.nspname::text, c.relname::text
  from pg_catalog.pg_class c
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  where n.nspname in ('app', 'api')
    and c.relkind = 'v'
    and coalesce((select option_value
                  from pg_catalog.pg_options_to_table(c.reloptions)
                  where option_name = 'security_invoker'), 'false') <> 'true'
  order by 1, 2
$$;

comment on function app.insecure_views() is
  'Views in app/api OHNE security_invoker=true — per Konstruktion RLS-Bypass (0001 grantet authenticated auf app, ANON auf api automatisch). Leer = sauber. Gegenstueck: app.assert_no_insecure_views().';

-- ----------------------------------------------------------------------------
-- 2. Die Zusicherung zum Ans-Ende-Haengen kuenftiger Migrationen.
--    Absichtlich eine FUNKTION statt eines do-Blocks: ein do-Block ist immer
--    nur eine Momentaufnahme (das war der Fehler von 0027) — eine Funktion
--    laesst sich in JEDER kuenftigen Migration und in Tests erneut aufrufen.
-- ----------------------------------------------------------------------------
create or replace function app.assert_no_insecure_views()
returns void
language plpgsql
stable
set search_path = ''
as $$
declare
  v_bad text;
begin
  select string_agg(format('%s.%s', schema_name, view_name), ', ')
    into v_bad
  from app.insecure_views();

  if v_bad is not null then
    raise exception
      'RLS-Bypass: View(s) ohne security_invoker=true: %', v_bad
      using hint = 'create view ... with (security_invoker = true) — sonst laeuft die View mit den Rechten des Eigentuemers (postgres) und umgeht die RLS der Basistabellen.';
  end if;
end;
$$;

comment on function app.assert_no_insecure_views() is
  'Wirft, sobald eine View in app/api ohne security_invoker existiert. ANS ENDE JEDER kuenftigen Migration haengen, die Views anlegt. Dauerhafter Ersatz fuer den EINMALIGEN do-Block aus 0027:57-71. Kein Event-Trigger: CREATE EVENT TRIGGER braucht Superuser, den Supabase-Prod nicht hat (geprueft).';

-- ----------------------------------------------------------------------------
-- 3. Und sofort selbst anwenden — der Bestand muss sauber sein.
--    (Heute: nur app.team_coaches, seit 0027 mit security_invoker=true.)
-- ----------------------------------------------------------------------------
select app.assert_no_insecure_views();

commit;
