-- ============================================================================
-- 0017_organisation.sql — RollsportManager v2 — Organisations-Module.
--
-- Referenz §3.2 (www/portal abteilungen.html, schliessfaecher.html) + §5/§6.
-- Three org-structure tables, all server-side enforced (Referenz 1.5: RLS via
-- the capability helpers from 0007). Soft deletes go through the UPDATE policy
-- (deleted_at = now()); a real DELETE has no policy = default-deny (the
-- teams/events/modules convention).
--
--   * departments (Abteilungen) — Leistungssport/Breitensport/Vorstand … .
--       Read  = is_club_member. Write = is_club_admin (owner/admin/moderator).
--       lead_member_id = optional Abteilungsleiter (a club_members row).
--   * department_members — n:m member ↔ department. Read = is_club_member.
--       Write = is_club_trainer (Zuordnungen sind Trainer-Arbeit, Referenz 1.3).
--       unique (department_id, member_id) incl. soft-deleted rows → re-adding a
--       removed member revives the row (PUT .../members upsert).
--   * lockers (Schließfächer) — status free/assigned/broken. Read = is_club_
--       member. Write = is_club_admin for the master data (label/location/note/
--       create/delete); assigning/releasing (status + assigned_member_id) is
--       also is_club_trainer. The UPDATE policy therefore admits is_club_trainer
--       and a BEFORE-UPDATE trigger (app.protect_locker) restricts a non-admin
--       trainer to exactly status + assigned_member_id — everything else, incl.
--       soft-delete, needs is_club_admin (raises 42501). Mirrors the
--       protect_club_membership self-defense pattern.
--
-- Enforcement is server-side (Blueprint risk #16). The API impersonates the
-- caller (src/db.ts withUser), so these policies + trigger apply to every
-- API write exactly as to a direct PostgREST one.
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- Enum — locker status (Referenz schliessfaecher.html: frei/belegt/defekt)
-- ----------------------------------------------------------------------------
create type app.locker_status as enum ('free', 'assigned', 'broken');

-- ----------------------------------------------------------------------------
-- departments — "Abteilungen"
-- lead_member_id references a club_members row (set null if that member is
-- removed) — the department survives losing its lead.
-- ----------------------------------------------------------------------------
create table app.departments (
  id             uuid primary key default app.uuid_v7(),
  club_id        uuid not null references app.clubs (id) on delete restrict,
  name           text not null,
  description    text,
  lead_member_id uuid references app.club_members (id) on delete set null,
  sort_order     integer not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  deleted_at     timestamptz
);

-- portal list order: explicit sort_order, then name.
create index departments_club_sort_idx on app.departments (club_id, sort_order, name);

create trigger departments_set_updated_at
  before update on app.departments
  for each row execute function app.set_updated_at();

-- ----------------------------------------------------------------------------
-- department_members — n:m member ↔ department (no updated_at: rows are only
-- created and soft-deleted, never mutated in place).
-- ----------------------------------------------------------------------------
create table app.department_members (
  id            uuid primary key default app.uuid_v7(),
  club_id       uuid not null references app.clubs (id) on delete restrict,
  department_id uuid not null references app.departments (id) on delete cascade,
  member_id     uuid not null references app.club_members (id) on delete restrict,
  created_at    timestamptz not null default now(),
  deleted_at    timestamptz,
  constraint department_members_uq unique (department_id, member_id)
);

create index department_members_club_idx   on app.department_members (club_id);
create index department_members_member_idx on app.department_members (member_id);
create index department_members_dept_idx    on app.department_members (department_id);

-- ----------------------------------------------------------------------------
-- lockers — "Schließfächer"
-- assigned_member_id: who currently holds the locker (set null if that member
-- is removed). The status enum and the fk are kept consistent by the API
-- (assign sets status='assigned'+member, release sets 'free'+null); the DB
-- allows 'broken' with or without an occupant (a defect can hit an assigned box).
-- ----------------------------------------------------------------------------
create table app.lockers (
  id                 uuid primary key default app.uuid_v7(),
  club_id            uuid not null references app.clubs (id) on delete restrict,
  label              text not null,
  location           text,
  status             app.locker_status not null default 'free',
  assigned_member_id uuid references app.club_members (id) on delete set null,
  note               text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  deleted_at         timestamptz
);

create index lockers_club_idx        on app.lockers (club_id);
create index lockers_club_status_idx on app.lockers (club_id, status);

create trigger lockers_set_updated_at
  before update on app.lockers
  for each row execute function app.set_updated_at();

-- protect_locker — a non-admin trainer (coach/guest_coach) may only assign or
-- release: change status + assigned_member_id. Master data (label/location/
-- note), club_id and the soft-delete flag stay is_club_admin-only. Owner/admin/
-- moderator (is_club_admin) pass untouched.
create or replace function app.protect_locker()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not app.is_club_admin(new.club_id) then
    if new.club_id    is distinct from old.club_id
       or new.label    is distinct from old.label
       or new.location is distinct from old.location
       or new.note     is distinct from old.note
       or new.deleted_at is distinct from old.deleted_at then
      raise exception 'lockers: assign/release only — editing or deleting a locker needs a club admin'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

create trigger lockers_protect
  before update on app.lockers
  for each row execute function app.protect_locker();

-- ----------------------------------------------------------------------------
-- RLS
-- ----------------------------------------------------------------------------
alter table app.departments        enable row level security;
alter table app.department_members enable row level security;
alter table app.lockers            enable row level security;

-- departments: read = member, write = admin
create policy departments_select on app.departments
  for select to authenticated
  using (app.is_club_member(club_id));

create policy departments_insert on app.departments
  for insert to authenticated
  with check (app.is_club_admin(club_id));

create policy departments_update on app.departments
  for update to authenticated
  using (app.is_club_admin(club_id))
  with check (app.is_club_admin(club_id));

-- department_members: read = member, write (assign/detach) = trainer
create policy department_members_select on app.department_members
  for select to authenticated
  using (app.is_club_member(club_id));

create policy department_members_insert on app.department_members
  for insert to authenticated
  with check (app.is_club_trainer(club_id));

create policy department_members_update on app.department_members
  for update to authenticated
  using (app.is_club_trainer(club_id))
  with check (app.is_club_trainer(club_id));

-- lockers: read = member. UPDATE admits is_club_trainer, but the protect_locker
-- trigger caps a non-admin trainer to status + assigned_member_id (assign/
-- release). INSERT (create a locker) stays is_club_admin.
create policy lockers_select on app.lockers
  for select to authenticated
  using (app.is_club_member(club_id));

create policy lockers_insert on app.lockers
  for insert to authenticated
  with check (app.is_club_admin(club_id));

create policy lockers_update on app.lockers
  for update to authenticated
  using (app.is_club_trainer(club_id))
  with check (app.is_club_trainer(club_id));

commit;

-- NB: seed data (3 departments + members, 8 lockers) lives in
-- supabase/seed/seed.sql — migrations run BEFORE the seed, so app.clubs /
-- app.club_members are still empty here (same convention as 0016/0008).
