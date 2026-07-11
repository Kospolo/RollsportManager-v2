-- ============================================================================
-- 0020_cluster6a.sql — RollsportManager v2 — Cluster 6a (the family/self-service
-- rest): Familie, Wartelisten, Budget(-planung) und Profilfoto.
--
-- Four surfaces from the Referenz feature hub (§3.1/§3.2, v1 family.html +
-- portal-family.js, warteliste.html, budget.html, profile.html):
--
--   * FAMILIE — no new table: the family model already lives in
--     app.guardianships (0002, guardian_member_id ↔ child_member_id). A child
--     is a club_members row WITHOUT profile_id (bestehendes Muster, 0002). The
--     self-service ("Eltern verwalten EIGENE Kinder") is enforced in the API
--     layer (routes/members.ts: POST /children, POST/DELETE /guardianships):
--     a plain member may only ever act with guardian_member_id = their OWN
--     club_members row; is_club_admin may act for anyone. The guardianships RLS
--     (0002: read = involved persons OR admin, write = admin) is DELIBERATELY
--     left unchanged — it is the second line of defense and the escalation
--     tests (70_guardianship.sql) must keep holding. This migration only adds a
--     small integrity guard (see guardianship_same_club below).
--
--   * WARTELISTEN — app.waitlists: a member queues themselves for a scarce
--     resource (hall/room, equipment, team slot, event). Read = own row OR
--     trainer; a member joins/leaves themselves, a trainer manages everyone's.
--
--   * BUDGET — app.budgets: the yearly plan per Kassenbuch category
--     (ledger_categories, 0013). Plan-vs-Ist is derived against the ledger in
--     the API (routes/budgets.ts GET /reports/budget). Finance roles only.
--
--   * PROFILFOTO — app.club_members gains avatar_key (opaque media key, same
--     storage model as gallery/documents 0012). Everyone sets it for their OWN
--     profile (API POST /me/photo); it is served through the existing /media
--     route and surfaced as avatar_url on member/club-member responses.
--
-- Conventions follow the module batches (0008–0019): TEXT + CHECK for enum-like
-- columns, soft-delete via deleted_at (no hard-DELETE grant), updated_at
-- trigger, RLS enabled with one policy per command, helpers from 0007
-- (is_club_trainer / can_manage_finance / is_own_member / is_club_admin).
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- FAMILIE — integrity guard only (no RLS change, see header).
--
-- guardianship_same_club: guardian and child must belong to the SAME club as
-- the guardianship row. The API already guarantees this, but a stray direct
-- write (service mode) could otherwise cross tenants. INSERT-only so it never
-- interferes with the soft-delete UPDATE path or the escalation tests, which
-- exercise updates as no-ops (0 rows) rather than errors.
-- ----------------------------------------------------------------------------
create or replace function app.guardianship_same_club()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from app.club_members m
    where m.id = new.guardian_member_id and m.club_id = new.club_id and m.deleted_at is null
  ) then
    raise exception 'guardian % is not a member of club %', new.guardian_member_id, new.club_id
      using errcode = 'check_violation';
  end if;
  if not exists (
    select 1 from app.club_members m
    where m.id = new.child_member_id and m.club_id = new.club_id and m.deleted_at is null
  ) then
    raise exception 'child % is not a member of club %', new.child_member_id, new.club_id
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger guardianships_same_club
  before insert on app.guardianships
  for each row execute function app.guardianship_same_club();

-- avatar_key on the roster row (Profilfoto). Opaque media key, nullable
-- (no photo yet). Served via /media/{key}; the response exposes avatar_url.
alter table app.club_members
  add column if not exists avatar_key text;

comment on column app.club_members.avatar_key is
  'Opaque media storage key of the member''s profile photo (0020). Served via /media/{key}; NULL = no photo. Set only for the OWN profile (API POST /me/photo).';

-- ----------------------------------------------------------------------------
-- WARTELISTEN — app.waitlists (v1 warteliste.html). A member queues for a
-- scarce resource. kind names the resource class; target_id is the optional
-- concrete resource (a facility/equipment/team/event id — no FK on purpose so
-- one table serves every resource class, mirroring the App's generic list).
-- status walks waiting -> offered -> fulfilled | cancelled.
-- ----------------------------------------------------------------------------
create table app.waitlists (
  id         uuid primary key default app.uuid_v7(),
  club_id    uuid not null references app.clubs (id) on delete restrict,
  member_id  uuid not null references app.club_members (id) on delete cascade,
  kind       text not null,
  target_id  uuid,
  note       text,
  status     text not null default 'waiting',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint waitlists_kind_check   check (kind in ('facility', 'equipment', 'team', 'event')),
  constraint waitlists_status_check check (status in ('waiting', 'offered', 'fulfilled', 'cancelled'))
);

-- the queue view: a club's active entries by resource, oldest first (FIFO).
create index waitlists_club_kind_idx on app.waitlists (club_id, kind, target_id, created_at);
-- "my waitlist entries" lookup.
create index waitlists_member_idx on app.waitlists (member_id) where deleted_at is null;

create trigger waitlists_set_updated_at
  before update on app.waitlists
  for each row execute function app.set_updated_at();

-- ----------------------------------------------------------------------------
-- BUDGET — app.budgets (v1 budget.html). The planned amount per Kassenbuch
-- category and year; Ist comes from app.ledger_entries in the report. One plan
-- row per (club, year, category) while not soft-deleted.
-- ----------------------------------------------------------------------------
create table app.budgets (
  id           uuid primary key default app.uuid_v7(),
  club_id      uuid not null references app.clubs (id) on delete restrict,
  year         integer not null,
  category_id  uuid not null references app.ledger_categories (id) on delete restrict,
  planned_cents bigint not null default 0,
  note         text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz,
  constraint budgets_year_check check (year between 2000 and 2100)
);

-- one active plan per club/year/category (soft-deleted rows are exempt).
create unique index budgets_club_year_category_uq
  on app.budgets (club_id, year, category_id) where deleted_at is null;
create index budgets_club_year_idx on app.budgets (club_id, year);

create trigger budgets_set_updated_at
  before update on app.budgets
  for each row execute function app.set_updated_at();

-- ----------------------------------------------------------------------------
-- RLS — waitlists: read = own OR trainer; write = own OR trainer.
-- (Referenz: Mitglied trägt sich selbst ein/aus, Trainer+ verwaltet alle.)
-- Deletes are SOFT (deleted_at) through the UPDATE policy; a hard DELETE has no
-- policy and is additionally revoked below.
-- ----------------------------------------------------------------------------
alter table app.waitlists enable row level security;
revoke delete on app.waitlists from authenticated;

create policy waitlists_select on app.waitlists
  for select to authenticated
  using (app.is_club_trainer(club_id) or app.is_own_member(member_id));

create policy waitlists_insert on app.waitlists
  for insert to authenticated
  with check (
    app.is_club_member(club_id)
    and (app.is_club_trainer(club_id) or app.is_own_member(member_id))
  );

create policy waitlists_update on app.waitlists
  for update to authenticated
  using (app.is_club_trainer(club_id) or app.is_own_member(member_id))
  with check (app.is_club_trainer(club_id) or app.is_own_member(member_id));

-- ----------------------------------------------------------------------------
-- RLS — budgets: read + write (incl. soft-delete via UPDATE) = can_manage_finance
-- (owner/admin/moderator/treasurer). Hard DELETE revoked (soft-delete only).
-- ----------------------------------------------------------------------------
alter table app.budgets enable row level security;
revoke delete on app.budgets from authenticated;

create policy budgets_select on app.budgets
  for select to authenticated
  using (app.can_manage_finance(club_id));

create policy budgets_insert on app.budgets
  for insert to authenticated
  with check (app.can_manage_finance(club_id));

create policy budgets_update on app.budgets
  for update to authenticated
  using (app.can_manage_finance(club_id))
  with check (app.can_manage_finance(club_id));

-- NB: the Cluster-6a demo data (waitlists + budgets) is seeded in
-- supabase/seed/seed.sql, which runs AFTER every migration — its rows reference
-- seed-only clubs/members/ledger_categories that do not exist at migration time.

commit;
