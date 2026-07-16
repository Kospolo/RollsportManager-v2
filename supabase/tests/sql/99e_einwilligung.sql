-- ============================================================================
-- 99e_einwilligung.sql — Die Einwilligung erzwingt etwas (Migration 0039).
--
-- DIE ZENTRALE BEHAUPTUNG VON 0039 IST EINE SICHERHEITSAUSSAGE:
--   "Ein Kind kann sich nicht selbst einwilligen, und eine Einwilligung kann
--    nicht in einem fremden Verein landen."
--
-- Beide Loecher waren VOR 0039 offen und wurden im Harness belegt:
--   ANGRIFF-1 (Kind willigt selbst ein): GELUNGEN — Zeile liegt vor
--   ANGRIFF-2 (fremder club_id):         GELUNGEN — Zeile im FREMDEN Verein
--   LECK (Admin Verein B sieht Klaras Einwilligung): JA — 1 Zeile(n)
--
-- Aufbau:
--   (a) Art. 8 — das Kind kann sich NICHT selbst einwilligen
--   (b) Art. 8 — die erziehungsberechtigte Person kann es, und nur sie
--   (c) Unbekanntes Geburtsdatum — die Guardianship entscheidet
--   (c2) Der Widerruf ist NIE altersgeprueft (Art. 7 Abs. 3 S. 4)
--   (d) Der 16. Geburtstag beendet die Eltern-Erklaerungsmacht
--   (e) G4 — club_id muss zum Mitglied passen (und das LECK ist zu)
--   (f) Kopplungsverbot — terms/privacy sind keine Einwilligung
--   (g) app.policy_acknowledgements — Kenntnisnahme, mit Fassungszeiger
--   (h) Widerruf (Art. 7 Abs. 3) bleibt moeglich und vernichtet den Nachweis nicht
--
-- Benutzt AUSSCHLIESSLICH die vorhandenen Helfer aus 00_testkit.sql
-- (ok/fail/is_eq/throws/succeeds/affects) — die Testkit-Datei bleibt unberuehrt.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Vorbereitung: ein Verein A mit Kind (10), Elternteil, Erwachsener ohne
-- Geburtsdatum und Jugendlicher (16); ein FREMDER Verein B mit eigenem Inhaber.
-- ---------------------------------------------------------------------------
insert into auth.users (id, email) values
  ('90000000-0000-4000-8000-0000000000c1', 'klara.kind@example.org'),
  ('90000000-0000-4000-8000-0000000000e1', 'erika.eltern@example.org'),
  ('90000000-0000-4000-8000-0000000000d1', 'udo.unbekannt@example.org'),
  ('90000000-0000-4000-8000-0000000000b1', 'jonas.jugend@example.org'),
  ('90000000-0000-4000-8000-0000000000f1', 'fred.fremd@example.org');

begin;
set local role service_role;
select set_config('request.jwt.claims', '', true);

insert into app.clubs (id, name, city, join_code) values
  ('c1ab0000-0000-4000-8000-0000000000e1', 'RSC Einwilligung', 'Testheim', 'TEST-E001'),
  ('c1ab0000-0000-4000-8000-0000000000e2', 'RSC Fremdverein',  'Fremdstadt', 'TEST-E002');

insert into app.profiles (id, display_name) values
  ('90000000-0000-4000-8000-0000000000c1', 'Klara Kind'),
  ('90000000-0000-4000-8000-0000000000e1', 'Erika Eltern'),
  ('90000000-0000-4000-8000-0000000000d1', 'Udo Unbekannt'),
  ('90000000-0000-4000-8000-0000000000b1', 'Jonas Jugend'),
  ('90000000-0000-4000-8000-0000000000f1', 'Fred Fremd');

-- Klara, 10 Jahre, MIT eigenem Konto — das ist der ganze Punkt von G2.
insert into app.club_members (id, club_id, profile_id, first_name, last_name, birth_date, role, status) values
  ('a0e10000-0000-4000-8000-000000000001', 'c1ab0000-0000-4000-8000-0000000000e1',
   '90000000-0000-4000-8000-0000000000c1', 'Klara', 'Kind',
   current_date - interval '10 years', 'member', 'active'),
  ('a0e10000-0000-4000-8000-000000000002', 'c1ab0000-0000-4000-8000-0000000000e1',
   '90000000-0000-4000-8000-0000000000e1', 'Erika', 'Eltern',
   current_date - interval '40 years', 'member', 'active'),
  -- Udo: Erwachsener, aber OHNE Geburtsdatum (so legt POST /clubs/join an).
  ('a0e10000-0000-4000-8000-000000000003', 'c1ab0000-0000-4000-8000-0000000000e1',
   '90000000-0000-4000-8000-0000000000d1', 'Udo', 'Unbekannt', null, 'member', 'active'),
  -- Jonas: genau 16 -> darf selbst.
  ('a0e10000-0000-4000-8000-000000000004', 'c1ab0000-0000-4000-8000-0000000000e1',
   '90000000-0000-4000-8000-0000000000b1', 'Jonas', 'Jugend',
   current_date - interval '16 years', 'member', 'active'),
  -- Der Inhaber des FREMDEN Vereins B.
  ('a0e20000-0000-4000-8000-000000000001', 'c1ab0000-0000-4000-8000-0000000000e2',
   '90000000-0000-4000-8000-0000000000f1', 'Fred', 'Fremd', null, 'owner', 'active');

insert into app.guardianships (club_id, guardian_member_id, child_member_id)
values ('c1ab0000-0000-4000-8000-0000000000e1',
        'a0e10000-0000-4000-8000-000000000002',
        'a0e10000-0000-4000-8000-000000000001');

insert into internal.legal_documents (id, kind, version, locale, title, body, content_hash) values
  ('1ee10000-0000-4000-8000-000000000001', 'privacy', 1, 'de', 'Datenschutz v1', 'Fassung 1', 'hash-p1'),
  ('1ee10000-0000-4000-8000-000000000002', 'terms',   1, 'de', 'Bedingungen v1', 'Fassung 1', 'hash-t1');

commit;

-- ===========================================================================
-- (a) ART. 8 — DAS KIND KANN SICH NICHT SELBST EINWILLIGEN
--
-- Das ist der Kern von G2. Vor 0039 lief genau dieses INSERT durch: die
-- consents_insert-Policy (0034:561-568) fragt nur "gehoert die Mitgliedszeile
-- zu auth.uid()?" — ein 10-Jaehriger mit Konto erfuellt das muehelos.
-- ===========================================================================
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-0000000000c1","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-0000000000e1":"member"}}',
  true);
set local role authenticated;

select testkit.throws(
  'Art. 8: das 10-jaehrige Kind darf photos_public NICHT selbst erklaeren',
  $sql$insert into app.consents
        (club_id, member_id, subject_profile_id, purpose, granted, granted_by_profile_id)
       values ('c1ab0000-0000-4000-8000-0000000000e1', 'a0e10000-0000-4000-8000-000000000001',
               '90000000-0000-4000-8000-0000000000c1', 'photos_public', true,
               '90000000-0000-4000-8000-0000000000c1')$sql$,
  '42501');

-- Auch der harmlos klingende Zweck ist gesperrt: die Schwelle haengt am ALTER,
-- nicht daran, wie schlimm der Zweck klingt.
select testkit.throws(
  'Art. 8: das Kind darf auch newsletter nicht selbst erklaeren',
  $sql$insert into app.consents
        (club_id, member_id, subject_profile_id, purpose, granted, granted_by_profile_id)
       values ('c1ab0000-0000-4000-8000-0000000000e1', 'a0e10000-0000-4000-8000-000000000001',
               '90000000-0000-4000-8000-0000000000c1', 'newsletter', true,
               '90000000-0000-4000-8000-0000000000c1')$sql$,
  '42501');

select testkit.is_eq(
  'Art. 8: nach beiden Versuchen liegt KEINE Einwilligung des Kindes vor',
  (select count(*) from app.consents where member_id = 'a0e10000-0000-4000-8000-000000000001'), 0);
rollback;

-- Der Zwang gilt auch fuer service_role — sonst waere er durch jeden API-Pfad
-- umgehbar, und genau die API schreibt die Zeilen. Das ist der Unterschied
-- zwischen einem ROW-Trigger und einer blossen Policy.
begin;
set local role service_role;
select set_config('request.jwt.claims', '', true);
select testkit.throws(
  'Art. 8: auch service_role kann die Selbst-Einwilligung des Kindes nicht schreiben (die API umgeht den Zwang NICHT)',
  $sql$insert into app.consents
        (club_id, member_id, subject_profile_id, purpose, granted, granted_by_profile_id)
       values ('c1ab0000-0000-4000-8000-0000000000e1', 'a0e10000-0000-4000-8000-000000000001',
               '90000000-0000-4000-8000-0000000000c1', 'photos_public', true,
               '90000000-0000-4000-8000-0000000000c1')$sql$,
  '42501');
rollback;

-- ===========================================================================
-- (b) ART. 8 — DIE ERZIEHUNGSBERECHTIGTE PERSON KANN ES, UND NUR SIE
-- ===========================================================================
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-0000000000e1","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-0000000000e1":"member"}}',
  true);
set local role authenticated;

select testkit.succeeds(
  'Art. 8: das Elternteil DARF fuer das Kind einwilligen',
  $sql$insert into app.consents
        (club_id, member_id, subject_profile_id, purpose, granted, granted_by_profile_id,
         legal_document_id, policy_version)
       values ('c1ab0000-0000-4000-8000-0000000000e1', 'a0e10000-0000-4000-8000-000000000001',
               '90000000-0000-4000-8000-0000000000c1', 'photos_public', true,
               '90000000-0000-4000-8000-0000000000e1',
               '1ee10000-0000-4000-8000-000000000001', 'foto-einwilligung-2026-01')$sql$);

-- DER NACHWEIS (Art. 7 Abs. 1 + Art. 8 Abs. 2): er muss zeigen, WER erklaert
-- hat und auf WELCHE Fassung sich das bezieht. Ohne beides ist er wertlos.
select testkit.is_eq(
  'Nachweis: die Zeile weist granted_by_profile_id = Elternteil aus (Art. 8 Abs. 2)',
  (select count(*) from app.consents
    where member_id = 'a0e10000-0000-4000-8000-000000000001'
      and granted_by_profile_id = '90000000-0000-4000-8000-0000000000e1'
      and subject_profile_id    = '90000000-0000-4000-8000-0000000000c1'), 1);

select testkit.is_eq(
  'Nachweis: die Zeile zeigt auf eine FASSUNG (legal_document_id + policy_version)',
  (select count(*) from app.consents
    where member_id = 'a0e10000-0000-4000-8000-000000000001'
      and legal_document_id = '1ee10000-0000-4000-8000-000000000001'
      and policy_version    = 'foto-einwilligung-2026-01'), 1);

select testkit.is_eq(
  'Sicht: die Eltern-Einwilligung ist wirksam und als solche erkennbar',
  (select count(*) from app.effective_consents
    where member_id = 'a0e10000-0000-4000-8000-000000000001'
      and purpose = 'photos_public'
      and effective
      and granted_by_guardian
      and state = 'valid'), 1);
rollback;

-- Ein FREMDER (kein Vormund) darf nicht — auch nicht mit korrektem club_id.
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-0000000000d1","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-0000000000e1":"member"}}',
  true);
set local role authenticated;
select testkit.throws(
  'Art. 8: ein beliebiges Vereinsmitglied ist kein Vormund und darf nicht fuer das Kind erklaeren',
  $sql$insert into app.consents
        (club_id, member_id, subject_profile_id, purpose, granted, granted_by_profile_id)
       values ('c1ab0000-0000-4000-8000-0000000000e1', 'a0e10000-0000-4000-8000-000000000001',
               '90000000-0000-4000-8000-0000000000c1', 'photos_public', true,
               '90000000-0000-4000-8000-0000000000d1')$sql$,
  '42501');
rollback;

-- ===========================================================================
-- (c) UNBEKANNTES GEBURTSDATUM — DIE GUARDIANSHIP ENTSCHEIDET
--
-- birth_date ist NULL-bar und POST /clubs/join erhebt es gar nicht. "NULL =
-- erwachsen" waere der Freifahrtschein; "NULL = Kind" wuerde jedes
-- Bestandsmitglied aussperren. Entschieden: wer als MUENDEL eingetragen ist,
-- ist ein Kind — die Eintragung sagt es, auch ohne Geburtsdatum.
-- ===========================================================================
-- Udo: Erwachsener ohne Geburtsdatum, KEINE Guardianship -> darf selbst.
-- Genau diese Konstellation hat auch der Bestands-Test 99d (Nadja Neuling);
-- sie muss weiter funktionieren, sonst kann niemand mehr einwilligen.
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-0000000000d1","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-0000000000e1":"member"}}',
  true);
set local role authenticated;
select testkit.succeeds(
  'Unbekanntes Alter OHNE Muendel-Eintrag: der Erwachsene darf selbst einwilligen (sonst koennte niemand)',
  $sql$insert into app.consents
        (club_id, member_id, subject_profile_id, purpose, granted, granted_by_profile_id)
       values ('c1ab0000-0000-4000-8000-0000000000e1', 'a0e10000-0000-4000-8000-000000000003',
               '90000000-0000-4000-8000-0000000000d1', 'photos_public', true,
               '90000000-0000-4000-8000-0000000000d1')$sql$);
rollback;

-- DER ENTSCHEIDENDE FALL: Klara hat ebenfalls kein Geburtsdatum mehr, ist aber
-- als Muendel eingetragen -> sie bleibt gesperrt. So sind alle ueber family.ts
-- angelegten Kinder geschuetzt, auch ohne Geburtsdatum.
begin;
set local role service_role;
select set_config('request.jwt.claims', '', true);
update app.club_members set birth_date = null
 where id = 'a0e10000-0000-4000-8000-000000000001';
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-0000000000c1","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-0000000000e1":"member"}}',
  true);
set local role authenticated;
select testkit.throws(
  'Unbekanntes Alter MIT Muendel-Eintrag: das Kind bleibt gesperrt — die Guardianship ersetzt das Geburtsdatum',
  $sql$insert into app.consents
        (club_id, member_id, subject_profile_id, purpose, granted, granted_by_profile_id)
       values ('c1ab0000-0000-4000-8000-0000000000e1', 'a0e10000-0000-4000-8000-000000000001',
               '90000000-0000-4000-8000-0000000000c1', 'photos_public', true,
               '90000000-0000-4000-8000-0000000000c1')$sql$,
  '42501');
rollback;

-- ===========================================================================
-- (c2) DER WIDERRUF IST NIE ALTERSGEPRUEFT (Art. 7 Abs. 3 S. 4)
--
-- Eine Altersschwelle schuetzt vor einer Erklaerung, die man nicht ueberblickt.
-- "Nehmt das Foto runter" ueberblickt auch ein Zehnjaehriger. Wer den Widerruf
-- altersprueft, benutzt den Kinderschutz GEGEN das Kind.
-- ===========================================================================
begin;
set local role service_role;
select set_config('request.jwt.claims', '', true);
insert into app.consents
  (club_id, member_id, subject_profile_id, purpose, granted, granted_by_profile_id)
values ('c1ab0000-0000-4000-8000-0000000000e1', 'a0e10000-0000-4000-8000-000000000001',
        '90000000-0000-4000-8000-0000000000c1', 'photos_public', true,
        '90000000-0000-4000-8000-0000000000e1');

select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-0000000000c1","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-0000000000e1":"member"}}',
  true);
set local role authenticated;
select testkit.succeeds(
  'Widerruf: das 10-jaehrige Kind DARF die Eltern-Einwilligung selbst widerrufen (Art. 7 Abs. 3 S. 4)',
  $sql$insert into app.consents
        (club_id, member_id, subject_profile_id, purpose, granted, granted_by_profile_id)
       values ('c1ab0000-0000-4000-8000-0000000000e1', 'a0e10000-0000-4000-8000-000000000001',
               '90000000-0000-4000-8000-0000000000c1', 'photos_public', false,
               '90000000-0000-4000-8000-0000000000c1')$sql$);
select testkit.is_eq(
  'Widerruf durch das Kind wirkt sofort — obwohl es selbst nicht ERTEILEN duerfte',
  (select count(*) from app.effective_consents
    where member_id = 'a0e10000-0000-4000-8000-000000000001'
      and purpose = 'photos_public' and not effective), 1);
rollback;

-- ===========================================================================
-- (d) DER 16. GEBURTSTAG BEENDET DIE ELTERN-ERKLAERUNGSMACHT
--
-- Entschieden in 0039: die Eltern-Einwilligung ERLISCHT mit 16 (ex nunc), sie
-- gilt NICHT stillschweigend weiter. Andernfalls waere ein Erwachsener
-- dauerhaft an eine Erklaerung gebunden, die er nie abgegeben hat.
-- ===========================================================================
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-0000000000b1","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-0000000000e1":"member"}}',
  true);
set local role authenticated;
select testkit.succeeds(
  'Mit genau 16 erklaert die Person selbst — die Schwelle ist erreicht, nicht ueberschritten',
  $sql$insert into app.consents
        (club_id, member_id, subject_profile_id, purpose, granted, granted_by_profile_id)
       values ('c1ab0000-0000-4000-8000-0000000000e1', 'a0e10000-0000-4000-8000-000000000004',
               '90000000-0000-4000-8000-0000000000b1', 'photos_public', true,
               '90000000-0000-4000-8000-0000000000b1')$sql$);
rollback;

-- Die Eltern-Einwilligung von frueher erlischt, sobald das Kind 16 wird.
begin;
set local role service_role;
select set_config('request.jwt.claims', '', true);
-- Eltern erklaeren, solange das Kind 10 ist ...
insert into app.consents
  (club_id, member_id, subject_profile_id, purpose, granted, granted_by_profile_id)
values ('c1ab0000-0000-4000-8000-0000000000e1', 'a0e10000-0000-4000-8000-000000000001',
        '90000000-0000-4000-8000-0000000000c1', 'photos_public', true,
        '90000000-0000-4000-8000-0000000000e1');

select testkit.is_eq(
  '16. Geburtstag: solange das Kind 10 ist, ist die Eltern-Einwilligung wirksam',
  (select count(*) from app.effective_consents
    where member_id = 'a0e10000-0000-4000-8000-000000000001' and effective), 1);

-- ... und dann wird es 16.
update app.club_members set birth_date = current_date - interval '16 years'
 where id = 'a0e10000-0000-4000-8000-000000000001';

select testkit.is_eq(
  '16. Geburtstag: die Eltern-Einwilligung ERLISCHT von selbst (state=expired_age_16)',
  (select count(*) from app.effective_consents
    where member_id = 'a0e10000-0000-4000-8000-000000000001'
      and not effective and state = 'expired_age_16'), 1);

-- Ex nunc, nicht ex tunc: der NACHWEIS, dass die Einwilligung bestand, bleibt.
-- Art. 7 Abs. 3 S. 2 — die Rechtmaessigkeit des Vorherigen bleibt unberuehrt.
select testkit.is_eq(
  '16. Geburtstag: der Nachweis der frueheren Einwilligung bleibt erhalten (ex nunc, nicht rueckwirkend)',
  (select count(*) from app.consents
    where member_id = 'a0e10000-0000-4000-8000-000000000001' and granted), 1);

-- Und ab 16 kann das Elternteil nicht mehr NEU erklaeren.
select testkit.throws(
  '16. Geburtstag: das Elternteil kann ab 16 nicht mehr neu erklaeren (Erklaerungsmacht erloschen)',
  $sql$insert into app.consents
        (club_id, member_id, subject_profile_id, purpose, granted, granted_by_profile_id)
       values ('c1ab0000-0000-4000-8000-0000000000e1', 'a0e10000-0000-4000-8000-000000000001',
               '90000000-0000-4000-8000-0000000000c1', 'photos_public', true,
               '90000000-0000-4000-8000-0000000000e1')$sql$,
  '42501');
rollback;

-- ===========================================================================
-- (e) G4 — club_id MUSS ZUM MITGLIED PASSEN, UND DAS LECK IST ZU
--
-- Vorher belegt: die Zeile ging durch und der Inhaber des FREMDEN Vereins sah
-- die Einwilligung eines Kindes, mit dem er nichts zu tun hat.
-- ===========================================================================
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-0000000000e1","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-0000000000e1":"member"}}',
  true);
set local role authenticated;
select testkit.throws(
  'G4: eine Einwilligung mit FREMDEM club_id wird abgewiesen (zusammengesetzter FK)',
  $sql$insert into app.consents
        (club_id, member_id, subject_profile_id, purpose, granted, granted_by_profile_id)
       values ('c1ab0000-0000-4000-8000-0000000000e2', 'a0e10000-0000-4000-8000-000000000001',
               '90000000-0000-4000-8000-0000000000c1', 'photos_public', true,
               '90000000-0000-4000-8000-0000000000e1')$sql$,
  '23503');
rollback;

-- Auch service_role kann den Mandantenbruch nicht schreiben: ein FK ist kein
-- Policy-Vorschlag, sondern eine Zusage der Datenbank.
begin;
set local role service_role;
select set_config('request.jwt.claims', '', true);
select testkit.throws(
  'G4: auch service_role kann den Mandantenbruch nicht schreiben',
  $sql$insert into app.consents
        (club_id, member_id, subject_profile_id, purpose, granted, granted_by_profile_id)
       values ('c1ab0000-0000-4000-8000-0000000000e2', 'a0e10000-0000-4000-8000-000000000001',
               '90000000-0000-4000-8000-0000000000c1', 'photos_public', true,
               '90000000-0000-4000-8000-0000000000e1')$sql$,
  '23503');
rollback;

-- Das LECK selbst: der Inhaber von Verein B sieht nichts ueber Klara.
begin;
set local role service_role;
select set_config('request.jwt.claims', '', true);
insert into app.consents
  (club_id, member_id, subject_profile_id, purpose, granted, granted_by_profile_id)
values ('c1ab0000-0000-4000-8000-0000000000e1', 'a0e10000-0000-4000-8000-000000000001',
        '90000000-0000-4000-8000-0000000000c1', 'photos_public', true,
        '90000000-0000-4000-8000-0000000000e1');

select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-0000000000f1","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-0000000000e2":"owner"}}',
  true);
set local role authenticated;
select testkit.is_eq(
  'G4: der Inhaber des FREMDEN Vereins sieht die Einwilligung des Kindes NICHT mehr',
  (select count(*) from app.consents
    where member_id = 'a0e10000-0000-4000-8000-000000000001'), 0);
rollback;

-- Ohne member_id kann man ebenfalls keine Zeile in einen fremden Verein legen:
-- dort greift der FK nicht (MATCH SIMPLE), deshalb prueft der Trigger.
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-0000000000e1","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-0000000000e1":"member"}}',
  true);
set local role authenticated;
select testkit.throws(
  'G4: ohne member_id darf niemand im fremden Namen erklaeren (granted_by muss = subject sein)',
  $sql$insert into app.consents
        (club_id, member_id, subject_profile_id, purpose, granted, granted_by_profile_id)
       values ('c1ab0000-0000-4000-8000-0000000000e2', null,
               '90000000-0000-4000-8000-0000000000c1', 'photos_public', true,
               '90000000-0000-4000-8000-0000000000e1')$sql$,
  '42501');
rollback;

-- ===========================================================================
-- (f) KOPPLUNGSVERBOT — terms/privacy SIND KEINE EINWILLIGUNG
--
-- Vor 0039 war das die EINZIGE Sorte Zeile, die ueberhaupt geschrieben wurde
-- (clubs.ts:259-266, registration.ts:184-191) — und beide Zwecke gehoeren
-- nicht in diese Tabelle: 'terms' ist Art. 6 Abs. 1 lit. b (Vertrag),
-- 'privacy' ist Art. 13 (Informationspflicht). Ein Pflicht-Haken
-- (validation.ts:2510-2511: z.literal(true)) in der Einwilligungstabelle
-- verletzt Art. 7 Abs. 4 und faerbt auf die echten Einwilligungen ab.
-- ===========================================================================
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-0000000000e1","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-0000000000e1":"member"}}',
  true);
set local role authenticated;

select testkit.throws(
  'Kopplungsverbot: terms gehoert NICHT in app.consents (Art. 6 Abs. 1 lit. b, kein Art. 6 Abs. 1 lit. a)',
  $sql$insert into app.consents
        (club_id, member_id, subject_profile_id, purpose, granted, granted_by_profile_id)
       values ('c1ab0000-0000-4000-8000-0000000000e1', 'a0e10000-0000-4000-8000-000000000002',
               '90000000-0000-4000-8000-0000000000e1', 'terms', true,
               '90000000-0000-4000-8000-0000000000e1')$sql$,
  '23514');

select testkit.throws(
  'Kopplungsverbot: privacy gehoert NICHT in app.consents (Art. 13 Kenntnisnahme, keine Einwilligung)',
  $sql$insert into app.consents
        (club_id, member_id, subject_profile_id, purpose, granted, granted_by_profile_id)
       values ('c1ab0000-0000-4000-8000-0000000000e1', 'a0e10000-0000-4000-8000-000000000002',
               '90000000-0000-4000-8000-0000000000e1', 'privacy', true,
               '90000000-0000-4000-8000-0000000000e1')$sql$,
  '23514');

-- Die vier ECHTEN Zwecke bleiben selbstverstaendlich moeglich.
select testkit.succeeds(
  'Die vier echten Zwecke bleiben erlaubt (photos_internal)',
  $sql$insert into app.consents
        (club_id, member_id, subject_profile_id, purpose, granted, granted_by_profile_id)
       values ('c1ab0000-0000-4000-8000-0000000000e1', 'a0e10000-0000-4000-8000-000000000002',
               '90000000-0000-4000-8000-0000000000e1', 'photos_internal', true,
               '90000000-0000-4000-8000-0000000000e1')$sql$);
rollback;

-- ===========================================================================
-- (g) app.policy_acknowledgements — KENNTNISNAHME, MIT FASSUNGSZEIGER
-- ===========================================================================
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-0000000000e1","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-0000000000e1":"member"}}',
  true);
set local role authenticated;

select testkit.succeeds(
  'Kenntnisnahme: die Datenschutzerklaerung wird zur Kenntnis genommen (nicht "eingewilligt")',
  $sql$insert into app.policy_acknowledgements (profile_id, club_id, kind, legal_document_id)
       values ('90000000-0000-4000-8000-0000000000e1', 'c1ab0000-0000-4000-8000-0000000000e1',
               'privacy', '1ee10000-0000-4000-8000-000000000001')$sql$);

-- DER GANZE ZWECK DER TABELLE: ohne Fassung kein Eintrag. Genau dieser Zeiger
-- fehlte an beiden alten Aufrufstellen (legal_document_id blieb NULL).
select testkit.throws(
  'Kenntnisnahme: OHNE Fassungszeiger unmoeglich (Art. 7 Abs. 1 — ein Nachweis ohne Wortlaut ist keiner)',
  $sql$insert into app.policy_acknowledgements (profile_id, club_id, kind, legal_document_id)
       values ('90000000-0000-4000-8000-0000000000e1', 'c1ab0000-0000-4000-8000-0000000000e1',
               'privacy', null)$sql$,
  '23502');

-- Kenntnisnahme ist keine vertretbare Willenserklaerung — auch Eltern nicht.
select testkit.throws(
  'Kenntnisnahme: niemand nimmt fuer einen anderen zur Kenntnis (auch Eltern nicht)',
  $sql$insert into app.policy_acknowledgements (profile_id, club_id, kind, legal_document_id)
       values ('90000000-0000-4000-8000-0000000000c1', 'c1ab0000-0000-4000-8000-0000000000e1',
               'privacy', '1ee10000-0000-4000-8000-000000000001')$sql$,
  '42501');

-- Append-only: eine Kenntnisnahme ist eine Tatsache, kein Schalter.
select testkit.throws(
  'Kenntnisnahme: UPDATE ist gesperrt (append-only)',
  $sql$update app.policy_acknowledgements set kind = 'terms'$sql$,
  '42501');
select testkit.throws(
  'Kenntnisnahme: DELETE ist fuer authenticated gesperrt',
  $sql$delete from app.policy_acknowledgements$sql$,
  '42501');
rollback;

-- Ein fremder Verein sieht die Kenntnisnahme nicht.
begin;
set local role service_role;
select set_config('request.jwt.claims', '', true);
insert into app.policy_acknowledgements (profile_id, club_id, kind, legal_document_id)
values ('90000000-0000-4000-8000-0000000000e1', 'c1ab0000-0000-4000-8000-0000000000e1',
        'privacy', '1ee10000-0000-4000-8000-000000000001');
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-0000000000f1","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-0000000000e2":"owner"}}',
  true);
set local role authenticated;
select testkit.is_eq(
  'Kenntnisnahme: der Inhaber des fremden Vereins sieht sie nicht',
  (select count(*) from app.policy_acknowledgements
    where profile_id = '90000000-0000-4000-8000-0000000000e1'), 0);
rollback;

-- ===========================================================================
-- (h) WIDERRUF (Art. 7 Abs. 3) — MUSS GEHEN, UND DARF DEN NACHWEIS NICHT
--     VERNICHTEN
-- ===========================================================================
begin;
set local role service_role;
select set_config('request.jwt.claims', '', true);
insert into app.consents
  (club_id, member_id, subject_profile_id, purpose, granted, granted_by_profile_id)
values ('c1ab0000-0000-4000-8000-0000000000e1', 'a0e10000-0000-4000-8000-000000000001',
        '90000000-0000-4000-8000-0000000000c1', 'photos_public', true,
        '90000000-0000-4000-8000-0000000000e1');

select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-0000000000e1","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-0000000000e1":"member"}}',
  true);
set local role authenticated;

select testkit.succeeds(
  'Widerruf (Art. 7 Abs. 3): das Elternteil widerruft — als NEUE Zeile, nicht als UPDATE',
  $sql$insert into app.consents
        (club_id, member_id, subject_profile_id, purpose, granted, granted_by_profile_id)
       values ('c1ab0000-0000-4000-8000-0000000000e1', 'a0e10000-0000-4000-8000-000000000001',
               '90000000-0000-4000-8000-0000000000c1', 'photos_public', false,
               '90000000-0000-4000-8000-0000000000e1')$sql$);

select testkit.is_eq(
  'Widerruf: die Sicht zeigt sofort "nicht mehr wirksam"',
  (select count(*) from app.effective_consents
    where member_id = 'a0e10000-0000-4000-8000-000000000001'
      and purpose = 'photos_public'
      and not effective and state = 'revoked'), 1);

select testkit.is_eq(
  'Widerruf: das Journal behaelt BEIDE Zeilen — der Nachweis der frueheren Rechtmaessigkeit ueberlebt',
  (select count(*) from app.consents
    where member_id = 'a0e10000-0000-4000-8000-000000000001'
      and purpose = 'photos_public'), 2);

-- Ein Widerruf ist kein Nachweis-Loeschen: UPDATE bleibt gesperrt (0034).
select testkit.throws(
  'Widerruf: ein UPDATE auf die alte Zeile bleibt gesperrt (append-only)',
  $sql$update app.consents set granted = false
        where member_id = 'a0e10000-0000-4000-8000-000000000001'$sql$,
  '42501');
rollback;

-- ===========================================================================
-- (i) DER GLEICHSTAND — "die juengste Zeile gilt" muss EINDEUTIG sein
--
-- Beide Zeilen entstehen hier in EINER Transaktion. Damit ist recorded_at
-- identisch (now() = Transaktionszeit), und app.uuid_v7 (0001:65-74) loest nur
-- Millisekunden auf — die ids unterscheiden sich dann nur im Zufallsteil.
-- Ohne app.consents.seq entschiede hier der WUERFEL, ob das Foto onlinebleibt.
-- Genau so ist der Fehler beim Bau aufgefallen: dieser Test schlug zufaellig
-- fehl. Er ist der Waechter darueber, dass die Ordnung eindeutig bleibt.
-- ===========================================================================
begin;
set local role service_role;
select set_config('request.jwt.claims', '', true);

-- Erteilen und Widerrufen in EINER Transaktion, unmittelbar hintereinander.
insert into app.consents
  (club_id, member_id, subject_profile_id, purpose, granted, granted_by_profile_id)
values ('c1ab0000-0000-4000-8000-0000000000e1', 'a0e10000-0000-4000-8000-000000000001',
        '90000000-0000-4000-8000-0000000000c1', 'chat', true,
        '90000000-0000-4000-8000-0000000000e1');
insert into app.consents
  (club_id, member_id, subject_profile_id, purpose, granted, granted_by_profile_id)
values ('c1ab0000-0000-4000-8000-0000000000e1', 'a0e10000-0000-4000-8000-000000000001',
        '90000000-0000-4000-8000-0000000000c1', 'chat', false,
        '90000000-0000-4000-8000-0000000000e1');

select testkit.is_eq(
  'Gleichstand: beide Zeilen tragen dieselbe recorded_at (now() = Transaktionszeit) — der Gleichstand ist echt, kein Sonderfall',
  (select count(distinct recorded_at) from app.consents
    where member_id = 'a0e10000-0000-4000-8000-000000000001' and purpose = 'chat'), 1);

select testkit.is_eq(
  'Gleichstand: die Sicht entscheidet ihn TROTZDEM eindeutig fuer den Widerruf (seq, nicht Zufall)',
  (select count(*) from app.effective_consents
    where member_id = 'a0e10000-0000-4000-8000-000000000001'
      and purpose = 'chat' and not effective and state = 'revoked'), 1);

select testkit.is_eq(
  'Gleichstand: die Sicht liefert genau EINE Zeile je (Person, Zweck) — nie zwei, nie null',
  (select count(*) from app.effective_consents
    where member_id = 'a0e10000-0000-4000-8000-000000000001' and purpose = 'chat'), 1);
rollback;
