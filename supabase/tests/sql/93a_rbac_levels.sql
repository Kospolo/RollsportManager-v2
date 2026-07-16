-- ============================================================================
-- 93a_rbac_levels.sql — test class (i2): die STUFEN-SKALA exakt nachgerechnet.
--
-- 93_rbac.sql beweist die Äquivalenz der Default-Matrix (nichts hat sich
-- verschoben). Diese Suite beweist das Gegenstück: dass die Skala überhaupt
-- eine WIRKUNG hat — jede Stufe liefert exakt die erwartete ZEILENMENGE, nicht
-- nur den erwarteten cap_rank. Ein cap_rank-Test allein würde nicht auffallen,
-- wenn eine Policy den Rang gar nicht ausliest.
--
-- Zwei Beweislasten:
--   C) STUFEN — none/read_own/read_team/read_all/manage auf Küren + Schließ-
--      fächern, je mit exakter Trefferzahl (0/1/2/6 bzw. 0/1/8/8).
--   D) TRAINER:IN MEHRERER TEAMS — die sichtbaren Küren folgen der Team-Menge
--      exakt: Team dazu -> mehr Küren, Team weg -> sofort weniger.
--
-- Personas (Seed): m-09 Katrin (member, Profil 90..09) skatet d-02 (Team b-03)
--   und hat Fach 01. m-05 Anna-Lena (coach, 90..05) betreut b-01 + b-02.
-- Küren je Team: b-01 = 0 · b-02 = d-05 (1) · b-03 = d-01/02/03/04/06 (5).
-- Schließfächer club A: 8 (Fach 01 -> a-09, Fach 02 -> a-16, Fach 05 -> a-17,
--   Fach 08 -> a-23; der Rest frei/defekt).
--
-- allowed_levels (0023) begrenzen, was hier gesetzt werden DARF:
--   routines {none,read_own,read_team,read_all,manage} — kein 'edit'
--   lockers  {none,read_own,read_all,manage}          — kein 'read_team'
-- ============================================================================

-- ---------------------------------------------------------------------------
-- C1) KÜREN-LEITER. Katrin (member) wird zusätzlich Trainerin von b-02 —
--     erst dadurch sind read_own und read_team unterscheidbar (sie skatet in
--     b-03, betreut aber b-02: die beiden Zweige treffen DISJUNKTE Küren).
--     Danach wandert NUR die Stufe der member-Rolle die Skala hoch.
-- ---------------------------------------------------------------------------
begin;

-- Service-Pfad (kein sub-Claim): Katrin bekommt die Trainer-Zuordnung b-02.
insert into app.team_members (club_id, team_id, member_id, role)
values ('c1ab0000-0000-4000-8000-000000000001',
        'b0000000-0000-4000-8000-000000000002',
        'a0000000-0000-4000-8000-000000000009', 'coach');

-- --- Stufe 'none' -----------------------------------------------------------
update app.role_permissions rp
   set level = 'none'
  from app.roles r
 where r.id = rp.role_id
   and r.club_id = 'c1ab0000-0000-4000-8000-000000000001'
   and r.key = 'member'
   and rp.capability_key = 'routines';

select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000009","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"member"}}',
  true);
set local role authenticated;

do $$
begin
  perform testkit.is_eq('stufe none: cap_rank routines = 0',
    app.cap_rank('c1ab0000-0000-4000-8000-000000000001', 'routines')::bigint, 0);
  -- 'none' schaltet AUCH die eigene Kür ab (der read_own-Zweig verlangt >= 1)
  perform testkit.is_eq('stufe none: sieht KEINE Kuer — auch nicht die eigene',
    (select count(*) from app.routines), 0);
  perform testkit.is_eq('stufe none: auch keine Kuer-Wertungen',
    (select count(*) from app.routine_scores), 0);
end;
$$;

-- --- Stufe 'read_own' (= der Default der member-Rolle) -----------------------
reset role;
select set_config('request.jwt.claims', '', true);
update app.role_permissions rp
   set level = 'read_own'
  from app.roles r
 where r.id = rp.role_id
   and r.club_id = 'c1ab0000-0000-4000-8000-000000000001'
   and r.key = 'member'
   and rp.capability_key = 'routines';

select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000009","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"member"}}',
  true);
set local role authenticated;

do $$
begin
  perform testkit.is_eq('stufe read_own: cap_rank routines = 1',
    app.cap_rank('c1ab0000-0000-4000-8000-000000000001', 'routines')::bigint, 1);
  perform testkit.is_eq('stufe read_own: sieht GENAU die eigene Kuer (1)',
    (select count(*) from app.routines), 1);
  perform testkit.is_eq('stufe read_own: und zwar d-02',
    (select count(*) from app.routines
      where id = 'd0000000-0000-4000-8000-000000000002'), 1);
  -- Der Trainer-Zweig zieht auf read_own NICHT — b-02/d-05 bleibt unsichtbar,
  -- obwohl sie das Team betreut. Das ist der Unterschied zu read_team.
  perform testkit.is_eq('stufe read_own: die Kuer ihres betreuten Teams bleibt UNsichtbar (d-05)',
    (select count(*) from app.routines
      where id = 'd0000000-0000-4000-8000-000000000005'), 0);
end;
$$;

-- --- Stufe 'read_team' ------------------------------------------------------
reset role;
select set_config('request.jwt.claims', '', true);
update app.role_permissions rp
   set level = 'read_team'
  from app.roles r
 where r.id = rp.role_id
   and r.club_id = 'c1ab0000-0000-4000-8000-000000000001'
   and r.key = 'member'
   and rp.capability_key = 'routines';

select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000009","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"member"}}',
  true);
set local role authenticated;

do $$
begin
  perform testkit.is_eq('stufe read_team: cap_rank routines = 2',
    app.cap_rank('c1ab0000-0000-4000-8000-000000000001', 'routines')::bigint, 2);
  -- read_team = betreute Teams (d-05) PLUS die eigene Kuer (d-02, weil 2 >= 1).
  -- Genau 2 — nicht 6: die uebrigen b-03-Kueren bleiben aussen vor.
  perform testkit.is_eq('stufe read_team: sieht genau 2 Kueren (betreutes Team + eigene)',
    (select count(*) from app.routines), 2);
  perform testkit.is_eq('stufe read_team: jetzt IST d-05 (Team b-02) sichtbar',
    (select count(*) from app.routines
      where id = 'd0000000-0000-4000-8000-000000000005'), 1);
  perform testkit.is_eq('stufe read_team: die eigene Kuer d-02 bleibt sichtbar',
    (select count(*) from app.routines
      where id = 'd0000000-0000-4000-8000-000000000002'), 1);
  perform testkit.is_eq('stufe read_team: fremde b-03-Kueren bleiben UNsichtbar (d-01)',
    (select count(*) from app.routines
      where id = 'd0000000-0000-4000-8000-000000000001'), 0);
end;
$$;

-- --- Stufe 'read_all' -------------------------------------------------------
reset role;
select set_config('request.jwt.claims', '', true);
update app.role_permissions rp
   set level = 'read_all'
  from app.roles r
 where r.id = rp.role_id
   and r.club_id = 'c1ab0000-0000-4000-8000-000000000001'
   and r.key = 'member'
   and rp.capability_key = 'routines';

select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000009","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"member"}}',
  true);
set local role authenticated;

do $$
begin
  perform testkit.is_eq('stufe read_all: cap_rank routines = 3',
    app.cap_rank('c1ab0000-0000-4000-8000-000000000001', 'routines')::bigint, 3);
  perform testkit.is_eq('stufe read_all: sieht ALLE 6 Kueren des Vereins',
    (select count(*) from app.routines), 6);
  perform testkit.is_eq('stufe read_all: und alle 8 Wertungen',
    (select count(*) from app.routine_scores), 8);
  -- read_all ist LESEN: der Schreibpfad bleibt is_club_trainer (0026-Kommentar).
  -- Ein Mitglied mit read_all darf deshalb weiterhin KEINE Marker setzen.
  perform testkit.throws('stufe read_all: bleibt LESEN — kein Kuer-Marker (Schreibpfad unberuehrt)',
    $q$insert into app.routine_markers (club_id, routine_id, time_ms, label)
       values ('c1ab0000-0000-4000-8000-000000000001',
               'd0000000-0000-4000-8000-000000000001', 1000, 'Testmarke')$q$, '42501');
end;
$$;

-- --- Stufe 'manage' ---------------------------------------------------------
reset role;
select set_config('request.jwt.claims', '', true);
update app.role_permissions rp
   set level = 'manage'
  from app.roles r
 where r.id = rp.role_id
   and r.club_id = 'c1ab0000-0000-4000-8000-000000000001'
   and r.key = 'member'
   and rp.capability_key = 'routines';

select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000009","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"member"}}',
  true);
set local role authenticated;

do $$
begin
  perform testkit.is_eq('stufe manage: cap_rank routines = 5',
    app.cap_rank('c1ab0000-0000-4000-8000-000000000001', 'routines')::bigint, 5);
  perform testkit.is_eq('stufe manage: sieht ebenfalls alle 6 Kueren',
    (select count(*) from app.routines), 6);
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- C2) SCHLIESSFACH-LEITER. Katrin hat Fach 01 (a-09). Skala hier ohne
--     read_team (nicht in allowed_levels): none -> read_own -> read_all/manage.
-- ---------------------------------------------------------------------------
begin;

update app.role_permissions rp
   set level = 'none'
  from app.roles r
 where r.id = rp.role_id
   and r.club_id = 'c1ab0000-0000-4000-8000-000000000001'
   and r.key = 'member'
   and rp.capability_key = 'lockers';

select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000009","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"member"}}',
  true);
set local role authenticated;

do $$
begin
  perform testkit.is_eq('faecher none: sieht NICHT einmal das eigene Fach',
    (select count(*) from app.lockers), 0);
end;
$$;

reset role;
select set_config('request.jwt.claims', '', true);
update app.role_permissions rp
   set level = 'read_own'
  from app.roles r
 where r.id = rp.role_id
   and r.club_id = 'c1ab0000-0000-4000-8000-000000000001'
   and r.key = 'member'
   and rp.capability_key = 'lockers';

select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000009","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"member"}}',
  true);
set local role authenticated;

do $$
begin
  perform testkit.is_eq('faecher read_own (Default): sieht GENAU das eigene Fach (1)',
    (select count(*) from app.lockers), 1);
  perform testkit.is_eq('faecher read_own: und zwar Fach 01',
    (select count(*) from app.lockers
      where id = 'e0c00000-0000-4000-8000-000000000001'), 1);
  perform testkit.throws('faecher read_own: darf kein Fach anlegen (manage noetig)',
    $q$insert into app.lockers (club_id, label, location, status)
       values ('c1ab0000-0000-4000-8000-000000000001', 'Fach 99', 'Keller', 'free')$q$, '42501');
end;
$$;

reset role;
select set_config('request.jwt.claims', '', true);
update app.role_permissions rp
   set level = 'read_all'
  from app.roles r
 where r.id = rp.role_id
   and r.club_id = 'c1ab0000-0000-4000-8000-000000000001'
   and r.key = 'member'
   and rp.capability_key = 'lockers';

select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000009","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"member"}}',
  true);
set local role authenticated;

do $$
begin
  perform testkit.is_eq('faecher read_all: sieht alle 8 Faecher',
    (select count(*) from app.lockers), 8);
  -- read_all ist LESEN: Anlegen/Umbenennen bleibt manage vorbehalten.
  perform testkit.throws('faecher read_all: darf trotzdem kein Fach anlegen',
    $q$insert into app.lockers (club_id, label, location, status)
       values ('c1ab0000-0000-4000-8000-000000000001', 'Fach 99', 'Keller', 'free')$q$, '42501');
  perform testkit.affects('faecher read_all: darf kein Fach umbenennen (RLS filtert)',
    $q$update app.lockers set label = 'Gekapert'
        where id = 'e0c00000-0000-4000-8000-000000000003'$q$, 0);
end;
$$;

reset role;
select set_config('request.jwt.claims', '', true);
update app.role_permissions rp
   set level = 'manage'
  from app.roles r
 where r.id = rp.role_id
   and r.club_id = 'c1ab0000-0000-4000-8000-000000000001'
   and r.key = 'member'
   and rp.capability_key = 'lockers';

select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000009","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"member"}}',
  true);
set local role authenticated;

do $$
begin
  perform testkit.is_eq('faecher manage: sieht alle 8 Faecher',
    (select count(*) from app.lockers), 8);
  perform testkit.succeeds('faecher manage: darf jetzt ein Fach anlegen',
    $q$insert into app.lockers (club_id, label, location, status)
       values ('c1ab0000-0000-4000-8000-000000000001', 'Fach 99', 'Keller', 'free')$q$);
  perform testkit.affects('faecher manage: darf jetzt umbenennen (protect_locker laesst durch)',
    $q$update app.lockers set label = 'Fach 03 neu'
        where id = 'e0c00000-0000-4000-8000-000000000003'$q$, 1);
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- C3) Der Gegenbeweis zur Seed-Koinzidenz: 99a_organisation.sql:135 prueft
--     "coach sieht 0 Faecher" — das stimmt dort nur, weil Sandra gar KEIN Fach
--     hat. Die Default-Stufe coach/lockers ist read_own (nicht none), und der
--     Eigen-Zweig galt schon in 0021:156 fuer JEDEN (der Kommentar dort behauptet
--     das Gegenteil). Bekommt die Trainerin ein Fach, sieht sie GENAU dieses —
--     alt wie neu. Ohne diesen Test wuerde eine Absenkung auf 'none' unbemerkt
--     durchgehen (99a bliebe gruen).
-- ---------------------------------------------------------------------------
begin;
update app.lockers
   set assigned_member_id = 'a0000000-0000-4000-8000-000000000001', status = 'assigned'
 where id = 'e0c00000-0000-4000-8000-000000000003';

select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000001","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"coach"}}',
  true);
set local role authenticated;

do $$
begin
  perform testkit.is_eq('koinzidenz: coach/lockers steht auf read_own (1), nicht none',
    app.cap_rank('c1ab0000-0000-4000-8000-000000000001', 'lockers')::bigint, 1);
  perform testkit.is_eq('koinzidenz: Trainerin MIT Fach sieht genau ihr eigenes (1)',
    (select count(*) from app.lockers), 1);
  perform testkit.is_eq('koinzidenz: und zwar Fach 03',
    (select count(*) from app.lockers
      where id = 'e0c00000-0000-4000-8000-000000000003'), 1);
  perform testkit.throws('koinzidenz: verwalten darf sie es trotzdem nicht',
    $q$insert into app.lockers (club_id, label, location, status)
       values ('c1ab0000-0000-4000-8000-000000000001', 'Fach 98', 'Keller', 'free')$q$, '42501');
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- D) TRAINER:IN MEHRERER TEAMS (RBAC-DESIGN §1.4). Anna-Lena (a-05) betreut
--    b-01 + b-02. Die sichtbaren Kueren folgen der Team-Menge EXAKT — und
--    sofort, ohne Neuanmeldung (Team-Zuordnung ist ebenfalls DB-aufgeloest).
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000005","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"coach"}}',
  true);
set local role authenticated;

do $$
begin
  perform testkit.is_eq('mehrfachteams: Anna-Lena betreut 2 Teams (b-01 + b-02)',
    array_length(app.coached_team_ids('c1ab0000-0000-4000-8000-000000000001'), 1)::bigint, 2);
  -- b-01 hat 0 Kueren, b-02 genau d-05 -> die Vereinigung ist exakt 1.
  perform testkit.is_eq('mehrfachteams: sieht genau die 1 Kuer ihrer Teams (d-05)',
    (select count(*) from app.routines), 1);
  perform testkit.is_eq('mehrfachteams: b-03 gehoert ihr nicht (d-01 unsichtbar)',
    (select count(*) from app.routines
      where id = 'd0000000-0000-4000-8000-000000000001'), 0);
end;
$$;

-- Drittes Team dazu (Service-Pfad) — gleicher Token, keine Neuanmeldung.
reset role;
select set_config('request.jwt.claims', '', true);
insert into app.team_members (club_id, team_id, member_id, role)
values ('c1ab0000-0000-4000-8000-000000000001',
        'b0000000-0000-4000-8000-000000000003',
        'a0000000-0000-4000-8000-000000000005', 'coach');

select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000005","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"coach"}}',
  true);
set local role authenticated;

do $$
begin
  perform testkit.is_eq('mehrfachteams: jetzt 3 Teams',
    array_length(app.coached_team_ids('c1ab0000-0000-4000-8000-000000000001'), 1)::bigint, 3);
  perform testkit.is_eq('mehrfachteams: b-03 dazu -> sieht sofort alle 6 Kueren (gleicher Token!)',
    (select count(*) from app.routines), 6);
end;
$$;

-- b-02 wieder weg (soft-delete) -> d-05 verschwindet, die b-03-Kueren bleiben.
reset role;
select set_config('request.jwt.claims', '', true);
update app.team_members
   set deleted_at = now()
 where club_id = 'c1ab0000-0000-4000-8000-000000000001'
   and team_id = 'b0000000-0000-4000-8000-000000000002'
   and member_id = 'a0000000-0000-4000-8000-000000000005';

select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000005","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"coach"}}',
  true);
set local role authenticated;

do $$
begin
  perform testkit.is_eq('mehrfachteams: nach dem Entzug von b-02 noch 2 Teams',
    array_length(app.coached_team_ids('c1ab0000-0000-4000-8000-000000000001'), 1)::bigint, 2);
  perform testkit.is_eq('mehrfachteams: sieht jetzt genau die 5 b-03-Kueren',
    (select count(*) from app.routines), 5);
  perform testkit.is_eq('mehrfachteams: d-05 (b-02) ist sofort wieder unsichtbar',
    (select count(*) from app.routines
      where id = 'd0000000-0000-4000-8000-000000000005'), 0);
end;
$$;
rollback;
