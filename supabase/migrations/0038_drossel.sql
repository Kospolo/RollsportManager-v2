-- ============================================================================
-- 0038_drossel.sql — Die Drossel aus 0034 haelt, aber sie steht auf drei
-- Konstruktionsfehlern. Diese Migration raeumt sie weg, OHNE die Sperre
-- aufzuweichen: 25 Versuche auf denselben falschen Code bekommen weiterhin
-- ab dem 21. eine 429, und der Zaehler liegt weiterhin in Postgres (er
-- ueberlebt jeden Neustart).
--
-- ============================================================================
-- DER BEFUND, DER ALLES ANDERE ERKLAERT — NACHGEMESSEN, NICHT UEBERNOMMEN
-- ============================================================================
--
-- 0034 behauptet in lib/rate-limit.ts und im eigenen Kopf:
--   "code ... begrenzt, wie oft ein Code UEBERHAUPT geraten werden darf, egal
--    von wem und von wo. Sie ist die einzige, die gegen verteilte Bots wirkt."
--   "Bei 40 Bit Coderaum und 20 Rateversuchen pro Code und Stunde braucht ein
--    Angreifer im Erwartungswert ~3 Millionen Jahre pro Code."
--
-- BEIDE SAETZE SIND FALSCH, und zwar aus demselben Grund: der Zaehler haengt
-- am VERSUCHTEN Code (rate_limit_hit('code', <getippter Code>, ...)), nicht am
-- angegriffenen Verein. Wer raet, tippt aber JEDES MAL EINEN ANDEREN Code —
-- denselben falschen Code zweimal zu probieren ist sinnlos. Jeder Rateversuch
-- trifft damit einen FRISCHEN Zaehler (attempts = 1 von 20) und die Achse
-- feuert NIE.
--
-- Gemessen am Bestand aus 0034, vor dieser Migration:
--   500 Versuche mit 500 VERSCHIEDENEN Codes  -> gesperrt:  0 von 500
--    25 Versuche mit DEMSELBEN       Code     -> gesperrt:  5 von  25
--
-- Die code-Achse bremst also GENAU EINEN Fall aus: dass jemand denselben Code
-- oft schickt. Das ist kein Angreifer — das ist der Verein, der 30 Kinder
-- anmeldet, und der Spassvogel, der den Code vom Aushang abschreibt und damit
-- allen anderen den Beitritt zusperrt. Die Achse verteidigt nichts und
-- beschiesst die eigenen Leute.
--
-- Der Live-Beweis des Pruefers ("25 Versuche auf denselben Code von 25 IPs und
-- 9 Konten -> ab Versuch 21 kommt 429") hat exakt den Fall gemessen, den ein
-- Angriff nie erzeugt. Er ist korrekt und trotzdem kein Beleg fuer Botschutz.
--
-- WAS DEN CODE WIRKLICH SCHUETZT — und es reicht:
-- Die 40 Bit aus dem CSPRNG (app.generate_join_code, 0034). Ein verteiltes
-- Botnetz ist nur durch die account-Achse (10/Stunde) begrenzt; bei 10.000
-- Vereinen trifft ein Rateversuch mit Wahrscheinlichkeit 1e4/2^40 ~ 9e-9. Fuer
-- 50 % Trefferchance braucht es ~7,6e10 Versuche = ~7,6e9 Konto-Stunden. Das
-- ist die Verteidigung. Sie steht, und sie steht ohne die code-Achse.
--
-- INHALT
--   1. internal.maintenance_state + maybe_purge_auth_events() — die 14-Tage-
--      Frist bekommt einen ECHTEN, zeitgesteuerten Ausloeser (F3)
--   2. internal.rate_limit_hit — Purge raus aus dem Lock-Pfad (F3),
--      code-Achse zaehlt nur noch RATEVERSUCHE (F5), Identifier darf
--      pseudonymisiert ankommen (F4)
--   3. internal.rate_limit_hit_many — alle Achsen in EINEM Rundlauf, feste
--      Lock-Reihenfolge (F2, F1)
-- ============================================================================

begin;

-- ============================================================================
-- 1. DIE LOESCHFRIST BRAUCHT EINEN AUSLOESER, DER NICHT AM ZUFALL HAENGT
-- ============================================================================
--
-- 0034:348-351 raeumt mit 'if random() < 0.01'. Das hat zwei Fehler:
--
--   a) ES HAENGT AN DER LAST. Ein Verein mit 5 Beitritten im Monat loest den
--      1-%-Zweig im Mittel alle 20 MONATE aus. Die 14-Tage-Zusage aus 0034:265
--      ("Loeschfrist, Art. 5 Abs. 1 lit. e DSGVO") ist damit auf genau den
--      Installationen gebrochen, auf denen sie am leichtesten einzuhalten
--      waere. Eine Frist, die nur bei Dauerlast greift, ist keine Frist.
--   b) ES SITZT IM LOCK. Siehe 2.
--
-- Deshalb: ZEITGESTEUERT statt zufallsgesteuert. Faellig ist faellig, egal ob
-- der 1. oder der 10.000. Aufruf vorbeikommt. Ein einziger Aufruf pro Stunde
-- reicht damit aus, um die Frist zu halten.
-- ----------------------------------------------------------------------------

create table internal.maintenance_state (
  id            boolean     primary key default true,
  last_purge_at timestamptz not null default '-infinity',
  constraint maintenance_state_singleton check (id)
);

comment on table internal.maintenance_state is
  'Einzeiler (id = true). Haelt fest, wann die Loeschfrist zuletzt durchgesetzt wurde, damit internal.maybe_purge_auth_events() zeitgesteuert statt zufallsgesteuert raeumen kann. service_role-only wie der Rest von internal (0001:29-37).';
comment on column internal.maintenance_state.last_purge_at is
  'Letzter erfolgreicher Lauf von internal.purge_auth_events(). -infinity = noch nie -> der erste Aufruf raeumt sofort.';

insert into internal.maintenance_state (id) values (true);

alter table internal.maintenance_state enable row level security;
-- Kein Grant, keine Policy: wie internal.auth_rate_limits (0034:243-245).
-- service_role hat BYPASSRLS, alle anderen scheitern schon am Schema.

-- ----------------------------------------------------------------------------
-- Faellig? Dann EINMAL raeumen — und zwar nur in EINER Sitzung.
--
-- 'for update skip locked' und nicht 'for update': wer den Zuschlag nicht
-- bekommt, WARTET NICHT, sondern geht sofort weiter. Sonst waere die Wartung
-- selbst wieder ein Serialisierungspunkt — genau der Fehler, den diese
-- Migration abstellt. Bei mehreren API-Instanzen raeumt so garantiert genau
-- eine, und keine einzige Anfrage haengt deswegen.
-- ----------------------------------------------------------------------------
create or replace function internal.maybe_purge_auth_events(
  p_every interval default interval '1 hour'
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_deleted integer;
begin
  perform 1
    from internal.maintenance_state
   where id
     and last_purge_at < now() - p_every
   for update skip locked;

  if not found then
    -- Nicht faellig, oder eine andere Sitzung macht es gerade. Beides ist
    -- kein Fehler und darf den Aufrufer nichts kosten.
    return -1;
  end if;

  update internal.maintenance_state set last_purge_at = now() where id;

  v_deleted := internal.purge_auth_events();
  return v_deleted;
end;
$$;

comment on function internal.maybe_purge_auth_events(interval) is
  'Setzt die 14-Tage-Loeschfrist des Sicherheitsprotokolls durch, hoechstens einmal pro p_every und hoechstens in einer Sitzung gleichzeitig (skip locked). Ersetzt den lastabhaengigen random()<0.01-Zweig aus 0034: der lief bei kleinen Vereinen im Mittel alle 20 Monate und brach die Zusage. Liefert geloeschte Zeilen, oder -1 wenn nicht faellig.';

revoke all on function internal.maybe_purge_auth_events(interval) from public;
grant execute on function internal.maybe_purge_auth_events(interval) to service_role;

-- ============================================================================
-- 2. DER ZAEHLER — OHNE PURGE IM LOCK, OHNE BESCHUSS AUF DIE EIGENEN LEUTE
-- ============================================================================
--
-- F3 — DIE PURGE SASS IM LOCK. 0034:344-351 macht erst
--      'insert ... on conflict (scope, identifier, window_started_at) do update'
--      — das nimmt einen ROW LOCK auf die Zeile dieses Codes, gehalten bis
--      Transaktionsende — und DANACH, in 1 % der Faelle, ein DELETE ueber zwei
--      Tabellen. Alle Beitritte zu DEMSELBEN Verein treffen dieselbe Zeile und
--      warten mit.
--
--      Nachgemessen am Bestand (200.000 abgelaufene Zeilen in auth_events, wie
--      nach zwei Wochen Betrieb):
--        internal.purge_auth_events()                      -> 43 ms
--        Sitzung B, DERSELBE Code, waehrend A purged       -> Lock-Timeout (>400 ms)
--        Sitzung B, ein ANDERER Code, waehrend A purged    -> 3,4 ms
--      Und je haerter der Angriff, desto groesser auth_events (jede 404 schreibt
--      eine Zeile), desto laenger die Purge, desto laenger der Lock. Der Schutz
--      hat sich unter Last selbst gedrosselt.
--
--      -> Die Purge ist hier ganz raus. Sie hat jetzt einen eigenen, besseren
--         Ausloeser (siehe 1.) und laeuft nicht mehr im Lock-Pfad.
--
-- F5 — DIE code-ACHSE HAT AUF DIE EIGENEN LEUTE GESCHOSSEN. Siehe Kopf: sie
--      bremst nur den, der DENSELBEN Code oft schickt. Das ist niemals der
--      Angreifer (der tippt jedes Mal einen neuen) und immer der Verein beim
--      Onboarding oder der Spassvogel mit dem Aushang-Code.
--
--      -> Auf der code-Achse zaehlen ab jetzt nur noch RATEVERSUCHE: ein Code,
--         der auf einen lebenden, nicht widerrufenen, nicht abgelaufenen Verein
--         zeigt, IST kein Rateversuch. Wer ihn schickt, kennt ihn bereits — ihm
--         ein Rate-Budget abzuziehen schuetzt nichts und sperrt nur die
--         naechsten 30 ehrlichen Anmeldungen aus.
--
--      DER BOTSCHUTZ NIMMT DADURCH NICHT AB — er kann nicht abnehmen, weil die
--      Achse gegen Bots nie etwas getan hat (0 von 500, siehe Kopf). Was
--      bleibt, ist genau der eine Fall, den sie wirklich bremst: Dauerfeuer auf
--      EINEN FALSCHEN Code. Das ist Verteidigung in der Tiefe, und die bleibt
--      unveraendert scharf (Test 99e).
--
-- F4 — p_probe: DER GETIPPTE CODE DARF NICHT MEHR IN DER TABELLE LANDEN.
--      0034:267 sagt fuer auth_events ausdruecklich: "Der versuchte Code wird
--      NIE gespeichert — sonst waere das Protokoll selbst eine Code-Liste."
--      Genau das tut internal.auth_rate_limits.identifier aber: bei scope='code'
--      steht dort der Code im Klartext — und dank der ERFOLGREICHEN Beitritte
--      sind das die ECHTEN, GUELTIGEN Codes lebender Vereine. Wer die Tabelle
--      liest, hat die Sammlung, die 0034 ihm im Protokoll verwehrt. Derselbe
--      Einwand trifft die IP auf der ip-Achse (Art. 32 Abs. 1 lit. a DSGVO).
--
--      -> Die API schickt ab jetzt auf den Achsen 'ip' und 'code' einen
--         HMAC-SHA256(Pfeffer, Wert) als p_identifier (lib/rate-limit.ts). Der
--         Pfeffer liegt in der API-Umgebung, NIE in der Datenbank — ein
--         Datenbankabzug allein laesst sich damit nicht zurueckrechnen (bei
--         2^32 IPv4-Adressen waere ein ungepfefferter Hash in Sekunden
--         gebrochen).
--         Fuer die Frage "ist das ein Rateversuch?" braucht es aber den
--         Klartext -> p_probe. Der ist ein reiner Bind-Parameter: er wird
--         GELESEN und NIE GESPEICHERT.
--
--      Gleichheit ist alles, was eine Drossel je gebraucht hat — ein Hash kann
--      das genauso gut wie der Klartext. internal.auth_events behaelt die IP im
--      Klartext: dort ist sie fuer die Missbrauchsanalyse ("woher kam das
--      Dauerfeuer?") der Zweck selbst, und die 14-Tage-Frist (jetzt mit echtem
--      Ausloeser, siehe 1.) ist die Schranke dafuer.
--
-- UNVERAENDERT (bewusst): festes Fenster, zaehlt auch im gesperrten Zustand
-- weiter, Zaehler in Postgres, service_role-only.
-- ----------------------------------------------------------------------------
--
-- DROP statt CREATE OR REPLACE, und das ist kein Geschmack: p_probe ist ein
-- NEUER Parameter. 'create or replace' kann eine Signatur nicht erweitern — es
-- legte eine ZWEITE Funktion daneben. Der Aufruf mit vier Argumenten (0034,
-- SQL-Testsuite 99d:223) waere dann zwischen der alten 4-stelligen und der
-- neuen 5-stelligen-mit-Default MEHRDEUTIG: Postgres wirft 42725 und die
-- Drossel faellt komplett aus. Die alte Signatur muss also weg.
drop function if exists internal.rate_limit_hit(text, text, integer, interval);

create function internal.rate_limit_hit(
  p_scope      text,
  p_identifier text,
  p_limit      integer,
  p_window     interval,
  p_probe      text default null
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

  -- ------------------------------------------------------------------
  -- Ist das ueberhaupt ein Rateversuch? (F5)
  --
  -- Nur mit p_probe beantwortbar. Ohne p_probe wird GEZAEHLT — fail-closed,
  -- weil "im Zweifel strenger" gilt und weil die SQL-Testsuite die Funktion
  -- ohne Probe aufruft und dabei das alte, scharfe Verhalten sehen muss.
  -- ------------------------------------------------------------------
  if p_scope = 'code' and p_probe is not null and p_probe <> '' then
    if exists (
      select 1
        from app.clubs c
       where c.join_code_normalized = p_probe
         and c.deleted_at is null
         and app.join_code_is_active(c.join_code_expires_at, c.join_code_revoked_at)
    ) then
      -- Echter, einloesbarer Code. Kein Raten -> kein Zaehler, kein Lock.
      -- Der Beitritt selbst bleibt ueber die Achsen ip und account gedrosselt.
      return query select true, 0;
      return;
    end if;
  end if;

  -- Fensteranfang = auf die Fensterlaenge gerundeter Zeitpunkt.
  v_window_start := to_timestamp(
    floor(extract(epoch from now()) / extract(epoch from p_window))
    * extract(epoch from p_window)
  );

  -- AB HIER haelt diese Transaktion den Row-Lock auf die Zaehlerzeile.
  -- Es folgt NICHTS mehr ausser der Auswertung im Speicher — kein DELETE,
  -- kein zweiter Tabellenzugriff, kein Rundlauf. Das ist der ganze Punkt.
  insert into internal.auth_rate_limits (scope, identifier, window_started_at, attempts)
  values (p_scope, p_identifier, v_window_start, 1)
  on conflict (scope, identifier, window_started_at)
    do update set attempts = internal.auth_rate_limits.attempts + 1
  returning attempts into v_attempts;

  if v_attempts > p_limit then
    return query select
      false,
      greatest(1, ceil(extract(epoch from (v_window_start + p_window - now())))::int);
  else
    return query select true, 0;
  end if;
end;
$$;

comment on function internal.rate_limit_hit(text, text, integer, interval, text) is
  'Zaehlt einen Versuch auf einer Achse und sagt, ob er noch erlaubt ist. Festes Zeitfenster, zaehlt auch im gesperrten Zustand weiter. p_identifier darf pseudonymisiert sein (HMAC, siehe lib/rate-limit.ts). p_probe = Klartext-Code, NUR fuer die Frage "Rateversuch?" und NIE gespeichert: auf der code-Achse zaehlen nur Versuche mit einem Code, der auf KEINEN lebenden Verein zeigt. Enthaelt bewusst KEINE Purge mehr (0034 hielt dabei den Row-Lock).';

-- Alte Aufrufe mit vier Argumenten (0034, SQL-Testsuite) treffen jetzt diese
-- Funktion ueber den Default. Der Grant haftet an der Signatur, die alte ist
-- weg -> hier neu setzen, sonst verliert service_role das EXECUTE und die API
-- bekommt 42501 (derselbe Fallstrick, den 0034:283-285 schon beschreibt).
revoke all on function internal.rate_limit_hit(text, text, integer, interval, text) from public;
grant execute on function internal.rate_limit_hit(text, text, integer, interval, text) to service_role;

-- ============================================================================
-- 3. ALLE ACHSEN IN EINEM RUNDLAUF
-- ============================================================================
--
-- F2 — WAS DER GEGENLESER BEHAUPTET HAT, UND WAS WIRKLICH DASTEHT:
--   "Laeuft der Check in derselben Transaktion wie Code-Pruefung + Member-
--    Insert, serialisiert eine Bot-Flut auf einen Code ALLE Beitritte."
--   Der Vordersatz trifft auf routes/registration.ts NICHT zu: checkRateLimits
--   (registration.ts:118) laeuft in einem eigenen withServiceRole und ist damit
--   eine eigene, VOR der Beitritts-Transaktion committende Transaktion
--   (registration.ts:139). Die geforderte Trennung ist bereits gebaut.
--
-- Was WIRKLICH zu lang gehalten wurde, war die Purge (F3, oben). Was bleibt,
-- ist die Zerbrechlichkeit: 0034 nimmt pro Achse einen eigenen Rundlauf
-- innerhalb EINER Transaktion (lib/rate-limit.ts, Schleife ueber die Regeln).
-- Dass der code-Lock trotzdem kurz gehalten wird, haengt einzig daran, dass
-- 'code' in registration.ts:118-122 zufaellig ZULETZT in der Liste steht.
-- Sortiert jemand die Liste um, wird der Lock ueber zwei weitere Rundlaeufe
-- gehalten — ohne dass ein Test es merkt.
--
-- Deshalb: EIN Aufruf, EIN Rundlauf, feste Reihenfolge in der Datenbank.
--   * Der Lock-Pfad ist damit unabhaengig davon, wie der Aufrufer sortiert.
--   * Weniger Rundlaeufe = die Verbindung ist kuerzer belegt. Das zahlt direkt
--     auf F1 ein (db.ts: der Pool ist fuer die GESAMTE API geteilt).
--   * Feste Sortierung (scope, identifier) = eine globale Lock-Reihenfolge fuer
--     alle Aufrufer = per Konstruktion kein Deadlock zwischen zwei Anfragen,
--     die sich zwei Achsen teilen.
-- ----------------------------------------------------------------------------
create or replace function internal.rate_limit_hit_many(
  p_scopes      text[],
  p_identifiers text[],
  p_limits      integer[],
  p_windows     interval[],
  p_probes      text[] default null
)
returns table (scope text, allowed boolean, retry_after integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
begin
  if array_length(p_scopes, 1) is distinct from array_length(p_identifiers, 1)
     or array_length(p_scopes, 1) is distinct from array_length(p_limits, 1)
     or array_length(p_scopes, 1) is distinct from array_length(p_windows, 1) then
    raise exception 'rate_limit_hit_many: Arrays haben unterschiedliche Laenge';
  end if;

  -- order by: die globale Lock-Reihenfolge. Nicht kosmetisch — sie ist der
  -- Grund, warum zwei Anfragen mit denselben zwei Achsen sich nicht verklemmen
  -- koennen.
  for r in
    select t.i, t.scope as s, t.identifier as ident, t.lim, t.win, t.probe
      from unnest(p_scopes, p_identifiers, p_limits, p_windows,
                  coalesce(p_probes, array_fill(null::text, array[coalesce(array_length(p_scopes, 1), 0)])))
             with ordinality as t(scope, identifier, lim, win, probe, i)
     order by t.scope, t.identifier
  loop
    return query
      select r.s, h.allowed, h.retry_after
        from internal.rate_limit_hit(r.s, r.ident, r.lim, r.win, r.probe) h;
  end loop;
end;
$$;

comment on function internal.rate_limit_hit_many(text[], text[], integer[], interval[], text[]) is
  'Zaehlt EINEN Versuch auf mehreren Achsen in EINEM Rundlauf und liefert je Achse ein Urteil. Feste Reihenfolge (scope, identifier) = globale Lock-Reihenfolge = per Konstruktion deadlockfrei. Ein Rundlauf statt n = die Pool-Verbindung ist kuerzer belegt (siehe db.ts, F1).';

revoke all on function internal.rate_limit_hit_many(text[], text[], integer[], interval[], text[]) from public;
grant execute on function internal.rate_limit_hit_many(text[], text[], integer[], interval[], text[]) to service_role;

commit;
