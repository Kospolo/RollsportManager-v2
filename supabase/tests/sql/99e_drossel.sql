-- ============================================================================
-- 99e_drossel.sql — Die Drossel nach 0038: sie sperrt weiter, aber sie sperrt
-- die Richtigen.
--
-- WAS HIER BEWIESEN WIRD, UND WARUM ES NICHT SELBSTVERSTAENDLICH IST:
--
-- 0034 baut die Drossel auf drei Achsen und behauptet ueber die dritte:
--   "code ... begrenzt, wie oft ein Code UEBERHAUPT geraten werden darf, egal
--    von wem und von wo. Sie ist die einzige, die gegen verteilte Bots wirkt."
-- Das ist falsch, und (a) haelt den Befund fest: der Zaehler haengt am
-- VERSUCHTEN Code. Wer raet, tippt jedes Mal einen ANDEREN Code und trifft
-- damit jedes Mal einen frischen Zaehler. Die Achse hat verteiltes Raten nie
-- begrenzt — sie hat nur den gebremst, der DENSELBEN Code oft schickt, und das
-- ist der Verein beim Onboarding.
--
-- Deshalb muessen hier ZWEI Dinge gleichzeitig gelten, sonst ist die Aenderung
-- wertlos oder gefaehrlich:
--   * der ehrliche Verein kommt durch  (sonst haben wir die Drossel behalten,
--     die auf die eigenen Leute schiesst)
--   * das Dauerfeuer bleibt gesperrt   (sonst haben wir sie nur kaputtgemacht)
--
-- Aufbau:
--   (a) Der Befund     — die code-Achse begrenzt Raten nicht, und tat es nie
--   (b) F5             — echter Code = kein Rateversuch = kein Zaehler
--   (c) Botschutz      — Dauerfeuer auf EINEN falschen Code bleibt gesperrt
--   (d) F3             — keine Purge mehr im Zaehler-Pfad
--   (e) F3             — die 14-Tage-Frist hat einen ECHTEN Ausloeser
--   (f) F2             — alle Achsen in einem Aufruf, feste Lock-Reihenfolge
--   (g) Grants         — die neuen Bausteine sind so dicht wie die alten
--
-- Benutzt AUSSCHLIESSLICH die vorhandenen Helfer aus 00_testkit.sql
-- (ok/fail/is_eq/throws) — die Testkit-Datei bleibt unberuehrt.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Vorbereitung: ein Verein mit einem ECHTEN, einloesbaren Code.
-- Alles in begin/rollback — dieser Test hinterlaesst keine Spur.
-- ---------------------------------------------------------------------------
begin;
set local role service_role;
select set_config('request.jwt.claims', '', true);

-- Code bewusst OHNE I/L/O/U: das Crockford-Alphabet kennt sie nicht, und
-- app.normalize_join_code bildet O->0 und I/L->1 ab. 'DROS-SEL1' waere hier eine
-- Falle gewesen — es normalisiert zu 'DR0SSE11', nicht zu 'DROSSEL1'.
-- 'ABCD-2345' normalisiert unveraendert zu 'ABCD2345'.
insert into app.clubs (id, name, city, join_code)
values ('c1ab0000-0000-4000-8000-0000000000e5', 'RSC Drosselheim', 'Drosselheim', 'ABCD-2345');

-- Beleg, dass die Probe unten wirklich den echten Code trifft: sonst pruefte
-- (b) versehentlich einen Rateversuch und waere gruen, ohne irgendetwas zu zeigen.
select testkit.is_eq(
  'Aufbau: der angelegte Code normalisiert zu genau der Probe, die (b) benutzt',
  (select count(*) from app.clubs
    where id = 'c1ab0000-0000-4000-8000-0000000000e5' and join_code_normalized = 'ABCD2345'), 1);

-- ===========================================================================
-- (a) DER BEFUND — die code-Achse begrenzt Raten NICHT
-- ===========================================================================
--
-- Dieser Test haelt eine gemessene Tatsache fest, damit die alte Behauptung
-- nicht zurueckkehrt. Er behauptet NICHT, dass das gut ist — er behauptet, dass
-- es so IST. Wer die Achse eines Tages wirklich gegen Raten scharf stellt (z.B.
-- ueber ein globales Fehlversuchs-Budget statt pro getipptem Code), MUSS hier
-- vorbeikommen und diesen Test bewusst aendern. Genau das soll er erzwingen.
--
-- Der Schutz gegen Raten sind die 40 Bit aus dem CSPRNG (app.generate_join_code,
-- 0034), nicht diese Achse.
-- ---------------------------------------------------------------------------
do $$
declare
  v_allowed boolean;
  v_blocked integer := 0;
  i         integer;
begin
  -- So raet man wirklich: jedes Mal ein ANDERER Code. Limit 20, 200 Versuche.
  for i in 1..200 loop
    select allowed into v_allowed
      from internal.rate_limit_hit('code', 'RATEVERSUCH-' || i::text, 20, interval '1 hour',
                                   'RATEVERSUCH' || i::text);
    if not v_allowed then v_blocked := v_blocked + 1; end if;
  end loop;
  perform testkit.is_eq(
    'Befund: 200 Rateversuche mit 200 VERSCHIEDENEN Codes werden NICHT gesperrt (die code-Achse begrenzt Raten nicht — das tun die 40 Bit)',
    v_blocked::bigint, 0);
end $$;

-- ===========================================================================
-- (b) F5 — EIN ECHTER CODE IST KEIN RATEVERSUCH
-- ===========================================================================
--
-- Der Verein haengt den Code an den Aushang und meldet 30 Kinder an. Vor 0038
-- lief er ab dem 21. in eine 429 — die Drossel sperrte den Betrieb, gegen den
-- sie nie gerichtet war. Und wer den Code kannte (er haengt oeffentlich!),
-- konnte damit ALLEN anderen den Beitritt fuer eine Stunde zusperren.
-- ---------------------------------------------------------------------------
do $$
declare
  v_allowed boolean;
  v_blocked integer := 0;
  i         integer;
begin
  for i in 1..30 loop
    select allowed into v_allowed
      from internal.rate_limit_hit('code', 'HASH-DROSSELHEIM', 20, interval '1 hour', 'ABCD2345');
    if not v_allowed then v_blocked := v_blocked + 1; end if;
  end loop;
  perform testkit.is_eq(
    'F5: 30 Beitritte mit dem ECHTEN Vereinscode laufen durch (Onboarding wird nicht mehr gesperrt)',
    v_blocked::bigint, 0);
end $$;

-- Kein Zaehler = kein Row-Lock = kein Serialisierungspunkt. Das ist der Kern
-- von F2/F5 zusammen: ehrliche Beitritte beruehren die Zeile gar nicht erst.
select testkit.is_eq(
  'F5: ein echter Code legt ueberhaupt KEINE Zaehlerzeile an (kein Lock, keine Serialisierung)',
  (select count(*) from internal.auth_rate_limits
    where scope = 'code' and identifier = 'HASH-DROSSELHEIM'), 0);

-- ===========================================================================
-- (c) BOTSCHUTZ — und zwar unveraendert scharf
-- ===========================================================================
-- Wenn (b) den Preis dafuer waere, dass Dauerfeuer durchkommt, waere die
-- Aenderung ein Rueckschritt. Ist sie nicht:
-- ---------------------------------------------------------------------------
do $$
declare
  v_allowed boolean;
  v_retry   integer;
  v_blocked integer := 0;
  i         integer;
begin
  -- 25x DERSELBE FALSCHE Code -> ab dem 21. gesperrt (5 von 25).
  for i in 1..25 loop
    select allowed, retry_after into v_allowed, v_retry
      from internal.rate_limit_hit('code', 'HASH-FALSCH', 20, interval '1 hour', 'GIBTSNICHT');
    if not v_allowed then v_blocked := v_blocked + 1; end if;
  end loop;
  perform testkit.is_eq(
    'Botschutz: Dauerfeuer auf EINEN falschen Code bleibt gesperrt (ab dem 21. von 25)',
    v_blocked::bigint, 5);
  perform testkit.is_eq('Botschutz: Retry-After bleibt plausibel (1..3600 s)',
    (case when v_retry between 1 and 3600 then 1 else 0 end)::bigint, 1);
end $$;

-- Ein WIDERRUFENER Code darf keinen Freifahrtschein bekommen: er ist fuer den
-- Einloeser genau so gut wie ein falscher (0034: gleiche 404), also ist der
-- Versuch damit ein Rateversuch und gehoert gezaehlt.
update app.clubs set join_code_revoked_at = now()
 where id = 'c1ab0000-0000-4000-8000-0000000000e5';
do $$
declare
  v_allowed boolean;
  v_blocked integer := 0;
  i         integer;
begin
  for i in 1..25 loop
    select allowed into v_allowed
      from internal.rate_limit_hit('code', 'HASH-WIDERRUFEN', 20, interval '1 hour', 'ABCD2345');
    if not v_allowed then v_blocked := v_blocked + 1; end if;
  end loop;
  perform testkit.is_eq(
    'Botschutz: ein WIDERRUFENER Code zaehlt weiter als Rateversuch (kein Freifahrtschein)',
    v_blocked::bigint, 5);
end $$;
update app.clubs set join_code_revoked_at = null
 where id = 'c1ab0000-0000-4000-8000-0000000000e5';

-- Abgelaufen = ebenfalls Rateversuch.
update app.clubs set join_code_expires_at = now() - interval '1 day'
 where id = 'c1ab0000-0000-4000-8000-0000000000e5';
do $$
declare
  v_allowed boolean;
  v_blocked integer := 0;
  i         integer;
begin
  for i in 1..25 loop
    select allowed into v_allowed
      from internal.rate_limit_hit('code', 'HASH-ABGELAUFEN', 20, interval '1 hour', 'ABCD2345');
    if not v_allowed then v_blocked := v_blocked + 1; end if;
  end loop;
  perform testkit.is_eq(
    'Botschutz: ein ABGELAUFENER Code zaehlt weiter als Rateversuch',
    v_blocked::bigint, 5);
end $$;
update app.clubs set join_code_expires_at = null
 where id = 'c1ab0000-0000-4000-8000-0000000000e5';

-- OHNE p_probe kann niemand wissen, ob es ein Rateversuch war -> es wird
-- gezaehlt. Fail-closed, "im Zweifel strenger". Das ist auch der Grund, warum
-- die Aufrufe aus 0034/99d unveraendert scharf bleiben.
do $$
declare
  v_allowed boolean;
  v_blocked integer := 0;
  i         integer;
begin
  for i in 1..25 loop
    select allowed into v_allowed
      from internal.rate_limit_hit('code', 'HASH-OHNE-PROBE', 20, interval '1 hour');
    if not v_allowed then v_blocked := v_blocked + 1; end if;
  end loop;
  perform testkit.is_eq(
    'Botschutz: ohne p_probe wird gezaehlt (fail-closed — der Altaufruf bleibt scharf)',
    v_blocked::bigint, 5);
end $$;

-- ===========================================================================
-- (d) F3 — DIE PURGE IST RAUS AUS DEM ZAEHLER-PFAD
-- ===========================================================================
--
-- 0034:344-351 nimmt erst den Row-Lock auf die Zaehlerzeile und macht DANN in
-- 1 % der Faelle ein DELETE ueber zwei Tabellen. Gemessen (200.000 abgelaufene
-- Zeilen): Purge 43 ms; eine zweite Sitzung mit DEMSELBEN Code lief in den
-- Lock-Timeout, mit einem ANDEREN Code brauchte sie 3,4 ms. Je haerter der
-- Angriff, desto groesser das Protokoll, desto laenger der Lock — der Schutz
-- drosselte unter Last sich selbst.
--
-- Beweis, dass die Purge weg ist: 2000 Treffer duerfen KEINE einzige
-- abgelaufene Zeile anfassen. Mit 0034 waeren ~20 Purges gelaufen und die
-- Zeilen waeren weg (Wahrscheinlichkeit, dass bei 2000 Versuchen mit p=1 %
-- keine einzige feuert: 0,99^2000 ~ 2e-9).
-- ---------------------------------------------------------------------------
-- Eigene Route als Kennzeichen: global zu zaehlen waere zerbrechlich, sobald
-- eine andere Suite abgelaufene Zeilen hinterlaesst.
insert into internal.auth_events (event, status, route, expires_at)
select 'join_code_invalid', 404, '/test/99e', now() - interval '1 second'
from generate_series(1, 50) i;

do $$
declare i integer;
begin
  for i in 1..2000 loop
    perform internal.rate_limit_hit('code', 'HASH-P' || i::text, 20, interval '1 hour',
                                    'PURGEPROBE' || i::text);
  end loop;
end $$;

select testkit.is_eq(
  'F3: 2000 Drossel-Treffer loesen KEINE Purge aus (sie sitzt nicht mehr im Row-Lock)',
  (select count(*) from internal.auth_events where route = '/test/99e' and expires_at <= now()), 50);

-- ===========================================================================
-- (e) F3 — DIE LOESCHFRIST HAT JETZT EINEN ECHTEN AUSLOESER
-- ===========================================================================
--
-- Die 14 Tage (0034:265) sind eine DATENSCHUTZ-ZUSAGE (Art. 5 Abs. 1 lit. e
-- DSGVO). Sie an 'random() < 0.01' zu haengen, brach sie genau dort, wo sie am
-- leichtesten einzuhalten waere: ein Verein mit 5 Beitritten im Monat loest den
-- 1-%-Zweig im Mittel alle 20 MONATE aus. Zeitsteuerung statt Zufall.
-- ---------------------------------------------------------------------------
-- Faellig -> raeumt. Der Rueckgabewert zaehlt ALLE abgelaufenen Zeilen, nicht nur
-- die dieser Suite -> auf >= 50 pruefen, nicht auf exakt 50.
select testkit.is_eq(
  'F3: die Frist wird faellig durchgesetzt (loescht mindestens die 50 abgelaufenen Zeilen dieser Suite)',
  (select case when internal.maybe_purge_auth_events(interval '0 seconds') >= 50 then 1 else 0 end)::bigint, 1);

select testkit.is_eq(
  'F3: nach dem Lauf ist keine abgelaufene Zeile mehr da',
  (select count(*) from internal.auth_events where expires_at <= now()), 0);

-- Frische Zeilen ueberlebt die Frist — sonst waere sie kein Schutz, sondern
-- ein Datenverlust.
insert into internal.auth_events (event, status, route) values ('join_code_invalid', 404, '/test/99e');
select testkit.is_eq(
  'F3: die Frist laesst frische Zeilen in Ruhe (loescht nur, was abgelaufen ist)',
  (select count(*) from internal.auth_events where route = '/test/99e' and expires_at > now()), 1);

-- Und sie laeuft hoechstens einmal pro Fenster: sonst wuerde jeder Aufruf ein
-- DELETE ueber zwei Tabellen ausloesen und die Wartung waere die neue Last.
select testkit.is_eq(
  'F3: ein zweiter Lauf im selben Fenster macht nichts (-1 = nicht faellig, kein DELETE)',
  (select internal.maybe_purge_auth_events(interval '1 hour'))::bigint, -1);

-- Der Zuschlag wird festgehalten — daran haengt die Zeitsteuerung.
select testkit.is_eq(
  'F3: der Wartungszeitpunkt wird vermerkt (Grundlage der Zeitsteuerung)',
  (select count(*) from internal.maintenance_state where last_purge_at > now() - interval '1 minute'), 1);

-- ===========================================================================
-- (f) F2 — ALLE ACHSEN IN EINEM AUFRUF, FESTE LOCK-REIHENFOLGE
-- ===========================================================================
--
-- Zur Klarstellung, weil der Vorwurf anders lautete: checkRateLimits lief schon
-- vor 0038 in einer EIGENEN, vor der Beitritts-Transaktion committenden
-- Transaktion (registration.ts:118 vs. :139). Was fehlte, war die feste
-- Reihenfolge: dass der code-Lock kurz gehalten wurde, hing einzig daran, dass
-- 'code' zufaellig zuletzt in der Regelliste steht. Jetzt entscheidet die
-- Datenbank, nicht der Aufrufer.
-- ---------------------------------------------------------------------------
select testkit.is_eq(
  'F2: rate_limit_hit_many liefert je Achse genau ein Urteil (ein Rundlauf statt drei)',
  (select count(*) from internal.rate_limit_hit_many(
     array['ip','account','code'],
     array['hash-ip','konto-1','hash-code'],
     array[20,10,20],
     array[interval '1 hour', interval '1 hour', interval '1 hour'],
     array[null, null, 'GIBTSAUCHNICHT'])), 3);

-- Feste Sortierung = eine globale Lock-Reihenfolge fuer ALLE Aufrufer = zwei
-- Anfragen, die sich zwei Achsen teilen, koennen sich nicht verklemmen.
select testkit.is_eq(
  'F2: die Achsen werden in fester Reihenfolge abgearbeitet (globale Lock-Reihenfolge -> deadlockfrei)',
  (select count(*) from (
     select scope, row_number() over () as pos
       from internal.rate_limit_hit_many(
         array['ip','account','code'],
         array['h-ip-2','konto-2','h-code-2'],
         array[20,10,20],
         array[interval '1 hour', interval '1 hour', interval '1 hour'],
         array[null, null, 'AUCHNICHT'])
   ) t
   where (pos = 1 and scope = 'account')
      or (pos = 2 and scope = 'code')
      or (pos = 3 and scope = 'ip')), 3);

-- Die Achsen bleiben getrennt (eine gesperrte code-Achse sperrt nicht die ip).
select testkit.is_eq(
  'F2: rate_limit_hit_many haelt die Achsen getrennt (eigene Zaehler)',
  (select count(*) from internal.auth_rate_limits
    where identifier in ('hash-ip', 'konto-1', 'hash-code')), 3);

rollback;

-- ===========================================================================
-- (g) GRANTS — die neuen Bausteine sind so dicht wie die alten
-- ===========================================================================
--
-- Wer den Zaehler hochtreiben oder die Wartung ausloesen kann, kann fremde
-- Konten in die Sperre schieben bzw. das Protokoll wegraeumen, bevor es jemand
-- auswertet. Beides waere ein Angriffswerkzeug, kein Feature.
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000091","role":"authenticated","club_roles":{}}',
  true);
set local role authenticated;

select testkit.throws('Grants: internal.maintenance_state fuer authenticated unsichtbar',
  $sql$select count(*) from internal.maintenance_state$sql$, '42501');
select testkit.throws('Grants: internal.rate_limit_hit_many fuer authenticated gesperrt (sonst schiebt jeder fremde Konten in die Sperre)',
  $sql$select * from internal.rate_limit_hit_many(array['ip'], array['1.2.3.4'], array[5], array[interval '1 hour'])$sql$,
  '42501');
select testkit.throws('Grants: internal.maybe_purge_auth_events fuer authenticated gesperrt (sonst raeumt der Angreifer sein eigenes Protokoll weg)',
  $sql$select internal.maybe_purge_auth_events()$sql$, '42501');
select testkit.throws('Grants: internal.rate_limit_hit bleibt auch mit p_probe gesperrt',
  $sql$select * from internal.rate_limit_hit('code', 'x', 5, interval '1 hour', 'y')$sql$, '42501');

rollback;
