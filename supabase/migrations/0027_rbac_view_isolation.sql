-- ============================================================================
-- 0027_rbac_view_isolation.sql — RLS-Bypass schliessen (Phase 2, Schritt 1).
--
-- ### Der Befund (selbst reproduziert, nicht vermutet) ###
-- 0025:202-206 legt app.team_coaches als VIEW an — OHNE security_invoker.
-- Damit gilt die Standardregel von Postgres: die View wird mit den Rechten
-- ihres EIGENTUEMERS ausgefuehrt (hier: postgres, Superuser). Die RLS von
-- app.team_members greift dabei NICHT. Zusaetzlich gilt 0001:41-43
-- (alter default privileges ... grant select, insert, update, delete on tables
-- to authenticated) in Postgres AUCH fuer Views -> authenticated hatte volle
-- DML-Rechte auf die View.
--
-- Nachgewiesen gegen rsm2-pg-dev mit einer Person, die ein gueltiges JWT hat
-- und in KEINEM Verein Mitglied ist (club_roles: {}):
--   app.team_members (RLS greift) ->  0 Zeilen sichtbar
--   app.team_coaches (VIEW)       ->  5 Zeilen sichtbar     <- Lese-Bypass
--   update app.team_coaches       -> UPDATE 5               <- Schreib-Bypass
--   delete app.team_coaches       -> DELETE 5, danach 0 coach-Zeilen in
--                                    app.team_members       <- HARTES Loeschen
-- Also ein mandantenuebergreifender Lese- UND Schreib-Bypass auf
-- app.team_members fuer JEDEN authentifizierten Nutzer.
--
-- Warum die 667 Tests das nicht gesehen haben: 94_rbac_escalation.sql:171-190
-- fragt die View als legitimer OWNER ab — dort haette RLS ohnehin nichts
-- gefiltert. Das Loch zeigt sich nur gegenueber einem Nicht-Mitglied.
-- 93c_rbac_view_isolation.sql schliesst genau diese Test-Blindstelle.
--
-- Verhalten aendert sich AUSSCHLIESSLICH fuer den, der es nie durfte:
-- Katrin (member) sieht weiter 5, der Owner weiter 5/2/0 (94:179/182/185).
-- ============================================================================

begin;

-- 1. Die eigentliche Korrektur: RLS des Aufrufers gilt.
alter view app.team_coaches set (security_invoker = true);

-- 2. Schreiben gehoert auf die Basistabelle. Die View ist eine reine
--    Projektion; ein INSERT/UPDATE/DELETE darauf umginge zwar seit (1) die RLS
--    nicht mehr, waere aber weiterhin ein zweiter, undokumentierter Schreibpfad
--    auf app.team_members (inkl. HARTEM delete — die Basistabelle hat bewusst
--    KEINE delete-Policy, Entfernen ist dort Soft-Delete). Defense in depth.
revoke insert, update, delete on app.team_coaches from authenticated;

comment on view app.team_coaches is
  'RBAC-DESIGN §4 "team_coaches" als Sicht auf app.team_members (role=coach) — EINE Wahrheit statt einer zweiten, driftenden Tabelle. security_invoker=true (0027): reine Projektion, die RLS von app.team_members gilt. Schreiben: app.team_members (role=coach), nicht ueber diese View.';

-- ----------------------------------------------------------------------------
-- 3. Dauerhafte Stolperdraht-Kontrolle.
-- Jede kuenftige View in app OHNE security_invoker ist per Konstruktion ein
-- RLS-Bypass, weil 0001:41-43 authenticated automatisch select/insert/update/
-- delete grantet — auch auf Views. Diese Kontrolle laesst eine solche Migration
-- laut scheitern, statt sie still durchzulassen.
-- ----------------------------------------------------------------------------
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
    raise exception 'Views in app ohne security_invoker (RLS-Bypass): %', v_bad;
  end if;
end;
$$;

commit;
