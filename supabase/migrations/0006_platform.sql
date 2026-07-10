-- ============================================================================
-- 0006_platform.sql — RollsportManager v2
-- Platform layer: products (single source of truth for pricing), entitlements
-- (the ONLY license/tier truth), webhook_events (idempotency), tasks.
--
-- Blueprint ADR-E6/E7:
--   * entitlements is written EXCLUSIVELY by the API layer (service_role).
--     Clients get SELECT on their own rows only — the v1 leak
--     (activate_premium executable by everyone) is structurally impossible.
--   * webhook_events lives in the internal schema: no client role has USAGE
--     there; the webhook service dedupes on (provider, event_id).
--   * products is the global catalog (club license tiers + personal pro IAP),
--     read-only for clients, maintained via API/admin.
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- Enums
-- ----------------------------------------------------------------------------
create type app.product_kind as enum ('club_license', 'personal_pro');

create type app.billing_interval as enum ('month', 'year');

create type app.entitlement_subject as enum ('club', 'profile');

create type app.entitlement_source as enum ('stripe', 'revenuecat', 'manual');

-- ----------------------------------------------------------------------------
-- products — global catalog (no club_id): Spond-style club tiers + Pro IAP.
-- Single source of truth for website, apps, StoreKit and Stripe config.
-- ----------------------------------------------------------------------------
create table app.products (
  id               uuid primary key default app.uuid_v7(),
  code             text not null unique,       -- e.g. 'club_tier_s', 'personal_pro'
  kind             app.product_kind not null,
  name             text not null,
  description      text,
  price_cents      bigint not null check (price_cents >= 0),
  currency         char(3) not null default 'EUR',
  billing_interval app.billing_interval not null default 'month',
  max_members      integer,                    -- club_license: server-enforced cap
  active           boolean not null default true,
  metadata         jsonb not null default '{}'::jsonb,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create trigger products_set_updated_at
  before update on app.products
  for each row execute function app.set_updated_at();

alter table app.products enable row level security;
revoke insert, update, delete on app.products from authenticated;

create policy products_select on app.products
  for select to authenticated
  using (active);
-- writes: service_role only (bypasses RLS); anon pricing goes through api views.

-- ----------------------------------------------------------------------------
-- entitlements — THE single truth for a club's license / a person's Pro tier.
-- subject_type/subject_id: 'club' → clubs.id, 'profile' → profiles.id.
-- ----------------------------------------------------------------------------
create table app.entitlements (
  id           uuid primary key default app.uuid_v7(),
  subject_type app.entitlement_subject not null,
  subject_id   uuid not null,
  entitlement  text not null,                 -- e.g. 'club_license', 'personal_pro'
  source       app.entitlement_source not null,
  product_id   uuid references app.products (id) on delete restrict,
  provider_ref text,                          -- Stripe sub id / RevenueCat entitlement id / note
  valid_until  timestamptz,
  metadata     jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index entitlements_subject_idx on app.entitlements (subject_type, subject_id);

create trigger entitlements_set_updated_at
  before update on app.entitlements
  for each row execute function app.set_updated_at();

alter table app.entitlements enable row level security;
-- Clients are strictly read-only — no INSERT/UPDATE/DELETE grant, no policy.
revoke insert, update, delete on app.entitlements from authenticated;

create policy entitlements_select on app.entitlements
  for select to authenticated
  using (
    (subject_type = 'profile' and subject_id = auth.uid())
    or (subject_type = 'club' and app.is_club_member(subject_id))
  );

-- ----------------------------------------------------------------------------
-- internal.webhook_events — idempotency ledger for ALL payment providers.
-- internal schema: anon/authenticated have no USAGE — invisible to clients.
-- ----------------------------------------------------------------------------
create table internal.webhook_events (
  id           uuid primary key default app.uuid_v7(),
  provider     text not null,                 -- 'stripe' | 'revenuecat' | ...
  event_id     text not null,                 -- provider event id (dedupe key)
  event_type   text,
  payload      jsonb not null default '{}'::jsonb,
  status       text not null default 'received'
               check (status in ('received', 'processed', 'failed', 'skipped')),
  error        text,
  received_at  timestamptz not null default now(),
  processed_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint webhook_events_uq unique (provider, event_id)
);

create trigger webhook_events_set_updated_at
  before update on internal.webhook_events
  for each row execute function app.set_updated_at();

alter table internal.webhook_events enable row level security;
-- no policies: service_role bypasses RLS; client roles lack schema USAGE anyway.

-- ----------------------------------------------------------------------------
-- tasks — club to-dos, optionally bound to a competition
-- ----------------------------------------------------------------------------
create table app.tasks (
  id                 uuid primary key default app.uuid_v7(),
  club_id            uuid not null references app.clubs (id) on delete restrict,
  title              text not null,
  done               boolean not null default false,
  due_on             date,
  assignee_member_id uuid references app.club_members (id) on delete set null,
  competition_id     uuid references app.competitions (id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  deleted_at         timestamptz
);

create index tasks_club_idx        on app.tasks (club_id, done);
create index tasks_competition_idx on app.tasks (competition_id)
  where competition_id is not null;

create trigger tasks_set_updated_at
  before update on app.tasks
  for each row execute function app.set_updated_at();

alter table app.tasks enable row level security;

create policy tasks_select on app.tasks
  for select to authenticated
  using (app.is_club_member(club_id));

create policy tasks_insert on app.tasks
  for insert to authenticated
  with check (app.has_club_role(club_id, array['owner', 'admin', 'coach']));

-- staff manage tasks; assignees may update their own task (e.g. tick it off)
create policy tasks_update on app.tasks
  for update to authenticated
  using (
    app.has_club_role(club_id, array['owner', 'admin', 'coach'])
    or app.can_act_for_member(assignee_member_id)
  )
  with check (
    app.has_club_role(club_id, array['owner', 'admin', 'coach'])
    or app.can_act_for_member(assignee_member_id)
  );

commit;
