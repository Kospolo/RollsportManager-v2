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
