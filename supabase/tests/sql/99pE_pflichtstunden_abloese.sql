-- ============================================================================
-- 99pE_pflichtstunden_abloese.sql — was eine fehlende Pflichtstunde kostet
-- (Migration 0073, app.duty_buyout).
--
-- WARUM DIESE DATEI
-- ---------------------------------------------------------------------------
-- app.duty_buyout trifft fuenf Entscheidungen, die man ihr nicht ansieht, wenn
-- man nur das Ergebnis liest. Jede einzelne wird hier an Zahlen gemessen — und
-- die wichtigste, „es zaehlen NUR GENEHMIGTE Stunden", bekommt eine Gegenprobe:
-- dieselbe Person, dieselbe Stunde, einmal offen und einmal genehmigt. Ohne die
-- Gegenprobe waere die Zahl nur eine Zahl.
--
--   A) Struktur (NULL <> 0) + Seed-Gegenprobe.
--   B) Die Rechnung stimmt: Katrin hat 3 von 20 Stunden -> 17 x 15,00 = 255,00.
--   C) NUR GENEHMIGTE Stunden — mit der Gegenprobe „genehmigen aendert es".
--   D) Keine Gutschrift bei Uebererfuellung (Fehlstunden bei 0 abgeschnitten).
--   E) Ohne Kostensatz KEIN Betrag — null, nicht 0.
--   F) Wer darf rechnen: das Mitglied selbst, der Trainerstab, die Kasse.
--      Und wer NICHT darf, bekommt einen Fehler — KEINE stille zu niedrige Zahl.
--      (Das ist der eigentliche Grund fuer SECURITY DEFINER; siehe Kopf 0073.)
--   G) Gilt das Soll nicht, gibt es keine Aussage statt einer erfundenen Null.
--
-- Seed-Lage: EIN vereinsweites Soll d010..01, 20,00 Stunden, 1500 ct/Stunde.
-- Genehmigte Stunden: Katrin a-09 = 3,00 · Stefanie a-12 = 2,50 · Maja a-16 =
-- 4,00 · Anna-Lena a-05 = 5,00. NICHT genehmigt: a-17 = 2,00 · a-23 = 1,50.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- A) Struktur + Gegenprobe.
-- ---------------------------------------------------------------------------
begin;
do $$
begin
  perform testkit.is_eq('abloese: das Soll traegt cost_per_hour_cents',
    (select count(*) from information_schema.columns
      where table_schema = 'app' and table_name = 'duty_requirements'
        and column_name = 'cost_per_hour_cents'), 1);

  perform testkit.is_eq('abloese: die Spalte ist NULLABLE — "keine Abloese" ist nicht "0,00 EUR"',
    (select count(*) from information_schema.columns
      where table_schema = 'app' and table_name = 'duty_requirements'
        and column_name = 'cost_per_hour_cents' and is_nullable = 'YES'), 1);

  perform testkit.is_eq('abloese: der Seed hat einen Satz (1500 ct = 15,00 EUR je Stunde)',
    (select cost_per_hour_cents from app.duty_requirements
      where id = 'd0100000-0000-4000-8000-000000000001'), 1500);
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- B) Die Rechnung. Katrin sieht ihre eigene Abrechnung.
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000009","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"member"}}',
  true);
set local role authenticated;
do $$
declare
  v record;
begin
  select * into v from app.duty_buyout('d0100000-0000-4000-8000-000000000001',
                                       'a0000000-0000-4000-8000-000000000009');
  perform testkit.is_eq('abloese-rechnung: Soll 20 Stunden', v.required_hours::bigint, 20);
  perform testkit.is_eq('abloese-rechnung: geleistet und genehmigt 3 Stunden', v.done_hours::bigint, 3);
  perform testkit.is_eq('abloese-rechnung: es fehlen 17 Stunden', v.missing_hours::bigint, 17);
  perform testkit.is_eq('abloese-rechnung: 17 x 1500 = 25500 ct (255,00 EUR)', v.buyout_cents, 25500);
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- C) NUR GENEHMIGTE STUNDEN — und die Gegenprobe.
--    a-17 hat 2,00 Stunden EINGETRAGEN, aber nicht genehmigt.
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000001","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"coach"}}',
  true);
set local role authenticated;
do $$
declare
  v record;
begin
  select * into v from app.duty_buyout('d0100000-0000-4000-8000-000000000001',
                                       'a0000000-0000-4000-8000-000000000017');
  perform testkit.is_eq('abloese-genehmigt: die offene Stunde zaehlt NICHT (0 geleistet)',
    v.done_hours::bigint, 0);
  perform testkit.is_eq('abloese-genehmigt: es fehlen also alle 20 Stunden = 30000 ct',
    v.buyout_cents, 30000);
end;
$$;

-- Die Gegenprobe: genehmigen, und dieselbe Rechnung sieht anders aus.
update app.duty_entries set approved = true
 where id = 'd0e00000-0000-4000-8000-000000000004';

do $$
declare
  v record;
begin
  select * into v from app.duty_buyout('d0100000-0000-4000-8000-000000000001',
                                       'a0000000-0000-4000-8000-000000000017');
  perform testkit.is_eq('abloese-genehmigt: nach der Genehmigung zaehlen die 2 Stunden',
    v.done_hours::bigint, 2);
  perform testkit.is_eq('abloese-genehmigt: es fehlen 18 -> 27000 ct',
    v.buyout_cents, 27000);
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- D) Keine Gutschrift bei Uebererfuellung. Wer mehr leistet als gefordert,
--    bekommt kein Geld zurueck — das ist eine Entscheidung, keine Rundung.
-- ---------------------------------------------------------------------------
begin;
insert into app.duty_entries (club_id, member_id, hours, activity_date, kind, approved)
values ('c1ab0000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000009',
        40.00, current_date - 5, 'helper', true);

select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000009","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"member"}}',
  true);
set local role authenticated;
do $$
declare
  v record;
begin
  select * into v from app.duty_buyout('d0100000-0000-4000-8000-000000000001',
                                       'a0000000-0000-4000-8000-000000000009');
  perform testkit.is_eq('abloese-ueber: 43 geleistete Stunden werden gezaehlt', v.done_hours::bigint, 43);
  perform testkit.is_eq('abloese-ueber: Fehlstunden bleiben 0 (nicht negativ)', v.missing_hours::bigint, 0);
  perform testkit.is_eq('abloese-ueber: und die Abloese ist 0 — keine Gutschrift', v.buyout_cents, 0);
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- E) Ohne Kostensatz kein Betrag. null heisst „dazu gibt es keine Vereinbarung"
--    und ist etwas anderes als „kostet nichts".
-- ---------------------------------------------------------------------------
begin;
update app.duty_requirements set cost_per_hour_cents = null
 where id = 'd0100000-0000-4000-8000-000000000001';

select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000009","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"member"}}',
  true);
set local role authenticated;
do $$
declare
  v record;
begin
  select * into v from app.duty_buyout('d0100000-0000-4000-8000-000000000001',
                                       'a0000000-0000-4000-8000-000000000009');
  perform testkit.is_eq('abloese-ohne-satz: die Fehlstunden werden trotzdem gezaehlt (17)',
    v.missing_hours::bigint, 17);
  perform testkit.is_eq('abloese-ohne-satz: aber es gibt KEINEN Betrag (null, nicht 0)',
    (select case when v.buyout_cents is null then 1 else 0 end), 1);
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- F) Wer darf rechnen. Der Kern: wer NICHT darf, bekommt einen FEHLER und keine
--    stille zu niedrige Zahl. Eine falsche Rechnung ist schlimmer als ein 403.
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000003","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"treasurer"}}',
  true);
set local role authenticated;
do $$
declare
  v record;
begin
  -- Die Kassenwartin ist KEINE Trainerin — sie muss die Forderung trotzdem
  -- beziffern koennen. Der ausdrueckliche Zusatzweg aus 0073.
  select * into v from app.duty_buyout('d0100000-0000-4000-8000-000000000001',
                                       'a0000000-0000-4000-8000-000000000009');
  perform testkit.is_eq('abloese-rechte: die Kassenwartin darf die Abloese beziffern (25500)',
    v.buyout_cents, 25500);

  -- ... bekommt dabei aber KEINEN Einblick in die einzelnen Stundeneintraege.
  perform testkit.is_eq('abloese-rechte: sie sieht dabei KEINEN einzelnen Stundeneintrag',
    (select count(*) from app.duty_entries
      where member_id = 'a0000000-0000-4000-8000-000000000009'), 0);
end;
$$;
rollback;

begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000012","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"member"}}',
  true);
set local role authenticated;
do $$
begin
  perform testkit.throws('abloese-rechte: ein FREMDES Mitglied bekommt einen Fehler, keine stille Zahl',
    $q$select * from app.duty_buyout('d0100000-0000-4000-8000-000000000001',
                                     'a0000000-0000-4000-8000-000000000009')$q$, '42501');

  -- Gegenprobe: die eigene Abrechnung bekommt dieselbe Person sehr wohl.
  perform testkit.succeeds('abloese-rechte: die EIGENE Abrechnung bekommt sie',
    $q$select * from app.duty_buyout('d0100000-0000-4000-8000-000000000001',
                                     'a0000000-0000-4000-8000-000000000012')$q$);
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- G) Gilt das Soll fuer diese Person gar nicht, gibt es KEINE Zeile. Eine
--    Null-Abrechnung waere eine Aussage, die niemand getroffen hat.
-- ---------------------------------------------------------------------------
begin;
update app.duty_requirements set member_id = 'a0000000-0000-4000-8000-000000000012'
 where id = 'd0100000-0000-4000-8000-000000000001';

select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000003","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"treasurer"}}',
  true);
set local role authenticated;
do $$
begin
  perform testkit.is_eq('abloese-geltung: ein Soll fuer Stefanie liefert fuer Katrin 0 Zeilen',
    (select count(*) from app.duty_buyout('d0100000-0000-4000-8000-000000000001',
                                          'a0000000-0000-4000-8000-000000000009')), 0);
  perform testkit.is_eq('abloese-geltung: fuer Stefanie selbst liefert es eine Zeile',
    (select count(*) from app.duty_buyout('d0100000-0000-4000-8000-000000000001',
                                          'a0000000-0000-4000-8000-000000000012')), 1);
end;
$$;
rollback;
