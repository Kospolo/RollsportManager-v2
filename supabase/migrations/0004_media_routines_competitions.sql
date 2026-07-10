-- ============================================================================
-- 0004_media_routines_competitions.sql — RollsportManager v2
-- Media assets (object-storage references), routines (Küren — the USP),
-- markers, scores, competitions and entries.
--
-- Blueprint §4 media rule: ONLY metadata in the DB (storage_path, sha256,
-- size, mime, duration, waveform_peaks). Binary data lives in Supabase
-- Storage. No Base64 column ever exists in v2.
--
-- Routine skaters: n:m via routine_skaters (pair skating needs 2 skaters —
-- see mock routine "Tanz der Funken"). Status state machine (ADR-E7):
--   draft → ready → competition → archived
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- Enums
-- ----------------------------------------------------------------------------
create type app.routine_status as enum ('draft', 'ready', 'competition', 'archived');

create type app.competition_status as enum ('upcoming', 'running', 'done', 'cancelled');

create type app.entry_status as enum ('registered', 'confirmed', 'withdrawn');

-- ----------------------------------------------------------------------------
-- media_assets — object-storage references (stub for the media service)
-- ----------------------------------------------------------------------------
create table app.media_assets (
  id             uuid primary key default app.uuid_v7(),
  club_id        uuid not null references app.clubs (id) on delete restrict,
  bucket         text not null,
  storage_path   text not null,
  mime_type      text,
  size_bytes     bigint,
  sha256         text,                       -- hex, for pinning/checksum verification
  duration_ms    bigint,                     -- audio/video only
  waveform_peaks jsonb,                      -- server-side precomputed peaks (audio)
  created_by     uuid references app.profiles (id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  deleted_at     timestamptz,
  constraint media_assets_path_uq unique (bucket, storage_path)
);

create index media_assets_club_idx on app.media_assets (club_id);

create trigger media_assets_set_updated_at
  before update on app.media_assets
  for each row execute function app.set_updated_at();

-- ----------------------------------------------------------------------------
-- routines — Küren (title, music metadata, BPM, duration, audio asset)
-- ----------------------------------------------------------------------------
create table app.routines (
  id                uuid primary key default app.uuid_v7(),
  club_id           uuid not null references app.clubs (id) on delete restrict,
  team_id           uuid references app.teams (id) on delete set null,
  title             text not null,
  status            app.routine_status not null default 'draft',
  category          text,                    -- e.g. 'Jugend Kür A'
  music_title       text,
  music_artist      text,
  music_bpm         integer,
  music_duration_ms bigint,
  audio_asset_id    uuid references app.media_assets (id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  deleted_at        timestamptz
);

create index routines_club_status_idx on app.routines (club_id, status);

create trigger routines_set_updated_at
  before update on app.routines
  for each row execute function app.set_updated_at();

-- ----------------------------------------------------------------------------
-- routine_skaters — n:m routine ↔ club_member (pair/group skating)
-- ----------------------------------------------------------------------------
create table app.routine_skaters (
  id         uuid primary key default app.uuid_v7(),
  club_id    uuid not null references app.clubs (id) on delete restrict,
  routine_id uuid not null references app.routines (id) on delete cascade,
  member_id  uuid not null references app.club_members (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint routine_skaters_uq unique (routine_id, member_id)
);

create index routine_skaters_club_idx   on app.routine_skaters (club_id);
create index routine_skaters_member_idx on app.routine_skaters (member_id);

create trigger routine_skaters_set_updated_at
  before update on app.routine_skaters
  for each row execute function app.set_updated_at();

-- ----------------------------------------------------------------------------
-- routine_markers — time markers on the training audio (A-B loop anchors,
-- element positions with RollArt element codes like '2S', 'StSq', 'CoSp')
-- ----------------------------------------------------------------------------
create table app.routine_markers (
  id           uuid primary key default app.uuid_v7(),
  club_id      uuid not null references app.clubs (id) on delete restrict,
  routine_id   uuid not null references app.routines (id) on delete cascade,
  time_ms      bigint not null check (time_ms >= 0),
  label        text not null,
  element_code text,                          -- RollArt shorthand, optional
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz
);

create index routine_markers_routine_idx on app.routine_markers (routine_id, time_ms);
create index routine_markers_club_idx    on app.routine_markers (club_id);

create trigger routine_markers_set_updated_at
  before update on app.routine_markers
  for each row execute function app.set_updated_at();

-- ----------------------------------------------------------------------------
-- competitions — organizational wrapper (registration, participants);
-- linked from events (the calendar entry) and routine_scores (results)
-- ----------------------------------------------------------------------------
create table app.competitions (
  id                    uuid primary key default app.uuid_v7(),
  club_id               uuid not null references app.clubs (id) on delete restrict,
  name                  text not null,
  location              text,
  starts_at             timestamptz not null,
  ends_at               timestamptz not null,
  registration_deadline date,
  status                app.competition_status not null default 'upcoming',
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  deleted_at            timestamptz,
  constraint competitions_time_order check (ends_at > starts_at)
);

create index competitions_club_starts_idx on app.competitions (club_id, starts_at);

create trigger competitions_set_updated_at
  before update on app.competitions
  for each row execute function app.set_updated_at();

-- events get their competition link now that app.competitions exists
alter table app.events
  add column competition_id uuid references app.competitions (id) on delete set null;

create index events_competition_idx on app.events (competition_id)
  where competition_id is not null;

-- ----------------------------------------------------------------------------
-- competition_entries — who starts with which routine
-- ----------------------------------------------------------------------------
create table app.competition_entries (
  id             uuid primary key default app.uuid_v7(),
  club_id        uuid not null references app.clubs (id) on delete restrict,
  competition_id uuid not null references app.competitions (id) on delete restrict,
  member_id      uuid not null references app.club_members (id) on delete restrict,
  routine_id     uuid references app.routines (id) on delete set null,
  status         app.entry_status not null default 'registered',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  deleted_at     timestamptz,
  constraint competition_entries_uq unique (competition_id, member_id)
);

create index competition_entries_club_idx    on app.competition_entries (club_id);
create index competition_entries_member_idx  on app.competition_entries (member_id);
create index competition_entries_routine_idx on app.competition_entries (routine_id);

create trigger competition_entries_set_updated_at
  before update on app.competition_entries
  for each row execute function app.set_updated_at();

-- ----------------------------------------------------------------------------
-- routine_scores — score history (RollArt: technical + components = total).
-- scoring_system keeps the model open for other judging systems.
-- ----------------------------------------------------------------------------
create table app.routine_scores (
  id               uuid primary key default app.uuid_v7(),
  club_id          uuid not null references app.clubs (id) on delete restrict,
  routine_id       uuid not null references app.routines (id) on delete restrict,
  competition_id   uuid references app.competitions (id) on delete set null,
  scored_on        date not null,
  scoring_system   text not null default 'rollart',
  technical_score  numeric(6, 2),
  components_score numeric(6, 2),
  total_score      numeric(6, 2),
  note             text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  deleted_at       timestamptz
);

create index routine_scores_routine_idx     on app.routine_scores (routine_id, scored_on);
create index routine_scores_club_idx        on app.routine_scores (club_id);
create index routine_scores_competition_idx on app.routine_scores (competition_id)
  where competition_id is not null;

create trigger routine_scores_set_updated_at
  before update on app.routine_scores
  for each row execute function app.set_updated_at();

-- ----------------------------------------------------------------------------
-- RLS
-- Routine work (markers, scores) explicitly includes guest_coach — that is
-- what guest coaches are invited for. Structure (competitions) does not.
-- ----------------------------------------------------------------------------
alter table app.media_assets        enable row level security;
alter table app.routines            enable row level security;
alter table app.routine_skaters     enable row level security;
alter table app.routine_markers     enable row level security;
alter table app.competitions        enable row level security;
alter table app.competition_entries enable row level security;
alter table app.routine_scores      enable row level security;

-- media_assets
create policy media_assets_select on app.media_assets
  for select to authenticated
  using (app.is_club_member(club_id));

create policy media_assets_insert on app.media_assets
  for insert to authenticated
  with check (app.has_club_role(club_id, array['owner', 'admin', 'coach', 'guest_coach']));

create policy media_assets_update on app.media_assets
  for update to authenticated
  using (app.has_club_role(club_id, array['owner', 'admin', 'coach', 'guest_coach']))
  with check (app.has_club_role(club_id, array['owner', 'admin', 'coach', 'guest_coach']));

-- routines
create policy routines_select on app.routines
  for select to authenticated
  using (app.is_club_member(club_id));

create policy routines_insert on app.routines
  for insert to authenticated
  with check (app.has_club_role(club_id, array['owner', 'admin', 'coach', 'guest_coach']));

create policy routines_update on app.routines
  for update to authenticated
  using (app.has_club_role(club_id, array['owner', 'admin', 'coach', 'guest_coach']))
  with check (app.has_club_role(club_id, array['owner', 'admin', 'coach', 'guest_coach']));

-- routine_skaters
create policy routine_skaters_select on app.routine_skaters
  for select to authenticated
  using (app.is_club_member(club_id));

create policy routine_skaters_insert on app.routine_skaters
  for insert to authenticated
  with check (app.has_club_role(club_id, array['owner', 'admin', 'coach', 'guest_coach']));

create policy routine_skaters_update on app.routine_skaters
  for update to authenticated
  using (app.has_club_role(club_id, array['owner', 'admin', 'coach', 'guest_coach']))
  with check (app.has_club_role(club_id, array['owner', 'admin', 'coach', 'guest_coach']));

-- routine_markers
create policy routine_markers_select on app.routine_markers
  for select to authenticated
  using (app.is_club_member(club_id));

create policy routine_markers_insert on app.routine_markers
  for insert to authenticated
  with check (app.has_club_role(club_id, array['owner', 'admin', 'coach', 'guest_coach']));

create policy routine_markers_update on app.routine_markers
  for update to authenticated
  using (app.has_club_role(club_id, array['owner', 'admin', 'coach', 'guest_coach']))
  with check (app.has_club_role(club_id, array['owner', 'admin', 'coach', 'guest_coach']));

-- competitions
create policy competitions_select on app.competitions
  for select to authenticated
  using (app.is_club_member(club_id));

create policy competitions_insert on app.competitions
  for insert to authenticated
  with check (app.has_club_role(club_id, array['owner', 'admin', 'coach']));

create policy competitions_update on app.competitions
  for update to authenticated
  using (app.has_club_role(club_id, array['owner', 'admin', 'coach']))
  with check (app.has_club_role(club_id, array['owner', 'admin', 'coach']));

-- competition_entries
create policy competition_entries_select on app.competition_entries
  for select to authenticated
  using (app.is_club_member(club_id));

create policy competition_entries_insert on app.competition_entries
  for insert to authenticated
  with check (app.has_club_role(club_id, array['owner', 'admin', 'coach']));

create policy competition_entries_update on app.competition_entries
  for update to authenticated
  using (app.has_club_role(club_id, array['owner', 'admin', 'coach']))
  with check (app.has_club_role(club_id, array['owner', 'admin', 'coach']));

-- routine_scores
create policy routine_scores_select on app.routine_scores
  for select to authenticated
  using (app.is_club_member(club_id));

create policy routine_scores_insert on app.routine_scores
  for insert to authenticated
  with check (app.has_club_role(club_id, array['owner', 'admin', 'coach', 'guest_coach']));

create policy routine_scores_update on app.routine_scores
  for update to authenticated
  using (app.has_club_role(club_id, array['owner', 'admin', 'coach', 'guest_coach']))
  with check (app.has_club_role(club_id, array['owner', 'admin', 'coach', 'guest_coach']));

commit;
