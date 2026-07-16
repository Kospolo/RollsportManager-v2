-- ============================================================================
-- 99f_pending_matrix.sql — der pending-MENSCH als SUBJEKT, gegen den echten
-- Datenbestand, ueber die ganze Breite.
--
-- WORUM ES GEHT:
-- Der gesamte Entwurf der Registrierung steht auf EINEM Satz (0034:9-18):
--   "Ein richtiger Vereinscode ist ein ANTRAG, kein ZUTRITT."
-- Er ist NICHT selbstverstaendlich. Er haengt an genau einer Zeile —
-- app.member_role_keys (0025:47) filtert auf m.status = 'active' — und laesst
-- darueber ~110 Policies auf 48 Tabellen leerlaufen. Faellt dieser Filter,
-- wird aus jedem Beitrittsantrag stillschweigend ein Vollzugang.
--
-- WAS 99d_registrierung.sql SCHON LEISTET (nachgelesen, nicht angenommen):
-- Es prueft den pending-Gate bereits mit einem echten JWT-Subjekt (Nadja
-- Neuling, …091) ueber sechs Tabellen — allerdings in einem EIGENS DAFUER
-- angelegten, LEEREN Verein (RSC Testheim, c1ab…d4). Das ist die Luecke, die
-- diese Datei schliesst: in einem Verein mit einer Handvoll Zeilen beweist
-- "0 Zeilen" wenig. Hier laeuft die Matrix gegen RSV Neckarsulm — den Seed-
-- Verein mit 24 Mitgliedern, Teams, Terminen, Kuere, Rechnungen, Chat,
-- Dokumenten, Gesundheitsdaten von KINDERN.
--
-- DIE GEGENPROBE IST PFLICHT, NICHT KUER:
-- Eine Reihe Nullen beweist nur, dass die Abfrage etwas liefert, was 0 ist.
-- Deshalb faehrt JEDE Tabelle zweimal: einmal als pending-Antragstellerin
-- (muss 0 sehen) und einmal als AKTIVES Mitglied (muss > 0 sehen). Erst das
-- Paar ist ein Beweis.
--
-- WARUM DIE VORBEREITUNG NICHT IM SEED STEHT (bewusste Entscheidung):
-- Eine pending-Persona MIT profile_id im Seed-Verein waere die 25. Zeile im
-- Roster — und der Bestand ist darauf festgenagelt:
--   30_guest_coach_expiry.sql:24  "sees the roster (24)"
--   93_rbac.sql:112               24 Mitglieder mit genau einer Rollenzeile
--   90_roles_matrix.sql:139/143   genau 2 Vereine / 2 distinct club_ids
-- Diese Suiten duerfen nicht angefasst werden. Die Antragstellerin entsteht
-- deshalb HIER, in einer Transaktion mit ROLLBACK — sie ist nach dem letzten
-- Test spurlos weg und keine andere Suite sieht sie je.
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- Nadja Neuling (…091) stellt ihren Antrag bei RSV Neckarsulm. Genau das, was
-- POST /clubs/join mit einem richtigen Code tut: eine Zeile, status='pending'.
-- service_role, weil es fuer "Fremder stellt Antrag" keine INSERT-Policy gibt
-- und geben soll (sie muesste jedem Fremden den Roster jedes Vereins oeffnen).
-- ---------------------------------------------------------------------------
set local role service_role;
select set_config('request.jwt.claims', '', true);

insert into app.club_members (id, club_id, profile_id, first_name, last_name, role, status)
values ('a0f00000-0000-4000-8000-000000000091', 'c1ab0000-0000-4000-8000-000000000001',
        '90000000-0000-4000-8000-000000000091', 'Nadja', 'Neuling', 'member', 'pending');

-- Die Zeile ist da. Das ist der Ausgangspunkt: sie IST im Roster des Vereins.
select testkit.is_eq('Antrag: die Mitgliedszeile existiert wirklich (sonst prueft alles Folgende nichts)',
  (select count(*) from app.club_members
    where id = 'a0f00000-0000-4000-8000-000000000091' and status = 'pending'), 1);

-- ---------------------------------------------------------------------------
-- DER MECHANISMUS. Wenn diese beiden Zeilen fallen, faellt alles Weitere mit —
-- sie sind die Ursache, der Rest ist Wirkung.
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000091","role":"authenticated","club_roles":{}}', true);
set local role authenticated;

do $$
begin
  perform testkit.is_eq('pending/Bestand: member_role_keys ist LEER — TROTZ Mitgliedszeile (0025:47)',
    coalesce(array_length(app.member_role_keys('c1ab0000-0000-4000-8000-000000000001'), 1), 0)::bigint, 0);
  perform testkit.is_eq('pending/Bestand: is_club_member = false',
    (case when app.is_club_member('c1ab0000-0000-4000-8000-000000000001') then 1 else 0 end)::bigint, 0);
  perform testkit.is_eq('pending/Bestand: has_club_role(member) = false',
    (case when app.has_club_role('c1ab0000-0000-4000-8000-000000000001', array['member']) then 1 else 0 end)::bigint, 0);
  perform testkit.is_eq('pending/Bestand: own_member_id = NULL (sie ist noch niemand hier)',
    (select count(*) from (select app.own_member_id('c1ab0000-0000-4000-8000-000000000001') as m) s
      where s.m is not null), 0);
end $$;

-- ---------------------------------------------------------------------------
-- DIE MATRIX. Dieselbe Abfrage, zwei Personen:
--   Nadja   (…091) = pending -> MUSS 0 sehen
--   Juergen (…002) = active  -> MUSS > 0 sehen  (Gegenprobe)
--
-- WARUM DER INHABER DIE GEGENPROBE FAEHRT und nicht ein einfaches Mitglied:
-- Die Gegenprobe soll EINE Sache beweisen — dass in dieser Tabelle ueberhaupt
-- sichtbare Zeilen dieses Vereins liegen und meine Abfrage sie findet. Ein
-- einfaches Mitglied sieht Kassenbuch, Aufgaben oder Notizen von Berufs wegen
-- nicht; mit ihm als Kontrolle waere "0 Zeilen" mehrdeutig (kein Recht ODER
-- keine Daten ODER kaputte Abfrage) — und genau diese Mehrdeutigkeit soll hier
-- verschwinden. Was ein MITGLIED nach der Freigabe sieht, prueft der letzte
-- Block dieser Datei.
--
-- Die Liste ist GEMESSEN (unter Impersonation, in einer Transaktion), nicht
-- geraten: jede dieser Tabellen fuehrt aus Sicht des Inhabers >= 1 Zeile.
-- Bewusst NICHT dabei:
--   app.notes       — 0 Zeilen fuer den Inhaber. Notizen sind privat pro
--                     Verfasser (notes_select: owner_profile_id = auth.uid(),
--                     0008:140-142); die Seed-Notiz gehoert Sandra Vogel. Fuer
--                     eine Gegenprobe taugt die Tabelle damit nicht — niemand
--                     "sieht sie als Vereinsmitglied".
--   app.consents    — 0 Zeilen im Seed.
--   app.products / app.entitlements — keine club_id-Spalte.
-- Eine Gegenprobe, die nichts findet, beweist nichts.
--
-- 32 Tabellen quer durch alle Cluster: die Behauptung lautet "faellt durch ALLE
-- Policies", nicht "faellt durch die eine, die ich gerade getestet habe".
-- Kinderdaten (Anwesenheit, Fotos, Kuere, Sorgeberechtigte) sind absichtlich
-- dabei — dort ist der Schaden am groessten.
-- ---------------------------------------------------------------------------
do $$
declare
  t            text;
  v_pending    bigint;
  v_active     bigint;
  c_club       constant text := 'c1ab0000-0000-4000-8000-000000000001';
  c_claims_p   constant text := '{"sub":"90000000-0000-4000-8000-000000000091","role":"authenticated","club_roles":{}}';
  c_claims_a   constant text := '{"sub":"90000000-0000-4000-8000-000000000002","role":"authenticated","club_roles":{}}';
  matrix_tables constant text[] := array[
    'clubs', 'club_members', 'teams', 'team_members', 'events', 'attendance',
    'event_rsvps', 'routines', 'routine_markers', 'routine_skaters', 'invoices',
    'ledger_entries', 'ledger_categories', 'documents', 'news', 'tasks',
    'guardianships', 'training_slots', 'facilities', 'equipment', 'chat_messages',
    'media_assets', 'gallery_items', 'exercises', 'achievements', 'checkins',
    'lockers', 'member_fees', 'membership_categories', 'competitions',
    'competition_entries', 'duty_requirements'
  ];
begin
  foreach t in array matrix_tables loop
    -- 1. Die Antragstellerin.
    perform set_config('request.jwt.claims', c_claims_p, true);
    if t = 'clubs' then
      execute format('select count(*) from app.%I where id = %L', t, c_club) into v_pending;
    else
      execute format('select count(*) from app.%I where club_id = %L', t, c_club) into v_pending;
    end if;

    -- 2. Dieselbe Abfrage als aktives Mitglied.
    perform set_config('request.jwt.claims', c_claims_a, true);
    if t = 'clubs' then
      execute format('select count(*) from app.%I where id = %L', t, c_club) into v_active;
    else
      execute format('select count(*) from app.%I where club_id = %L', t, c_club) into v_active;
    end if;

    -- Erst die Gegenprobe: ohne sie waere die 0 darunter wertlos.
    if v_active = 0 then
      perform testkit.fail(
        format('GEGENPROBE app.%s: der aktive Inhaber sieht Zeilen', t),
        '0 Zeilen — die Abfrage taugt nicht als Beweis (leere Tabelle? falsche Spalte?)');
    end if;
    perform testkit.ok(format('GEGENPROBE app.%s: der aktive Inhaber sieht %s Zeile(n)', t, v_active));

    perform testkit.is_eq(format('pending sieht app.%s NICHT (aktiv: %s Zeilen)', t, v_active),
      v_pending, 0);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Nicht nur LESEN. Ein Antragsteller darf auch nichts anfassen — und zwar
-- weder still (RLS filtert -> 0 Zeilen) noch laut (42501/P0001).
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000091","role":"authenticated","club_roles":{}}', true);

-- OHNE where-Klausel, und das ist Absicht: sobald ein UPDATE Zeilen lesen muss
-- (WHERE!), verlangt Postgres SELECT-Recht und club_members_select versteckt
-- die Zeile ohnehin — ein solcher Test waere gruen, auch wenn die Schreibsperre
-- offen stuende. Ohne WHERE zaehlt allein das USING der UPDATE-Policy. Die
-- Zeilen unten treffen damit hoechstens EINE Zeile: ihre eigene.
select testkit.affects('pending: kann sich NICHT selbst freischalten (UPDATE OHNE where)',
  $sql$update app.club_members set status = 'active'$sql$, 0);
select testkit.affects('pending: kann sich KEINE Rolle geben (UPDATE OHNE where)',
  $sql$update app.club_members set role = 'admin'$sql$, 0);
-- Rollen sind fuer sie nicht einmal sichtbar …
select testkit.is_eq('pending: sieht die Rollen-Vorlagen des Vereins NICHT',
  (select count(*) from app.roles where club_id = 'c1ab0000-0000-4000-8000-000000000001'), 0);

-- … aber "sie findet die role_id nicht" waere ein duenner Beweis. Ein Angreifer
-- muss sie nicht finden: UUIDs stehen in Fehlermeldungen, Logs, Exporten oder
-- stammen aus einer frueheren Mitgliedschaft.
--
-- Diese Zeile ist der Grund, warum der erste Anlauf dieses Tests WERTLOS war:
-- als 'insert ... select ... from app.roles' geschrieben, filterte die RLS die
-- Quelle auf 0 Zeilen -> der INSERT fuegte nichts ein und warf KEINEN Fehler.
-- "Statement erfolgreich" haette dann wie eine Luecke ausgesehen und
-- "0 eingefuegt" wie ein Beweis — beides falsch. Deshalb bekommt sie die id
-- hier GESCHENKT (ueber eine temporaere Tabelle, an der keine RLS haengt), und
-- erst dann zaehlt, was app.protect_member_roles (0024:181-185) dazu sagt.
set local role service_role;
create temporary table t2_role_ids on commit drop as
  select key, id from app.roles where club_id = 'c1ab0000-0000-4000-8000-000000000001';
grant select on t2_role_ids to authenticated;
set local role authenticated;

select testkit.throws('pending: kann sich keine owner-Rolle danebenlegen — SELBST MIT der role_id',
  format($sql$insert into app.member_roles (club_id, member_id, role_id) values (%L, %L, %L)$sql$,
         'c1ab0000-0000-4000-8000-000000000001', 'a0f00000-0000-4000-8000-000000000091',
         (select id from t2_role_ids where key = 'owner')),
  'P0001');
select testkit.throws('pending: auch keine harmlose member-Rolle (Selbstvergabe ist Selbstvergabe)',
  format($sql$insert into app.member_roles (club_id, member_id, role_id) values (%L, %L, %L)$sql$,
         'c1ab0000-0000-4000-8000-000000000001', 'a0f00000-0000-4000-8000-000000000091',
         (select id from t2_role_ids where key = 'member')),
  'P0001');
select testkit.throws('pending: kann kein Team anlegen',
  $sql$insert into app.teams (club_id, name)
       values ('c1ab0000-0000-4000-8000-000000000001', 'Antragsteller-Team')$sql$, '42501');
select testkit.throws('pending: kann keine Anwesenheit von Kindern schreiben',
  $sql$insert into app.attendance (club_id, event_id, member_id, status)
       values ('c1ab0000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000004',
               'a0000000-0000-4000-8000-000000000020', 'present')$sql$, '42501');
select testkit.affects('pending: kann keine fremden Stammdaten aendern (Kind im Verein)',
  $sql$update app.club_members set first_name = 'Uebernommen'
        where id = 'a0000000-0000-4000-8000-000000000020'$sql$, 0);

-- ---------------------------------------------------------------------------
-- DIE FREIGABE — und erst sie oeffnet die Tuer. Ohne diesen Nachweis koennte
-- die ganze Datei auch dann gruen sein, wenn Nadjas Token schlicht kaputt ist.
-- Kein neuer Token, dieselbe Transaktion: exakt die Lage im Betrieb.
-- ---------------------------------------------------------------------------
set local role service_role;
select set_config('request.jwt.claims', '', true);
update app.club_members set status = 'active', joined_on = current_date
 where id = 'a0f00000-0000-4000-8000-000000000091';

select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000091","role":"authenticated","club_roles":{}}', true);
set local role authenticated;

do $$
begin
  perform testkit.is_eq('nach Freigabe: member_role_keys hat genau 1 Rolle (OHNE Re-Login)',
    coalesce(array_length(app.member_role_keys('c1ab0000-0000-4000-8000-000000000001'), 1), 0)::bigint, 1);
  perform testkit.is_eq('nach Freigabe: sie sieht den Verein',
    (select count(*) from app.clubs where id = 'c1ab0000-0000-4000-8000-000000000001'), 1);
  perform testkit.is_eq('nach Freigabe: sie sieht den Roster (24 + sie selbst)',
    (select count(*) from app.club_members
      where club_id = 'c1ab0000-0000-4000-8000-000000000001'), 25);
  perform testkit.is_eq('nach Freigabe: sie sieht die Termine',
    (case when (select count(*) from app.events
                 where club_id = 'c1ab0000-0000-4000-8000-000000000001') > 0
          then 1 else 0 end)::bigint, 1);
end $$;

-- Der Antrag war NUR der Antrag: als frisch freigegebenes MITGLIED bekommt sie
-- die Rechte eines Mitglieds — und keine daneben.
select testkit.is_eq('nach Freigabe: sie ist Mitglied, nicht Vorstand',
  (select count(*) from unnest(app.member_role_keys('c1ab0000-0000-4000-8000-000000000001')) k
    where k <> 'member'), 0);
select testkit.throws('nach Freigabe: ein Mitglied legt weiterhin kein Team an',
  $sql$insert into app.teams (club_id, name)
       values ('c1ab0000-0000-4000-8000-000000000001', 'Mitglieds-Team')$sql$, '42501');

-- ROLLBACK: die Antragstellerin verschwindet spurlos. Der Seed bleibt exakt so,
-- wie ihn 30_guest_coach_expiry.sql:24 und 93_rbac.sql:112 erwarten.
rollback;
