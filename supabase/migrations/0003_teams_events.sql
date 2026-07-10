-- ============================================================================
-- 0003_teams_events.sql — RollsportManager v2
-- Teams, events (Termine), RSVPs, attendance.
--
-- Blueprint §5 core modules "Mitglieder/Teams/Familie" + "Termine & Anwesenheit".
--   * ONE RSVP system (v1 had termin_responses AND termin_teilnahmen):
--     event_rsvps with enum going/declined/maybe/sick + comment.
--   * attendance is the coach-side truth (check-in), RSVP the member-side.
--   * events ↔ teams is n:m (event_teams) — matches the real domain
--     (Elternabend/Wettkampf span multiple teams).
--   * All tables are offline Tier 1/2 → soft deletes as PowerSync tombstones.
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- Enums
-- ----------------------------------------------------------------------------
create type app.team_role as enum ('skater', 'coach');

create type app.event_type as enum ('training', 'competition', 'other');

create type app.rsvp_status as enum ('going', 'declined', 'maybe', 'sick');

create type app.attendance_status as enum ('present', 'late', 'excused', 'absent');

-- ----------------------------------------------------------------------------
-- teams
-- ----------------------------------------------------------------------------
create table app.teams (
  id         uuid primary key default app.uuid_v7(),
  club_id    uuid not null references app.clubs (id) on delete restrict,
  name       text not null,
  age_group  text,                                   -- e.g. 'U12–U15'
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index teams_club_idx on app.teams (club_id);

create trigger teams_set_updated_at
  before update on app.teams
  for each row execute function app.set_updated_at();

-- ----------------------------------------------------------------------------
-- team_members — skaters AND coaches (role column, no team_trainer duplicate)
-- ----------------------------------------------------------------------------
create table app.team_members (
  id         uuid primary key default app.uuid_v7(),
  club_id    uuid not null references app.clubs (id) on delete restrict,
  team_id    uuid not null references app.teams (id) on delete restrict,
  member_id  uuid not null references app.club_members (id) on delete restrict,
  role       app.team_role not null default 'skater',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint team_members_uq unique (team_id, member_id)
);

create index team_members_club_idx   on app.team_members (club_id);
create index team_members_member_idx on app.team_members (member_id);

create trigger team_members_set_updated_at
  before update on app.team_members
  for each row execute function app.set_updated_at();

-- ----------------------------------------------------------------------------
-- events — trainings, competitions, club life ("Termine")
-- competition_id (FK to app.competitions) is added in 0004.
-- ----------------------------------------------------------------------------
create table app.events (
  id         uuid primary key default app.uuid_v7(),
  club_id    uuid not null references app.clubs (id) on delete restrict,
  type       app.event_type not null default 'training',
  title      text not null,
  note       text,
  location   text,
  starts_at  timestamptz not null,
  ends_at    timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint events_time_order check (ends_at > starts_at)
);

create index events_club_starts_idx on app.events (club_id, starts_at);

create trigger events_set_updated_at
  before update on app.events
  for each row execute function app.set_updated_at();

-- ----------------------------------------------------------------------------
-- event_teams — n:m event ↔ team
-- ----------------------------------------------------------------------------
create table app.event_teams (
  id         uuid primary key default app.uuid_v7(),
  club_id    uuid not null references app.clubs (id) on delete restrict,
  event_id   uuid not null references app.events (id) on delete cascade,
  team_id    uuid not null references app.teams (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint event_teams_uq unique (event_id, team_id)
);

create index event_teams_club_idx on app.event_teams (club_id);
create index event_teams_team_idx on app.event_teams (team_id);

create trigger event_teams_set_updated_at
  before update on app.event_teams
  for each row execute function app.set_updated_at();

-- ----------------------------------------------------------------------------
-- event_rsvps — member (or guardian on behalf of child) responds to an event
-- ----------------------------------------------------------------------------
create table app.event_rsvps (
  id           uuid primary key default app.uuid_v7(),
  club_id      uuid not null references app.clubs (id) on delete restrict,
  event_id     uuid not null references app.events (id) on delete cascade,
  member_id    uuid not null references app.club_members (id) on delete restrict,
  status       app.rsvp_status not null,
  comment      text,
  responded_at timestamptz not null default now(),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz,
  constraint event_rsvps_uq unique (event_id, member_id)
);

create index event_rsvps_club_idx   on app.event_rsvps (club_id);
create index event_rsvps_member_idx on app.event_rsvps (member_id);

create trigger event_rsvps_set_updated_at
  before update on app.event_rsvps
  for each row execute function app.set_updated_at();

-- ----------------------------------------------------------------------------
-- attendance — coach-side check-in (QR / manual), offline Tier 1
-- ----------------------------------------------------------------------------
create table app.attendance (
  id            uuid primary key default app.uuid_v7(),
  club_id       uuid not null references app.clubs (id) on delete restrict,
  event_id      uuid not null references app.events (id) on delete cascade,
  member_id     uuid not null references app.club_members (id) on delete restrict,
  status        app.attendance_status not null,
  checked_in_at timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz,
  constraint attendance_uq unique (event_id, member_id)
);

create index attendance_club_idx   on app.attendance (club_id);
create index attendance_member_idx on app.attendance (member_id);

create trigger attendance_set_updated_at
  before update on app.attendance
  for each row execute function app.set_updated_at();

-- ----------------------------------------------------------------------------
-- RLS
-- Roles: structure (teams/events) = owner/admin/coach;
--        attendance additionally guest_coach (their core job);
--        RSVPs = the member themself / their guardian / coaching staff.
-- ----------------------------------------------------------------------------
alter table app.teams        enable row level security;
alter table app.team_members enable row level security;
alter table app.events       enable row level security;
alter table app.event_teams  enable row level security;
alter table app.event_rsvps  enable row level security;
alter table app.attendance   enable row level security;

-- teams
create policy teams_select on app.teams
  for select to authenticated
  using (app.is_club_member(club_id));

create policy teams_insert on app.teams
  for insert to authenticated
  with check (app.has_club_role(club_id, array['owner', 'admin', 'coach']));

create policy teams_update on app.teams
  for update to authenticated
  using (app.has_club_role(club_id, array['owner', 'admin', 'coach']))
  with check (app.has_club_role(club_id, array['owner', 'admin', 'coach']));

-- team_members
create policy team_members_select on app.team_members
  for select to authenticated
  using (app.is_club_member(club_id));

create policy team_members_insert on app.team_members
  for insert to authenticated
  with check (app.has_club_role(club_id, array['owner', 'admin', 'coach']));

create policy team_members_update on app.team_members
  for update to authenticated
  using (app.has_club_role(club_id, array['owner', 'admin', 'coach']))
  with check (app.has_club_role(club_id, array['owner', 'admin', 'coach']));

-- events
create policy events_select on app.events
  for select to authenticated
  using (app.is_club_member(club_id));

create policy events_insert on app.events
  for insert to authenticated
  with check (app.has_club_role(club_id, array['owner', 'admin', 'coach']));

create policy events_update on app.events
  for update to authenticated
  using (app.has_club_role(club_id, array['owner', 'admin', 'coach']))
  with check (app.has_club_role(club_id, array['owner', 'admin', 'coach']));

-- event_teams
create policy event_teams_select on app.event_teams
  for select to authenticated
  using (app.is_club_member(club_id));

create policy event_teams_insert on app.event_teams
  for insert to authenticated
  with check (app.has_club_role(club_id, array['owner', 'admin', 'coach']));

create policy event_teams_update on app.event_teams
  for update to authenticated
  using (app.has_club_role(club_id, array['owner', 'admin', 'coach']))
  with check (app.has_club_role(club_id, array['owner', 'admin', 'coach']));

-- event_rsvps: self / guardian / coaching staff (incl. guest_coach)
create policy event_rsvps_select on app.event_rsvps
  for select to authenticated
  using (app.is_club_member(club_id));

create policy event_rsvps_insert on app.event_rsvps
  for insert to authenticated
  with check (
    app.is_club_member(club_id)
    and (
      app.can_act_for_member(member_id)
      or app.has_club_role(club_id, array['owner', 'admin', 'coach', 'guest_coach'])
    )
  );

create policy event_rsvps_update on app.event_rsvps
  for update to authenticated
  using (
    app.can_act_for_member(member_id)
    or app.has_club_role(club_id, array['owner', 'admin', 'coach', 'guest_coach'])
  )
  with check (
    app.is_club_member(club_id)
    and (
      app.can_act_for_member(member_id)
      or app.has_club_role(club_id, array['owner', 'admin', 'coach', 'guest_coach'])
    )
  );

-- attendance: coaching staff only (incl. time-boxed guest_coach)
create policy attendance_select on app.attendance
  for select to authenticated
  using (app.is_club_member(club_id));

create policy attendance_insert on app.attendance
  for insert to authenticated
  with check (app.has_club_role(club_id, array['owner', 'admin', 'coach', 'guest_coach']));

create policy attendance_update on app.attendance
  for update to authenticated
  using (app.has_club_role(club_id, array['owner', 'admin', 'coach', 'guest_coach']))
  with check (app.has_club_role(club_id, array['owner', 'admin', 'coach', 'guest_coach']));

commit;
