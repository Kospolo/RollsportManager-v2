-- ============================================================================
-- 99e_rsvp_gesundheitsdaten.sql — Art. 9: der Abmeldegrund (rsvp_status 'sick'
-- + Freitext) ist ein Gesundheitsdatum, meist das eines KINDES (Migration 0040).
--
-- DER BEFUND, DEN DIESE DATEI EINFRIERT
-- ---------------------------------------------------------------------------
-- Vor 0040 war event_rsvps_select blank app.is_club_member(club_id) (0003:231)
-- und GET /events lieferte die Zeilen komplett aus: JEDES Vereinsmitglied las,
-- dass Nele Hoffmann (a-20, geb. 2014) 'sick' ist — samt "Erkältung, morgen
-- wieder dabei".
--
-- WER DEN GRUND SEHEN DARF (0040): die Person selbst + Erziehungsberechtigte ·
-- owner/admin · coach/guest_coach des Teams DIESES Mitglieds. Sonst: die Zeile
-- bleibt sichtbar, zeigt aber 'declined' und comment = NULL.
--
-- SEED-BEZUG (club A, c1ab…01):
--   a-20 Nele Hoffmann  'sick' + Freitext auf e-06 (Team b-01 "Minis")
--   a-19               'declined' + "Klassenfahrt bis Freitag" auf e-07 (b-02)
--   Trainer:innen: a-05 Anna-Lena (90..05) -> b-01 + b-02
--                  a-01 Sandra    (90..01) -> b-02 + b-03
--   Katrin (90..09 / a-09) = Mitglied, Mutter von a-07 + a-08. Kein Team-Coach.
--
-- Bestands-Tests bleiben unberuehrt; diese Datei ist NEU.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- A) DER RIEGEL SELBST: der Rohwert ist authenticated entzogen.
--    Ohne diesen Block waere die ganze Maske nur eine Bitte an den naechsten
--    Entwickler. Mit ihm scheitert jeder kuenftige `select status from
--    app.event_rsvps` LAUT (42501), statt still wieder zu lecken.
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000009","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"member"}}',
  true);
set local role authenticated;

do $$
begin
  perform testkit.throws('rsvp-art9: Mitglied darf status auf der Basistabelle NICHT lesen',
    'select status from app.event_rsvps limit 1', '42501');
  perform testkit.throws('rsvp-art9: Mitglied darf comment auf der Basistabelle NICHT lesen',
    'select comment from app.event_rsvps limit 1', '42501');
  perform testkit.throws('rsvp-art9: select * auf der Basistabelle ist versperrt',
    'select * from app.event_rsvps limit 1', '42501');
  -- Der Umweg, gegen den eine reine API-Projektion machtlos waere:
  perform testkit.throws('rsvp-art9: kein Aggregat ueber den Rohstatus (count group by)',
    'select status, count(*) from app.event_rsvps group by status', '42501');
  perform testkit.throws('rsvp-art9: kein Sortieren nach dem Rohstatus',
    'select id from app.event_rsvps order by status', '42501');
  perform testkit.throws('rsvp-art9: kein Filtern auf den Rohstatus (where sick)',
    $q$select id from app.event_rsvps where status = 'sick'$q$, '42501');

  -- ... und was WEITER gehen MUSS, sonst ist der Riegel nur ein Ausfall:
  perform testkit.is_eq('rsvp-art9: count(*) bleibt moeglich (10_tenant_isolation zaehlt so)',
    (select count(*) from app.event_rsvps
      where club_id = 'c1ab0000-0000-4000-8000-000000000001'), 28);
  perform testkit.is_eq('rsvp-art9: die unbedenklichen Spalten bleiben lesbar',
    (select count(*) from app.event_rsvps r
      where r.member_id = 'a0000000-0000-4000-8000-000000000020'), 1);
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- B) DAS LECK SELBST: das normale Mitglied sieht den Grund des fremden Kindes
--    nicht — aber die ZEILE sehr wohl (sonst waere die Luecke der Verraeter).
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000009","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"member"}}',
  true);
set local role authenticated;

do $$
begin
  perform testkit.is_eq('rsvp-art9: Mitglied findet ueber die View KEIN "sick" (0)',
    (select count(*) from app.event_rsvps_visible where status = 'sick'), 0);
  perform testkit.is_eq('rsvp-art9: die Krankmeldung von Nele erscheint als "declined"',
    (select count(*) from app.event_rsvps_visible
      where member_id = 'a0000000-0000-4000-8000-000000000020'
        and event_id  = 'e0000000-0000-4000-8000-000000000006'
        and status    = 'declined'), 1);
  perform testkit.is_eq('rsvp-art9: Neles Freitext ist fuer das Mitglied NULL',
    (select count(*) from app.event_rsvps_visible
      where member_id = 'a0000000-0000-4000-8000-000000000020'
        and comment is not null), 0);

  -- Die Jubilaeums-Falle: die ZEILE muss bleiben. Verschwaende sie, waere die
  -- Luecke in der Antwortliste selbst die Auskunft "der/die ist krank".
  perform testkit.is_eq('rsvp-art9: KEINE Zeile verschwindet (28 wie fuer alle)',
    (select count(*) from app.event_rsvps_visible
      where club_id = 'c1ab0000-0000-4000-8000-000000000001'), 28);
  perform testkit.is_eq('rsvp-art9: die Zeile des kranken Kindes ist da (nur maskiert)',
    (select count(*) from app.event_rsvps_visible
      where member_id = 'a0000000-0000-4000-8000-000000000020'
        and event_id  = 'e0000000-0000-4000-8000-000000000006'), 1);

  -- Der Freitext faellt bei JEDEM Status weg. Nur bei 'sick' zu leeren, waere
  -- die naechste Falle: "declined + comment IS NULL" waere der neue Verraeter,
  -- und Gesundheitsdaten stehen auch in 'declined'-Zeilen (a-19 im Seed).
  perform testkit.is_eq('rsvp-art9: auch der "declined"-Freitext von a-19 ist NULL',
    (select count(*) from app.event_rsvps_visible
      where member_id = 'a0000000-0000-4000-8000-000000000019'
        and comment is not null), 0);
  -- Kein FREMDER Freitext ueberhaupt — nicht nur bei den 'sick'-Zeilen. Genau
  -- das nimmt dem Muster "declined + comment IS NULL" seine Aussagekraft.
  -- (Die eigene Familie a-09/a-07/a-08 ist ausgenommen: das sind ihre Daten.)
  perform testkit.is_eq('rsvp-art9: das Mitglied sieht KEINEN fremden Freitext (kein Verraeter-Muster)',
    (select count(*) from app.event_rsvps_visible
      where comment is not null
        and member_id not in ('a0000000-0000-4000-8000-000000000009',
                              'a0000000-0000-4000-8000-000000000007',
                              'a0000000-0000-4000-8000-000000000008')), 0);

  -- Der harmlose Teil der Auskunft bleibt: die Termin-Zusagen funktionieren.
  perform testkit.is_eq('rsvp-art9: Gegenprobe — "going" bleibt "going" (nichts kaputtmaskiert)',
    (select count(*) from app.event_rsvps_visible
      where event_id = 'e0000000-0000-4000-8000-000000000006' and status = 'going'), 2);
  perform testkit.is_eq('rsvp-art9: Gegenprobe — "maybe" bleibt "maybe"',
    (select count(*) from app.event_rsvps_visible
      where event_id = 'e0000000-0000-4000-8000-000000000006' and status = 'maybe'), 1);
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- C) DIE ERZIEHUNGSBERECHTIGTE: sieht den Grund BEIM EIGENEN KIND.
--    Katrin (90..09) ist Mutter von Lina (a-07). Wir setzen Lina auf 'sick' und
--    lesen als Katrin zurueck. Kein Team-Coach, keine Admin-Rolle — allein die
--    Guardianship traegt.
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000009","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"member"}}',
  true);
set local role authenticated;

update app.event_rsvps
   set status = 'sick', comment = 'Fieber, bleibt zu Hause'
 where event_id  = 'e0000000-0000-4000-8000-000000000007'
   and member_id = 'a0000000-0000-4000-8000-000000000007';

do $$
begin
  perform testkit.is_eq('rsvp-art9: die Mutter SIEHT "sick" beim eigenen Kind',
    (select count(*) from app.event_rsvps_visible
      where member_id = 'a0000000-0000-4000-8000-000000000007'
        and event_id  = 'e0000000-0000-4000-8000-000000000007'
        and status    = 'sick'), 1);
  perform testkit.is_eq('rsvp-art9: die Mutter sieht den Freitext des eigenen Kindes',
    (select count(*) from app.event_rsvps_visible
      where member_id = 'a0000000-0000-4000-8000-000000000007'
        and comment   = 'Fieber, bleibt zu Hause'), 1);
  -- ... und trotzdem NICHT den des fremden Kindes:
  perform testkit.is_eq('rsvp-art9: dieselbe Mutter sieht den Grund von Nele NICHT',
    (select count(*) from app.event_rsvps_visible
      where member_id = 'a0000000-0000-4000-8000-000000000020'
        and (status = 'sick' or comment is not null)), 0);
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- D) DIE TRAINERIN DES TEAMS: sieht den Grund — aber nur in IHREN Teams.
--    Anna-Lena (90..05 / a-05) betreut b-01 (Nele) + b-02, NICHT b-03.
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000005","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"coach"}}',
  true);
set local role authenticated;

do $$
begin
  perform testkit.is_eq('rsvp-art9: die Trainerin von b-01 SIEHT Neles "sick"',
    (select count(*) from app.event_rsvps_visible
      where member_id = 'a0000000-0000-4000-8000-000000000020'
        and event_id  = 'e0000000-0000-4000-8000-000000000006'
        and status    = 'sick'), 1);
  perform testkit.is_eq('rsvp-art9: die Trainerin von b-01 sieht Neles Freitext',
    (select count(*) from app.event_rsvps_visible
      where member_id = 'a0000000-0000-4000-8000-000000000020'
        and comment   = 'Erkältung, morgen wieder dabei'), 1);
  perform testkit.is_eq('rsvp-art9: sie sieht auch den "declined"-Freitext ihres b-02-Kindes (a-19)',
    (select count(*) from app.event_rsvps_visible
      where member_id = 'a0000000-0000-4000-8000-000000000019'
        and comment   = 'Klassenfahrt bis Freitag'), 1);
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- E) DIE FREMDE TRAINERIN: betreut das Team des Kindes NICHT -> maskiert.
--    Sandra (90..01 / a-01) betreut b-02 + b-03. Nele (a-20) ist in b-01.
--    Das ist die Zeile, die "Trainerin = darf alles" von "Trainerin DIESES
--    Teams" unterscheidet.
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000001","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"coach"}}',
  true);
set local role authenticated;

do $$
begin
  perform testkit.is_eq('rsvp-art9: die Trainerin FREMDER Teams sieht Neles Grund NICHT',
    (select count(*) from app.event_rsvps_visible
      where member_id = 'a0000000-0000-4000-8000-000000000020'
        and (status = 'sick' or comment is not null)), 0);
  perform testkit.is_eq('rsvp-art9: sie sieht Neles Zeile aber als "declined" (Zeile bleibt)',
    (select count(*) from app.event_rsvps_visible
      where member_id = 'a0000000-0000-4000-8000-000000000020'
        and status    = 'declined'), 1);
  -- Gegenprobe: in IHREM Team (b-02) sieht dieselbe Person sehr wohl.
  perform testkit.is_eq('rsvp-art9: in ihrem eigenen Team (b-02) sieht sie den Freitext',
    (select count(*) from app.event_rsvps_visible
      where member_id = 'a0000000-0000-4000-8000-000000000019'
        and comment   = 'Klassenfahrt bis Freitag'), 1);
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- F) DIE VERWALTUNG: owner sieht (der Verein muss handlungsfaehig bleiben),
--    moderator/treasurer NICHT (Datenminimierung — bewusst enger als 0021).
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000002","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"owner"}}',
  true);
set local role authenticated;
do $$
begin
  perform testkit.is_eq('rsvp-art9: der Vereinsinhaber sieht den Grund',
    (select count(*) from app.event_rsvps_visible
      where member_id = 'a0000000-0000-4000-8000-000000000020' and status = 'sick'), 1);
end;
$$;
rollback;

begin;
-- Petra Köhler (90..14 / a-14) = moderator
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000014","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"moderator"}}',
  true);
set local role authenticated;
do $$
begin
  perform testkit.is_eq('rsvp-art9: der Moderator sieht den Grund NICHT (Datenminimierung)',
    (select count(*) from app.event_rsvps_visible
      where member_id = 'a0000000-0000-4000-8000-000000000020'
        and (status = 'sick' or comment is not null)), 0);
  perform testkit.is_eq('rsvp-art9: der Moderator sieht nirgends ein "sick"',
    (select count(*) from app.event_rsvps_visible where status = 'sick'), 0);
  -- Petra ist SELBST Mitglied (a-14) und Mutter von a-13. Ihren EIGENEN Freitext
  -- und den ihres Kindes MUSS sie sehen (can_act_for_member, Art. 15) — die
  -- Moderator-Rolle traegt daran nichts bei. Deshalb nicht "keinen Freitext",
  -- sondern: keinen FREMDEN.
  perform testkit.is_eq('rsvp-art9: der Moderator sieht seinen EIGENEN Freitext (eigene Daten)',
    (select count(*) from app.event_rsvps_visible
      where member_id = 'a0000000-0000-4000-8000-000000000014'
        and comment = 'Spätschicht — Protokoll wäre super'), 1);
  perform testkit.is_eq('rsvp-art9: aber KEINEN fremden Freitext (nur die eigene Familie)',
    (select count(*) from app.event_rsvps_visible
      where comment is not null
        and member_id not in ('a0000000-0000-4000-8000-000000000014',
                              'a0000000-0000-4000-8000-000000000013')), 0);
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- G) DER PLATTFORM-ADMIN: app.is_club_member() traegt einen is_platform_admin-
--    Bypass (0025:85-95) — er sieht die ZEILEN jedes Vereins. Den GRUND soll er
--    ausdruecklich NICHT sehen: can_read_rsvp_reason traegt den Bypass nicht.
--    Diese Zeile haelt genau diese Entscheidung fest.
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000099","role":"authenticated","app_metadata":{"is_platform_admin":true}}',
  true);
set local role authenticated;
do $$
begin
  perform testkit.is_eq('rsvp-art9: der Plattform-Admin sieht die Zeilen (Bypass wirkt)',
    (select count(*) from app.event_rsvps_visible
      where club_id = 'c1ab0000-0000-4000-8000-000000000001'), 28);
  perform testkit.is_eq('rsvp-art9: der Plattform-Admin sieht den GRUND trotzdem nicht',
    (select count(*) from app.event_rsvps_visible where status = 'sick'), 0);
  perform testkit.is_eq('rsvp-art9: der Plattform-Admin sieht keinen Freitext',
    (select count(*) from app.event_rsvps_visible where comment is not null), 0);
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- H) MANDANTENTRENNUNG DER MASKE. app.rsvp_masked() ist SECURITY DEFINER und
--    nimmt eine ID entgegen — ohne den is_club_member-Gate darin waere sie ein
--    Mandanten-Spaeher: sie beantwortete die Frage auch fuer eine fremde Zeile
--    und verriete Existenz + groben Status. Unbekannte ID und fremder Mandant
--    muessen UNUNTERSCHEIDBAR NULL liefern.
-- ---------------------------------------------------------------------------
begin;
-- Die fremde ID VOR dem Rollenwechsel besorgen: als authenticated versteckt die
-- RLS sie, v_foreign waere NULL und der Test bestuende nur scheinbar.
select set_config('testkit.foreign_rsvp',
  (select id::text from app.event_rsvps
    where club_id = 'deadbeef-0000-4000-8000-000000000001' limit 1), true);

select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000009","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"member"}}',
  true);
set local role authenticated;

do $$
declare
  v_foreign uuid := nullif(current_setting('testkit.foreign_rsvp', true), '')::uuid;
begin
  -- Selbstkontrolle: ohne eine echte fremde ID prueft der Rest nichts.
  if v_foreign is null then
    perform testkit.fail('rsvp-art9: Fixture — Verein B hat eine RSVP-Zeile zum Pruefen',
      'keine RSVP-Zeile in Verein B gefunden; die folgenden Zusicherungen waeren wertlos');
  end if;
  perform testkit.ok('rsvp-art9: Fixture — Verein B hat eine RSVP-Zeile zum Pruefen');

  perform testkit.is_eq('rsvp-art9: rsvp_masked() verraet eine FREMDE Mandanten-Zeile nicht',
    (select count(*) from (select (app.rsvp_masked(v_foreign)).status as status) t
      where t.status is not null), 0);
  perform testkit.is_eq('rsvp-art9: unbekannte ID liefert dasselbe NULL (ununterscheidbar)',
    (select count(*) from (select (app.rsvp_masked('00000000-0000-4000-8000-0000000000ff')).status as status) t
      where t.status is not null), 0);
  perform testkit.is_eq('rsvp-art9: und die View zeigt Verein B ohnehin keine Zeile (RLS)',
    (select count(*) from app.event_rsvps_visible
      where club_id = 'deadbeef-0000-4000-8000-000000000001'), 0);
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- I) DIE VIEW BLEIBT NUR-LESEN. Geschrieben wird gegen app.event_rsvps, wo die
--    INSERT/UPDATE-Policies (can_act_for_member) greifen. Waere die View
--    beschreibbar, liefe ein Schreibweg an ihnen vorbei.
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000009","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"member"}}',
  true);
set local role authenticated;
do $$
begin
  -- 55000 statt 42501: Postgres lehnt schon VOR der Rechtepruefung ab — die View
  -- ist wegen des lateral join nicht automatisch aktualisierbar. Der REVOKE aus
  -- 0040 ist der zweite Guertel darunter; welcher der beiden zuerst greift, ist
  -- fuer die Zusicherung "kein Schreibweg" gleichgueltig, aber der Test soll
  -- messen, was WIRKLICH passiert, statt sich den schoeneren Code zu wuenschen.
  perform testkit.throws('rsvp-art9: die View ist nicht beschreibbar (kein Schreibweg an der RLS vorbei)',
    $q$update app.event_rsvps_visible set status = 'going'
        where member_id = 'a0000000-0000-4000-8000-000000000020'$q$, '55000');
  perform testkit.throws('rsvp-art9: und auch nicht loeschbar',
    $q$delete from app.event_rsvps_visible$q$, '55000');
  -- Der Riegel darunter, unabhaengig von der Aktualisierbarkeit:
  perform testkit.is_eq('rsvp-art9: authenticated hat auf der View kein INSERT/UPDATE/DELETE',
    (select count(*) from information_schema.role_table_grants
      where table_schema = 'app' and table_name = 'event_rsvps_visible'
        and grantee = 'authenticated'
        and privilege_type in ('INSERT', 'UPDATE', 'DELETE')), 0);
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- J) DER SCHREIBWEG LEBT NOCH. Der Riegel darf die Krankmeldung nicht
--    verhindern — sonst haette ich den Endpunkt nur kaputtgemacht.
--    Genau die Statements aus events.ts (Parameter statt EXCLUDED.*, returning id).
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000009","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"member"}}',
  true);
set local role authenticated;
do $$
begin
  perform testkit.succeeds('rsvp-art9: die Mutter kann ihr Kind weiterhin krankmelden (Upsert wie events.ts)',
    $q$insert into app.event_rsvps (club_id, event_id, member_id, status, comment, responded_at)
       values ('c1ab0000-0000-4000-8000-000000000001','e0000000-0000-4000-8000-000000000007',
               'a0000000-0000-4000-8000-000000000007','sick','Fieber', now())
       on conflict (event_id, member_id) do update
         set status = 'sick'::app.rsvp_status, comment = 'Fieber',
             responded_at = now(), deleted_at = null
       returning id$q$);
  perform testkit.throws('rsvp-art9: der ALTE Upsert mit EXCLUDED.status faellt jetzt (42501) — Beleg fuer die Umstellung in events.ts',
    $q$insert into app.event_rsvps (club_id, event_id, member_id, status, comment, responded_at)
       values ('c1ab0000-0000-4000-8000-000000000001','e0000000-0000-4000-8000-000000000007',
               'a0000000-0000-4000-8000-000000000007','sick','Fieber', now())
       on conflict (event_id, member_id) do update
         set status = excluded.status, comment = excluded.comment$q$, '42501');
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- K) Der Vertrag bleibt: 'sick' wird NICHT aus dem Enum gestrichen (sonst
--    braeuchte es einen Contract-Bruch in TS/Swift/Kotlin) — es wird nur
--    weniger Leuten gezeigt. Und es wird weiterhin GESPEICHERT.
-- ---------------------------------------------------------------------------
begin;
do $$
begin
  perform testkit.is_eq('rsvp-art9: der Enum-Wert "sick" existiert unveraendert weiter (kein Contract-Bruch)',
    (select count(*) from pg_enum e join pg_type t on t.oid = e.enumtypid
      join pg_namespace n on n.oid = t.typnamespace
      where n.nspname = 'app' and t.typname = 'rsvp_status' and e.enumlabel = 'sick'), 1);
  perform testkit.is_eq('rsvp-art9: die Krankmeldung wird weiterhin echt gespeichert (service_role sieht sie)',
    (select count(*) from app.event_rsvps where status = 'sick'), 1);
end;
$$;
rollback;
