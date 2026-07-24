-- ============================================================================
-- 99pC_mahngebuehr.sql — Mahngebuehr, Verzugszinsen, Gesamtbetrag (0071).
--
-- WARUM DIESE DATEI
-- ---------------------------------------------------------------------------
-- 0071 macht eine starke Behauptung: „Geld fordern geht nur mit Beleg." Der
-- Satz ist genau so viel wert wie der Versuch, ihn zu brechen. Diese Datei
-- versucht es — von der Kassenwartin aus, die alle Rechte auf app.invoices hat.
--
--   A) Struktur + Seed-Gegenprobe (ohne die waere jede Zahl unten wertlos).
--   B) DER KERN: die Mutter sieht den GESAMTBETRAG, aber NICHT den Mahnverlauf.
--      Ohne die Fortschreibung auf die Rechnung haette sie eine stille 0
--      gesehen — die Rechnung haette sie angelogen.
--   C) DIE PROBE AUFS EXEMPEL: die Kassenwartin kann die Gebuehr NICHT von Hand
--      setzen. Und ueber einen protokollierten Schritt sehr wohl.
--   D) Der Gesamtbetrag ist generiert und nicht schreibbar.
--   E) Negative Gebuehren/Zinsen sind ausgeschlossen (der Erlass ist bewusst
--      NICHT gebaut — siehe Kopf von 0071 und den Bericht).
--   F) Der Mahnverlauf bleibt append-only, auch mit den neuen Spalten.
--
-- Seed-Lage: f…-001 (Katrin a-09) 8600 + 500 Gebuehr = 9100 · f…-005 (a-18)
-- 5400 + 1000 + 137 = 6537. Katrin = 90..09, Beate (treasurer) = 90..03.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- A) Struktur + Gegenprobe.
-- ---------------------------------------------------------------------------
begin;
do $$
begin
  perform testkit.is_eq('mahnkosten: der Mahnverlauf traegt fee_cents und interest_cents',
    (select count(*) from information_schema.columns
      where table_schema = 'app' and table_name = 'dunning_log'
        and column_name in ('fee_cents', 'interest_cents')), 2);

  perform testkit.is_eq('mahnkosten: total_cents ist eine GENERIERTE Spalte, kein Anwendungsfeld',
    (select count(*) from information_schema.columns
      where table_schema = 'app' and table_name = 'invoices'
        and column_name = 'total_cents' and is_generated = 'ALWAYS'), 1);

  -- Die Gegenprobe: es ist wirklich etwas aufgelaufen.
  perform testkit.is_eq('mahnkosten: f-001 = 8600 Forderung + 500 Gebuehr = 9100 gesamt',
    (select total_cents from app.invoices where id = 'f0000000-0000-4000-8000-000000000001'), 9100);
  perform testkit.is_eq('mahnkosten: f-005 = 5400 + 1000 Gebuehr + 137 Zinsen = 6537 gesamt',
    (select total_cents from app.invoices where id = 'f0000000-0000-4000-8000-000000000005'), 6537);
  perform testkit.is_eq('mahnkosten: eine Rechnung OHNE Mahnung hat total = amount (kein stiller Aufschlag)',
    (select count(*) from app.invoices
      where id = 'f0000000-0000-4000-8000-000000000003' and total_cents = amount_cents), 1);
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- B) DER KERN. Katrin (a-09) ist die Rechnungsempfaengerin von f-001.
--    Sie MUSS wissen, was sie schuldet — und sie darf den Mahnverlauf nicht
--    sehen (der ist finanz-only, 0013). Genau dieses Paar ist der Grund fuer
--    die Fortschreibung auf die Rechnung.
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000009","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"member"}}',
  true);
set local role authenticated;
do $$
begin
  perform testkit.is_eq('mahn-familie: sie sieht ihre Rechnung',
    (select count(*) from app.invoices where id = 'f0000000-0000-4000-8000-000000000001'), 1);

  perform testkit.is_eq('mahn-familie: und den GESAMTBETRAG inklusive Mahngebuehr (9100)',
    (select total_cents from app.invoices where id = 'f0000000-0000-4000-8000-000000000001'), 9100);

  perform testkit.is_eq('mahn-familie: die Gebuehr steht ausgewiesen da (500), nicht versteckt im Betrag',
    (select dunning_fee_cents from app.invoices where id = 'f0000000-0000-4000-8000-000000000001'), 500);

  -- ... und trotzdem KEIN Einblick in den Mahnverlauf.
  perform testkit.is_eq('mahn-familie: den MAHNVERLAUF sieht sie NICHT (finanz-only)',
    (select count(*) from app.dunning_log), 0);
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- C) DIE PROBE AUFS EXEMPEL. Die Kassenwartin darf app.invoices aendern —
--    aber nicht die Mahnkosten. Der Weg dorthin fuehrt ueber den Beleg.
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000003","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"treasurer"}}',
  true);
set local role authenticated;
do $$
begin
  -- Gegenprobe: sie darf die Rechnung sehr wohl anfassen.
  perform testkit.affects('mahn-beleg: die Kassenwartin darf die Rechnung aendern (Gegenprobe)',
    $q$update app.invoices set paid_via = 'Ueberweisung'
        where id = 'f0000000-0000-4000-8000-000000000003'$q$, 1);

  perform testkit.throws('mahn-beleg: aber sie kann die Mahngebuehr NICHT von Hand setzen',
    $q$update app.invoices set dunning_fee_cents = 99999
        where id = 'f0000000-0000-4000-8000-000000000003'$q$, '42501');

  perform testkit.throws('mahn-beleg: auch die Verzugszinsen nicht',
    $q$update app.invoices set dunning_interest_cents = 4711
        where id = 'f0000000-0000-4000-8000-000000000003'$q$, '42501');

  -- Der EINZIGE Weg: den Vorgang protokollieren.
  perform testkit.succeeds('mahn-beleg: mit protokolliertem Mahnschritt geht es',
    $q$insert into app.dunning_log
         (club_id, invoice_id, from_stage, to_stage, action, actor_member_id, fee_cents, interest_cents)
       values ('c1ab0000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000003',
               0, 1, 'reminder', 'a0000000-0000-4000-8000-000000000003', 250, 30)$q$);

  perform testkit.is_eq('mahn-beleg: und die Rechnung traegt die Kosten jetzt (3500 + 250 + 30 = 3780)',
    (select total_cents from app.invoices where id = 'f0000000-0000-4000-8000-000000000003'), 3780);

  perform testkit.is_eq('mahn-beleg: ein zweiter Schritt addiert, er ersetzt nicht',
    (select count(*) from app.invoices
      where id = 'f0000000-0000-4000-8000-000000000003' and dunning_fee_cents = 250), 1);
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- D) Der Gesamtbetrag wird nicht getippt.
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000003","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"treasurer"}}',
  true);
set local role authenticated;
do $$
begin
  perform testkit.throws('mahn-summe: total_cents ist nicht beschreibbar (generiert)',
    $q$update app.invoices set total_cents = 1
        where id = 'f0000000-0000-4000-8000-000000000003'$q$, '428C9');
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- E) Keine negativen Kosten. Der ERLASS ist bewusst nicht gebaut — und weil er
--    nicht gebaut ist, soll er auch nicht durch die Hintertuer entstehen.
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000003","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"treasurer"}}',
  true);
set local role authenticated;
do $$
begin
  perform testkit.throws('mahn-vorzeichen: eine NEGATIVE Mahngebuehr wird abgewiesen (kein stiller Erlass)',
    $q$insert into app.dunning_log
         (club_id, invoice_id, from_stage, to_stage, action, fee_cents)
       values ('c1ab0000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000003',
               0, 1, 'reminder', -500)$q$, '23514');
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- F) Der Mahnverlauf bleibt append-only — auch die neuen Spalten.
--    41_finance_a misst das fuer die alten; ohne diesen Block koennte eine
--    spaetere Migration die Sperre lockern und dort gruen bleiben.
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000003","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"treasurer"}}',
  true);
set local role authenticated;
do $$
begin
  perform testkit.throws('mahn-append: eine bereits protokollierte Gebuehr ist nicht umschreibbar',
    $q$update app.dunning_log set fee_cents = 0
        where invoice_id = 'f0000000-0000-4000-8000-000000000001'$q$, '42501');
end;
$$;
rollback;

-- Und selbst der Superuser kommt an der Sperre nicht vorbei (Vorbild 41:104).
begin;
do $$
begin
  perform testkit.throws('mahn-append: auch der Superuser schreibt die Gebuehr nicht um',
    $q$update app.dunning_log set fee_cents = 0
        where invoice_id = 'f0000000-0000-4000-8000-000000000001'$q$, 'P0001');
end;
$$;
rollback;
