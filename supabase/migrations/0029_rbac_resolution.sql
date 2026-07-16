-- ============================================================================
-- 0029_rbac_resolution.sql — Aufloesung fuer die API (Phase 2, Schritt 3).
--
-- REINE ADDITION. Keine Policy, kein Trigger, kein Verhalten aendert sich —
-- nach dieser Migration ruft NICHTS die beiden Funktionen auf. Sie sind die
-- Grundlage fuer GET /me/capabilities (Schritt 4) und fuer die API-Guards
-- (Schritte 7/8).
--
-- ### Der Zweck: EINE Wahrheit fuer DB und API ###
-- Die Versuchung waere, die Rechte-Aufloesung in TypeScript nachzubauen
-- (SELECT auf role_permissions + Max-Bildung). Das waere ein ZWEITES Regelwerk
-- neben app.cap_rank — und die beiden liefen auseinander, sobald sich eine
-- Regel aendert (owner-Kurzschluss, Mitgliedschafts-Gate, Mehrfachrollen).
-- Genau die Fehlerklasse, gegen die 0025:152-167 schon einmal argumentiert hat.
-- Deshalb delegiert app.cap_ranks den Rang an app.cap_rank und rechnet nichts
-- selbst. Die API bekommt eine fertige Zeile je Faehigkeit.
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- level_of_rank — die Umkehrung von app.level_rank (0022:37-52).
-- Die API muss den Rang als STUFE ausliefern (das UI zeigt "Bearbeiten", nicht
-- "4"). Die Umkehrbarkeit ist damit ein Vertrag, auf den sich die TS-Seite
-- stuetzt — 93e prueft ihn fuer alle 6 Enum-Werte.
-- ----------------------------------------------------------------------------
create or replace function app.level_of_rank(p_rank int)
returns app.role_level
language sql
immutable
parallel safe
set search_path = ''
as $$
  select case p_rank
    when 0 then 'none'
    when 1 then 'read_own'
    when 2 then 'read_team'
    when 3 then 'read_all'
    when 4 then 'edit'
    when 5 then 'manage'
  end::app.role_level
$$;

comment on function app.level_of_rank(int) is
  'Umkehrung von app.level_rank: Rang (0..5) -> Stufe. Unbekannter Rang = NULL (fail-closed, kein stiller Default).';

-- ----------------------------------------------------------------------------
-- cap_ranks — DIE Quelle fuer GET /me/capabilities UND fuer die API-Guards.
-- Eine Zeile je Faehigkeit: Katalog-Metadaten (fuer das Admin-UI) + der
-- aufgeloeste Rang der AUFRUFENDEN Person.
--
-- security definer wie cap_rank selbst: die Funktion liest app.capabilities
-- (fuer authenticated ohnehin per Policy lesbar, 0022:204-206) und delegiert
-- die Rechte-Aufloesung an app.cap_rank — inklusive Mitgliedschafts-Gate,
-- owner-Kurzschluss und Mehrfachrollen-Vereinigung. Es gibt hier bewusst KEINE
-- eigene Rechte-Logik, die abweichen koennte.
--
-- Sortierung = die Reihenfolge, in der das Admin-UI die Matrix zeigt.
-- ----------------------------------------------------------------------------
create or replace function app.cap_ranks(p_club_id uuid)
returns table (
  capability_key text,
  label_de       text,
  label_en       text,
  allowed_levels app.role_level[],
  sort           int,
  rank           int,
  level          app.role_level
)
language sql
stable
security definer
set search_path = ''
as $$
  select c.key, c.label_de, c.label_en, c.allowed_levels, c.sort,
         r.rank, app.level_of_rank(r.rank)
  from app.capabilities c
  cross join lateral (select app.cap_rank(p_club_id, c.key) as rank) r
  order by c.sort, c.key
$$;

comment on function app.cap_ranks(uuid) is
  'Aufgeloeste Rechte der aufrufenden Person im Verein: eine Zeile je Faehigkeit (Katalog + Rang + Stufe). Quelle fuer GET /me/capabilities und die API-Guards. Rang delegiert an app.cap_rank — kein zweites Regelwerk.';

commit;
