-- ============================================================================
-- 0014_finance_b.sql — RollsportManager v2 — Beitragswesen (Finance depth B).
--
-- Builds on 0005_finance.sql (invoices/ledger) + 0007_roles_moderator.sql
-- (capability helpers) + 0013_finance_a.sql (Kassenbuch/Mahnwesen). Adds the
-- four tables the v1 membership screens relied on:
--
--   * membership_categories — the fee catalog (Kind/Jugend/Erwachsen/Passiv…),
--     each with an amount and a billing period (v1: membership-categories.html).
--   * member_fees          — assigns a category to a member for a validity
--     window, with an optional per-member override amount (v1: mitglieder-
--     beitraege.html).
--   * family_discounts     — sibling discounts ("ab dem 2. Kind 50 %"), either
--     a percentage or a fixed cent amount (v1: familien-rabatte.html).
--   * sepa_mandates        — SEPA direct-debit mandates (v1: sepa.html).
--
-- Hard rules (Blueprint §4 + Referenz 1.3):
--   * Managing categories / family discounts / SEPA mandates = can_manage_finance
--     (owner/admin/moderator/treasurer). Members never write any of these.
--   * A member may READ their OWN member_fees + their OWN sepa_mandate (and a
--     guardian those of their children — can_act_for_member covers both).
--     Categories + family_discounts are readable by every club member (they
--     describe the club's public fee model), but only finance may edit them.
--   * DATENSCHUTZ: no full IBAN in cleartext — only iban_last4 (last 4 digits)
--     plus the mandate_reference are stored. Real IBAN/BIC handling (encrypted
--     at rest) lands later; this table deliberately cannot hold a full IBAN.
--   * Money is integer cents (amount_cents / custom_amount_cents bigint). The
--     discount VALUE is numeric (a percent like 50.00, or a fixed cent amount).
--   * NEVER ON DELETE CASCADE on financial FKs — RESTRICT everywhere. Rows are
--     retired via deleted_at (soft-delete), never hard-deleted by clients.
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- membership_categories — the fee catalog. period drives how amount_cents is
-- billed (monthly/quarterly/yearly/once); the API's summary endpoint annualises
-- it. sort_order drives display order; is_active hides a retired tariff without
-- breaking member_fees rows that still reference it. Soft-delete via deleted_at.
-- ----------------------------------------------------------------------------
create table app.membership_categories (
  id           uuid primary key default app.uuid_v7(),
  club_id      uuid not null references app.clubs (id) on delete restrict,
  name         text not null,
  amount_cents bigint not null check (amount_cents >= 0),
  period       text not null check (period in ('monthly', 'quarterly', 'yearly', 'once')),
  is_active    boolean not null default true,
  sort_order   integer not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz
);

create index membership_categories_club_idx
  on app.membership_categories (club_id, sort_order, name)
  where deleted_at is null;

create trigger membership_categories_set_updated_at
  before update on app.membership_categories
  for each row execute function app.set_updated_at();

-- ----------------------------------------------------------------------------
-- member_fees — Beitragszuordnung: which category a member is on, for which
-- validity window. custom_amount_cents overrides the category amount for this
-- one member (hardship rate, board waiver, …) when not null. valid_until null =
-- open-ended (the current assignment). Soft-delete via deleted_at.
-- ----------------------------------------------------------------------------
create table app.member_fees (
  id                 uuid primary key default app.uuid_v7(),
  club_id            uuid not null references app.clubs (id) on delete restrict,
  member_id          uuid not null references app.club_members (id) on delete restrict,
  category_id        uuid not null references app.membership_categories (id) on delete restrict,
  custom_amount_cents bigint check (custom_amount_cents >= 0),
  valid_from         date not null,
  valid_until        date,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  deleted_at         timestamptz,
  constraint member_fees_valid_range check (valid_until is null or valid_until >= valid_from)
);

create index member_fees_club_idx    on app.member_fees (club_id) where deleted_at is null;
create index member_fees_member_idx  on app.member_fees (member_id) where deleted_at is null;
create index member_fees_category_idx on app.member_fees (category_id);

create trigger member_fees_set_updated_at
  before update on app.member_fees
  for each row execute function app.set_updated_at();

-- ----------------------------------------------------------------------------
-- family_discounts — sibling/family rebates. kind='percent' → value_numeric is
-- a percentage (e.g. 50.00 = 50 %); kind='fixed' → value_numeric is a fixed
-- amount in cents. applies_from_child is the ordinal from which the rebate
-- kicks in (v1 "ab dem 2. Kind" → 2). Soft-delete via deleted_at.
-- ----------------------------------------------------------------------------
create table app.family_discounts (
  id                 uuid primary key default app.uuid_v7(),
  club_id            uuid not null references app.clubs (id) on delete restrict,
  label              text not null,
  kind               text not null check (kind in ('percent', 'fixed')),
  value_numeric      numeric not null check (value_numeric >= 0),
  applies_from_child integer not null default 2 check (applies_from_child >= 1),
  is_active          boolean not null default true,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  deleted_at         timestamptz,
  -- a percentage can never exceed 100
  constraint family_discounts_percent_range
    check (kind <> 'percent' or value_numeric <= 100)
);

create index family_discounts_club_idx
  on app.family_discounts (club_id, applies_from_child)
  where deleted_at is null;

create trigger family_discounts_set_updated_at
  before update on app.family_discounts
  for each row execute function app.set_updated_at();

-- ----------------------------------------------------------------------------
-- sepa_mandates — SEPA direct-debit mandate metadata. DATENSCHUTZ: no full IBAN
-- — only iban_last4 (the last 4 digits, for the member to recognise their
-- account) and the mandate_reference. account_holder is the name on the account
-- (Kontoinhaber, may differ from the member for a child). status active/revoked.
-- Soft-delete via deleted_at. Encrypted full-IBAN storage lands later.
-- ----------------------------------------------------------------------------
create table app.sepa_mandates (
  id                uuid primary key default app.uuid_v7(),
  club_id           uuid not null references app.clubs (id) on delete restrict,
  member_id         uuid not null references app.club_members (id) on delete restrict,
  mandate_reference text not null,
  iban_last4        text check (iban_last4 ~ '^[0-9]{4}$'),
  account_holder    text not null,
  signed_on         date,
  status            text not null default 'active' check (status in ('active', 'revoked')),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  deleted_at        timestamptz,
  constraint sepa_mandates_reference_uq unique (club_id, mandate_reference)
);

create index sepa_mandates_club_idx   on app.sepa_mandates (club_id, status) where deleted_at is null;
create index sepa_mandates_member_idx on app.sepa_mandates (member_id) where deleted_at is null;

create trigger sepa_mandates_set_updated_at
  before update on app.sepa_mandates
  for each row execute function app.set_updated_at();

-- ----------------------------------------------------------------------------
-- RLS + grants.
--   * All four soft-delete via UPDATE (deleted_at), so clients never need
--     DELETE — revoke it as belt-and-suspenders.
--   * membership_categories / family_discounts: read = any club member,
--     write = can_manage_finance.
--   * member_fees / sepa_mandates: read = the member themselves (or their
--     guardian) OR can_manage_finance; write = can_manage_finance only.
-- ----------------------------------------------------------------------------
alter table app.membership_categories enable row level security;
alter table app.member_fees            enable row level security;
alter table app.family_discounts       enable row level security;
alter table app.sepa_mandates          enable row level security;

revoke delete on app.membership_categories from authenticated;
revoke delete on app.member_fees            from authenticated;
revoke delete on app.family_discounts       from authenticated;
revoke delete on app.sepa_mandates          from authenticated;

-- --- membership_categories -------------------------------------------------
create policy membership_categories_select on app.membership_categories
  for select to authenticated
  using (app.is_club_member(club_id));

create policy membership_categories_insert on app.membership_categories
  for insert to authenticated
  with check (app.can_manage_finance(club_id));

create policy membership_categories_update on app.membership_categories
  for update to authenticated
  using (app.can_manage_finance(club_id))
  with check (app.can_manage_finance(club_id));

-- --- member_fees -----------------------------------------------------------
create policy member_fees_select on app.member_fees
  for select to authenticated
  using (app.can_manage_finance(club_id) or app.can_act_for_member(member_id));

create policy member_fees_insert on app.member_fees
  for insert to authenticated
  with check (app.can_manage_finance(club_id));

create policy member_fees_update on app.member_fees
  for update to authenticated
  using (app.can_manage_finance(club_id))
  with check (app.can_manage_finance(club_id));

-- --- family_discounts ------------------------------------------------------
create policy family_discounts_select on app.family_discounts
  for select to authenticated
  using (app.is_club_member(club_id));

create policy family_discounts_insert on app.family_discounts
  for insert to authenticated
  with check (app.can_manage_finance(club_id));

create policy family_discounts_update on app.family_discounts
  for update to authenticated
  using (app.can_manage_finance(club_id))
  with check (app.can_manage_finance(club_id));

-- --- sepa_mandates ---------------------------------------------------------
create policy sepa_mandates_select on app.sepa_mandates
  for select to authenticated
  using (app.can_manage_finance(club_id) or app.can_act_for_member(member_id));

create policy sepa_mandates_insert on app.sepa_mandates
  for insert to authenticated
  with check (app.can_manage_finance(club_id));

create policy sepa_mandates_update on app.sepa_mandates
  for update to authenticated
  using (app.can_manage_finance(club_id))
  with check (app.can_manage_finance(club_id));

commit;
