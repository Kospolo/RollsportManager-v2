-- ============================================================================
-- 30_guest_coach_expiry.sql — test class (c): guest_coach after valid_until.
--
-- Guest coaches are time-boxed memberships (role=guest_coach, valid_until).
-- The expiry MUST be enforced server-side (in the RLS helpers), because JWT
-- claims can be up to token-lifetime stale. After valid_until (or when the
-- membership is no longer active) the very same claims grant NOTHING anymore.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Milena Oeztuerk while her membership is valid (seed: +30 days)
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000006","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"guest_coach"}}',
  true);
set local role authenticated;

do $$
begin
  perform testkit.is_eq('guest_coach (valid): sees the club',
    (select count(*) from app.clubs), 1);
  perform testkit.is_eq('guest_coach (valid): sees the roster (24)',
    (select count(*) from app.club_members), 24);
  perform testkit.succeeds('guest_coach (valid): MAY record attendance (her core job)',
    $q$insert into app.attendance (club_id, event_id, member_id, status)
       values ('c1ab0000-0000-4000-8000-000000000001',
               'e0000000-0000-4000-8000-000000000004',
               'a0000000-0000-4000-8000-000000000020', 'present')$q$);
  perform testkit.succeeds('guest_coach (valid): MAY add routine markers',
    $q$insert into app.routine_markers (club_id, routine_id, time_ms, label)
       values ('c1ab0000-0000-4000-8000-000000000001',
               'd0000000-0000-4000-8000-000000000001', 999, 'Guest note')$q$);
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- Same claims, but the membership row expired yesterday.
-- (Expiry is done as superuser INSIDE this transaction and rolled back.)
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
  perform testkit.is_eq('guest_coach (expired): the club vanishes',
    (select count(*) from app.clubs), 0);
  perform testkit.is_eq('guest_coach (expired): no roster',
    (select count(*) from app.club_members), 0);
  perform testkit.is_eq('guest_coach (expired): no events',
    (select count(*) from app.events), 0);
  perform testkit.is_eq('guest_coach (expired): no routines',
    (select count(*) from app.routines), 0);
  perform testkit.throws('guest_coach (expired): attendance INSERT is rejected',
    $q$insert into app.attendance (club_id, event_id, member_id, status)
       values ('c1ab0000-0000-4000-8000-000000000001',
               'e0000000-0000-4000-8000-000000000004',
               'a0000000-0000-4000-8000-000000000020', 'present')$q$, '42501');
  perform testkit.throws('guest_coach (expired): routine marker INSERT is rejected',
    $q$insert into app.routine_markers (club_id, routine_id, time_ms, label)
       values ('c1ab0000-0000-4000-8000-000000000001',
               'd0000000-0000-4000-8000-000000000001', 998, 'Too late')$q$, '42501');
  perform testkit.throws('guest_coach (expired): RSVP INSERT is rejected (no longer a member)',
    $q$insert into app.event_rsvps (club_id, event_id, member_id, status)
       values ('c1ab0000-0000-4000-8000-000000000001',
               'e0000000-0000-4000-8000-000000000013',
               'a0000000-0000-4000-8000-000000000006', 'going')$q$, '42501');
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- Same claims, valid_until still in the future, but status left the club.
-- ---------------------------------------------------------------------------
begin;
update app.club_members
   set status = 'left'
 where id = 'a0000000-0000-4000-8000-000000000006';

select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000006","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"guest_coach"}}',
  true);
set local role authenticated;

do $$
begin
  perform testkit.is_eq('guest_coach (status=left): access is revoked server-side',
    (select count(*) from app.clubs), 0);
  perform testkit.throws('guest_coach (status=left): attendance INSERT is rejected',
    $q$insert into app.attendance (club_id, event_id, member_id, status)
       values ('c1ab0000-0000-4000-8000-000000000001',
               'e0000000-0000-4000-8000-000000000004',
               'a0000000-0000-4000-8000-000000000020', 'present')$q$, '42501');
end;
$$;
rollback;
