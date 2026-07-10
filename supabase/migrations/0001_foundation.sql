-- ============================================================================
-- 0001_foundation.sql — RollsportManager v2
-- Foundation: schemas, grants, uuid_v7(), updated_at trigger, JWT claim helpers.
--
-- Target platform: self-hosted Supabase (Postgres 16/17).
--   auth schema, auth.users, auth.uid() and the roles anon / authenticated /
--   service_role are provided by Supabase. The local test harness
--   (supabase/scripts/db-test.sh) creates a minimal shim for plain Postgres.
--
-- Conventions (Blueprint ADR-E7 / §4):
--   * English, snake_case, ASCII everywhere.
--   * PKs: UUIDv7 via app.uuid_v7() — client-generatable for offline idempotency.
--   * Money: amount_cents BIGINT + currency CHAR(3), never float.
--   * Time: TIMESTAMPTZ (UTC); created_at/updated_at on every table,
--     updated_at maintained by a BEFORE UPDATE trigger.
--   * Soft deletes: deleted_at on domain/sync tables (PowerSync tombstones).
--     Financial data is NEVER hard-deleted (GoBD) — reversal entries instead.
--   * RLS ENABLED on every table; policies read club_roles from JWT claims.
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- Schemas (Blueprint §4: app = tables, api = PostgREST-exposed views/RPCs,
-- internal = queues/jobs/webhook idempotency — service_role only)
-- ----------------------------------------------------------------------------
create schema if not exists app;
create schema if not exists api;
create schema if not exists internal;

comment on schema app      is 'Domain tables. Never exposed to PostgREST directly.';
comment on schema api      is 'The only PostgREST-exposed schema. Views/RPCs are added by the API layer.';
comment on schema internal is 'Queues, jobs, webhook idempotency. service_role only.';

grant usage on schema app to authenticated, service_role;
grant usage on schema api to anon, authenticated, service_role;
grant usage on schema internal to service_role;
-- anon gets NO access to app; public reads go through api views later.

-- Default privileges for tables created by this migration role in later files.
-- RLS is the row filter; sensitive tables additionally REVOKE below (0005/0006).
alter default privileges in schema app
  grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema app
  grant all on tables to service_role;
alter default privileges in schema internal
  grant all on tables to service_role;
alter default privileges in schema api
  grant select on tables to anon, authenticated;
alter default privileges in schema api
  grant all on tables to service_role;

-- ----------------------------------------------------------------------------
-- app.uuid_v7() — UUIDv7 primary keys (time-ordered, offline-generatable).
-- Canonical implementation: ms-precision unix timestamp in the first 48 bits,
-- version bits set to 0111 (7), remaining bits random (gen_random_uuid).
-- ----------------------------------------------------------------------------
create or replace function app.uuid_v7()
returns uuid
language sql
volatile
parallel safe
set search_path = ''
as $$
  select encode(
    set_bit(
      set_bit(
        overlay(uuid_send(gen_random_uuid())
                placing substring(int8send(floor(extract(epoch from clock_timestamp()) * 1000)::bigint) from 3)
                from 1 for 6),
        52, 1),
      53, 1),
    'hex')::uuid
$$;

comment on function app.uuid_v7() is 'UUIDv7: time-ordered UUID (48-bit ms timestamp + random). Default for all PKs.';

-- ----------------------------------------------------------------------------
-- app.set_updated_at() — BEFORE UPDATE trigger function for updated_at.
-- (Own implementation instead of the moddatetime extension so the schema also
--  runs on vanilla Postgres, e.g. in the local test harness.)
-- ----------------------------------------------------------------------------
create or replace function app.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- JWT claim helpers (Blueprint ADR-E3/E4).
-- GoTrue writes club memberships into the access token via a custom access
-- token hook: claims.club_roles = { "<club_id>": "<role>", ... }.
-- Policies read ONLY these helpers — never a PATCH-able column.
-- ----------------------------------------------------------------------------
create or replace function app.jwt_claims()
returns jsonb
language sql
stable
set search_path = ''
as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb)
$$;

comment on function app.jwt_claims() is 'Parsed JWT claims of the current request ({} when unauthenticated).';

create or replace function app.jwt_club_role(p_club_id uuid)
returns text
language sql
stable
set search_path = ''
as $$
  select app.jwt_claims() -> 'club_roles' ->> p_club_id::text
$$;

comment on function app.jwt_club_role(uuid) is 'Role of the current user in the given club, from JWT claims (null = not a member).';

commit;
