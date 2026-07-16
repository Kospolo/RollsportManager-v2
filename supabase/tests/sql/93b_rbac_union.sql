-- ============================================================================
-- 93b_rbac_union.sql — test class (i3): die MATRIX selbst + die VEREINIGUNG.
--
-- Abgrenzung zu 93_rbac.sql: dort wird die Zuweisung geändert (Person bekommt
-- eine Rolle dazu). Hier bleibt die Zuweisung, und die RECHTE-DEFINITION der
-- Rolle ändert sich (role_permissions) — der Pfad, den das Admin-UI später
-- bedient. Beide müssen ohne Neuanmeldung greifen.
--
-- Drei Beweislasten:
--   A) role_permissions-Änderung wirkt SOFORT beim UNVERÄNDERTEN Token.
--   B) MEHRFACHROLLEN coach + treasurer -> Vereinigung, höchste Stufe je
--      Fähigkeit. Kein Recht geht verloren, keines wird gesenkt.
--   G) EIGENE Rolle mit gesetzten Stufen wirkt wie eine Systemrolle — ohne
--      Rang in der Rollen-Hierarchie (fail-closed).
--
-- Personas: m-09 Katrin (member, 90..09) · m-01 Sandra (coach, 90..01, betreut
--   b-02 + b-03). Seed club A: 10 Kassenbuch-Zeilen · 8 Fächer · 6 Küren.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- A) DIE MATRIX IST DER SCHALTER: derselbe Token, dieselbe Rolle, nur die
--    Stufe der Rolle 'member' ändert sich — und die Rechte kippen sofort.
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000009","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"member"}}',
  true);
set local role authenticated;

do $$
begin
  -- 0045: Startwert read_own (1) statt read_all (3) — die Stufe fuer 'member'
  -- wurde auf Ansage des Nutzers gekappt. Die Zusage darunter ist unberuehrt:
  -- eine LESE-Stufe reicht zum Erfassen nicht, egal welche.
  perform testkit.is_eq('matrix: Katrin startet auf attendance = read_own (1, seit 0045)',
    app.cap_rank('c1ab0000-0000-4000-8000-000000000001', 'attendance')::bigint, 1);
  perform testkit.throws('matrix: eine Lese-Stufe reicht zum Erfassen NICHT (edit noetig)',
    $q$insert into app.attendance (club_id, event_id, member_id, status)
       values ('c1ab0000-0000-4000-8000-000000000001',
               'e0000000-0000-4000-8000-000000000004',
               'a0000000-0000-4000-8000-000000000020', 'present')$q$, '42501');
end;
$$;

-- Nur die MATRIX aendert sich — keine neue Rolle, keine neue Anmeldung.
reset role;
select set_config('request.jwt.claims', '', true);
update app.role_permissions rp
   set level = 'edit'
  from app.roles r
 where r.id = rp.role_id
   and r.club_id = 'c1ab0000-0000-4000-8000-000000000001'
   and r.key = 'member'
   and rp.capability_key = 'attendance';

select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000009","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"member"}}',
  true);
set local role authenticated;

do $$
begin
  perform testkit.is_eq('matrix: die Stufe der Rolle steigt auf edit (4) — ohne Re-Login',
    app.cap_rank('c1ab0000-0000-4000-8000-000000000001', 'attendance')::bigint, 4);
  perform testkit.succeeds('matrix: Katrin darf JETZT Anwesenheit erfassen (gleicher Token!)',
    $q$insert into app.attendance (club_id, event_id, member_id, status)
       values ('c1ab0000-0000-4000-8000-000000000001',
               'e0000000-0000-4000-8000-000000000004',
               'a0000000-0000-4000-8000-000000000021', 'present')$q$);
  -- Die Rollenzuweisung selbst ist unangetastet geblieben.
  perform testkit.is_eq('matrix: sie ist dabei unveraendert NUR "member"',
    (select count(*) from app.member_roles
      where member_id = 'a0000000-0000-4000-8000-000000000009'), 1);
end;
$$;

-- ... und der Entzug ueber die Matrix wirkt ebenso sofort.
reset role;
select set_config('request.jwt.claims', '', true);
update app.role_permissions rp
   set level = 'none'
  from app.roles r
 where r.id = rp.role_id
   and r.club_id = 'c1ab0000-0000-4000-8000-000000000001'
   and r.key = 'member'
   and rp.capability_key = 'attendance';

select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000009","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"member"}}',
  true);
set local role authenticated;

do $$
begin
  perform testkit.is_eq('matrix: Absenkung auf none (0) wirkt sofort',
    app.cap_rank('c1ab0000-0000-4000-8000-000000000001', 'attendance')::bigint, 0);
  perform testkit.throws('matrix: Erfassen ist sofort wieder gesperrt',
    $q$insert into app.attendance (club_id, event_id, member_id, status)
       values ('c1ab0000-0000-4000-8000-000000000001',
               'e0000000-0000-4000-8000-000000000004',
               'a0000000-0000-4000-8000-000000000022', 'present')$q$, '42501');
  -- HIER STAND DIE GRENZE VON PHASE 1 — UND IHRE AUFLOESUNG IST 0045.
  --
  -- Der alte Text lautete: "'none' sperrt das SCHREIBEN, nicht das Lesen.
  -- attendance_select ist weiterhin is_club_member ... Wer das aendern will,
  -- muss die SELECT-Policy umstellen; dieser Test haelt den Ist-Zustand fest,
  -- damit die Luecke nicht unbemerkt als 'abgeschaltet' gilt."
  -- Er hat seine Aufgabe erfuellt: die Luecke ist nicht unbemerkt geblieben,
  -- der Nutzer hat sie gefunden ("trainingsbeteiligung an anderen mitgliedern
  -- als mitglied ... geht auch nicht") und 0045 hat die SELECT-Policy
  -- umgestellt (app.can_read_attendance).
  --
  -- Diese Zeile wird deshalb UMGEDREHT und nicht geloescht: sie ist der einzige
  -- Ort, an dem die Aussage "die Stufe wirkt auch auf das Lesen" gegen den
  -- ECHTEN Datenbestand faellt, wenn jemand die Policy zurueckdreht. Aus dem
  -- Waechter der Luecke wird der Waechter des Fixes — dieselbe Zeile, andere
  -- Richtung. (Die Umkehrung ist der Grund, warum 93j Block A jetzt
  -- enforced=4/write_only=8 zaehlt.)
  perform testkit.is_eq('matrix: none sperrt jetzt AUCH das Lesen (Phase-1-Grenze aufgeloest, 0045)',
    (select count(*) from app.attendance), 0);
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- B) MEHRFACHROLLEN: coach + treasurer. Sandra behaelt ALLES vom Coach und
--    bekommt ALLES vom Kassenwart dazu. Je Faehigkeit gewinnt die HOECHSTE
--    Stufe — eine naive "letzte Rolle gewinnt"-Implementierung wuerde hier
--    entweder ihr attendance/edit (Coach) oder ihr finance/manage (Kassenwart)
--    verlieren.
--    Ausgangslage coach:     attendance=edit(4) finance=read_own(1)
--                            lockers=read_own(1) members=read_all(3) routines=read_team(2)
--    Ausgangslage treasurer: attendance=read_own(1, seit 0045) finance=manage(5)
--                            lockers=manage(5) members=manage(5) routines=read_own(1)
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000001","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"coach"}}',
  true);
set local role authenticated;

do $$
begin
  perform testkit.is_eq('union vorher: Sandra ist NUR Trainerin (1 Rolle)',
    (select count(*) from app.member_roles
      where member_id = 'a0000000-0000-4000-8000-000000000001'), 1);
  perform testkit.is_eq('union vorher: finance = read_own (1)',
    app.cap_rank('c1ab0000-0000-4000-8000-000000000001', 'finance')::bigint, 1);
  perform testkit.is_eq('union vorher: Kassenbuch unsichtbar (0 von 10)',
    (select count(*) from app.ledger_entries), 0);
  perform testkit.is_eq('union vorher: lockers = read_own (1) -> sie hat keins -> 0 Faecher',
    (select count(*) from app.lockers), 0);
  perform testkit.is_eq('union vorher: attendance = edit (4)',
    app.cap_rank('c1ab0000-0000-4000-8000-000000000001', 'attendance')::bigint, 4);
end;
$$;

-- Zweitrolle 'treasurer' dazu (Service-Pfad — Selbstvergabe waere korrekt
-- geblockt, siehe 94_rbac_escalation.sql).
reset role;
select set_config('request.jwt.claims', '', true);
insert into app.member_roles (club_id, member_id, role_id)
select 'c1ab0000-0000-4000-8000-000000000001',
       'a0000000-0000-4000-8000-000000000001', r.id
from app.roles r
where r.club_id = 'c1ab0000-0000-4000-8000-000000000001' and r.key = 'treasurer';

-- GLEICHER Token, der weiterhin nur "coach" behauptet.
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000001","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"coach"}}',
  true);
set local role authenticated;

do $$
begin
  perform testkit.is_eq('union: Sandra haelt jetzt ZWEI Rollen',
    (select count(*) from app.member_roles
      where member_id = 'a0000000-0000-4000-8000-000000000001'), 2);
  perform testkit.is_eq('union: has_club_role sieht BEIDE (coach UND treasurer)',
    (select count(*) from (values (1)) t
     where app.has_club_role('c1ab0000-0000-4000-8000-000000000001', array['coach'])
       and app.has_club_role('c1ab0000-0000-4000-8000-000000000001', array['treasurer'])), 1);

  -- --- Was der Kassenwart mitbringt, ist DA ---
  perform testkit.is_eq('union: finance steigt auf manage (5) — Kassenwart gewinnt',
    app.cap_rank('c1ab0000-0000-4000-8000-000000000001', 'finance')::bigint, 5);
  perform testkit.is_eq('union: das ganze Kassenbuch ist sichtbar (10)',
    (select count(*) from app.ledger_entries), 10);
  perform testkit.is_eq('union: alle 10 Rechnungen sichtbar',
    (select count(*) from app.invoices), 10);
  perform testkit.is_eq('union: lockers steigt auf manage (5) -> alle 8 Faecher',
    app.cap_rank('c1ab0000-0000-4000-8000-000000000001', 'lockers')::bigint, 5);
  perform testkit.is_eq('union: sie sieht jetzt alle 8 Faecher',
    (select count(*) from app.lockers), 8);
  perform testkit.is_eq('union: members steigt auf manage (5)',
    app.cap_rank('c1ab0000-0000-4000-8000-000000000001', 'members')::bigint, 5);

  -- --- Was die Trainerin mitbrachte, ist NICHT verloren ---
  perform testkit.is_eq('union: attendance BLEIBT edit (4) — treasurer/read_own senkt NICHT',
    app.cap_rank('c1ab0000-0000-4000-8000-000000000001', 'attendance')::bigint, 4);
  perform testkit.succeeds('union: sie darf weiterhin Anwesenheit erfassen (Coach-Recht bleibt)',
    $q$insert into app.attendance (club_id, event_id, member_id, status)
       values ('c1ab0000-0000-4000-8000-000000000001',
               'e0000000-0000-4000-8000-000000000004',
               'a0000000-0000-4000-8000-000000000020', 'present')$q$);
  perform testkit.is_eq('union: routines BLEIBT read_team (2) — treasurer/read_own senkt NICHT',
    app.cap_rank('c1ab0000-0000-4000-8000-000000000001', 'routines')::bigint, 2);
  perform testkit.is_eq('union: sie sieht weiterhin die Kueren ihrer Teams (b-02+b-03 = 6)',
    (select count(*) from app.routines), 6);

  -- --- Die Rollen-HIERARCHIE folgt der hoechsten Systemrolle, nicht der Summe ---
  -- min() ueber das Enum: moderator liegt VOR treasurer, treasurer VOR coach
  -- -> hoechste Rolle = treasurer -> und der aendert per Definition NIE Rollen.
  perform testkit.is_eq('union: coach+treasurer aendert trotzdem KEINE Rollen (Kassenwart-Regel)',
    (select count(*) from (values (1)) t
     where not app.can_change_member_role('c1ab0000-0000-4000-8000-000000000001', 'coach')
       and not app.can_change_member_role('c1ab0000-0000-4000-8000-000000000001', 'owner')), 1);
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- G) EIGENE ROLLE. "Kampfrichter:in" mit routines=read_all und finance=none,
--    zusaetzlich zur member-Rolle. Beweist: frei angelegte Rollen wirken sofort
--    wie Systemrollen — aber ohne Rang in der Hierarchie und ohne die
--    Moeglichkeit, per 'none' fremde Rechte zu SENKEN (Vereinigung = Maximum).
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claims', '', true);

insert into app.roles (id, club_id, key, name_de, name_en, sort)
values ('11111111-0000-4000-8000-000000000001',
        'c1ab0000-0000-4000-8000-000000000001',
        'kampfrichter', 'Kampfrichter:in', 'Judge', 80);

insert into app.role_permissions (club_id, role_id, capability_key, level)
values ('c1ab0000-0000-4000-8000-000000000001',
        '11111111-0000-4000-8000-000000000001', 'routines', 'read_all'),
       ('c1ab0000-0000-4000-8000-000000000001',
        '11111111-0000-4000-8000-000000000001', 'finance', 'none');

insert into app.member_roles (club_id, member_id, role_id)
values ('c1ab0000-0000-4000-8000-000000000001',
        'a0000000-0000-4000-8000-000000000009',
        '11111111-0000-4000-8000-000000000001');

select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000009","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"member"}}',
  true);
set local role authenticated;

do $$
begin
  perform testkit.is_eq('eigene rolle: Katrin haelt member + kampfrichter',
    (select count(*) from app.member_roles
      where member_id = 'a0000000-0000-4000-8000-000000000009'), 2);
  perform testkit.is_eq('eigene rolle: has_club_role kennt den eigenen key',
    (select count(*) from (values (1)) t
     where app.has_club_role('c1ab0000-0000-4000-8000-000000000001', array['kampfrichter'])), 1);

  -- Die gesetzte Stufe WIRKT — sofort, mit dem alten "member"-Token.
  perform testkit.is_eq('eigene rolle: routines steigt auf read_all (3)',
    app.cap_rank('c1ab0000-0000-4000-8000-000000000001', 'routines')::bigint, 3);
  perform testkit.is_eq('eigene rolle: statt 1 eigener Kuer sieht sie jetzt alle 6',
    (select count(*) from app.routines), 6);

  -- 'none' in der eigenen Rolle SENKT nichts: die Vereinigung ist das MAXIMUM.
  -- (Sonst waere "eine Rolle dazu" ein Rechte-ENTZUG — genau die Falle, die eine
  --  min()- oder "letzte Rolle gewinnt"-Auswertung baut.)
  perform testkit.is_eq('eigene rolle: finance=none SENKT die member-Stufe nicht (bleibt 1)',
    app.cap_rank('c1ab0000-0000-4000-8000-000000000001', 'finance')::bigint, 1);

  -- Nicht gesetzte Faehigkeiten der eigenen Rolle = fehlender Eintrag = 0.
  perform testkit.is_eq('eigene rolle: nicht gesetzte Faehigkeit bleibt 0 (fail-closed)',
    app.cap_rank('c1ab0000-0000-4000-8000-000000000001', 'club_settings')::bigint, 0);

  -- Eigene Rollen haben KEINEN Rang: kein Zugriff auf die Rollen-Hierarchie,
  -- und kein owner-Kurzschluss (protected ist per CHECK Systemrollen vorbehalten).
  perform testkit.is_eq('eigene rolle: verleiht KEINEN Rang (can_change_member_role bleibt false)',
    (select count(*) from (values (1)) t
     where not app.can_change_member_role('c1ab0000-0000-4000-8000-000000000001', 'member')), 1);
  perform testkit.is_eq('eigene rolle: ist nicht protected -> kein owner-Kurzschluss',
    (select count(*) from app.roles
      where id = '11111111-0000-4000-8000-000000000001' and protected), 0);
end;
$$;

-- Und der Entzug der eigenen Rolle wirkt genauso sofort.
reset role;
select set_config('request.jwt.claims', '', true);
delete from app.member_roles
 where member_id = 'a0000000-0000-4000-8000-000000000009'
   and role_id = '11111111-0000-4000-8000-000000000001';

select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000009","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"member"}}',
  true);
set local role authenticated;

do $$
begin
  perform testkit.is_eq('eigene rolle: nach Entzug faellt routines sofort auf read_own (1)',
    app.cap_rank('c1ab0000-0000-4000-8000-000000000001', 'routines')::bigint, 1);
  perform testkit.is_eq('eigene rolle: sie sieht wieder nur ihre eigene Kuer',
    (select count(*) from app.routines), 1);
end;
$$;
rollback;
