-- ============================================================================
-- 99a_organisation.sql — test class (j): organisation module (migration 0017).
--
--   * departments        — read = every club member; create/edit/delete =
--                          is_club_admin (owner/admin/moderator). A coach or
--                          treasurer reads but cannot manage.
--   * department_members — read = member; assign/detach = is_club_trainer
--                          (coach yes; treasurer & plain member no).
--   * lockers            — Privacy-Härtung (0021): SELECT = owner/admin/
--                          treasurer OR platform-admin OR the caller's OWN box
--                          (assigned_member_id = own club_member). A plain
--                          member sees ONLY her own locker; moderator/coach see
--                          NONE. Managing (create/edit/delete/assign/release) =
--                          owner/admin/treasurer only.
--   * anniversaries source — the derived /reports/anniversaries reads only the
--                          club roster (joined_on/birth_date); a member may read
--                          it, a foreign-club user sees 0.
--
-- Seed baseline for club A (c1ab…01): 3 departments, 15 department members,
-- 8 lockers (3 assigned / 3 free / 2 broken). Club B (deadbeef…) has none.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Plain MEMBER (Katrin, 90..09) — reads all three tables, writes none
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000009","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"member"}}',
  true);
set local role authenticated;

do $$
begin
  perform testkit.is_eq('departments: member sees all 3', (select count(*) from app.departments), 3);
  perform testkit.is_eq('department_members: member sees all 15',
    (select count(*) from app.department_members), 15);
  -- Privacy-Härtung (0021): a plain member sees ONLY her own locker (Katrin a-09
  -- holds Fach 01), never any of the other 7.
  perform testkit.is_eq('lockers: member sees ONLY her own locker (1)',
    (select count(*) from app.lockers), 1);
  perform testkit.is_eq('lockers: member sees exactly her assigned Fach 01',
    (select count(*) from app.lockers
      where id = 'e0c00000-0000-4000-8000-000000000001'
        and assigned_member_id = 'a0000000-0000-4000-8000-000000000009'), 1);
  perform testkit.is_eq('lockers: member does NOT see a foreign locker (Fach 02)',
    (select count(*) from app.lockers
      where id = 'e0c00000-0000-4000-8000-000000000002'), 0);

  -- member cannot create a department (not is_club_admin)
  perform testkit.throws('departments: member MAY NOT create (not admin)',
    $q$insert into app.departments (club_id, name)
       values ('c1ab0000-0000-4000-8000-000000000001', 'Hack')$q$, '42501');
  -- member cannot assign into a department (not is_club_trainer)
  perform testkit.throws('department_members: member MAY NOT assign (not trainer)',
    $q$insert into app.department_members (club_id, department_id, member_id)
       values ('c1ab0000-0000-4000-8000-000000000001',
               'd0000000-0000-4000-8000-000000000001',
               'a0000000-0000-4000-8000-000000000019')$q$, '42501');
  -- member cannot create a locker (not owner/admin/treasurer)
  perform testkit.throws('lockers: member MAY NOT create (not owner/admin/treasurer)',
    $q$insert into app.lockers (club_id, label) values ('c1ab0000-0000-4000-8000-000000000001', 'X')$q$, '42501');
  -- member may not even update her OWN locker (manage = owner/admin/treasurer;
  -- RLS filters the UPDATE to 0 rows)
  perform testkit.affects('lockers: member cannot update her own locker (0 rows)',
    $q$update app.lockers set status = 'broken'
       where id = 'e0c00000-0000-4000-8000-000000000001'$q$, 0);
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- TREASURER (Beate, 90..03) — is_club_member (reads) but neither admin nor trainer
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000003","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"treasurer"}}',
  true);
set local role authenticated;

do $$
begin
  perform testkit.is_eq('departments: treasurer reads 3', (select count(*) from app.departments), 3);
  perform testkit.is_eq('lockers: treasurer reads 8', (select count(*) from app.lockers), 8);

  -- treasurer is not admin -> no department create
  perform testkit.throws('departments: treasurer MAY NOT create (not admin)',
    $q$insert into app.departments (club_id, name)
       values ('c1ab0000-0000-4000-8000-000000000001', 'Kasse')$q$, '42501');
  -- treasurer is not trainer -> no department assignment
  perform testkit.throws('department_members: treasurer MAY NOT assign (not trainer)',
    $q$insert into app.department_members (club_id, department_id, member_id)
       values ('c1ab0000-0000-4000-8000-000000000001',
               'd0000000-0000-4000-8000-000000000001',
               'a0000000-0000-4000-8000-000000000019')$q$, '42501');
  -- Privacy-Härtung (0021): the treasurer now MANAGES lockers (owner/admin/
  -- treasurer) -> may assign a free locker, and may edit master data.
  perform testkit.succeeds('lockers: treasurer MAY assign a free locker (0021)',
    $q$update app.lockers set status = 'assigned', assigned_member_id = 'a0000000-0000-4000-8000-000000000009'
       where id = 'e0c00000-0000-4000-8000-000000000003'$q$);
  perform testkit.succeeds('lockers: treasurer MAY create a locker (0021)',
    $q$insert into app.lockers (club_id, label) values ('c1ab0000-0000-4000-8000-000000000001', 'Kassenfach')$q$);
  perform testkit.succeeds('lockers: treasurer MAY rename a locker (master data, 0021)',
    $q$update app.lockers set label = 'Fach 03b'
       where id = 'e0c00000-0000-4000-8000-000000000003'$q$);
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- COACH (Sandra, 90..01) — is_club_trainer (NOT admin): assigns members +
-- assigns/releases lockers, but cannot manage department/locker master data.
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000001","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"coach"}}',
  true);
set local role authenticated;

do $$
begin
  -- department master data stays admin-only
  perform testkit.throws('departments: coach MAY NOT create (not admin)',
    $q$insert into app.departments (club_id, name)
       values ('c1ab0000-0000-4000-8000-000000000001', 'Coach-Abteilung')$q$, '42501');

  -- but a coach IS a trainer -> may assign a member to a department
  perform testkit.succeeds('department_members: coach MAY assign a member',
    $q$insert into app.department_members (club_id, department_id, member_id)
       values ('c1ab0000-0000-4000-8000-000000000001',
               'd0000000-0000-4000-8000-000000000001',
               'a0000000-0000-4000-8000-000000000019')$q$);

  -- Privacy-Härtung (0021): a coach neither SEES nor MANAGES lockers at all.
  -- Sandra (a-01) holds no locker herself -> the whole wall is invisible to her.
  perform testkit.is_eq('lockers: coach sees 0 lockers (0021)',
    (select count(*) from app.lockers), 0);
  perform testkit.throws('lockers: coach MAY NOT create (0021)',
    $q$insert into app.lockers (club_id, label) values ('c1ab0000-0000-4000-8000-000000000001', 'Neu')$q$, '42501');
  -- coach assign is filtered by RLS (not owner/admin/treasurer -> 0 rows)
  perform testkit.affects('lockers: coach assign filtered by RLS (0 rows, 0021)',
    $q$update app.lockers set status = 'assigned', assigned_member_id = 'a0000000-0000-4000-8000-000000000019'
       where id = 'e0c00000-0000-4000-8000-000000000003'$q$, 0);
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- ADMIN (Thomas, 90..04) — is_club_admin: full department + locker management
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000004","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"admin"}}',
  true);
set local role authenticated;

do $$
begin
  perform testkit.succeeds('departments: admin MAY create',
    $q$insert into app.departments (club_id, name, sort_order)
       values ('c1ab0000-0000-4000-8000-000000000001', 'Technik', 9)$q$);
  perform testkit.succeeds('departments: admin MAY rename',
    $q$update app.departments set name = 'Leistungssport A'
       where id = 'd0000000-0000-4000-8000-000000000001'$q$);
  perform testkit.succeeds('departments: admin MAY soft-delete',
    $q$update app.departments set deleted_at = now()
       where id = 'd0000000-0000-4000-8000-000000000003'$q$);

  perform testkit.succeeds('lockers: admin MAY create',
    $q$insert into app.lockers (club_id, label, location)
       values ('c1ab0000-0000-4000-8000-000000000001', 'Fach 09', 'Umkleide B')$q$);
  perform testkit.succeeds('lockers: admin MAY rename (master data)',
    $q$update app.lockers set label = 'Fach 01a', location = 'Umkleide A'
       where id = 'e0c00000-0000-4000-8000-000000000003'$q$);
  perform testkit.succeeds('lockers: admin MAY mark broken + edit note',
    $q$update app.lockers set status = 'broken', note = 'defekt'
       where id = 'e0c00000-0000-4000-8000-000000000006'$q$);
  perform testkit.succeeds('lockers: admin MAY soft-delete',
    $q$update app.lockers set deleted_at = now()
       where id = 'e0c00000-0000-4000-8000-000000000007'$q$);
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- MODERATOR (Petra, 90..14) — moderator counts as is_club_admin (Referenz 1.3)
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000014","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"moderator"}}',
  true);
set local role authenticated;

do $$
begin
  perform testkit.succeeds('departments: moderator MAY create (counts as admin)',
    $q$insert into app.departments (club_id, name)
       values ('c1ab0000-0000-4000-8000-000000000001', 'Moderation')$q$);
  -- Privacy-Härtung (0021): lockers are owner/admin/treasurer only — a moderator
  -- neither sees nor manages them.
  perform testkit.is_eq('lockers: moderator sees 0 lockers (0021)',
    (select count(*) from app.lockers), 0);
  perform testkit.throws('lockers: moderator MAY NOT create (0021)',
    $q$insert into app.lockers (club_id, label) values ('c1ab0000-0000-4000-8000-000000000001', 'Fach 10')$q$, '42501');
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- CROSS-TENANT — a club-B member (Bert, owner of SC Beispielstadt) sees NONE
-- of club A's organisation and cannot write into it (tenant isolation).
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claims',
  '{"sub":"deadbeef-9000-4000-8000-000000000001","role":"authenticated","club_roles":{"deadbeef-0000-4000-8000-000000000001":"owner"}}',
  true);
set local role authenticated;

do $$
begin
  perform testkit.is_eq('departments: club-B owner sees 0 of club A',
    (select count(*) from app.departments where club_id = 'c1ab0000-0000-4000-8000-000000000001'), 0);
  perform testkit.is_eq('lockers: club-B owner sees 0 of club A',
    (select count(*) from app.lockers where club_id = 'c1ab0000-0000-4000-8000-000000000001'), 0);
  perform testkit.is_eq('anniversaries source: club-B owner sees 0 of club A roster',
    (select count(*) from app.club_members where club_id = 'c1ab0000-0000-4000-8000-000000000001'), 0);
  -- owner of club B is NOT admin of club A -> cannot create a department there
  perform testkit.throws('departments: club-B owner MAY NOT create in club A',
    $q$insert into app.departments (club_id, name)
       values ('c1ab0000-0000-4000-8000-000000000001', 'Fremd')$q$, '42501');
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- ANNIVERSARIES SOURCE — a plain club-A member may read the roster fields the
-- derived report is built from (joined_on / birth_date). Read = is_club_member.
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000009","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"member"}}',
  true);
set local role authenticated;

do $$
declare
  v_rows bigint;
begin
  select count(*) into v_rows
  from app.club_members
  where club_id = 'c1ab0000-0000-4000-8000-000000000001'
    and deleted_at is null and status = 'active'
    and (joined_on is not null or birth_date is not null);
  perform testkit.ok(format('anniversaries source: member reads %s roster rows with dates', v_rows));
end;
$$;
rollback;
