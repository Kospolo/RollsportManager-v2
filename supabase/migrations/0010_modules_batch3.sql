-- ============================================================================
-- 0010_modules_batch3.sql — RollsportManager v2
-- Third batch of the owed modules (Referenz §5 feature hub):
--   * training_slots     — Trainingsplan / weekly schedule (v1 trainingsplan.html)
--   * duty_requirements   — Pflichtstunden-Soll (v1 pflichtstunden.html)
--   * duty_entries        — erfasste Ist-Stunden (v1 portal-pflichtstunden.js)
--
-- Rights, server-side (Referenz 1.3), enforced by RLS via the capability
-- helpers from 0007 (is_club_member / is_club_trainer) and is_own_member (0009):
--   * training_slots / duty_requirements
--       read  = is_club_member
--       write = is_club_trainer (owner/admin/moderator/coach + time-boxed guest)
--   * duty_entries — "eigene Ist-Stunden erfasst jedes Mitglied fuer sich"
--       read   = OWN entry (member_id = caller's own club_members row) OR trainer
--       insert = is_club_member AND (member_id = self OR trainer)
--       update/delete (soft) = OWN entry OR trainer  ("Ersteller" = der Mitglied,
--                dem die Stunden gehoeren; trainer darf fuer alle)
--       approved = darf NUR ein is_club_trainer setzen/aendern (BEFORE-Trigger,
--                42501; ein Mitglied kann seine eigenen Stunden nicht selbst
--                freigeben).
--
-- Deletes are SOFT (deleted_at) -> governed by the UPDATE policy; a real DELETE
-- has no policy and is default-denied (teams/events/0008/0009 convention).
-- Enum-like columns are TEXT + CHECK per the batch-2/3 task spec (the App shows
-- the labels). weekday is 0=Monday..6=Sunday (Referenz: Trainingsplan-Wochenraster).
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- training_slots — the weekly training schedule ("Trainingsplan")
-- team_id / facility_id / coach_member_id are optional context; a slot can be
-- club-wide, unassigned or in an external location (free-text `location`).
-- ----------------------------------------------------------------------------
create table app.training_slots (
  id              uuid primary key default app.uuid_v7(),
  club_id         uuid not null references app.clubs (id) on delete restrict,
  team_id         uuid references app.teams (id) on delete set null,
  weekday         smallint not null,
  starts_time     time not null,
  ends_time       time not null,
  facility_id     uuid references app.facilities (id) on delete set null,
  location        text,
  coach_member_id uuid references app.club_members (id) on delete set null,
  note            text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz,
  constraint training_slots_weekday_check check (weekday between 0 and 6),
  constraint training_slots_time_check    check (ends_time > starts_time)
);

-- the weekly-plan lookup: a club's slots ordered by weekday + start time.
create index training_slots_club_idx      on app.training_slots (club_id, weekday, starts_time);
create index training_slots_club_team_idx on app.training_slots (club_id, team_id);

create trigger training_slots_set_updated_at
  before update on app.training_slots
  for each row execute function app.set_updated_at();

-- ----------------------------------------------------------------------------
-- duty_requirements — the target hours ("Pflichtstunden-Soll") per season.
-- Scope is a cascade: a requirement may target one team (team_id), one member
-- (member_id) or the whole club (both null). Set by coaching staff.
-- ----------------------------------------------------------------------------
create table app.duty_requirements (
  id             uuid primary key default app.uuid_v7(),
  club_id        uuid not null references app.clubs (id) on delete restrict,
  team_id        uuid references app.teams (id) on delete set null,
  member_id      uuid references app.club_members (id) on delete cascade,
  season_label   text not null,
  required_hours numeric(6, 2) not null,
  period_start   date not null,
  period_end     date not null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  deleted_at     timestamptz,
  constraint duty_requirements_hours_check  check (required_hours >= 0),
  constraint duty_requirements_period_check check (period_end >= period_start)
);

create index duty_requirements_club_idx on app.duty_requirements (club_id);

create trigger duty_requirements_set_updated_at
  before update on app.duty_requirements
  for each row execute function app.set_updated_at();

-- ----------------------------------------------------------------------------
-- duty_entries — the recorded actual hours ("Ist-Stunden").
-- member_id = the club_members row the hours belong to = the "owner" of the
-- entry (self-service). `approved` is a trainer-only flag (see trigger below).
-- ----------------------------------------------------------------------------
create table app.duty_entries (
  id            uuid primary key default app.uuid_v7(),
  club_id       uuid not null references app.clubs (id) on delete restrict,
  member_id     uuid not null references app.club_members (id) on delete cascade,
  hours         numeric(6, 2) not null,
  activity_date date not null,
  kind          text not null default 'training',
  note          text,
  approved      boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz,
  constraint duty_entries_hours_check check (hours > 0),
  constraint duty_entries_kind_check  check (kind in ('training', 'helper', 'competition', 'other'))
);

create index duty_entries_club_idx        on app.duty_entries (club_id);
create index duty_entries_club_member_idx on app.duty_entries (club_id, member_id);

create trigger duty_entries_set_updated_at
  before update on app.duty_entries
  for each row execute function app.set_updated_at();

-- ----------------------------------------------------------------------------
-- approve-guard: only a club trainer may set/flip `approved`. Runs BEFORE the
-- row is written; RLS (member_id=self OR trainer) already governs WHO may touch
-- the row at all — this trigger narrows the `approved` column specifically so a
-- member cannot self-approve their own hours. SECURITY DEFINER so is_club_trainer
-- sees the request JWT regardless of the invoker's grants.
-- ----------------------------------------------------------------------------
create or replace function app.duty_entries_guard_approved()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Trusted server context (service_role / seed / migration) has no auth.uid();
  -- the guard only constrains impersonated AUTHENTICATED callers. Platform/
  -- service writes are trusted (Blueprint: platform writes go via service_role).
  if auth.uid() is null then
    return new;
  end if;
  if tg_op = 'INSERT' then
    if new.approved is true and not app.is_club_trainer(new.club_id) then
      raise exception 'only a club trainer may approve duty entries'
        using errcode = '42501';
    end if;
  elsif tg_op = 'UPDATE' then
    if new.approved is distinct from old.approved and not app.is_club_trainer(new.club_id) then
      raise exception 'only a club trainer may change the approval of a duty entry'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

comment on function app.duty_entries_guard_approved() is
  'Referenz 1.3: approved on app.duty_entries is trainer-only; a member cannot self-approve their recorded hours.';

create trigger duty_entries_guard_approved
  before insert or update on app.duty_entries
  for each row execute function app.duty_entries_guard_approved();

-- ----------------------------------------------------------------------------
-- RLS
-- ----------------------------------------------------------------------------
alter table app.training_slots     enable row level security;
alter table app.duty_requirements  enable row level security;
alter table app.duty_entries       enable row level security;

-- training_slots: read = member, write = trainer ---------------------------
create policy training_slots_select on app.training_slots
  for select to authenticated
  using (app.is_club_member(club_id));

create policy training_slots_insert on app.training_slots
  for insert to authenticated
  with check (app.is_club_trainer(club_id));

create policy training_slots_update on app.training_slots
  for update to authenticated
  using (app.is_club_trainer(club_id))
  with check (app.is_club_trainer(club_id));

-- duty_requirements: read = member, write = trainer ------------------------
create policy duty_requirements_select on app.duty_requirements
  for select to authenticated
  using (app.is_club_member(club_id));

create policy duty_requirements_insert on app.duty_requirements
  for insert to authenticated
  with check (app.is_club_trainer(club_id));

create policy duty_requirements_update on app.duty_requirements
  for update to authenticated
  using (app.is_club_trainer(club_id))
  with check (app.is_club_trainer(club_id));

-- duty_entries: read/insert/edit = OWN entry OR trainer --------------------
--   read   = own (member_id belongs to caller) OR trainer
--   insert = member of the club AND (recording for oneself OR trainer)
--   update = own OR trainer (soft-delete goes through here); approved column
--            additionally guarded by app.duty_entries_guard_approved().
create policy duty_entries_select on app.duty_entries
  for select to authenticated
  using (app.is_own_member(member_id) or app.is_club_trainer(club_id));

create policy duty_entries_insert on app.duty_entries
  for insert to authenticated
  with check (
    app.is_club_member(club_id)
    and (app.is_own_member(member_id) or app.is_club_trainer(club_id))
  );

create policy duty_entries_update on app.duty_entries
  for update to authenticated
  using (app.is_own_member(member_id) or app.is_club_trainer(club_id))
  with check (app.is_own_member(member_id) or app.is_club_trainer(club_id));

commit;
