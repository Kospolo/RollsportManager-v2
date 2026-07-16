-- ============================================================================
-- 99e_beitritt_rotation_ablehnung.sql — Rotation, Ablehnung, der pending-Fremde.
--
-- Drei Behauptungen aus 0036/0037, die alle drei vorher NICHT galten:
--   (a) EIN VEREIN KANN MEHRERE CODES GLEICHZEITIG FUEHREN.
--       Vorher war der Code eine SPALTE (0002:38 + 0034:58-61). Eine Spalte
--       haelt einen Wert -> Rotieren hiess Ueberschreiben, der alte Code starb
--       in derselben Sekunde. Ein Ueberlappungsfenster war nicht darstellbar,
--       und eine Rotation, die Aushang und WhatsApp-Gruppe sofort aussperrt,
--       benutzt niemand.
--   (b) EINE ABLEHNUNG IST AUSDRUECKBAR UND KEINE SACKGASSE.
--       app.member_status kannte kein 'rejected' (0002:25-26). Soft-delete
--       vergass den Vorgang, 'left' sperrte die Person per Eindeutigkeits-Index
--       (0002:82-84) FUER IMMER aus.
--   (c) EIN NICHT FREIGEGEBENER FREMDER SCHREIBT NICHT MEHR MIT.
--       club_members_update_self (0016:76-79) hatte keinen Status-Filter.
--
-- Jeder Testfall traegt seine Vorbereitung SELBST und laeuft in einer eigenen
-- Transaktion mit ROLLBACK. Damit hinterlaesst diese Datei nichts — kein
-- Aufraeumen, das man vergessen kann, und keine Zeile, die einer spaeteren
-- Suite den Bestand verschiebt (90_roles_matrix.sql:139 zaehlt die Vereine).
--
-- Benutzt AUSSCHLIESSLICH die Helfer aus 00_testkit.sql — die Testkit-Datei und
-- jede andere Bestands-Suite bleiben unberuehrt.
-- ============================================================================

-- ===========================================================================
-- (a) DER CODE IST EINE TABELLE — N Codes, ein Verein
-- ===========================================================================
begin;
set local role service_role;
select set_config('request.jwt.claims', '', true);

insert into app.clubs (id, name, city, join_code)
values ('c1ab0000-0000-4000-8000-0000000000e5', 'RSC Codeheim', 'Codeheim', 'ROTA-TST1');

do $$
begin
  -- Die Spiegelung (0037): wer die SPALTE schreibt, bekommt den Kindsatz
  -- geschenkt. Ohne sie waere jeder Bestands-Schreiber — Seed, POST /clubs
  -- (clubs.ts:213), die Test-Fixtures — ein Verein OHNE einloesbaren Code.
  perform testkit.is_eq('Spiegelung: INSERT auf app.clubs.join_code legt den Kindsatz an',
    (select count(*) from app.club_join_codes
      where club_id = 'c1ab0000-0000-4000-8000-0000000000e5'), 1);
  perform testkit.is_eq('Spiegelung: der Kindsatz traegt die Vergleichsform (Crockford)',
    (select count(*) from app.club_join_codes
      where club_id = 'c1ab0000-0000-4000-8000-0000000000e5'
        and code_normalized = 'R0TATST1'), 1);

  -- Auch der SEED-Verein hat seinen Kindsatz — der Beweis, dass die Spiegelung
  -- nicht nur fuer frische Zeilen greift.
  perform testkit.is_eq('Spiegelung: der Seed-Code RSV-DEMO-2026 ist einloesbar',
    (select count(*) from app.club_join_codes jc
      where jc.code_normalized = app.normalize_join_code('RSV-DEMO-2026')
        and jc.club_id = 'c1ab0000-0000-4000-8000-000000000001'
        and app.join_code_is_active(jc.expires_at, jc.revoked_at)), 1);
end $$;

-- ---------------------------------------------------------------------------
-- DIE ROTATION MIT UEBERLAPPUNG — Schritt fuer Schritt wie in
-- routes/registration.ts (POST /clubs/{clubId}/join-code/rotate).
-- ---------------------------------------------------------------------------
-- 1. Der ALTE Code bekommt eine Frist (nicht den Tod).
update app.club_join_codes
   set expires_at = least(coalesce(expires_at, 'infinity'::timestamptz), now() + interval '24 hours')
 where club_id = 'c1ab0000-0000-4000-8000-0000000000e5'
   and revoked_at is null
   and (expires_at is null or expires_at > now());

-- 2. Der NEUE Code entsteht auf der Spalte, der Trigger legt den Kindsatz an.
update app.clubs
   set join_code = 'NEUC-0DE2', join_code_revoked_at = null, join_code_expires_at = null
 where id = 'c1ab0000-0000-4000-8000-0000000000e5';

do $$
begin
  -- DAS ist der Punkt der ganzen Uebung. Vorher unmoeglich: die Spalte
  -- app.clubs.join_code haelt genau EINEN Wert.
  perform testkit.is_eq('Rotation: ZWEI Codes sind gleichzeitig einloesbar (Ueberlappung)',
    (select count(*) from app.club_join_codes jc
      where jc.club_id = 'c1ab0000-0000-4000-8000-0000000000e5'
        and app.join_code_is_active(jc.expires_at, jc.revoked_at)), 2);

  -- Der Einloeser findet mit dem ALTEN Zettel weiterhin den richtigen Verein.
  perform testkit.is_eq('Rotation: der ALTE Code fuehrt noch in den Verein (das Uebergangsfenster)',
    (select count(*) from app.club_join_codes jc
      join app.clubs c on c.id = jc.club_id
      where jc.code_normalized = app.normalize_join_code('rota-tst1')
        and c.deleted_at is null
        and app.join_code_is_active(jc.expires_at, jc.revoked_at)), 1);
  perform testkit.is_eq('Rotation: der NEUE Code fuehrt in denselben Verein',
    (select count(*) from app.club_join_codes jc
      where jc.code_normalized = app.normalize_join_code('NEUC-0DE2')
        and jc.club_id = 'c1ab0000-0000-4000-8000-0000000000e5'
        and app.join_code_is_active(jc.expires_at, jc.revoked_at)), 1);

  -- Und der alte stirbt: in 24 Stunden, nicht in dieser Sekunde.
  perform testkit.is_eq('Rotation: das Fenster des alten Codes endet in ~24h',
    (select count(*) from app.club_join_codes
      where code_normalized = 'R0TATST1'
        and expires_at between now() + interval '23 hours' and now() + interval '25 hours'), 1);

  -- Die Spalte kann es NICHT — sie zeigt nur den juengsten Code. Genau deshalb
  -- ist die Kindtabelle die Wahrheit und die Spalte nur noch ihr Schreib-Alias.
  perform testkit.is_eq('Rotation: die SPALTE haelt nur den juengsten Code (der Grund fuer die Kindtabelle)',
    (select count(*) from app.clubs
      where id = 'c1ab0000-0000-4000-8000-0000000000e5' and join_code = 'NEUC-0DE2'), 1);

  -- Eine Rotation VERLAENGERT nie. least() haelt das fest: ein Code, der in
  -- einer Stunde ablaeuft, bekommt durch "24h Uebergang" keine 24h geschenkt.
  update app.club_join_codes set expires_at = now() + interval '1 hour'
   where code_normalized = 'R0TATST1';
  update app.club_join_codes
     set expires_at = least(coalesce(expires_at, 'infinity'::timestamptz), now() + interval '24 hours')
   where club_id = 'c1ab0000-0000-4000-8000-0000000000e5' and revoked_at is null
     and (expires_at is null or expires_at > now());
  perform testkit.is_eq('Rotation: ein Uebergangsfenster verkuerzt nur, es verlaengert nie',
    (select count(*) from app.club_join_codes
      where code_normalized = 'R0TATST1' and expires_at < now() + interval '2 hours'), 1);
end $$;

-- ---------------------------------------------------------------------------
-- Widerruf ueber die Spalte trifft ALLE Codes des Vereins — auch den, der
-- gerade nur noch ueberlappt und laengst nicht mehr an der Spalte haengt.
-- Ein Widerruf, der einen lebenden Code uebersieht, ist keiner.
-- ---------------------------------------------------------------------------
update app.clubs set join_code = null where id = 'c1ab0000-0000-4000-8000-0000000000e5';

select testkit.is_eq('Widerruf: join_code = null toetet ALLE Codes des Vereins (auch den ueberlappenden)',
  (select count(*) from app.club_join_codes jc
    where jc.club_id = 'c1ab0000-0000-4000-8000-0000000000e5'
      and app.join_code_is_active(jc.expires_at, jc.revoked_at)), 0);
select testkit.is_eq('Widerruf: die Zeilen bleiben stehen (der Code ist widerrufen, nicht vergessen)',
  (select count(*) from app.club_join_codes
    where club_id = 'c1ab0000-0000-4000-8000-0000000000e5'), 2);
rollback;

-- ===========================================================================
-- (a2) DER CODE GEHOERT GENAU EINEM VEREIN — und bleibt, was er ist
-- ===========================================================================
begin;
set local role service_role;
select set_config('request.jwt.claims', '', true);

insert into app.clubs (id, name, city, join_code)
values ('c1ab0000-0000-4000-8000-0000000000e5', 'RSC Codeheim', 'Codeheim', 'ROTA-TST1');

-- Der Eindeutigkeits-Index aus 0034:163 wandert mit: zwei Vereine duerfen nie
-- Codes halten, die sich nur in O/0 unterscheiden — der Einloeser muesste sonst
-- raten, welcher Verein gemeint ist.
select testkit.throws('Code: O/0-Variante eines fremden Codes wird abgelehnt (Index wanderte mit)',
  $sql$insert into app.clubs (name, city, join_code) values ('Kollision', 'X', 'R0TA-TSTI')$sql$,
  '23505');

-- Ein abgelaufener Code darf NICHT an einen anderen Verein weiterwandern —
-- sonst fuehrt ein alter Aushang irgendwann in den falschen Verein. Deshalb ist
-- der Index bewusst ueber ALLE Zeilen eindeutig, nicht nur ueber die aktiven.
update app.club_join_codes set revoked_at = now()
 where club_id = 'c1ab0000-0000-4000-8000-0000000000e5';
select testkit.throws('Code: auch ein WIDERRUFENER Code bleibt fuer andere Vereine gesperrt',
  $sql$insert into app.clubs (name, city, join_code) values ('Nachnutzer', 'X', 'ROTA-TST1')$sql$,
  '23505');
rollback;

-- ===========================================================================
-- (a3) DER CODE IST UNVERAENDERLICH — die UPDATE-Policy ist kein Freibrief
-- ===========================================================================
begin;
set local role service_role;
select set_config('request.jwt.claims', '', true);

insert into app.clubs (id, name, city, join_code)
values ('c1ab0000-0000-4000-8000-0000000000e5', 'RSC Codeheim', 'Codeheim', 'ROTA-TST1');
insert into app.club_members (id, club_id, profile_id, first_name, last_name, role, status)
values ('a0e50000-0000-4000-8000-000000000001', 'c1ab0000-0000-4000-8000-0000000000e5',
        '90000000-0000-4000-8000-000000000002', 'Otto', 'Inhaber', 'owner', 'active');
insert into app.club_members (id, club_id, profile_id, first_name, last_name, role, status)
values ('a0e50000-0000-4000-8000-000000000002', 'c1ab0000-0000-4000-8000-0000000000e5',
        '90000000-0000-4000-8000-000000000001', 'Clara', 'Coach', 'coach', 'active');

select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000002","role":"authenticated","club_roles":{}}', true);
set local role authenticated;

-- Ablauf/Widerruf setzen darf die Vereinsleitung (das Uebergangsfenster!).
select testkit.affects('Code: der Inhaber darf das Uebergangsfenster setzen',
  $sql$update app.club_join_codes set expires_at = now() + interval '1 day'
        where club_id = 'c1ab0000-0000-4000-8000-0000000000e5'$sql$, 1);

-- Den Code selbst NICHT. Ohne diese Wache waere die UPDATE-Policy das Loch, das
-- die ganze 40-Bit-Begruendung aus 0034 aushebelt: ein selbstgewaehlter Code
-- ist ein ratbarer Code.
select testkit.throws('Code: der Inhaber darf sich KEINEN eigenen (= ratbaren) Code setzen',
  $sql$update app.club_join_codes set code = 'AAAA-AAAA'
        where club_id = 'c1ab0000-0000-4000-8000-0000000000e5'$sql$, 'P0001');
select testkit.throws('Code: ein Code wandert nicht in einen anderen Verein',
  $sql$update app.club_join_codes set club_id = 'c1ab0000-0000-4000-8000-000000000001'
        where club_id = 'c1ab0000-0000-4000-8000-0000000000e5'$sql$, 'P0001');

-- Codes entstehen NUR aus app.generate_join_code() ueber die Spiegelung.
select testkit.throws('Code: kein INSERT von Hand — es gibt keine INSERT-Policy',
  $sql$insert into app.club_join_codes (club_id, code, code_normalized)
       values ('c1ab0000-0000-4000-8000-0000000000e5', 'HAND-CODE', 'HANDC0DE')$sql$, '42501');
-- Ein Code wird widerrufen, nicht geloescht (sonst waere er wieder frei).
select testkit.affects('Code: DELETE ist ein stiller Treffer ins Leere (keine DELETE-Policy)',
  $sql$delete from app.club_join_codes where club_id = 'c1ab0000-0000-4000-8000-0000000000e5'$sql$, 0);

-- Sichtbarkeit deckungsgleich mit der Redigierung in clubs.ts:60 — sonst haette
-- sie ein Hintertuerchen ('select code from app.club_join_codes').
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000001","role":"authenticated","club_roles":{}}', true);
select testkit.is_eq('Code: ein TRAINER sieht die Codes seines Vereins NICHT',
  (select count(*) from app.club_join_codes
    where club_id = 'c1ab0000-0000-4000-8000-0000000000e5'), 0);
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000002","role":"authenticated","club_roles":{}}', true);
select testkit.is_eq('Code: der INHABER sieht sie (Gegenprobe — sonst beweist die 0 oben nichts)',
  (select count(*) from app.club_join_codes
    where club_id = 'c1ab0000-0000-4000-8000-0000000000e5'), 1);
rollback;

-- ===========================================================================
-- (b) DIE ABLEHNUNG — benennbar, mit Gedaechtnis, ohne Sackgasse
-- ===========================================================================
begin;
set local role service_role;
select set_config('request.jwt.claims', '', true);

insert into app.clubs (id, name, city, join_code)
values ('c1ab0000-0000-4000-8000-0000000000e5', 'RSC Codeheim', 'Codeheim', 'ROTA-TST1');
insert into app.club_members (id, club_id, profile_id, first_name, last_name, role, status)
values ('a0e50000-0000-4000-8000-000000000001', 'c1ab0000-0000-4000-8000-0000000000e5',
        '90000000-0000-4000-8000-000000000002', 'Otto', 'Inhaber', 'owner', 'active');
-- Der Antrag von Nadja Neuling (…091) — die einzige Seed-Person ohne Verein.
insert into app.club_members (id, club_id, profile_id, first_name, last_name, role, status)
values ('a0e50000-0000-4000-8000-000000000009', 'c1ab0000-0000-4000-8000-0000000000e5',
        '90000000-0000-4000-8000-000000000091', 'Nadja', 'Neuling', 'member', 'pending');

do $$
begin
  -- 0036: der Zustand existiert ueberhaupt.
  perform testkit.is_eq('Ablehnung: ''rejected'' ist ein gueltiger member_status (0036)',
    (select count(*) from pg_enum e join pg_type t on t.oid = e.enumtypid
      where t.typname = 'member_status' and e.enumlabel = 'rejected'), 1);
end $$;

-- Der Vorstand lehnt ab — genau wie routes/registration.ts es tut.
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000002","role":"authenticated","club_roles":{}}', true);
set local role authenticated;

select testkit.affects('Ablehnung: der Vorstand lehnt ab (status=rejected, Zeile bleibt)',
  $sql$update app.club_members
          set status = 'rejected', rejected_at = now(),
              rejected_by_member_id = app.own_member_id('c1ab0000-0000-4000-8000-0000000000e5'),
              rejection_count = rejection_count + 1
        where id = 'a0e50000-0000-4000-8000-000000000009' and status = 'pending'$sql$, 1);

do $$
begin
  -- DAS ist der Unterschied zum Soft-Delete von vorher: der Vorgang ist noch da.
  perform testkit.is_eq('Ablehnung: die Zeile ueberlebt (kein Soft-Delete) und traegt das Gedaechtnis',
    (select count(*) from app.club_members
      where id = 'a0e50000-0000-4000-8000-000000000009'
        and deleted_at is null and status = 'rejected'
        and rejected_at is not null and rejection_count = 1), 1);
  -- Eine Ablehnung ist eine Entscheidung mit Folgen — sie braucht einen Namen.
  perform testkit.is_eq('Ablehnung: sie traegt den Namen dessen, der sie getroffen hat',
    (select count(*) from app.club_members
      where id = 'a0e50000-0000-4000-8000-000000000009'
        and rejected_by_member_id = 'a0e50000-0000-4000-8000-000000000001'), 1);
end $$;

-- Und sie oeffnet weiterhin gar nichts — aus SICHT DER ABGELEHNTEN gepruft,
-- nicht aus der des Vorstands (sonst zaehlte man dessen Rollen).
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000091","role":"authenticated","club_roles":{}}', true);
select testkit.is_eq('Ablehnung: eine Abgelehnte hat KEINE Rollen (member_role_keys ist leer)',
  coalesce(array_length(app.member_role_keys('c1ab0000-0000-4000-8000-0000000000e5'), 1), 0)::bigint, 0);
select testkit.is_eq('Ablehnung: … und sieht den Verein nicht',
  (select count(*) from app.clubs where id = 'c1ab0000-0000-4000-8000-0000000000e5'), 0);
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000002","role":"authenticated","club_roles":{}}', true);

set local role service_role;
select set_config('request.jwt.claims', '', true);

-- Das Gedaechtnis ist PFLICHT, nicht Kuer — auch fuer service_role und psql.
select testkit.throws('Ablehnung: ''rejected'' OHNE Zeitpunkt ist nicht speicherbar (Check)',
  $sql$update app.club_members set status = 'rejected', rejected_at = null
        where id = 'a0e50000-0000-4000-8000-000000000009'$sql$, '23514');

-- DIE SACKGASSE, die es zu vermeiden galt: eine ZWEITE Zeile fuer dieselbe
-- Person geht nicht — der Eindeutigkeits-Index (0002:82-84) ist status-agnostisch.
-- Genau deshalb dreht der Wiederantrag DIESELBE Zeile zurueck, statt eine neue
-- anzulegen (routes/registration.ts).
select testkit.throws('Sackgasse: ein zweiter Antrag als NEUE Zeile ist unmoeglich (der Index blockt)',
  $sql$insert into app.club_members (club_id, profile_id, first_name, last_name, role, status)
       values ('c1ab0000-0000-4000-8000-0000000000e5', '90000000-0000-4000-8000-000000000091',
               'Nadja', 'Neuling', 'member', 'pending')$sql$, '23505');

-- Der Wiederantrag, wie ihn POST /clubs/join fahrt (Service-Mode, kein auth.uid()).
select testkit.affects('Wiederantrag: dieselbe Zeile dreht zurueck auf pending',
  $sql$update app.club_members set status = 'pending', role = 'member'
        where id = 'a0e50000-0000-4000-8000-000000000009'$sql$, 1);
select testkit.is_eq('Wiederantrag: das Gedaechtnis BLEIBT stehen (der Vorstand sieht die Vorgeschichte)',
  (select count(*) from app.club_members
    where id = 'a0e50000-0000-4000-8000-000000000009'
      and status = 'pending' and rejection_count = 1 and rejected_at is not null), 1);
rollback;

-- ---------------------------------------------------------------------------
-- Die zweite Sackgasse: wer 'left' war, kam per Konstruktion NIE zurueck.
-- Und der ROLLEN-RESET beim Wiederantritt ist kein Feinschliff: app.member_roles
-- ueberlebt einen Austritt (nur der status-Gate in member_role_keys 0025:47-49
-- neutralisiert die Rollen). Ohne Reset kaeme ein ausgetretener ADMIN nach der
-- naechsten Freigabe als ADMIN zurueck — der Vorstand haette nur
-- "Beitrittsantrag freigeben" gelesen.
-- ---------------------------------------------------------------------------
begin;
set local role service_role;
select set_config('request.jwt.claims', '', true);

insert into app.clubs (id, name, city, join_code)
values ('c1ab0000-0000-4000-8000-0000000000e5', 'RSC Codeheim', 'Codeheim', 'ROTA-TST1');
-- Nadja war einmal ADMIN (Primaerrolle) MIT einer zweiten Rolle als Trainerin
-- und ist ausgetreten. Die Zweitrolle ist hier kein Beiwerk: der Spiegel-Trigger
-- (0024:129-140) raeumt beim Rollenwechsel NUR die Primaerrolle weg
-- ("Zweitrollen bleiben unberuehrt", 0024:127) — sie ist genau der Grund, warum
-- routes/registration.ts zusaetzlich von Hand aufraeumen MUSS.
insert into app.club_members (id, club_id, profile_id, first_name, last_name, role, status)
values ('a0e50000-0000-4000-8000-000000000009', 'c1ab0000-0000-4000-8000-0000000000e5',
        '90000000-0000-4000-8000-000000000091', 'Nadja', 'Neuling', 'admin', 'left');
insert into app.member_roles (club_id, member_id, role_id)
select 'c1ab0000-0000-4000-8000-0000000000e5', 'a0e50000-0000-4000-8000-000000000009', r.id
  from app.roles r
 where r.club_id = 'c1ab0000-0000-4000-8000-0000000000e5' and r.key = 'coach';

do $$
begin
  perform testkit.is_eq('Austritt: die admin-Zuweisung in member_roles UEBERLEBT den Austritt',
    (select count(*) from app.member_roles mr join app.roles r on r.id = mr.role_id
      where mr.member_id = 'a0e50000-0000-4000-8000-000000000009' and r.key = 'admin'), 1);
  perform testkit.is_eq('Austritt: die ZWEITROLLE ueberlebt ihn ebenfalls',
    (select count(*) from app.member_roles mr join app.roles r on r.id = mr.role_id
      where mr.member_id = 'a0e50000-0000-4000-8000-000000000009' and r.key = 'coach'), 1);
end $$;

-- Der Wiederantritt, exakt wie POST /clubs/join ihn fahrt.
update app.club_members
   set status = 'pending', role = 'member', valid_until = null, joined_on = null
 where id = 'a0e50000-0000-4000-8000-000000000009';
delete from app.member_roles mr using app.roles r
 where mr.member_id = 'a0e50000-0000-4000-8000-000000000009'
   and r.id = mr.role_id and r.key <> 'member';

do $$
begin
  perform testkit.is_eq('Wiederantritt: ein Ausgetretener kann wieder beantragen (keine Sackgasse mehr)',
    (select count(*) from app.club_members
      where id = 'a0e50000-0000-4000-8000-000000000009' and status = 'pending'), 1);
  perform testkit.is_eq('Wiederantritt: die alte ADMIN-Rolle ist WEG (sonst waere die Freigabe eine Eskalation)',
    (select count(*) from app.member_roles mr join app.roles r on r.id = mr.role_id
      where mr.member_id = 'a0e50000-0000-4000-8000-000000000009' and r.key <> 'member'), 0);
end $$;

-- Und jetzt die Freigabe: sie macht ein MITGLIED, keinen Admin.
update app.club_members set status = 'active'
 where id = 'a0e50000-0000-4000-8000-000000000009';
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000091","role":"authenticated","club_roles":{}}', true);
set local role authenticated;
select testkit.is_eq('Wiederantritt: nach der Freigabe ist sie MITGLIED — nicht wieder Admin',
  (select count(*) from unnest(app.member_role_keys('c1ab0000-0000-4000-8000-0000000000e5')) k
    where k = 'admin'), 0);
select testkit.is_eq('Wiederantritt: … und die Mitgliedsrolle hat sie (Gegenprobe)',
  (select count(*) from unnest(app.member_role_keys('c1ab0000-0000-4000-8000-0000000000e5')) k
    where k = 'member'), 1);
rollback;

-- ===========================================================================
-- (c) DER PENDING-FREMDE SCHREIBT NICHT MEHR AN SEINER ZEILE
-- ===========================================================================
begin;
set local role service_role;
select set_config('request.jwt.claims', '', true);

insert into app.clubs (id, name, city, join_code)
values ('c1ab0000-0000-4000-8000-0000000000e5', 'RSC Codeheim', 'Codeheim', 'ROTA-TST1');
insert into app.club_members (id, club_id, profile_id, first_name, last_name, role, status)
values ('a0e50000-0000-4000-8000-000000000009', 'c1ab0000-0000-4000-8000-0000000000e5',
        '90000000-0000-4000-8000-000000000091', 'Nadja', 'Neuling', 'member', 'pending');

select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000091","role":"authenticated","club_roles":{}}', true);
set local role authenticated;

-- Der Befund: protect_club_membership (0007:216-222) haelt role/status/
-- valid_until/profile_id fest — first_name/last_name/email/birth_date NICHT.
-- Ohne Status-Filter in club_members_update_self (0016:76-79) schrieb der
-- Fremde also laufend den Text um, den der Vorstand im Freigabe-Bildschirm
-- liest. Kein Datenleck — eine Anzeige-Taeuschung, genau bei der Entscheidung.
--
-- ### WARUM HIER KEINE WHERE-KLAUSEL STEHT — das ist der ganze Test ###
-- Mit 'where id = …' ist dieser Angriff auch OHNE den Fix wirkungslos: sobald
-- ein UPDATE Zeilen LESEN muss (die WHERE-Bedingung!), verlangt Postgres
-- zusaetzlich SELECT-Recht, und club_members_select (is_club_member) versteckt
-- die Zeile vor einer pending-Person. Ein Test mit WHERE ist also gruen,
-- gleichgueltig ob die Luecke offen ist — er beweist NICHTS.
-- Ein UPDATE OHNE WHERE liest nichts. Dann zaehlt allein das USING der
-- UPDATE-Policy — und genau dort fehlte der Status-Filter. Nachgemessen: mit
-- der alten Policy setzt die Zeile darunter den Namen (1 Zeile), mit dem Fix
-- nicht (0 Zeilen). Diese Form ist nicht konstruiert: sie ist ein PATCH auf
-- /club_members ohne Filter.
select testkit.affects('pending: kann seinen ANZEIGENAMEN nicht umschreiben (UPDATE OHNE where!)',
  $sql$update app.club_members set last_name = 'Neuling — vom Vorstand geprueft'$sql$, 0);
select testkit.affects('pending: kann auch E-Mail/Geburtsdatum nicht setzen (UPDATE OHNE where)',
  $sql$update app.club_members set email = 'vorstand@rsc-codeheim.example', birth_date = '1990-01-01'$sql$, 0);
-- Mit WHERE haelt zusaetzlich die SELECT-Policy — Tiefenstaffelung, kein Ersatz.
select testkit.affects('pending: … und mit WHERE haelt zusaetzlich club_members_select',
  $sql$update app.club_members set last_name = 'Zweiter Versuch'
        where id = 'a0e50000-0000-4000-8000-000000000009'$sql$, 0);

-- app.own_member_id sagte "ja, du bist Mitglied a0e5…09" — fuer eine
-- pending-Person schlicht FALSCH. In der RLS aufgefangen, im API-Zwilling
-- (lib/ownership.ts) NICHT: dort ist er der einzige Waechter in 17 Aufrufstellen.
select testkit.is_eq('pending: app.own_member_id liefert NULL (kein "ich" ohne Freigabe)',
  (select count(*) from (select app.own_member_id('c1ab0000-0000-4000-8000-0000000000e5') as m) s
    where s.m is not null), 0);

-- Gegenprobe — sonst beweisen die drei Nullen oben nur, dass die Abfrage
-- kaputt ist: dasselbe Statement, dieselbe Person, nur AKTIV.
set local role service_role;
select set_config('request.jwt.claims', '', true);
update app.club_members set status = 'active' where id = 'a0e50000-0000-4000-8000-000000000009';
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000091","role":"authenticated","club_roles":{}}', true);
set local role authenticated;

select testkit.affects('GEGENPROBE aktiv: dieselbe Person darf ihre Stammdaten sehr wohl pflegen',
  $sql$update app.club_members set last_name = 'Neuling-Vogler'
        where id = 'a0e50000-0000-4000-8000-000000000009'$sql$, 1);
select testkit.is_eq('GEGENPROBE aktiv: app.own_member_id liefert jetzt die Zeile',
  (select count(*) from (select app.own_member_id('c1ab0000-0000-4000-8000-0000000000e5') as m) s
    where s.m = 'a0e50000-0000-4000-8000-000000000009'), 1);

-- Der Gate ist WOERTLICH der aus member_role_keys (0025:47-49) — also faellt
-- auch eine abgelaufene Mitgliedschaft heraus, nicht nur eine pending.
set local role service_role;
select set_config('request.jwt.claims', '', true);
update app.club_members set role = 'guest_coach', valid_until = now() - interval '1 day'
 where id = 'a0e50000-0000-4000-8000-000000000009';
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000091","role":"authenticated","club_roles":{}}', true);
set local role authenticated;
select testkit.affects('abgelaufen: ein abgelaufener guest_coach schreibt nicht mehr an seiner Zeile',
  $sql$update app.club_members set last_name = 'Immer-noch-da'$sql$, 0);
select testkit.is_eq('abgelaufen: app.own_member_id liefert NULL',
  (select count(*) from (select app.own_member_id('c1ab0000-0000-4000-8000-0000000000e5') as m) s
    where s.m is not null), 0);
rollback;

-- ===========================================================================
-- (c2) ANZEIGE-WAHRHEIT — Steuerzeichen und Bandwuermer in Namen
-- ===========================================================================
begin;
set local role service_role;
select set_config('request.jwt.claims', '', true);

insert into app.clubs (id, name, city, join_code)
values ('c1ab0000-0000-4000-8000-0000000000e5', 'RSC Codeheim', 'Codeheim', 'ROTA-TST1');

-- Ein Name mit Zeilenumbruch taeuscht im Freigabe-Bildschirm eine zweite Zeile
-- vor. Die Zusage gilt in der DATENBANK, also fuer JEDEN Schreiber — nicht nur
-- fuer den Beitritts-Pfad, der sie in validation.ts schon frueher abfaengt.
select testkit.throws('Anzeige: ein Name mit Zeilenumbruch ist nicht speicherbar',
  $sql$insert into app.club_members (club_id, first_name, last_name, role, status)
       values ('c1ab0000-0000-4000-8000-0000000000e5', 'Max',
               E'Mustermann\nVom Vorstand bereits geprueft', 'member', 'pending')$sql$, '23514');
select testkit.throws('Anzeige: ein 200-Zeichen-Name ist nicht speicherbar',
  $sql$insert into app.club_members (club_id, first_name, last_name, role, status)
       values ('c1ab0000-0000-4000-8000-0000000000e5', repeat('A', 200), 'Lang', 'member', 'pending')$sql$,
  '23514');
-- Umlaute sind natuerlich KEINE Steuerzeichen (die Gegenprobe zur Regel).
select testkit.succeeds('Anzeige: Umlaute und Bindestriche bleiben selbstverstaendlich erlaubt',
  $sql$insert into app.club_members (club_id, first_name, last_name, role, status)
       values ('c1ab0000-0000-4000-8000-0000000000e5', 'Anna-Lena', 'Öztürk-Schäfer', 'member', 'pending')$sql$);
rollback;
