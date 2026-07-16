-- ============================================================================
-- 94_rbac_escalation.sql — test class (i2): RBAC-Sperren + Befristung.
--
-- Fortsetzung von 93_rbac.sql (dort: Äquivalenz + Sofort-Wirkung). Hier:
--   C) member_roles ist KEIN Eskalationspfad — die neue Schreibfläche.
--      protect_club_membership schützt nur club_members.role; ohne
--      protect_member_roles (0024) wäre member_roles das offene Scheunentor:
--      wer den Roster verwalten darf (auch der Kassenwart!), könnte sich sonst
--      eine owner-Rolle danebenlegen.
--   D) Die guest_coach-Befristung greift jetzt ZENTRAL in cap_rank.
--   E) team_coaches als Sicht auf team_members — eine Wahrheit (RBAC-DESIGN §4).
--
-- Personas (Seed): m-02 Jürgen owner · m-14 Petra moderator · m-03 Beate
--   treasurer · m-06 Milena guest_coach (valid_until = +30d)
-- ============================================================================
-- ---------------------------------------------------------------------------
-- C) member_roles ist KEIN Eskalationspfad (die neue Fläche).
--    protect_club_membership schützt nur club_members.role — ohne
--    protect_member_roles waere member_roles das offene Scheunentor.
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000003","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"treasurer"}}',
  true);
set local role authenticated;

do $$
begin
  -- Der Kassenwart DARF den Roster verwalten (can_manage_members) und kaeme
  -- damit an member_roles heran — die Rangregeln muessen ihn stoppen.
  perform testkit.throws('eskalation: Kassenwart kann sich KEINE owner-Rolle geben',
    $q$insert into app.member_roles (club_id, member_id, role_id)
       select 'c1ab0000-0000-4000-8000-000000000001',
              'a0000000-0000-4000-8000-000000000003', r.id
       from app.roles r
       where r.club_id = 'c1ab0000-0000-4000-8000-000000000001' and r.key = 'owner'$q$,
    'P0001');
  perform testkit.throws('eskalation: Kassenwart kann sich auch keine coach-Rolle geben (Selbstvergabe)',
    $q$insert into app.member_roles (club_id, member_id, role_id)
       select 'c1ab0000-0000-4000-8000-000000000001',
              'a0000000-0000-4000-8000-000000000003', r.id
       from app.roles r
       where r.club_id = 'c1ab0000-0000-4000-8000-000000000001' and r.key = 'coach'$q$,
    'P0001');
  perform testkit.throws('eskalation: Kassenwart kann FREMDEN keine coach-Rolle geben (Referenz 1.3: nie Rollen)',
    $q$insert into app.member_roles (club_id, member_id, role_id)
       select 'c1ab0000-0000-4000-8000-000000000001',
              'a0000000-0000-4000-8000-000000000024', r.id
       from app.roles r
       where r.club_id = 'c1ab0000-0000-4000-8000-000000000001' and r.key = 'coach'$q$,
    'P0001');
  -- ... und er kann sich die eigene Rolle auch nicht wegnehmen/umbiegen
  perform testkit.throws('eskalation: Kassenwart kann seine eigene Zuweisung nicht loeschen',
    $q$delete from app.member_roles
        where member_id = 'a0000000-0000-4000-8000-000000000003'$q$, 'P0001');
  -- Die Rollen-Definition erreicht er gar nicht: roles_delete = is_club_admin,
  -- also filtert die RLS still weg (0 Zeilen, kein Fehler) — der Schutz-Trigger
  -- kommt hier nicht einmal zum Zug.
  perform testkit.affects('schutz: Kassenwart erreicht die Rollen-Definition nicht (stiller no-op)',
    $q$delete from app.roles
        where club_id = 'c1ab0000-0000-4000-8000-000000000001' and key = 'coach'$q$, 0);
end;
$$;
rollback;

-- C2) Der Moderator: darf Rollen vergeben, aber nur unterhalb seines Rangs.
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000014","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"moderator"}}',
  true);
set local role authenticated;

do $$
begin
  perform testkit.succeeds('moderator: DARF einer fremden Person die coach-Rolle geben',
    $q$insert into app.member_roles (club_id, member_id, role_id)
       select 'c1ab0000-0000-4000-8000-000000000001',
              'a0000000-0000-4000-8000-000000000024', r.id
       from app.roles r
       where r.club_id = 'c1ab0000-0000-4000-8000-000000000001' and r.key = 'coach'$q$);
  perform testkit.throws('moderator: DARF KEINE admin-Rolle vergeben (Rangschranke)',
    $q$insert into app.member_roles (club_id, member_id, role_id)
       select 'c1ab0000-0000-4000-8000-000000000001',
              'a0000000-0000-4000-8000-000000000024', r.id
       from app.roles r
       where r.club_id = 'c1ab0000-0000-4000-8000-000000000001' and r.key = 'admin'$q$,
    'P0001');
  perform testkit.throws('moderator: DARF KEINE owner-Rolle vergeben',
    $q$insert into app.member_roles (club_id, member_id, role_id)
       select 'c1ab0000-0000-4000-8000-000000000001',
              'a0000000-0000-4000-8000-000000000024', r.id
       from app.roles r
       where r.club_id = 'c1ab0000-0000-4000-8000-000000000001' and r.key = 'owner'$q$,
    'P0001');
  perform testkit.throws('moderator: die geschuetzte owner-Rolle ist nicht umkonfigurierbar',
    $q$update app.role_permissions rp set level = 'none'
       from app.roles r
       where r.id = rp.role_id and r.key = 'owner'
         and r.club_id = 'c1ab0000-0000-4000-8000-000000000001'
         and rp.capability_key = 'finance'$q$, 'P0001');
  -- Systemrollen sind keine Wegwerfware. Der Moderator ist is_club_admin,
  -- kommt also durch die RLS — hier feuert wirklich der Schutz-Trigger.
  perform testkit.throws('schutz: auch der Admin kann eine Systemrolle nicht loeschen',
    $q$delete from app.roles
        where club_id = 'c1ab0000-0000-4000-8000-000000000001' and key = 'coach'$q$, 'P0001');
  perform testkit.throws('schutz: der key einer Systemrolle ist unveraenderlich',
    $q$update app.roles set key = 'trainer'
        where club_id = 'c1ab0000-0000-4000-8000-000000000001' and key = 'coach'$q$, 'P0001');
  -- ... aber der ANZEIGENAME ist frei (bilingual, RBAC-DESIGN §7)
  perform testkit.affects('rollen: der Anzeigename einer Systemrolle ist frei aenderbar',
    $q$update app.roles set name_de = 'Übungsleiter:in', name_en = 'Instructor'
        where club_id = 'c1ab0000-0000-4000-8000-000000000001' and key = 'coach'$q$, 1);
  -- ... und eigene Rollen sind frei anlegbar (RBAC-DESIGN §1.2)
  perform testkit.succeeds('rollen: eine EIGENE Rolle ist frei anlegbar',
    $q$insert into app.roles (club_id, key, name_de, name_en, sort)
       values ('c1ab0000-0000-4000-8000-000000000001', 'kampfrichter',
               'Kampfrichter:in', 'Judge', 80)$q$);
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- D) Die guest_coach-Befristung greift jetzt ZENTRAL in cap_rank — auch auf
--    den Pfaden, die sie frueher nur mittelbar erzwungen haben (coached_team_ids
--    prueft selbst NUR deleted_at).
-- ---------------------------------------------------------------------------
begin;
update app.club_members
   set valid_until = now() - interval '1 day'
 where id = 'a0000000-0000-4000-8000-000000000006';

select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000006","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"guest_coach"}}',
  true);
set local role authenticated;

do $$
begin
  perform testkit.is_eq('guest_coach (abgelaufen): cap_rank routines = 0',
    app.cap_rank('c1ab0000-0000-4000-8000-000000000001', 'routines')::bigint, 0);
  perform testkit.is_eq('guest_coach (abgelaufen): cap_rank attendance = 0',
    app.cap_rank('c1ab0000-0000-4000-8000-000000000001', 'attendance')::bigint, 0);
  perform testkit.is_eq('guest_coach (abgelaufen): sieht seine betreuten Kueren nicht mehr',
    (select count(*) from app.routines), 0);
end;
$$;
rollback;

-- D2) Positivkontrolle: solange gueltig, loest der Gast-Trainer normal auf.
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000006","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"guest_coach"}}',
  true);
set local role authenticated;

do $$
begin
  perform testkit.is_eq('guest_coach (gueltig): cap_rank routines = read_team (2)',
    app.cap_rank('c1ab0000-0000-4000-8000-000000000001', 'routines')::bigint, 2);
  perform testkit.is_eq('guest_coach (gueltig): cap_rank attendance = edit (4)',
    app.cap_rank('c1ab0000-0000-4000-8000-000000000001', 'attendance')::bigint, 4);
  perform testkit.is_eq('guest_coach (gueltig): betreut genau ein Team (b-03)',
    array_length(app.coached_team_ids('c1ab0000-0000-4000-8000-000000000001'), 1)::bigint, 1);
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- E) team_coaches (RBAC-DESIGN §4) als Sicht auf team_members — eine Wahrheit.
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000002","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"owner"}}',
  true);
set local role authenticated;

do $$
begin
  perform testkit.is_eq('team_coaches: zeigt die 5 Trainer-Zuordnungen des Seeds',
    (select count(*) from app.team_coaches
      where club_id = 'c1ab0000-0000-4000-8000-000000000001'), 5);
  perform testkit.is_eq('team_coaches: Sandra betreut MEHRERE Teams (n:m, §1.4)',
    (select count(*) from app.team_coaches
      where member_id = 'a0000000-0000-4000-8000-000000000001'), 2);
  perform testkit.is_eq('team_coaches: enthaelt keine Skater',
    (select count(*) from app.team_coaches tc
      join app.team_members tm on tm.id = tc.id
     where tm.role <> 'coach'), 0);
end;
$$;
rollback;
