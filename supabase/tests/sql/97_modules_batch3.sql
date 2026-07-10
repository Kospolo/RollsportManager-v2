-- ============================================================================
-- 97_modules_batch3.sql — test class (j): modules batch 3 (migration 0010).
--
--   * training_slots / duty_requirements — read = every club member;
--       write = is_club_trainer only (coach yes, treasurer/plain member/
--       platform admin no).
--   * duty_entries — "eigene Ist-Stunden": read/edit = OWN entry (member_id =
--       own club_members row) OR trainer; a plain member may record only for
--       themselves and may NOT self-approve (approved is trainer-only, guarded
--       by app.duty_entries_guard_approved -> 42501). A trainer sees all rows,
--       records for anyone and may approve.
--
-- Seed baseline for club A (seed.sql): 5 training_slots, 1 duty_requirement,
-- 6 duty_entries. Katrin = profile 90..09 / member a-09 owns exactly one entry
-- (d0e..01, approved). Coach Sandra = 90..01 / a-01. Treasurer Beate = 90..03 /
-- a-03 (member, no own entry). Foreign entry d0e..04 belongs to member a-17.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Plain MEMBER (Katrin, 90..09 / a-09) — reads plan; owns 1 duty entry;
-- self-service recording only; cannot self-approve.
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000009","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"member"}}',
  true);
set local role authenticated;

do $$
begin
  -- read: member sees the whole training plan and the season target
  perform testkit.is_eq('training_slots: member sees all 5',    (select count(*) from app.training_slots), 5);
  perform testkit.is_eq('duty_requirements: member sees the 1', (select count(*) from app.duty_requirements), 1);
  -- but duty_entries are private: she sees ONLY her own (a-09 -> 1 row)
  perform testkit.is_eq('duty_entries: member sees only her own (1)',
    (select count(*) from app.duty_entries), 1);

  -- write plan/target: a plain member is NOT is_club_trainer -> denied
  perform testkit.throws('training_slots: member MAY NOT create a slot (not a trainer)',
    $q$insert into app.training_slots (club_id, weekday, starts_time, ends_time)
       values ('c1ab0000-0000-4000-8000-000000000001', 3, '17:00', '18:00')$q$, '42501');
  perform testkit.throws('duty_requirements: member MAY NOT set a target (not a trainer)',
    $q$insert into app.duty_requirements (club_id, season_label, required_hours, period_start, period_end)
       values ('c1ab0000-0000-4000-8000-000000000001', 'Hack', 5, current_date, current_date)$q$, '42501');

  -- self-service duty entry: member MAY record hours FOR HERSELF (a-09)
  perform testkit.succeeds('duty_entries: member MAY record hours for herself',
    $q$insert into app.duty_entries (club_id, member_id, hours, activity_date, kind)
       values ('c1ab0000-0000-4000-8000-000000000001',
               'a0000000-0000-4000-8000-000000000009', 2.0, current_date, 'helper')$q$);
  -- but NOT for another member (a-05) — with-check denies it
  perform testkit.throws('duty_entries: member MAY NOT record for another member',
    $q$insert into app.duty_entries (club_id, member_id, hours, activity_date)
       values ('c1ab0000-0000-4000-8000-000000000001',
               'a0000000-0000-4000-8000-000000000005', 2.0, current_date)$q$, '42501');
  -- and may NOT self-approve her own hours (trigger, trainer-only)
  perform testkit.throws('duty_entries: member MAY NOT create an APPROVED entry (self-approve blocked)',
    $q$insert into app.duty_entries (club_id, member_id, hours, activity_date, approved)
       values ('c1ab0000-0000-4000-8000-000000000001',
               'a0000000-0000-4000-8000-000000000009', 2.0, current_date, true)$q$, '42501');

  -- she MAY edit a non-approval field on her OWN entry (d0e..01)
  perform testkit.affects('duty_entries: member MAY edit note on her own entry (1 row)',
    $q$update app.duty_entries set note = 'korrigiert'
        where id = 'd0e00000-0000-4000-8000-000000000001'$q$, 1);
  -- but may NOT flip approved on her own entry (trigger -> 42501)
  perform testkit.throws('duty_entries: member MAY NOT change approved on her own entry',
    $q$update app.duty_entries set approved = false
        where id = 'd0e00000-0000-4000-8000-000000000001'$q$, '42501');

  -- a FOREIGN entry (a-17, d0e..04) is invisible + untouchable (RLS -> 0 rows)
  perform testkit.affects('duty_entries: member cannot edit a foreign entry (0 rows under RLS)',
    $q$update app.duty_entries set hours = 99
        where id = 'd0e00000-0000-4000-8000-000000000004'$q$, 0);
  perform testkit.affects('duty_entries: member cannot soft-delete a foreign entry (0 rows)',
    $q$update app.duty_entries set deleted_at = now()
        where id = 'd0e00000-0000-4000-8000-000000000004'$q$, 0);
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- COACH (Sandra, 90..01 / a-01) — is_club_trainer: full write, sees all,
-- records for anyone, may approve.
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000001","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"coach"}}',
  true);
set local role authenticated;

do $$
begin
  -- trainer sees ALL duty entries (all 6), not just own
  perform testkit.is_eq('duty_entries: coach sees all 6', (select count(*) from app.duty_entries), 6);

  perform testkit.succeeds('training_slots: coach MAY create a slot',
    $q$insert into app.training_slots (club_id, team_id, weekday, starts_time, ends_time)
       values ('c1ab0000-0000-4000-8000-000000000001',
               'b0000000-0000-4000-8000-000000000002', 3, '17:00', '18:30')$q$);
  perform testkit.succeeds('duty_requirements: coach MAY set a target',
    $q$insert into app.duty_requirements (club_id, season_label, required_hours, period_start, period_end)
       values ('c1ab0000-0000-4000-8000-000000000001', 'Zusatz-Soll', 8, current_date, current_date + 90)$q$);

  -- coach may record FOR ANOTHER member AND may create it approved
  perform testkit.succeeds('duty_entries: coach MAY record an APPROVED entry for another member',
    $q$insert into app.duty_entries (club_id, member_id, hours, activity_date, kind, approved)
       values ('c1ab0000-0000-4000-8000-000000000001',
               'a0000000-0000-4000-8000-000000000017', 3.0, current_date, 'competition', true)$q$);
  -- coach may approve a member's pending entry (d0e..04, a-17)
  perform testkit.affects('duty_entries: coach MAY approve a foreign pending entry (1 row)',
    $q$update app.duty_entries set approved = true
        where id = 'd0e00000-0000-4000-8000-000000000004'$q$, 1);
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- TREASURER (Beate, 90..03 / a-03) — is_club_member but NOT a trainer, and
-- has no own duty entry: reads plan, cannot write plan, sees no duty entries,
-- but may still self-record (is a member).
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000003","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"treasurer"}}',
  true);
set local role authenticated;

do $$
begin
  perform testkit.is_eq('training_slots: treasurer reads all 5',   (select count(*) from app.training_slots), 5);
  perform testkit.is_eq('duty_requirements: treasurer reads the 1', (select count(*) from app.duty_requirements), 1);
  -- not a trainer, no own entry -> sees NO duty entries
  perform testkit.is_eq('duty_entries: treasurer (non-trainer) sees none of the foreign entries (0)',
    (select count(*) from app.duty_entries), 0);

  perform testkit.throws('training_slots: treasurer MAY NOT create a slot (not a trainer)',
    $q$insert into app.training_slots (club_id, weekday, starts_time, ends_time)
       values ('c1ab0000-0000-4000-8000-000000000001', 2, '18:00', '19:00')$q$, '42501');

  -- but a treasurer is still a member -> self-service recording works (a-03)
  perform testkit.succeeds('duty_entries: treasurer MAY record hours for herself (is a member)',
    $q$insert into app.duty_entries (club_id, member_id, hours, activity_date, kind)
       values ('c1ab0000-0000-4000-8000-000000000001',
               'a0000000-0000-4000-8000-000000000003', 1.5, current_date, 'helper')$q$);
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- PLATFORM ADMIN (90..90) — cross-club READ of the plan (is_club_member), but
-- NOT a trainer (no plan writes) and NOT an entry owner (duty_entries are
-- own-or-trainer only -> invisible, like the private notes table).
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000090","role":"authenticated","app_metadata":{"is_platform_admin":true}}',
  true);
set local role authenticated;

do $$
begin
  perform testkit.is_eq('training_slots: platform admin reads across tenants (5)',
    (select count(*) from app.training_slots), 5);
  perform testkit.is_eq('duty_requirements: platform admin reads across tenants (1)',
    (select count(*) from app.duty_requirements), 1);
  -- duty_entries are own-or-trainer only: a platform admin is neither -> 0
  perform testkit.is_eq('duty_entries: platform admin cannot read private entries (0)',
    (select count(*) from app.duty_entries), 0);

  perform testkit.throws('training_slots: platform admin MAY NOT create a slot (not a trainer)',
    $q$insert into app.training_slots (club_id, weekday, starts_time, ends_time)
       values ('c1ab0000-0000-4000-8000-000000000001', 4, '17:00', '18:00')$q$, '42501');
end;
$$;
rollback;
