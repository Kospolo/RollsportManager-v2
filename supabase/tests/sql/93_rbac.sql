-- ============================================================================
-- 93_rbac.sql — test class (i): konfigurierbares RBAC (0022-0026).
--
-- Zwei Beweislasten (die Sperren + die Befristung: 94_rbac_escalation.sql):
--   A) ÄQUIVALENZ — die Default-Matrix trifft für JEDE der 7 Systemrollen exakt
--      dieselbe Menge wie die alte Bedingung. Das ist der Beweis, dass der
--      Umbau nichts verschoben hat (die Matrix friert das IST ein, NICHT die
--      Ziel-Defaults aus RBAC-DESIGN §3).
--   B) DIE NEUEN ZUSAGEN — Rechteänderung wirkt SOFORT beim UNVERÄNDERTEN
--      Token; Zweitrolle addiert Rechte; entzogene Rolle nimmt sie sofort;
--      ein Claim allein trägt nicht mehr.
--
-- Personas (Seed): m-02 Jürgen owner · m-04 Thomas admin · m-14 Petra moderator
--   m-03 Beate treasurer · m-01 Sandra coach · m-09 Katrin member
--   m-06 Milena guest_coach (valid_until = +30d)
-- ============================================================================

-- ---------------------------------------------------------------------------
-- A) ÄQUIVALENZ: die Default-Matrix reproduziert die alten Rollenmengen.
--    Ausgewertet mit Superuser-Augen über alle 7 Rollen auf einmal — je
--    Fähigkeit muss die Menge der Rollen mit >= Stufe X exakt der alten
--    Rollenliste entsprechen.
-- ---------------------------------------------------------------------------
begin;

do $$
declare
  v_club uuid := 'c1ab0000-0000-4000-8000-000000000001';
begin
  -- Helfer-Ausdruck: welche Systemrollen erreichen für <cap> mindestens <level>?
  -- (protected owner zählt über die Matrix, nicht über den cap_rank-Kurzschluss —
  -- deshalb wird owner hier über role_permissions mitgeführt.)

  -- members 'manage' == can_manage_members == owner/admin/moderator/treasurer
  perform testkit.is_eq('equiv: members/manage = owner,admin,moderator,treasurer',
    (select count(*) from app.roles r
      join app.role_permissions rp on rp.role_id = r.id
     where r.club_id = v_club and r.is_system and rp.capability_key = 'members'
       and app.level_rank(rp.level) >= app.level_rank('manage')
       and r.key in ('owner','admin','moderator','treasurer')), 4);
  perform testkit.is_eq('equiv: members/manage schliesst coach,member,guest_coach aus',
    (select count(*) from app.roles r
      join app.role_permissions rp on rp.role_id = r.id
     where r.club_id = v_club and r.is_system and rp.capability_key = 'members'
       and app.level_rank(rp.level) >= app.level_rank('manage')
       and r.key in ('coach','member','guest_coach')), 0);

  -- attendance 'edit' == is_club_trainer == owner/admin/moderator/coach/guest_coach
  perform testkit.is_eq('equiv: attendance/edit = is_club_trainer (5 Rollen)',
    (select count(*) from app.roles r
      join app.role_permissions rp on rp.role_id = r.id
     where r.club_id = v_club and r.is_system and rp.capability_key = 'attendance'
       and app.level_rank(rp.level) >= app.level_rank('edit')), 5);
  perform testkit.is_eq('equiv: attendance/edit schliesst treasurer,member aus',
    (select count(*) from app.roles r
      join app.role_permissions rp on rp.role_id = r.id
     where r.club_id = v_club and r.is_system and rp.capability_key = 'attendance'
       and app.level_rank(rp.level) >= app.level_rank('edit')
       and r.key in ('treasurer','member')), 0);

  -- finance 'manage' == can_manage_finance == owner/admin/moderator/treasurer
  perform testkit.is_eq('equiv: finance/manage = can_manage_finance (4 Rollen)',
    (select count(*) from app.roles r
      join app.role_permissions rp on rp.role_id = r.id
     where r.club_id = v_club and r.is_system and rp.capability_key = 'finance'
       and app.level_rank(rp.level) >= app.level_rank('manage')), 4);

  -- lockers 'manage' == owner/admin/treasurer (OHNE moderator/coach!)
  perform testkit.is_eq('equiv: lockers/manage = owner,admin,treasurer (0021)',
    (select count(*) from app.roles r
      join app.role_permissions rp on rp.role_id = r.id
     where r.club_id = v_club and r.is_system and rp.capability_key = 'lockers'
       and app.level_rank(rp.level) >= app.level_rank('manage')), 3);
  perform testkit.is_eq('equiv: lockers/manage schliesst moderator + coach aus',
    (select count(*) from app.roles r
      join app.role_permissions rp on rp.role_id = r.id
     where r.club_id = v_club and r.is_system and rp.capability_key = 'lockers'
       and app.level_rank(rp.level) >= app.level_rank('manage')
       and r.key in ('moderator','coach','guest_coach')), 0);

  -- routines: owner/admin/moderator >= read_all, coach/guest_coach = read_team,
  -- treasurer/member = read_own (0021 can_read_routine, KEIN 'none' fuer treasurer)
  perform testkit.is_eq('equiv: routines >= read_all = owner,admin,moderator',
    (select count(*) from app.roles r
      join app.role_permissions rp on rp.role_id = r.id
     where r.club_id = v_club and r.is_system and rp.capability_key = 'routines'
       and app.level_rank(rp.level) >= app.level_rank('read_all')), 3);
  perform testkit.is_eq('equiv: routines = read_team fuer coach + guest_coach',
    (select count(*) from app.roles r
      join app.role_permissions rp on rp.role_id = r.id
     where r.club_id = v_club and r.is_system and rp.capability_key = 'routines'
       and rp.level = 'read_team'), 2);
  perform testkit.is_eq('equiv: routines = read_own fuer treasurer (NICHT none!)',
    (select count(*) from app.roles r
      join app.role_permissions rp on rp.role_id = r.id
     where r.club_id = v_club and r.is_system and rp.capability_key = 'routines'
       and r.key = 'treasurer' and rp.level = 'read_own'), 1);

  -- Vollständigkeit: 7 Systemrollen x 30 Fähigkeiten, lückenlos geseedet
  perform testkit.is_eq('seed: 7 Systemrollen im Verein',
    (select count(*) from app.roles where club_id = v_club and is_system), 7);
  perform testkit.is_eq('seed: owner ist protected, sonst niemand',
    (select count(*) from app.roles where club_id = v_club and protected), 1);
  perform testkit.is_eq('seed: Rechtematrix lueckenlos (7 x capabilities)',
    (select count(*) from app.role_permissions rp
      join app.roles r on r.id = rp.role_id
     where r.club_id = v_club and r.is_system),
    (select count(*) * 7 from app.capabilities));
  perform testkit.is_eq('seed: jedes lebende Mitglied hat genau eine Rolle',
    (select count(*) from app.club_members m
     where m.club_id = v_club and m.deleted_at is null
       and (select count(*) from app.member_roles mr where mr.member_id = m.id) = 1), 24);

  -- Der Fixture-Beweis: Verein B entsteht NACH der Migration -> der clubs-
  -- Trigger muss dort ebenfalls 7 Rollen angelegt haben.
  perform testkit.is_eq('trigger: der NACH der Migration angelegte Verein B hat 7 Rollen',
    (select count(*) from app.roles
      where club_id = 'deadbeef-0000-4000-8000-000000000001' and is_system), 7);
  perform testkit.is_eq('trigger: Bert (Verein B) hat seine owner-Rolle',
    (select count(*) from app.member_roles mr
      join app.roles r on r.id = mr.role_id
     where mr.member_id = 'deadbeef-a000-4000-8000-000000000001' and r.key = 'owner'), 1);
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- B1) DIE ZUSAGE: Rechteänderung wirkt SOFORT — gleicher Token, neue Rechte.
--     Katrin (member) bekommt zusätzlich die coach-Rolle. Ihr JWT sagt
--     unverändert "member" — trotzdem darf sie ab sofort Anwesenheit erfassen.
--     Das ist der Kern von RBAC-DESIGN §5 ("kein Token-Claim mehr").
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000009","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"member"}}',
  true);
set local role authenticated;

do $$
begin
  -- 0045: die Ausgangslage ist jetzt read_own (1) statt read_all (3) — der
  -- Nutzer hat die Stufe fuer 'member' ausdruecklich gekappt ("trainer und
  -- hoeher ... aber rest nicht"). Die ZUSAGE dieses Blocks ist unberuehrt: er
  -- prueft, dass eine Zweitrolle OHNE Re-Login wirkt, nicht wie hoch der
  -- Startwert ist. Der Startwert ist hier Kulisse.
  perform testkit.is_eq('sofort-wirkung: Katrin startet ohne attendance-Schreibrecht (Rang 1 = read_own, seit 0045)',
    app.cap_rank('c1ab0000-0000-4000-8000-000000000001', 'attendance')::bigint, 1);
  perform testkit.throws('sofort-wirkung: Katrin darf VORHER keine Anwesenheit erfassen',
    $q$insert into app.attendance (club_id, event_id, member_id, status)
       values ('c1ab0000-0000-4000-8000-000000000001',
               'e0000000-0000-4000-8000-000000000004',
               'a0000000-0000-4000-8000-000000000020', 'present')$q$, '42501');
end;
$$;

-- Zweitrolle vergeben — als service-Pfad. WICHTIG: 'reset role' allein genuegt
-- NICHT; request.jwt.claims bliebe gesetzt, auth.uid() waere weiterhin Katrin
-- und protect_member_roles wuerde (korrekt!) die Selbstvergabe blocken. Der
-- service-Pfad ist "kein sub-Claim" (db.ts:82 withServiceRole).
reset role;
select set_config('request.jwt.claims', '', true);
insert into app.member_roles (club_id, member_id, role_id)
select 'c1ab0000-0000-4000-8000-000000000001',
       'a0000000-0000-4000-8000-000000000009', r.id
from app.roles r
where r.club_id = 'c1ab0000-0000-4000-8000-000000000001' and r.key = 'coach';

-- GLEICHER Token wie oben, KEINE Neuanmeldung
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000009","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"member"}}',
  true);
set local role authenticated;
do $$
begin
  perform testkit.is_eq('sofort-wirkung: Zweitrolle hebt attendance auf edit (4) — ohne Re-Login',
    app.cap_rank('c1ab0000-0000-4000-8000-000000000001', 'attendance')::bigint, 4);
  perform testkit.succeeds('sofort-wirkung: Katrin darf JETZT Anwesenheit erfassen (gleicher Token!)',
    $q$insert into app.attendance (club_id, event_id, member_id, status)
       values ('c1ab0000-0000-4000-8000-000000000001',
               'e0000000-0000-4000-8000-000000000004',
               'a0000000-0000-4000-8000-000000000021', 'present')$q$);
  -- Vereinigung: die member-Rolle bleibt, das Maximum gewinnt
  perform testkit.is_eq('mehrfachrollen: Katrin haelt jetzt ZWEI Rollen',
    (select count(*) from app.member_roles
      where member_id = 'a0000000-0000-4000-8000-000000000009'), 2);
  perform testkit.is_eq('mehrfachrollen: has_club_role sieht BEIDE Rollen',
    (select count(*) from (values (1)) t
     where app.has_club_role('c1ab0000-0000-4000-8000-000000000001', array['member'])
       and app.has_club_role('c1ab0000-0000-4000-8000-000000000001', array['coach'])), 1);
end;
$$;

-- ... und der Entzug wirkt genauso sofort
reset role;
select set_config('request.jwt.claims', '', true);
delete from app.member_roles mr
using app.roles r
where r.id = mr.role_id
  and mr.member_id = 'a0000000-0000-4000-8000-000000000009'
  and r.key = 'coach';

select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000009","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"member"}}',
  true);
set local role authenticated;
do $$
begin
  -- 0045: Rueckfall jetzt auf read_own (1) statt read_all (3). Die Zusage
  -- dieses Blocks ist der SOFORTIGE Entzug ohne Re-Login, nicht die Hoehe des
  -- Rueckfallwerts.
  perform testkit.is_eq('sofort-entzug: attendance faellt sofort auf read_own (1) zurueck (seit 0045)',
    app.cap_rank('c1ab0000-0000-4000-8000-000000000001', 'attendance')::bigint, 1);
  perform testkit.throws('sofort-entzug: Katrin darf sofort wieder KEINE Anwesenheit erfassen',
    $q$insert into app.attendance (club_id, event_id, member_id, status)
       values ('c1ab0000-0000-4000-8000-000000000001',
               'e0000000-0000-4000-8000-000000000004',
               'a0000000-0000-4000-8000-000000000022', 'present')$q$, '42501');
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- B2) Der umgekehrte Beweis: ein Token allein bewirkt NICHTS mehr.
--     Genau die Lücke, die 0025 schliesst — bisher genügte der Claim.
-- ---------------------------------------------------------------------------
begin;
-- Katrins Rollenzuweisung verschwindet (z.B. Austritt), ihr Token lebt weiter.
delete from app.member_roles where member_id = 'a0000000-0000-4000-8000-000000000009';

select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000009","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"member"}}',
  true);
set local role authenticated;

do $$
begin
  perform testkit.is_eq('token allein: der member-Claim traegt nicht mehr — kein Verein sichtbar',
    (select count(*) from app.clubs), 0);
  perform testkit.is_eq('token allein: kein Roster mehr',
    (select count(*) from app.club_members), 0);
end;
$$;
rollback;

-- B3) Ein gefaelschter HOHER Claim bringt ebenfalls nichts (die alte Welt haette
--     ihn geglaubt): Katrin behauptet im Token, sie sei owner.
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000009","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"owner"}}',
  true);
set local role authenticated;

do $$
begin
  perform testkit.is_eq('gefaelschter claim: "owner" im Token gibt KEIN finance-Recht',
    app.cap_rank('c1ab0000-0000-4000-8000-000000000001', 'finance')::bigint, 1);
  perform testkit.is_eq('gefaelschter claim: Kassenbuch bleibt unsichtbar',
    (select count(*) from app.ledger_entries), 0);
  perform testkit.affects('gefaelschter claim: Vereinseinstellungen bleiben unantastbar',
    $q$update app.clubs set city = 'Pwned'
        where id = 'c1ab0000-0000-4000-8000-000000000001'$q$, 0);
end;
$$;
rollback;

