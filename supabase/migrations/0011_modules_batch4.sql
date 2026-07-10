-- ============================================================================
-- 0011_modules_batch4.sql — RollsportManager v2
-- Fourth batch of the owed modules (Referenz §5 feature hub):
--   * chat_messages    — Team-Chat + Direktnachrichten (v1 chat.html,
--                        direktnachrichten.html, portal-chat.js)
--   * checkins         — Check-in (QR/manuell) (v1 checkin.html, my-qrcode.html,
--                        checkin-history.html)
--   * regional_events  — Events (ueberregional) (v1 events.html)
--
-- Rights, server-side (Referenz 1.3), enforced by RLS via the capability
-- helpers from 0007 (is_club_member / is_club_trainer), is_own_member (0009)
-- and the new is_team_member() helper below:
--   * chat_messages
--       read   team   = caller is a member of team_id (team_members) OR trainer
--              direct = caller is sender OR recipient (own club_members row)
--       insert        = sender_member_id = self AND
--                         team   -> caller is a member of that team
--                         direct -> recipient is a member of the same club
--       update/delete = ONLY the sender (soft-delete via deleted_at)
--   * checkins ("eigenes Mitglied checkt sich selbst ein; Trainer checkt andere")
--       read   = own checkin (member_id = own row) OR trainer
--       insert = self-checkin (member_id = self) OR trainer (for anyone)
--       delete = trainer only (soft-delete via deleted_at)
--   * regional_events (ueberregionale Events)
--       read  = is_club_member
--       write = is_club_trainer
--
-- Deletes are SOFT (deleted_at) -> governed by the UPDATE policy; a real DELETE
-- has no policy and is default-denied (teams/events/0008..0010 convention).
-- Enum-like columns are TEXT + CHECK per the batch spec (the App shows labels).
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- Helper: is the CALLER a member of a given team? (auth.uid() -> club_members
-- -> team_members). SECURITY DEFINER so the join sees the request JWT
-- regardless of the invoker's table grants. Mirrors the "Team-Kanal = nur
-- Team-Mitglieder" rule (Referenz 1.3). A soft-deleted membership row does not
-- count.
-- ----------------------------------------------------------------------------
create or replace function app.is_team_member(p_team_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from app.team_members tm
    join app.club_members m on m.id = tm.member_id
    where tm.team_id = p_team_id
      and tm.deleted_at is null
      and m.profile_id = auth.uid()
      and m.deleted_at is null
  )
$$;

comment on function app.is_team_member(uuid) is
  'Referenz 1.3: true when the JWT caller has a (non-deleted) team_members row in the given team. Used by the chat team-channel policies.';

-- ----------------------------------------------------------------------------
-- chat_messages — Team-Chat and 1:1 Direktnachrichten.
--   channel_type='team'   -> team_id set,          recipient_member_id null
--   channel_type='direct' -> recipient_member_id set, team_id null
-- Messages carry text (body) and/or an image (image_url); at least one is
-- required. sender_member_id is the author's club_members row. Edits are not
-- modelled here (v1's 5-minute edit window is a client nicety); the API offers
-- create / list / delete only, so there is no updated_at.
-- ----------------------------------------------------------------------------
create table app.chat_messages (
  id                  uuid primary key default app.uuid_v7(),
  club_id             uuid not null references app.clubs (id) on delete restrict,
  channel_type        text not null,
  team_id             uuid references app.teams (id) on delete cascade,
  sender_member_id    uuid not null references app.club_members (id) on delete cascade,
  recipient_member_id uuid references app.club_members (id) on delete cascade,
  body                text,
  image_url           text,
  created_at          timestamptz not null default now(),
  deleted_at          timestamptz,
  constraint chat_messages_channel_check check (channel_type in ('team', 'direct')),
  -- shape per channel: team needs a team, direct needs a recipient (exclusive)
  constraint chat_messages_shape_check check (
    (channel_type = 'team'   and team_id is not null and recipient_member_id is null)
    or
    (channel_type = 'direct' and recipient_member_id is not null and team_id is null)
  ),
  -- a message must carry something (text and/or image)
  constraint chat_messages_content_check check (
    coalesce(btrim(body), '') <> '' or image_url is not null
  ),
  -- no self-DM
  constraint chat_messages_not_self_dm check (
    channel_type <> 'direct' or sender_member_id <> recipient_member_id
  )
);

-- the team-channel timeline: a team's messages in chronological order
create index chat_messages_channel_idx on app.chat_messages (channel_type, team_id, created_at);
-- the direct-conversation lookup: both directions of a 1:1 thread
create index chat_messages_direct_idx  on app.chat_messages (recipient_member_id, sender_member_id);
create index chat_messages_club_idx    on app.chat_messages (club_id);

-- ----------------------------------------------------------------------------
-- checkins — attendance self check-in (QR) or manual (trainer for others).
-- event_id is optional context (a check-in may be event-bound or a plain
-- "I was here today"). checked_in_at is the actual moment; created_at the row.
-- Immutable once written (no field edits) -> no updated_at; soft-delete only.
-- ----------------------------------------------------------------------------
create table app.checkins (
  id            uuid primary key default app.uuid_v7(),
  club_id       uuid not null references app.clubs (id) on delete restrict,
  member_id     uuid not null references app.club_members (id) on delete cascade,
  event_id      uuid references app.events (id) on delete set null,
  method        text not null default 'qr',
  checked_in_at timestamptz not null default now(),
  created_at    timestamptz not null default now(),
  deleted_at    timestamptz,
  constraint checkins_method_check check (method in ('qr', 'manual'))
);

create index checkins_club_member_idx on app.checkins (club_id, member_id);
create index checkins_club_time_idx   on app.checkins (club_id, checked_in_at);
create index checkins_event_idx       on app.checkins (event_id);

-- ----------------------------------------------------------------------------
-- regional_events — supra-regional events the club tracks / advertises
-- (championships, cups, seminars). Read by every member, curated by staff.
-- ----------------------------------------------------------------------------
create table app.regional_events (
  id               uuid primary key default app.uuid_v7(),
  club_id          uuid not null references app.clubs (id) on delete restrict,
  title            text not null,
  host_org         text,
  discipline       text,
  location         text,
  starts_on        date not null,
  ends_on          date,
  registration_url text,
  description      text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  deleted_at       timestamptz,
  constraint regional_events_period_check check (ends_on is null or ends_on >= starts_on)
);

create index regional_events_club_idx on app.regional_events (club_id, starts_on);

create trigger regional_events_set_updated_at
  before update on app.regional_events
  for each row execute function app.set_updated_at();

-- ----------------------------------------------------------------------------
-- RLS
-- ----------------------------------------------------------------------------
alter table app.chat_messages   enable row level security;
alter table app.checkins        enable row level security;
alter table app.regional_events enable row level security;

-- chat_messages -------------------------------------------------------------
-- read: team channel visible to team members (and to trainers of the club);
--       direct message visible only to its sender/recipient.
create policy chat_messages_select on app.chat_messages
  for select to authenticated
  using (
    case channel_type
      when 'team'   then app.is_team_member(team_id) or app.is_club_trainer(club_id)
      when 'direct' then app.is_own_member(sender_member_id) or app.is_own_member(recipient_member_id)
      else false
    end
  );

-- insert: the sender is always the caller's own member row; a team post
-- requires team membership, a direct message requires the recipient to be a
-- member of the same club.
create policy chat_messages_insert on app.chat_messages
  for insert to authenticated
  with check (
    app.is_own_member(sender_member_id)
    and (
      (channel_type = 'team' and app.is_team_member(team_id))
      or
      (channel_type = 'direct' and exists (
        select 1 from app.club_members r
        where r.id = recipient_member_id
          and r.club_id = chat_messages.club_id
          and r.deleted_at is null
      ))
    )
  );

-- update (soft-delete goes through here): ONLY the sender may touch a message.
create policy chat_messages_update on app.chat_messages
  for update to authenticated
  using (app.is_own_member(sender_member_id))
  with check (app.is_own_member(sender_member_id));

-- checkins ------------------------------------------------------------------
-- read: own check-ins, or all of the club for coaching staff.
create policy checkins_select on app.checkins
  for select to authenticated
  using (app.is_own_member(member_id) or app.is_club_trainer(club_id));

-- insert: a member checks THEMSELVES in; coaching staff check anyone in.
create policy checkins_insert on app.checkins
  for insert to authenticated
  with check (app.is_own_member(member_id) or app.is_club_trainer(club_id));

-- update (soft-delete): coaching staff only (Referenz 1.3: Trainer korrigiert
-- die Check-in-Historie; ein Mitglied kann seinen Check-in nicht selbst tilgen).
create policy checkins_update on app.checkins
  for update to authenticated
  using (app.is_club_trainer(club_id))
  with check (app.is_club_trainer(club_id));

-- regional_events -----------------------------------------------------------
-- read = member, write = trainer.
create policy regional_events_select on app.regional_events
  for select to authenticated
  using (app.is_club_member(club_id));

create policy regional_events_insert on app.regional_events
  for insert to authenticated
  with check (app.is_club_trainer(club_id));

create policy regional_events_update on app.regional_events
  for update to authenticated
  using (app.is_club_trainer(club_id))
  with check (app.is_club_trainer(club_id));

commit;
