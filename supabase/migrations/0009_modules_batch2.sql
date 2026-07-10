-- ============================================================================
-- 0009_modules_batch2.sql — RollsportManager v2
-- Second batch of the ~15 owed modules (Referenz §5/§3.1 feature hub):
--   * facilities            — Hallen & Räume ("Belegungsplan", v1 facilities.html)
--   * facility_bookings     — Buchungen (v1 bookings.html)
--   * equipment             — Ausrüstung (v1 equipment.html)
--   * equipment_reservations— Ausleihen/Reservierungen
--   * achievements          — Medaillen (v1 achievements.html)
--
-- Rights, server-side (Referenz 1.3), enforced by RLS via the capability
-- helpers from 0007 (is_club_member / is_club_trainer):
--   * facilities / equipment / achievements
--       read  = is_club_member
--       write = is_club_trainer (owner/admin/moderator/coach + time-boxed guest_coach)
--   * facility_bookings / equipment_reservations
--       read   = is_club_member
--       insert = is_club_trainer OR the caller booking FOR THEMSELVES
--                (booked_by/reserved_by = the caller's own club_members row)
--       update = is_club_trainer OR the creator (own membership row)
--
-- Deletes are SOFT (deleted_at) and therefore governed by the UPDATE policy;
-- a real DELETE has no policy and is default-denied (teams/events convention,
-- mirrors 0008). Enum-like columns are TEXT + CHECK per the task spec (the
-- App shows the labels), unlike the exercise_category enum in 0008.
-- Booking conflicts are NOT DB-enforced (the App surfaces overlaps); we only
-- index (facility_id, starts_at) / (equipment_id, from_at) for the lookups.
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- Helper: does p_member_id name a club_members row owned by the caller?
-- Used by the booking/reservation "insert/edit for myself" policies so the
-- self-service path stays readable and DRY across both tables.
-- ----------------------------------------------------------------------------
create or replace function app.is_own_member(p_member_id uuid)
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
$$;

comment on function app.is_own_member(uuid) is
  'True when the given club_members row belongs to the calling user (auth.uid()). Basis for the self-service booking/reservation RLS.';

-- ----------------------------------------------------------------------------
-- facilities — halls, rooms & outdoor areas ("Belegungsplan")
-- ----------------------------------------------------------------------------
create table app.facilities (
  id         uuid primary key default app.uuid_v7(),
  club_id    uuid not null references app.clubs (id) on delete restrict,
  name       text not null,
  kind       text not null default 'hall',
  address    text,
  capacity   integer,
  notes      text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint facilities_kind_check     check (kind in ('hall', 'room', 'outdoor', 'other')),
  constraint facilities_capacity_check check (capacity is null or capacity >= 0)
);

create index facilities_club_idx on app.facilities (club_id);

create trigger facilities_set_updated_at
  before update on app.facilities
  for each row execute function app.set_updated_at();

-- ----------------------------------------------------------------------------
-- facility_bookings — reservations of a facility (v1 bookings.html)
-- booked_by_member_id = the club_members row of the booker (self-service) or
-- of the team's coach; team_id is optional context.
-- ----------------------------------------------------------------------------
create table app.facility_bookings (
  id                  uuid primary key default app.uuid_v7(),
  facility_id         uuid not null references app.facilities (id) on delete restrict,
  club_id             uuid not null references app.clubs (id) on delete restrict,
  booked_by_member_id uuid not null references app.club_members (id) on delete restrict,
  team_id             uuid references app.teams (id) on delete set null,
  title               text not null,
  starts_at           timestamptz not null,
  ends_at             timestamptz not null,
  status              text not null default 'confirmed',
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  deleted_at          timestamptz,
  constraint facility_bookings_status_check check (status in ('confirmed', 'pending', 'cancelled')),
  constraint facility_bookings_time_check   check (ends_at > starts_at)
);

-- the calendar lookup: a facility's bookings ordered by start (task: no overlap
-- constraint, the App shows conflicts).
create index facility_bookings_facility_time_idx on app.facility_bookings (facility_id, starts_at);
create index facility_bookings_club_idx          on app.facility_bookings (club_id);

create trigger facility_bookings_set_updated_at
  before update on app.facility_bookings
  for each row execute function app.set_updated_at();

-- ----------------------------------------------------------------------------
-- equipment — club gear inventory ("Ausrüstung")
-- ----------------------------------------------------------------------------
create table app.equipment (
  id                 uuid primary key default app.uuid_v7(),
  club_id            uuid not null references app.clubs (id) on delete restrict,
  name               text not null,
  category           text,
  total_quantity     integer not null default 1,
  available_quantity integer not null default 1,
  condition          text not null default 'good',
  notes              text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  deleted_at         timestamptz,
  constraint equipment_condition_check check (condition in ('good', 'fair', 'defect')),
  constraint equipment_total_check     check (total_quantity >= 0),
  constraint equipment_available_check check (available_quantity between 0 and total_quantity)
);

create index equipment_club_idx on app.equipment (club_id);

create trigger equipment_set_updated_at
  before update on app.equipment
  for each row execute function app.set_updated_at();

-- ----------------------------------------------------------------------------
-- equipment_reservations — borrow records (self-service like bookings)
-- ----------------------------------------------------------------------------
create table app.equipment_reservations (
  id                    uuid primary key default app.uuid_v7(),
  equipment_id          uuid not null references app.equipment (id) on delete restrict,
  club_id               uuid not null references app.clubs (id) on delete restrict,
  reserved_by_member_id uuid not null references app.club_members (id) on delete restrict,
  quantity              integer not null default 1,
  from_at               timestamptz not null,
  to_at                 timestamptz not null,
  status                text not null default 'active',
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  deleted_at            timestamptz,
  constraint equipment_reservations_status_check   check (status in ('active', 'returned', 'cancelled')),
  constraint equipment_reservations_quantity_check check (quantity > 0),
  constraint equipment_reservations_time_check     check (to_at > from_at)
);

create index equipment_reservations_equipment_time_idx on app.equipment_reservations (equipment_id, from_at);
create index equipment_reservations_club_idx           on app.equipment_reservations (club_id);

create trigger equipment_reservations_set_updated_at
  before update on app.equipment_reservations
  for each row execute function app.set_updated_at();

-- ----------------------------------------------------------------------------
-- achievements — medals & competition results ("Medaillen", v1 achievements.html)
-- member_id = the club_members row the medal belongs to. Awarded by staff.
-- ----------------------------------------------------------------------------
create table app.achievements (
  id               uuid primary key default app.uuid_v7(),
  club_id          uuid not null references app.clubs (id) on delete restrict,
  member_id        uuid not null references app.club_members (id) on delete cascade,
  title            text not null,
  competition_name text,
  placement        integer,
  medal            text,
  achieved_on      date not null,
  note             text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  deleted_at       timestamptz,
  constraint achievements_placement_check check (placement is null or placement >= 1),
  constraint achievements_medal_check     check (medal is null or medal in ('gold', 'silver', 'bronze'))
);

create index achievements_club_idx        on app.achievements (club_id);
create index achievements_club_member_idx on app.achievements (club_id, member_id);

create trigger achievements_set_updated_at
  before update on app.achievements
  for each row execute function app.set_updated_at();

-- ----------------------------------------------------------------------------
-- RLS
-- ----------------------------------------------------------------------------
alter table app.facilities              enable row level security;
alter table app.facility_bookings       enable row level security;
alter table app.equipment               enable row level security;
alter table app.equipment_reservations  enable row level security;
alter table app.achievements            enable row level security;

-- facilities: read = member, write = trainer -------------------------------
create policy facilities_select on app.facilities
  for select to authenticated
  using (app.is_club_member(club_id));

create policy facilities_insert on app.facilities
  for insert to authenticated
  with check (app.is_club_trainer(club_id));

create policy facilities_update on app.facilities
  for update to authenticated
  using (app.is_club_trainer(club_id))
  with check (app.is_club_trainer(club_id));

-- facility_bookings: read = member; insert/edit = trainer OR own booking ----
create policy facility_bookings_select on app.facility_bookings
  for select to authenticated
  using (app.is_club_member(club_id));

create policy facility_bookings_insert on app.facility_bookings
  for insert to authenticated
  with check (
    app.is_club_member(club_id)
    and (app.is_club_trainer(club_id) or app.is_own_member(booked_by_member_id))
  );

create policy facility_bookings_update on app.facility_bookings
  for update to authenticated
  using (app.is_club_trainer(club_id) or app.is_own_member(booked_by_member_id))
  with check (app.is_club_trainer(club_id) or app.is_own_member(booked_by_member_id));

-- equipment: read = member, write = trainer --------------------------------
create policy equipment_select on app.equipment
  for select to authenticated
  using (app.is_club_member(club_id));

create policy equipment_insert on app.equipment
  for insert to authenticated
  with check (app.is_club_trainer(club_id));

create policy equipment_update on app.equipment
  for update to authenticated
  using (app.is_club_trainer(club_id))
  with check (app.is_club_trainer(club_id));

-- equipment_reservations: read = member; insert/edit = trainer OR own ------
create policy equipment_reservations_select on app.equipment_reservations
  for select to authenticated
  using (app.is_club_member(club_id));

create policy equipment_reservations_insert on app.equipment_reservations
  for insert to authenticated
  with check (
    app.is_club_member(club_id)
    and (app.is_club_trainer(club_id) or app.is_own_member(reserved_by_member_id))
  );

create policy equipment_reservations_update on app.equipment_reservations
  for update to authenticated
  using (app.is_club_trainer(club_id) or app.is_own_member(reserved_by_member_id))
  with check (app.is_club_trainer(club_id) or app.is_own_member(reserved_by_member_id));

-- achievements: read = member, write (award/edit/delete) = trainer ---------
create policy achievements_select on app.achievements
  for select to authenticated
  using (app.is_club_member(club_id));

create policy achievements_insert on app.achievements
  for insert to authenticated
  with check (app.is_club_trainer(club_id));

create policy achievements_update on app.achievements
  for update to authenticated
  using (app.is_club_trainer(club_id))
  with check (app.is_club_trainer(club_id));

commit;
