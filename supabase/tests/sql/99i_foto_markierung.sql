-- ============================================================================
-- 99i_foto_markierung.sql — Foto-Markierung "diese Person ist auf dem Bild"
-- (Migration 0056) + Kueren-Bild (0057).
--
-- DIE ZENTRALE SICHERHEITSAUSSAGE:
--   "Ein Foto erscheint auf dem Profil einer Person NUR mit wirksamer
--    Einwilligung 'photos_internal' — auch fuer Staff nicht ohne. MARKIEREN
--    darf nur Staff (ohne Kasse); markieren ist aber ein Metadatum und gelingt
--    auch fuer ein Kind OHNE Einwilligung. ENTFERNEN darf die markierte Person,
--    ein Vormund oder Staff."
--
-- Aufbau:
--   (a) Markieren: nur Staff (ohne Kasse); Metadatum auch ohne Einwilligung
--   (b) Mandantenschnitt: Foto aus fremdem Verein nicht markierbar
--   (c) Doppelte aktive Markierung wird abgelehnt
--   (d) ANZEIGE: mit Einwilligung sichtbar, OHNE nicht — auch nicht fuer Staff
--   (e) POSITIVKONTROLLE: der Widerruf laesst das Foto verschwinden
--   (f) RLS-Basissicht: einfaches Mitglied sieht nur Eingewilligte; Vormund alles
--   (g) Entfernen: markierte Person / Vormund / Staff ja, Fremde nein
--   (h) Kueren-Bild-Feld (0057) kommt durch
--
-- POSITIVKONTROLLE (welcher Test ROT wird, wenn man den Fix herausnimmt):
--   * Test (d) "Kind OHNE Einwilligung erscheint NICHT" wird GRUEN nur wegen
--     des Consent-Filters app.has_internal_photo_consent. Ohne ihn erschiene
--     das Foto -> Test schluege fehl.
--   * Test (a) "Kasse darf NICHT markieren" wird GRUEN nur wegen der
--     Staff-Einschraenkung der INSERT-Policy.
--   * Test (g) "Fremdes Mitglied kann NICHT entfernen" wird GRUEN nur wegen der
--     UPDATE-Policy.
--   * Test (e) toggelt die Einwilligung und zeigt, dass die Anzeige daran haengt.
--
-- Benutzt AUSSCHLIESSLICH die Helfer aus 00_testkit.sql (ok/is_eq/throws/
-- succeeds/affects) — die Testkit-Datei bleibt unberuehrt.
-- ============================================================================

insert into auth.users (id, email) values
  ('9f000000-0000-4000-8000-000000000001', 'sonja.staff@example.org'),
  ('9f000000-0000-4000-8000-000000000002', 'anke.adult@example.org'),
  ('9f000000-0000-4000-8000-000000000003', 'gerda.guardian@example.org'),
  ('9f000000-0000-4000-8000-000000000005', 'mark.mitglied@example.org'),
  ('9f000000-0000-4000-8000-000000000006', 'timo.treasurer@example.org'),
  ('9f000000-0000-4000-8000-00000000000b', 'bernd.bowner@example.org');

begin;
set local role service_role;
select set_config('request.jwt.claims', '', true);

insert into app.clubs (id, name, city, join_code) values
  ('c1fa0000-0000-4000-8000-000000000001', 'RSC Fotoverein',   'Bildstadt',  'TEST-F001'),
  ('c1fa0000-0000-4000-8000-000000000002', 'RSC Fremdverein2', 'Fremdstadt', 'TEST-F002');

-- Seit 0068 ist 'gallery' ein ZUBUCHBARES Modul: ein Verein, der nach den
-- Migrationen entsteht (wie diese beiden Fixture-Vereine), hat es voreingestellt
-- AUS. Diese Datei misst die FOTO-MARKIERUNG, nicht das Modul-Gate — also bucht
-- das Fixture die Galerie ausdruecklich, damit es hier ueberhaupt Fotos gibt.
-- Der Beweis, dass das Gate ohne diese Zeile wirklich zubeisst, steht in
-- 99oA_zubuchbare_module.sql; hier waere er nur ein Seiteneffekt.
insert into app.club_modules (club_id, module_key, enabled) values
  ('c1fa0000-0000-4000-8000-000000000001', 'gallery', true),
  ('c1fa0000-0000-4000-8000-000000000002', 'gallery', true);

insert into app.profiles (id, display_name) values
  ('9f000000-0000-4000-8000-000000000001', 'Sonja Staff'),
  ('9f000000-0000-4000-8000-000000000002', 'Anke Adult'),
  ('9f000000-0000-4000-8000-000000000003', 'Gerda Guardian'),
  ('9f000000-0000-4000-8000-000000000005', 'Mark Mitglied'),
  ('9f000000-0000-4000-8000-000000000006', 'Timo Treasurer'),
  ('9f000000-0000-4000-8000-00000000000b', 'Bernd Bowner');

insert into app.club_members (id, club_id, profile_id, first_name, last_name, birth_date, role, status) values
  -- Verein F
  ('a0fa0000-0000-4000-8000-000000000001', 'c1fa0000-0000-4000-8000-000000000001',
   '9f000000-0000-4000-8000-000000000001', 'Sonja', 'Staff',    null, 'coach',     'active'),
  ('a0fa0000-0000-4000-8000-000000000002', 'c1fa0000-0000-4000-8000-000000000001',
   '9f000000-0000-4000-8000-000000000002', 'Anke',  'Adult',    null, 'member',    'active'),
  ('a0fa0000-0000-4000-8000-000000000003', 'c1fa0000-0000-4000-8000-000000000001',
   '9f000000-0000-4000-8000-000000000003', 'Gerda', 'Guardian', null, 'member',    'active'),
  -- Kai (12) und Nora (10): Kinder OHNE eigenes Konto, Muendel von Gerda.
  ('a0fa0000-0000-4000-8000-000000000004', 'c1fa0000-0000-4000-8000-000000000001',
   null, 'Kai',  'Kind', current_date - interval '12 years', 'member', 'active'),
  ('a0fa0000-0000-4000-8000-000000000005', 'c1fa0000-0000-4000-8000-000000000001',
   null, 'Nora', 'Nicht', current_date - interval '10 years', 'member', 'active'),
  -- Mark: einfaches Mitglied (Betrachter). Timo: Kasse.
  ('a0fa0000-0000-4000-8000-000000000006', 'c1fa0000-0000-4000-8000-000000000001',
   '9f000000-0000-4000-8000-000000000005', 'Mark', 'Mitglied',  null, 'member',    'active'),
  ('a0fa0000-0000-4000-8000-000000000007', 'c1fa0000-0000-4000-8000-000000000001',
   '9f000000-0000-4000-8000-000000000006', 'Timo', 'Treasurer', null, 'treasurer', 'active'),
  -- Verein F2 (fremd)
  ('a0fb0000-0000-4000-8000-000000000001', 'c1fa0000-0000-4000-8000-000000000002',
   '9f000000-0000-4000-8000-00000000000b', 'Bernd', 'Bowner', null, 'owner', 'active');

-- Gerda ist Vormund von Kai UND Nora.
insert into app.guardianships (club_id, guardian_member_id, child_member_id) values
  ('c1fa0000-0000-4000-8000-000000000001', 'a0fa0000-0000-4000-8000-000000000003', 'a0fa0000-0000-4000-8000-000000000004'),
  ('c1fa0000-0000-4000-8000-000000000001', 'a0fa0000-0000-4000-8000-000000000003', 'a0fa0000-0000-4000-8000-000000000005');

-- Verein F ist PRO, damit die Profil-Projektion (Join auf gallery_items unter
-- RLS) ueberhaupt Bilder sieht — isoliert die Consent-Frage von der PRO-Frage.
insert into app.entitlements (subject_type, subject_id, entitlement, source, valid_until, metadata) values
  ('club', 'c1fa0000-0000-4000-8000-000000000001', 'club_license', 'manual',
   now() + interval '180 days', jsonb_build_object('tier', 'pro', 'status', 'active'));

-- Galerie-Bilder (F: 3, F2: 1).
insert into app.gallery_items
  (id, club_id, album, title, kind, storage_key, content_type, size_bytes, uploaded_by_member_id) values
  ('6afa0000-0000-4000-8000-000000000001', 'c1fa0000-0000-4000-8000-000000000001', 'Fest', 'Foto Anke', 'photo',
   'test-foto-anke.png',  'image/png', 100, 'a0fa0000-0000-4000-8000-000000000001'),
  ('6afa0000-0000-4000-8000-000000000002', 'c1fa0000-0000-4000-8000-000000000001', 'Fest', 'Foto Kai',  'photo',
   'test-foto-kai.png',   'image/png', 100, 'a0fa0000-0000-4000-8000-000000000001'),
  ('6afa0000-0000-4000-8000-000000000003', 'c1fa0000-0000-4000-8000-000000000001', 'Fest', 'Foto Nora', 'photo',
   'test-foto-nora.png',  'image/png', 100, 'a0fa0000-0000-4000-8000-000000000001'),
  ('6afa0000-0000-4000-8000-0000000000b1', 'c1fa0000-0000-4000-8000-000000000002', 'Fremd', 'Foto B', 'photo',
   'test-foto-fremd.png', 'image/png', 100, 'a0fb0000-0000-4000-8000-000000000001');

-- Einwilligungen: Anke (selbst) + Kai (durch Vormund Gerda). Nora: KEINE.
insert into app.consents
  (club_id, member_id, subject_profile_id, purpose, granted, granted_by_profile_id, policy_version) values
  ('c1fa0000-0000-4000-8000-000000000001', 'a0fa0000-0000-4000-8000-000000000002',
   '9f000000-0000-4000-8000-000000000002', 'photos_internal', true,
   '9f000000-0000-4000-8000-000000000002', 'v1'),
  ('c1fa0000-0000-4000-8000-000000000001', 'a0fa0000-0000-4000-8000-000000000004',
   null, 'photos_internal', true, '9f000000-0000-4000-8000-000000000003', 'v1');

commit;

-- ===========================================================================
-- (a) MARKIEREN — nur Staff (ohne Kasse); Metadatum auch ohne Einwilligung
-- ===========================================================================
begin;
select set_config('request.jwt.claims',
  '{"sub":"9f000000-0000-4000-8000-000000000001","role":"authenticated","club_roles":{"c1fa0000-0000-4000-8000-000000000001":"coach"}}',
  true);
set local role authenticated;

select testkit.succeeds(
  'Markieren: Staff (coach) darf Anke markieren',
  $sql$insert into app.photo_tags (club_id, gallery_item_id, member_id, tagged_by_member_id)
       values ('c1fa0000-0000-4000-8000-000000000001', '6afa0000-0000-4000-8000-000000000001',
               'a0fa0000-0000-4000-8000-000000000002', 'a0fa0000-0000-4000-8000-000000000001')$sql$);

select testkit.succeeds(
  'Markieren: ein Kind (Kai) MIT Einwilligung markieren gelingt',
  $sql$insert into app.photo_tags (club_id, gallery_item_id, member_id, tagged_by_member_id)
       values ('c1fa0000-0000-4000-8000-000000000001', '6afa0000-0000-4000-8000-000000000002',
               'a0fa0000-0000-4000-8000-000000000004', 'a0fa0000-0000-4000-8000-000000000001')$sql$);

-- DER KERN: markieren ist ein Metadatum. Nora hat KEINE Einwilligung, wird
-- aber trotzdem markiert (die Anzeige, nicht die Markierung, haengt an der
-- Einwilligung).
select testkit.succeeds(
  'Markieren: ein Kind (Nora) OHNE Einwilligung markieren gelingt trotzdem (Metadatum)',
  $sql$insert into app.photo_tags (club_id, gallery_item_id, member_id, tagged_by_member_id)
       values ('c1fa0000-0000-4000-8000-000000000001', '6afa0000-0000-4000-8000-000000000003',
               'a0fa0000-0000-4000-8000-000000000005', 'a0fa0000-0000-4000-8000-000000000001')$sql$);
commit;   -- diese drei Markierungen bleiben fuer die Anzeige-Tests bestehen

-- Kasse darf NICHT markieren (Positivkontrolle der Staff-Einschraenkung).
begin;
select set_config('request.jwt.claims',
  '{"sub":"9f000000-0000-4000-8000-000000000006","role":"authenticated","club_roles":{"c1fa0000-0000-4000-8000-000000000001":"treasurer"}}',
  true);
set local role authenticated;
select testkit.throws(
  'Markieren: die Kasse (treasurer) darf NICHT markieren',
  $sql$insert into app.photo_tags (club_id, gallery_item_id, member_id, tagged_by_member_id)
       values ('c1fa0000-0000-4000-8000-000000000001', '6afa0000-0000-4000-8000-000000000001',
               'a0fa0000-0000-4000-8000-000000000006', 'a0fa0000-0000-4000-8000-000000000007')$sql$,
  '42501');
rollback;

-- Einfaches Mitglied darf NICHT markieren.
begin;
select set_config('request.jwt.claims',
  '{"sub":"9f000000-0000-4000-8000-000000000005","role":"authenticated","club_roles":{"c1fa0000-0000-4000-8000-000000000001":"member"}}',
  true);
set local role authenticated;
select testkit.throws(
  'Markieren: ein einfaches Mitglied darf NICHT markieren',
  $sql$insert into app.photo_tags (club_id, gallery_item_id, member_id, tagged_by_member_id)
       values ('c1fa0000-0000-4000-8000-000000000001', '6afa0000-0000-4000-8000-000000000001',
               'a0fa0000-0000-4000-8000-000000000006', 'a0fa0000-0000-4000-8000-000000000006')$sql$,
  '42501');
rollback;

-- ===========================================================================
-- (b) MANDANTENSCHNITT — ein Foto aus dem fremden Verein ist nicht markierbar
-- ===========================================================================
begin;
select set_config('request.jwt.claims',
  '{"sub":"9f000000-0000-4000-8000-000000000001","role":"authenticated","club_roles":{"c1fa0000-0000-4000-8000-000000000001":"coach"}}',
  true);
set local role authenticated;
select testkit.throws(
  'Mandant: ein Foto aus dem fremden Verein kann nicht markiert werden (zusammengesetzter FK)',
  $sql$insert into app.photo_tags (club_id, gallery_item_id, member_id, tagged_by_member_id)
       values ('c1fa0000-0000-4000-8000-000000000001', '6afa0000-0000-4000-8000-0000000000b1',
               'a0fa0000-0000-4000-8000-000000000002', 'a0fa0000-0000-4000-8000-000000000001')$sql$,
  '23503');
rollback;

-- ===========================================================================
-- (c) DOPPELTE aktive Markierung wird abgelehnt
-- ===========================================================================
begin;
select set_config('request.jwt.claims',
  '{"sub":"9f000000-0000-4000-8000-000000000001","role":"authenticated","club_roles":{"c1fa0000-0000-4000-8000-000000000001":"coach"}}',
  true);
set local role authenticated;
select testkit.throws(
  'Doppelt: dieselbe Person zweimal auf demselben Foto wird abgelehnt',
  $sql$insert into app.photo_tags (club_id, gallery_item_id, member_id, tagged_by_member_id)
       values ('c1fa0000-0000-4000-8000-000000000001', '6afa0000-0000-4000-8000-000000000001',
               'a0fa0000-0000-4000-8000-000000000002', 'a0fa0000-0000-4000-8000-000000000001')$sql$,
  '23505');
rollback;

-- ===========================================================================
-- (d) ANZEIGE — die Profil-Projektion (services/api selectMemberPhotos): mit
--     Einwilligung sichtbar, OHNE nicht — auch nicht fuer Staff (owner/coach).
-- ===========================================================================
begin;
select set_config('request.jwt.claims',
  '{"sub":"9f000000-0000-4000-8000-000000000001","role":"authenticated","club_roles":{"c1fa0000-0000-4000-8000-000000000001":"coach"}}',
  true);
set local role authenticated;

select testkit.is_eq(
  'Anzeige: Anke MIT Einwilligung erscheint (1 Foto)',
  (select count(*) from app.photo_tags pt
     join app.gallery_items g on g.id = pt.gallery_item_id and g.deleted_at is null
    where pt.club_id = 'c1fa0000-0000-4000-8000-000000000001'
      and pt.member_id = 'a0fa0000-0000-4000-8000-000000000002'
      and pt.deleted_at is null
      and app.has_internal_photo_consent(pt.member_id)), 1);

select testkit.is_eq(
  'Anzeige: Kai MIT (Eltern-)Einwilligung erscheint (1 Foto)',
  (select count(*) from app.photo_tags pt
     join app.gallery_items g on g.id = pt.gallery_item_id and g.deleted_at is null
    where pt.club_id = 'c1fa0000-0000-4000-8000-000000000001'
      and pt.member_id = 'a0fa0000-0000-4000-8000-000000000004'
      and pt.deleted_at is null
      and app.has_internal_photo_consent(pt.member_id)), 1);

-- DER KERN: Nora ist markiert, aber OHNE Einwilligung -> erscheint NICHT,
-- obwohl der Aufrufer Staff ist. Die Anzeige haengt an der Einwilligung, nicht
-- an der Rolle. (Ohne den Consent-Filter waere das Ergebnis 1 -> Test ROT.)
select testkit.is_eq(
  'Anzeige: Nora OHNE Einwilligung erscheint NICHT — auch nicht fuer Staff',
  (select count(*) from app.photo_tags pt
     join app.gallery_items g on g.id = pt.gallery_item_id and g.deleted_at is null
    where pt.club_id = 'c1fa0000-0000-4000-8000-000000000001'
      and pt.member_id = 'a0fa0000-0000-4000-8000-000000000005'
      and pt.deleted_at is null
      and app.has_internal_photo_consent(pt.member_id)), 0);
rollback;

-- Dasselbe fuer ein einfaches Mitglied als Betrachter: sieht Anke, nicht Nora.
begin;
select set_config('request.jwt.claims',
  '{"sub":"9f000000-0000-4000-8000-000000000005","role":"authenticated","club_roles":{"c1fa0000-0000-4000-8000-000000000001":"member"}}',
  true);
set local role authenticated;
select testkit.is_eq(
  'Anzeige (Mitglied): Anke MIT Einwilligung erscheint',
  (select count(*) from app.photo_tags pt
     join app.gallery_items g on g.id = pt.gallery_item_id and g.deleted_at is null
    where pt.member_id = 'a0fa0000-0000-4000-8000-000000000002'
      and pt.deleted_at is null
      and app.has_internal_photo_consent(pt.member_id)), 1);
select testkit.is_eq(
  'Anzeige (Mitglied): Nora OHNE Einwilligung erscheint NICHT',
  (select count(*) from app.photo_tags pt
     join app.gallery_items g on g.id = pt.gallery_item_id and g.deleted_at is null
    where pt.member_id = 'a0fa0000-0000-4000-8000-000000000005'
      and pt.deleted_at is null
      and app.has_internal_photo_consent(pt.member_id)), 0);
rollback;

-- ===========================================================================
-- (e) POSITIVKONTROLLE — der WIDERRUF laesst das Foto verschwinden.
--     Beweist, dass die Anzeige an der EINWILLIGUNG haengt (nicht an der Rolle
--     oder der Markierung): dieselbe Person, dieselbe Rolle, nur die
--     Einwilligung kippt.
-- ===========================================================================
begin;
set local role service_role;
select set_config('request.jwt.claims', '', true);
-- Anke widerruft ihre Einwilligung (neue Zeile granted=false; Widerruf ist nie
-- alterspflichtig, Art. 7 Abs. 3 S. 4).
insert into app.consents
  (club_id, member_id, subject_profile_id, purpose, granted, granted_by_profile_id, policy_version)
values ('c1fa0000-0000-4000-8000-000000000001', 'a0fa0000-0000-4000-8000-000000000002',
        '9f000000-0000-4000-8000-000000000002', 'photos_internal', false,
        '9f000000-0000-4000-8000-000000000002', 'v1-widerruf');

select set_config('request.jwt.claims',
  '{"sub":"9f000000-0000-4000-8000-000000000001","role":"authenticated","club_roles":{"c1fa0000-0000-4000-8000-000000000001":"coach"}}',
  true);
set local role authenticated;
select testkit.is_eq(
  'Positivkontrolle: nach WIDERRUF verschwindet Ankes Foto — auch fuer Staff',
  (select count(*) from app.photo_tags pt
     join app.gallery_items g on g.id = pt.gallery_item_id and g.deleted_at is null
    where pt.member_id = 'a0fa0000-0000-4000-8000-000000000002'
      and pt.deleted_at is null
      and app.has_internal_photo_consent(pt.member_id)), 0);
rollback;   -- Widerruf zuruecknehmen: Anke bleibt fuer die restlichen Tests eingewilligt

-- ===========================================================================
-- (f) RLS-BASISSICHT — einfaches Mitglied sieht nur Eingewilligte; der Vormund
--     sieht die Markierung seines Kindes AUCH ohne Einwilligung (Verwaltung).
-- ===========================================================================
begin;
select set_config('request.jwt.claims',
  '{"sub":"9f000000-0000-4000-8000-000000000005","role":"authenticated","club_roles":{"c1fa0000-0000-4000-8000-000000000001":"member"}}',
  true);
set local role authenticated;
select testkit.is_eq(
  'RLS: Mitglied sieht die eingewilligte Markierung (Anke)',
  (select count(*) from app.photo_tags where member_id = 'a0fa0000-0000-4000-8000-000000000002' and deleted_at is null), 1);
select testkit.is_eq(
  'RLS: Mitglied sieht die NICHT eingewilligte Markierung (Nora) NICHT',
  (select count(*) from app.photo_tags where member_id = 'a0fa0000-0000-4000-8000-000000000005' and deleted_at is null), 0);
rollback;

begin;
select set_config('request.jwt.claims',
  '{"sub":"9f000000-0000-4000-8000-000000000003","role":"authenticated","club_roles":{"c1fa0000-0000-4000-8000-000000000001":"member"}}',
  true);
set local role authenticated;
select testkit.is_eq(
  'RLS: der Vormund sieht die Markierung seines Kindes (Nora) — auch OHNE Einwilligung (Verwaltung/Entfernen)',
  (select count(*) from app.photo_tags where member_id = 'a0fa0000-0000-4000-8000-000000000005' and deleted_at is null), 1);
rollback;

-- ===========================================================================
-- (g) ENTFERNEN — die markierte Person / der Vormund / Staff duerfen; Fremde
--     nicht.
-- ===========================================================================
-- Fremdes Mitglied kann NICHT entfernen (Positivkontrolle der UPDATE-Policy):
-- affects 0 = still gefiltert, kein Fehler.
begin;
select set_config('request.jwt.claims',
  '{"sub":"9f000000-0000-4000-8000-000000000005","role":"authenticated","club_roles":{"c1fa0000-0000-4000-8000-000000000001":"member"}}',
  true);
set local role authenticated;
select testkit.affects(
  'Entfernen: ein fremdes Mitglied kann Ankes Markierung NICHT entfernen',
  $sql$update app.photo_tags set deleted_at = now()
        where member_id = 'a0fa0000-0000-4000-8000-000000000002' and deleted_at is null$sql$, 0);
rollback;

-- Der Vormund entfernt die Markierung seines Kindes (Nora):
begin;
select set_config('request.jwt.claims',
  '{"sub":"9f000000-0000-4000-8000-000000000003","role":"authenticated","club_roles":{"c1fa0000-0000-4000-8000-000000000001":"member"}}',
  true);
set local role authenticated;
select testkit.affects(
  'Entfernen: der Vormund entfernt die Markierung des Kindes (Nora)',
  $sql$update app.photo_tags set deleted_at = now()
        where member_id = 'a0fa0000-0000-4000-8000-000000000005' and deleted_at is null$sql$, 1);
rollback;

-- Die markierte Person selbst (Anke) entfernt ihre Markierung:
begin;
select set_config('request.jwt.claims',
  '{"sub":"9f000000-0000-4000-8000-000000000002","role":"authenticated","club_roles":{"c1fa0000-0000-4000-8000-000000000001":"member"}}',
  true);
set local role authenticated;
select testkit.affects(
  'Entfernen: die markierte Person entfernt ihre eigene Markierung (Anke)',
  $sql$update app.photo_tags set deleted_at = now()
        where member_id = 'a0fa0000-0000-4000-8000-000000000002' and deleted_at is null$sql$, 1);
rollback;

-- Staff (coach) entfernt eine Markierung:
begin;
select set_config('request.jwt.claims',
  '{"sub":"9f000000-0000-4000-8000-000000000001","role":"authenticated","club_roles":{"c1fa0000-0000-4000-8000-000000000001":"coach"}}',
  true);
set local role authenticated;
select testkit.affects(
  'Entfernen: Staff (coach) entfernt eine Markierung (Kai)',
  $sql$update app.photo_tags set deleted_at = now()
        where member_id = 'a0fa0000-0000-4000-8000-000000000004' and deleted_at is null$sql$, 1);
rollback;

-- ===========================================================================
-- (h) KUEREN-BILD (0057) — das Feld image_asset_id existiert und traegt eine
--     Referenz; die Kuer-Sichtbarkeit (can_read_routine) ist unveraendert.
-- ===========================================================================
begin;
set local role service_role;
select set_config('request.jwt.claims', '', true);
insert into app.media_assets (id, club_id, bucket, storage_path, mime_type, size_bytes) values
  ('abfa0000-0000-4000-8000-000000000001', 'c1fa0000-0000-4000-8000-000000000001',
   'routine-image', 'test/kuer-cover.png', 'image/png', 123);
insert into app.routines (id, club_id, title, status, image_asset_id) values
  ('d0fa0000-0000-4000-8000-000000000001', 'c1fa0000-0000-4000-8000-000000000001',
   'Testkuer mit Bild', 'ready', 'abfa0000-0000-4000-8000-000000000001');
select testkit.is_eq(
  'Kueren-Bild: image_asset_id (0057) traegt die Referenz durch',
  (select count(*) from app.routines
     where id = 'd0fa0000-0000-4000-8000-000000000001'
       and image_asset_id = 'abfa0000-0000-4000-8000-000000000001'), 1);
rollback;
