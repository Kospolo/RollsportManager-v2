-- 0079 — echter Login: Passwort-Hash an der Anmelde-Identität.
--
-- Bis hierher hatte v2 KEINEN Passwort-Login: auth.users trug id, email und
-- Metadaten, aber keine Möglichkeit, ein Passwort zu prüfen. Angemeldet wurde
-- nur über den Dev-Persona-Login. Diese Spalte macht echte E-Mail+Passwort-
-- Anmeldung möglich (POST /auth/login prüft dagegen).
--
-- Der Hash steht im Format "scrypt$<salt>$<hash>" (services/api/src/lib/
-- password.ts). NIE ein Klartext-Passwort — hier nicht, und nirgends sonst.
-- auth.users wird vom Harness-Shim vor den Migrationen angelegt, deshalb greift
-- das ALTER hier zuverlässig.
begin;

alter table auth.users
  add column if not exists password_hash text;

-- POST /auth/login liest auth.users im Service-Mode (der Aufrufer hat noch
-- keine Identität). service_role hatte bisher KEIN Leserecht auf auth.users
-- (nur `usage` auf dem Schema) — die Anmeldung scheiterte deshalb mit
-- „permission denied for table users". Nur SELECT, nur diese eine Systemrolle.
grant select on auth.users to service_role;

comment on column auth.users.password_hash is
  'scrypt-Hash des Passworts im Format scrypt$<saltHex>$<hashHex> (password.ts). '
  'NULL = dieses Konto hat (noch) kein Passwort und kann sich nicht per '
  'E-Mail/Passwort anmelden. Gesetzt bei der Registrierung bzw. im dev-Seed '
  '(dev-accounts.sql). Geprüft von POST /auth/login.';

commit;
