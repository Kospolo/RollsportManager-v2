-- ============================================================================
-- 99q_betreiber_zweckbindung.sql — die Zweckbindung des Betreibers, VOLLSTAENDIG
-- (Migrationen 0074 + 0075).
--
-- 99e beweist, dass die Betreiber-Einsicht (0051) ueberhaupt anspringt und
-- protokolliert wird. DIESE Suite beweist das Gegenstueck: dass sie NUR in den
-- freigegebenen Zwecken wirkt — und zwar an JEDER Tuer, nicht nur an denen, an
-- die 0074 gedacht hat.
--
-- Gemessen wird durchgehend der ECHTE Betriebszustand:
--     Plattform-Claim  UND  set_config('app.operator_override','on')
-- Genau das setzt services/api/src/middleware/operator-access.ts vor jedem
-- Request eines Plattform-Tokens. Ein Test, der nur den Claim setzt, misst am
-- laufenden System vorbei — daran ist hier schon einmal ein Test gescheitert.
--
-- Persona: 90000000-…-090 (kein club_members-Eintrag), Verein A = c1ab0000-…-01.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. DIE TUEREN AUS DEM BEFUND — jede einzeln, mit Gegenprobe.
--
--    Vorher (gemessen im Harness, Seed-Stand, VOR 0075):
--      lockers 8 · guardianships 5 · checkins 4 · member_assessments 4 ·
--      chat_messages 5 · documents 3 · media_assets 8 · gallery_items 4 ·
--      attendance 11 · locker_has_active_rental = true fuer 4 Faecher
--    Von den 4 Faechern mit Mieter:in gehoeren DREI Minderjaehrigen — mit Preis.
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000090","role":"authenticated","app_metadata":{"is_platform_admin":true}}',
  true);
select set_config('app.operator_override', 'on', true);
set local role authenticated;

do $$
begin
  -- Vorbedingung: die Einsicht IST eingeschaltet. Ohne diese Zeile koennte die
  -- ganze Suite gruen sein, weil der Betreiber gar nicht erst angetreten ist.
  perform testkit.is_eq('0075/Vorbedingung: operator_override() ist true (echter Zustand)',
    (select case when app.operator_override() then 1 else 0 end), 1);

  -- SCHLIESSFAECHER — „welches Kind mietet welches Fach fuer wie viel Geld".
  perform testkit.is_eq('0075/Schliessfaecher: GET /lockers zeigt 0 Faecher (war 8)',
    (select count(*) from app.lockers), 0);
  perform testkit.is_eq('0075/Schliessfaecher: kein Mieter, kein Preis rekonstruierbar',
    (select count(*) from app.lockers where assigned_member_id is not null
                                         or price_per_month_cents is not null), 0);
  perform testkit.is_eq('0075/Schliessfaecher: locker_rentals bleibt zu (0074)',
    (select count(*) from app.locker_rentals), 0);
  -- Die SECURITY-DEFINER-Meldung an der RLS vorbei: sie beantwortete die Frage
  -- „laeuft hier eine Vermietung" auch dem, dem 0074 die Miettabelle gerade
  -- verschlossen hatte. Zusammen mit lockers_select war das der zweite
  -- Baustein desselben Befundes.
  perform testkit.is_eq('0075/Schliessfaecher: locker_has_active_rental meldet nicht mehr an der RLS vorbei',
    (select count(*) from app.lockers l where app.locker_has_active_rental(l.id)), 0);

  -- VORMUNDSCHAFTEN — „welches Elternteil gehoert zu welchem Kind".
  perform testkit.is_eq('0075/Vormundschaften: 0 Zeilen (war 5)',
    (select count(*) from app.guardianships), 0);

  -- CHECK-INS und ANWESENHEIT — das Bewegungsprofil.
  perform testkit.is_eq('0075/Check-ins: 0 Zeilen (war 4)',
    (select count(*) from app.checkins), 0);
  perform testkit.is_eq('0075/Anwesenheit: 0 Zeilen (war 11)',
    (select count(*) from app.attendance), 0);

  -- BEURTEILUNGEN und interne NOTIZEN — der volle Text ueber ein Kind.
  perform testkit.is_eq('0075/Beurteilungen: 0 Zeilen (war 4)',
    (select count(*) from app.member_assessments), 0);
  perform testkit.is_eq('0074/Trainer-Notizen: bleiben bei 0',
    (select count(*) from app.member_coach_notes), 0);

  -- KOMMUNIKATION und INHALTE, oft mit Kinderfotos.
  perform testkit.is_eq('0075/Chat: 0 Nachrichten (war 5)',
    (select count(*) from app.chat_messages), 0);
  perform testkit.is_eq('0075/Dokumente: 0 (war 3)',       (select count(*) from app.documents), 0);
  perform testkit.is_eq('0075/Medien: 0 (war 8)',          (select count(*) from app.media_assets), 0);
  perform testkit.is_eq('0075/Galerie: 0 (war 4)',         (select count(*) from app.gallery_items), 0);
  perform testkit.is_eq('0075/Foto-Markierungen: 0',       (select count(*) from app.photo_tags), 0);

  -- WEITERE PERSONENBEZOGENE FLAECHEN (2. Runde, ueber die Zaehlschleife unten
  -- gefunden — nicht durch Nachdenken).
  perform testkit.is_eq('0075/Rueckmeldungen zu Terminen: 0', (select count(*) from app.event_rsvps), 0);
  perform testkit.is_eq('0075/Erfolge: 0',                    (select count(*) from app.achievements), 0);
  perform testkit.is_eq('0075/Wettkampf-Meldungen: 0',        (select count(*) from app.competition_entries), 0);
  perform testkit.is_eq('0075/Material-Reservierungen: 0',    (select count(*) from app.equipment_reservations), 0);
  perform testkit.is_eq('0075/Hallenbuchungen: 0',            (select count(*) from app.facility_bookings), 0);
  perform testkit.is_eq('0075/Fahrgemeinschaften (Angebote): 0', (select count(*) from app.event_rides), 0);
  perform testkit.is_eq('0075/Fahrgemeinschaften (Mitfahrer): 0', (select count(*) from app.event_ride_riders), 0);
  perform testkit.is_eq('0075/Rueckrufnummern: 0',            (select count(*) from app.event_ride_contacts), 0);
  perform testkit.is_eq('0075/Aufgaben: 0',                   (select count(*) from app.tasks), 0);
  perform testkit.is_eq('0075/Pflichtstunden-Soll: 0',        (select count(*) from app.duty_requirements), 0);
  perform testkit.is_eq('0075/Pflichtstunden-Eintraege: 0',   (select count(*) from app.duty_entries), 0);
  perform testkit.is_eq('0075/Wartelisten: 0',                (select count(*) from app.waitlists), 0);
  perform testkit.is_eq('0075/Einwilligungen: 0',             (select count(*) from app.consents), 0);
  perform testkit.is_eq('0075/Familien-Nachlaesse: 0',        (select count(*) from app.family_discounts), 0);
  perform testkit.is_eq('0075/Einladungen: 0',                (select count(*) from app.invitations), 0);

  -- DIE ZWECKGEBUNDENEN HELFER sagen dasselbe wie die Policies darueber.
  perform testkit.is_eq('0075/Helfer: can_read_attendance(Kind) = false',
    (select case when app.can_read_attendance('c1ab0000-0000-4000-8000-000000000001',
              (select id from app.club_members where club_id='c1ab0000-0000-4000-8000-000000000001'
                 and deleted_at is null order by id limit 1)) then 1 else 0 end), 0);
  perform testkit.is_eq('0075/Helfer: can_manage_finance bleibt false (0074)',
    (select case when app.can_manage_finance('c1ab0000-0000-4000-8000-000000000001') then 1 else 0 end), 0);
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- 2. DER BETRIEB LEBT — was 0051/0074 dem Betreiber ausdruecklich lassen.
--    Ohne diesen Block waere die Migration nicht „Zweckbindung", sondern
--    „Abschaltung", und der naechste Support-Fall waere unbearbeitbar.
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000090","role":"authenticated","app_metadata":{"is_platform_admin":true}}',
  true);
select set_config('app.operator_override', 'on', true);
set local role authenticated;

do $$
begin
  -- STAMMDATEN ('members'): ohne sie ist kein gemeldeter Fehler bearbeitbar.
  perform testkit.is_eq('0075/Betrieb: der Roster ist weiterhin sichtbar',
    (select case when count(*) > 0 then 1 else 0 end from app.club_members
      where club_id = 'c1ab0000-0000-4000-8000-000000000001'), 1);
  perform testkit.is_eq('0075/Betrieb: cap_rank(members) unveraendert 5',
    (select app.cap_rank('c1ab0000-0000-4000-8000-000000000001', 'members')), 5);

  -- RECHTE ('roles') — der haeufigste Support-Fall.
  perform testkit.is_eq('0075/Betrieb: cap_rank(roles) unveraendert 5',
    (select app.cap_rank('c1ab0000-0000-4000-8000-000000000001', 'roles')), 5);
  perform testkit.is_eq('0075/Betrieb: can_change_member_role(owner) weiterhin true',
    (select case when app.can_change_member_role('c1ab0000-0000-4000-8000-000000000001','owner') then 1 else 0 end), 1);

  -- VEREINSEINSTELLUNGEN / MODULE / LIZENZ ('club_settings').
  perform testkit.is_eq('0075/Betrieb: is_club_admin weiterhin true',
    (select case when app.is_club_admin('c1ab0000-0000-4000-8000-000000000001') then 1 else 0 end), 1);
  perform testkit.is_eq('0075/Betrieb: die Modulschalter sind lesbar',
    (select case when count(*) > 0 then 1 else 0 end from app.club_modules), 1);
  perform testkit.is_eq('0075/Betrieb: is_club_pro (Lizenz) weiterhin true',
    (select case when app.is_club_pro('c1ab0000-0000-4000-8000-000000000001') then 1 else 0 end), 1);

  -- STRUKTUR ('teams','departments','team_coaches').
  perform testkit.is_eq('0075/Betrieb: Teams sichtbar',
    (select case when count(*) > 0 then 1 else 0 end from app.teams), 1);
  perform testkit.is_eq('0075/Betrieb: Sparten sichtbar',
    (select case when count(*) > 0 then 1 else 0 end from app.sparten), 1);
  perform testkit.is_eq('0075/Betrieb: can_manage_sparten weiterhin true',
    (select case when app.can_manage_sparten('c1ab0000-0000-4000-8000-000000000001') then 1 else 0 end), 1);

  -- KUEREN-MODERATION ('routines','routines_edit') — von 0051 zugesagt.
  perform testkit.is_eq('0075/Betrieb: alle Kueren des Vereins lesbar',
    (select count(*) filter (where app.can_read_routine(r.id)) from app.routines r where r.deleted_at is null),
    (select count(*) from app.routines r where r.deleted_at is null));
  perform testkit.is_eq('0075/Betrieb: cap_rank(routines) unveraendert 5',
    (select app.cap_rank('c1ab0000-0000-4000-8000-000000000001', 'routines')), 5);

  -- JUBILAEEN ('anniversaries') — von 0051 zugesagt, in 99e gemessen.
  perform testkit.is_eq('0075/Betrieb: cap_rank(anniversaries) unveraendert 5',
    (select app.cap_rank('c1ab0000-0000-4000-8000-000000000001', 'anniversaries')), 5);

  -- DER ANSEHEN-WEG: das Protokoll bleibt fuer den Betreiber lesbar.
  -- (Geschrieben wird es im Service-Modus; 99e prueft append-only.)
  perform testkit.is_eq('0075/Betrieb: das eigene Betreiber-Protokoll ist lesbar',
    (select case when count(*) >= 0 then 1 else 0 end from app.operator_audit_log), 1);
  -- Und die Allowlist selbst — der Verein muss sehen koennen, was sein
  -- Auftragsverarbeiter DARF (Art. 28 Abs. 3 lit. h).
  perform testkit.is_eq('0075/Betrieb: die Allowlist ist lesbar und hat 9 Zeilen',
    (select count(*) from app.operator_capabilities), 9);
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- 3. DER CLAIM ALLEIN BEWIRKT JETZT AUCH IN DEN ALTEN ZWEIGEN NICHTS.
--
--    Das ist die zweite Haelfte von 0075 und war VOR ihr messbar falsch:
--    ohne die Sitzungsvariable — also ohne den Weg, an dem das Protokoll
--    haengt — sah derselbe Claim 8 Schliessfaecher und 24 Mitglieder.
--    Diese Zweige waren aelter als 0051 und umgingen dessen Kopplung
--    „kein Einblick ohne Nachweis" in der Datenbank vollstaendig.
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000090","role":"authenticated","app_metadata":{"is_platform_admin":true}}',
  true);
-- KEINE Sitzungsvariable: die Middleware hat (noch) nicht protokolliert.
set local role authenticated;

do $$
begin
  perform testkit.is_eq('0075/Claim allein: is_platform_admin() ist true …',
    (select case when app.is_platform_admin() then 1 else 0 end), 1);
  perform testkit.is_eq('0075/Claim allein: … operator_override() aber false',
    (select case when app.operator_override() then 1 else 0 end), 0);

  perform testkit.is_eq('0075/Claim allein: Schliessfaecher 0 (waren 8)',
    (select count(*) from app.lockers), 0);
  perform testkit.is_eq('0075/Claim allein: Roster 0 (waren 24)',
    (select count(*) from app.club_members), 0);
  perform testkit.is_eq('0075/Claim allein: Modulschalter 0 (waren 3)',
    (select count(*) from app.club_modules), 0);
  perform testkit.is_eq('0075/Claim allein: is_club_member false (war true)',
    (select case when app.is_club_member('c1ab0000-0000-4000-8000-000000000001') then 1 else 0 end), 0);
  perform testkit.is_eq('0075/Claim allein: can_manage_sparten false (war true)',
    (select case when app.can_manage_sparten('c1ab0000-0000-4000-8000-000000000001') then 1 else 0 end), 0);
  perform testkit.is_eq('0075/Claim allein: keine Kuer lesbar (waren alle)',
    (select count(*) filter (where app.can_read_routine(r.id)) from app.routines r where r.deleted_at is null), 0);

  -- STRIKT false, nicht NULL — dieselbe Falle wie in 0051: 14 Schutztrigger
  -- negieren diese Helfer, und 'if not NULL then' ist in plpgsql nie wahr.
  perform testkit.is_eq('0075/Claim allein: is_club_member ist strikt FALSE, nicht NULL',
    (select case when app.is_club_member('c1ab0000-0000-4000-8000-000000000001') is null then 1 else 0 end), 0);
  perform testkit.is_eq('0075/Claim allein: club_membership_held ist strikt FALSE, nicht NULL',
    (select case when app.club_membership_held('c1ab0000-0000-4000-8000-000000000001') is null then 1 else 0 end), 0);
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- 4. DAS VEREINSLEBEN AENDERT SICH UM KEIN BISSCHEN.
--    Ohne diese Gegenprobe waere 0075 nicht „Zweckbindung", sondern koennte
--    genauso gut ein kaputtes Praedikat sein, das ALLEN etwas wegnimmt.
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claims',
  (select json_build_object('sub', m.profile_id, 'role', 'authenticated')::text
   from app.club_members m
   where m.club_id = 'c1ab0000-0000-4000-8000-000000000001'
     and m.role = 'owner' and m.profile_id is not null and m.deleted_at is null
   limit 1), true);
set local role authenticated;

do $$
begin
  perform testkit.is_eq('0075/Gegenprobe Inhaber: operator_override() false',
    (select case when app.operator_override() then 1 else 0 end), 0);
  perform testkit.is_eq('0075/Gegenprobe Inhaber: sieht die Schliessfaecher (8)',
    (select count(*) from app.lockers), 8);
  perform testkit.is_eq('0075/Gegenprobe Inhaber: sieht die Vermietungen (5)',
    (select count(*) from app.locker_rentals), 5);
  perform testkit.is_eq('0075/Gegenprobe Inhaber: locker_has_active_rental meldet weiterhin',
    (select count(*) from app.lockers l where app.locker_has_active_rental(l.id)), 4);
  perform testkit.is_eq('0075/Gegenprobe Inhaber: sieht die Vormundschaften (5)',
    (select count(*) from app.guardianships), 5);
  perform testkit.is_eq('0075/Gegenprobe Inhaber: sieht die Check-ins (4)',
    (select count(*) from app.checkins), 4);
  perform testkit.is_eq('0075/Gegenprobe Inhaber: sieht die Beurteilungen (4)',
    (select count(*) from app.member_assessments), 4);
  perform testkit.is_eq('0075/Gegenprobe Inhaber: sieht die Anwesenheit (11)',
    (select count(*) from app.attendance), 11);
  perform testkit.is_eq('0075/Gegenprobe Inhaber: sieht Medien (8) und Galerie (4)',
    (select count(*) from app.media_assets) + (select count(*) from app.gallery_items), 12);
end;
$$;
rollback;

-- Und nach unten: ein einfaches Mitglied sieht weiterhin genau seine eigenen
-- Zeilen — nicht mehr (das waere ein Leck) und nicht weniger (das waere eine
-- Regression durch club_membership_held).
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000009","role":"authenticated"}', true);
set local role authenticated;

do $$
begin
  perform testkit.is_eq('0075/Gegenprobe Mitglied: sieht NUR das eigene Fach',
    (select count(*) from app.lockers), 1);
  perform testkit.is_eq('0075/Gegenprobe Mitglied: sieht die eigene Familie (2)',
    (select count(*) from app.guardianships), 2);
  perform testkit.is_eq('0075/Gegenprobe Mitglied: sieht den eigenen Check-in (1)',
    (select count(*) from app.checkins), 1);
  perform testkit.is_eq('0075/Gegenprobe Mitglied: sieht die eigenen Beurteilungen (2)',
    (select count(*) from app.member_assessments), 2);
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- 5. DIE ZAEHLSCHLEIFE — der Grund, warum die NAECHSTE Tuer nicht wieder erst
--    einem Angreifer auffaellt.
--
--    Die Allowlist ist fuer FAEHIGKEITEN fail-closed (0074): eine neue
--    Faehigkeit ist automatisch gesperrt. Fuer TABELLEN gilt das nicht — wer
--    morgen eine Tabelle mit einer Policy 'app.is_club_member(club_id)' anlegt,
--    oeffnet sie dem Betreiber, ohne dass irgendetwas rot wird. Genau so sind
--    acht der Tueren oben entstanden.
--
--    Deshalb steht hier eine VOLKSZAEHLUNG statt einer Liste von Vermutungen:
--    ueber ALLE RLS-Tabellen wird gezaehlt, was der eingeschaltete Betreiber
--    sieht. Was er sehen DARF, steht namentlich unten. Alles andere bringt
--    diese Suite zu Fall — auch eine Tabelle, die es heute noch nicht gibt.
--
--    Wer eine neue Tabelle hinzufuegt, hat damit genau zwei ehrliche Wege:
--    sie zweckbinden, oder sie hier mit Namen eintragen. Beides ist eine
--    bewusste Entscheidung; das Vergessen ist keine mehr.
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000090","role":"authenticated","app_metadata":{"is_platform_admin":true}}',
  true);
select set_config('app.operator_override', 'on', true);
set local role authenticated;

do $$
declare
  r record;
  v_count bigint;
  v_unerwartet text := '';
  -- Was der Betreiber sehen DARF, mit dem Zweck, der es traegt.
  v_erlaubt text[] := array[
    -- 'members' — Stammdaten und ihre Struktur
    'club_members', 'member_roles', 'profiles',
    -- 'teams' / 'departments' / 'team_coaches' — die Struktur, die er repariert
    'teams', 'team_members', 'event_teams',
    'sparten', 'sparte_members', 'departments', 'department_members',
    -- 'roles' — die Rechte-Matrix (der haeufigste Support-Fall)
    'roles', 'role_permissions', 'capabilities',
    -- 'club_settings' — Verein, Module, Lizenz, Beitrittscode, Produkte
    'clubs', 'club_modules', 'modules', 'entitlements', 'products',
    'club_join_codes', 'membership_categories',
    -- 'routines' / 'routines_edit' — die Kueren-Moderation aus 0051
    'routines', 'routine_markers', 'routine_scores', 'routine_skaters', 'routine_shares',
    -- Vereins-INHALTE ohne Personenbezug (Termine, Uebungen, Material, Anlagen):
    -- sie sagen ueber niemanden etwas aus und sind der Gegenstand des Supports.
    'events', 'training_slots', 'exercises', 'news', 'equipment', 'facilities',
    'competitions', 'regional_events',
    -- die eigene Datenhaltung des Auftragsverarbeiters
    'operator_capabilities', 'operator_audit_log', 'support_tickets', 'support_messages',
    'platform_settings', 'user_preferences'
  ];
begin
  for r in
    select c.relname
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'app' and c.relkind = 'r' and c.relrowsecurity
    order by c.relname
  loop
    begin
      execute format('select count(*) from app.%I', r.relname) into v_count;
    exception when insufficient_privilege then
      -- kein SELECT-Grant (z.B. Zaehler-Tabellen) = erst recht kein Zugriff
      continue;
    end;
    if v_count > 0 and not (r.relname = any (v_erlaubt)) then
      v_unerwartet := v_unerwartet || r.relname || '(' || v_count || ') ';
    end if;
  end loop;

  if v_unerwartet <> '' then
    raise exception
      '0075/Zaehlschleife: der Betreiber sieht Zeilen in Tabellen, die kein Zweck traegt: %. Entweder die Tabelle an app.operator_may binden — oder sie hier mit Begruendung eintragen.',
      v_unerwartet;
  end if;
  perform testkit.is_eq('0075/Zaehlschleife: KEINE Tabelle ausserhalb der benannten Zwecke traegt Zeilen', 0, 0);
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- 6. DIE ALLOWLIST BLEIBT UNVERAENDERLICH — auch fuer den Betreiber selbst.
--    (0074 Abschnitt 2 sagt es zu; hier wird es gegen die Persona gemessen,
--    die ein Interesse daran haette.)
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000090","role":"authenticated","app_metadata":{"is_platform_admin":true}}',
  true);
select set_config('app.operator_override', 'on', true);
set local role authenticated;

do $$
begin
  perform testkit.throws('0075/Allowlist: der Betreiber kann sich keine Faehigkeit eintragen',
    $q$insert into app.operator_capabilities (capability_key, reason_de, reason_en)
       values ('lockers', 'Ich haette gern die Schliessfaecher.', 'I would like the lockers.')$q$,
    '42501');
  -- Beim LOESCHEN ist die Antwort leiser, aber genauso hart: RLS hat fuer
  -- `authenticated` keine delete-Policy, also trifft das Statement 0 Zeilen und
  -- der Zeilen-Trigger kommt gar nicht erst dran. Deshalb wird hier die WIRKUNG
  -- geprueft und nicht der Fehlercode — die Zeile steht danach noch.
  delete from app.operator_capabilities where capability_key = 'members';
  perform testkit.is_eq('0075/Allowlist: … und auch keine loeschen (RLS laesst 0 Zeilen zu)',
    (select count(*) from app.operator_capabilities where capability_key = 'members'), 1);
end;
$$;
rollback;

-- Und im SERVICE-MODUS (der Weg, auf dem die Middleware schreibt) genauso —
-- das ist der Fall, der wirklich zaehlt: der API-Code selbst darf es nicht.
begin;
set local role service_role;
do $$
begin
  perform testkit.throws('0075/Allowlist: auch service_role kann nichts eintragen',
    $q$insert into app.operator_capabilities (capability_key, reason_de, reason_en)
       values ('coach_notes', 'Untergeschobene Route.', 'Smuggled-in route.')$q$,
    '42501');
end;
$$;
rollback;
