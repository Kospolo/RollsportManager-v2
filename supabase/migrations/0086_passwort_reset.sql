-- ============================================================================
-- 0086_passwort_reset.sql — Einmal-Token fuer „Passwort vergessen".
--
-- Muster wie app.invitations (0065): gespeichert wird NUR der SHA-256 des
-- Tokens (token_hash) — der Klartext lebt ausschliesslich in der Reset-Mail.
-- Ein Datenbankabzug enthaelt damit keine benutzbaren Reset-Links.
--
-- === WARUM internal statt app ===
-- Reset-Token sind ein Geheimnis ohne jeden Mitglieds-Bezug — kein Verein liest
-- sie, keine RLS-Regel braucht sie. Sie gehoeren deshalb ins internal-Schema
-- (0001: „service_role only"): NUR der Service-Mode (die Auth-Routen) sieht sie,
-- `authenticated` hat auf internal ueberhaupt kein Usage-Recht. Kein RLS noetig,
-- weil kein Endnutzer je direkt herankommt.
--
-- === LEBENSZYKLUS ===
--   * request: neue Zeile (token_hash, expires_at = now()+1h). Beim Anfordern
--     werden aeltere offene Token derselben Person entwertet (used_at gesetzt),
--     damit nur der neueste Link gilt.
--   * confirm: Zeile per token_hash suchen (used_at null, expires_at > now()),
--     Passwort setzen, used_at = now(). Der Token ist danach verbraucht.
-- ============================================================================

begin;

create table internal.password_reset_tokens (
  id          uuid primary key default app.uuid_v7(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  token_hash  text not null,
  expires_at  timestamptz not null,
  used_at     timestamptz,
  created_at  timestamptz not null default now(),
  constraint password_reset_token_hash_not_blank check (btrim(token_hash) <> '')
);

comment on table internal.password_reset_tokens is
  'Einmal-Token fuer den Passwort-Reset (0086). Nur der SHA-256 des Tokens wird gespeichert; der Klartext lebt in der Mail. internal-Schema = ausschliesslich service_role (die Auth-Routen). Kein RLS, weil kein Endnutzer je direkt zugreift.';

create unique index password_reset_tokens_hash_uq on internal.password_reset_tokens (token_hash);
create index password_reset_tokens_user_idx on internal.password_reset_tokens (user_id);

-- internal-Tabellen erben `grant all to service_role` (0001 default privileges),
-- aber explizit ist hier ehrlicher (die Route lebt genau davon).
grant select, insert, update on internal.password_reset_tokens to service_role;

commit;
