-- ============================================================================
-- 20_privilege_escalation.sql — test class (b): privilege escalation.
--
-- The v1 disaster class: a member promoted himself to super_admin via a
-- writable role column. v2 must block ALL of these paths structurally:
--   * member UPDATEs own role            -> silently filtered (0 rows)
--   * member INSERTs roster rows         -> rejected (own AND foreign club)
--   * admin UPDATEs own role             -> rejected by trigger
--   * admin touches owner rows           -> rejected by trigger
--   * admin INSERTs a new owner row      -> rejected by trigger (gap found
--                                           during this suite, fixed in 0002)
--   * club_id is immutable               -> rejected even for superuser
-- Positive controls prove the legitimate paths still work.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Plain member (Katrin Gruenewald)
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000009","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"member"}}',
  true);
set local role authenticated;

do $$
begin
  perform testkit.affects('escalation (v1 gap): member UPDATE of own role is a silent no-op',
    $q$update app.club_members set role = 'admin'
        where id = 'a0000000-0000-4000-8000-000000000009'$q$, 0);
  perform testkit.affects('escalation: member cannot touch other roster rows (0 rows)',
    $q$update app.club_members set role = 'member'
        where id = 'a0000000-0000-4000-8000-000000000004'$q$, 0);
  perform testkit.throws('escalation: member INSERT into the OWN club roster is rejected',
    $q$insert into app.club_members (club_id, first_name, last_name, role, status)
       values ('c1ab0000-0000-4000-8000-000000000001', 'Sneaky', 'Insert', 'admin', 'active')$q$,
    '42501');
  perform testkit.throws('escalation: member INSERT into a FOREIGN club roster is rejected (RLS)',
    $q$insert into app.club_members (club_id, first_name, last_name, role, status)
       values ('deadbeef-0000-4000-8000-000000000001', 'Sneaky', 'Insert', 'admin', 'active')$q$,
    '42501');
  perform testkit.throws('escalation: planting an OWNER row in a foreign club dies in the trigger',
    $q$insert into app.club_members (club_id, first_name, last_name, role, status)
       values ('deadbeef-0000-4000-8000-000000000001', 'Sneaky', 'Insert', 'owner', 'active')$q$,
    'P0001');
  perform testkit.affects('escalation: member DELETE on the roster is a silent no-op (no policy)',
    $q$delete from app.club_members
        where id = 'a0000000-0000-4000-8000-000000000004'$q$, 0);
  perform testkit.affects('escalation: member cannot update the club row (0 rows)',
    $q$update app.clubs set name = 'Pwned e.V.'
        where id = 'c1ab0000-0000-4000-8000-000000000001'$q$, 0);
end;
$$;

-- state check with superuser eyes: nothing changed
reset role;
do $$
begin
  perform testkit.is_eq('escalation: Katrin''s role is still member after all attempts',
    (select count(*) from app.club_members
      where id = 'a0000000-0000-4000-8000-000000000009' and role = 'member'), 1);
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- Admin (Thomas Krueger) — may manage the roster, but never owners or himself
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000004","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"admin"}}',
  true);
set local role authenticated;

do $$
begin
  perform testkit.throws('escalation (v1 gap): admin changing his OWN role is rejected',
    $q$update app.club_members set role = 'owner'
        where id = 'a0000000-0000-4000-8000-000000000004'$q$, 'P0001');
  perform testkit.throws('escalation: admin demoting the owner is rejected',
    $q$update app.club_members set role = 'member'
        where id = 'a0000000-0000-4000-8000-000000000002'$q$, 'P0001');
  perform testkit.throws('escalation: admin granting owner via UPDATE is rejected',
    $q$update app.club_members set role = 'owner'
        where id = 'a0000000-0000-4000-8000-000000000005'$q$, 'P0001');
  perform testkit.throws('escalation: admin creating a NEW owner row via INSERT is rejected',
    $q$insert into app.club_members (club_id, first_name, last_name, role, status)
       values ('c1ab0000-0000-4000-8000-000000000001', 'Planted', 'Owner', 'owner', 'active')$q$,
    'P0001');
  perform testkit.affects('roster management: admin MAY change a non-owner, non-self role',
    $q$update app.club_members set role = 'member'
        where id = 'a0000000-0000-4000-8000-000000000005'$q$, 1);
  perform testkit.succeeds('roster management: admin MAY add a plain member',
    $q$insert into app.club_members (club_id, first_name, last_name, role, status)
       values ('c1ab0000-0000-4000-8000-000000000001', 'Neu', 'Dabei', 'member', 'pending')$q$);
  perform testkit.throws('roster rule: guest_coach without valid_until violates the check constraint',
    $q$insert into app.club_members (club_id, first_name, last_name, role, status)
       values ('c1ab0000-0000-4000-8000-000000000001', 'Gast', 'Ohne-Ablauf', 'guest_coach', 'active')$q$,
    '23514');
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- Owner (Juergen Haeberle) — the only role that may touch owner rows,
-- but even he cannot change his OWN row (self-change rule = DB-level
-- last-owner protection: the only owner can never demote himself).
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000002","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"owner"}}',
  true);
set local role authenticated;

do $$
begin
  perform testkit.affects('owner MAY promote a second owner via UPDATE',
    $q$update app.club_members set role = 'owner'
        where id = 'a0000000-0000-4000-8000-000000000004'$q$, 1);
  perform testkit.succeeds('owner MAY create an owner row via INSERT (co-owner onboarding)',
    $q$insert into app.club_members (club_id, first_name, last_name, role, status)
       values ('c1ab0000-0000-4000-8000-000000000001', 'Co', 'Owner', 'owner', 'pending')$q$);
  perform testkit.throws('owner cannot change his OWN role (self-change rule / last owner)',
    $q$update app.club_members set role = 'member'
        where id = 'a0000000-0000-4000-8000-000000000002'$q$, 'P0001');
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- Tenancy hard rules + the legitimate service path
-- ---------------------------------------------------------------------------
begin;
-- no claims set -> auth.uid() is null
do $$
begin
  perform testkit.throws('tenancy: club_members.club_id is immutable even for the superuser',
    $q$update app.club_members set club_id = 'deadbeef-0000-4000-8000-000000000001'
        where id = 'a0000000-0000-4000-8000-000000000024'$q$, 'P0001');
end;
$$;

set local role service_role;
do $$
begin
  perform testkit.affects('service path: service_role (API layer, no sub claim) MAY manage roles',
    $q$update app.club_members set role = 'member'
        where id = 'a0000000-0000-4000-8000-000000000005'$q$, 1);
end;
$$;
rollback;
