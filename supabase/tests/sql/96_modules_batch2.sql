-- ============================================================================
-- 96_modules_batch2.sql — test class (i): modules batch 2 (migration 0009).
--
--   * facilities / equipment / achievements — read = every club member;
--       write = is_club_trainer only (coach yes, treasurer/plain member no).
--   * facility_bookings / equipment_reservations — read = member; a plain
--       member may INSERT/EDIT only FOR THEMSELVES (booked_by/reserved_by =
--       own club_members row), never for another member; coaching staff may
--       act for anyone and edit foreign rows.
--
-- Seed baseline for club A: 3 facilities, 4 equipment, 4 bookings, 2
-- reservations, 6 achievements. Member Katrin = profile 90..09 / member a-09;
-- Coach Sandra = profile 90..01 / member a-01.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Plain MEMBER (Katrin, 90..09 / a-09) — reads all; self-service only
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000009","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"member"}}',
  true);
set local role authenticated;

do $$
begin
  -- read: member sees facilities, equipment and the medal wall
  perform testkit.is_eq('facilities: member sees all 3',   (select count(*) from app.facilities), 3);
  perform testkit.is_eq('equipment: member sees all 4',    (select count(*) from app.equipment), 4);
  perform testkit.is_eq('achievements: member sees all 6', (select count(*) from app.achievements), 6);
  perform testkit.is_eq('bookings: member sees all 4',     (select count(*) from app.facility_bookings), 4);
  perform testkit.is_eq('reservations: member sees all 2', (select count(*) from app.equipment_reservations), 2);

  -- write master data: a plain member is NOT is_club_trainer -> denied
  perform testkit.throws('facilities: member MAY NOT create a facility (not a trainer)',
    $q$insert into app.facilities (club_id, name)
       values ('c1ab0000-0000-4000-8000-000000000001', 'Hack-Halle')$q$, '42501');
  perform testkit.throws('equipment: member MAY NOT create equipment (not a trainer)',
    $q$insert into app.equipment (club_id, name)
       values ('c1ab0000-0000-4000-8000-000000000001', 'Hack-Gear')$q$, '42501');
  perform testkit.throws('achievements: member MAY NOT award a medal (not a trainer)',
    $q$insert into app.achievements (club_id, member_id, title, achieved_on)
       values ('c1ab0000-0000-4000-8000-000000000001',
               'a0000000-0000-4000-8000-000000000009', 'Selbst-Medaille', current_date)$q$, '42501');

  -- self-service booking: member MAY book for her OWN membership (a-09)
  perform testkit.succeeds('bookings: member MAY book for herself',
    $q$insert into app.facility_bookings
         (facility_id, club_id, booked_by_member_id, title, starts_at, ends_at)
       values ('fac00000-0000-4000-8000-000000000001',
               'c1ab0000-0000-4000-8000-000000000001',
               'a0000000-0000-4000-8000-000000000009', 'Eigenbuchung',
               now() + interval '1 day', now() + interval '1 day 1 hour')$q$);
  -- but NOT for someone else (booked_by = coach a-01) — with-check denies it
  perform testkit.throws('bookings: member MAY NOT book for another member',
    $q$insert into app.facility_bookings
         (facility_id, club_id, booked_by_member_id, title, starts_at, ends_at)
       values ('fac00000-0000-4000-8000-000000000001',
               'c1ab0000-0000-4000-8000-000000000001',
               'a0000000-0000-4000-8000-000000000001', 'Fremdbuchung',
               now() + interval '2 day', now() + interval '2 day 1 hour')$q$, '42501');

  -- self-service reservation: same rule
  perform testkit.succeeds('reservations: member MAY reserve for herself',
    $q$insert into app.equipment_reservations
         (equipment_id, club_id, reserved_by_member_id, quantity, from_at, to_at)
       values ('e9000000-0000-4000-8000-000000000001',
               'c1ab0000-0000-4000-8000-000000000001',
               'a0000000-0000-4000-8000-000000000009', 1,
               now() + interval '1 day', now() + interval '2 day')$q$);
  perform testkit.throws('reservations: member MAY NOT reserve for another member',
    $q$insert into app.equipment_reservations
         (equipment_id, club_id, reserved_by_member_id, quantity, from_at, to_at)
       values ('e9000000-0000-4000-8000-000000000001',
               'c1ab0000-0000-4000-8000-000000000001',
               'a0000000-0000-4000-8000-000000000005', 1,
               now() + interval '1 day', now() + interval '2 day')$q$, '42501');

  -- member MAY NOT edit a FOREIGN booking (seed b0c..01 belongs to coach a-01)
  perform testkit.affects('bookings: member cannot edit a foreign booking (0 rows under RLS)',
    $q$update app.facility_bookings set title = 'gekapert'
        where id = 'b0c00000-0000-4000-8000-000000000001'$q$, 0);
  perform testkit.affects('bookings: member cannot soft-delete a foreign booking (0 rows)',
    $q$update app.facility_bookings set deleted_at = now()
        where id = 'b0c00000-0000-4000-8000-000000000001'$q$, 0);
  -- member cannot edit a foreign reservation (seed e9c..01 belongs to coach a-05)
  perform testkit.affects('reservations: member cannot edit a foreign reservation (0 rows)',
    $q$update app.equipment_reservations set quantity = 99
        where id = 'e9c00000-0000-4000-8000-000000000001'$q$, 0);
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- COACH (Sandra, 90..01 / a-01) — is_club_trainer: full write + acts for others
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000001","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"coach"}}',
  true);
set local role authenticated;

do $$
begin
  -- master data: a coach IS a trainer
  perform testkit.succeeds('facilities: coach MAY create a facility',
    $q$insert into app.facilities (club_id, name, kind)
       values ('c1ab0000-0000-4000-8000-000000000001', 'Zusatzhalle', 'hall')$q$);
  perform testkit.succeeds('equipment: coach MAY create equipment',
    $q$insert into app.equipment (club_id, name, total_quantity, available_quantity)
       values ('c1ab0000-0000-4000-8000-000000000001', 'Neue Schoner', 5, 5)$q$);
  perform testkit.succeeds('achievements: coach MAY award a medal',
    $q$insert into app.achievements (club_id, member_id, title, medal, achieved_on)
       values ('c1ab0000-0000-4000-8000-000000000001',
               'a0000000-0000-4000-8000-000000000016', 'Neuer Titel', 'gold', current_date)$q$);

  -- coach may book FOR ANOTHER member (a-05) — trainer path
  perform testkit.succeeds('bookings: coach MAY book for another member',
    $q$insert into app.facility_bookings
         (facility_id, club_id, booked_by_member_id, title, starts_at, ends_at)
       values ('fac00000-0000-4000-8000-000000000001',
               'c1ab0000-0000-4000-8000-000000000001',
               'a0000000-0000-4000-8000-000000000005', 'Für Anna-Lena',
               now() + interval '3 day', now() + interval '3 day 1 hour')$q$);

  -- coach may edit/delete a FOREIGN member's booking (self-service row a-09 is
  -- one of the seeds? no — but coach can touch any: edit seed b0c..02 by a-05)
  perform testkit.affects('bookings: coach MAY edit a foreign booking (1 row)',
    $q$update app.facility_bookings set title = 'Trainer-Update'
        where id = 'b0c00000-0000-4000-8000-000000000002'$q$, 1);
  perform testkit.affects('reservations: coach MAY edit a foreign reservation (1 row)',
    $q$update app.equipment_reservations set status = 'returned'
        where id = 'e9c00000-0000-4000-8000-000000000002'$q$, 1);
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- TREASURER (Beate, 90..03 / a-03) — reads (is_club_member) but NOT a trainer
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000003","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"treasurer"}}',
  true);
set local role authenticated;

do $$
begin
  perform testkit.is_eq('facilities: treasurer reads all 3',   (select count(*) from app.facilities), 3);
  perform testkit.is_eq('equipment: treasurer reads all 4',    (select count(*) from app.equipment), 4);
  perform testkit.is_eq('achievements: treasurer reads all 6', (select count(*) from app.achievements), 6);

  -- treasurer is NOT is_club_trainer -> no master-data writes
  perform testkit.throws('facilities: treasurer MAY NOT create a facility (not a trainer)',
    $q$insert into app.facilities (club_id, name)
       values ('c1ab0000-0000-4000-8000-000000000001', 'Kassenhalle')$q$, '42501');
  perform testkit.throws('achievements: treasurer MAY NOT award a medal (not a trainer)',
    $q$insert into app.achievements (club_id, member_id, title, achieved_on)
       values ('c1ab0000-0000-4000-8000-000000000001',
               'a0000000-0000-4000-8000-000000000016', 'Kasse', current_date)$q$, '42501');

  -- but a treasurer is still a member -> self-service booking works (a-03)
  perform testkit.succeeds('bookings: treasurer MAY book for herself (is a member)',
    $q$insert into app.facility_bookings
         (facility_id, club_id, booked_by_member_id, title, starts_at, ends_at)
       values ('fac00000-0000-4000-8000-000000000002',
               'c1ab0000-0000-4000-8000-000000000001',
               'a0000000-0000-4000-8000-000000000003', 'Kassensitzung',
               now() + interval '5 day', now() + interval '5 day 2 hour')$q$);
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- PLATFORM ADMIN (90..90) — cross-club READ, but NOT a trainer anywhere:
-- may read facilities/equipment/medals, may NOT create a facility (no trainer
-- role) and may NOT plant a booking (no own membership row).
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000090","role":"authenticated","app_metadata":{"is_platform_admin":true}}',
  true);
set local role authenticated;

do $$
begin
  perform testkit.is_eq('facilities: platform admin reads across tenants (3)',
    (select count(*) from app.facilities), 3);
  perform testkit.is_eq('equipment: platform admin reads across tenants (4)',
    (select count(*) from app.equipment), 4);
  perform testkit.is_eq('achievements: platform admin reads across tenants (6)',
    (select count(*) from app.achievements), 6);

  -- platform admin is is_club_member but NOT is_club_trainer -> no facility write
  perform testkit.throws('facilities: platform admin MAY NOT create a facility (not a trainer)',
    $q$insert into app.facilities (club_id, name)
       values ('c1ab0000-0000-4000-8000-000000000001', 'Plattform-Halle')$q$, '42501');
  -- and has no own membership -> cannot self-book either
  perform testkit.throws('bookings: platform admin MAY NOT plant a booking (no membership, not a trainer)',
    $q$insert into app.facility_bookings
         (facility_id, club_id, booked_by_member_id, title, starts_at, ends_at)
       values ('fac00000-0000-4000-8000-000000000001',
               'c1ab0000-0000-4000-8000-000000000001',
               'a0000000-0000-4000-8000-000000000001', 'Plattform',
               now() + interval '1 day', now() + interval '1 day 1 hour')$q$, '42501');
end;
$$;
rollback;
