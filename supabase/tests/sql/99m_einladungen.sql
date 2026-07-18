-- ============================================================================
-- 99m_einladungen.sql — Einladung per E-Mail (Migration 0065).
--
-- Prueft die drei Zusagen der Migration:
--   (a) RLS: nur can_manage_members (has_cap members:manage) sieht/legt
--       Einladungen an — ein einfaches Mitglied nicht, ein FREMDER Verein nicht.
--   (b) app.accept_invitation wirkt NUR bei gueltigem, nicht abgelaufenem, nicht
--       verbrauchtem Token — und verbraucht ihn (Einmal-Charakter). Aufgerufen
--       im SERVICE-MODE (auth.uid() null), genau wie die Route.
--   (c) Der Klartext-Token steht NIE in der DB (nur token_hash).
--
-- Nutzt AUSSCHLIESSLICH die vorhandenen Helfer aus 00_testkit.sql. Der Seed-
-- Verein ist RSV Neckarsulm (c1ab…0001), owner = Juergen (profile …002),
-- einfaches Mitglied = Katrin (profile …009).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Vorbereitung (service_role): zweiter Verein + ein fremdes Profil, das
-- annehmen darf (noch kein Mitglied). Zwei Einladungen: eine gueltige, eine
-- abgelaufene. Der Klartext-Token ist bekannt, gespeichert wird sein sha256.
-- ---------------------------------------------------------------------------
-- Als verbindende (Superuser-)Rolle, NICHT service_role: nur der Superuser darf
-- in auth.users schreiben (so macht es auch der Seed). auth.uid() ist ohne
-- Claims null -> die Schutz-Trigger halten sich zurueck.
begin;
select set_config('request.jwt.claims', '', true);

-- Zwei frische Konten: der Einzuladende (…e1, noch kein Mitglied von …0001) und
-- der owner des zweiten Vereins (…e2). auth.users (id, email) wie im Seed —
-- app.profiles.id hat einen FK auf auth.users.
insert into auth.users (id, email) values
  ('90ee0000-0000-4000-8000-000000000001', 'egon.eingeladen@example.org'),
  ('90ee0000-0000-4000-8000-000000000002', 'frida.fremd@example.org')
on conflict (id) do nothing;
insert into app.profiles (id, display_name) values
  ('90ee0000-0000-4000-8000-000000000001', 'Egon Eingeladen'),
  ('90ee0000-0000-4000-8000-000000000002', 'Frida Fremd');

-- Zweiter Verein fuer die Mandantentrennung.
insert into app.clubs (id, name, city, join_code)
values ('c1ee0000-0000-4000-8000-000000000001', 'RSC Fremdheim', 'Fremdheim', 'TEST-E005');
insert into app.club_members (id, club_id, profile_id, first_name, last_name, role, status)
values ('a0ee0000-0000-4000-8000-000000000001', 'c1ee0000-0000-4000-8000-000000000001',
        '90ee0000-0000-4000-8000-000000000002', 'Frida', 'Fremd', 'owner', 'active');

-- Gueltige Einladung in den SEED-Verein. token = 'klartext-gueltig' ->
-- sha256(base64url). Wir speichern den Hash, der Test kennt den Klartext.
insert into app.invitations (id, club_id, email, target_role, token_hash, expires_at)
values ('19ee0000-0000-4000-8000-000000000001', 'c1ab0000-0000-4000-8000-000000000001',
        'egon.eingeladen@example.org', 'member',
        encode(sha256('klartext-gueltig'::bytea), 'base64'),
        now() + interval '14 days');

-- Abgelaufene Einladung (gleicher Verein, andere Adresse).
insert into app.invitations (id, club_id, email, target_role, token_hash, status, expires_at)
values ('19ee0000-0000-4000-8000-000000000002', 'c1ab0000-0000-4000-8000-000000000001',
        'abgelaufen@example.org', 'member',
        encode(sha256('klartext-abgelaufen'::bytea), 'base64'),
        'pending', now() - interval '1 day');
commit;

-- ===========================================================================
-- (a) RLS — nur can_manage_members sieht/schreibt
-- ===========================================================================

-- OWNER des Seed-Vereins: sieht die Einladung, darf eine anlegen.
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000002","role":"authenticated","club_roles":{}}', true);
set local role authenticated;

select testkit.is_eq('RLS: der owner sieht die Einladung seines Vereins',
  (select count(*) from app.invitations where id = '19ee0000-0000-4000-8000-000000000001'), 1);

select testkit.succeeds('RLS: der owner darf eine Einladung anlegen',
  $sql$insert into app.invitations (club_id, email, target_role, token_hash, expires_at)
       values ('c1ab0000-0000-4000-8000-000000000001', 'owner.legt.an@example.org', 'member',
               encode(sha256('t-owner'::bytea), 'base64'), now() + interval '7 days')$sql$);
rollback;

-- EINFACHES MITGLIED (Katrin, …009): sieht KEINE Einladung, darf keine anlegen.
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000009","role":"authenticated","club_roles":{}}', true);
set local role authenticated;

select testkit.is_eq('RLS: das einfache Mitglied sieht KEINE Einladung (has_cap members:manage fehlt)',
  (select count(*) from app.invitations where club_id = 'c1ab0000-0000-4000-8000-000000000001'), 0);

select testkit.throws('RLS: das einfache Mitglied darf KEINE Einladung anlegen (42501)',
  $sql$insert into app.invitations (club_id, email, target_role, token_hash, expires_at)
       values ('c1ab0000-0000-4000-8000-000000000001', 'boese@example.org', 'admin',
               encode(sha256('t-boese'::bytea), 'base64'), now() + interval '7 days')$sql$,
  '42501');
rollback;

-- FREMDER VEREIN (Frida, owner von …e5): sieht die Einladung von …0001 NICHT.
begin;
select set_config('request.jwt.claims',
  '{"sub":"90ee0000-0000-4000-8000-000000000002","role":"authenticated","club_roles":{}}', true);
set local role authenticated;

select testkit.is_eq('RLS: der owner eines FREMDEN Vereins sieht die Einladung nicht (Mandantentrennung)',
  (select count(*) from app.invitations where id = '19ee0000-0000-4000-8000-000000000001'), 0);
rollback;

-- ===========================================================================
-- (b) app.accept_invitation — nur gueltiger Token wirkt, Einmal-Charakter
-- ===========================================================================
-- Aufruf im SERVICE-MODE (auth.uid() null), wie die Route: sonst blockte
-- protect_member_roles die Selbst-Rollenvergabe der annehmenden Person.

-- Falscher Token -> 0 Zeilen, keine Mitgliedschaft.
begin;
set local role service_role;
select set_config('request.jwt.claims', '', true);
select testkit.is_eq('accept: UNBEKANNTER Token -> 0 Zeilen',
  (select count(*) from app.accept_invitation(
     encode(sha256('gibt-es-nicht'::bytea), 'base64'),
     '90ee0000-0000-4000-8000-000000000001', 'Egon', 'Eingeladen')), 0);
rollback;

-- Abgelaufener Token -> 0 Zeilen.
begin;
set local role service_role;
select set_config('request.jwt.claims', '', true);
select testkit.is_eq('accept: ABGELAUFENER Token -> 0 Zeilen',
  (select count(*) from app.accept_invitation(
     encode(sha256('klartext-abgelaufen'::bytea), 'base64'),
     '90ee0000-0000-4000-8000-000000000001', 'Egon', 'Eingeladen')), 0);
rollback;

-- Gueltiger Token -> genau 1 Zeile, aktive Mitgliedschaft, Token verbraucht.
-- KEIN rollback: die naechsten Faelle bauen auf dem verbrauchten Token auf.
begin;
set local role service_role;
select set_config('request.jwt.claims', '', true);

select testkit.is_eq('accept: gueltiger Token -> genau 1 Ergebniszeile',
  (select count(*) from app.accept_invitation(
     encode(sha256('klartext-gueltig'::bytea), 'base64'),
     '90ee0000-0000-4000-8000-000000000001', 'Egon', 'Eingeladen')), 1);

select testkit.is_eq('accept: die Mitgliedschaft ist AKTIV entstanden',
  (select count(*) from app.club_members
    where club_id = 'c1ab0000-0000-4000-8000-000000000001'
      and profile_id = '90ee0000-0000-4000-8000-000000000001'
      and role = 'member' and status = 'active' and deleted_at is null), 1);

select testkit.is_eq('accept: die Einladung ist verbraucht (status=accepted)',
  (select count(*) from app.invitations
    where id = '19ee0000-0000-4000-8000-000000000001' and status = 'accepted'
      and accepted_by_profile_id = '90ee0000-0000-4000-8000-000000000001'
      and accepted_member_id is not null), 1);
commit;

-- Zweiter Versuch mit DEMSELBEN (jetzt verbrauchten) Token -> 0 Zeilen.
begin;
set local role service_role;
select set_config('request.jwt.claims', '', true);
select testkit.is_eq('accept: verbrauchter Token beim ZWEITEN Mal -> 0 Zeilen (Einmal-Charakter)',
  (select count(*) from app.accept_invitation(
     encode(sha256('klartext-gueltig'::bytea), 'base64'),
     '90ee0000-0000-4000-8000-000000000001', 'Egon', 'Eingeladen')), 0);
rollback;

-- ===========================================================================
-- (c) Der Klartext-Token steht NIE in der DB
-- ===========================================================================
begin;
set local role service_role;
select set_config('request.jwt.claims', '', true);
select testkit.is_eq(
  'Kein Klartext: keine Einladungszeile traegt den Klartext-Token als token_hash',
  (select count(*) from app.invitations
    where token_hash in ('klartext-gueltig', 'klartext-abgelaufen')), 0);
select testkit.is_eq(
  'Nachweis der Hash-Form: der gespeicherte Hash ist sha256(Klartext) der angenommenen Einladung',
  (select count(*) from app.invitations
    where id = '19ee0000-0000-4000-8000-000000000001'
      and token_hash = encode(sha256('klartext-gueltig'::bytea), 'base64')), 1);
rollback;

-- KEIN Aufraeumen: die Suite laeuft gegen eine Wegwerf-DB (run-tests.sh baut den
-- Container jedes Mal frisch), und die verwendeten IDs (ee-Namensraum) sind
-- vereinseigen — kein spaeteres Suite-Skript benutzt sie. Ein DELETE des
-- Vereins wuerde ausserdem an den mitgeseedeten Rollen (roles_club_id_fkey)
-- haengen; das nachzubauen brächte keinen Gewinn.
