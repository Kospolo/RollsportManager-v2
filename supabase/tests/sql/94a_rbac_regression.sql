-- ============================================================================
-- 94a_rbac_regression.sql — test class (i4): die ALTEN Zusagen unter der NEUEN
-- Engine + der zentrale Mitgliedschafts-Gate.
--
-- 99a/99c prüfen die 0021-Härtung gegen die ALTE Auflösung. Diese Suite prüft
-- dieselben Zusagen noch einmal ausdrücklich als RBAC-Regression: sie dürfen
-- durch die Umstellung auf cap_rank NICHT aufgeweicht worden sein — und sie
-- dürfen auch dann nicht kippen, wenn jemand später an der Matrix dreht.
--
-- Drei Beweislasten:
--   E) 0021 hält: Mitglied sieht nur eigenes Fach / eigene Kür, bucht nicht.
--   F) Abgelaufener Gastzugang: kein Zugriff — und zwar ZENTRAL über cap_rank.
--   H) Die bewusste VERSCHÄRFUNG: der Gate (deleted_at / status / valid_until)
--      gilt jetzt für JEDE Rolle, nicht mehr nur für guest_coach.
--      ### Diese Verschärfung ist freigabepflichtig — der Test hält sie fest. ###
--
-- Personas: m-09 Katrin (member, 90..09, Fach 01, skatet d-02) · m-06 Milena
--   (guest_coach, 90..06, betreut b-03, valid_until = +30d) · m-04 Thomas
--   (admin, 90..04).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- E) Die 0021-Härtung unter der Fähigkeiten-Engine — unverändert streng.
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000009","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"member"}}',
  true);
set local role authenticated;

do $$
begin
  -- Sichtbarkeit: exakt wie vor dem Umbau (99a:39 / 99c:31).
  perform testkit.is_eq('0021-regression: Mitglied sieht GENAU sein eigenes Fach (1 von 8)',
    (select count(*) from app.lockers), 1);
  perform testkit.is_eq('0021-regression: und zwar Fach 01',
    (select count(*) from app.lockers
      where id = 'e0c00000-0000-4000-8000-000000000001'), 1);
  perform testkit.is_eq('0021-regression: Mitglied sieht GENAU seine eigene Kuer (1 von 6)',
    (select count(*) from app.routines), 1);
  perform testkit.is_eq('0021-regression: und zwar d-02',
    (select count(*) from app.routines
      where id = 'd0000000-0000-4000-8000-000000000002'), 1);
  perform testkit.is_eq('0021-regression: fremde Kuer-Wertungen bleiben unsichtbar',
    (select count(*) from app.routine_scores
      where routine_id <> 'd0000000-0000-4000-8000-000000000002'), 0);

  -- Buchen: bleibt Trainer:innen vorbehalten (0021 — Mitglieder buchen NICHT).
  perform testkit.is_eq('0021-regression: facilities_booking steht auf read_own (1) < edit',
    app.cap_rank('c1ab0000-0000-4000-8000-000000000001', 'facilities_booking')::bigint, 1);
  perform testkit.throws('0021-regression: Mitglied darf NICHT buchen (auch nicht fuer sich)',
    $q$insert into app.facility_bookings
         (facility_id, club_id, booked_by_member_id, title, starts_at, ends_at)
       values ('fac00000-0000-4000-8000-000000000001',
               'c1ab0000-0000-4000-8000-000000000001',
               'a0000000-0000-4000-8000-000000000009', 'Eigenbuchung',
               now() + interval '1 day', now() + interval '1 day 1 hour')$q$, '42501');

  -- Fach verwalten / Kuer schreiben: unveraendert gesperrt.
  perform testkit.throws('0021-regression: Mitglied legt kein Fach an',
    $q$insert into app.lockers (club_id, label, location, status)
       values ('c1ab0000-0000-4000-8000-000000000001', 'Fach 99', 'Keller', 'free')$q$, '42501');
  perform testkit.throws('0021-regression: Mitglied setzt keinen Kuer-Marker',
    $q$insert into app.routine_markers (club_id, routine_id, time_ms, label)
       values ('c1ab0000-0000-4000-8000-000000000001',
               'd0000000-0000-4000-8000-000000000002', 500, 'Fremdmarke')$q$, '42501');

  -- Der Eigen-Zweig bleibt offen (96:67) — die Haertung trifft nur das Fremde.
  perform testkit.succeeds('0021-regression: Mitglied reserviert weiterhin FUER SICH (Eigen-Zweig)',
    $q$insert into app.equipment_reservations
         (equipment_id, club_id, reserved_by_member_id, quantity, from_at, to_at)
       values ('e9000000-0000-4000-8000-000000000001',
               'c1ab0000-0000-4000-8000-000000000001',
               'a0000000-0000-4000-8000-000000000009', 1,
               now() + interval '2 days', now() + interval '2 days 2 hours')$q$);
  perform testkit.throws('0021-regression: aber NICHT fuer jemand anderen',
    $q$insert into app.equipment_reservations
         (equipment_id, club_id, reserved_by_member_id, quantity, from_at, to_at)
       values ('e9000000-0000-4000-8000-000000000001',
               'c1ab0000-0000-4000-8000-000000000001',
               'a0000000-0000-4000-8000-000000000001', 1,
               now() + interval '3 days', now() + interval '3 days 2 hours')$q$, '42501');
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- F) Abgelaufener Gastzugang. 94_rbac_escalation.sql zeigt cap_rank = 0;
--    hier kommt der VERHALTENS-Beweis dazu — inklusive des Nachweises, WO der
--    Gate sitzt: coached_team_ids prüft selbst NUR deleted_at und liefert
--    weiterhin b-03. Trotzdem ist keine einzige Kür sichtbar, weil cap_rank
--    zentral schliesst. Genau deshalb ist der Gate dort richtig aufgehoben und
--    nicht in jedem einzelnen Helfer.
-- ---------------------------------------------------------------------------
begin;
update app.club_members
   set valid_until = now() - interval '1 day'
 where id = 'a0000000-0000-4000-8000-000000000006';

select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000006","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"guest_coach"}}',
  true);
set local role authenticated;

do $$
begin
  -- Der Gate schliesst — obwohl der Token unveraendert "guest_coach" behauptet.
  perform testkit.is_eq('gast abgelaufen: member_role_keys ist LEER (der zentrale Gate)',
    coalesce(array_length(app.member_role_keys('c1ab0000-0000-4000-8000-000000000001'), 1), 0)::bigint, 0);
  perform testkit.is_eq('gast abgelaufen: has_club_role(guest_coach) = false trotz Token-Claim',
    (select count(*) from (values (1)) t
     where app.has_club_role('c1ab0000-0000-4000-8000-000000000001', array['guest_coach'])), 0);
  perform testkit.is_eq('gast abgelaufen: is_club_member = false',
    (select count(*) from (values (1)) t
     where app.is_club_member('c1ab0000-0000-4000-8000-000000000001')), 0);
  perform testkit.is_eq('gast abgelaufen: sieht den Verein nicht mehr',
    (select count(*) from app.clubs), 0);
  perform testkit.is_eq('gast abgelaufen: sieht keinen Roster mehr',
    (select count(*) from app.club_members), 0);

  -- DER Nachweis, dass der Gate zentral in cap_rank sitzt:
  perform testkit.is_eq('gast abgelaufen: coached_team_ids liefert b-03 WEITERHIN (prueft nur deleted_at)',
    array_length(app.coached_team_ids('c1ab0000-0000-4000-8000-000000000001'), 1)::bigint, 1);
  perform testkit.is_eq('gast abgelaufen: cap_rank routines = 0 faengt es ab',
    app.cap_rank('c1ab0000-0000-4000-8000-000000000001', 'routines')::bigint, 0);
  perform testkit.is_eq('gast abgelaufen: -> KEINE Kuer sichtbar, obwohl das Team "seins" ist',
    (select count(*) from app.routines), 0);

  -- Schreiben ist ueberall zu.
  perform testkit.throws('gast abgelaufen: keine Anwesenheit mehr',
    $q$insert into app.attendance (club_id, event_id, member_id, status)
       values ('c1ab0000-0000-4000-8000-000000000001',
               'e0000000-0000-4000-8000-000000000004',
               'a0000000-0000-4000-8000-000000000020', 'present')$q$, '42501');
  perform testkit.throws('gast abgelaufen: kein Buchen mehr',
    $q$insert into app.facility_bookings
         (facility_id, club_id, booked_by_member_id, title, starts_at, ends_at)
       values ('fac00000-0000-4000-8000-000000000001',
               'c1ab0000-0000-4000-8000-000000000001',
               'a0000000-0000-4000-8000-000000000006', 'Gastbuchung',
               now() + interval '1 day', now() + interval '1 day 1 hour')$q$, '42501');
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- H) DIE BEWUSSTE VERSCHÄRFUNG (freigabepflichtig, deshalb hier fixiert):
--    Bis 0025 galt der Mitgliedschafts-Gate NUR für guest_coach; alle anderen
--    Rollen wurden ungeprüft aus dem JWT geglaubt (0002:161). Ein ausgetretenes
--    oder soft-gelöschtes Mitglied behielt seine Rechte bis zum Token-Ablauf.
--    Jetzt verliert JEDE Rolle die Rechte sofort. Im Bestand folgenlos (alle
--    Test-Personas sind 'active'); die Tests hier zeigen, dass es wirkt — und
--    zwar auch für einen ADMIN, nicht nur für ein einfaches Mitglied.
-- ---------------------------------------------------------------------------

-- H1) Austritt (status <> 'active') — Katrin, einfaches Mitglied.
begin;
update app.club_members
   set status = 'inactive'
 where id = 'a0000000-0000-4000-8000-000000000009';

select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000009","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"member"}}',
  true);
set local role authenticated;

do $$
begin
  perform testkit.is_eq('verschaerfung: status<>active -> Rollen sofort weg (Gate)',
    coalesce(array_length(app.member_role_keys('c1ab0000-0000-4000-8000-000000000001'), 1), 0)::bigint, 0);
  perform testkit.is_eq('verschaerfung: ausgetretenes Mitglied sieht den Verein nicht mehr',
    (select count(*) from app.clubs), 0);
  perform testkit.is_eq('verschaerfung: und auch die eigene Kuer nicht mehr',
    (select count(*) from app.routines), 0);
  perform testkit.is_eq('verschaerfung: und das eigene Fach nicht mehr',
    (select count(*) from app.lockers), 0);
end;
$$;
rollback;

-- H2) Soft-Delete trifft auch die VERWALTUNG — hier ein ADMIN. Das ist der
--     Kern der Verschärfung: sie gilt für JEDE Rolle, nicht nur für Gäste.
begin;
update app.club_members
   set deleted_at = now()
 where id = 'a0000000-0000-4000-8000-000000000004';

select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000004","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"admin"}}',
  true);
set local role authenticated;

do $$
begin
  perform testkit.is_eq('verschaerfung: soft-geloeschter ADMIN verliert seine Rollen sofort',
    coalesce(array_length(app.member_role_keys('c1ab0000-0000-4000-8000-000000000001'), 1), 0)::bigint, 0);
  perform testkit.is_eq('verschaerfung: cap_rank members = 0 (war manage)',
    app.cap_rank('c1ab0000-0000-4000-8000-000000000001', 'members')::bigint, 0);
  perform testkit.is_eq('verschaerfung: is_club_admin = false trotz gueltigem admin-Token',
    (select count(*) from (values (1)) t
     where app.is_club_admin('c1ab0000-0000-4000-8000-000000000001')), 0);
  perform testkit.affects('verschaerfung: er aendert keine Vereinseinstellungen mehr',
    $q$update app.clubs set city = 'Geistadt'
        where id = 'c1ab0000-0000-4000-8000-000000000001'$q$, 0);
  perform testkit.throws('verschaerfung: er legt kein Mitglied mehr an',
    $q$insert into app.club_members (club_id, first_name, last_name, role, status, joined_on)
       values ('c1ab0000-0000-4000-8000-000000000001', 'Geist', 'Nutzer',
               'member', 'active', current_date)$q$, '42501');
end;
$$;
rollback;

-- H3) Positivkontrolle: solange die Mitgliedschaft lebt, aendert sich NICHTS.
--     (Sonst wuerde H1/H2 auch bei einem kaputten Gate "gruen" aussehen.)
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000004","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"admin"}}',
  true);
set local role authenticated;

do $$
begin
  perform testkit.is_eq('positivkontrolle: der aktive Admin haelt seine Rolle',
    coalesce(array_length(app.member_role_keys('c1ab0000-0000-4000-8000-000000000001'), 1), 0)::bigint, 1);
  perform testkit.is_eq('positivkontrolle: cap_rank members = manage (5)',
    app.cap_rank('c1ab0000-0000-4000-8000-000000000001', 'members')::bigint, 5);
  perform testkit.affects('positivkontrolle: und aendert die Vereinseinstellungen',
    $q$update app.clubs set city = 'Neckarsulm'
        where id = 'c1ab0000-0000-4000-8000-000000000001'$q$, 1);
end;
$$;
rollback;
