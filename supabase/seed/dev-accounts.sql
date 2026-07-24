-- dev-accounts.sql — Marcels benannte Konten fuer jeden Bereich.
--
-- === WOFUER DAS DA IST ===
-- Der Seed (seed/seed.sql) legt einen realistischen Verein mit erfundenen
-- Personen an — Sandra Vogel, Juergen Haeberle und so weiter. Die sind zum
-- ANSEHEN gut, aber nicht zum ARBEITEN: Wer pruefen will, was ein Kassenwart
-- sieht, will sich als Kassenwart anmelden und nicht raten, welche der 33
-- Personen gerade welche Rolle traegt.
--
-- Diese Datei legt deshalb je Bereich EIN benanntes Konto an, dazu Marcels
-- Super-Admin und ein Konto fuer die App-Store-Pruefung bei Apple. Die
-- Adressen sind sprechend (kasse@…, trainer@…), damit man sie sich nicht
-- merken muss.
--
-- === WAS HIER NICHT DRINSTEHT: DAS PASSWORT ===
-- Und das ist kein Versehen. Die Tabelle `auth.users` im Dev-Stack ist eine
-- ATTRAPPE der Testumgebung (supabase/scripts/lib/pg-harness.sh) — sie hat
-- id, email und Metadaten, aber keine Passwort-Spalte, weil nichts ein
-- Passwort prueft. v2 hat bis heute keine echte Anmeldung; der Branch, der sie
-- hatte (b44883d), liegt 58.000 Zeilen hinter main und kennt keine der
-- Migrationen ab 0062.
--
-- Sobald die echte Anmeldung steht (GoTrue), verwaltet DIE die Passwoerter.
-- Dann bekommen genau diese Adressen ihr Passwort — die Zeilen hier bleiben,
-- weil sie die fachliche Seite tragen (Profil, Mitgliedschaft, Rolle).
-- Das vereinbarte Passwort steht in /Apps/Accounts.md.
--
-- === EINSPIELEN ===
-- Automatisch bei `scripts/dev-stack.sh up` (nach seed.sql). Wiederholbar:
-- alles laeuft ueber `on conflict do nothing` bzw. `where not exists`.
begin;

-- Feste UUIDs: So bleiben die Konten ueber ein Neuaufsetzen der Datenbank
-- hinweg dieselben — Lesezeichen, Notizen und Skripte zeigen weiter richtig.
-- Bereich 000000a0-000000af ist fuer diese Konten reserviert.
create temporary table _konten (
  sub uuid primary key,
  email text not null,
  anzeigename text not null,
  vorname text not null,
  nachname text not null,
  rolle text,                      -- null = kein Vereinsmitglied (reiner Betreiber)
  plattform_admin boolean not null default false,
  elternteil boolean not null default false
) on commit drop;

insert into _konten (sub, email, anzeigename, vorname, nachname, rolle, plattform_admin, elternteil) values
  -- Marcel: Betreiber UND Vorstand des Demo-Vereins. Der reine Betreiber sieht
  -- naemlich nur die Betreiber-Konsole; fuer „ich will alles sehen" braucht er
  -- zusaetzlich eine Rolle IM Verein.
  ('90000000-0000-4000-8000-0000000000a0', 'marcelgoldfuss@icloud.com', 'Marcel Goldfuß', 'Marcel', 'Goldfuß', 'owner', true, false),
  -- Apple: bewusst KEIN Betreiber. Die Pruefung soll das Produkt sehen, nicht
  -- die Konsole, mit der wir fremde Vereine verwalten.
  ('90000000-0000-4000-8000-0000000000a1', 'apple-review@rollsportmanager.de', 'Apple Review', 'Apple', 'Review', 'owner', false, false),
  ('90000000-0000-4000-8000-0000000000a2', 'vorstand@rollsportmanager.de', 'Demo Vorstand', 'Demo', 'Vorstand', 'owner', false, false),
  ('90000000-0000-4000-8000-0000000000a3', 'verwaltung@rollsportmanager.de', 'Demo Verwaltung', 'Demo', 'Verwaltung', 'admin', false, false),
  ('90000000-0000-4000-8000-0000000000a4', 'kasse@rollsportmanager.de', 'Demo Kassenwart', 'Demo', 'Kassenwart', 'treasurer', false, false),
  ('90000000-0000-4000-8000-0000000000a5', 'moderation@rollsportmanager.de', 'Demo Moderation', 'Demo', 'Moderation', 'moderator', false, false),
  ('90000000-0000-4000-8000-0000000000a6', 'trainer@rollsportmanager.de', 'Demo Trainer', 'Demo', 'Trainer', 'coach', false, false),
  ('90000000-0000-4000-8000-0000000000a7', 'gasttrainer@rollsportmanager.de', 'Demo Gasttrainer', 'Demo', 'Gasttrainer', 'guest_coach', false, false),
  ('90000000-0000-4000-8000-0000000000a8', 'mitglied@rollsportmanager.de', 'Demo Mitglied', 'Demo', 'Mitglied', 'member', false, false),
  -- Elternteil: dieselbe Rolle wie ein Mitglied. Der Unterschied entsteht erst
  -- durch die Sorgeberechtigung weiter unten — daran haengt der Kinderschutz.
  ('90000000-0000-4000-8000-0000000000a9', 'eltern@rollsportmanager.de', 'Demo Elternteil', 'Demo', 'Elternteil', 'member', false, true);

-- 1. Anmelde-Identitaet (Attrappe im Dev-Stack, spaeter GoTrue)
insert into auth.users (id, email, raw_app_meta_data, raw_user_meta_data)
select k.sub,
       k.email,
       case when k.plattform_admin then '{"is_platform_admin": true}'::jsonb else '{}'::jsonb end,
       jsonb_build_object('display_name', k.anzeigename)
from _konten k
on conflict (id) do nothing;

-- 1b. Passwort setzen (auch für schon vorhandene Zeilen — deshalb ein UPDATE
--     statt es im INSERT zu führen, der bei Konflikt nichts tut).
--     Alle Demo-Konten teilen das eine Passwort aus /Apps/Accounts.md, als
--     scrypt-Hash (services/api/src/lib/password.ts). NUR Dev-Seed: echte
--     Registrierungen bekommen je einen eigenen Salt. KLARTEXT steht hier nicht.
update auth.users u
   set password_hash = 'scrypt$2d47c3f126be677f43db6fc3cb04f53f$e409ff304ac2c4475b0d0bc67a2734d0835117b7f7a477275a2a2ff1cd3998d6'
  from _konten k
 where u.id = k.sub;

-- 2. Profil (Bindeglied zwischen Anmeldung und Verein)
insert into app.profiles (id, display_name, locale)
select k.sub, k.anzeigename, 'de' from _konten k
on conflict (id) do nothing;

-- 3. Mitgliedschaft im Demo-Verein — nur fuer Konten MIT Rolle
-- valid_until: Ein Gast-Trainer MUSS befristet sein — die Datenbank erzwingt es
-- (check club_members_guest_coach_needs_expiry). Das ist kein Formalismus: Ein
-- Gastzugang, den niemand zurueckdreht, ist ein dauerhafter Zugang zu Kindern.
-- 90 Tage sind hier eine Demo-Frist; im Betrieb setzt sie der Verein.
insert into app.club_members (id, club_id, profile_id, first_name, last_name, email, role, status, joined_on, valid_until)
select k.sub,                                       -- gleiche UUID: leichter zu verfolgen
       'c1ab0000-0000-4000-8000-000000000001'::uuid,
       k.sub,
       k.vorname, k.nachname, k.email,
       k.rolle::app.club_member_role,
       'active'::app.member_status,
       current_date,
       case when k.rolle = 'guest_coach' then current_date + 90 end
from _konten k
where k.rolle is not null
on conflict (id) do nothing;

-- 4. Rolle in der Rechtematrix (app.member_roles) — die Rollen-IDs werden je
--    Datenbank neu erzeugt, deshalb ueber den Schluessel suchen und NICHT
--    hart eintragen.
-- club_id gehoert mit in die Zeile: Die Rechtematrix ist mandantengebunden,
-- eine Rolle ohne Verein waere eine Rolle in ALLEN Vereinen.
insert into app.member_roles (club_id, member_id, role_id)
select 'c1ab0000-0000-4000-8000-000000000001'::uuid, k.sub, r.id
from _konten k
join app.roles r on r.key = k.rolle
where k.rolle is not null
on conflict do nothing;

-- 5. Sorgeberechtigung fuer das Eltern-Konto: Emma Gruenewald (Jahrgang 2016).
--    Ohne diese Zeile waere „Demo Elternteil" ein Mitglied wie jedes andere —
--    und man koennte nicht pruefen, was Eltern ueber ihr Kind sehen duerfen
--    und was nicht.
insert into app.guardianships (club_id, guardian_member_id, child_member_id, relation)
select 'c1ab0000-0000-4000-8000-000000000001'::uuid,
       '90000000-0000-4000-8000-0000000000a9'::uuid,
       'a0000000-0000-4000-8000-000000000008'::uuid,
       'parent'
where exists (select 1 from app.club_members where id = 'a0000000-0000-4000-8000-000000000008')
  and not exists (
    select 1 from app.guardianships
    where guardian_member_id = '90000000-0000-4000-8000-0000000000a9'
      and child_member_id = 'a0000000-0000-4000-8000-000000000008'
  );

commit;
