-- ============================================================================
-- 0034_registrierung.sql — Selbstanlage von Vereinen + Beitritt per Code.
--
-- WARUM DIESE MIGRATION UEBERHAUPT:
-- Bis hierher konnte sich weder ein Verein noch eine Person anmelden. Es gab
-- app.clubs.join_code (0002:38, "invite/onboarding code (v1 flow)") — eine
-- Spalte, die NIEMAND liest: kein Generator, kein Einloeser, kein Widerruf.
--
-- DER ENTSCHEIDENDE BEFUND (verifiziert, nicht uebernommen):
-- Der Torwaechter ist bereits gebaut. app.member_role_keys (0025:37-53) filtert
-- hart auf m.status = 'active'; app.is_club_member (0025:85-94) ist
-- 'is_platform_admin() or array_length(member_role_keys(club_id),1) > 0'.
-- Eine Person mit status='pending' bekommt damit ein LEERES Rollen-Array und
-- faellt durch JEDE Policy, die auf is_club_member/has_club_role steht.
-- -> Ein Beitrittsantrag braucht KEINE eigene Tabelle. club_members mit
--    status='pending' (Enum aus 0002:25-26) IST der Antrag, und die Freigabe
--    ist ein UPDATE auf status. Sie wirkt SOFORT, ohne Re-Login, weil 0025 die
--    Rollen aus der DB aufloest und nicht mehr aus dem JWT.
-- Diese Migration baut deshalb bewusst WENIG: sie macht den Code sicher,
-- widerrufbar und nachweisbar — die Zugangskontrolle steht schon.
--
-- INHALT
--   1. join_code: CSPRNG-Generator (Crockford-Base32), Ablauf, Widerruf
--   2. internal.auth_rate_limits — Drosselung auf drei Achsen
--   3. internal.auth_events — Protokoll fuer 401/429 + Loeschfrist
--   4. internal.legal_documents — versionierte Rechtstexte (APPEND-ONLY)
--   5. app.consents — granulare Einwilligungen (APPEND-ONLY, Art. 7/8 DSGVO)
-- ============================================================================

begin;

-- ============================================================================
-- 1. JOIN_CODE — vorhersagbar war gestern
-- ============================================================================
--
-- v1 erzeugte Codes mit random()/md5 (20260118_sync_ios_android_models.sql:47).
-- random() ist ein deterministischer PRNG: wer eine Ausgabe kennt, kann den
-- Zustand rekonstruieren und die naechsten Codes VORHERSAGEN. Der Code ist hier
-- der einzige Faktor vor einem Beitrittsantrag -> er MUSS aus einem CSPRNG
-- kommen.
--
-- ENTROPIE-QUELLE: gen_random_uuid(), NICHT gen_random_bytes(). Grund:
-- pgcrypto ist in diesem Stack NIRGENDS installiert (kein 'create extension'
-- in irgendeiner Migration) — gen_random_bytes() waere schlicht ein Fehler
-- gewesen. gen_random_uuid() ist seit PG13 im Kern und zieht aus
-- pg_strong_random() (OpenSSL RAND_bytes bzw. /dev/urandom), also derselben
-- CSPRNG-Quelle wie pgcrypto. Es ist ausserdem exakt das Muster, das
-- app.uuid_v7 (0001:64-72) schon benutzt: gen_random_uuid() + uuid_send().
-- Von den 16 Bytes sind Byte 0-5 voll zufaellig (die Versionsnibble sitzt in
-- Byte 6, die Variantenbits in Byte 8) -> Byte 0-4 = 40 unverzerrte Bits.
--
-- Crockford-Base32: keine I/L/O/U. Damit gibt es keine Verwechslung 0/O und
-- 1/I/l, und "U" faellt weg, damit kein Zufallscode ein Schimpfwort bildet.
-- 8 Zeichen a 5 Bit = 40 Bit = 1.099.511.627.776 Moeglichkeiten. Zusammen mit
-- der Drosselung pro Code (siehe 2.) ist Raten aussichtslos.
-- ----------------------------------------------------------------------------

alter table app.clubs
  add column if not exists join_code_expires_at timestamptz,
  add column if not exists join_code_revoked_at timestamptz,
  add column if not exists join_code_normalized text;

comment on column app.clubs.join_code is
  'Einladungscode in Anzeigeform (XXXX-XXXX). Erzeugt aus gen_random_bytes (CSPRNG), Crockford-Base32. Vergleich NIE gegen diese Spalte — dafuer ist join_code_normalized da.';
comment on column app.clubs.join_code_expires_at is
  'Ablauf des Codes. NULL = laeuft nie ab. Abgelaufene Codes werden vom Einloeser wie ein falscher Code behandelt (keine Auskunft).';
comment on column app.clubs.join_code_revoked_at is
  'Widerruf. Der Code landet in WhatsApp-Gruppen und Aushaengen — er MUSS ohne Vereins-Neuanlage ungueltig gemacht werden koennen.';
comment on column app.clubs.join_code_normalized is
  'Vergleichsform des Codes (Crockford-dekodiert: Trennzeichen weg, Grossschreibung, I/L->1, O->0). Trigger-gepflegt, eindeutig. Tippfehler-tolerant per Konstruktion.';

-- ----------------------------------------------------------------------------
-- Normalisierung nach Crockford: der Mensch tippt "rsv-demo-2o26" und meint
-- "RSV-DEM0-2026". Ohne diese Abbildung waere jeder O/0-Vertipper ein
-- Fehlversuch, der auf das Drossel-Konto geht — die Drosselung wuerde dann
-- ehrliche Leute treffen statt Bots.
-- ----------------------------------------------------------------------------
create or replace function app.normalize_join_code(p_code text)
returns text
language sql
immutable
set search_path = ''
as $$
  select nullif(
    translate(
      upper(regexp_replace(coalesce(p_code, ''), '[^0-9A-Za-z]', '', 'g')),
      'ILO', '110'
    ),
  '')
$$;

comment on function app.normalize_join_code(text) is
  'Crockford-Normalisierung eines Einladungscodes: alles ausser [0-9A-Za-z] weg, upper, I/L->1, O->0. Leerer Rest -> NULL.';

-- ----------------------------------------------------------------------------
-- Der Generator. 5 Bytes CSPRNG = exakt 40 Bit = exakt 8 Base32-Zeichen,
-- ohne Rest und ohne Modulo-Verzerrung (jedes Zeichen ist gleichverteilt).
-- ----------------------------------------------------------------------------
create or replace function app.generate_join_code()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  -- Crockford-Alphabet: 0-9 dann A-Z OHNE I, L, O, U.
  c_alphabet constant text := '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  v_bytes    bytea;
  v_acc      bigint := 0;
  v_out      text := '';
  i          integer;
begin
  -- gen_random_uuid() = pg_strong_random() = CSPRNG (siehe Kopf).
  -- NIEMALS random(): das ist ein vorhersagbarer PRNG — genau der Fehler aus v1.
  v_bytes := uuid_send(gen_random_uuid());

  -- Byte 0-4 -> ein 40-Bit-Akkumulator (big endian). Byte 6/8 (Version/Variante
  -- der UUID) fassen wir bewusst nicht an, die sind nicht voll zufaellig.
  for i in 0..4 loop
    v_acc := (v_acc << 8) | get_byte(v_bytes, i);
  end loop;

  -- 8 Zeichen a 5 Bit, hoechstwertige zuerst.
  for i in 0..7 loop
    v_out := v_out || substr(c_alphabet, ((v_acc >> (35 - 5 * i)) & 31)::int + 1, 1);
  end loop;

  -- Anzeigeform: gruppiert, weil Menschen den Code abtippen und vorlesen.
  return substr(v_out, 1, 4) || '-' || substr(v_out, 5, 4);
end;
$$;

comment on function app.generate_join_code() is
  'Neuer Einladungscode: 40 Bit aus gen_random_bytes (CSPRNG), Crockford-Base32, Anzeigeform XXXX-XXXX. Gleichverteilt ohne Modulo-Verzerrung (5 Byte = 8 Zeichen glatt).';

-- ----------------------------------------------------------------------------
-- Normalized-Spalte trigger-gepflegt. Kein GENERATED-Column, weil
-- app.normalize_join_code zwar immutable ist, ein spaeterer Fix an der
-- Abbildung aber sonst einen Tabellen-Rewrite mit falschem Altbestand
-- erzwaenge. Trigger = die Abbildung ist aenderbar.
-- ----------------------------------------------------------------------------
create or replace function app.sync_join_code_normalized()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.join_code_normalized := app.normalize_join_code(new.join_code);
  return new;
end;
$$;

create trigger clubs_sync_join_code_normalized
  before insert or update of join_code on app.clubs
  for each row execute function app.sync_join_code_normalized();

-- Bestand nachziehen (Seed: 'RSV-DEMO-2026' -> 'RSVDEM02026').
update app.clubs set join_code = join_code where join_code is not null;

-- Eindeutig auf der VERGLEICHSFORM. Ohne diesen Index koennten zwei Vereine
-- Codes halten, die sich nur in O/0 unterscheiden — der Einloeser faende dann
-- zwei Zeilen und muesste raten, welcher Verein gemeint ist.
create unique index if not exists clubs_join_code_normalized_uq
  on app.clubs (join_code_normalized)
  where join_code_normalized is not null;

-- ----------------------------------------------------------------------------
-- Ist ein Code gerade einloesbar? EINE Definition, damit Einloeser und Anzeige
-- nie auseinanderlaufen.
-- ----------------------------------------------------------------------------
create or replace function app.join_code_is_active(
  p_expires_at timestamptz,
  p_revoked_at timestamptz
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_revoked_at is null
     and (p_expires_at is null or p_expires_at > now())
$$;

comment on function app.join_code_is_active(timestamptz, timestamptz) is
  'Einloesbarkeit eines Einladungscodes: nicht widerrufen und nicht abgelaufen. EINE Definition fuer Einloeser und Anzeige.';

-- ============================================================================
-- 2. internal.auth_rate_limits — Drosselung auf drei Achsen
-- ============================================================================
--
-- WARUM IN POSTGRES UND NICHT IM PROZESS:
-- Ein In-Memory-Zaehler ist bei jedem Neustart wieder auf null und zaehlt pro
-- Container. Beides macht ihn als Schutz wertlos, sobald es mehr als einen
-- Prozess gibt. Der Zaehler MUSS geteilt und dauerhaft sein.
--
-- WARUM internal:
-- 0001:29-37 gibt USAGE auf internal nur an service_role. Die Zaehler sind
-- damit fuer authenticated/anon unsichtbar (42501) — niemand kann auslesen,
-- wie nah er am Limit ist, und niemand kann Zaehler faelschen.
--
-- DIE DRITTE ACHSE IST DIE WICHTIGE:
-- 'ip' umgeht jedes Botnetz, 'account' umgeht, wer Konten anlegt. Nur 'code'
-- (global, ueber ALLE Aufrufer hinweg) begrenzt, wie oft EIN Code ueberhaupt
-- geraten werden darf. Diese Achse kann weder ein Proxy noch ein CAPTCHA
-- liefern — sie ist die einzige, die gegen verteilte Bots wirkt.
-- ----------------------------------------------------------------------------

create table internal.auth_rate_limits (
  scope             text        not null,
  identifier        text        not null,
  window_started_at timestamptz not null,
  attempts          integer     not null default 0,
  primary key (scope, identifier, window_started_at)
);

comment on table internal.auth_rate_limits is
  'Feste Zeitfenster-Zaehler fuer Anmelde-/Beitrittsversuche. Achsen: ip (ein Anschluss), account (ein Konto), code (EIN Einladungscode global — die einzige Achse, die verteilte Bots begrenzt). service_role-only, siehe 0001:29-37.';
comment on column internal.auth_rate_limits.scope is
  'Drossel-Achse: ip | account | code.';
comment on column internal.auth_rate_limits.identifier is
  'Wert der Achse. Bei scope=code der NORMALISIERTE Code, sonst laufen O/0-Varianten auf getrennten Zaehlern.';

create index auth_rate_limits_window_idx
  on internal.auth_rate_limits (window_started_at);

alter table internal.auth_rate_limits enable row level security;
-- Keine Policy und kein Grant: service_role hat BYPASSRLS, alle anderen
-- scheitern schon an der fehlenden Schema-Berechtigung. RLS an = die Tabelle
-- ist auch dann dicht, wenn jemand spaeter versehentlich ein Grant setzt.

-- ============================================================================
-- 3. internal.auth_events — ohne Protokoll ist ein Angriff unsichtbar
-- ============================================================================
--
-- error.ts:97 loggt heute erst ab Status >= 500. Ein Brute-Force auf
-- Einladungscodes erzeugt aber ausschliesslich 401/404/429 — er hinterlaesst
-- damit KEINE EINZIGE Zeile. Man koennte hinterher nicht einmal feststellen,
-- DASS es ihn gab.
--
-- DAS PROTOKOLL IST PERSONENBEZOGEN (IP + Konto-Bezug). Es braucht deshalb
-- eine Loeschfrist, und die gehoert in DIESE Migration und nicht in ein
-- spaeteres "machen wir noch": eine Tabelle, die IPs unbegrenzt sammelt, ist
-- ab dem ersten Tag ein Datenschutzverstoss (Art. 5 Abs. 1 lit. e DSGVO).
-- 14 Tage: lang genug fuer die Auswertung eines Vorfalls ueber ein
-- Wochenende + Urlaub, kurz genug fuer Speicherbegrenzung.
-- ----------------------------------------------------------------------------

create table internal.auth_events (
  id          uuid        primary key default app.uuid_v7(),
  occurred_at timestamptz not null default now(),
  event       text        not null,
  status      integer     not null,
  route       text        not null,
  ip          inet,
  profile_id  uuid,
  detail      jsonb       not null default '{}'::jsonb,
  expires_at  timestamptz not null default (now() + interval '14 days')
);

comment on table internal.auth_events is
  'Sicherheitsprotokoll fuer abgewiesene Anmelde-/Beitrittsversuche (401/403/404/429). Fuellt die Luecke aus error.ts:97 (loggt erst ab 500 -> Brute-Force war unsichtbar). Personenbezogen -> expires_at + internal.purge_auth_events(). service_role-only.';
comment on column internal.auth_events.detail is
  'Kontext OHNE Geheimnisse. Der versuchte Code wird NIE gespeichert — sonst waere das Protokoll selbst eine Code-Liste.';
comment on column internal.auth_events.expires_at is
  'Loeschfrist (Vorgabe 14 Tage, Art. 5 Abs. 1 lit. e DSGVO). Durchgesetzt von internal.purge_auth_events().';

create index auth_events_occurred_idx on internal.auth_events (occurred_at desc);
create index auth_events_expires_idx  on internal.auth_events (expires_at);
create index auth_events_ip_idx       on internal.auth_events (ip, occurred_at desc);

alter table internal.auth_events enable row level security;

-- ----------------------------------------------------------------------------
-- Die Loeschfrist muss sich SELBST durchsetzen. pg_cron gibt es in diesem
-- Stack nicht (postgres:16-alpine), und eine Frist, die an einem externen
-- Cron haengt, den niemand einrichtet, ist keine Frist. Deshalb raeumt der
-- Drossel-Aufruf gelegentlich mit auf (siehe internal.rate_limit_hit).
-- ----------------------------------------------------------------------------
create or replace function internal.purge_auth_events()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_deleted integer;
begin
  delete from internal.auth_events where expires_at <= now();
  get diagnostics v_deleted = row_count;

  -- Verwaiste Drossel-Fenster gleich mit: aeltere als 1 Tag kann kein
  -- laufendes Fenster mehr sein (groesstes Fenster hier: 1 Stunde).
  delete from internal.auth_rate_limits
  where window_started_at < now() - interval '1 day';

  return v_deleted;
end;
$$;

comment on function internal.purge_auth_events() is
  'Setzt die Loeschfrist des Sicherheitsprotokolls durch und raeumt abgelaufene Drossel-Fenster ab. Wird opportunistisch aus internal.rate_limit_hit aufgerufen (kein pg_cron in diesem Stack).';

-- revoke from public + gezielter grant: ohne den grant verliert auch
-- service_role das EXECUTE (es ist kein Superuser) und die API bekaeme 42501.
revoke all on function internal.purge_auth_events() from public;
grant execute on function internal.purge_auth_events() to service_role;

-- ----------------------------------------------------------------------------
-- Der Drossel-Zaehler. Festes Fenster (fixed window): einfach, keine
-- Zusatztabelle pro Versuch, und der Nachteil (an der Fenstergrenze sind
-- kurzzeitig 2x limit Versuche moeglich) ist bei diesen Groessenordnungen
-- belanglos — 2x10 Rateversuche gegen 40 Bit sind immer noch nichts.
--
-- Zaehlt IMMER hoch, auch wenn schon gesperrt: sonst koennte man mit einem
-- Dauerfeuer das Fenster aussitzen, ohne dass der Zaehler es sieht.
-- ----------------------------------------------------------------------------
create or replace function internal.rate_limit_hit(
  p_scope      text,
  p_identifier text,
  p_limit      integer,
  p_window     interval
)
returns table (allowed boolean, retry_after integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_window_start timestamptz;
  v_attempts     integer;
begin
  if p_identifier is null or p_identifier = '' then
    -- Kein Merkmal = nicht drosselbar. Fail-closed waere hier falsch (dann
    -- sperrte eine fehlende IP jeden aus), aber wir sagen es dem Log.
    return query select true, 0;
    return;
  end if;

  -- Fensteranfang = auf die Fensterlaenge gerundeter Zeitpunkt.
  v_window_start := to_timestamp(
    floor(extract(epoch from now()) / extract(epoch from p_window))
    * extract(epoch from p_window)
  );

  insert into internal.auth_rate_limits (scope, identifier, window_started_at, attempts)
  values (p_scope, p_identifier, v_window_start, 1)
  on conflict (scope, identifier, window_started_at)
    do update set attempts = internal.auth_rate_limits.attempts + 1
  returning attempts into v_attempts;

  -- Opportunistisches Aufraeumen (~1 % der Aufrufe): haelt die Loeschfrist
  -- ohne externen Scheduler ein.
  if random() < 0.01 then
    perform internal.purge_auth_events();
  end if;

  if v_attempts > p_limit then
    return query select
      false,
      greatest(1, ceil(extract(epoch from (v_window_start + p_window - now())))::int);
  else
    return query select true, 0;
  end if;
end;
$$;

comment on function internal.rate_limit_hit(text, text, integer, interval) is
  'Zaehlt einen Versuch auf einer Achse und sagt, ob er noch erlaubt ist. Festes Zeitfenster. Zaehlt auch im gesperrten Zustand weiter (sonst liesse sich die Sperre aussitzen). Liefert retry_after in Sekunden fuer den Retry-After-Header (RFC 7807 / RFC 9110).';

-- Nur service_role zaehlt. authenticated/anon duerfen den Zaehler weder lesen
-- noch hochtreiben: sonst koennte jeder fremde Konten in die Sperre schieben.
revoke all on function internal.rate_limit_hit(text, text, integer, interval) from public;
grant execute on function internal.rate_limit_hit(text, text, integer, interval) to service_role;

-- ============================================================================
-- 4. internal.legal_documents — versioniert und APPEND-ONLY
-- ============================================================================
--
-- WARUM NICHT internal.platform_settings.legal:
-- Das ist heute ein Singleton (id = 1, check (id = 1), 0019:42-56), der per
-- UPSERT UEBERSCHRIEBEN wird (0019:65 "the singleton is upserted"). Damit ist
-- nicht rekonstruierbar, WELCHEM TEXT jemand zugestimmt hat: aendert der
-- Betreiber die Datenschutzerklaerung, ist der alte Wortlaut spurlos weg.
-- Ein Einwilligungsnachweis, der auf einen ueberschreibbaren Text zeigt, ist
-- wertlos — Art. 7 Abs. 1 DSGVO verlangt, dass der Verantwortliche die
-- Einwilligung NACHWEISEN kann, und "sie hat irgendeiner Fassung zugestimmt"
-- ist kein Nachweis. Deshalb: eigene Tabelle, unveraenderlich, mit Version.
--
-- Diese Tabelle enthaelt KEINE Rechtstexte (Anwaltssache, ausdruecklich nicht
-- Teil dieses Auftrags). Sie ist der Platz, auf den eine Einwilligung zeigen
-- KANN — mehr soll sie hier nicht sein.
-- ----------------------------------------------------------------------------

create table internal.legal_documents (
  id           uuid        primary key default app.uuid_v7(),
  kind         text        not null,
  version      integer     not null,
  locale       text        not null default 'de',
  title        text        not null,
  body         text        not null,
  content_hash text        not null,
  published_at timestamptz not null default now(),
  created_at   timestamptz not null default now(),
  constraint legal_documents_kind_chk
    check (kind in ('terms', 'privacy', 'imprint')),
  constraint legal_documents_locale_chk
    check (locale in ('de', 'en')),
  constraint legal_documents_version_chk
    check (version >= 1),
  unique (kind, locale, version)
);

comment on table internal.legal_documents is
  'Versionierte Rechtstexte, APPEND-ONLY. Ersatz fuer den ueberschreibbaren Singleton internal.platform_settings.legal (0019:42-56,65): eine Einwilligung muss auf einen UNVERAENDERLICHEN Wortlaut zeigen koennen, sonst ist sie nach Art. 7 Abs. 1 DSGVO nicht nachweisbar.';
comment on column internal.legal_documents.content_hash is
  'Hash des Wortlauts. Macht eine nachtraegliche Manipulation am Text erkennbar, ohne den Text selbst in jeden Einwilligungsnachweis zu kopieren.';
comment on column internal.legal_documents.version is
  'Fortlaufend je (kind, locale). Eine neue Fassung ist eine neue ZEILE, nie ein UPDATE.';

create index legal_documents_current_idx
  on internal.legal_documents (kind, locale, version desc);

-- ----------------------------------------------------------------------------
-- APPEND-ONLY ist eine Zusage, keine Bitte -> Trigger, nicht nur Grants.
-- Grants schuetzen vor fremden Rollen; der Trigger schuetzt auch vor
-- service_role (= vor unserem eigenen API-Code und vor psql).
-- ----------------------------------------------------------------------------
create or replace function app.deny_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception
    'Tabelle % ist APPEND-ONLY: % ist nicht erlaubt. Neue Fassung = neue Zeile.',
    tg_table_name, tg_op
    using errcode = '42501';
end;
$$;

comment on function app.deny_mutation() is
  'Trigger-Wache fuer APPEND-ONLY-Tabellen. Wirft 42501 (insufficient_privilege) bei UPDATE/DELETE. STATEMENT-Ebene (siehe Trigger): gilt damit auch dann, wenn RLS die Zeilen schon weggefiltert hat, und auch fuer service_role — im Gegensatz zu Grants.';

-- FOR EACH STATEMENT, nicht FOR EACH ROW — der Unterschied ist wesentlich:
-- Ein ROW-Trigger feuert nur, wenn eine Zeile wirklich getroffen wird. Fuer
-- eine Person, der RLS ohnehin alle Zeilen wegfiltert, waere ein UPDATE damit
-- ein stiller Treffer ins Leere: 'UPDATE 0', kein Fehler, keine Aenderung. Die
-- Daten waeren zwar sicher, aber die Zusage "append-only" waere unsichtbar —
-- wer so einen UPDATE schreibt, bekaeme nie gesagt, dass die Tabelle das
-- grundsaetzlich nicht kann, und suchte den Fehler woanders.
-- Auf STATEMENT-Ebene ist die Regel absolut und laut: fuer jede Rolle, mit und
-- ohne RLS, mit und ohne Treffer.
create trigger legal_documents_append_only
  before update or delete on internal.legal_documents
  for each statement execute function app.deny_mutation();

alter table internal.legal_documents enable row level security;

-- Rechtstexte sind zum Lesen da. authenticated hat seit 0019:63 USAGE auf
-- internal (fuer platform_settings); der SELECT-Grant bleibt bewusst auf
-- diese eine Tabelle beschraenkt — auth_events/auth_rate_limits bleiben
-- unsichtbar. Kein INSERT/UPDATE/DELETE: Texte pflegt der Betreiber ueber die
-- API im Service-Modus.
grant select on internal.legal_documents to authenticated;

create policy legal_documents_select on internal.legal_documents
  for select to authenticated
  using (true);

comment on policy legal_documents_select on internal.legal_documents is
  'Rechtstexte sind fuer jede angemeldete Person lesbar — man muss nachlesen koennen, wozu man Ja gesagt hat.';

-- ============================================================================
-- 5. app.consents — granulare Einwilligung, APPEND-ONLY
-- ============================================================================
--
-- "Der Verein darf Fotos machen" ist KEINE Einwilligung. Art. 7 Abs. 2 DSGVO
-- verlangt Trennung nach Zweck; ein einziges Sammel-Ja ist nicht freiwillig
-- im Sinne von Art. 7 Abs. 4. Deshalb: ein Datensatz pro ZWECK.
--
-- ARTIKEL 8 (Kind): Bei Kindern willigt nicht die betroffene Person ein,
-- sondern der Traeger der elterlichen Verantwortung. Wer das nicht speichert,
-- kann fuer genau die Faelle nichts nachweisen, in denen es am meisten zaehlt.
-- Dafuer gibt es granted_by_profile_id — getrennt von member_id.
--
-- APPEND-ONLY: Ein Widerruf (Art. 7 Abs. 3) ist eine NEUE Zeile mit
-- granted=false, kein UPDATE. Sonst loescht der Widerruf den Nachweis, dass
-- die Einwilligung vorher bestand — und damit die Rechtsgrundlage fuer alles,
-- was in der Zwischenzeit rechtmaessig geschah.
-- ----------------------------------------------------------------------------

create type app.consent_purpose as enum (
  'terms',            -- Nutzungsbedingungen
  'privacy',          -- Datenschutzerklaerung
  'photos_internal',  -- Fotos INNERHALB des Vereins (Aushang, interne Gruppe)
  'photos_public',    -- Fotos OEFFENTLICH (Website, Presse, Soziale Medien)
  'chat',             -- Teilnahme am Vereins-Chat
  'newsletter'        -- Rundschreiben
);

comment on type app.consent_purpose is
  'Zwecke einer Einwilligung, EINZELN abfragbar (Art. 7 Abs. 2 DSGVO: kein Sammel-Ja). photos_internal und photos_public sind bewusst getrennt — "Foto am Vereinsaushang" und "Foto auf Instagram" sind fuer Eltern voellig verschiedene Fragen.';

create table app.consents (
  id                    uuid        primary key default app.uuid_v7(),
  club_id               uuid        not null references app.clubs (id) on delete cascade,
  member_id             uuid        references app.club_members (id) on delete cascade,
  subject_profile_id    uuid        references app.profiles (id) on delete cascade,
  purpose               app.consent_purpose not null,
  granted               boolean     not null,
  granted_by_profile_id uuid        not null references app.profiles (id) on delete restrict,
  legal_document_id     uuid        references internal.legal_documents (id) on delete restrict,
  policy_version        text,
  evidence              jsonb       not null default '{}'::jsonb,
  recorded_at           timestamptz not null default now(),
  constraint consents_subject_chk
    check (member_id is not null or subject_profile_id is not null)
);

comment on table app.consents is
  'Einwilligungen je Zweck, APPEND-ONLY. Widerruf (Art. 7 Abs. 3) = neue Zeile mit granted=false; der aktuelle Stand ist die JUENGSTE Zeile je (Person, Zweck). Kein UPDATE, weil ein Widerruf sonst den Nachweis der frueheren Rechtmaessigkeit vernichtet.';
comment on column app.consents.granted_by_profile_id is
  'WER hat eingewilligt. Bei Erwachsenen = die betroffene Person selbst, bei Kindern der Traeger der elterlichen Verantwortung (Art. 8 Abs. 2 DSGVO: der Verantwortliche muss sich dessen vergewissern und es nachweisen koennen). Deshalb getrennt von member_id.';
comment on column app.consents.member_id is
  'Die betroffene Person als Vereinsmitglied. NULL, solange es nur ein Profil gibt (z.B. Zustimmung zu den Bedingungen bei der Vereinsanlage).';
comment on column app.consents.legal_document_id is
  'Zeigt auf die UNVERAENDERLICHE Fassung (internal.legal_documents), der zugestimmt wurde. Ohne diesen Zeiger waere der Nachweis wertlos (Art. 7 Abs. 1).';
comment on column app.consents.policy_version is
  'Freitext-Fassung fuer Zwecke ohne eigenen Rechtstext (z.B. photos_public). Ergaenzt legal_document_id, ersetzt es nicht.';
comment on column app.consents.evidence is
  'Umstaende der Erklaerung (Zeitpunkt-Kontext, Oberflaeche, Wortlaut des Kaestchens). KEINE IP im Klartext ohne Not — der Nachweis rechtfertigt kein Vorratsdatensammeln.';

create index consents_member_idx  on app.consents (member_id, purpose, recorded_at desc);
create index consents_club_idx    on app.consents (club_id, purpose, recorded_at desc);
create index consents_subject_idx on app.consents (subject_profile_id, purpose, recorded_at desc);

-- ----------------------------------------------------------------------------
-- Append-only fuer Einwilligungen — aber NICHT ganz so absolut wie bei den
-- Rechtstexten, und das ist Absicht.
--
-- UPDATE: immer verboten. Der Inhalt einer abgegebenen Erklaerung darf sich
--   niemals aendern; ein Widerruf ist eine NEUE Zeile (Art. 7 Abs. 3).
--
-- DELETE: fuer Endnutzer verboten, fuer privilegierte Pfade erlaubt. Ein
--   absolutes DELETE-Verbot (wie bei legal_documents) waere hier ein FEHLER,
--   und zwar ein doppelter:
--     1. app.consents.club_id/member_id haengen an 'on delete cascade'. Ein
--        absolutes Verbot machte das Loeschen eines Vereins UNMOEGLICH — die
--        Kaskade liefe in den Trigger.
--     2. Art. 17 DSGVO (Recht auf Loeschung) braucht einen Weg, der Daten
--        einer Person wirklich zu entfernen. Eine Tabelle mit
--        personenbezogenen Daten, aus der per Konstruktion nie etwas
--        verschwinden kann, ist kein Nachweis — sie ist ein Problem.
--   current_user ist hier der verlaesslichere Test als die Rolle im Claim: er
--   ist das, was SET LOCAL ROLE (db.ts) tatsaechlich gesetzt hat.
-- ----------------------------------------------------------------------------
create or replace function app.deny_consent_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    raise exception
      'app.consents ist APPEND-ONLY: UPDATE ist nicht erlaubt. Ein Widerruf ist eine NEUE Zeile (Art. 7 Abs. 3 DSGVO).'
      using errcode = '42501';
  end if;

  if current_user in ('authenticated', 'anon') then
    raise exception
      'app.consents: DELETE ist nicht erlaubt. Ein Widerruf ist eine NEUE Zeile (granted=false), kein Loeschen.'
      using errcode = '42501';
  end if;

  return null;
end;
$$;

comment on function app.deny_consent_mutation() is
  'Append-only-Wache fuer app.consents. UPDATE: immer gesperrt. DELETE: fuer authenticated/anon gesperrt, fuer privilegierte Pfade offen — sonst waere weder ein Loeschersuchen (Art. 17) noch das Loeschen eines Vereins (on delete cascade) moeglich.';

-- STATEMENT-Ebene, aus demselben Grund wie bei legal_documents: sonst waere
-- ein UPDATE fuer normale Nutzer ein stilles 'UPDATE 0' (RLS filtert vorher)
-- statt einer klaren Absage.
create trigger consents_append_only
  before update or delete on app.consents
  for each statement execute function app.deny_consent_mutation();

alter table app.consents enable row level security;

-- ----------------------------------------------------------------------------
-- RLS. Im Zweifel strenger:
--   SELECT: die betroffene Person, wer erklaert hat (Eltern), und die
--           Mitglieder-Verwaltung des Vereins (die muss belegen koennen, dass
--           eine Einwilligung vorliegt — sonst duerfte sie kein Foto nutzen).
--           coach/member/guest_coach sehen FREMDE Einwilligungen NICHT.
--   INSERT: nur fuer sich selbst oder als eingetragener Sorgeberechtigter,
--           und granted_by MUSS die aufrufende Person sein (kein Erklaeren
--           im fremden Namen).
--   UPDATE/DELETE: keine Policy + Trigger.
-- ----------------------------------------------------------------------------
create policy consents_select on app.consents
  for select to authenticated
  using (
    granted_by_profile_id = auth.uid()
    or subject_profile_id = auth.uid()
    or exists (
      select 1 from app.club_members m
      where m.id = app.consents.member_id
        and m.profile_id = auth.uid()
    )
    or app.has_club_role(club_id, array['owner', 'admin', 'moderator', 'treasurer'])
  );

comment on policy consents_select on app.consents is
  'Eigene Einwilligungen, selbst erklaerte (Eltern) und — fuer die Mitglieder-Verwaltung — die des Vereins. coach/member/guest_coach sehen fremde Einwilligungen nicht.';

create policy consents_insert on app.consents
  for insert to authenticated
  with check (
    -- Man erklaert IMMER im eigenen Namen. Wer fuer ein Kind erklaert, tut das
    -- als er selbst — das ist genau der Art.-8-Nachweis.
    granted_by_profile_id = auth.uid()
    and (
      -- (a) fuer sich selbst
      subject_profile_id = auth.uid()
      or exists (
        select 1 from app.club_members m
        where m.id = app.consents.member_id
          and m.profile_id = auth.uid()
      )
      -- (b) als eingetragener Sorgeberechtigter fuer das eigene Kind
      --     (Spalte heisst child_member_id, 0002 — nicht ward_member_id)
      or exists (
        select 1
        from app.guardianships g
        join app.club_members gm on gm.id = g.guardian_member_id
        where g.child_member_id = app.consents.member_id
          and gm.profile_id = auth.uid()
          and gm.deleted_at is null
          and g.deleted_at is null
      )
    )
  );

comment on policy consents_insert on app.consents is
  'Nur im eigenen Namen (granted_by = auth.uid()): fuer sich selbst oder als eingetragener Sorgeberechtigter fuer das Muendel. Niemand kann eine Einwilligung fuer einen Dritten erfinden.';

commit;
