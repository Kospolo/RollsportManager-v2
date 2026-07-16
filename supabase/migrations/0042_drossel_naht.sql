-- =============================================================================
-- 0042 — DIE ZWEITE NAHT: die Drossel fragte die falsche Tabelle.
--
-- Wieder kein neuer Befund, sondern zwei Truppen, die gleichzeitig recht
-- hatten und deren Ergebnisse zusammen falsch werden:
--
--   0037 (Trupp 2): app.club_join_codes wird die WAHRHEIT. Ein Verein kann
--                   MEHRERE gueltige Codes haben — genau dafuer wurde die
--                   Tabelle gebaut (Rotation mit Ueberlappungsfenster: "der
--                   alte Aushang gilt noch 24h"). app.clubs.join_code bleibt
--                   nur noch als Schreib-Alias/Spiegel des JUENGSTEN Codes.
--   0038 (Trupp 3): F5 — auf der code-Achse zaehlen nur noch RATEVERSUCHE.
--                   Ein Code, der auf einen lebenden Verein zeigt, ist kein
--                   Raten; ihn zu zaehlen sperrt nur die ehrlichen Anmeldungen
--                   aus (Selbst-DoS). Die Pruefung dafuer steht in
--                   internal.rate_limit_hit und fragt — 0038:246-252 —
--                   app.clubs.join_code_normalized.
--
-- DAS ERGEBNIS NACH DEM ZUSAMMENFUEHREN, LIVE GEMESSEN:
-- Nach einer Rotation mit Ueberlappung haelt app.clubs den NEUEN Code. Der
-- ALTE ist weiterhin einloesbar (er lebt in app.club_join_codes, und genau
-- den liest der Einloeser, registration.ts) — aber F5 findet ihn in app.clubs
-- NICHT MEHR und haelt jede ehrliche Anmeldung damit fuer einen Rateversuch:
--
--   rotate(overlap_hours: 24)  -> app.clubs.join_code = '2TRX-8JPY'
--                                 app.club_join_codes = {RSV-DEMO-2026 (24h),
--                                                        2TRX-8JPY}
--   POST /clubs/join RSV-DEMO-2026 -> HTTP 201 (gueltig, der Beitritt klappt)
--   internal.auth_rate_limits      -> scope='code', attempts=1   <-- FALSCH
--
-- Damit trifft die Drossel exakt die Gruppe, die F5 schuetzen sollte: die
-- Menschen mit dem alten, absichtlich noch gueltigen Aushang-Code. Nach 20
-- solchen Anmeldungen sperrt die code-Achse sie global aus — der Selbst-DoS
-- aus F5, wiederhergestellt durch das Ueberlappungsfenster aus 0037.
--
-- DIE REGEL, DIE HIER VERLETZT WAR: der Waechter muss dieselbe Frage stellen
-- wie der Einloeser. registration.ts fragt app.club_join_codes; F5 fragte
-- app.clubs. Zwei Quellen fuer "ist dieser Code echt?" sind eine Quelle zu
-- viel — und die falsche gewinnt still, ohne Fehlermeldung.
--
-- BOTSCHUTZ: unveraendert. Ein geratener Code steht in KEINER der beiden
-- Tabellen; er wird gezaehlt wie zuvor (Beleg: 25x derselbe falsche Code von
-- 25 IPs -> weiterhin 429). Diese Migration macht die Ausnahme nicht groesser,
-- sie macht sie nur dort wirksam, wo sie ohnehin gemeint war.
-- =============================================================================

begin;

create or replace function internal.rate_limit_hit(
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
  -- Ist das ueberhaupt ein Rateversuch? (F5 — Quelle korrigiert in 0042)
  --
  -- Nur mit p_probe beantwortbar. Ohne p_probe wird GEZAEHLT — fail-closed,
  -- weil "im Zweifel strenger" gilt und weil die SQL-Testsuite die Funktion
  -- ohne Probe aufruft und dabei das alte, scharfe Verhalten sehen muss.
  -- ------------------------------------------------------------------
  if p_scope = 'code' and p_probe is not null and p_probe <> '' then
    if exists (
      select 1
        from app.club_join_codes jc
        join app.clubs c on c.id = jc.club_id
       where jc.code_normalized = p_probe
         and c.deleted_at is null
         and app.join_code_is_active(jc.expires_at, jc.revoked_at)
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
  'Eine Achse der Beitritts-Drossel: zaehlt und urteilt in EINEM Rundlauf. Die code-Achse zaehlt nur RATEVERSUCHE (F5, 0038) — ob ein Code echt ist, entscheidet seit 0042 app.club_join_codes (die Wahrheit seit 0037), NICHT mehr app.clubs.join_code_normalized: die Spalte haelt nur den JUENGSTEN Code, und jeder absichtlich noch gueltige Alt-Code eines Ueberlappungsfensters galt der Drossel dadurch als Raten — Selbst-DoS genau fuer die Ehrlichen. Der Waechter fragt jetzt dieselbe Tabelle wie der Einloeser (registration.ts).';

commit;
