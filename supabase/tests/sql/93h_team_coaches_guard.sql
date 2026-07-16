-- ============================================================================
-- 93h_team_coaches_guard.sql — Trainer-Zuordnungen nur durch Team-Verwalter.
--
-- DER BEFUND, den Migration 0031 zumacht (live gegen API :3022 belegt):
--   PUT /clubs/{c}/teams/{t}/coaches als Sandra Vogel (coach)
--   -> sie setzt sich selbst als Trainerin von "Minis & Anfaenger" ein -> 200
--   -> ueber coached_team_ids/can_read_routine sieht sie dessen Kueren.
-- Das DB-Recht bestand seit 0007 (team_members_insert = has_club_role(
-- [owner,admin,moderator,coach])) — KEINE Phase-2-Aufweichung, aber vom
-- Nutzer zum Schliessen entschieden.
--
-- Kein Bestands-Test fror die Weite als Sollverhalten ein: jedes
-- team_members-Schreiben in supabase/tests/ laeuft ueber den Service-Pfad
-- (01_fixture:51 · 93a:36 · 93a:369 · 93a:391 — jeweils ohne sub-Claim).
-- Diese Datei ist NEU (Bestands-Tests bleiben unveraendert).
--
-- Personas: 90..01 Sandra Vogel (coach, betreut b-02+b-03) · 90..02 Juergen
--   Haeberle (owner) · 90..14 Petra Koehler (moderator) · 90..09 Katrin
--   Gruenewald (member). Mitglieder: a0..01 Sandra · a0..09 Katrin.
-- Teams: b-01 Minis & Anfaenger (Sandra betreut es NICHT) · b-02 · b-03.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- A) Die Startkonfiguration: team_coaches liegt NUR bei den Team-Verwaltern.
--    Der Kern der Haertung — der coach hat hier ausdruecklich 'none', obwohl
--    er 'teams' weiterhin auf 'manage' traegt (das ist der springende Punkt:
--    die alte Pruefung 'teams:manage' liess ihn genau deshalb durch).
-- ---------------------------------------------------------------------------
begin;
do $$
declare
  v_club uuid := 'c1ab0000-0000-4000-8000-000000000001';
begin
  perform testkit.is_eq('team-coaches: genau 3 Systemrollen duerfen zuordnen (owner/admin/moderator)',
    (select count(*) from app.roles r
      join app.role_permissions rp on rp.role_id = r.id
     where r.club_id = v_club and r.is_system
       and rp.capability_key = 'team_coaches'
       and app.level_rank(rp.level) >= app.level_rank('manage')), 3);

  perform testkit.is_eq('team-coaches: der coach hat team_coaches = none',
    (select count(*) from app.roles r
      join app.role_permissions rp on rp.role_id = r.id
     where r.club_id = v_club and r.is_system and r.key = 'coach'
       and rp.capability_key = 'team_coaches' and rp.level = 'none'), 1);

  -- Der Kontrast, der die Notwendigkeit der zweiten Skala belegt: dieselbe
  -- Rolle traegt 'teams' weiterhin auf 'manage'. Haette 0031 stattdessen
  -- 'teams' verengt, haette es dem coach die legitime Team-Verwaltung
  -- genommen — Rechte verschoben statt gehaertet.
  perform testkit.is_eq('team-coaches: derselbe coach behaelt teams = manage (nichts verschoben)',
    (select count(*) from app.roles r
      join app.role_permissions rp on rp.role_id = r.id
     where r.club_id = v_club and r.is_system and r.key = 'coach'
       and rp.capability_key = 'teams' and rp.level = 'manage'), 1);
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- B) DER BEFUND, nachgestellt: Sandra (coach) gibt sich selbst ein fremdes
--    Team. Das ist der Angriff aus der Meldung — er muss jetzt scheitern.
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000001","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"coach"}}',
  true);
set local role authenticated;

do $$
begin
  perform testkit.throws('team-coaches: coach macht sich NICHT selbst zur Trainerin eines fremden Teams',
    $q$insert into app.team_members (club_id, team_id, member_id, role)
       values ('c1ab0000-0000-4000-8000-000000000001',
               'b0000000-0000-4000-8000-000000000001',
               'a0000000-0000-4000-8000-000000000001', 'coach')$q$, '42501');

  -- Auch nicht fuer JEMAND ANDEREN (Absprache zweier Trainer: A traegt B ein,
  -- B traegt A ein — waere dieselbe Eskalation ueber zwei Ecken).
  perform testkit.throws('team-coaches: coach traegt auch keine DRITTE Person als Trainerin ein',
    $q$insert into app.team_members (club_id, team_id, member_id, role)
       values ('c1ab0000-0000-4000-8000-000000000001',
               'b0000000-0000-4000-8000-000000000001',
               'a0000000-0000-4000-8000-000000000009', 'coach')$q$, '42501');

  -- Und nicht einmal fuer ein Team, das sie SELBST betreut. "Wer zuordnet,
  -- verwaltet die Teams" gilt ohne Hintertuer.
  perform testkit.throws('team-coaches: coach traegt auch im EIGENEN Team keine Trainerin ein',
    $q$insert into app.team_members (club_id, team_id, member_id, role)
       values ('c1ab0000-0000-4000-8000-000000000001',
               'b0000000-0000-4000-8000-000000000002',
               'a0000000-0000-4000-8000-000000000009', 'coach')$q$, '42501');
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- C) Was dem coach BLEIBT: der Skater-Roster. 0031 sollte haerten, nicht
--    Arbeit wegnehmen — role='skater' ist unveraendert seine Zustaendigkeit.
--    Faellt dieser Block, hat die Migration Rechte VERSCHOBEN statt gehaertet.
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000001","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"coach"}}',
  true);
set local role authenticated;

do $$
begin
  perform testkit.succeeds('team-coaches: coach setzt weiterhin Skater ins Team (unveraendert)',
    $q$insert into app.team_members (club_id, team_id, member_id, role)
       values ('c1ab0000-0000-4000-8000-000000000001',
               'b0000000-0000-4000-8000-000000000001',
               'a0000000-0000-4000-8000-000000000009', 'skater')$q$);
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- D) Die subtile Ecke: der UPDATE-Pfad. `using` sieht die ALTE Zeile,
--    `with check` die NEUE — ohne beides waere die Haertung ueber einen
--    Umweg zu umgehen.
--
--    ACHTUNG, hier steckt eine Falle, in die dieser Test beim Schreiben selbst
--    getappt ist: die beiden Klauseln scheitern UNTERSCHIEDLICH.
--      * `with check` verletzt  -> Fehler 42501 (laut).
--      * `using` verletzt       -> die Zeile ist fuer das UPDATE schlicht
--                                  UNSICHTBAR: 0 Zeilen betroffen, KEIN Fehler
--                                  (stiller no-op — dasselbe Muster, das
--                                  94:473 fuer den Kassenwart festhaelt).
--    Ein testkit.throws waere hier also FALSCH und wuerde rot, obwohl der
--    Schutz haelt. Geprueft wird deshalb mit testkit.affects(...,0) — plus die
--    Kontrolle, dass die Zeile danach WIRKLICH unveraendert ist. Denn "0
--    Zeilen betroffen" allein waere auch dann wahr, wenn die where-Klausel
--    einfach nicht traefe; erst die Nachkontrolle macht daraus einen Beweis.
-- ---------------------------------------------------------------------------
begin;
-- Aufbau ueber den Service-Pfad: Katrin ist Skaterin in b-01.
insert into app.team_members (club_id, team_id, member_id, role)
values ('c1ab0000-0000-4000-8000-000000000001',
        'b0000000-0000-4000-8000-000000000001',
        'a0000000-0000-4000-8000-000000000009', 'skater');

select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000001","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"coach"}}',
  true);
set local role authenticated;

do $$
begin
  -- D1: der Umweg "erst Skater, dann hochstufen" — with_check faengt ihn.
  perform testkit.throws('team-coaches: coach stuft eine Skaterin NICHT zur Trainerin hoch (with check)',
    $q$update app.team_members set role = 'coach'
        where club_id = 'c1ab0000-0000-4000-8000-000000000001'
          and team_id = 'b0000000-0000-4000-8000-000000000001'
          and member_id = 'a0000000-0000-4000-8000-000000000009'$q$, '42501');

  -- D2: die Gegenrichtung — eine bestehende Trainerin degradieren. `using`
  --     sieht die alte coach-Zeile und verlangt bereits manage -> die Zeile
  --     ist unsichtbar -> 0 betroffen, kein Fehler (siehe Kopf von D).
  --     a0..05 (Anna-Lena) ist im Seed Trainerin von b-01.
  perform testkit.affects('team-coaches: coach degradiert KEINE bestehende Trainerin (using, 0 Zeilen)',
    $q$update app.team_members set role = 'skater'
        where club_id = 'c1ab0000-0000-4000-8000-000000000001'
          and team_id = 'b0000000-0000-4000-8000-000000000001'
          and member_id = 'a0000000-0000-4000-8000-000000000005'$q$, 0);

  -- D3: und sie auch nicht still soft-loeschen (alt UND neu sind 'coach').
  perform testkit.affects('team-coaches: coach soft-loescht KEINE fremde Trainer-Zuordnung (0 Zeilen)',
    $q$update app.team_members set deleted_at = now()
        where club_id = 'c1ab0000-0000-4000-8000-000000000001'
          and team_id = 'b0000000-0000-4000-8000-000000000001'
          and member_id = 'a0000000-0000-4000-8000-000000000005'$q$, 0);
end;
$$;

-- D4: die Nachkontrolle ohne RLS — "0 Zeilen betroffen" ist erst dann ein
--     Beweis, wenn die Zeile hinterher nachweislich unangetastet ist.
reset role;
select set_config('request.jwt.claims', '', true);
do $$
begin
  perform testkit.is_eq('team-coaches: Anna-Lena ist nach beiden Versuchen unveraendert Trainerin von b-01',
    (select count(*) from app.team_members
      where team_id = 'b0000000-0000-4000-8000-000000000001'
        and member_id = 'a0000000-0000-4000-8000-000000000005'
        and role = 'coach' and deleted_at is null), 1);
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- E) Die Gegenprobe: wer die Teams VERWALTET, kann weiterhin zuordnen.
--    Eine Haertung, die auch den Berechtigten aussperrt, waere ein Ausfall.
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000002","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"owner"}}',
  true);
set local role authenticated;
do $$
begin
  perform testkit.succeeds('team-coaches: der owner ordnet weiterhin Trainer zu',
    $q$insert into app.team_members (club_id, team_id, member_id, role)
       values ('c1ab0000-0000-4000-8000-000000000001',
               'b0000000-0000-4000-8000-000000000001',
               'a0000000-0000-4000-8000-000000000009', 'coach')$q$);
end;
$$;
rollback;

begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000014","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"moderator"}}',
  true);
set local role authenticated;
do $$
begin
  perform testkit.succeeds('team-coaches: die moderatorin ordnet weiterhin Trainer zu',
    $q$insert into app.team_members (club_id, team_id, member_id, role)
       values ('c1ab0000-0000-4000-8000-000000000001',
               'b0000000-0000-4000-8000-000000000001',
               'a0000000-0000-4000-8000-000000000009', 'coach')$q$);
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- F) Und der eigentliche Schaden, Ende-zu-Ende: die Selbstzuordnung war kein
--    Selbstzweck — sie oeffnete die KUEREN des fremden Teams. Hier der Beleg,
--    dass genau dieser Weg jetzt zu ist.
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000001","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"coach"}}',
  true);
set local role authenticated;
do $$
declare
  v_vorher bigint;
begin
  select count(*) into v_vorher from app.routines;
  -- Der Versuch, sich b-01 zu greifen, scheitert ...
  begin
    insert into app.team_members (club_id, team_id, member_id, role)
    values ('c1ab0000-0000-4000-8000-000000000001',
            'b0000000-0000-4000-8000-000000000001',
            'a0000000-0000-4000-8000-000000000001', 'coach');
  exception when insufficient_privilege then
    null; -- erwartet
  end;
  -- ... und die Kuer-Sicht bleibt daher unveraendert.
  perform testkit.is_eq('team-coaches: die Kuer-Sicht der Trainerin waechst dadurch NICHT',
    (select count(*) from app.routines), v_vorher);
end;
$$;
rollback;
