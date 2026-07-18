-- ============================================================================
-- 99oA_zubuchbare_module.sql — GALERIE, DOKUMENTE und NOTIZEN sind ZUBUCHBAR
-- (Migration 0068).
--
-- WARUM DIESE DATEI
-- ---------------------------------------------------------------------------
-- Der Nutzer war eindeutig: "Galerie ist Pro und Pro muss man erst freischalten;
-- genauso Dokumente — das ist ein Feature, das ein Verein zusaetzlich buchen
-- kann, nicht automatisch aktiviert; genauso Notizen."
--
-- Eine Voreinstellung, die man nur BEHAUPTET, ist wertlos: das UI wuerde "nicht
-- gebucht" sagen und die Daten kaemen weiter heraus. Diese Datei MISST nach:
--   A) Der Katalog kennt genau diese drei als zubuchbar — und jedes hat ein Gate.
--   B) Ein NEUER Verein (club B, entstand nach den Migrationen) hat sie AUS,
--      ohne dass jemand einen Schalter angefasst hat. Das ist der Kern.
--   C) Der DEMO-Verein hat gebucht -> die Demo zeigt etwas.
--   D) Abschalten -> die Daten sind WIRKLICH weg (0 Zeilen + Schreiben 42501),
--      nicht nur die Kachel. Fuer ALLE DREI.
--   E) Die Daten bleiben dabei in der DB — Buchung entzieht Zugriff, nicht Inhalt.
--   F) Wieder buchen -> alles zurueck.
--   G) Positivkontrolle (Sabotage): ohne default_enabled=false waere ein neuer
--      Verein offen. Stellt den Ausfall der Kontrolle NACH, statt ihn zu glauben.
--   H) Die NULL-Club-Notiz (persoenlicher Zettel) bleibt unberuehrt.
--
-- Personas (seed), Verein A = c1ab..01 (RSV Neckarsulm, HAT PRO, HAT gebucht):
--   Sandra  90..01 / a-01  coach  (Eigentuemerin der 2 Seed-Notizen)
--   Thomas  90..04 / a-04  admin  (is_club_admin -> darf schalten)
--   Katrin  90..09 / a-09  member
-- Verein B = deadbeef-00..01 'SC Beispielstadt' (01_fixture_club_b.sql):
--   entstand NACH den Migrationen -> kein Backfill -> der ECHTE Neuverein-Fall.
--   Owner Bert deadbeef-90..01.
--
-- LIES 0044 (Bauform) und 0068 (Voreinstellung) — hier steht nur die Messung.
-- Diese Datei ist NEU. Bestands-Tests bleiben unberuehrt.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- A) Der Katalog: genau drei zubuchbare Module, jedes mit einem echten Gate.
--    Ohne Gate waere "nicht gebucht" eine Luege — das UI verspraeche einen
--    Entzug, den die Datenbank nicht leistet.
-- ---------------------------------------------------------------------------
begin;
do $$
begin
  perform testkit.is_eq('zubuchbar: genau 3 Module sind voreingestellt AUS',
    (select count(*) from app.modules where not default_enabled), 3);

  perform testkit.is_eq('zubuchbar: es sind gallery, document und notes',
    (select count(*) from app.modules
      where not default_enabled and key in ('gallery', 'document', 'notes')), 3);

  -- Jedes zubuchbare Modul haengt an mindestens einer restriktiven Policy.
  perform testkit.is_eq('zubuchbar: jedes der drei Module hat ein echtes RLS-Gate',
    (select count(*) from app.modules m
      where not m.default_enabled
        and exists (select 1 from app.module_policy_usage() u where u.module_key = m.key)), 3);

  -- Ein Kernmodul kann nicht zubuchbar sein (sein Gate waere konstant true).
  perform testkit.is_eq('zubuchbar: kein Kernmodul ist zubuchbar',
    (select count(*) from app.modules where not default_enabled and core), 0);

  -- Gegenprobe: die Regel bleibt "an". Sonst haette 0068 zu viel umgelegt.
  perform testkit.is_eq('zubuchbar: die uebrigen 23 Module bleiben voreingestellt AN',
    (select count(*) from app.modules where default_enabled), 23);
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- B) DER KERN: ein NEUER Verein hat die drei Module AUS, ohne dass jemand einen
--    Schalter angefasst hat.
--
--    Club B ist dafuer der ehrliche Fall: er wird in 01_fixture_club_b.sql
--    angelegt, also NACH den Migrationen — der Backfill aus 0068 Abschnitt 3 hat
--    ihn nie gesehen. Genau so entsteht ein Verein in Produktion.
-- ---------------------------------------------------------------------------
begin;
do $$
declare
  v_club uuid := 'deadbeef-0000-4000-8000-000000000001';
begin
  perform testkit.is_eq('neuer Verein: er hat fuer die drei Module KEINE Schalter-Zeile (nie angefasst)',
    (select count(*) from app.club_modules
      where club_id = v_club and module_key in ('gallery', 'document', 'notes')), 0);

  perform testkit.is_eq('neuer Verein: "gallery" ist AUS (nicht gebucht)',
    (select case when app.module_enabled(v_club, 'gallery') then 1 else 0 end), 0);
  perform testkit.is_eq('neuer Verein: "document" ist AUS (nicht gebucht)',
    (select case when app.module_enabled(v_club, 'document') then 1 else 0 end), 0);
  perform testkit.is_eq('neuer Verein: "notes" ist AUS (nicht gebucht)',
    (select case when app.module_enabled(v_club, 'notes') then 1 else 0 end), 0);

  -- Gegenprobe: ein NICHT zubuchbares Modul ist beim neuen Verein weiterhin an.
  -- Ohne diese Zeile koennte 0068 alles abgeschaltet haben und der Test waere
  -- trotzdem gruen.
  perform testkit.is_eq('neuer Verein: "news" ist unveraendert AN (nur die drei sind zubuchbar)',
    (select case when app.module_enabled(v_club, 'news') then 1 else 0 end), 1);
  perform testkit.is_eq('neuer Verein: "events" ist unveraendert AN',
    (select case when app.module_enabled(v_club, 'events') then 1 else 0 end), 1);
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- B2) ... und das wirkt auch auf die DATEN, nicht nur auf die Auskunft.
--     Gemessen an 'notes': Notizen brauchen KEIN PRO-Entitlement, der Entzug
--     kommt hier also nachweislich vom Buchungs-Gate und nicht vom PRO-Gate.
--     (Bei gallery/document waere club B ohnehin durch 0012 zu — das wuerde die
--     Messung verwaschen. Deshalb notes.)
-- ---------------------------------------------------------------------------
begin;
-- Als Superuser gelegt (Fixture-Setup, kein Policy-Test): eine Vereins-Notiz,
-- die Bert unter normalen Umstaenden sehen WUERDE.
insert into app.notes (id, owner_profile_id, club_id, title, body) values
  ('a5e0beef-0000-4000-8000-000000000001', 'deadbeef-9000-4000-8000-000000000001',
   'deadbeef-0000-4000-8000-000000000001', 'Vereins-Notiz B', 'Nur sichtbar, wenn "Notizen" gebucht ist.');

select set_config('request.jwt.claims',
  '{"sub":"deadbeef-9000-4000-8000-000000000001","role":"authenticated","club_roles":{"deadbeef-0000-4000-8000-000000000001":"owner"}}',
  true);
set local role authenticated;

do $$
begin
  -- Die Notiz gehoert IHM, ist aber an einen Verein gebunden, der das Modul
  -- nicht gebucht hat -> sie kommt nicht heraus. Das ist der Beweis, dass der
  -- Entzug in der DATENBANK sitzt und nicht in der Oberflaeche.
  perform testkit.is_eq('neuer Verein: "notes" nicht gebucht -> der Eigentuemer sieht seine EIGENE Vereins-Notiz nicht',
    (select count(*) from app.notes where club_id = 'deadbeef-0000-4000-8000-000000000001'), 0);

  -- ... und er kann auch keine neue anlegen (restriktive Policy, with check).
  perform testkit.throws('neuer Verein: "notes" nicht gebucht -> Anlegen scheitert (42501)',
    $q$insert into app.notes (owner_profile_id, club_id, title, body)
       values ('deadbeef-9000-4000-8000-000000000001',
               'deadbeef-0000-4000-8000-000000000001', 'Neu', 'Text')$q$, '42501');
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- B3) Der Verein BUCHT — und danach geht es. Ohne diesen Block waere nicht
--     belegt, dass die Buchung der wirksame Hebel ist (und nicht irgendetwas
--     anderes den Zugriff nimmt).
-- ---------------------------------------------------------------------------
begin;
insert into app.notes (id, owner_profile_id, club_id, title, body) values
  ('a5e0beef-0000-4000-8000-000000000002', 'deadbeef-9000-4000-8000-000000000001',
   'deadbeef-0000-4000-8000-000000000001', 'Vereins-Notiz B', 'Jetzt gebucht.');

select set_config('request.jwt.claims',
  '{"sub":"deadbeef-9000-4000-8000-000000000001","role":"authenticated","club_roles":{"deadbeef-0000-4000-8000-000000000001":"owner"}}',
  true);
set local role authenticated;

do $$
declare
  v_club uuid := 'deadbeef-0000-4000-8000-000000000001';
begin
  -- Der Owner bucht das Modul (is_club_admin -> darf schalten, 0044).
  insert into app.club_modules (club_id, module_key, enabled) values (v_club, 'notes', true);

  perform testkit.is_eq('gebucht: "notes" ist jetzt AN',
    (select case when app.module_enabled(v_club, 'notes') then 1 else 0 end), 1);
  perform testkit.is_eq('gebucht: die Vereins-Notiz ist sichtbar',
    (select count(*) from app.notes where club_id = v_club), 1);
  perform testkit.succeeds('gebucht: Anlegen funktioniert wieder',
    $q$insert into app.notes (owner_profile_id, club_id, title, body)
       values ('deadbeef-9000-4000-8000-000000000001',
               'deadbeef-0000-4000-8000-000000000001', 'Neu', 'Text')$q$);
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- C) Der DEMO-Verein hat gebucht (seed.sql) — die Demo zeigt etwas. Ein Gate,
--    das die Demo leerraeumt, wuerde beim naechsten Vorfuehren zurueckgedreht.
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000001","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"coach"}}',
  true);
set local role authenticated;
do $$
declare
  v_club uuid := 'c1ab0000-0000-4000-8000-000000000001';
begin
  perform testkit.is_eq('Demo: der Verein hat alle drei Module ausdruecklich gebucht',
    (select count(*) from app.club_modules
      where club_id = v_club and enabled
        and module_key in ('gallery', 'document', 'notes')), 3);

  perform testkit.is_eq('Demo: die Galerie zeigt ihre 4 Bilder',   (select count(*) from app.gallery_items), 4);
  perform testkit.is_eq('Demo: die Dokumente zeigen ihre 3 Dateien',(select count(*) from app.documents), 3);
  perform testkit.is_eq('Demo: die Trainerin sieht ihre 2 Notizen', (select count(*) from app.notes), 2);

  -- Und die Auskunft an die Clients stimmt: gebucht UND lizenziert = verfuegbar.
  perform testkit.is_eq('Demo: club_module_states meldet alle drei als verfuegbar',
    (select count(*) from app.club_module_states(v_club)
      where module_key in ('gallery', 'document', 'notes') and available), 3);
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- D) ABBUCHEN -> die Daten sind WIRKLICH weg. Fuer alle drei, lesend UND
--    schreibend. Das ist die Zusage aus dem Auftrag: "abschalten -> Daten
--    wirklich nicht mehr abrufbar, auch per direktem API-Aufruf". Ein direkter
--    API-Aufruf landet auf genau dieser RLS — hier ohne Umweg gemessen.
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000004","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"admin"}}',
  true);
set local role authenticated;

update app.club_modules set enabled = false
 where club_id = 'c1ab0000-0000-4000-8000-000000000001'
   and module_key in ('gallery', 'document', 'notes');

do $$
declare
  v_club uuid := 'c1ab0000-0000-4000-8000-000000000001';
begin
  perform testkit.is_eq('abgebucht: "gallery" AUS -> 0 Bilder (die Daten sind weg, nicht nur die Kachel)',
    (select count(*) from app.gallery_items), 0);
  perform testkit.is_eq('abgebucht: "document" AUS -> 0 Dokumente',
    (select count(*) from app.documents), 0);

  perform testkit.throws('abgebucht: "gallery" AUS -> auch der Admin kann nichts anlegen (42501)',
    format($q$insert into app.gallery_items
        (club_id, title, kind, storage_key, content_type, size_bytes)
       values (%L, 'Trotzdem', 'photo', 'x-01.png', 'image/png', 10)$q$, v_club), '42501');
  perform testkit.throws('abgebucht: "document" AUS -> auch der Admin kann nichts anlegen (42501)',
    format($q$insert into app.documents
        (club_id, title, category, storage_key, content_type, size_bytes)
       values (%L, 'Trotzdem', 'satzung', 'x-01.pdf', 'application/pdf', 10)$q$, v_club), '42501');

  -- Gegenprobe: ein anderes Modul bleibt unberuehrt. Ein Gate darf kein
  -- fremdes Modul mit abschalten (0044-Kaskadenanalyse, hier nachgemessen).
  perform testkit.is_eq('abgebucht: die News bleiben unberuehrt (3) — ein Gate schaltet kein fremdes Modul mit ab',
    (select count(*) from app.news), 3);
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- D2) 'notes' abgebucht, aus Sicht der EIGENTUEMERIN. Getrennt gemessen, weil
--     Notizen keine Vereins-, sondern Personendaten sind: hier faellt der
--     Zugriff auf die eigenen VEREINS-Notizen weg.
-- ---------------------------------------------------------------------------
begin;
update app.club_modules set enabled = false
 where club_id = 'c1ab0000-0000-4000-8000-000000000001' and module_key = 'notes';

select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000001","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"coach"}}',
  true);
set local role authenticated;

do $$
begin
  -- Seed: 2 Notizen von Sandra — eine MIT club_id, eine OHNE (seed.sql).
  -- Abgebucht bleibt genau die vereinslose uebrig.
  perform testkit.is_eq('abgebucht: "notes" AUS -> die VEREINS-Notiz ist weg',
    (select count(*) from app.notes where club_id is not null), 0);

  -- H) DIE NULL-CLUB-REGEL (0068): ein persoenlicher Zettel ohne Verein gehoert
  --    zu keinem Verein und darf von keinem Vereins-Schalter erfasst werden.
  --    Ohne diese Regel waere er fuer immer unerreichbar — stiller Datenverlust.
  perform testkit.is_eq('abgebucht: der persoenliche Zettel OHNE Verein bleibt sichtbar (NULL-Club-Regel)',
    (select count(*) from app.notes where club_id is null), 1);
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- E) Die DATEN bleiben in der Datenbank. Abbuchen entzieht den ZUGRIFF, es
--    loescht nichts — sonst waere jede Buchungsaenderung ein Datenverlust.
--    Gemessen als Tabellen-Eigentuemer (RLS greift dort nicht).
-- ---------------------------------------------------------------------------
begin;
update app.club_modules set enabled = false
 where club_id = 'c1ab0000-0000-4000-8000-000000000001'
   and module_key in ('gallery', 'document', 'notes');
do $$
begin
  perform testkit.is_eq('abgebucht: die 4 Bilder liegen unveraendert in der DB',
    (select count(*) from app.gallery_items
      where club_id = 'c1ab0000-0000-4000-8000-000000000001'), 4);
  perform testkit.is_eq('abgebucht: die 3 Dokumente liegen unveraendert in der DB',
    (select count(*) from app.documents
      where club_id = 'c1ab0000-0000-4000-8000-000000000001'), 3);
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- F) Wieder buchen -> alles zurueck. Kein Datenverlust, keine Nacharbeit.
-- ---------------------------------------------------------------------------
begin;
update app.club_modules set enabled = false
 where club_id = 'c1ab0000-0000-4000-8000-000000000001'
   and module_key in ('gallery', 'document');
update app.club_modules set enabled = true
 where club_id = 'c1ab0000-0000-4000-8000-000000000001'
   and module_key in ('gallery', 'document');

select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000009","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"member"}}',
  true);
set local role authenticated;
do $$
begin
  perform testkit.is_eq('wieder gebucht: die 4 Bilder sind zurueck',
    (select count(*) from app.gallery_items), 4);
  perform testkit.is_eq('wieder gebucht: die 3 Dokumente sind zurueck',
    (select count(*) from app.documents), 3);
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- G) POSITIVKONTROLLE (Sabotage). Der wichtigste Block: er stellt den AUSFALL
--    der Kontrolle nach. Setzt man default_enabled zurueck auf true, ist der
--    neue Verein wieder offen — waeren die Bloecke oben auch dann gruen, haetten
--    sie nie etwas gemessen.
--
--    Laeuft im Transaktionsblock und wird zurueckgerollt: die Sabotage verlaesst
--    diesen Test nicht.
-- ---------------------------------------------------------------------------
begin;
update app.modules set default_enabled = true where key = 'notes';
do $$
declare
  v_club uuid := 'deadbeef-0000-4000-8000-000000000001';
begin
  perform testkit.is_eq('SABOTAGE: ohne die Voreinstellung AUS waere "notes" beim neuen Verein offen',
    (select case when app.module_enabled(v_club, 'notes') then 1 else 0 end), 1);
end;
$$;
rollback;

-- Die Sabotage ist wirklich weg — sonst haette sie die folgenden Suiten vergiftet.
begin;
do $$
begin
  perform testkit.is_eq('SABOTAGE zurueckgerollt: "notes" ist wieder voreingestellt AUS',
    (select case when default_enabled then 1 else 0 end from app.modules where key = 'notes'), 0);
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- I) Die Auskunft an die Clients traegt die Voreinstellung mit. Ohne sie kann
--    das UI "nicht gebucht" nicht von "abgeschaltet" unterscheiden und muesste
--    raten — genau die Sorte Halbwahrheit, die 0033/0044 abgeschafft haben.
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claims',
  '{"sub":"deadbeef-9000-4000-8000-000000000001","role":"authenticated","club_roles":{"deadbeef-0000-4000-8000-000000000001":"owner"}}',
  true);
set local role authenticated;
do $$
declare
  v_club uuid := 'deadbeef-0000-4000-8000-000000000001';
begin
  perform testkit.is_eq('Auskunft: club_module_states meldet die drei als zubuchbar (default_enabled=false)',
    (select count(*) from app.club_module_states(v_club)
      where module_key in ('gallery', 'document', 'notes') and not default_enabled), 3);

  perform testkit.is_eq('Auskunft: beim neuen Verein sind sie zugleich nicht verfuegbar',
    (select count(*) from app.club_module_states(v_club)
      where module_key in ('gallery', 'document', 'notes') and not available), 3);

  perform testkit.is_eq('Auskunft: die uebrigen Module melden default_enabled=true',
    (select count(*) from app.club_module_states(v_club) where default_enabled), 23);
end;
$$;
rollback;
