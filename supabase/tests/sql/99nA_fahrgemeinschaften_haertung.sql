-- ============================================================================
-- 99nA_fahrgemeinschaften_haertung.sql — die drei Loecher aus 0066, zugenagelt
-- (Migration 0067).
--
-- Diese Suite weicht 99n NICHT auf; sie haengt die drei Faelle an, die 99n
-- nicht gestellt hat. Jeder ist ein Angriff, der VOR 0067 durchging:
--
--   (1) KINDERSCHUTZ. Der Vormund sagt sein Kind in einer FREMDEN Fahrt ab —
--       danach traegt die FAHRERIN das Kind eigenmaechtig wieder ein. Das ist
--       die Zuordnung Kind <-> fremde:r Erwachsene:r ohne Zutun des Vormunds.
--       Vorher: ging durch (die weite UPDATE-Policy). Jetzt: 42501.
--       Gegenprobe: der Vormund selbst darf es weiterhin.
--   (2) DIE RUECKRUFNUMMER LAESST SICH ZURUECKZIEHEN. Vorher fehlte die
--       DELETE-Policy; ein DELETE unter RLS traf deshalb NULL Zeilen, ohne zu
--       scheitern — die Nummer stand roh weiter in der DB. Geprueft wird ROH
--       (Superuser, RLS aus), nicht durch die Brille der Loeschenden.
--   (3) UMHAENGEN AUF EINEN UNLESBAREN TERMIN scheitert.
--
-- Bezug: dieselbe Seed-Lage wie 99n.
--   fa-01: Fahrerin Katrin (a-09), 3 Plaetze, Mitfahrer Sofia (a-10) + Finn (a-13).
--   fa-02: Fahrerin STEFANIE (a-12), 1 Platz, Mitfahrerin LINA (a-07) —
--          Lina ist KATRINS Kind (Vormundschaft im Seed), Stefanie ist ihr
--          gegenueber eine Fremde. Genau dieses Dreieck ist der Angriff.
-- ============================================================================

-- ===========================================================================
-- (1) KINDERSCHUTZ — die Fahrerin darf eine abgesagte Zusage NICHT reaktivieren.
-- ===========================================================================

-- Ausgangslage: Katrin (Vormund von Lina) sagt Lina in Stefanies Fahrt ab.
-- Bewusst PERSISTENT (commit), damit der Angriff in der naechsten Transaktion
-- auf einer echten abgesagten Zeile ansetzt — genau so lief er in der API.
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000009","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"member"}}',
  true);
set local role authenticated;

do $$
begin
  update app.event_ride_riders
     set status = 'abgesagt'
   where ride_id = 'fa000000-0000-4000-8000-000000000002'
     and member_id = 'a0000000-0000-4000-8000-000000000007';

  perform testkit.is_eq('Vormund: darf das EIGENE Kind absagen (fa-02, Lina)',
    (select count(*) from app.event_ride_riders
      where ride_id = 'fa000000-0000-4000-8000-000000000002'
        and member_id = 'a0000000-0000-4000-8000-000000000007'
        and status = 'abgesagt'), 1);
end;
$$;
commit;

-- Der Angriff. Stefanie ist FAHRERIN von fa-02 und Linas gegenueber eine
-- Fremde: app.can_act_for_member(Lina) ist fuer sie falsch.
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000012","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"member"}}',
  true);
set local role authenticated;

do $$
begin
  -- Die Voraussetzung des Angriffs, ausdruecklich belegt: sie ist wirklich
  -- nicht berechtigt. Ohne diese Zeile bewiese der Rest nur, dass irgendetwas
  -- scheitert — nicht, dass die BERECHTIGUNG die Ursache ist.
  perform testkit.is_eq('Fahrerin Stefanie ist fuer Lina NICHT handlungsbefugt',
    (select case when app.can_act_for_member('a0000000-0000-4000-8000-000000000007') then 1 else 0 end), 0);

  -- (I) Der belegte Weg: der Wiederbelebungs-Zweig von POST /rides/{id}/riders.
  perform testkit.throws(
    'Fahrerin: kann eine vom Vormund abgesagte Zusage eines FREMDEN Kindes NICHT reaktivieren (42501)',
    $sql$update app.event_ride_riders
            set status = 'zugesagt', deleted_at = null
          where ride_id = 'fa000000-0000-4000-8000-000000000002'
            and member_id = 'a0000000-0000-4000-8000-000000000007'$sql$,
    '42501');

  -- (II) Dieselbe Tuer, andere Klinke: PATCH auf die Zusage.
  perform testkit.throws(
    'Fahrerin: kann die Zusage auch ueber den Austragen-Endpunkt nicht zurueckdrehen (42501)',
    $sql$update app.event_ride_riders
            set status = 'zugesagt'
          where ride_id = 'fa000000-0000-4000-8000-000000000002'
            and member_id = 'a0000000-0000-4000-8000-000000000007'$sql$,
    '42501');

  -- (III) Der Umweg ueber die Felder: eine EIGENE, harmlose Zusage anlegen und
  --       sie danach auf ein fremdes Kind umschreiben. Waere member_id
  --       aenderbar, waere die enge INSERT-Pruefung ein Einmal-Riegel.
  insert into app.event_ride_riders
    (id, club_id, ride_id, member_id, angemeldet_von_profile_id)
  values ('11170000-0000-4000-8000-000000000001',
          'c1ab0000-0000-4000-8000-000000000001',
          'fa000000-0000-4000-8000-000000000001',
          'a0000000-0000-4000-8000-000000000011',   -- Ben, ihr EIGENES Kind
          '90000000-0000-4000-8000-000000000012');

  perform testkit.throws(
    'Niemand kann die mitfahrende Person einer bestehenden Zusage austauschen (42501)',
    $sql$update app.event_ride_riders
            set member_id = 'a0000000-0000-4000-8000-000000000016'
          where id = '11170000-0000-4000-8000-000000000001'$sql$,
    '42501');

  -- (IV) Und der Nachweis, WER zugesagt hat, ist kein Feld zum Ueberschreiben.
  perform testkit.throws(
    'Niemand kann nachtraeglich umschreiben, WER die Zusage erklaert hat (42501)',
    $sql$update app.event_ride_riders
            set angemeldet_von_profile_id = '90000000-0000-4000-8000-000000000009'
          where id = '11170000-0000-4000-8000-000000000001'$sql$,
    '42501');
end;
$$;
rollback;

-- Die Fahrerin behaelt ihr GEDACHTES Recht: austragen, wenn das Auto ausfaellt.
-- Ohne diese Probe waere der Fix eine Funktionsverschlechterung.
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000009","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"member"}}',
  true);
set local role authenticated;

do $$
begin
  -- Katrin ist Fahrerin von fa-01; Finn (a-13) ist PETRAS Kind, nicht ihres.
  update app.event_ride_riders
     set status = 'abgesagt'
   where ride_id = 'fa000000-0000-4000-8000-000000000001'
     and member_id = 'a0000000-0000-4000-8000-000000000013';

  perform testkit.is_eq('Fahrerin: darf ein fremdes Kind weiterhin AUSTRAGEN (Auto faellt aus)',
    (select count(*) from app.event_ride_riders
      where ride_id = 'fa000000-0000-4000-8000-000000000001'
        and member_id = 'a0000000-0000-4000-8000-000000000013'
        and status = 'abgesagt'), 1);

  -- ... aber den Weg zurueck geht sie nicht.
  perform testkit.throws(
    'Fahrerin: darf das ausgetragene fremde Kind NICHT wieder eintragen (42501)',
    $sql$update app.event_ride_riders
            set status = 'zugesagt'
          where ride_id = 'fa000000-0000-4000-8000-000000000001'
            and member_id = 'a0000000-0000-4000-8000-000000000013'$sql$,
    '42501');
end;
$$;
rollback;

-- GEGENPROBE: der VORMUND selbst darf die abgesagte Zusage wieder aktivieren.
-- Das ist die Zusage, die der Fix nicht kaputtmachen darf.
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000009","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"member"}}',
  true);
set local role authenticated;

do $$
begin
  update app.event_ride_riders
     set status = 'zugesagt', deleted_at = null
   where ride_id = 'fa000000-0000-4000-8000-000000000002'
     and member_id = 'a0000000-0000-4000-8000-000000000007';

  perform testkit.is_eq('Vormund: darf sein Kind selbst wieder eintragen (der Fix sperrt ihn NICHT aus)',
    (select count(*) from app.event_ride_riders
      where ride_id = 'fa000000-0000-4000-8000-000000000002'
        and member_id = 'a0000000-0000-4000-8000-000000000007'
        and status = 'zugesagt'), 1);
end;
$$;
rollback;

-- Und die Verwaltung darf es auch (Telefon-Anmeldung, Aufsicht) — sonst haette
-- der Fix den dokumentierten Vorstandsweg mit abgeraeumt.
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000014","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"moderator"}}',
  true);
set local role authenticated;

do $$
begin
  update app.event_ride_riders
     set status = 'zugesagt', deleted_at = null
   where ride_id = 'fa000000-0000-4000-8000-000000000002'
     and member_id = 'a0000000-0000-4000-8000-000000000007';

  perform testkit.is_eq('Verwaltung: darf eine abgesagte Zusage wieder aktivieren',
    (select count(*) from app.event_ride_riders
      where ride_id = 'fa000000-0000-4000-8000-000000000002'
        and member_id = 'a0000000-0000-4000-8000-000000000007'
        and status = 'zugesagt'), 1);
end;
$$;
rollback;

-- Aufraeumen: die persistente Absage aus dem Ausgangszustand zuruecknehmen,
-- damit diese Suite den Seed so hinterlaesst, wie sie ihn vorgefunden hat.
begin;
select set_config('request.jwt.claims', '', true);
update app.event_ride_riders
   set status = 'zugesagt'
 where ride_id = 'fa000000-0000-4000-8000-000000000002'
   and member_id = 'a0000000-0000-4000-8000-000000000007';
commit;

-- ===========================================================================
-- (2) DIE RUECKRUFNUMMER LAESST SICH WIRKLICH ZURUECKZIEHEN.
--
-- Der Beweis muss ROH gefuehrt werden. Ein `select count(*)` unter der
-- Identitaet der Loeschenden bewiese nichts: die SELECT-Policy koennte die
-- Zeile ausblenden, waehrend sie in Wahrheit noch dasteht — genau die
-- Verwechslung, aus der der Defekt bestand.
-- ===========================================================================

-- Stefanie ist Fahrerin von fa-02 und zieht ihre eigene Nummer zurueck.
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000012","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"member"}}',
  true);
set local role authenticated;

do $$
begin
  perform testkit.is_eq('vorher: die Nummer von fa-02 steht da',
    (select count(*) from app.event_ride_contacts
      where ride_id = 'fa000000-0000-4000-8000-000000000002'), 1);

  delete from app.event_ride_contacts
   where ride_id = 'fa000000-0000-4000-8000-000000000002';
end;
$$;
reset role;
select set_config('request.jwt.claims', '', true);

do $$
begin
  -- ROHE Probe, RLS aus: die Zeile ist wirklich weg, nicht nur unsichtbar.
  perform testkit.is_eq('Fahrerin: die zurueckgezogene Nummer ist ROH aus der DB verschwunden',
    (select count(*) from app.event_ride_contacts
      where ride_id = 'fa000000-0000-4000-8000-000000000002'), 0);
  -- Die Fahrt selbst bleibt bestehen — geloescht wird der Kontakt, nicht das Angebot.
  perform testkit.is_eq('... die Fahrt selbst bleibt bestehen',
    (select count(*) from app.event_rides
      where id = 'fa000000-0000-4000-8000-000000000002'), 1);
end;
$$;
rollback;

-- Die Verwaltung darf es ebenfalls (dasselbe Praedikat wie beim Aendern).
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000014","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"moderator"}}',
  true);
set local role authenticated;
delete from app.event_ride_contacts where ride_id = 'fa000000-0000-4000-8000-000000000001';
reset role;
select set_config('request.jwt.claims', '', true);

do $$
begin
  perform testkit.is_eq('Verwaltung: darf eine Nummer entfernen (roh geprueft)',
    (select count(*) from app.event_ride_contacts
      where ride_id = 'fa000000-0000-4000-8000-000000000001'), 0);
end;
$$;
rollback;

-- ... aber das Loeschrecht ist NICHT jedem gegeben, der die Nummer SEHEN darf.
-- Katrin ist Mutter der Mitfahrerin Lina auf fa-02: sie sieht die Nummer der
-- Fahrerin (99n belegt das) — entfernen darf sie sie nicht. Sonst koennte ein
-- beliebiger Mitfahrer den Kontakt der Fahrerin loeschen.
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000009","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"member"}}',
  true);
set local role authenticated;

do $$
begin
  perform testkit.is_eq('Elternteil einer Mitfahrerin: SIEHT die Nummer von fa-02',
    (select count(*) from app.event_ride_contacts
      where ride_id = 'fa000000-0000-4000-8000-000000000002'), 1);
  delete from app.event_ride_contacts where ride_id = 'fa000000-0000-4000-8000-000000000002';
end;
$$;
reset role;
select set_config('request.jwt.claims', '', true);

do $$
begin
  perform testkit.is_eq('... darf sie aber NICHT loeschen (roh: steht noch da)',
    (select count(*) from app.event_ride_contacts
      where ride_id = 'fa000000-0000-4000-8000-000000000002'), 1);
end;
$$;
rollback;

-- ===========================================================================
-- (3) UMHAENGEN AUF EINEN TERMIN, DEN DIE FAHRERIN NICHT LESEN DARF.
--
-- Gebraucht wird ein Termin im selben Verein, den Katrin NICHT sehen darf. Der
-- Seed hat dafuer nichts Sicheres — also wird einer angelegt: Zielgruppe
-- 'teams' OHNE zugeordnetes Team. app.can_read_event (0050) kennt genau drei
-- Wege zu so einem Termin (audience='club', Verwaltungsrolle, Team-Bezug ueber
-- can_act_for_member) — hier trifft keiner zu, und zwar aus dem Aufbau des
-- Termins heraus, nicht aus einer Zufallslage des Seeds. Die Voraussetzung
-- wird trotzdem ausdruecklich geprueft, bevor der Angriff laeuft: sonst bewiese
-- ein Fehlschlag nur, dass irgendetwas fehlschlaegt.
-- ===========================================================================
begin;
select set_config('request.jwt.claims', '', true);

insert into app.events (id, club_id, title, starts_at, ends_at, audience)
values ('e0670000-0000-4000-8000-000000000001',
        'c1ab0000-0000-4000-8000-000000000001',
        'Interne Sitzung 0067', now() + interval '30 days', now() + interval '30 days 2 hours',
        'teams');

select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000009","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"member"}}',
  true);
set local role authenticated;

do $$
begin
  perform testkit.is_eq('Voraussetzung: Katrin darf den Termin e-0067 NICHT lesen',
    (select case when app.can_read_event('e0670000-0000-4000-8000-000000000001') then 1 else 0 end), 0);

  -- Ihre eigene Fahrt bearbeiten darf sie weiterhin — nur nicht dorthin.
  update app.event_rides set abfahrtsort = 'Neuer Treffpunkt'
   where id = 'fa000000-0000-4000-8000-000000000001';
  perform testkit.is_eq('Fahrerin: darf ihre Fahrt weiterhin bearbeiten',
    (select count(*) from app.event_rides
      where id = 'fa000000-0000-4000-8000-000000000001'
        and abfahrtsort = 'Neuer Treffpunkt'), 1);

  perform testkit.throws(
    'Fahrerin: kann ihre Fahrt NICHT an einen fuer sie unlesbaren Termin haengen (42501)',
    $sql$update app.event_rides
            set event_id = 'e0670000-0000-4000-8000-000000000001'
          where id = 'fa000000-0000-4000-8000-000000000001'$sql$,
    '42501');
end;
$$;
rollback;
