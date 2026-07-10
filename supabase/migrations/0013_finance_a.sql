-- ============================================================================
-- 0013_finance_a.sql — RollsportManager v2 — Finance depth, Batch A.
--
-- Builds on 0005_finance.sql + 0007_roles_moderator.sql. Adds the two pieces
-- the v1 finance screens (kassenbuch.html, mahnungen.html) relied on but the
-- v2 schema was still missing:
--
--   * app.ledger_categories — the Kassenbuch category catalog (Beitrag/Spende/
--     Halle/Material/…). ledger_entries gains a nullable category_id FK next to
--     the legacy free-text `category` column (kept for back-compat + import).
--   * app.dunning_log — an append-only audit trail of every Mahn-stage change
--     (reminder → dunning → handover), written by the API's dunning/apply.
--
-- Hard rules carried over (Blueprint §4 + GoBD, unchanged from 0005/0007):
--   * Finance = can_manage_finance (owner/admin/moderator/treasurer). Members
--     never see the cash book, categories or the dunning log.
--   * NEVER ON DELETE CASCADE on financial FKs — RESTRICT everywhere.
--   * dunning_log is append-only for EVERY role (incl. service_role): no
--     UPDATE, no DELETE — the Mahn-history is never rewritten.
--   * invoices/ledger keep their existing no-hard-delete guards (0005). This
--     migration only ensures paid_via exists; status/paid_at already do.
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- ledger_categories — Kassenbuch category catalog. kind splits income vs.
-- expense so the App can filter/colour and the sums stay separable. sort_order
-- drives the display order. Soft-delete via deleted_at (a category may be
-- retired without breaking historic ledger rows that still reference it).
-- ----------------------------------------------------------------------------
create table app.ledger_categories (
  id         uuid primary key default app.uuid_v7(),
  club_id    uuid not null references app.clubs (id) on delete restrict,
  name       text not null,
  kind       text not null check (kind in ('income', 'expense')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index ledger_categories_club_idx
  on app.ledger_categories (club_id, kind, sort_order)
  where deleted_at is null;

-- ----------------------------------------------------------------------------
-- ledger_entries.category_id — structured category next to the legacy text.
-- Nullable (imported/legacy rows have none) and RESTRICT so a category that is
-- still referenced by a journal row can never be hard-deleted (GoBD: history
-- stays resolvable). The append-only trigger from 0005 keeps existing rows
-- immutable; this is a plain additive DDL column, so it does not fire.
-- ----------------------------------------------------------------------------
alter table app.ledger_entries
  add column if not exists category_id uuid references app.ledger_categories (id) on delete restrict;

create index if not exists ledger_entries_category_idx
  on app.ledger_entries (category_id)
  where category_id is not null;

-- ----------------------------------------------------------------------------
-- invoices.paid_via — how a paid invoice was settled (SEPA/bar/Überweisung…),
-- free text, nullable. status ('draft'|'open'|'paid'|'cancelled') and paid_at
-- already exist (0005) — guard with IF NOT EXISTS so this stays idempotent.
-- ----------------------------------------------------------------------------
alter table app.invoices
  add column if not exists paid_via text;

-- ----------------------------------------------------------------------------
-- dunning_log — append-only audit of Mahn-stage changes. One row per applied
-- step: from_stage → to_stage, the action bucket, who did it, an optional note.
-- action:  reminder  = stage 1 (Zahlungserinnerung)
--          dunning   = stage 2/3 (1./2. Mahnung)
--          handover  = stage 4 (Übergabe/Inkasso)
-- actor_member_id is the club_members row of the treasurer/admin who applied
-- the step (nullable + SET NULL: keep the log if the member row is later
-- removed — GoBD keeps the record, the actor link may lapse).
-- ----------------------------------------------------------------------------
create table app.dunning_log (
  id              uuid primary key default app.uuid_v7(),
  club_id         uuid not null references app.clubs (id) on delete restrict,
  invoice_id      uuid not null references app.invoices (id) on delete restrict,
  from_stage      integer not null,
  to_stage        integer not null,
  action          text not null check (action in ('reminder', 'dunning', 'handover')),
  actor_member_id uuid references app.club_members (id) on delete set null,
  note            text,
  created_at      timestamptz not null default now()
);

create index dunning_log_club_idx    on app.dunning_log (club_id, created_at desc);
create index dunning_log_invoice_idx on app.dunning_log (invoice_id, created_at desc);

-- append-only for EVERY role (incl. service_role/superuser): the Mahn-history
-- is never edited or deleted — mirrors the ledger_entries immutability (0005).
create or replace function app.dunning_log_immutable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'dunning_log is append-only — Mahn-history is never edited or deleted';
end;
$$;

create trigger dunning_log_no_update
  before update on app.dunning_log
  for each row execute function app.dunning_log_immutable();

create trigger dunning_log_no_delete
  before delete on app.dunning_log
  for each row execute function app.dunning_log_immutable();

-- ----------------------------------------------------------------------------
-- RLS + grants — finance roles only for all three surfaces.
-- ----------------------------------------------------------------------------
alter table app.ledger_categories enable row level security;
alter table app.dunning_log       enable row level security;

-- belt and suspenders: clients can never hard-delete either table even if a
-- policy were added by mistake (categories soft-delete via UPDATE; the
-- dunning_log has the immutability trigger on top).
revoke delete on app.ledger_categories from authenticated;
revoke update, delete on app.dunning_log from authenticated;

-- ledger_categories: read + write (incl. soft-delete via UPDATE) = finance.
create policy ledger_categories_select on app.ledger_categories
  for select to authenticated
  using (app.can_manage_finance(club_id));

create policy ledger_categories_insert on app.ledger_categories
  for insert to authenticated
  with check (app.can_manage_finance(club_id));

create policy ledger_categories_update on app.ledger_categories
  for update to authenticated
  using (app.can_manage_finance(club_id))
  with check (app.can_manage_finance(club_id));

-- dunning_log: read + insert = finance; no UPDATE/DELETE policy (default deny),
-- and the immutability trigger guards every role on top.
create policy dunning_log_select on app.dunning_log
  for select to authenticated
  using (app.can_manage_finance(club_id));

create policy dunning_log_insert on app.dunning_log
  for insert to authenticated
  with check (app.can_manage_finance(club_id));

commit;
