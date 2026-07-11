-- ============================================================================
-- 0019_platform.sql — RollsportManager v2 — Betreiber-Konsole (Referenz §3.3:
-- server-settings.html, email.html, legal.html, content.html, seo.html,
-- monetization.html, premium.html, system.html).
--
-- Two internal objects powering the cross-club super-admin console:
--
--   1. internal.platform_settings — a SINGLETON row (id = 1) holding the
--      operator-configurable platform settings that the user-preference rule
--      "Einstellungen immer ins Admin" keeps OUT of .env:
--        * smtp          jsonb  — host/port/user/from/secure + password
--        * legal         jsonb  — Impressum / Datenschutz / AGB texts
--        * content       jsonb  — website copy + SEO meta
--        * feature_flags jsonb  — global on/off switches
--      DATENSCHUTZ: the SMTP password lives here but is NEVER returned in the
--      clear by the API (GET /platform/settings masks it to password_set:bool).
--
--      Access model — this is the ONE internal object deliberately reachable by
--      the `authenticated` role, gated ENTIRELY by RLS app.is_platform_admin():
--        * every other internal object (webhook_events, future queues/jobs)
--          grants nothing to authenticated and stays invisible (42501);
--        * a platform admin is a normal authenticated user whose JWT carries
--          the is_platform_admin claim, so the API reads/writes this row
--          IMPERSONATED (src/db.ts withUser) and RLS is the live enforcement —
--          "impersonation, not bypass" (Blueprint ADR-E2/E3), same as every
--          club route. The API additionally guards with requirePlatformAdmin.
--
--   2. internal.schema_migrations — a lightweight applied-migrations ledger so
--      GET /platform/system can report which migrations the database carries.
--      service_role only (read via the API's system-mode). Seeded with every
--      version through 0019; each future migration appends its own row.
--
-- Enforcement is server-side (Blueprint risk #16, Referenz 1.4 "Stufe 1 – nur
-- super_admin"): the RLS policies + the API guard are the two lines of defense.
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 1. internal.platform_settings — operator settings singleton (id = 1).
-- ----------------------------------------------------------------------------
create table internal.platform_settings (
  id            smallint primary key default 1 check (id = 1),
  -- { host, port, user, from, secure, password } — password never returned clear
  smtp          jsonb not null default '{}'::jsonb,
  -- { impressum, datenschutz, agb }
  legal         jsonb not null default '{}'::jsonb,
  -- { website_title, website_subtitle, seo_title, seo_description, seo_keywords }
  content       jsonb not null default '{}'::jsonb,
  -- global on/off switches: { "<flag>": bool }
  feature_flags jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table internal.platform_settings is
  'Operator-configurable platform settings (SMTP/legal/content/feature flags) as a singleton row (id=1). Admin-UI backed (never .env). RLS: app.is_platform_admin() only; the SMTP password is masked by the API.';

create trigger platform_settings_set_updated_at
  before update on internal.platform_settings
  for each row execute function app.set_updated_at();

-- The `authenticated` role reaches ONLY this internal object (USAGE on the
-- schema is otherwise service_role-only). No table grant on any other internal
-- object, so webhook_events & co. stay invisible (42501) exactly as before.
grant usage on schema internal to authenticated;
grant select, insert, update on internal.platform_settings to authenticated;
-- No DELETE: the singleton is upserted, never removed.

alter table internal.platform_settings enable row level security;

-- ONLY a platform admin (JWT claim) may read or write the settings row.
create policy platform_settings_select on internal.platform_settings
  for select to authenticated
  using (app.is_platform_admin());

create policy platform_settings_insert on internal.platform_settings
  for insert to authenticated
  with check (app.is_platform_admin());

create policy platform_settings_update on internal.platform_settings
  for update to authenticated
  using (app.is_platform_admin())
  with check (app.is_platform_admin());

-- Seed the singleton with placeholders (migration-time: no club/profile deps).
insert into internal.platform_settings (id, smtp, legal, content, feature_flags)
values (
  1,
  jsonb_build_object(
    'host', 'smtp.example.org',
    'port', 587,
    'user', 'noreply@example.org',
    'from', 'RollsportManager <noreply@example.org>',
    'secure', true,
    'password', ''
  ),
  jsonb_build_object(
    'impressum', 'Platzhalter Impressum — im Betreiber-Bereich pflegen.',
    'datenschutz', 'Platzhalter Datenschutzerklärung — im Betreiber-Bereich pflegen.',
    'agb', 'Platzhalter AGB — im Betreiber-Bereich pflegen.'
  ),
  jsonb_build_object(
    'website_title', 'RollsportManager',
    'website_subtitle', 'Vereinsverwaltung für den Rollsport',
    'seo_title', 'RollsportManager — Vereinssoftware für den Rollsport',
    'seo_description', 'Die Vereinssoftware für Rollkunstlauf und Rollsport: Mitglieder, Küren, Wettkämpfe und Finanzen an einem Ort.',
    'seo_keywords', 'Rollsport, Rollkunstlauf, Vereinsverwaltung, Wettkampf'
  ),
  jsonb_build_object(
    'registration_open', true,
    'public_website', true,
    'maintenance_mode', false
  )
)
on conflict (id) do nothing;

-- ----------------------------------------------------------------------------
-- 2. internal.schema_migrations — applied-migrations ledger (service_role only).
--    Read by GET /platform/system in service mode. Seed everything up to 0019;
--    every future migration appends its own version row here.
-- ----------------------------------------------------------------------------
create table internal.schema_migrations (
  version    text primary key,
  applied_at timestamptz not null default now()
);

comment on table internal.schema_migrations is
  'Applied-migrations ledger surfaced by GET /platform/system. service_role only; each migration appends its version.';

alter table internal.schema_migrations enable row level security;
-- no policies + no authenticated grant: service_role bypasses RLS, clients cannot reach it.

insert into internal.schema_migrations (version) values
  ('0001_foundation'),
  ('0002_identity_tenancy'),
  ('0003_teams_events'),
  ('0004_media_routines_competitions'),
  ('0005_finance'),
  ('0006_platform'),
  ('0007_roles_moderator'),
  ('0008_modules_batch1'),
  ('0009_modules_batch2'),
  ('0010_modules_batch3'),
  ('0011_modules_batch4'),
  ('0012_modules_batch5'),
  ('0013_finance_a'),
  ('0014_finance_b'),
  ('0015_finance_c'),
  ('0016_appshell'),
  ('0017_organisation'),
  ('0018_wettkampf'),
  ('0019_platform')
on conflict (version) do nothing;

commit;
