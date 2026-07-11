-- ============================================================================
-- 92_cluster6a.sql — test class: Wartelisten, Budget, Familie-Integrität und
-- Profilfoto (migration 0020).
--
-- Rights (Referenz 1.3, enforced server-side by RLS as the second line of
-- defense):
--   * waitlists — read/write = own row OR is_club_trainer. A member queues
--     themselves, never someone else; a trainer manages the whole queue.
--   * budgets   — read/write = can_manage_finance (owner/admin/moderator/
--     treasurer); a plain member/coach sees nothing and may not write.
--   * guardianships — writes stay owner/admin only at the RLS level (the family
--     self-service is an API/service-mode path); the new same-club trigger
--     rejects a cross-tenant relation.
--   * club_members.avatar_key — a member sets it on their OWN row only
--     (Profilfoto), never on a foreign row.
--
-- Seed (migration 0020 + seed.sql): 2 waitlist entries (Lina a0..07 facility,
-- Maja a0..16 equipment), 5 budget rows for the current year. Club B from the
-- fixture (deadbeef-…) provides a cross-tenant member for the trigger test.
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- WARTELISTEN — trainer (coach Sandra) manages the whole queue.
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000001","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"coach"}}',
  true);
set local role authenticated;

do $$
begin
  perform testkit.is_eq('waitlist: trainer sees the whole club queue (2 seeded)',
    (select count(*) from app.waitlists), 2);
  perform testkit.affects('waitlist: trainer MAY update any entry (offer Lina''s slot)',
    $q$update app.waitlists set status = 'offered'
        where member_id = 'a0000000-0000-4000-8000-000000000007'
          and deleted_at is null$q$, 1);
  perform testkit.succeeds('waitlist: trainer MAY queue anyone (Johanna for a team slot)',
    $q$insert into app.waitlists (club_id, member_id, kind, note)
       values ('c1ab0000-0000-4000-8000-000000000001',
               'a0000000-0000-4000-8000-000000000017', 'team', 'Vom Trainer eingetragen')$q$);
end;
$$;

-- ---------------------------------------------------------------------------
-- WARTELISTEN — member Katrin (plain member) self-service only.
-- ---------------------------------------------------------------------------
reset role;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000009","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"member"}}',
  true);
set local role authenticated;

do $$
begin
  perform testkit.succeeds('waitlist: member MAY add HERSELF to a queue',
    $q$insert into app.waitlists (club_id, member_id, kind, note)
       values ('c1ab0000-0000-4000-8000-000000000001',
               'a0000000-0000-4000-8000-000000000009', 'facility', 'Selbst eingetragen')$q$);
  perform testkit.is_eq('waitlist: member sees only HER OWN entries (1), not the queue',
    (select count(*) from app.waitlists), 1);
  perform testkit.throws('waitlist: member MAY NOT queue someone else',
    $q$insert into app.waitlists (club_id, member_id, kind)
       values ('c1ab0000-0000-4000-8000-000000000001',
               'a0000000-0000-4000-8000-000000000016', 'equipment')$q$, '42501');
  perform testkit.affects('waitlist: member cannot edit a FOREIGN entry (silent no-op)',
    $q$update app.waitlists set status = 'cancelled'
        where member_id = 'a0000000-0000-4000-8000-000000000007'$q$, 0);
end;
$$;

-- ---------------------------------------------------------------------------
-- BUDGET — treasurer reads + writes; moderator too (can_manage_finance).
-- ---------------------------------------------------------------------------
reset role;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000003","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"treasurer"}}',
  true);
set local role authenticated;

do $$
begin
  perform testkit.is_eq('budget: treasurer reads the year plan (5 categories)',
    (select count(*) from app.budgets), 5);
  perform testkit.succeeds('budget: treasurer MAY add a plan row (next year)',
    $q$insert into app.budgets (club_id, year, category_id, planned_cents, note)
       values ('c1ab0000-0000-4000-8000-000000000001',
               extract(year from now())::int + 1,
               'ca100000-0000-4000-8000-000000000001', 1300000, 'Plan Folgejahr')$q$);
end;
$$;

reset role;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000014","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"moderator"}}',
  true);
set local role authenticated;

do $$
begin
  perform testkit.is_eq('budget: moderator counts as finance and reads the plan (6)',
    (select count(*) from app.budgets), 6);
end;
$$;

-- ---------------------------------------------------------------------------
-- BUDGET — plain member & coach are locked out (not can_manage_finance).
-- ---------------------------------------------------------------------------
reset role;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000009","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"member"}}',
  true);
set local role authenticated;

do $$
begin
  perform testkit.is_eq('budget: a plain member sees NO budget rows',
    (select count(*) from app.budgets), 0);
  perform testkit.throws('budget: a plain member MAY NOT create a plan row',
    $q$insert into app.budgets (club_id, year, category_id, planned_cents)
       values ('c1ab0000-0000-4000-8000-000000000001', extract(year from now())::int,
               'ca100000-0000-4000-8000-000000000002', 1000)$q$, '42501');
end;
$$;

reset role;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000001","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"coach"}}',
  true);
set local role authenticated;

do $$
begin
  perform testkit.is_eq('budget: a coach (trainer, not finance) sees NO budget rows',
    (select count(*) from app.budgets), 0);
end;
$$;

-- ---------------------------------------------------------------------------
-- FAMILIE — same-club integrity trigger + RLS stays admin-only for writes.
-- ---------------------------------------------------------------------------
reset role;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000004","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"admin"}}',
  true);
set local role authenticated;

do $$
begin
  perform testkit.throws('family: a CROSS-CLUB guardianship is rejected (same-club guard)',
    $q$insert into app.guardianships (club_id, guardian_member_id, child_member_id)
       values ('c1ab0000-0000-4000-8000-000000000001',
               'a0000000-0000-4000-8000-000000000016',
               'deadbeef-a000-4000-8000-000000000001')$q$, '23514');
  perform testkit.succeeds('family: admin MAY link two members of the SAME club',
    $q$insert into app.guardianships (club_id, guardian_member_id, child_member_id)
       values ('c1ab0000-0000-4000-8000-000000000001',
               'a0000000-0000-4000-8000-000000000016',
               'a0000000-0000-4000-8000-000000000015')$q$);
end;
$$;

reset role;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000009","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"member"}}',
  true);
set local role authenticated;

do $$
begin
  -- RLS keeps guardianship writes owner/admin only; the parent self-service is
  -- a deliberate API/service-mode path, NOT a direct client INSERT.
  perform testkit.throws('family: a plain member cannot self-INSERT a guardianship via RLS',
    $q$insert into app.guardianships (club_id, guardian_member_id, child_member_id)
       values ('c1ab0000-0000-4000-8000-000000000001',
               'a0000000-0000-4000-8000-000000000009',
               'a0000000-0000-4000-8000-000000000015')$q$, '42501');
end;
$$;

-- ---------------------------------------------------------------------------
-- PROFILFOTO — a member sets avatar_key on the OWN row only.
-- ---------------------------------------------------------------------------
do $$
begin
  perform testkit.affects('photo: member MAY set avatar_key on HER OWN membership (1 row)',
    $q$update app.club_members set avatar_key = 'katrin-avatar-01.jpg'
        where id = 'a0000000-0000-4000-8000-000000000009'$q$, 1);
  perform testkit.affects('photo: member cannot set avatar_key on a FOREIGN member (0 rows)',
    $q$update app.club_members set avatar_key = 'hijack-01.jpg'
        where id = 'a0000000-0000-4000-8000-000000000012'$q$, 0);
end;
$$;

rollback;
