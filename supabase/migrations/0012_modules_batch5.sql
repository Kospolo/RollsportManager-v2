-- ============================================================================
-- 0012_modules_batch5.sql — RollsportManager v2
-- Fifth batch of the owed modules (Referenz §3/§4 feature hub) — the two
-- PRO-gated modules from v1:
--   * gallery_items — Galerie (v1 gallery.html, checkPremiumAccess @ :437)
--   * documents     — Dokumente (v1 documents.html, checkPremiumAccess @ :325)
--
-- PRO-GATE, server-side (Referenz 1.5/4 "PRO-Gating"): in v1 the gate was a
-- pure client check (checkPremiumAccess()). v2 enforces it in the DATABASE:
-- both modules require the club to hold an ACTIVE pro/premium entitlement
-- (app.is_club_pro below). Without it, neither read nor write is possible —
-- the API surfaces that as HTTP 402 so the UI can show an upgrade hint, and
-- RLS is the second line of defense (a direct PostgREST request is denied too).
--
-- Rights on top of the PRO gate (Referenz 1.3):
--   * read  = is_club_member  AND is_club_pro
--   * write = is_club_trainer AND is_club_pro   (owner/admin/moderator/coach,
--             + time-boxed guest_coach)
-- Deletes are SOFT (deleted_at) — governed by the UPDATE policy; a real DELETE
-- has no policy and is default-denied (teams/events/0008..0011 convention).
-- Enum-like columns are TEXT + CHECK per the batch spec (the App shows labels).
--
-- STORAGE: the bytes live outside the DB (dev: a bind-mounted MEDIA_DIR, served
-- by the API; prod: object storage + signed URLs — the schema already carries
-- storage_key/content_type so that swap is a serving-layer change only). The
-- DB only ever holds the OPAQUE storage_key + metadata, never the blob.
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- Helper: does the club hold an ACTIVE pro/premium entitlement? (the PRO gate)
--
-- Reads app.entitlements (the single license truth, 0006): a club row whose
-- metadata.tier is 'pro' or 'premium', whose status is active/trial (the state
-- machine in modules/billing/entitlements.ts writes metadata.status; a legacy
-- manual row without a status counts as active, mirroring readEntitlementStatus)
-- and that has not expired (valid_until null = open-ended). A platform admin
-- short-circuits to true (cross-club READ, like is_club_member) — writes stay
-- gated by is_club_trainer, so a platform admin still cannot POST.
--
-- SECURITY DEFINER so the entitlement lookup runs regardless of the invoker's
-- table grants (the entitlements RLS only lets a client see its OWN rows;
-- the gate must work for every member). Mirrors is_club_member/is_team_member.
-- ----------------------------------------------------------------------------
create or replace function app.is_club_pro(p_club_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select app.is_platform_admin()
      or exists (
        select 1
        from app.entitlements e
        where e.subject_type = 'club'
          and e.subject_id = p_club_id
          and coalesce(e.metadata ->> 'tier', '') in ('pro', 'premium')
          and coalesce(e.metadata ->> 'status', 'active') in ('active', 'trial')
          and (e.valid_until is null or e.valid_until >= now())
      )
$$;

comment on function app.is_club_pro(uuid) is
  'Referenz 4 (PRO-Gating): true when the club holds an active pro/premium entitlement (or the caller is a platform admin). Gates the Galerie & Dokumente modules; the API maps a false result to HTTP 402.';

-- ----------------------------------------------------------------------------
-- gallery_items — Galerie (photos & video clips). album groups items into a
-- named gallery (nullable = "ungrouped"). kind is photo|video. storage_key is
-- the opaque handle the API serves the bytes under; thumbnail_key is an
-- optional poster/preview (typically for videos). uploaded_by_member_id is the
-- club_members row of the (trainer) uploader. Immutable once written (no field
-- edits) → no updated_at; soft-delete only.
-- ----------------------------------------------------------------------------
create table app.gallery_items (
  id                   uuid primary key default app.uuid_v7(),
  club_id              uuid not null references app.clubs (id) on delete restrict,
  album                text,
  title                text not null,
  kind                 text not null,
  storage_key          text not null,
  content_type         text not null,
  size_bytes           bigint not null check (size_bytes >= 0),
  thumbnail_key        text,
  uploaded_by_member_id uuid not null references app.club_members (id) on delete cascade,
  created_at           timestamptz not null default now(),
  deleted_at           timestamptz,
  constraint gallery_items_kind_check check (kind in ('photo', 'video'))
);

-- the album timeline: a club's gallery items, newest first per album
create index gallery_items_club_album_idx on app.gallery_items (club_id, album, created_at desc);
-- opaque-key lookup (the serve route resolves club_id + content_type by key)
create unique index gallery_items_storage_key_idx on app.gallery_items (storage_key);

-- ----------------------------------------------------------------------------
-- documents — Dokumente (satzung, ordnungen, elterninfos, …). category is a
-- free-text bucket the App renders as a label/filter. Same opaque-key storage
-- model as gallery_items. Metadata (title/category) is editable → updated_at.
-- ----------------------------------------------------------------------------
create table app.documents (
  id                   uuid primary key default app.uuid_v7(),
  club_id              uuid not null references app.clubs (id) on delete restrict,
  title                text not null,
  category             text not null default 'allgemein',
  storage_key          text not null,
  content_type         text not null,
  size_bytes           bigint not null check (size_bytes >= 0),
  uploaded_by_member_id uuid not null references app.club_members (id) on delete cascade,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  deleted_at           timestamptz
);

create index documents_club_category_idx on app.documents (club_id, category, created_at desc);
create unique index documents_storage_key_idx on app.documents (storage_key);

create trigger documents_set_updated_at
  before update on app.documents
  for each row execute function app.set_updated_at();

-- ----------------------------------------------------------------------------
-- RLS — read = member + PRO, write = trainer + PRO. is_club_pro is the extra
-- gate on top of the usual capability helpers (Referenz 4).
-- ----------------------------------------------------------------------------
alter table app.gallery_items enable row level security;
alter table app.documents     enable row level security;

-- gallery_items -------------------------------------------------------------
create policy gallery_items_select on app.gallery_items
  for select to authenticated
  using (app.is_club_member(club_id) and app.is_club_pro(club_id));

create policy gallery_items_insert on app.gallery_items
  for insert to authenticated
  with check (app.is_club_trainer(club_id) and app.is_club_pro(club_id));

-- update (soft-delete goes through here): trainer + PRO only.
create policy gallery_items_update on app.gallery_items
  for update to authenticated
  using (app.is_club_trainer(club_id) and app.is_club_pro(club_id))
  with check (app.is_club_trainer(club_id) and app.is_club_pro(club_id));

-- documents -----------------------------------------------------------------
create policy documents_select on app.documents
  for select to authenticated
  using (app.is_club_member(club_id) and app.is_club_pro(club_id));

create policy documents_insert on app.documents
  for insert to authenticated
  with check (app.is_club_trainer(club_id) and app.is_club_pro(club_id));

create policy documents_update on app.documents
  for update to authenticated
  using (app.is_club_trainer(club_id) and app.is_club_pro(club_id))
  with check (app.is_club_trainer(club_id) and app.is_club_pro(club_id));

commit;
