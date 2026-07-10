-- ============================================================================
-- 0002_identity_tenancy.sql — RollsportManager v2
-- Identity & multi-tenancy: clubs, profiles, club_members, guardianships.
--
-- Blueprint ADR-E4:
--   * ONE identity: profiles.id = auth.users.id (no BIGSERIAL/UUID dual system).
--   * Membership per club: club_members(club_id, profile_id, role, status,
--     valid_until). profile_id is NULLABLE — children without an account are
--     plain member rows managed by their guardians.
--   * Guest coaches = normal time-boxed membership (role = guest_coach,
--     valid_until), NOT a token side table.
--   * Families via guardianships(guardian, child), not parent_id columns.
--   * v1 GAP CLOSED: nobody can change their own role / club membership via
--     UPDATE (WITH CHECK + BEFORE UPDATE trigger, see protect_club_membership).
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- Enums
-- ----------------------------------------------------------------------------
create type app.club_member_role as enum
  ('owner', 'admin', 'treasurer', 'coach', 'member', 'guest_coach');

create type app.member_status as enum
  ('pending', 'active', 'inactive', 'left');

-- ----------------------------------------------------------------------------
-- clubs — the tenant root
-- ----------------------------------------------------------------------------
create table app.clubs (
  id           uuid primary key default app.uuid_v7(),
  name         text not null,
  short_name   text,
  city         text,
  discipline   text,                       -- e.g. 'Rollkunstlauf'
  founded_year integer,
  join_code    text unique,                -- invite/onboarding code (v1 flow)
  settings     jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz
);

create trigger clubs_set_updated_at
  before update on app.clubs
  for each row execute function app.set_updated_at();

-- ----------------------------------------------------------------------------
-- profiles — 1:1 with auth.users (login identity, cross-club)
-- Person master data lives on club_members (per-club), NOT here.
-- ----------------------------------------------------------------------------
create table app.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  locale       text not null default 'de',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz
);

create trigger profiles_set_updated_at
  before update on app.profiles
  for each row execute function app.set_updated_at();

-- ----------------------------------------------------------------------------
-- club_members — tenant membership + per-club person master data
-- ----------------------------------------------------------------------------
create table app.club_members (
  id          uuid primary key default app.uuid_v7(),
  club_id     uuid not null references app.clubs (id) on delete restrict,
  profile_id  uuid references app.profiles (id) on delete set null,  -- NULL = child without account
  first_name  text not null,
  last_name   text not null,
  email       text,
  birth_date  date,
  role        app.club_member_role not null default 'member',
  status      app.member_status not null default 'pending',
  joined_on   date,
  valid_until timestamptz,   -- guest_coach: mandatory expiry; others: optional
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz,
  constraint club_members_guest_coach_needs_expiry
    check (role <> 'guest_coach' or valid_until is not null)
);

-- one active membership per profile per club
create unique index club_members_club_profile_uq
  on app.club_members (club_id, profile_id)
  where profile_id is not null and deleted_at is null;

create index club_members_club_role_idx on app.club_members (club_id, role);
create index club_members_profile_idx   on app.club_members (profile_id);

create trigger club_members_set_updated_at
  before update on app.club_members
  for each row execute function app.set_updated_at();

-- ----------------------------------------------------------------------------
-- guardianships — parent/guardian ↔ child relation (both are club_members)
-- ----------------------------------------------------------------------------
create table app.guardianships (
  id                 uuid primary key default app.uuid_v7(),
  club_id            uuid not null references app.clubs (id) on delete restrict,
  guardian_member_id uuid not null references app.club_members (id) on delete restrict,
  child_member_id    uuid not null references app.club_members (id) on delete restrict,
  relation           text not null default 'parent',   -- parent | guardian | other
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  deleted_at         timestamptz,
  constraint guardianships_uq unique (guardian_member_id, child_member_id),
  constraint guardianships_not_self check (guardian_member_id <> child_member_id)
);

create index guardianships_club_idx  on app.guardianships (club_id);
create index guardianships_child_idx on app.guardianships (child_member_id);

create trigger guardianships_set_updated_at
  before update on app.guardianships
  for each row execute function app.set_updated_at();

-- ----------------------------------------------------------------------------
-- SECURITY DEFINER helpers (Blueprint §4 RLS principles)
-- Owned by the migration role (postgres) → internal lookups bypass RLS,
-- no policy recursion. All pin search_path = ''.
-- ----------------------------------------------------------------------------

-- Is the current user an (effective) member of the club?
-- Role comes from JWT claims; guest_coach additionally requires an active,
-- unexpired membership row (valid_until enforced server-side, not just claims).
create or replace function app.is_club_member(p_club_id uuid)
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

-- Does the current user hold one of the given roles in the club?
create or replace function app.has_club_role(p_club_id uuid, p_roles text[])
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_role text := app.jwt_club_role(p_club_id);
begin
  if v_role is null or not (v_role = any (p_roles)) then
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

-- May the current user act for the given member row?
-- True for the own membership row and for children via guardianships
-- (parent mode: RSVPs, invoices, tasks of the own child).
create or replace function app.can_act_for_member(p_member_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from app.club_members m
    where m.id = p_member_id
      and m.profile_id = auth.uid()
      and m.deleted_at is null
  )
  or exists (
    select 1
    from app.guardianships g
    join app.club_members guardian on guardian.id = g.guardian_member_id
    where g.child_member_id = p_member_id
      and g.deleted_at is null
      and guardian.profile_id = auth.uid()
      and guardian.deleted_at is null
  )
$$;

-- ----------------------------------------------------------------------------
-- protect_club_membership — closes the v1 privilege-escalation gap.
--   * club_id is immutable (no moving members between tenants).
--   * Nobody may change their OWN role/status/valid_until/profile_id
--     (applies whenever a JWT subject is present; the API layer acts via
--      service_role tokens without a sub claim and is therefore exempt).
--   * Only owners may change owner rows or grant the owner role — on UPDATE
--     AND on INSERT (found by supabase/tests: without the INSERT guard an
--     admin could plant a brand-new owner row for an accomplice profile).
-- ----------------------------------------------------------------------------
create or replace function app.protect_club_membership()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    -- only owners may create owner rows (same rule as the UPDATE path below;
    -- service_role tokens carry no sub claim and stay exempt)
    if auth.uid() is not null
       and new.role = 'owner'
       and not app.has_club_role(new.club_id, array['owner']) then
      raise exception 'only owners may grant owner roles';
    end if;
    return new;
  end if;

  if new.club_id is distinct from old.club_id then
    raise exception 'club_members.club_id is immutable';
  end if;

  if auth.uid() is not null then
    -- self-service block (the v1 gap: role self-PATCH)
    if old.profile_id = auth.uid() and (
         new.role        is distinct from old.role
      or new.status      is distinct from old.status
      or new.valid_until is distinct from old.valid_until
      or new.profile_id  is distinct from old.profile_id
    ) then
      raise exception 'changing own role/status/validity is not allowed';
    end if;

    -- only owners touch owner roles
    if (old.role = 'owner' and new.role is distinct from old.role)
       or (new.role = 'owner' and old.role is distinct from 'owner') then
      if not app.has_club_role(old.club_id, array['owner']) then
        raise exception 'only owners may change owner roles';
      end if;
    end if;
  end if;

  return new;
end;
$$;

create trigger club_members_protect
  before update on app.club_members
  for each row execute function app.protect_club_membership();

create trigger club_members_protect_insert
  before insert on app.club_members
  for each row execute function app.protect_club_membership();

-- ----------------------------------------------------------------------------
-- RLS — enabled on EVERY table; separate policies per command, never FOR ALL.
-- Writes normally go through the API layer (service_role, bypasses RLS);
-- these policies are the second line of defense (Blueprint §4).
-- ----------------------------------------------------------------------------
alter table app.clubs         enable row level security;
alter table app.profiles      enable row level security;
alter table app.club_members  enable row level security;
alter table app.guardianships enable row level security;

-- clubs: members read their club; only owner/admin update; INSERT/DELETE only
-- via the API layer (no client policies — club creation is an API operation).
create policy clubs_select on app.clubs
  for select to authenticated
  using (deleted_at is null and app.is_club_member(id));

create policy clubs_update on app.clubs
  for update to authenticated
  using (app.has_club_role(id, array['owner', 'admin']))
  with check (app.has_club_role(id, array['owner', 'admin']));

-- profiles: strictly own row
create policy profiles_select_own on app.profiles
  for select to authenticated
  using (id = auth.uid());

create policy profiles_insert_own on app.profiles
  for insert to authenticated
  with check (id = auth.uid());

create policy profiles_update_own on app.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- club_members: club members read the roster; only owner/admin write.
-- WITH CHECK keeps rows inside the club; the trigger blocks self-changes.
create policy club_members_select on app.club_members
  for select to authenticated
  using (app.is_club_member(club_id));

create policy club_members_insert on app.club_members
  for insert to authenticated
  with check (app.has_club_role(club_id, array['owner', 'admin']));

create policy club_members_update on app.club_members
  for update to authenticated
  using (app.has_club_role(club_id, array['owner', 'admin']))
  with check (app.has_club_role(club_id, array['owner', 'admin']));
-- no DELETE policy: memberships are soft-deleted (deleted_at) via UPDATE.

-- guardianships: involved persons + club admins read; owner/admin write.
create policy guardianships_select on app.guardianships
  for select to authenticated
  using (
    app.has_club_role(club_id, array['owner', 'admin'])
    or app.can_act_for_member(guardian_member_id)
    or app.can_act_for_member(child_member_id)
  );

create policy guardianships_insert on app.guardianships
  for insert to authenticated
  with check (app.has_club_role(club_id, array['owner', 'admin']));

create policy guardianships_update on app.guardianships
  for update to authenticated
  using (app.has_club_role(club_id, array['owner', 'admin']))
  with check (app.has_club_role(club_id, array['owner', 'admin']));

commit;
