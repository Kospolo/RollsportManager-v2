-- ============================================================================
-- 0085_auth_registrierung.sql — Die Rechte + Integritaet fuer die
-- Selbstregistrierung mit E-Mail/Passwort (POST /auth/register).
--
-- AUSGANGSLAGE (selbst geprueft): 0079 hat auth.users.password_hash eingefuehrt
-- und service_role NUR `select` gegeben — genug fuer den Login (auth-login.ts
-- liest), aber nicht fuers Anlegen. Die Registrierung legt ein neues Konto an,
-- braucht also INSERT (Konto) und spaeter UPDATE (Passwort-Reset / E-Mail
-- bestaetigt). Das Profil (app.profiles) darf service_role bereits (0001:
-- default privileges `grant all on tables to service_role`).
--
-- === self-contained Auth (KEIN GoTrue) ===
-- v2 stellt seine Zugangstokens selbst aus (auth-login.ts, HS256) und haelt die
-- Zugangsdaten in auth.users — es gibt keinen GoTrue-Dienst. Diese Migration
-- macht die Selbstanlage moeglich. In PROD wird auth.users vom Deploy-Bootstrap
-- angelegt (wie der Test-Harness-Shim), BEVOR die Migrationen laufen — deshalb
-- steht hier KEIN `create table auth.users` (das gehoert zum Hosting-Schritt).
--
-- === INTEGRITAET: eine E-Mail = ein Konto ===
-- Die Route prueft vor dem Anlegen auf Vorhandensein, aber zwei gleichzeitige
-- Registrierungen derselben Adresse koennten beide durchrutschen. Der eindeutige
-- Index (case-insensitiv) macht das unmoeglich — die zweite bekommt einen
-- 23505 statt eines Doppelkontos. Login/Registrierung matchen ohnehin auf
-- lower(email), also ist die Adresse case-insensitiv eindeutig.
--
-- === E-Mail-Bestaetigung vorbereitet, noch nicht erzwungen ===
-- email_confirmed_at wird jetzt eingefuehrt (nullable), damit der spaetere
-- Bestaetigungs-Flow (Anti-Missbrauch, App-Store-tauglich) daran andocken kann.
-- Erzwungen wird sie NOCH NICHT — Registrierung erlaubt sofortiges Anmelden,
-- bis der Bestaetigungs-Flow steht.
-- ============================================================================

begin;

-- Registrierung/Reset schreiben auf auth.users (0079 gab nur select).
grant insert, update on auth.users to service_role;

-- E-Mail case-insensitiv eindeutig (Doppelkonto-Schutz auch bei Wettlauf).
create unique index if not exists auth_users_email_lower_uidx
  on auth.users (lower(email));

-- Bestaetigungs-Zeitstempel fuer den spaeteren E-Mail-Verify-Flow.
alter table auth.users
  add column if not exists email_confirmed_at timestamptz;

comment on column auth.users.email_confirmed_at is
  'Zeitpunkt der E-Mail-Bestaetigung (0085). null = noch nicht bestaetigt. Wird vom kommenden Verify-Flow gesetzt; die Registrierung erlaubt vorerst sofortiges Anmelden.';

commit;
