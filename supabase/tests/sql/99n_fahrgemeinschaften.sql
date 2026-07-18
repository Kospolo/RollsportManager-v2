-- ============================================================================
-- 99n_fahrgemeinschaften.sql — Fahrgemeinschaften (Migration 0066).
--
-- Prueft die fuenf Zusagen der Migration, jede als ECHTE SELECT-/INSERT-Probe
-- unter der Identitaet der jeweiligen Person (set_config request.jwt.claims +
-- SET LOCAL ROLE authenticated) — nicht ueber die API, nicht ueber das UI:
--
--   (a) SICHTBARKEIT der Fahrt folgt der Sichtbarkeit des TERMINS
--       (app.can_read_event wird wiederverwendet, nicht nachgebaut).
--   (b) FAHRT ANBIETEN: Erwachsene ja, Minderjaehrige NEIN (42501).
--   (c) MITFAHRER: fuer sich selbst oder als Erziehungsberechtigte:r ja,
--       fuer ein FREMDES Kind nein (42501 aus der RLS-Policy).
--   (d) RUECKRUFNUMMER: nur Fahrt-Beteiligte + Verwaltung — belegt durch eine
--       rohe SELECT-Probe auf app.event_ride_contacts, NICHT durch UI-Verhalten.
--       Inklusive des Gegenbeweises, dass die Spalte auf app.event_rides gar
--       nicht existiert (sonst waere die Zerlegung wirkungslos).
--   (e) UEBERBUCHUNG scheitert (23514), auch ueber den Umweg "Platzzahl senken".
--   + MANDANTEN-ISOLATION.
--
-- Seed-Lage (0066-Block in seed.sql), auf die sich alles bezieht:
--   fa-01: Fahrerin Katrin (a-09), 3 Plaetze, Mitfahrer Sofia (a-10, zugesagt
--          von Stefanie 90-12) und Finn (a-13, zugesagt von Petra 90-14)
--          -> 1 Platz frei, status 'offen'.
--   fa-02: Fahrerin Stefanie (a-12), 1 Platz, Mitfahrerin Lina (a-07, zugesagt
--          von Katrin 90-09) -> ausgebucht, status 'voll' (Trigger).
--   Beide zum Wettkampf e-12 (Bezirksmeisterschaft Ludwigsburg, audience
--   'teams').
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Vorbereitung (Superuser, auth.uid() null -> Schutz-Trigger halten sich
-- zurueck, die Integritaets-Trigger gelten trotzdem).
--
-- Gebraucht werden zwei Dinge, die der Seed nicht hergibt:
--   1. eine MINDERJAEHRIGE MIT KONTO. Im Seed haben genau die Kinder kein
--      Konto — fuer den Test "Minderjaehrige bieten keine Fahrt an" braucht es
--      aber jemanden, der sich ueberhaupt anmelden kann. Hanna Foerster (a-23,
--      geboren 2008) bekommt deshalb ein Konto.
--   2. ein ZWEITER VEREIN mit eigenem owner fuer die Mandanten-Isolation.
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claims', '', true);

insert into auth.users (id, email) values
  ('90fc0000-0000-4000-8000-000000000001', 'hanna.foerster@example.org'),
  ('90fc0000-0000-4000-8000-000000000002', 'ronny.rivale@example.org')
on conflict (id) do nothing;
insert into app.profiles (id, display_name) values
  ('90fc0000-0000-4000-8000-000000000001', 'Hanna Förster'),
  ('90fc0000-0000-4000-8000-000000000002', 'Ronny Rivale');

-- Hanna (a-23, geboren 2008-09-13) bekommt ihr Konto. Sie ist 17 — und bleibt
-- es auch am Wettkampftag (+9 Tage), der Test haengt also nicht am Kalender.
update app.club_members
   set profile_id = '90fc0000-0000-4000-8000-000000000001'
 where id = 'a0000000-0000-4000-8000-000000000023';

-- Zweiter Verein (eigene Ids, damit diese Suite unabhaengig von 99m laeuft).
insert into app.clubs (id, name, city, join_code)
values ('c1fc0000-0000-4000-8000-000000000001', 'RSC Rivalstadt', 'Rivalstadt', 'TEST-F006');
insert into app.club_members (id, club_id, profile_id, first_name, last_name, role, status)
values ('a0fc0000-0000-4000-8000-000000000001', 'c1fc0000-0000-4000-8000-000000000001',
        '90fc0000-0000-4000-8000-000000000002', 'Ronny', 'Rivale', 'owner', 'active');
commit;

-- ===========================================================================
-- (0) Der Seed-Zustand — Grundlage aller weiteren Aussagen.
-- ===========================================================================
begin;
select set_config('request.jwt.claims', '', true);

do $$
begin
  -- Der abgeleitete Status: fa-02 ist mit 1 von 1 Platz voll, OHNE dass der
  -- Seed 'voll' geschrieben haette. Das belegt den Trigger app.sync_ride_status.
  perform testkit.is_eq('Seed: fa-01 hat noch Platz -> status offen',
    (select count(*) from app.event_rides
      where id = 'fa000000-0000-4000-8000-000000000001' and status = 'offen'), 1);
  perform testkit.is_eq('Seed: fa-02 ist ausgebucht -> status voll (Trigger, nicht Seed)',
    (select count(*) from app.event_rides
      where id = 'fa000000-0000-4000-8000-000000000002' and status = 'voll'), 1);
  perform testkit.is_eq('Seed: 3 Zusagen, alle von einem ELTERNTEIL erklaert',
    (select count(*) from app.event_ride_riders
      where angemeldet_von_profile_id is not null), 3);

  -- STRUKTURBEWEIS: die Rueckrufnummer ist KEINE Spalte der Fahrt. Ohne diese
  -- Zusicherung waere die ganze Zerlegung wirkungslos — RLS schuetzt Zeilen,
  -- also duerfte die Nummer niemals in der weit sichtbaren Zeile stehen.
  perform testkit.is_eq('Struktur: app.event_rides hat KEINE Spalte rueckrufnummer',
    (select count(*) from information_schema.columns
      where table_schema = 'app' and table_name = 'event_rides'
        and column_name = 'rueckrufnummer'), 0);
  perform testkit.is_eq('Struktur: die Nummer steht in der eigenen Tabelle event_ride_contacts',
    (select count(*) from information_schema.columns
      where table_schema = 'app' and table_name = 'event_ride_contacts'
        and column_name = 'rueckrufnummer'), 1);
end;
$$;
rollback;

-- ===========================================================================
-- (a) SICHTBARKEIT der Fahrt = Sichtbarkeit des Termins.
-- ===========================================================================

-- Katrin (Mutter, member): sieht e-12 ueber ihre Kinder -> also auch die Fahrten.
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000009","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"member"}}',
  true);
set local role authenticated;

do $$
begin
  perform testkit.is_eq('Eltern: sehen beide Fahrten zum Wettkampf e-12',
    (select count(*) from app.event_rides
      where event_id = 'e0000000-0000-4000-8000-000000000012'), 2);
  perform testkit.is_eq('Eltern: sehen die Mitfahrer (Namen sind vereinsintern ohnehin offen)',
    (select count(*) from app.event_ride_riders), 3);
end;
$$;
rollback;

-- ===========================================================================
-- (b) FAHRT ANBIETEN — Erwachsene ja, Minderjaehrige nein.
--     Beides auf der VEREINSveranstaltung e-14 (Sommerfest, audience 'club'),
--     damit der Test nicht an einer Team-Zuordnung haengt, sondern genau das
--     misst, was er messen soll: das ALTER.
-- ===========================================================================

-- Katrin (erwachsen, birth_date unbekannt -> erlaubt, fail-open wie dokumentiert).
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000009","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"member"}}',
  true);
set local role authenticated;

do $$
begin
  insert into app.event_rides
    (id, club_id, event_id, driver_member_id, abfahrtsort, abfahrtszeit, plaetze_gesamt)
  values ('fa000000-0000-4000-8000-0000000000a1', 'c1ab0000-0000-4000-8000-000000000001',
          'e0000000-0000-4000-8000-000000000014', 'a0000000-0000-4000-8000-000000000009',
          'Vereinsheim', now() + interval '23 days', 2);
  perform testkit.is_eq('Erwachsene: darf eine Fahrt anbieten',
    (select count(*) from app.event_rides
      where id = 'fa000000-0000-4000-8000-0000000000a1'), 1);

  -- ... aber NICHT im Namen einer anderen Person (der Fahrer ist man selbst).
  perform testkit.throws(
    'Mitglied: darf KEINE Fahrt im Namen einer anderen Person anbieten',
    $sql$insert into app.event_rides
           (club_id, event_id, driver_member_id, abfahrtsort, abfahrtszeit, plaetze_gesamt)
         values ('c1ab0000-0000-4000-8000-000000000001',
                 'e0000000-0000-4000-8000-000000000014',
                 'a0000000-0000-4000-8000-000000000012',
                 'Fremdadresse', now() + interval '23 days', 2)$sql$,
    '42501');
end;
$$;
rollback;

-- Hanna (17) — dieselbe Anweisung, nur mit minderjaehriger Fahrerin.
begin;
select set_config('request.jwt.claims',
  '{"sub":"90fc0000-0000-4000-8000-000000000001","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"member"}}',
  true);
set local role authenticated;

do $$
begin
  perform testkit.throws(
    'Minderjaehrige: darf KEINE Fahrt anbieten (42501 aus dem Trigger)',
    $sql$insert into app.event_rides
           (club_id, event_id, driver_member_id, abfahrtsort, abfahrtszeit, plaetze_gesamt)
         values ('c1ab0000-0000-4000-8000-000000000001',
                 'e0000000-0000-4000-8000-000000000014',
                 'a0000000-0000-4000-8000-000000000023',
                 'Bahnhof', now() + interval '23 days', 3)$sql$,
    '42501');
end;
$$;
rollback;

-- Der Trigger misst das Alter ZUR ABFAHRT, nicht heute: eine Abfahrt nach
-- Hannas 18. Geburtstag ist erlaubt. (Superuser -> RLS aus, geprueft wird
-- ausschliesslich der Alters-Trigger.)
begin;
select set_config('request.jwt.claims', '', true);

do $$
begin
  insert into app.event_rides
    (id, club_id, event_id, driver_member_id, abfahrtsort, abfahrtszeit, plaetze_gesamt)
  values ('fa000000-0000-4000-8000-0000000000a2', 'c1ab0000-0000-4000-8000-000000000001',
          'e0000000-0000-4000-8000-000000000014', 'a0000000-0000-4000-8000-000000000023',
          'Bahnhof',
          ((select birth_date from app.club_members
             where id = 'a0000000-0000-4000-8000-000000000023') + interval '18 years 1 day')::timestamptz,
          3);
  perform testkit.is_eq('Alter zaehlt ZUR ABFAHRTSZEIT: nach dem 18. Geburtstag erlaubt',
    (select count(*) from app.event_rides
      where id = 'fa000000-0000-4000-8000-0000000000a2'), 1);
end;
$$;
rollback;

-- ===========================================================================
-- (c) MITFAHRER — eigenes Kind ja, fremdes Kind nein.
-- ===========================================================================

-- Stefanie (90-12) traegt ihr ZWEITES Kind Ben (a-11) auf fa-01 ein (1 Platz frei).
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000012","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"member"}}',
  true);
set local role authenticated;

do $$
begin
  insert into app.event_ride_riders
    (club_id, ride_id, member_id, angemeldet_von_profile_id)
  values ('c1ab0000-0000-4000-8000-000000000001', 'fa000000-0000-4000-8000-000000000001',
          'a0000000-0000-4000-8000-000000000011', '90000000-0000-4000-8000-000000000012');
  perform testkit.is_eq('Elternteil: darf das EIGENE Kind eintragen',
    (select count(*) from app.event_ride_riders
      where ride_id = 'fa000000-0000-4000-8000-000000000001'
        and member_id = 'a0000000-0000-4000-8000-000000000011'), 1);

  -- Die Fahrt ist damit voll — der abgeleitete Status zieht nach.
  perform testkit.is_eq('Status zieht nach: fa-01 ist nach der 3. Zusage voll',
    (select count(*) from app.event_rides
      where id = 'fa000000-0000-4000-8000-000000000001' and status = 'voll'), 1);

  -- (e) UEBERBUCHUNG: der vierte Mitfahrer passt nicht mehr ins Auto.
  perform testkit.throws(
    'Ueberbuchung: die 4. Zusage auf 3 Plaetze scheitert (23514)',
    $sql$insert into app.event_ride_riders
           (club_id, ride_id, member_id, angemeldet_von_profile_id)
         values ('c1ab0000-0000-4000-8000-000000000001',
                 'fa000000-0000-4000-8000-000000000001',
                 'a0000000-0000-4000-8000-000000000010',
                 '90000000-0000-4000-8000-000000000012')$sql$,
    '23514');
end;
$$;
rollback;

-- Katrin versucht, FINN (a-13) einzutragen — nicht ihr Kind, Petras Kind.
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000009","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"member"}}',
  true);
set local role authenticated;

do $$
begin
  -- Maja (a-16) ist weder Katrins Kind noch sie selbst. Bewusst auf fa-01
  -- (1 Platz frei) und mit einer Person, die noch nicht mitfaehrt: sonst
  -- schluege vorher die Kapazitaets- oder die Eindeutigkeitspruefung zu und
  -- der Test bewiese nicht das, was er behauptet (die BERECHTIGUNG).
  perform testkit.throws(
    'Fremde: duerfen ein fremdes Kind NICHT eintragen (42501)',
    $sql$insert into app.event_ride_riders
           (club_id, ride_id, member_id, angemeldet_von_profile_id)
         values ('c1ab0000-0000-4000-8000-000000000001',
                 'fa000000-0000-4000-8000-000000000001',
                 'a0000000-0000-4000-8000-000000000016',
                 '90000000-0000-4000-8000-000000000009')$sql$,
    '42501');

  -- Und sie duerfen auch nicht BEHAUPTEN, jemand anderes habe zugesagt:
  -- angemeldet_von_profile_id muss das eigene Konto sein.
  perform testkit.throws(
    'Niemand kann eine Zusage einem FREMDEN Konto zuschreiben (42501)',
    $sql$insert into app.event_ride_riders
           (club_id, ride_id, member_id, angemeldet_von_profile_id)
         values ('c1ab0000-0000-4000-8000-000000000001',
                 'fa000000-0000-4000-8000-000000000001',
                 'a0000000-0000-4000-8000-000000000007',
                 '90000000-0000-4000-8000-000000000014')$sql$,
    '42501');
end;
$$;
rollback;

-- Zusage einer VOLLEN Fahrt (fa-02, 1/1) — Petra fuer ihr eigenes Kind Finn.
-- Die Berechtigung stimmt, der PLATZ nicht: 23514, nicht 42501.
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000014","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"moderator"}}',
  true);
set local role authenticated;

do $$
begin
  perform testkit.throws(
    'Volle Fahrt: berechtigte Zusage scheitert am PLATZ (23514, nicht 42501)',
    $sql$insert into app.event_ride_riders
           (club_id, ride_id, member_id, angemeldet_von_profile_id)
         values ('c1ab0000-0000-4000-8000-000000000001',
                 'fa000000-0000-4000-8000-000000000002',
                 'a0000000-0000-4000-8000-000000000013',
                 '90000000-0000-4000-8000-000000000014')$sql$,
    '23514');
end;
$$;
rollback;

-- (e2) Der Umweg ueber "Platzzahl senken" ist ebenfalls zu.
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000009","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"member"}}',
  true);
set local role authenticated;

do $$
begin
  perform testkit.throws(
    'Platzzahl kann nicht unter die belegten Plaetze gesenkt werden (23514)',
    $sql$update app.event_rides set plaetze_gesamt = 1
          where id = 'fa000000-0000-4000-8000-000000000001'$sql$,
    '23514');
end;
$$;
rollback;

-- ===========================================================================
-- (d) DIE RUECKRUFNUMMER — rohe SELECT-Proben auf app.event_ride_contacts.
--     Das ist der Kern des Auftrags: kein UI beteiligt, nur die Datenbank.
-- ===========================================================================

-- Sandra (a-01) ist COACH — sie sieht den Termin und die Fahrten, ist aber an
-- KEINER Fahrt beteiligt und nicht Verwaltung. Also: keine einzige Nummer.
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000001","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"coach"}}',
  true);
set local role authenticated;

do $$
begin
  perform testkit.is_eq('Unbeteiligte (coach): sieht die Fahrten ...',
    (select count(*) from app.event_rides
      where event_id = 'e0000000-0000-4000-8000-000000000012'), 2);
  perform testkit.is_eq('... aber KEINE Rueckrufnummer (rohe SELECT-Probe, 0 Zeilen)',
    (select count(*) from app.event_ride_contacts), 0);
end;
$$;
rollback;

-- Katrin ist FAHRERIN von fa-01 und MUTTER der Mitfahrerin Lina auf fa-02 —
-- sie sieht beide Nummern, aber aus zwei verschiedenen Gruenden.
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000009","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"member"}}',
  true);
set local role authenticated;

do $$
begin
  perform testkit.is_eq('Fahrerin: sieht die Nummer der EIGENEN Fahrt (fa-01)',
    (select count(*) from app.event_ride_contacts
      where ride_id = 'fa000000-0000-4000-8000-000000000001'), 1);
  perform testkit.is_eq('Elternteil einer Mitfahrerin: sieht die Nummer der Fahrerin (fa-02)',
    (select count(*) from app.event_ride_contacts
      where ride_id = 'fa000000-0000-4000-8000-000000000002'), 1);
end;
$$;
rollback;

-- Petra (moderator) ist Verwaltung UND Mutter eines Mitfahrers — sie sieht
-- beide. Die Aufsichtspflicht ist ausdruecklich gewollt.
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000014","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"moderator"}}',
  true);
set local role authenticated;

do $$
begin
  perform testkit.is_eq('Verwaltung (moderator): sieht alle Nummern (Aufsichtspflicht)',
    (select count(*) from app.event_ride_contacts), 2);
end;
$$;
rollback;

-- WER ABSAGT, VERLIERT DIE NUMMER. Stefanie ist Mutter der Mitfahrerin Sofia
-- auf fa-01 (sieht die Nummer) — nach der Absage nicht mehr. Sie bleibt die
-- Fahrerin von fa-02 und behaelt DEREN Nummer; genau diese Trennung soll die
-- Probe zeigen.
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000012","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"member"}}',
  true);
set local role authenticated;

do $$
begin
  perform testkit.is_eq('vor der Absage: Elternteil sieht die Nummer von fa-01',
    (select count(*) from app.event_ride_contacts
      where ride_id = 'fa000000-0000-4000-8000-000000000001'), 1);

  update app.event_ride_riders
     set status = 'abgesagt'
   where ride_id = 'fa000000-0000-4000-8000-000000000001'
     and member_id = 'a0000000-0000-4000-8000-000000000010';

  perform testkit.is_eq('nach der Absage: die Nummer von fa-01 ist weg',
    (select count(*) from app.event_ride_contacts
      where ride_id = 'fa000000-0000-4000-8000-000000000001'), 0);
  perform testkit.is_eq('... die eigene Fahrt fa-02 behaelt sie aber',
    (select count(*) from app.event_ride_contacts
      where ride_id = 'fa000000-0000-4000-8000-000000000002'), 1);
  -- Die Absage gibt den Platz frei: fa-01 ist wieder offen.
  perform testkit.is_eq('Absage gibt den Platz frei -> fa-01 wieder offen',
    (select count(*) from app.event_rides
      where id = 'fa000000-0000-4000-8000-000000000001' and status = 'offen'), 1);
end;
$$;
rollback;

-- ===========================================================================
-- MANDANTEN-ISOLATION — der fremde Verein sieht und schreibt nichts.
-- ===========================================================================
begin;
select set_config('request.jwt.claims',
  '{"sub":"90fc0000-0000-4000-8000-000000000002","role":"authenticated","club_roles":{"c1fc0000-0000-4000-8000-000000000001":"owner"}}',
  true);
set local role authenticated;

do $$
begin
  perform testkit.is_eq('Fremder Verein: sieht KEINE Fahrt',
    (select count(*) from app.event_rides), 0);
  perform testkit.is_eq('Fremder Verein: sieht KEINE Mitfahrer',
    (select count(*) from app.event_ride_riders), 0);
  perform testkit.is_eq('Fremder Verein: sieht KEINE Rueckrufnummer',
    (select count(*) from app.event_ride_contacts), 0);

  perform testkit.throws(
    'Fremder Verein: kann keine Fahrt an einen fremden Termin haengen (42501)',
    $sql$insert into app.event_rides
           (club_id, event_id, driver_member_id, abfahrtsort, abfahrtszeit, plaetze_gesamt)
         values ('c1ab0000-0000-4000-8000-000000000001',
                 'e0000000-0000-4000-8000-000000000012',
                 'a0fc0000-0000-4000-8000-000000000001',
                 'Rivalstadt', now() + interval '9 days', 4)$sql$,
    '42501');
end;
$$;
rollback;
