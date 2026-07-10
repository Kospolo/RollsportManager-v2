-- ============================================================================
-- 0008_modules_batch1.sql — RollsportManager v2
-- First batch of the ~15 modules the v2 rebuild still owed (Referenz §5/§6):
--   * news      — Vereins-Nachrichten (v1 www/portal/news.html): read = every
--                 club member, write = coaching staff (is_club_trainer).
--   * notes     — private Notizen (v1 www/portal/notes.html): STRICTLY private,
--                 visible and writable ONLY to their owner. Not is_club_member,
--                 not even a platform admin — a note is nobody's business but
--                 the author's.
--   * exercises — Übungs-Bibliothek (v1 www/portal/ubungen.html): read = every
--                 club member, write = coaching staff. Categories + difficulty
--                 1..5 mirror Referenz §4 (warmup/stretching/strength/jump/
--                 spin/steps/combination = aufwärmen/dehnung/kraft/sprung/
--                 pirouette/schritt/kombination).
--
-- Enforcement is server-side (Referenz 1.5): RLS via the capability helpers
-- from 0007 (is_club_member / is_club_trainer). Deletes are SOFT (deleted_at),
-- so the UPDATE policy governs them — matching the convention of every other
-- domain table (no hard-DELETE policy = default-deny, teams/events pattern).
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- Enums — exercise categories (Referenz §4 skating-drill taxonomy)
-- ----------------------------------------------------------------------------
create type app.exercise_category as enum (
  'warmup',       -- aufwärmen
  'stretching',   -- dehnung
  'strength',     -- kraft
  'jump',         -- sprung
  'spin',         -- pirouette
  'steps',        -- schritt
  'combination'   -- kombination
);

-- ----------------------------------------------------------------------------
-- news — club announcements ("Vereins-Nachrichten")
-- author_member_id is the club_members row of the poster (a trainer), so a
-- news item survives the author losing their login while staying attributable.
-- ----------------------------------------------------------------------------
create table app.news (
  id               uuid primary key default app.uuid_v7(),
  club_id          uuid not null references app.clubs (id) on delete restrict,
  author_member_id uuid not null references app.club_members (id) on delete restrict,
  title            text not null,
  body             text not null,
  is_pinned        boolean not null default false,
  published_at     timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  deleted_at       timestamptz
);

-- pinned first, then newest published — the portal list order.
create index news_club_feed_idx on app.news (club_id, is_pinned desc, published_at desc);

create trigger news_set_updated_at
  before update on app.news
  for each row execute function app.set_updated_at();

-- ----------------------------------------------------------------------------
-- notes — strictly private, per-user scratchpad
-- owner_profile_id = the auth.users id (via app.profiles). club_id is optional
-- context ("this note is about club X") but grants NOBODY else access.
-- ----------------------------------------------------------------------------
create table app.notes (
  id               uuid primary key default app.uuid_v7(),
  owner_profile_id uuid not null references app.profiles (id) on delete cascade,
  club_id          uuid references app.clubs (id) on delete set null,
  title            text not null,
  body             text not null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  deleted_at       timestamptz
);

create index notes_owner_idx on app.notes (owner_profile_id);

create trigger notes_set_updated_at
  before update on app.notes
  for each row execute function app.set_updated_at();

-- ----------------------------------------------------------------------------
-- exercises — training-drill library ("Übungs-Bibliothek")
-- ----------------------------------------------------------------------------
create table app.exercises (
  id                   uuid primary key default app.uuid_v7(),
  club_id              uuid not null references app.clubs (id) on delete restrict,
  created_by_member_id uuid not null references app.club_members (id) on delete restrict,
  name                 text not null,
  description          text,
  category             app.exercise_category not null,
  difficulty           smallint not null,
  video_url            text,
  instructions         text,
  duration_seconds     integer,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  deleted_at           timestamptz,
  constraint exercises_difficulty_range check (difficulty between 1 and 5),
  constraint exercises_duration_positive check (duration_seconds is null or duration_seconds > 0)
);

create index exercises_club_idx          on app.exercises (club_id);
create index exercises_club_category_idx on app.exercises (club_id, category);

create trigger exercises_set_updated_at
  before update on app.exercises
  for each row execute function app.set_updated_at();

-- ----------------------------------------------------------------------------
-- RLS
--   news / exercises : read = is_club_member, write = is_club_trainer
--                      (owner/admin/moderator/coach + time-boxed guest_coach).
--   notes            : owner-only, on EVERY command — the one table platform
--                      admins deliberately cannot read (no is_club_member path).
-- Soft deletes go through the UPDATE policy (deleted_at = now()); a real DELETE
-- has no policy and is therefore denied for everyone (teams/events convention).
-- ----------------------------------------------------------------------------
alter table app.news      enable row level security;
alter table app.notes     enable row level security;
alter table app.exercises enable row level security;

-- news
create policy news_select on app.news
  for select to authenticated
  using (app.is_club_member(club_id));

create policy news_insert on app.news
  for insert to authenticated
  with check (app.is_club_trainer(club_id));

create policy news_update on app.news
  for update to authenticated
  using (app.is_club_trainer(club_id))
  with check (app.is_club_trainer(club_id));

-- notes — strictly private (owner_profile_id = auth.uid(), no other path)
create policy notes_select on app.notes
  for select to authenticated
  using (owner_profile_id = auth.uid());

create policy notes_insert on app.notes
  for insert to authenticated
  with check (owner_profile_id = auth.uid());

create policy notes_update on app.notes
  for update to authenticated
  using (owner_profile_id = auth.uid())
  with check (owner_profile_id = auth.uid());

-- exercises
create policy exercises_select on app.exercises
  for select to authenticated
  using (app.is_club_member(club_id));

create policy exercises_insert on app.exercises
  for insert to authenticated
  with check (app.is_club_trainer(club_id));

create policy exercises_update on app.exercises
  for update to authenticated
  using (app.is_club_trainer(club_id))
  with check (app.is_club_trainer(club_id));

commit;
