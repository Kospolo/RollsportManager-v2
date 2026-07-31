-- ============================================================================
-- 00_supabase_shim.sql — der Prod-Bootstrap VOR den Migrationen.
--
-- v2 hostet die Auth selbst (kein GoTrue). Ein self-hosted Supabase liefert
-- normalerweise die Client-Rollen (anon/authenticated/service_role), das
-- auth-Schema und auth.users „out of the box". Ohne GoTrue muessen WIR sie
-- anlegen — sonst brechen die Migrationen (0001 grantet an diese Rollen, 0079
-- altert auth.users). Dieser Block ist 1:1 der Dev-Test-Harness-Shim
-- (supabase/scripts/lib/pg-harness.sh), damit Prod und Test identisch starten.
--
-- Idempotent: laeuft gefahrlos mehrfach (if not exists / create or replace).
-- Muss als Superuser (postgres) VOR den Migrationen ausgefuehrt werden.
-- ============================================================================

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin bypassrls;
  end if;
end
$$;

create schema if not exists auth;

create table if not exists auth.users (
  id                 uuid primary key,
  email              text unique,
  raw_app_meta_data  jsonb not null default '{}'::jsonb,
  raw_user_meta_data jsonb not null default '{}'::jsonb,
  created_at         timestamptz not null default now()
);

create or replace function auth.uid()
returns uuid
language sql
stable
as $fn$
  select nullif(
    coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub', ''),
    ''
  )::uuid
$fn$;

create or replace function auth.jwt()
returns jsonb
language sql
stable
as $fn$
  select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb)
$fn$;

grant usage on schema auth to anon, authenticated, service_role;

-- Migrations-Buch (public.rsm_schema_migrations) — dieselbe Tabelle, die der
-- Harness fuehrt, damit migrate.sh weiss, was schon drin ist.
create table if not exists public.rsm_schema_migrations (
  name        text primary key,
  applied_at  timestamptz not null default now()
);
