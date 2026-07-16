-- ============================================================================
-- 99e_join_code_column_privilege.sql — Der Vereinscode ist eine SPALTE MIT
-- EIGENEM RECHT (Migration 0035).
--
-- DIE BEHAUPTUNG, DIE HIER FESTGENAGELT WIRD:
--   "Kein Mitglied kann den Vereinscode lesen — auch nicht am Postgres vorbei
--    an der API."
-- Das ist eine Aussage ueber GRANTS, nicht ueber Routen. Sie wird deshalb per
-- DIREKTEM SQL unter Impersonation geprueft: genau so, wie ein Angreifer mit
-- einem PostgREST-Token oder einer zweiten Route ankaeme. Ein Test, der die
-- API befragt, koennte nur beweisen, dass DIESE Route dicht ist — und genau
-- das war der Fehler, den 0035 behebt (die alte Redigierung JOIN_CODE_VISIBLE
-- in clubs.ts war dicht und die Datenbank trotzdem offen).
--
-- WARUM DAS EIN EIGENER TESTBLOCK IST, KEIN ANHANG AN 99d:
-- 99d prueft 0034 — den Code gegen RATEN (CSPRNG, Ablauf, Widerruf, Drossel).
-- Hier geht es um den Code gegen ABRUFEN. Zwei verschiedene Bedrohungen; die
-- erste war gehaertet, waehrend die zweite offenstand.
--
-- Aufbau:
--   (a) Das Spaltenrecht    — niemand mit `authenticated` liest den Code. NIEMAND.
--   (b) Der Rest der Zeile  — der Verein bleibt lesbar (sonst waere es Sabotage)
--   (c) Der Funktions-Gate  — owner/admin/moderator bekommt den Code, sonst 42501
--   (d) service_role        — der Beitritt per Code darf NICHT brechen
--   (e) Die Positivliste    — die Falle fuer den naechsten Autor schnappt laut zu
--
-- Fixtures aus seed.sql, Verein A (c1ab…0001, join_code 'RSV-DEMO-2026'):
--   …0002 Juergen Haeberle  owner        …0004 Thomas Krueger  admin
--   …0014 Petra Koehler     moderator    …0003 Beate Schaefer  treasurer
--   …0001 Sandra Vogel      coach        …0006 Milena Oeztuerk guest_coach
--   …0009 Katrin Gruenewald member (Mutter zweier Kinder im Verein)
--   …0091 Nadja Neuling     ueberhaupt kein Mitglied
--
-- club_roles ist in JEDEM Claim hier bewusst LEER ({}). Die Rechte kommen seit
-- 0025 aus app.member_roles, nicht aus dem Token — ein gefuellter Claim wuerde
-- verschleiern, was hier eigentlich aufloest.
--
-- Benutzt AUSSCHLIESSLICH die Helfer aus 00_testkit.sql — die Testkit-Datei
-- und alle Bestands-Suiten bleiben unberuehrt.
-- ============================================================================

-- ===========================================================================
-- (a) DAS SPALTENRECHT — der Kern des Ganzen.
--
-- Sechs Rollen, von der Mutter bis zum Vereinsinhaber, und ALLE sechs scheitern.
-- Dass auch der OWNER hier scheitert, ist kein Versehen, sondern der Beweis der
-- Bauart: ein Spaltenrecht haengt an der ROLLE `authenticated`, nicht an der
-- Person. Der Berechtigte kommt ueber app.club_join_code() an den Code (Block c)
-- — nicht ueber die Spalte. Wer diesen Test "repariert", indem er dem Inhaber
-- das Spaltenrecht zurueckgibt, gibt es ALLEN zurueck: `authenticated` ist die
-- Rolle jedes eingeloggten Kindes.
-- ===========================================================================
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000009","role":"authenticated","club_roles":{}}', true);
set local role authenticated;

do $$
begin
  -- DER BEFUND, WOERTLICH. Bis 0035 lieferte genau das den Code an die Mutter —
  -- und dieselbe Zeile an jedes Kind mit einem Konto.
  perform testkit.throws('Spaltenrecht: Mitglied liest join_code NICHT (direktes SQL)',
    $q$select join_code from app.clubs where id = 'c1ab0000-0000-4000-8000-000000000001'$q$,
    '42501');

  -- Die Vergleichsform ist derselbe Code. Waere sie offen, waere der Tresor zu
  -- und das Fenster daneben auf: normalize ist Tippfehler-Toleranz, keine
  -- Einwegfunktion.
  perform testkit.throws('Spaltenrecht: Mitglied liest join_code_normalized NICHT',
    $q$select join_code_normalized from app.clubs where id = 'c1ab0000-0000-4000-8000-000000000001'$q$,
    '42501');

  -- Der bequeme Weg, auf dem der Code bisher hinausging. `*` verlangt ALLE
  -- Spalten — auch die, die man nicht wollte. Deshalb scheitert er jetzt, und
  -- deshalb steht in clubs.ts ab 0035 eine Spaltenliste.
  perform testkit.throws('Spaltenrecht: `select *` auf app.clubs scheitert (kein Sammelrecht mehr)',
    $q$select * from app.clubs where id = 'c1ab0000-0000-4000-8000-000000000001'$q$,
    '42501');

  -- Auch nicht ueber die Hintertuer: eine WHERE-Bedingung liest die Spalte
  -- genauso. Sonst bliebe ein Orakel ("stimmt mein geratener Code?"), das die
  -- Drossel aus 0034 nicht sieht, weil es die API nie beruehrt.
  perform testkit.throws('Spaltenrecht: join_code auch im WHERE nicht lesbar (kein Rate-Orakel)',
    $q$select count(*) from app.clubs where join_code = 'RSV-DEMO-2026'$q$,
    '42501');
end $$;
rollback;

-- Der guest_coach: der Fall aus dem Befund. Er geht, sein Zugang laeuft ab —
-- ein alter Screenshot des Codes waere eine Dauer-Eintrittskarte fuer Antraege.
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000006","role":"authenticated","club_roles":{}}', true);
set local role authenticated;
select testkit.throws('Spaltenrecht: guest_coach liest join_code NICHT',
  $q$select join_code from app.clubs where id = 'c1ab0000-0000-4000-8000-000000000001'$q$, '42501');
rollback;

begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000001","role":"authenticated","club_roles":{}}', true);
set local role authenticated;
select testkit.throws('Spaltenrecht: coach liest join_code NICHT',
  $q$select join_code from app.clubs where id = 'c1ab0000-0000-4000-8000-000000000001'$q$, '42501');
rollback;

-- Der Inhaber. Siehe Kommentar oben: er MUSS hier scheitern.
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000002","role":"authenticated","club_roles":{}}', true);
set local role authenticated;
select testkit.throws('Spaltenrecht: nicht einmal der OWNER liest die Spalte direkt (Recht haengt an der Rolle, nicht an der Person)',
  $q$select join_code from app.clubs where id = 'c1ab0000-0000-4000-8000-000000000001'$q$, '42501');
rollback;

-- ===========================================================================
-- (b) DER REST DER ZEILE — die Gegenprobe.
--
-- Ein Recht, das den Verein unsichtbar macht, waere kein Schutz, sondern ein
-- Ausfall: jedes Mitglied braucht Name/Ort/Einstellungen. Und `count(*)` muss
-- weiter gehen — daran haengen die Mandanten-Tests (10_tenant_isolation:29).
-- Ohne diesen Block waere Block (a) auch dann gruen, wenn 0035 die Tabelle
-- versehentlich komplett gesperrt haette.
-- ===========================================================================
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000009","role":"authenticated","club_roles":{}}', true);
set local role authenticated;

do $$
begin
  perform testkit.succeeds('Gegenprobe: Mitglied liest weiterhin Name/Ort/Einstellungen',
    $q$select name, short_name, city, discipline, founded_year, settings, created_at, updated_at
         from app.clubs where id = 'c1ab0000-0000-4000-8000-000000000001'$q$);
  perform testkit.is_eq('Gegenprobe: Mitglied sieht seinen Verein (genau 1 Zeile)',
    (select count(*) from app.clubs where id = 'c1ab0000-0000-4000-8000-000000000001'), 1);
  perform testkit.is_eq('Gegenprobe: count(*) funktioniert weiter (Mandanten-Tests haengen daran)',
    (select count(*) from app.clubs), 1);

  -- Metadaten ueber den Code bleiben offen: sie verraten den Code nicht, und
  -- POST /clubs/{id}/join-code/revoke gibt join_code_revoked_at unter withUser
  -- zurueck (registration.ts:414) — waeren sie gesperrt, braeche das.
  perform testkit.succeeds('Gegenprobe: Ablauf/Widerruf-Zeitstempel bleiben lesbar (kein Geheimnis, aber gebraucht)',
    $q$select join_code_expires_at, join_code_revoked_at from app.clubs
        where id = 'c1ab0000-0000-4000-8000-000000000001'$q$);
end $$;
rollback;

-- ===========================================================================
-- (c) DER FUNKTIONS-GATE — app.club_join_code()
--
-- Der einzige Weg fuer authenticated an den Code. Der Gate sitzt IN der
-- Funktion (app.can_read_join_code, 0041), nicht in der Route: er gilt damit
-- auch fuer den, der die API umgeht.
-- ===========================================================================

-- Wer Mitglieder verwaltet, bekommt den Code — und zwar den echten Wert.
-- 'succeeds' genuegte hier nicht: eine Funktion, die brav NULL zurueckgibt,
-- waere gruen und trotzdem kaputt.
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000002","role":"authenticated","club_roles":{}}', true);
set local role authenticated;
select testkit.is_eq('Gate: owner bekommt den Code ueber app.club_join_code()',
  (select count(*) from app.club_join_code('c1ab0000-0000-4000-8000-000000000001')
    where join_code = 'RSV-DEMO-2026'), 1);
rollback;

begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000004","role":"authenticated","club_roles":{}}', true);
set local role authenticated;
select testkit.is_eq('Gate: admin bekommt den Code',
  (select count(*) from app.club_join_code('c1ab0000-0000-4000-8000-000000000001')
    where join_code = 'RSV-DEMO-2026'), 1);
rollback;

begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000014","role":"authenticated","club_roles":{}}', true);
set local role authenticated;
select testkit.is_eq('Gate: moderator bekommt den Code',
  (select count(*) from app.club_join_code('c1ab0000-0000-4000-8000-000000000001')
    where join_code = 'RSV-DEMO-2026'), 1);
rollback;

-- TREASURER: bekommt den Code NICHT.
--
-- Dieser Test stand hier bis 0041 andersherum. 0035 gab dem treasurer den Code
-- und begruendete es mit "members:manage = can_manage_members (0007:125), und
-- wer Mitglieder anlegen darf, vor dem ist der Beitrittscode kein sinnvolles
-- Geheimnis". Die Praemisse war falsch — nachgelesen:
--
--   0002:321-323  create policy club_members_insert on app.club_members
--                   with check (app.has_club_role(club_id, array['owner','admin']));
--
-- Mitglieder anlegen darf owner/admin, NICHT der treasurer. Der irrefuehrende
-- Satz stand in einem KOMMENTAR des Katalogs (0023:171), nicht in der Policy.
-- Damit dreht sich das Argument um: der Code waere fuer den treasurer der
-- EINZIGE Weg, Menschen in den Verein zu bringen — also sehr wohl ein
-- sinnvolles Geheimnis, und ihn zu geben waere eine Rechteausweitung.
-- Gate ab 0041: app.can_read_join_code() = owner/admin/moderator, dieselbe
-- Liste, die rotieren/widerrufen darf (registration.ts). Dieser Test steht
-- hier, damit die Entscheidung sichtbar ist und nicht aus Versehen wieder kippt.
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000003","role":"authenticated","club_roles":{}}', true);
set local role authenticated;
select testkit.throws('Gate: treasurer bekommt den Code NICHT (0041 — er darf keine Mitglieder anlegen)',
  $sql$select count(*) from app.club_join_code('c1ab0000-0000-4000-8000-000000000001')$sql$, '42501');
-- Und auch nicht auf der Wahrheitstabelle vorbei an der Funktion (RLS, 0041).
select testkit.is_eq('Gate: treasurer sieht auch app.club_join_codes nicht (dieselbe Regel, ein Regelwerk)',
  (select count(*) from app.club_join_codes
    where club_id = 'c1ab0000-0000-4000-8000-000000000001'), 0);
rollback;

-- Und die, die nicht duerfen.
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000009","role":"authenticated","club_roles":{}}', true);
set local role authenticated;
select testkit.throws('Gate: einfaches Mitglied bekommt 42501',
  $q$select * from app.club_join_code('c1ab0000-0000-4000-8000-000000000001')$q$, '42501');
rollback;

begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000001","role":"authenticated","club_roles":{}}', true);
set local role authenticated;
select testkit.throws('Gate: coach bekommt 42501 (Training ist nicht Mitgliederverwaltung)',
  $q$select * from app.club_join_code('c1ab0000-0000-4000-8000-000000000001')$q$, '42501');
rollback;

begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000006","role":"authenticated","club_roles":{}}', true);
set local role authenticated;
select testkit.throws('Gate: guest_coach bekommt 42501',
  $q$select * from app.club_join_code('c1ab0000-0000-4000-8000-000000000001')$q$, '42501');
rollback;

-- Ein Fremder bekommt DIESELBE Antwort wie ein unberechtigtes Mitglied: kein
-- Orakel darueber, ob es den Verein ueberhaupt gibt.
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000091","role":"authenticated","club_roles":{}}', true);
set local role authenticated;
do $$
begin
  perform testkit.throws('Gate: Nicht-Mitglied bekommt 42501 (fremder Verein)',
    $q$select * from app.club_join_code('c1ab0000-0000-4000-8000-000000000001')$q$, '42501');
  perform testkit.throws('Gate: erfundene Vereins-ID bekommt dieselbe 42501 (kein Existenz-Orakel)',
    $q$select * from app.club_join_code('c1ab0000-0000-4000-8000-00000000beef')$q$, '42501');
end $$;
rollback;

-- Ein LUEGENDER Claim hilft nicht: club_roles im Token behauptet owner, die DB
-- weiss es besser (0025 loest aus app.member_roles auf). Ohne diesen Test
-- koennte jemand den Gate versehentlich auf den Claim umstellen und alles
-- bliebe gruen.
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000009","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"owner"}}', true);
set local role authenticated;
select testkit.throws('Gate: gefaelschter owner-Claim nuetzt nichts (DB loest auf, nicht das Token)',
  $q$select * from app.club_join_code('c1ab0000-0000-4000-8000-000000000001')$q$, '42501');
rollback;

-- anon hatte nie ein Recht auf app.clubs und bekommt hier keines — auch nicht
-- ueber die neue Funktion (grant execute nur an authenticated/service_role).
begin;
select set_config('request.jwt.claims', '', true);
set local role anon;
select testkit.throws('Gate: anon darf app.club_join_code() nicht einmal aufrufen',
  $q$select * from app.club_join_code('c1ab0000-0000-4000-8000-000000000001')$q$, '42501');
rollback;

-- ===========================================================================
-- (d) service_role — DER BEITRITT DARF NICHT BRECHEN.
--
-- registration.ts:151 sucht den Verein ueber join_code_normalized im
-- Service-Mode. Haette 0035 dem service_role etwas weggenommen, waere der
-- Beitritt per Code tot — ein Spaltenrecht, das die Anwendung erschlaegt, ist
-- kein Sicherheitsgewinn, sondern ein Ausfall.
-- ===========================================================================
begin;
set local role service_role;
select set_config('request.jwt.claims', '', true);
do $$
begin
  perform testkit.is_eq('service_role: Beitritt per Code findet den Verein weiterhin (registration.ts:151)',
    (select count(*) from app.clubs
      where join_code_normalized = app.normalize_join_code('RSV-DEMO-2026')
        and deleted_at is null), 1);
  perform testkit.succeeds('service_role: `select *` auf app.clubs geht weiter (POST /clubs laeuft hier)',
    $q$select * from app.clubs where id = 'c1ab0000-0000-4000-8000-000000000001'$q$);
end $$;
rollback;

-- ===========================================================================
-- (e) DIE POSITIVLISTE — die Falle fuer den naechsten Autor.
--
-- 0035 nimmt `authenticated` das TABELLENrecht und gibt Spaltenrechte zurueck.
-- Folge: eine SPAETER hinzugefuegte Spalte ist fuer authenticated unsichtbar,
-- bis jemand sie in 0035 eintraegt. Das ist die richtige Richtung (fail-closed),
-- aber es ist eine stille Falle — eine neue Spalte 'iban' waere sofort dicht,
-- eine neue Spalte 'motto' waere unerklaerlich leer.
--
-- Dieser Test nagelt die Liste an pg_attribute: er schlaegt fehl, sobald eine
-- Spalte dazukommt (dann sind es 3 statt 2 gesperrte) ODER sobald jemand das
-- Tabellenrecht zurueckgibt (dann sind es 0). Beide Male ist die Meldung
-- richtig: "sieh dir 0035 an".
-- ===========================================================================
begin;
do $$
declare
  v_gesperrt text;
begin
  select coalesce(string_agg(a.attname, ', ' order by a.attname), '(keine)')
    into v_gesperrt
  from pg_attribute a
  where a.attrelid = 'app.clubs'::regclass
    and a.attnum > 0
    and not a.attisdropped
    and not has_column_privilege('authenticated', a.attrelid, a.attnum, 'select');

  if v_gesperrt = 'join_code, join_code_normalized' then
    perform testkit.ok('Positivliste: EXAKT join_code + join_code_normalized sind fuer authenticated gesperrt');
  else
    perform testkit.fail('Positivliste: EXAKT join_code + join_code_normalized sind fuer authenticated gesperrt',
      format('gesperrt ist: %s — neue Spalte in app.clubs? Dann gehoert sie in die grant-Liste in 0035 (oder bewusst nicht).', v_gesperrt));
  end if;

  -- Das Pauschalrecht darf NICHT zurueckkommen: mit Tabellenrecht waere jedes
  -- Spalten-revoke wirkungslos (Postgres warnt nur) und der Code wieder offen.
  perform testkit.is_eq('Positivliste: authenticated hat KEIN Tabellenrecht select auf app.clubs mehr',
    (case when has_table_privilege('authenticated', 'app.clubs', 'select') then 1 else 0 end)::bigint, 0);

  -- Gegenprobe zur Zeile darueber: service_role muss es behalten.
  perform testkit.is_eq('Positivliste: service_role behaelt volles select auf app.clubs',
    (case when has_table_privilege('service_role', 'app.clubs', 'select') then 1 else 0 end)::bigint, 1);
end $$;
rollback;
