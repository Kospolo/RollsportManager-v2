-- ============================================================================
-- 93d_rbac_routines_split.sql — der Kueren-Split (Migration 0028).
--
-- Die Migration ist eine REFAKTORIERUNG: hinterher muss jede Rolle exakt
-- dasselbe duerfen wie vorher. Bewiesen wird deshalb zweierlei:
--   1. die AEQUIVALENZ (routines_edit >= edit == is_club_trainer), und
--   2. dass der Split ueberhaupt etwas kann, was vorher unmoeglich war:
--      Lesen und Schreiben sind ab jetzt GETRENNT konfigurierbar.
--
-- Verhaltens-Baseline VOR 0028 (gegen rsm2-pg-dev gemessen, Kueren sichtbar /
-- Marker setzen erlaubt):
--   Sandra   coach        6 / ja      Juergen owner       6 / ja
--   Thomas   admin        6 / ja      Petra   moderator   6 / ja
--   AnnaLena coach        1 / ja      Milena  guest_coach 5 / ja
--   Beate    treasurer    0 / nein    Katrin  member      1 / nein
-- Genau diese Zahlen muessen nach 0028 unveraendert sein.
--
-- Personas (profile_id -> Person): 90..01 Sandra Vogel (coach, betreut b-02+b-03)
--   90..03 Beate Schaefer (treasurer) · 90..05 Anna-Lena Boehm (coach, betreut
--   b-01+b-02) · 90..06 Milena Oeztuerk (guest_coach) · 90..09 Katrin Gruenewald
--   (member). Kueren: d-01..d-04 + d-06 in Team b-03, d-05 in Team b-02.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- A) DIE AEQUIVALENZ: routines_edit >= edit ist exakt is_club_trainer.
--    Waeren die Mengen verschieden, haette 0028 Rechte VERSCHOBEN statt
--    migriert — der Kern der Refaktorierungs-Zusage.
-- ---------------------------------------------------------------------------
begin;
do $$
declare
  v_club uuid := 'c1ab0000-0000-4000-8000-000000000001';
begin
  perform testkit.is_eq('split: routines_edit >= edit = die 5 Trainer-Rollen (is_club_trainer)',
    (select count(*) from app.roles r
      join app.role_permissions rp on rp.role_id = r.id
     where r.club_id = v_club and r.is_system
       and rp.capability_key = 'routines_edit'
       and app.level_rank(rp.level) >= app.level_rank('edit')), 5);

  perform testkit.is_eq('split: treasurer + member haben routines_edit = none',
    (select count(*) from app.roles r
      join app.role_permissions rp on rp.role_id = r.id
     where r.club_id = v_club and r.is_system
       and rp.capability_key = 'routines_edit'
       and r.key in ('treasurer', 'member')
       and rp.level = 'none'), 2);

  -- Namentlich, nicht nur der Anzahl nach: eine Rolle koennte getauscht sein.
  perform testkit.is_eq('split: es sind die RICHTIGEN 5 (owner,admin,moderator,coach,guest_coach)',
    (select count(*) from app.roles r
      join app.role_permissions rp on rp.role_id = r.id
     where r.club_id = v_club and r.is_system
       and rp.capability_key = 'routines_edit'
       and app.level_rank(rp.level) >= app.level_rank('edit')
       and r.key in ('owner', 'admin', 'moderator', 'coach', 'guest_coach')), 5);

  -- Die LESE-Skala bleibt unangetastet (0028 fasst 'routines' nicht an).
  perform testkit.is_eq('split: routines (Lesen) unveraendert — coach+guest_coach read_team',
    (select count(*) from app.roles r
      join app.role_permissions rp on rp.role_id = r.id
     where r.club_id = v_club and r.is_system
       and rp.capability_key = 'routines' and rp.level = 'read_team'), 2);
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- B) DIE ASYMMETRIE, die 0026:101-112 als "auf einer Skala nicht abbildbar"
--    begruendet hat — jetzt auf zwei Skalen sauber dargestellt.
--    Anna-Lena betreut b-01 + b-02. Dort liegt genau EINE Kuer (d-05).
--    Sie SIEHT also 1 Kuer, darf aber auf der FREMDEN Kuer d-01 (Team b-03,
--    das sie nicht betreut) einen Marker setzen. Genau diese Kombination war
--    auf einer einzigen geordneten Skala unmoeglich.
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000005","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"coach"}}',
  true);
set local role authenticated;

do $$
begin
  perform testkit.is_eq('asymmetrie: Anna-Lena liest nur ihr Team — 1 Kuer (read_team)',
    (select count(*) from app.routines), 1);
  perform testkit.is_eq('asymmetrie: ihre Lese-Stufe ist read_team (2)',
    app.cap_rank('c1ab0000-0000-4000-8000-000000000001', 'routines')::bigint, 2);
  perform testkit.is_eq('asymmetrie: ihre Schreib-Stufe ist edit (4)',
    app.cap_rank('c1ab0000-0000-4000-8000-000000000001', 'routines_edit')::bigint, 4);
  -- d-01 liegt in b-03: sie sieht die Kuer NICHT, darf sie aber beschreiben.
  perform testkit.succeeds('asymmetrie: schreibt Marker auf eine Kuer, die sie nicht sieht',
    $q$insert into app.routine_markers (club_id, routine_id, time_ms, label)
       values ('c1ab0000-0000-4000-8000-000000000001',
               'd0000000-0000-4000-8000-000000000001', 4200, 'Split-Test')$q$);
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- C) NEU MOEGLICH #1: Schreiben abschalten, ohne das Lesen anzutasten.
--    Vor 0028 war der Schreibpfad fest is_club_trainer verdrahtet — ein
--    Verein KONNTE einem Trainer das Kuer-Schreibrecht gar nicht entziehen.
-- ---------------------------------------------------------------------------
begin;
update app.role_permissions rp
   set level = 'none'
  from app.roles r
 where r.id = rp.role_id
   and r.club_id = 'c1ab0000-0000-4000-8000-000000000001'
   and r.key = 'coach'
   and rp.capability_key = 'routines_edit';

select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000005","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"coach"}}',
  true);
set local role authenticated;

do $$
begin
  perform testkit.throws('abschaltbar: coach ohne routines_edit setzt KEINEN Marker mehr',
    $q$insert into app.routine_markers (club_id, routine_id, time_ms, label)
       values ('c1ab0000-0000-4000-8000-000000000001',
               'd0000000-0000-4000-8000-000000000001', 4200, 'darf nicht')$q$, '42501');
  perform testkit.throws('abschaltbar: und legt auch keine Kuer mehr an',
    $q$insert into app.routines (club_id, team_id, title)
       values ('c1ab0000-0000-4000-8000-000000000001',
               'b0000000-0000-4000-8000-000000000002', 'darf nicht')$q$, '42501');
  -- Der Beweis, dass NUR das Schreiben weg ist: die Sicht bleibt exakt gleich.
  perform testkit.is_eq('abschaltbar: die Kuer-SICHT bleibt unveraendert bei 1',
    (select count(*) from app.routines), 1);
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- D) NEU MOEGLICH #2: die Gegenrichtung — Schreiben ERLAUBEN, ohne Lesen zu
--    oeffnen. Katrin (member) bekommt routines_edit=edit; ihre Lese-Stufe
--    bleibt read_own. Auf einer Skala haette 'edit' (4) zwingend read_all (3)
--    impliziert und die 0021-Privacy-Haertung aufgeweicht.
-- ---------------------------------------------------------------------------
begin;
update app.role_permissions rp
   set level = 'edit'
  from app.roles r
 where r.id = rp.role_id
   and r.club_id = 'c1ab0000-0000-4000-8000-000000000001'
   and r.key = 'member'
   and rp.capability_key = 'routines_edit';

select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000009","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"member"}}',
  true);
set local role authenticated;

do $$
begin
  perform testkit.succeeds('gegenrichtung: member mit routines_edit DARF jetzt Marker setzen',
    $q$insert into app.routine_markers (club_id, routine_id, time_ms, label)
       values ('c1ab0000-0000-4000-8000-000000000001',
               'd0000000-0000-4000-8000-000000000001', 7000, 'Mitglied darf')$q$);
  perform testkit.is_eq('gegenrichtung: sein LESEN bleibt read_own (1) — Privacy unberuehrt',
    app.cap_rank('c1ab0000-0000-4000-8000-000000000001', 'routines')::bigint, 1);
  perform testkit.is_eq('gegenrichtung: sieht weiterhin NUR die eigene Kuer (1 von 6)',
    (select count(*) from app.routines), 1);
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- E) routines_edit ist eine SCHREIB-Skala: Lesestufen sind darauf ein
--    Kategoriefehler und muessen abgelehnt werden (0024:294-300).
-- ---------------------------------------------------------------------------
begin;
do $$
begin
  perform testkit.throws('katalog: read_team ist auf routines_edit nicht setzbar',
    $q$update app.role_permissions rp
          set level = 'read_team'
         from app.roles r
        where r.id = rp.role_id
          and r.club_id = 'c1ab0000-0000-4000-8000-000000000001'
          and r.key = 'coach'
          and rp.capability_key = 'routines_edit'$q$, 'P0001');
  perform testkit.throws('katalog: read_all ist auf routines_edit nicht setzbar',
    $q$update app.role_permissions rp
          set level = 'read_all'
         from app.roles r
        where r.id = rp.role_id
          and r.club_id = 'c1ab0000-0000-4000-8000-000000000001'
          and r.key = 'coach'
          and rp.capability_key = 'routines_edit'$q$, 'P0001');

  perform testkit.is_eq('katalog: routines_edit kennt genau none/edit/manage',
    (select array_length(allowed_levels, 1)::bigint from app.capabilities
      where key = 'routines_edit'), 3);
  -- Der Preis von Option A, ausdruecklich festgehalten: 'manage' bleibt in
  -- routines.allowed_levels (93a:172-178 setzt es), obwohl kein Praedikat
  -- oberhalb read_all (3) prueft. Wer das aendert, bricht 93a.
  perform testkit.is_eq('katalog: routines (Lesen) behaelt manage in allowed_levels (93a:172)',
    (select count(*)::bigint from app.capabilities
      where key = 'routines' and 'manage' = any (allowed_levels)), 1);
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- F) VOLLSTAENDIGKEIT: der Backfill hat wirklich JEDEN Verein erreicht.
--    Wird er vergessen, ist cap_rank('routines_edit') = 0 und alle Trainer
--    verlieren still das Schreibrecht. Verein B entsteht als Fixture NACH den
--    Migrationen -> er beweist zusaetzlich den clubs_rbac_seed-Trigger-Pfad.
-- ---------------------------------------------------------------------------
begin;
do $$
declare
  v_luecken bigint;
begin
  select count(*) into v_luecken
  from app.clubs c
  cross join app.rbac_system_role_labels() srl
  where not exists (
    select 1 from app.roles r
    join app.role_permissions rp on rp.role_id = r.id
    where r.club_id = c.id and r.key = srl.key
      and rp.capability_key = 'routines_edit'
  );
  perform testkit.is_eq('backfill: routines_edit ist in JEDEM Verein x JEDER Systemrolle gesetzt',
    v_luecken, 0);
end;
$$;
rollback;
