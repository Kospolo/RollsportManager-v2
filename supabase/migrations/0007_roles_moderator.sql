-- ============================================================================
-- 0007_roles_moderator.sql — RollsportManager v2
-- Corrected role/permission model per ORIGINAL-APP-REFERENZ §1 (the binding
-- v1 permission matrix) + Blueprint E3/E4.
--
-- What this migration fixes (Referenz §5/§6):
--   * The 'moderator' club role was missing entirely -> re-added to the
--     club_member_role enum WITH its rank hierarchy (1.3):
--       moderator = admin-near (isTrainer + isAdmin + manage members/finance)
--       BUT may only change roles of targets NOT in {owner, admin, moderator}.
--   * treasurer (= v1 'kassenwart') gets the exact rule "manage members +
--     finance, but NEVER change roles".
--   * PLATFORM super_admin is NOT a club role: it is a claim
--     (app_metadata.is_platform_admin) read by app.is_platform_admin(),
--     granting cross-club READ visibility. Platform-level WRITES go through
--     the API layer (service_role), never through a client JWT.
--
-- Enforcement lives here (RLS + trigger) — the single server-side truth.
-- Clients only mirror this for display (Referenz 1.5).
--
-- Enum position: 'moderator' is added BEFORE 'treasurer' so the enum sort
-- order reflects the rank (owner > admin > moderator > treasurer > coach ...).
-- Run as its own (implicit) transaction FIRST: Postgres forbids using a freshly
-- added enum value in the same transaction that added it, so the rest of the
-- migration (which references the value at plan time) is a separate BEGIN block.
-- ============================================================================

alter type app.club_member_role add value if not exists 'moderator' before 'treasurer';

begin;

-- ----------------------------------------------------------------------------
-- Platform-admin claim helper (Referenz 1.4 "Stufe 1 – nur super_admin").
-- Reads app_metadata.is_platform_admin (GoTrue emits app_metadata into the
-- access token), a top-level is_platform_admin flag, or a super_admin role
-- claim. No table access -> plain STABLE, safe for every role.
-- ----------------------------------------------------------------------------
create or replace function app.is_platform_admin()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(nullif(app.jwt_claims() ->> 'is_platform_admin', '')::boolean, false)
      or coalesce(nullif(app.jwt_claims() -> 'app_metadata' ->> 'is_platform_admin', '')::boolean, false)
      or coalesce(app.jwt_claims() -> 'app_metadata' ->> 'role', '') = 'super_admin'
      or coalesce(app.jwt_claims() ->> 'platform_role', '') = 'super_admin'
$$;

comment on function app.is_platform_admin() is
  'True when the JWT carries the platform-admin claim (app_metadata.is_platform_admin / super_admin role). Platform-level = cross-club READ; writes go via service_role.';

-- ----------------------------------------------------------------------------
-- is_club_member — now also grants platform admins cross-club READ visibility.
-- (Body otherwise unchanged from 0002: guest_coach still needs an active,
-- unexpired membership row.)
-- ----------------------------------------------------------------------------
create or replace function app.is_club_member(p_club_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_role text;
begin
  if app.is_platform_admin() then
    return true;
  end if;
  v_role := app.jwt_club_role(p_club_id);
  if v_role is null then
    return false;
  end if;
  if v_role = 'guest_coach' then
    return exists (
      select 1
      from app.club_members m
      where m.club_id = p_club_id
        and m.profile_id = auth.uid()
        and m.deleted_at is null
        and m.status = 'active'
        and (m.valid_until is null or m.valid_until >= now())
    );
  end if;
  return true;
end;
$$;

-- ----------------------------------------------------------------------------
-- Capability helpers — the ONE place that encodes the Referenz 1.3 matrix.
-- All delegate to has_club_role (which already enforces guest_coach expiry).
-- ----------------------------------------------------------------------------

-- isTrainer = coach / moderator / admin / owner (+ guest_coach, time-boxed)
create or replace function app.is_club_trainer(p_club_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select app.has_club_role(p_club_id, array['owner', 'admin', 'moderator', 'coach', 'guest_coach'])
$$;

-- isClubAdmin = moderator / admin / owner  (moderator counts as admin!)
create or replace function app.is_club_admin(p_club_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select app.has_club_role(p_club_id, array['owner', 'admin', 'moderator'])
$$;

-- canManageMembers = treasurer / moderator / admin / owner
create or replace function app.can_manage_members(p_club_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select app.has_club_role(p_club_id, array['owner', 'admin', 'moderator', 'treasurer'])
$$;

-- canManageFinance = treasurer / moderator / admin / owner
create or replace function app.can_manage_finance(p_club_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select app.has_club_role(p_club_id, array['owner', 'admin', 'moderator', 'treasurer'])
$$;

-- canChangeRole (Referenz 1.3):
--   owner  -> any role (incl. owner)
--   admin  -> any role EXCEPT granting/holding owner (only owners touch owner)
--   moderator -> only targets NOT in {owner, admin, moderator}
--   treasurer / coach / member / guest_coach -> NEVER
-- This checks the TARGET role only; the trigger additionally guards the OLD
-- rank and the last-owner rule.
create or replace function app.can_change_member_role(p_club_id uuid, p_target_role app.club_member_role)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_role text := app.jwt_club_role(p_club_id);
begin
  if v_role is null then
    return false;
  end if;
  if p_target_role = 'owner' then
    return v_role = 'owner';                       -- only owners grant owner
  end if;
  if v_role in ('owner', 'admin') then
    return true;
  end if;
  if v_role = 'moderator' then
    return p_target_role not in ('admin', 'moderator');  -- owner already handled
  end if;
  return false;                                    -- treasurer & below: no roles
end;
$$;

comment on function app.can_change_member_role(uuid, app.club_member_role) is
  'Referenz 1.3: may the current user assign the given target role? owner=any, admin=any-but-owner, moderator=only below moderator, everyone else=no.';

-- ----------------------------------------------------------------------------
-- protect_club_membership — recreated to enforce the FULL matrix, not just the
-- owner rule. Self-change block and club_id immutability are preserved.
--   INSERT: only owners may plant owner rows; a manager may not assign a role
--           above their rank (moderator->admin/moderator, treasurer->non-member).
--   UPDATE: nobody edits their own role/status/validity; only owners touch the
--           owner role (last-owner protection via the self-block); a manager
--           must be entitled to BOTH the old and the new rank.
-- Non-managers never reach the "insufficient rights" branches — the RLS
-- WITH CHECK / USING clause filters them first (42501 / silent no-op).
-- ----------------------------------------------------------------------------
create or replace function app.protect_club_membership()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if auth.uid() is not null then
      -- owner rows only by owners (fires for everyone -> P0001, ahead of RLS)
      if new.role = 'owner'
         and not app.has_club_role(new.club_id, array['owner']) then
        raise exception 'only owners may grant owner roles';
      end if;
      -- a manager assigning a role above their rank (moderator planting
      -- admin/moderator, treasurer assigning any non-member role).
      if app.can_manage_members(new.club_id)
         and new.role <> 'member'
         and not app.can_change_member_role(new.club_id, new.role) then
        raise exception 'insufficient rights to assign role %', new.role;
      end if;
    end if;
    return new;
  end if;

  if new.club_id is distinct from old.club_id then
    raise exception 'club_members.club_id is immutable';
  end if;

  if auth.uid() is not null then
    -- self-service block (the v1 gap: role self-PATCH; also = last-owner guard)
    if old.profile_id = auth.uid() and (
         new.role        is distinct from old.role
      or new.status      is distinct from old.status
      or new.valid_until is distinct from old.valid_until
      or new.profile_id  is distinct from old.profile_id
    ) then
      raise exception 'changing own role/status/validity is not allowed';
    end if;

    -- role changes follow the Referenz 1.3 matrix
    if new.role is distinct from old.role then
      -- only owners may grant or revoke the owner role
      if (old.role = 'owner' or new.role = 'owner')
         and not app.has_club_role(old.club_id, array['owner']) then
        raise exception 'only owners may change owner roles';
      end if;
      -- a manager must be entitled to leave the OLD rank and enter the NEW one
      if app.can_manage_members(old.club_id)
         and (not app.can_change_member_role(old.club_id, new.role)
              or not app.can_change_member_role(old.club_id, old.role)) then
        raise exception 'insufficient rights to change role from % to %',
          old.role, new.role;
      end if;
    end if;
  end if;

  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- RLS policy updates — switch the relevant tables to the capability helpers so
-- moderator gets admin-near rights and treasurer keeps finance+members (never
-- roles). ALTER POLICY only rewrites the expressions; command/roles unchanged.
-- ----------------------------------------------------------------------------

-- clubs: moderator counts as admin for club settings
alter policy clubs_update on app.clubs
  using (app.is_club_admin(id)) with check (app.is_club_admin(id));

-- club_members: any member manager may write the roster; the trigger enforces
-- the fine-grained role rules (treasurer no roles, moderator only below rank).
alter policy club_members_insert on app.club_members
  with check (app.can_manage_members(club_id));
alter policy club_members_update on app.club_members
  using (app.can_manage_members(club_id)) with check (app.can_manage_members(club_id));

-- guardianships (family/member management): admins see all, member managers write
alter policy guardianships_select on app.guardianships
  using (
    app.is_club_admin(club_id)
    or app.can_act_for_member(guardian_member_id)
    or app.can_act_for_member(child_member_id)
  );
alter policy guardianships_insert on app.guardianships
  with check (app.can_manage_members(club_id));
alter policy guardianships_update on app.guardianships
  using (app.can_manage_members(club_id)) with check (app.can_manage_members(club_id));

-- teams / team_members / events / event_teams: structure = owner/admin/moderator/coach
alter policy teams_insert on app.teams
  with check (app.has_club_role(club_id, array['owner', 'admin', 'moderator', 'coach']));
alter policy teams_update on app.teams
  using (app.has_club_role(club_id, array['owner', 'admin', 'moderator', 'coach']))
  with check (app.has_club_role(club_id, array['owner', 'admin', 'moderator', 'coach']));
alter policy team_members_insert on app.team_members
  with check (app.has_club_role(club_id, array['owner', 'admin', 'moderator', 'coach']));
alter policy team_members_update on app.team_members
  using (app.has_club_role(club_id, array['owner', 'admin', 'moderator', 'coach']))
  with check (app.has_club_role(club_id, array['owner', 'admin', 'moderator', 'coach']));
alter policy events_insert on app.events
  with check (app.has_club_role(club_id, array['owner', 'admin', 'moderator', 'coach']));
alter policy events_update on app.events
  using (app.has_club_role(club_id, array['owner', 'admin', 'moderator', 'coach']))
  with check (app.has_club_role(club_id, array['owner', 'admin', 'moderator', 'coach']));
alter policy event_teams_insert on app.event_teams
  with check (app.has_club_role(club_id, array['owner', 'admin', 'moderator', 'coach']));
alter policy event_teams_update on app.event_teams
  using (app.has_club_role(club_id, array['owner', 'admin', 'moderator', 'coach']))
  with check (app.has_club_role(club_id, array['owner', 'admin', 'moderator', 'coach']));

-- event_rsvps: self/guardian OR any trainer (now incl. moderator)
alter policy event_rsvps_insert on app.event_rsvps
  with check (
    app.is_club_member(club_id)
    and (app.can_act_for_member(member_id) or app.is_club_trainer(club_id))
  );
alter policy event_rsvps_update on app.event_rsvps
  using (app.can_act_for_member(member_id) or app.is_club_trainer(club_id))
  with check (
    app.is_club_member(club_id)
    and (app.can_act_for_member(member_id) or app.is_club_trainer(club_id))
  );

-- attendance + all routine work: trainer set incl. guest_coach and now moderator
alter policy attendance_insert on app.attendance
  with check (app.is_club_trainer(club_id));
alter policy attendance_update on app.attendance
  using (app.is_club_trainer(club_id)) with check (app.is_club_trainer(club_id));
alter policy media_assets_insert on app.media_assets
  with check (app.is_club_trainer(club_id));
alter policy media_assets_update on app.media_assets
  using (app.is_club_trainer(club_id)) with check (app.is_club_trainer(club_id));
alter policy routines_insert on app.routines
  with check (app.is_club_trainer(club_id));
alter policy routines_update on app.routines
  using (app.is_club_trainer(club_id)) with check (app.is_club_trainer(club_id));
alter policy routine_skaters_insert on app.routine_skaters
  with check (app.is_club_trainer(club_id));
alter policy routine_skaters_update on app.routine_skaters
  using (app.is_club_trainer(club_id)) with check (app.is_club_trainer(club_id));
alter policy routine_markers_insert on app.routine_markers
  with check (app.is_club_trainer(club_id));
alter policy routine_markers_update on app.routine_markers
  using (app.is_club_trainer(club_id)) with check (app.is_club_trainer(club_id));
alter policy routine_scores_insert on app.routine_scores
  with check (app.is_club_trainer(club_id));
alter policy routine_scores_update on app.routine_scores
  using (app.is_club_trainer(club_id)) with check (app.is_club_trainer(club_id));

-- competitions / entries: owner/admin/moderator/coach (no guest_coach on structure)
alter policy competitions_insert on app.competitions
  with check (app.has_club_role(club_id, array['owner', 'admin', 'moderator', 'coach']));
alter policy competitions_update on app.competitions
  using (app.has_club_role(club_id, array['owner', 'admin', 'moderator', 'coach']))
  with check (app.has_club_role(club_id, array['owner', 'admin', 'moderator', 'coach']));
alter policy competition_entries_insert on app.competition_entries
  with check (app.has_club_role(club_id, array['owner', 'admin', 'moderator', 'coach']));
alter policy competition_entries_update on app.competition_entries
  using (app.has_club_role(club_id, array['owner', 'admin', 'moderator', 'coach']))
  with check (app.has_club_role(club_id, array['owner', 'admin', 'moderator', 'coach']));

-- tasks: staff (owner/admin/moderator/coach) manage; assignee ticks off own task
alter policy tasks_insert on app.tasks
  with check (app.has_club_role(club_id, array['owner', 'admin', 'moderator', 'coach']));
alter policy tasks_update on app.tasks
  using (
    app.has_club_role(club_id, array['owner', 'admin', 'moderator', 'coach'])
    or app.can_act_for_member(assignee_member_id)
  )
  with check (
    app.has_club_role(club_id, array['owner', 'admin', 'moderator', 'coach'])
    or app.can_act_for_member(assignee_member_id)
  );

-- invoices + ledger (Kassenbuch): finance roles = owner/admin/moderator/treasurer.
-- Members still see their own / their children's invoices.
alter policy invoices_select on app.invoices
  using (app.can_manage_finance(club_id) or app.can_act_for_member(member_id));
alter policy invoices_insert on app.invoices
  with check (app.can_manage_finance(club_id));
alter policy invoices_update on app.invoices
  using (app.can_manage_finance(club_id)) with check (app.can_manage_finance(club_id));
alter policy ledger_entries_select on app.ledger_entries
  using (app.can_manage_finance(club_id));
alter policy ledger_entries_insert on app.ledger_entries
  with check (app.can_manage_finance(club_id));

commit;
