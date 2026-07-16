-- ============================================================================
-- 99d_registrierung.sql — Registrierung: Antrag, Freigabe, Code, Einwilligung.
--
-- DIE ZENTRALE BEHAUPTUNG DER MIGRATION 0034 IST EINE SICHERHEITSAUSSAGE:
--   "Ein richtiger Vereinscode ist ein ANTRAG, kein ZUTRITT."
-- Sie steht und faellt damit, dass status='pending' wirklich NICHTS sieht. Das
-- ist nicht selbstverstaendlich: es haengt einzig daran, dass
-- app.member_role_keys (0025:37-53) auf status='active' filtert und damit ~110
-- Policies auf 48 Tabellen leerlaufen laesst. Entfernt jemand diesen Filter,
-- MUSS ein Test schreien — sonst wird aus jedem Beitrittsantrag stillschweigend
-- ein Vollzugang und niemand merkt es.
--
-- Aufbau:
--   (a) Der pending-Gate  — sieht NICHTS, ueber sechs Tabellen
--   (b) Die Freigabe      — wirkt sofort, ohne neuen Token
--   (c) Der Code          — Zufall, Normalisierung, Ablauf/Widerruf
--   (d) Drossel/Protokoll — unsichtbar fuer authenticated, Loeschfrist echt
--   (e) Rechtstexte       — append-only, alte Fassung rekonstruierbar
--   (f) Einwilligungen    — RLS, append-only, kein Erklaeren im fremden Namen
--
-- Benutzt AUSSCHLIESSLICH die vorhandenen Helfer aus 00_testkit.sql
-- (ok/fail/is_eq/throws/succeeds/affects) — die Testkit-Datei bleibt unberuehrt.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Vorbereitung: ein Verein mit einem PENDING-Antrag von Nadja Neuling (…091).
-- service_role, weil protect_club_membership (0007:191) eine owner-Zeile nur
-- durchlaesst, wenn auth.uid() null ist ODER schon owner — beim ERSTEN Inhaber
-- eines neuen Vereins kann das niemand sein. Genau dieser Pfad ist gemeint
-- (0024:155) und genau ihn benutzt POST /clubs.
-- ---------------------------------------------------------------------------
begin;
set local role service_role;
select set_config('request.jwt.claims', '', true);

insert into app.clubs (id, name, city, join_code)
values ('c1ab0000-0000-4000-8000-0000000000d4', 'RSC Testheim', 'Testheim', 'TEST-D004');

insert into app.club_members (id, club_id, profile_id, first_name, last_name, role, status)
values ('a0d40000-0000-4000-8000-000000000001', 'c1ab0000-0000-4000-8000-0000000000d4',
        '90000000-0000-4000-8000-000000000090', 'Ida', 'Inhaber', 'owner', 'active');

-- DER ANTRAG.
insert into app.club_members (id, club_id, profile_id, first_name, last_name, role, status)
values ('a0d40000-0000-4000-8000-000000000002', 'c1ab0000-0000-4000-8000-0000000000d4',
        '90000000-0000-4000-8000-000000000091', 'Nadja', 'Neuling', 'member', 'pending');

-- Etwas, das der Antragsteller NICHT sehen darf.
insert into app.teams (id, club_id, name)
values ('b0d40000-0000-4000-8000-000000000001', 'c1ab0000-0000-4000-8000-0000000000d4', 'Testheim 1');

commit;

-- ===========================================================================
-- (a) DER PENDING-GATE — ein Antrag ist kein Zugang
-- ===========================================================================
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000091","role":"authenticated","club_roles":{}}',
  true);
set local role authenticated;

do $$
begin
  -- Der Mechanismus: leeres Rollen-Array TROTZ vorhandener Mitgliedszeile.
  perform testkit.is_eq('pending: member_role_keys ist LEER (0025:37-53 filtert auf active)',
    coalesce(array_length(app.member_role_keys('c1ab0000-0000-4000-8000-0000000000d4'), 1), 0)::bigint, 0);
  perform testkit.is_eq('pending: is_club_member = false',
    (case when app.is_club_member('c1ab0000-0000-4000-8000-0000000000d4') then 1 else 0 end)::bigint, 0);

  -- Die Folge. Mehrere Tabellen, weil die Aussage "faellt durch ALLE Policies"
  -- nur so belegt ist und nicht an einer einzelnen Policy haengt.
  perform testkit.is_eq('pending: sieht den Verein NICHT',
    (select count(*) from app.clubs where id = 'c1ab0000-0000-4000-8000-0000000000d4'), 0);
  perform testkit.is_eq('pending: sieht den Roster NICHT (nicht einmal sich selbst)',
    (select count(*) from app.club_members where club_id = 'c1ab0000-0000-4000-8000-0000000000d4'), 0);
  perform testkit.is_eq('pending: sieht Teams NICHT',
    (select count(*) from app.teams where club_id = 'c1ab0000-0000-4000-8000-0000000000d4'), 0);
  perform testkit.is_eq('pending: sieht Termine NICHT',
    (select count(*) from app.events where club_id = 'c1ab0000-0000-4000-8000-0000000000d4'), 0);
  perform testkit.is_eq('pending: sieht Rechnungen NICHT',
    (select count(*) from app.invoices where club_id = 'c1ab0000-0000-4000-8000-0000000000d4'), 0);
  perform testkit.is_eq('pending: sieht Kueren NICHT',
    (select count(*) from app.routines where club_id = 'c1ab0000-0000-4000-8000-0000000000d4'), 0);
end $$;

-- Selbst-Freigabe: RLS findet die Zeile gar nicht erst -> 0 betroffene Zeilen.
-- (Zusaetzlich stuende protect_club_membership 0007:216-222 davor.)
select testkit.affects('pending: kann sich NICHT selbst aktivieren',
  $sql$update app.club_members set status = 'active'
        where id = 'a0d40000-0000-4000-8000-000000000002'$sql$, 0);
rollback;

-- ===========================================================================
-- (b) DIE FREIGABE — ein UPDATE, und sie wirkt SOFORT (ohne neuen Token)
-- ===========================================================================
begin;
-- Der Inhaber gibt frei. Sein Claim ist ABSICHTLICH leer (club_roles:{}) —
-- damit beweist der Test, dass die Berechtigung aus member_roles kommt und
-- NICHT aus dem Token.
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000090","role":"authenticated","club_roles":{}}',
  true);
set local role authenticated;

select testkit.affects('Freigabe: owner aktiviert den Antrag (Claim ist LEER!)',
  $sql$update app.club_members set status = 'active'
        where id = 'a0d40000-0000-4000-8000-000000000002' and status = 'pending'$sql$, 1);

-- Perspektivwechsel INNERHALB derselben Transaktion: derselbe Zustand, andere
-- Person, KEIN neuer Token — exakt die Lage nach einer Freigabe im Betrieb.
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000091","role":"authenticated","club_roles":{}}',
  true);

do $$
begin
  perform testkit.is_eq('nach Freigabe: member_role_keys hat genau 1 Rolle',
    coalesce(array_length(app.member_role_keys('c1ab0000-0000-4000-8000-0000000000d4'), 1), 0)::bigint, 1);
  perform testkit.is_eq('nach Freigabe: is_club_member = true (OHNE Re-Login)',
    (case when app.is_club_member('c1ab0000-0000-4000-8000-0000000000d4') then 1 else 0 end)::bigint, 1);
  perform testkit.is_eq('nach Freigabe: sieht den Verein',
    (select count(*) from app.clubs where id = 'c1ab0000-0000-4000-8000-0000000000d4'), 1);
  perform testkit.is_eq('nach Freigabe: sieht die Teams',
    (select count(*) from app.teams where club_id = 'c1ab0000-0000-4000-8000-0000000000d4'), 1);
  perform testkit.is_eq('nach Freigabe: sieht den Roster (2 Personen)',
    (select count(*) from app.club_members where club_id = 'c1ab0000-0000-4000-8000-0000000000d4'), 2);
end $$;
rollback;

-- ===========================================================================
-- (c) DER CODE — Zufall, Normalisierung, Ablauf/Widerruf
-- ===========================================================================
begin;
set local role service_role;

do $$
declare
  v_codes text[];
  v_got   text;
begin
  select array_agg(app.generate_join_code()) into v_codes from generate_series(1, 500);

  -- Ein PRNG (v1: random()/md5) wuerde hier nicht auffallen — deshalb pruefen
  -- wir, was ueberhaupt pruefbar ist: Kollisionsfreiheit und Alphabet.
  perform testkit.is_eq('Code: 500 Codes -> 500 verschiedene',
    (select count(distinct c) from unnest(v_codes) c), 500);
  perform testkit.is_eq('Code: Format XXXX-XXXX, nur Crockford (kein I/L/O/U)',
    (select count(*) from unnest(v_codes) c
      where c !~ '^[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$'), 0);
  -- Gleichverteilung grob: bei 500 Codes x 8 Zeichen (4000 Ziehungen) muessen
  -- alle 32 Alphabetzeichen vorkommen. Ein festhaengendes Bit faellt hier auf.
  perform testkit.is_eq('Code: alle 32 Alphabetzeichen kommen vor (kein totes Bit)',
    (select count(distinct ch) from unnest(v_codes) c,
       lateral regexp_split_to_table(replace(c, '-', ''), '') ch), 32);

  -- Normalisierung: der Mensch tippt schlampig, der Code muss trotzdem greifen.
  v_got := app.normalize_join_code('abcd-1234');
  if v_got = 'ABCD1234' then perform testkit.ok('Code: Kleinschreibung + Trennzeichen normalisiert');
  else perform testkit.fail('Code: Kleinschreibung + Trennzeichen normalisiert', 'got ' || coalesce(v_got, 'NULL')); end if;

  v_got := app.normalize_join_code('OILO-1234');
  if v_got = '01101234' then perform testkit.ok('Code: Crockford O->0 und I/L->1');
  else perform testkit.fail('Code: Crockford O->0 und I/L->1', 'got ' || coalesce(v_got, 'NULL')); end if;

  perform testkit.is_eq('Code: Vertipper ''rsv-dem0-2o26'' trifft ''RSV-DEMO-2026''',
    (case when app.normalize_join_code('rsv-dem0-2o26') = app.normalize_join_code('RSV-DEMO-2026')
          then 1 else 0 end)::bigint, 1);
  perform testkit.is_eq('Code: Muell/leer -> NULL (faellt nie auf einen Verein)',
    (case when app.normalize_join_code('---') is null and app.normalize_join_code('') is null
          then 1 else 0 end)::bigint, 1);

  -- Ablauf/Widerruf: EINE Definition fuer Einloeser und Anzeige.
  perform testkit.is_eq('Code: frisch = aktiv',
    (case when app.join_code_is_active(null, null) then 1 else 0 end)::bigint, 1);
  perform testkit.is_eq('Code: widerrufen = NICHT aktiv',
    (case when app.join_code_is_active(null, now()) then 1 else 0 end)::bigint, 0);
  perform testkit.is_eq('Code: abgelaufen = NICHT aktiv',
    (case when app.join_code_is_active(now() - interval '1 second', null) then 1 else 0 end)::bigint, 0);
  perform testkit.is_eq('Code: Ablauf in der Zukunft = aktiv',
    (case when app.join_code_is_active(now() + interval '1 day', null) then 1 else 0 end)::bigint, 1);

  -- Der Vergleichsschluessel wird gepflegt, nicht nur beim INSERT gesetzt.
  v_got := (select join_code_normalized from app.clubs where id = 'c1ab0000-0000-4000-8000-0000000000d4');
  if v_got = 'TESTD004' then perform testkit.ok('Code: join_code_normalized per Trigger beim INSERT');
  else perform testkit.fail('Code: join_code_normalized per Trigger beim INSERT', 'got ' || coalesce(v_got, 'NULL')); end if;

  -- 'neu-code1' -> 'NEUC0DE1': das O wird zur 0. Sieht aus wie ein Tippfehler
  -- im Test, ist aber genau die Crockford-Regel — die Vergleichsform kennt
  -- kein O. Wer das hier "korrigiert", bricht die Tippfehler-Toleranz.
  update app.clubs set join_code = 'neu-code1' where id = 'c1ab0000-0000-4000-8000-0000000000d4';
  v_got := (select join_code_normalized from app.clubs where id = 'c1ab0000-0000-4000-8000-0000000000d4');
  if v_got = 'NEUC0DE1' then perform testkit.ok('Code: Trigger zieht bei UPDATE nach (O -> 0)');
  else perform testkit.fail('Code: Trigger zieht bei UPDATE nach (O -> 0)', 'got ' || coalesce(v_got, 'NULL')); end if;
end $$;
rollback;

-- Zwei Vereine duerfen nie Codes halten, die sich nur in O/0 unterscheiden —
-- der Einloeser faende sonst zwei Zeilen und muesste raten, welcher gemeint ist.
begin;
set local role service_role;
select testkit.throws('Code: O/0-Variante eines vergebenen Codes wird abgelehnt (unique auf normalized)',
  $sql$insert into app.clubs (name, city, join_code) values ('Kollision', 'X', 'TESTD0O4')$sql$,
  '23505');
rollback;

-- ===========================================================================
-- (d) DROSSEL + PROTOKOLL — fuer authenticated unsichtbar
-- ===========================================================================
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000091","role":"authenticated","club_roles":{}}',
  true);
set local role authenticated;

-- Wer sieht, wie nah er am Limit ist, weiss auch, wann er pausieren muss.
select testkit.throws('Drossel: internal.auth_rate_limits fuer authenticated unsichtbar',
  $sql$select count(*) from internal.auth_rate_limits$sql$, '42501');
select testkit.throws('Protokoll: internal.auth_events fuer authenticated unsichtbar',
  $sql$select count(*) from internal.auth_events$sql$, '42501');
-- Niemand darf fremde Zaehler hochtreiben und andere in die Sperre schieben.
select testkit.throws('Drossel: internal.rate_limit_hit fuer authenticated gesperrt',
  $sql$select * from internal.rate_limit_hit('ip', '1.2.3.4', 5, interval '1 hour')$sql$, '42501');
select testkit.throws('Protokoll: internal.purge_auth_events fuer authenticated gesperrt',
  $sql$select internal.purge_auth_events()$sql$, '42501');
rollback;

begin;
set local role service_role;
do $$
declare
  v_allowed boolean;
  v_retry   integer;
begin
  -- Limit 2: zwei durch, der dritte gesperrt — mit brauchbarem Retry-After.
  select allowed into v_allowed from internal.rate_limit_hit('code', 'TESTKIT-A', 2, interval '1 hour');
  perform testkit.is_eq('Drossel: 1. Versuch erlaubt', (case when v_allowed then 1 else 0 end)::bigint, 1);
  select allowed into v_allowed from internal.rate_limit_hit('code', 'TESTKIT-A', 2, interval '1 hour');
  perform testkit.is_eq('Drossel: 2. Versuch erlaubt', (case when v_allowed then 1 else 0 end)::bigint, 1);
  select allowed, retry_after into v_allowed, v_retry
    from internal.rate_limit_hit('code', 'TESTKIT-A', 2, interval '1 hour');
  perform testkit.is_eq('Drossel: 3. Versuch GESPERRT', (case when v_allowed then 1 else 0 end)::bigint, 0);
  perform testkit.is_eq('Drossel: Retry-After gesetzt und plausibel (1..3600 s)',
    (case when v_retry between 1 and 3600 then 1 else 0 end)::bigint, 1);

  -- Zaehlt auch im gesperrten Zustand weiter — sonst liesse sich die Sperre
  -- durch Dauerfeuer aussitzen.
  perform internal.rate_limit_hit('code', 'TESTKIT-A', 2, interval '1 hour');
  perform testkit.is_eq('Drossel: zaehlt auch im gesperrten Zustand weiter (nicht aussitzbar)',
    (select attempts from internal.auth_rate_limits
      where scope = 'code' and identifier = 'TESTKIT-A')::bigint, 4);

  -- Achsen sind getrennt: eine gesperrte code-Achse sperrt nicht die ip-Achse.
  select allowed into v_allowed from internal.rate_limit_hit('ip', 'TESTKIT-A', 2, interval '1 hour');
  perform testkit.is_eq('Drossel: andere Achse = eigener Zaehler',
    (case when v_allowed then 1 else 0 end)::bigint, 1);
end $$;

-- Die Loeschfrist ist echt, nicht nur eine Spalte.
insert into internal.auth_events (event, status, route, expires_at)
values ('join_code_invalid', 404, '/clubs/join', now() - interval '1 second');
select internal.purge_auth_events();
select testkit.is_eq('Protokoll: abgelaufene Zeilen werden wirklich geloescht',
  (select count(*) from internal.auth_events where expires_at <= now()), 0);

insert into internal.auth_events (event, status, route) values ('join_code_invalid', 404, '/clubs/join');
select testkit.is_eq('Protokoll: Vorgabefrist betraegt 14 Tage (Art. 5 Abs. 1 lit. e DSGVO)',
  (select round(extract(epoch from (expires_at - occurred_at)) / 86400)
     from internal.auth_events order by occurred_at desc limit 1)::bigint, 14);
rollback;

-- ===========================================================================
-- (e) RECHTSTEXTE — append-only, sonst ist jeder Nachweis wertlos
-- ===========================================================================
begin;
set local role service_role;

insert into internal.legal_documents (id, kind, version, locale, title, body, content_hash)
values ('e0d40000-0000-4000-8000-000000000001', 'privacy', 1, 'de',
        'Datenschutz v1', 'Fassung EINS', 'hash1');

-- DAS ist der Unterschied zu internal.platform_settings.legal (0019: ein
-- id=1-Singleton, per UPSERT ueberschrieben, 0019:65): dort waere Fassung 1
-- nach einer Aenderung spurlos weg und niemand koennte belegen, WELCHEM
-- Wortlaut jemand zugestimmt hat (Art. 7 Abs. 1 DSGVO).
-- Der Trigger schuetzt auch gegen service_role — ein Grant koennte das nicht.
select testkit.throws('Rechtstext: UPDATE gesperrt — auch fuer service_role',
  $sql$update internal.legal_documents set body = 'heimlich geaendert'
        where id = 'e0d40000-0000-4000-8000-000000000001'$sql$, '42501');
select testkit.throws('Rechtstext: DELETE gesperrt — auch fuer service_role',
  $sql$delete from internal.legal_documents where id = 'e0d40000-0000-4000-8000-000000000001'$sql$, '42501');

-- Eine neue Fassung ist eine neue ZEILE. Beide bleiben lesbar.
select testkit.succeeds('Rechtstext: neue Fassung anlegen',
  $sql$insert into internal.legal_documents (kind, version, locale, title, body, content_hash)
       values ('privacy', 2, 'de', 'Datenschutz v2', 'Fassung ZWEI', 'hash2')$sql$);
select testkit.is_eq('Rechtstext: beide Fassungen existieren nebeneinander',
  (select count(*) from internal.legal_documents where kind = 'privacy' and locale = 'de'), 2);
select testkit.is_eq('Rechtstext: der Wortlaut von Fassung 1 ist noch rekonstruierbar',
  (select count(*) from internal.legal_documents
    where kind = 'privacy' and locale = 'de' and version = 1 and body = 'Fassung EINS'), 1);
select testkit.throws('Rechtstext: (kind, locale, version) ist eindeutig',
  $sql$insert into internal.legal_documents (kind, version, locale, title, body, content_hash)
       values ('privacy', 2, 'de', 'Doppelte Fassung 2', 'X', 'h')$sql$, '23505');
rollback;

-- Rechtstexte muss man nachlesen koennen — sonst weiss niemand, wozu er Ja
-- gesagt hat. Die NACHBARTABELLEN im selben Schema bleiben trotzdem dicht.
begin;
set local role service_role;
insert into internal.legal_documents (kind, version, locale, title, body, content_hash)
values ('terms', 1, 'de', 'AGB v1', 'Platzhalter', 'h');
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000091","role":"authenticated","club_roles":{}}',
  true);
set local role authenticated;
select testkit.succeeds('Rechtstext: fuer jede angemeldete Person lesbar',
  $sql$select count(*) from internal.legal_documents$sql$);
select testkit.throws('Rechtstext: der SELECT-Grant oeffnet NICHT das ganze internal-Schema',
  $sql$select count(*) from internal.auth_events$sql$, '42501');
rollback;

-- ===========================================================================
-- (f) EINWILLIGUNGEN — RLS + append-only + kein Erklaeren im fremden Namen
-- ===========================================================================
begin;
set local role service_role;
select set_config('request.jwt.claims', '', true);
insert into app.consents (id, club_id, member_id, subject_profile_id, purpose, granted, granted_by_profile_id)
values ('c0d40000-0000-4000-8000-000000000001', 'c1ab0000-0000-4000-8000-0000000000d4',
        'a0d40000-0000-4000-8000-000000000002', '90000000-0000-4000-8000-000000000091',
        'photos_public', true, '90000000-0000-4000-8000-000000000091');

select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000091","role":"authenticated","club_roles":{}}',
  true);
set local role authenticated;

select testkit.is_eq('Einwilligung: die betroffene Person sieht die eigene',
  (select count(*) from app.consents where id = 'c0d40000-0000-4000-8000-000000000001'), 1);

-- Ein Widerruf als UPDATE loeschte den Beleg, dass die Einwilligung vorher
-- BESTAND — und damit die Rechtsgrundlage fuer alles bis dahin Geschehene.
select testkit.throws('Einwilligung: UPDATE gesperrt — Widerruf ist eine NEUE Zeile (Art. 7 Abs. 3)',
  $sql$update app.consents set granted = false where id = 'c0d40000-0000-4000-8000-000000000001'$sql$,
  '42501');
select testkit.throws('Einwilligung: DELETE fuer Endnutzer gesperrt (der Nachweis darf nicht verschwinden)',
  $sql$delete from app.consents where id = 'c0d40000-0000-4000-8000-000000000001'$sql$, '42501');

-- Niemand erklaert im Namen eines Dritten (granted_by = auth.uid()).
select testkit.throws('Einwilligung: granted_by MUSS die aufrufende Person sein',
  $sql$insert into app.consents
         (club_id, member_id, subject_profile_id, purpose, granted, granted_by_profile_id)
       values ('c1ab0000-0000-4000-8000-0000000000d4', 'a0d40000-0000-4000-8000-000000000001',
               '90000000-0000-4000-8000-000000000090', 'photos_public', true,
               '90000000-0000-4000-8000-000000000090')$sql$, '42501');

-- Und auch nicht fuer ein fremdes Kind, dessen Sorgeberechtigter er nicht ist.
select testkit.throws('Einwilligung: kein Erklaeren fuer ein fremdes Mitglied',
  $sql$insert into app.consents
         (club_id, member_id, subject_profile_id, purpose, granted, granted_by_profile_id)
       values ('c1ab0000-0000-4000-8000-0000000000d4', 'a0d40000-0000-4000-8000-000000000001',
               null, 'photos_public', true, '90000000-0000-4000-8000-000000000091')$sql$, '42501');

-- Ein Widerruf ALS NEUE ZEILE muss dagegen gehen.
select testkit.succeeds('Einwilligung: Widerruf als neue Zeile ist erlaubt',
  $sql$insert into app.consents
         (club_id, member_id, subject_profile_id, purpose, granted, granted_by_profile_id)
       values ('c1ab0000-0000-4000-8000-0000000000d4', 'a0d40000-0000-4000-8000-000000000002',
               '90000000-0000-4000-8000-000000000091', 'photos_public', false,
               '90000000-0000-4000-8000-000000000091')$sql$);
select testkit.is_eq('Einwilligung: beide Zeilen bleiben — der Verlauf ist der Nachweis',
  (select count(*) from app.consents
    where member_id = 'a0d40000-0000-4000-8000-000000000002' and purpose = 'photos_public'), 2);
rollback;

-- Ein absolutes DELETE-Verbot waere ein FEHLER gewesen: app.consents haengt an
-- 'on delete cascade' (club_id/member_id). Waere DELETE fuer jede Rolle
-- gesperrt, liesse sich ein Verein nie wieder loeschen — die Kaskade liefe in
-- den Trigger — und ein Loeschersuchen nach Art. 17 DSGVO waere unerfuellbar.
-- Fuer privilegierte Pfade MUSS die Loeschung deshalb gehen.
begin;
set local role service_role;
select set_config('request.jwt.claims', '', true);
insert into app.consents (id, club_id, member_id, subject_profile_id, purpose, granted, granted_by_profile_id)
values ('c0d40000-0000-4000-8000-000000000003', 'c1ab0000-0000-4000-8000-0000000000d4',
        'a0d40000-0000-4000-8000-000000000002', '90000000-0000-4000-8000-000000000091',
        'newsletter', true, '90000000-0000-4000-8000-000000000091');
select testkit.succeeds('Einwilligung: privilegierter Pfad darf loeschen (Art. 17 + Kaskade)',
  $sql$delete from app.consents where id = 'c0d40000-0000-4000-8000-000000000003'$sql$);
select testkit.throws('Einwilligung: UPDATE bleibt auch fuer service_role gesperrt',
  $sql$update app.consents set granted = false
        where id = 'c0d40000-0000-4000-8000-000000000001'$sql$, '42501');
rollback;

-- Mandantentrennung + Nachweispflicht der Mitglieder-Verwaltung.
begin;
set local role service_role;
select set_config('request.jwt.claims', '', true);
insert into app.consents (id, club_id, member_id, subject_profile_id, purpose, granted, granted_by_profile_id)
values ('c0d40000-0000-4000-8000-000000000002', 'c1ab0000-0000-4000-8000-0000000000d4',
        'a0d40000-0000-4000-8000-000000000002', '90000000-0000-4000-8000-000000000091',
        'photos_public', true, '90000000-0000-4000-8000-000000000091');

-- Katrin (…009) ist Mitglied im ANDEREN Verein — sie hat hier nichts zu suchen.
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000009","role":"authenticated","club_roles":{}}',
  true);
set local role authenticated;
select testkit.is_eq('Einwilligung: Fremder sieht sie NICHT (Mandantentrennung)',
  (select count(*) from app.consents where id = 'c0d40000-0000-4000-8000-000000000002'), 0);

-- Ida Inhaber (…090, owner in Testheim) MUSS sie sehen: ohne Nachweis darf sie
-- das Foto nicht verwenden.
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000090","role":"authenticated","club_roles":{}}',
  true);
select testkit.is_eq('Einwilligung: die Mitglieder-Verwaltung sieht sie (Nachweispflicht)',
  (select count(*) from app.consents where id = 'c0d40000-0000-4000-8000-000000000002'), 1);
rollback;

-- ---------------------------------------------------------------------------
-- Aufraeumen: die Vorbereitung oben lief mit COMMIT, also muss sie weg.
--
-- Der Verein wird SOFT-geloescht, nicht hart — und das ist keine Bequemlichkeit,
-- sondern der Bestand:
--   * app.club_members.club_id ist 'on delete restrict' (0002) -> solange ein
--     Verein Mitglieder hat, laesst er sich nicht loeschen;
--   * app.roles traegt eine Schutzwache ('system roles cannot be deleted -
--     rename or reconfigure instead'), und die Systemrollen legt der Trigger
--     clubs_rbac_seed (0024:74) bei JEDEM neuen Verein automatisch an.
-- Ein harter DELETE ist damit per Konstruktion unmoeglich. Soft-Delete ist
-- ohnehin das Hausmuster (deleted_at), und alle Policies filtern darauf.
-- ---------------------------------------------------------------------------
begin;
set local role service_role;
delete from app.member_roles  where club_id = 'c1ab0000-0000-4000-8000-0000000000d4';
delete from app.teams         where club_id = 'c1ab0000-0000-4000-8000-0000000000d4';
delete from app.club_members  where club_id = 'c1ab0000-0000-4000-8000-0000000000d4';
update app.clubs set deleted_at = now(), join_code = null
 where id = 'c1ab0000-0000-4000-8000-0000000000d4';
commit;
