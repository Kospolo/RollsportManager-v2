-- ============================================================================
-- 99e_operator_access.sql — der Betreiber-Zugriff (0051) und sein Protokoll.
--
-- Was hier bewiesen werden muss, in dieser Reihenfolge:
--   1. Der Claim ALLEIN bewirkt weiterhin NICHTS. (Sonst waere 0051 eine
--      stille Aufweichung und 90_roles_matrix.sql:148 nur zufaellig gruen.)
--   2. Die Sitzungsvariable ALLEIN bewirkt NICHTS. (Das ist der eigentliche
--      Sicherheitsbeweis: waere sie fuer sich genommen wirksam, haette 0051
--      jedem Mitglied einen Generalschluessel gegeben.)
--   3. Erst BEIDES zusammen oeffnet — und dann vollstaendig.
--   4. Ein normales Mitglied aendert sich um kein Bisschen.
--   5. Das Protokoll ist append-only, auch gegen den Betreiber und gegen
--      service_role, und verliert nur verfallene Zeilen.
--   6. Der VEREIN darf sein eigenes Protokoll lesen — sonst waere es kein
--      Nachweis nach Art. 28 Abs. 3 lit. h DSGVO, sondern eine Behauptung.
--
-- Personas: platform admin = 90000000-…-090 (kein club_members-Eintrag),
-- club A = c1ab0000-…-01, club B = deadbeef-0000-…-01 (01_fixture_club_b.sql).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. DER CLAIM ALLEIN — unveraendert wirkungslos.
--    Das ist dieselbe Lage wie in 90_roles_matrix.sql:148, hier noch einmal
--    ausdruecklich gegen die NEUEN Funktionen gefahren.
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000090","role":"authenticated","app_metadata":{"is_platform_admin":true}}',
  true);
set local role authenticated;

do $$
begin
  perform testkit.is_eq('0051/Claim allein: is_platform_admin() ist true …',
    (select case when app.is_platform_admin() then 1 else 0 end), 1);
  perform testkit.is_eq('0051/Claim allein: … operator_override() aber false (Variable fehlt)',
    (select case when app.operator_override() then 1 else 0 end), 0);

  -- STRIKT false, NICHT null. Das ist kein Schoenheitsfehler: has_club_role
  -- reicht den Wert als 'operator_override() or exists(…)' weiter, und 14
  -- Schutztrigger negieren diese Helfer ('if not app.has_club_role(…) then
  -- raise'). Bei NULL ist 'not NULL' nie wahr — der Trigger wuerde
  -- STILLSCHWEIGEND aufhoeren zu schuetzen, ausgerechnet fuer den
  -- Plattform-Admin. Genau diese Lage (Claim true + Variable fehlt) ist die
  -- einzige, in der true AND NULL = NULL entsteht; ueberall sonst deckt
  -- false AND NULL = false den Fehler zu. Siehe Kopf von 0051.
  perform testkit.is_eq('0051/Claim allein: operator_override() ist strikt FALSE, nicht NULL',
    (select case when app.operator_override() is null then 1 else 0 end), 0);
  perform testkit.is_eq('0051/Claim allein: has_club_role gibt FALSE weiter, nicht NULL (Schutztrigger negieren es)',
    (select case when app.has_club_role('c1ab0000-0000-4000-8000-000000000001', array['owner']) is null then 1 else 0 end), 0);
  -- Und der Schutztrigger feuert damit weiterhin (P0001), statt lautlos
  -- auszufallen und die Abwehr allein der RLS-Policy zu ueberlassen.
  perform testkit.throws('0051/Claim allein: der Schutztrigger protect_club_membership feuert weiterhin',
    $q$insert into app.club_members (club_id, first_name, last_name, role, status)
       values ('deadbeef-0000-4000-8000-000000000001', 'Platform', 'Owner', 'owner', 'active')$q$,
    'P0001');
  perform testkit.is_eq('0051/Claim allein: cap_rank(members) bleibt 0',
    (select app.cap_rank('c1ab0000-0000-4000-8000-000000000001', 'members')), 0);
  perform testkit.is_eq('0051/Claim allein: has_club_role(owner) bleibt false',
    (select case when app.has_club_role('c1ab0000-0000-4000-8000-000000000001',
                                        array['owner','admin','moderator','coach']) then 1 else 0 end), 0);
  -- wortgleich zu 90_roles_matrix.sql:148 — die Zusicherung dort haelt.
  perform testkit.throws('0051/Claim allein: kann weiterhin KEINE club_members-Zeile pflanzen',
    $q$insert into app.club_members (club_id, first_name, last_name, role, status)
       values ('c1ab0000-0000-4000-8000-000000000001', 'Platform', 'Ghost', 'member', 'active')$q$,
    '42501');
  perform testkit.throws('0051/Claim allein: kann weiterhin kein Team anlegen',
    $q$insert into app.teams (club_id, name) values
       ('c1ab0000-0000-4000-8000-000000000001', 'Platform-Team')$q$, '42501');
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- 2. DIE VARIABLE ALLEIN — der eigentliche Sicherheitsbeweis.
--
--    Hier setzt ein GANZ NORMALES MITGLIED (Katrin Grünewald, …-009, role
--    'member') die Sitzungsvariable selbst — also der schlimmste denkbare Fall:
--    jemand bekommt sie zu fassen. Wenn 0051 hier oeffnet, ist es ein Loch und
--    kein Feature. app.operator_override() verlangt den signierten Claim
--    ZUSAETZLICH, und den kann sich niemand selbst ausstellen (er stammt aus
--    GoTrues app_metadata; das Token ist ES256/JWKS-signiert).
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000009","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"member"}}',
  true);
select set_config('app.operator_override', 'on', true);   -- der Angriff
set local role authenticated;

do $$
begin
  perform testkit.is_eq('0051/Variable allein: Mitglied setzt sie selbst -> operator_override() bleibt false',
    (select case when app.operator_override() then 1 else 0 end), 0);
  perform testkit.is_eq('0051/Variable allein: cap_rank(members) bleibt bei read_all (3), nicht 5',
    (select app.cap_rank('c1ab0000-0000-4000-8000-000000000001', 'members')), 3);
  perform testkit.is_eq('0051/Variable allein: has_club_role(owner…) bleibt false',
    (select case when app.has_club_role('c1ab0000-0000-4000-8000-000000000001',
                                        array['owner','admin','moderator']) then 1 else 0 end), 0);
  -- 42501 = die RLS-Policy club_members_insert (has_cap(members,manage)) weist
  -- ab, also hat cap_rank NICHT geoeffnet. Bewusst role='member': ein
  -- 'owner'-Versuch liefe vorher in den Trigger protect_club_membership (P0001)
  -- und wuerde damit gar nicht mehr beweisen, dass der Schalter zu blieb.
  perform testkit.throws('0051/Variable allein: Mitglied kann trotzdem niemanden anlegen (RLS weist ab)',
    $q$insert into app.club_members (club_id, first_name, last_name, role, status)
       values ('c1ab0000-0000-4000-8000-000000000001', 'Selbst', 'Ernannt', 'member', 'active')$q$,
    '42501');
  perform testkit.throws('0051/Variable allein: … und auch keine Rolle vergeben (Trigger)',
    $q$insert into app.club_members (club_id, first_name, last_name, role, status)
       values ('c1ab0000-0000-4000-8000-000000000001', 'Selbst', 'Ernannt', 'owner', 'active')$q$,
    'P0001');
  perform testkit.is_eq('0051/Variable allein: sieht weiterhin NUR den eigenen Verein',
    (select count(*) from app.clubs), 1);
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- 3. BEIDES ZUSAMMEN — die Betreiber-Einsicht, wie die Middleware sie setzt.
--    Genau das war vorher 403: Mitglieder, Kueren, Jubilaeen.
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000090","role":"authenticated","app_metadata":{"is_platform_admin":true}}',
  true);
select set_config('app.operator_override', 'on', true);
set local role authenticated;

do $$
declare
  v_id uuid;
begin
  perform testkit.is_eq('0051/Einsicht: operator_override() ist true',
    (select case when app.operator_override() then 1 else 0 end), 1);

  -- ---- MITGLIEDER (war 403) -------------------------------------------------
  perform testkit.is_eq('0051/Einsicht: cap_rank(members) = 5 (owner-gleich)',
    (select app.cap_rank('c1ab0000-0000-4000-8000-000000000001', 'members')), 5);
  perform testkit.is_eq('0051/Einsicht: has_cap(members,manage) in club A',
    (select case when app.has_cap('c1ab0000-0000-4000-8000-000000000001','members','manage') then 1 else 0 end), 1);
  perform testkit.is_eq('0051/Einsicht: has_cap(members,manage) auch in club B (mandantenuebergreifend)',
    (select case when app.has_cap('deadbeef-0000-4000-8000-000000000001','members','manage') then 1 else 0 end), 1);
  -- ZUSAMMENFUEHRUNG: hier stand `count(distinct club_id) … = 2` — die Zahl
  -- meinte "Verein A + Verein B, mehr gibt es nicht". Das stimmte, als dieser
  -- Trupp startete (Stand 0034). Inzwischen legen 99d_registrierung und
  -- 99e_einwilligung Vereine an und COMMITTEN sie; vor dieser Suite stehen
  -- daher 4 statt 2. Der Zaehler mass also gar nicht mehr die Zusage, sondern
  -- die Reihenfolge der Suiten.
  -- Die Zusage lautet "sieht den Roster BEIDER Vereine" — also werden BEIDE
  -- Vereine benannt statt gezaehlt. Das ist schaerfer, nicht laxer: die alte
  -- Fassung waere auch mit zwei BELIEBIGEN Vereinen gruen geworden, diese
  -- verlangt genau A und B. Und sie rostet nicht, wenn eine weitere Suite
  -- einen Verein committet.
  perform testkit.is_eq('0051/Einsicht: sieht den Roster BEIDER Vereine (A und B, namentlich)',
    (select count(distinct club_id) from app.club_members
      where club_id in ('c1ab0000-0000-4000-8000-000000000001',
                        'deadbeef-0000-4000-8000-000000000001')), 2);

  -- ---- SCHREIBEN (der ausdrueckliche Wunsch: "verwalten … schreiben") -------
  insert into app.club_members (club_id, first_name, last_name, role, status)
  values ('deadbeef-0000-4000-8000-000000000001', 'Betreiber', 'Einsicht', 'member', 'active')
  returning id into v_id;
  perform testkit.is_eq('0051/Einsicht: DARF im fremden Verein schreiben', (select count(*) from app.club_members where id = v_id), 1);

  update app.club_members set last_name = 'Geaendert' where id = v_id;
  perform testkit.is_eq('0051/Einsicht: DARF im fremden Verein aendern',
    (select count(*) from app.club_members where id = v_id and last_name = 'Geaendert'), 1);

  -- ---- RECHTE ("rechte … fuer module und vereine und mitglieder") -----------
  perform testkit.is_eq('0051/Einsicht: can_change_member_role(owner) = true',
    (select case when app.can_change_member_role('deadbeef-0000-4000-8000-000000000001','owner') then 1 else 0 end), 1);
  perform testkit.is_eq('0051/Einsicht: cap_rank(roles) = 5 (Rechteverwaltung offen)',
    (select app.cap_rank('deadbeef-0000-4000-8000-000000000001', 'roles')), 5);

  -- ---- KUEREN (die Moderation — war 403) -----------------------------------
  perform testkit.is_eq('0051/Einsicht: has_club_role(coach…) -> Kueren-SCHREIBpfad offen',
    (select case when app.has_club_role('deadbeef-0000-4000-8000-000000000001',
                                        array['owner','admin','moderator','coach']) then 1 else 0 end), 1);
  perform testkit.is_eq('0051/Einsicht: cap_rank(routines) = 5 -> sieht ALLE Kueren',
    (select app.cap_rank('c1ab0000-0000-4000-8000-000000000001', 'routines')), 5);

  -- ---- JUBILAEEN (war 403) --------------------------------------------------
  perform testkit.is_eq('0051/Einsicht: cap_rank(anniversaries) = 5',
    (select app.cap_rank('c1ab0000-0000-4000-8000-000000000001', 'anniversaries')), 5);
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- 4. GEGENPROBE — das normale Vereinsleben aendert sich um KEIN Bisschen.
--    Ohne diese Faelle waere 0051 nicht belegt, sondern nur behauptet.
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000001","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"coach"}}',
  true);
set local role authenticated;

do $$
begin
  perform testkit.is_eq('0051/Gegenprobe Trainerin: operator_override() false',
    (select case when app.operator_override() then 1 else 0 end), 0);
  perform testkit.is_eq('0051/Gegenprobe Trainerin: cap_rank(members) unveraendert read_all (3)',
    (select app.cap_rank('c1ab0000-0000-4000-8000-000000000001', 'members')), 3);
  perform testkit.is_eq('0051/Gegenprobe Trainerin: has_club_role(coach) weiterhin true',
    (select case when app.has_club_role('c1ab0000-0000-4000-8000-000000000001', array['coach']) then 1 else 0 end), 1);
  perform testkit.is_eq('0051/Gegenprobe Trainerin: has_club_role(owner) weiterhin false',
    (select case when app.has_club_role('c1ab0000-0000-4000-8000-000000000001', array['owner']) then 1 else 0 end), 0);
  perform testkit.is_eq('0051/Gegenprobe Trainerin: sieht weiterhin nur den eigenen Verein',
    (select count(*) from app.clubs), 1);
  perform testkit.throws('0051/Gegenprobe Trainerin: darf weiterhin keine Mitglieder anlegen',
    $q$insert into app.club_members (club_id, first_name, last_name, role, status)
       values ('c1ab0000-0000-4000-8000-000000000001', 'Neu', 'Person', 'member', 'active')$q$,
    '42501');
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- 5. DAS PROTOKOLL — append-only, auch gegen den Betreiber.
--    Geschrieben wird im Service-Modus (so tut es die Middleware).
-- ---------------------------------------------------------------------------
begin;
set local role service_role;

do $$
declare
  v_id uuid;
begin
  insert into app.operator_audit_log
    (actor_profile_id, club_id, route, method, access, member_ids, status, request_id)
  values
    ('90000000-0000-4000-8000-000000000090', 'c1ab0000-0000-4000-8000-000000000001',
     '/clubs/{clubId}/members', 'GET', 'read', '{}', 200, 'req-0051-a')
  returning id into v_id;
  perform testkit.is_eq('0051/Protokoll: Service-Modus schreibt die Zeile', (select count(*) from app.operator_audit_log where id = v_id), 1);

  perform testkit.is_eq('0051/Protokoll: Loeschfrist wird automatisch gesetzt (365 Tage)',
    (select count(*) from app.operator_audit_log
      where id = v_id and expires_at between now() + interval '364 days' and now() + interval '366 days'), 1);

  -- APPEND-ONLY gilt auch fuer service_role — also auch gegen unseren eigenen
  -- API-Code und gegen psql. Das ist der Kern: ein Protokoll, das der
  -- Protokollierte aendern kann, ist als Nachweis wertlos.
  perform testkit.throws('0051/Protokoll: UPDATE ist verboten — auch fuer service_role',
    format($q$update app.operator_audit_log set status = 999 where id = %L$q$, v_id), '42501');
  perform testkit.throws('0051/Protokoll: DELETE ist verboten — auch fuer service_role',
    format($q$delete from app.operator_audit_log where id = %L$q$, v_id), '42501');
  perform testkit.throws('0051/Protokoll: auch das Vorziehen der Loeschfrist ist ein UPDATE -> verboten',
    format($q$update app.operator_audit_log set expires_at = now() - interval '1 day' where id = %L$q$, v_id), '42501');

  -- Selbst wer die Aufraeum-Variable von Hand setzt, bekommt nur VERFALLENE
  -- Zeilen heraus — der Trigger prueft old.expires_at zusaetzlich selbst.
  perform set_config('app.audit_purge', 'on', true);
  perform testkit.throws('0051/Protokoll: audit_purge-Variable loescht KEINE frische Zeile',
    format($q$delete from app.operator_audit_log where id = %L$q$, v_id), '42501');
  perform set_config('app.audit_purge', 'off', true);
end;
$$;
rollback;

-- Die Loeschfrist setzt sich durch — aber nur fuer Verfallenes.
begin;
set local role service_role;

do $$
declare
  v_old uuid;
  v_new uuid;
  v_deleted integer;
begin
  insert into app.operator_audit_log
    (actor_profile_id, route, method, access, status, expires_at)
  values ('90000000-0000-4000-8000-000000000090', '/platform/stats', 'GET', 'read', 200,
          now() - interval '1 day')
  returning id into v_old;
  insert into app.operator_audit_log
    (actor_profile_id, route, method, access, status)
  values ('90000000-0000-4000-8000-000000000090', '/platform/stats', 'GET', 'read', 200)
  returning id into v_new;

  select app.purge_operator_audit_log() into v_deleted;

  perform testkit.is_eq('0051/Loeschfrist: verfallene Zeile ist weg',
    (select count(*) from app.operator_audit_log where id = v_old), 0);
  perform testkit.is_eq('0051/Loeschfrist: die frische Zeile UEBERLEBT die Aufraeumung',
    (select count(*) from app.operator_audit_log where id = v_new), 1);
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- 6. WER DAS PROTOKOLL LESEN DARF.
--    Der Verein muss selbst nachsehen koennen, wer in SEINE Daten geschaut hat
--    — sonst ist es kein Nachweis nach Art. 28 Abs. 3 lit. h, sondern eine
--    Behauptung des Auftragsverarbeiters ueber sich selbst.
-- ---------------------------------------------------------------------------
begin;
-- Zwei Zeilen anlegen: eine ueber club A, eine ueber club B.
set local role service_role;
insert into app.operator_audit_log (id, actor_profile_id, club_id, route, method, access, status) values
  ('11110041-0000-4000-8000-00000000000a', '90000000-0000-4000-8000-000000000090',
   'c1ab0000-0000-4000-8000-000000000001', '/clubs/{clubId}/members', 'GET', 'read', 200),
  ('11110041-0000-4000-8000-00000000000b', '90000000-0000-4000-8000-000000000090',
   'deadbeef-0000-4000-8000-000000000001', '/clubs/{clubId}/members', 'GET', 'read', 200);
reset role;

-- 6a) Der Betreiber sieht sein ganzes Protokoll.
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000090","role":"authenticated","app_metadata":{"is_platform_admin":true}}',
  true);
set local role authenticated;
do $$
begin
  perform testkit.is_eq('0051/Protokoll-Lesen: der Betreiber sieht beide Zeilen',
    (select count(*) from app.operator_audit_log
      where id in ('11110041-0000-4000-8000-00000000000a','11110041-0000-4000-8000-00000000000b')), 2);

  -- DER KERNFALL: der Protokollierte versucht, seine eigene Spur zu tilgen.
  -- Auch hier kracht es NICHT (RLS filtert, siehe unten bei 6b) — entscheidend
  -- ist allein, dass beide Zeilen die Versuche ueberstehen.
  delete from app.operator_audit_log
    where id in ('11110041-0000-4000-8000-00000000000a','11110041-0000-4000-8000-00000000000b');
  perform testkit.is_eq('0051/Protokoll: der BETREIBER kann seine eigenen Zeilen nicht loeschen',
    (select count(*) from app.operator_audit_log
      where id in ('11110041-0000-4000-8000-00000000000a','11110041-0000-4000-8000-00000000000b')), 2);

  update app.operator_audit_log set club_id = null, status = 999
    where id = '11110041-0000-4000-8000-00000000000a';
  perform testkit.is_eq('0051/Protokoll: der BETREIBER kann seine eigenen Zeilen nicht schoenfaerben',
    (select count(*) from app.operator_audit_log
      where id = '11110041-0000-4000-8000-00000000000a'
        and club_id = 'c1ab0000-0000-4000-8000-000000000001' and status = 200), 1);

  -- Und er kann sich auch keine Zeile DAZU-erfinden (kein insert fuer authenticated).
  perform testkit.throws('0051/Protokoll: der Betreiber kann keine Zeile erfinden',
    $q$insert into app.operator_audit_log (actor_profile_id, club_id, route, method, access, status)
       values ('90000000-0000-4000-8000-000000000090','c1ab0000-0000-4000-8000-000000000001','/erfunden','GET','read',200)$q$,
    '42501');
end;
$$;
rollback;

begin;
set local role service_role;
insert into app.operator_audit_log (id, actor_profile_id, club_id, route, method, access, status) values
  ('11110041-0000-4000-8000-00000000000a', '90000000-0000-4000-8000-000000000090',
   'c1ab0000-0000-4000-8000-000000000001', '/clubs/{clubId}/members', 'GET', 'read', 200),
  ('11110041-0000-4000-8000-00000000000b', '90000000-0000-4000-8000-000000000090',
   'deadbeef-0000-4000-8000-000000000001', '/clubs/{clubId}/members', 'GET', 'read', 200);
reset role;

-- 6b) Der Vereins-Inhaber von club A sieht GENAU die Zeile ueber SEINEN Verein.
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000002","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"owner"}}',
  true);
set local role authenticated;
do $$
begin
  perform testkit.is_eq('0051/Protokoll-Lesen: der Verein sieht, wer in SEINE Daten geschaut hat',
    (select count(*) from app.operator_audit_log
      where id = '11110041-0000-4000-8000-00000000000a'), 1);
  perform testkit.is_eq('0051/Protokoll-Lesen: aber NICHT das Protokoll eines fremden Vereins',
    (select count(*) from app.operator_audit_log
      where id = '11110041-0000-4000-8000-00000000000b'), 0);
  -- ACHTUNG, hier steckt eine Falle, in die dieser Test erst hineingelaufen ist:
  -- ein DELETE ohne passende Policy wirft NICHT 42501. RLS FILTERT die Zeile
  -- nur weg, das Statement meldet brav "0 rows" und laeuft durch. Der Trigger
  -- feuert dabei gar nicht — es wird ja keine Zeile getroffen.
  -- Ein throws()-Test waere hier also gruen geworden, ohne irgendetwas zu
  -- beweisen. Die Zusicherung, auf die es ankommt, ist nicht "es kracht",
  -- sondern "die Zeile ist danach noch da":
  delete from app.operator_audit_log where id = '11110041-0000-4000-8000-00000000000a';
  perform testkit.is_eq('0051/Protokoll: der Verein kann seine Zeile nicht loeschen — sie ist danach noch da',
    (select count(*) from app.operator_audit_log where id = '11110041-0000-4000-8000-00000000000a'), 1);
  -- Dasselbe fuer UPDATE: RLS filtert, es kracht nicht, nichts aendert sich.
  update app.operator_audit_log set status = 999 where id = '11110041-0000-4000-8000-00000000000a';
  perform testkit.is_eq('0051/Protokoll: der Verein kann seine Zeile auch nicht aendern',
    (select count(*) from app.operator_audit_log
      where id = '11110041-0000-4000-8000-00000000000a' and status = 200), 1);
  perform testkit.throws('0051/Protokoll: niemand kann sich als authenticated eine Zeile erfinden',
    $q$insert into app.operator_audit_log (actor_profile_id, club_id, route, method, access, status)
       values ('90000000-0000-4000-8000-000000000002','c1ab0000-0000-4000-8000-000000000001','/gefaelscht','GET','read',200)$q$,
    '42501');
end;
$$;
rollback;

begin;
set local role service_role;
insert into app.operator_audit_log (id, actor_profile_id, club_id, route, method, access, status) values
  ('11110041-0000-4000-8000-00000000000a', '90000000-0000-4000-8000-000000000090',
   'c1ab0000-0000-4000-8000-000000000001', '/clubs/{clubId}/members', 'GET', 'read', 200);
reset role;

-- 6c) Ein normales Mitglied sieht NICHTS. Das Protokoll nennt Routen und
--     Mitglieder-IDs und ist selbst personenbezogen.
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000009","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"member"}}',
  true);
set local role authenticated;
do $$
begin
  perform testkit.is_eq('0051/Protokoll-Lesen: ein normales Mitglied sieht das Protokoll NICHT',
    (select count(*) from app.operator_audit_log), 0);
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- 7. DIE ZWECKBINDUNG (0074) — der Override ist kein Generalschluessel mehr.
--
--    Abschnitt 3 oben beweist, dass die Einsicht OEFFNET. Dieser Abschnitt
--    beweist, dass sie nur die FREIGEGEBENEN Zwecke oeffnet — und dass die
--    Freigabe selbst nicht zur Laufzeit erweiterbar ist. Ohne den zweiten Teil
--    waere die Allowlist eine Bitte: der Betreiber-Code laeuft an einer Stelle
--    im Service-Modus, und service_role umgeht RLS.
--
--    Aufbau wie ueberall in dieser Datei: erst die Gegenprobe, dass ueberhaupt
--    etwas offen ist, dann die Sperre.
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000090","role":"authenticated","app_metadata":{"is_platform_admin":true}}',
  true);
select set_config('app.operator_override', 'on', true);
set local role authenticated;

do $$
begin
  -- (a) Die Allowlist ist echt kleiner als der Katalog. Waere sie es nicht,
  --     haette 0074 nichts bewirkt — und dieser ganze Abschnitt waere gruen,
  --     ohne etwas zu zeigen.
  perform testkit.is_eq('0074/Zweckbindung: die Allowlist ist ECHT kleiner als der Faehigkeiten-Katalog',
    (select case when (select count(*) from app.operator_capabilities)
                    < (select count(*) from app.capabilities) then 1 else 0 end), 1);
  perform testkit.is_eq('0074/Zweckbindung: jede Freigabe traegt eine Begruendung (DE und EN)',
    (select count(*) from app.operator_capabilities
      where btrim(reason_de) = '' or btrim(reason_en) = ''), 0);

  -- (b) FREIGEGEBEN: der Betrieb geht weiter. Dieselben vier Faehigkeiten, die
  --     Abschnitt 3 misst — sie stehen hier nicht doppelt zum Spass, sondern
  --     weil sie ab jetzt einen NAMENTLICHEN Grund brauchen, um 5 zu sein.
  perform testkit.is_eq('0074/freigegeben: cap_rank(members) bleibt 5',
    (select app.cap_rank('c1ab0000-0000-4000-8000-000000000001', 'members')), 5);
  perform testkit.is_eq('0074/freigegeben: cap_rank(roles) bleibt 5',
    (select app.cap_rank('c1ab0000-0000-4000-8000-000000000001', 'roles')), 5);
  perform testkit.is_eq('0074/freigegeben: cap_rank(routines) bleibt 5',
    (select app.cap_rank('c1ab0000-0000-4000-8000-000000000001', 'routines')), 5);
  perform testkit.is_eq('0074/freigegeben: cap_rank(club_settings) bleibt 5',
    (select app.cap_rank('c1ab0000-0000-4000-8000-000000000001', 'club_settings')), 5);

  -- (c) NICHT freigegeben: Rang 0, nicht 5. Das ist der ganze Befund.
  perform testkit.is_eq('0074/gesperrt: cap_rank(coach_notes) = 0 (interne Notizen ueber Kinder)',
    (select app.cap_rank('c1ab0000-0000-4000-8000-000000000001', 'coach_notes')), 0);
  perform testkit.is_eq('0074/gesperrt: cap_rank(lockers) = 0 (welches Kind mietet welches Fach)',
    (select app.cap_rank('c1ab0000-0000-4000-8000-000000000001', 'lockers')), 0);
  perform testkit.is_eq('0074/gesperrt: cap_rank(finance) = 0 (Rechnungen, Mandate, Beitraege)',
    (select app.cap_rank('c1ab0000-0000-4000-8000-000000000001', 'finance')), 0);
  perform testkit.is_eq('0074/gesperrt: cap_rank(member_contact) = 0 (Adresse, Telefon, Geburtsdatum)',
    (select app.cap_rank('c1ab0000-0000-4000-8000-000000000001', 'member_contact')), 0);
  perform testkit.is_eq('0074/gesperrt: cap_rank(chat) = 0',
    (select app.cap_rank('c1ab0000-0000-4000-8000-000000000001', 'chat')), 0);

  -- (d) FAIL-CLOSED: eine Faehigkeit, die es im Katalog gar nicht gibt, oeffnet
  --     nicht. Das ist die Probe auf das Verhalten einer KUENFTIGEN Fähigkeit,
  --     an die niemand denkt — der eigentliche Grund fuer die Allowlist.
  perform testkit.is_eq('0074/fail-closed: eine unbekannte Faehigkeit gibt Rang 0, keinen Vollzugriff',
    (select app.cap_rank('c1ab0000-0000-4000-8000-000000000001', 'gibt_es_noch_nicht')), 0);

  -- (e) app.operator_may liefert strikt true/false, nie NULL — dieselbe Falle
  --     wie in 0051: 14 Schutztrigger negieren Helfer dieses Musters, und
  --     'if not NULL then …' ist in plpgsql NIE wahr.
  perform testkit.is_eq('0074: operator_may(gesperrt) ist strikt FALSE, nicht NULL',
    (select case when app.operator_may('coach_notes') is null then 1 else 0 end), 0);

  -- (f) Die zweckgebundenen Rollen-Helfer. can_manage_finance ist der Hebel,
  --     der die ganze Finanz-Flaeche schliesst (41 Aufrufstellen);
  --     can_manage_members und is_club_admin bleiben offen, weil ihre
  --     Faehigkeit freigegeben ist.
  perform testkit.is_eq('0074/Helfer: can_manage_finance ist fuer den Betreiber FALSE (Zweck nicht freigegeben)',
    (select case when app.can_manage_finance('c1ab0000-0000-4000-8000-000000000001') then 1 else 0 end), 0);
  perform testkit.is_eq('0074/Helfer: can_manage_members bleibt TRUE (Zweck "members" freigegeben)',
    (select case when app.can_manage_members('c1ab0000-0000-4000-8000-000000000001') then 1 else 0 end), 1);
  perform testkit.is_eq('0074/Helfer: is_club_admin bleibt TRUE (Zweck "club_settings" freigegeben)',
    (select case when app.is_club_admin('c1ab0000-0000-4000-8000-000000000001') then 1 else 0 end), 1);

  -- (g) Und die WIRKUNG, nicht nur die Funktionswerte: die Zeilen sind weg.
  perform testkit.is_eq('0074/Wirkung: keine SEPA-Mandate mehr (IBAN der Eltern)',
    (select count(*) from app.sepa_mandates), 0);
  perform testkit.is_eq('0074/Wirkung: keine Rechnungen mehr',
    (select count(*) from app.invoices), 0);
  perform testkit.is_eq('0074/Wirkung: keine Beitragssaetze einzelner Mitglieder mehr',
    (select count(*) from app.member_fees), 0);
  perform testkit.is_eq('0074/Wirkung: kein Kassenbuch mehr',
    (select count(*) from app.ledger_entries), 0);
  -- … und der Betrieb geht trotzdem weiter. Namentlich statt gezaehlt, aus dem
  -- Grund, der in Abschnitt 3 steht: fruehere Suiten committen Mitglieder, ein
  -- Zaehler maesse die Reihenfolge der Suiten und nicht die Zusage.
  perform testkit.is_eq('0074/Wirkung: der Roster BEIDER Vereine bleibt sichtbar (A und B, namentlich)',
    (select count(distinct club_id) from app.club_members
      where club_id in ('c1ab0000-0000-4000-8000-000000000001',
                        'deadbeef-0000-4000-8000-000000000001')), 2);

  -- (h) Die Allowlist ist fuer den Betreiber LESBAR (Transparenz) …
  perform testkit.is_eq('0074/Transparenz: der Betreiber sieht seine eigene Allowlist',
    (select case when count(*) > 0 then 1 else 0 end from app.operator_capabilities), 1);
  -- … aber NICHT erweiterbar. Das ist der Punkt, an dem die Allowlist von einer
  -- Bitte zu einer Eigenschaft wird.
  perform testkit.throws('0074/Sperre: der Betreiber kann sich coach_notes NICHT selbst freigeben',
    $q$insert into app.operator_capabilities (capability_key, reason_de, reason_en)
       values ('coach_notes', 'Selbstbedienung durch den Betreiber.', 'Operator self-service.')$q$,
    '42501');
end;
$$;

-- UPDATE und DELETE: hier steckt dieselbe Falle wie in Abschnitt 6b — ein
-- Statement OHNE passende Policy wirft NICHT 42501. RLS FILTERT die Zeile weg,
-- das Statement meldet brav "0 rows" und laeuft durch; der Trigger feuert gar
-- nicht, weil keine Zeile getroffen wird. Ein throws()-Test waere hier gruen
-- geworden, ohne irgendetwas zu beweisen (dieser Test ist genau einmal
-- hineingelaufen). Die Zusicherung, auf die es ankommt, ist nicht "es kracht",
-- sondern "die Allowlist steht danach unveraendert da":
do $$
begin
  update app.operator_capabilities set capability_key = 'coach_notes' where capability_key = 'members';
  delete from app.operator_capabilities where capability_key = 'members';
  perform testkit.is_eq('0074/Sperre: nach UPDATE+DELETE des Betreibers steht "members" unveraendert da',
    (select count(*) from app.operator_capabilities where capability_key = 'members'), 1);
  perform testkit.is_eq('0074/Sperre: und "coach_notes" ist NICHT dazugekommen',
    (select count(*) from app.operator_capabilities where capability_key = 'coach_notes'), 0);
  perform testkit.is_eq('0074/Sperre: cap_rank(coach_notes) ist danach immer noch 0',
    (select app.cap_rank('c1ab0000-0000-4000-8000-000000000001', 'coach_notes')), 0);
end;
$$;
rollback;

-- Der VEREIN darf ebenfalls sehen, was sein Auftragsverarbeiter DARF — die
-- zweite Haelfte der Kontrolle nach Art. 28 Abs. 3 lit. h DSGVO (die erste ist
-- app.operator_audit_log: was er GETAN hat).
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000002","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"owner"}}',
  true);
set local role authenticated;
do $$
begin
  perform testkit.is_eq('0074/Transparenz: der Vereins-Inhaber liest die Betreiber-Allowlist',
    (select case when count(*) > 0 then 1 else 0 end from app.operator_capabilities), 1);
  -- Wieder: RLS filtert, es kracht nicht — gemessen wird das ERGEBNIS.
  delete from app.operator_capabilities where capability_key = 'members';
  perform testkit.is_eq('0074/Sperre: aber auch er kann sie nicht aendern — die Zeile ist danach noch da',
    (select count(*) from app.operator_capabilities where capability_key = 'members'), 1);
  perform testkit.throws('0074/Sperre: und er kann auch nichts hinzufuegen',
    $q$insert into app.operator_capabilities (capability_key, reason_de, reason_en)
       values ('finance', 'Der Verein erlaubt es dem Betreiber.', 'The club allows the operator.')$q$,
    '42501');
end;
$$;
rollback;

-- Und die Sperre gilt auch gegen SERVICE_ROLE — also gegen unseren eigenen
-- API-Code und gegen psql. Ohne diesen Fall waere die Allowlist genau so weit
-- wie das Vertrauen in jede kuenftige Service-Mode-Route.
begin;
set local role service_role;
do $$
begin
  perform testkit.throws('0074/Sperre: auch service_role kann die Allowlist nicht erweitern',
    $q$insert into app.operator_capabilities (capability_key, reason_de, reason_en)
       values ('finance', 'Ueber eine Service-Mode-Route eingeschleust.', 'Injected via a service-mode route.')$q$,
    '42501');
  perform testkit.throws('0074/Sperre: und auch nicht loeschen',
    $q$delete from app.operator_capabilities$q$,
    '42501');
end;
$$;
rollback;

-- Gegenprobe zum Schluss: ein NORMALES Mitglied merkt von 0074 nichts.
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000003","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"treasurer"}}',
  true);
set local role authenticated;
do $$
begin
  perform testkit.is_eq('0074/Gegenprobe Kassenwartin: operator_may ist fuer sie immer false',
    (select case when app.operator_may('finance') then 1 else 0 end), 0);
  perform testkit.is_eq('0074/Gegenprobe Kassenwartin: can_manage_finance bleibt TRUE (echte Vereinsrolle)',
    (select case when app.can_manage_finance('c1ab0000-0000-4000-8000-000000000001') then 1 else 0 end), 1);
  perform testkit.is_eq('0074/Gegenprobe Kassenwartin: sie sieht ihre Rechnungen weiterhin',
    (select case when count(*) > 0 then 1 else 0 end from app.invoices), 1);
  perform testkit.is_eq('0074/Gegenprobe Kassenwartin: und die SEPA-Mandate weiterhin',
    (select case when count(*) > 0 then 1 else 0 end from app.sepa_mandates), 1);
end;
$$;
rollback;
