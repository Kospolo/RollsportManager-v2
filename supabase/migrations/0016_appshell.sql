-- ============================================================================
-- 0016_appshell.sql — RollsportManager v2 — App-Shell backend base.
--
-- Two surfaces the shell (Topbar/Sidebar, "Mein Profil", Einstellungen) needs,
-- both strictly self-scoped (Referenz §3.2 profile / *-settings, v1
-- notification-settings.html):
--
--   * app.user_preferences — one row per login identity (PK = auth.uid()):
--       locale, theme ('light'|'dark'|'auto'), notifications toggle-flags
--       (events/invoices/news/chat as jsonb). STRICTLY PRIVATE: only the owner
--       reads/writes their own row (RLS profile_id = auth.uid()). No fellow
--       member, not even a platform admin (cross-club READER), sees it.
--
--   * a self-service UPDATE path on app.club_members so a plain member may edit
--     their OWN master data (first/last name, e-mail, birth date) without
--     can_manage_members — the "Mein Profil bearbeiten" case. The existing
--     protect_club_membership trigger (0002/0007) still blocks any self-change
--     to role/status/valid_until/profile_id (P0001), so this policy can never
--     become a privilege-escalation path. Managers keep their own
--     club_members_update policy (0007) unchanged; RLS policies are OR-combined.
--
-- Enforcement is server-side (RLS + trigger) — the single source of truth. The
-- API (/me, /me/preferences) impersonates the caller (src/db.ts withUser), so
-- these policies apply to every API write exactly as to a direct PostgREST one.
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- user_preferences — per-identity shell settings (locale / theme / notifications)
-- ----------------------------------------------------------------------------
create table app.user_preferences (
  profile_id    uuid primary key references app.profiles (id) on delete cascade,
  locale        text not null default 'de',
  theme         text not null default 'auto'
                  check (theme in ('light', 'dark', 'auto')),
  -- toggle-flags: { "events": bool, "invoices": bool, "news": bool, "chat": bool }
  notifications jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table app.user_preferences is
  'Per-login-identity shell preferences (locale, theme, notification toggles). Strictly private: RLS profile_id = auth.uid().';

create trigger user_preferences_set_updated_at
  before update on app.user_preferences
  for each row execute function app.set_updated_at();

alter table app.user_preferences enable row level security;

-- Strictly own row for every command (no cross-user read — a platform admin is
-- a cross-club reader elsewhere, but preferences are personal, never shared).
create policy user_preferences_select on app.user_preferences
  for select to authenticated
  using (profile_id = auth.uid());

create policy user_preferences_insert on app.user_preferences
  for insert to authenticated
  with check (profile_id = auth.uid());

create policy user_preferences_update on app.user_preferences
  for update to authenticated
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());
-- no DELETE policy: preferences are upserted, never deleted by clients.

-- ----------------------------------------------------------------------------
-- club_members: self-service master-data edit ("Mein Profil bearbeiten").
-- A member may UPDATE their OWN row; the protect_club_membership trigger keeps
-- role/status/valid_until/profile_id off-limits (raises P0001 on self-change).
-- This is ADD-ONLY: the manager policy club_members_update (0007) stays; RLS
-- permissive policies are OR-combined, so managers keep editing others and
-- members gain editing themselves.
-- ----------------------------------------------------------------------------
create policy club_members_update_self on app.club_members
  for update to authenticated
  using (profile_id = auth.uid() and deleted_at is null)
  with check (profile_id = auth.uid());

commit;

-- NB: the dev-persona preference rows are seeded in supabase/seed/seed.sql
-- (migrations run BEFORE the seed, so app.profiles is still empty here).
