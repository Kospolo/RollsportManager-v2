-- ============================================================================
-- 99pD_rechnungspositionen.sql — Positionen, Umsatzsteuer, Teilzahlung (0072).
--
-- WARUM DIESE DATEI
-- ---------------------------------------------------------------------------
-- Drei Behauptungen von 0072 werden hier nachgestellt statt geglaubt:
--   1. „Die Datenbank rechnet, nicht der Client." -> die generierten Spalten
--      werden an echten Zahlen gemessen, inklusive Rundung auf der ZEILE.
--   2. „Positionen nur am Entwurf." -> mit Gegenprobe, dass es am Entwurf geht.
--   3. „Wer die Rechnung sieht, sieht ihre Positionen." -> inklusive der Mutter
--      fuer ihr Kind UND der fremden Mutter, die nichts sieht.
-- Dazu die Teilzahlung: der Zustand, der zwischen offen und bezahlt fehlte.
--
-- Seed-Lage: f…-004 „Trainingslager" 12000 ct mit ZWEI Positionen
-- (10000 zu 0 % + 1869 netto zu 7 % = 2000 brutto), vat_total 131.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- A) Struktur + Seed-Gegenprobe.
-- ---------------------------------------------------------------------------
begin;
do $$
begin
  perform testkit.is_eq('positionen: net/vat/gross sind GENERIERTE Spalten (kein Client-Feld)',
    (select count(*) from information_schema.columns
      where table_schema = 'app' and table_name = 'invoice_items'
        and column_name in ('net_cents', 'vat_cents', 'gross_cents')
        and is_generated = 'ALWAYS'), 3);

  perform testkit.is_eq('positionen: der Rechnungsstatus kennt jetzt "partially_paid"',
    (select count(*) from pg_enum e join pg_type t on t.oid = e.enumtypid
      where t.typname = 'invoice_status' and e.enumlabel = 'partially_paid'), 1);

  -- Gegenprobe: es gibt ueberhaupt Positionen, und sie summieren sich.
  perform testkit.is_eq('positionen: f-004 hat 2 Positionen',
    (select count(*) from app.invoice_items
      where invoice_id = 'f0000000-0000-4000-8000-000000000004'), 2);
  perform testkit.is_eq('positionen: 7 % auf 1869 netto = 131 Steuer (auf der ZEILE gerundet)',
    (select vat_cents from app.invoice_items
      where id = 'f1000000-0000-4000-8000-000000000002'), 131);
  perform testkit.is_eq('positionen: brutto der Zeile = 1869 + 131 = 2000',
    (select gross_cents from app.invoice_items
      where id = 'f1000000-0000-4000-8000-000000000002'), 2000);
  perform testkit.is_eq('positionen: die Rechnung traegt die Steuersumme (131)',
    (select vat_total_cents from app.invoices where id = 'f0000000-0000-4000-8000-000000000004'), 131);
  perform testkit.is_eq('positionen: und der Rechnungsbetrag ist die Summe der Positionen (12000)',
    (select amount_cents from app.invoices where id = 'f0000000-0000-4000-8000-000000000004'), 12000);
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- B) Die Datenbank rechnet — an einer Zahl, die von Hand leicht falsch wird.
--    3 x 3,33 EUR = 9,99 EUR netto, 19 % davon = 1,8981 EUR -> 1,90 EUR.
--    Wer auf der SUMME statt auf der Zeile rundet oder float benutzt, landet
--    hier woanders.
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000003","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"treasurer"}}',
  true);
set local role authenticated;

insert into app.invoices (id, club_id, member_id, number, title, amount_cents, status)
values ('f0000000-0000-4000-8000-0000000000d1', 'c1ab0000-0000-4000-8000-000000000001',
        'a0000000-0000-4000-8000-000000000009', 'R-TEST-0001', 'Entwurf fuer 99pD', 0, 'draft');

insert into app.invoice_items
  (id, club_id, invoice_id, sort_order, description, quantity, unit_price_cents, vat_rate)
values ('f1000000-0000-4000-8000-0000000000d1', 'c1ab0000-0000-4000-8000-000000000001',
        'f0000000-0000-4000-8000-0000000000d1', 1, 'Kufenschoner', 3.000, 333, 19.00);

do $$
begin
  perform testkit.is_eq('rechnen: 3 x 333 = 999 netto',
    (select net_cents from app.invoice_items where id = 'f1000000-0000-4000-8000-0000000000d1'), 999);
  perform testkit.is_eq('rechnen: 19 % von 999 = 189,81 -> 190 (kaufmaennisch, auf der Zeile)',
    (select vat_cents from app.invoice_items where id = 'f1000000-0000-4000-8000-0000000000d1'), 190);
  perform testkit.is_eq('rechnen: brutto 1189',
    (select gross_cents from app.invoice_items where id = 'f1000000-0000-4000-8000-0000000000d1'), 1189);
  perform testkit.is_eq('rechnen: der Entwurf traegt die Summe jetzt (1189), obwohl er mit 0 angelegt wurde',
    (select amount_cents from app.invoices where id = 'f0000000-0000-4000-8000-0000000000d1'), 1189);

  -- Die generierten Spalten sind kein Eingabefeld.
  perform testkit.throws('rechnen: gross_cents laesst sich nicht ueberschreiben',
    $q$update app.invoice_items set gross_cents = 1
        where id = 'f1000000-0000-4000-8000-0000000000d1'$q$, '428C9');

  -- Entfernt man die letzte Position, fordert die Rechnung nichts mehr.
  perform testkit.affects('rechnen: die letzte Position wird entfernt',
    $q$delete from app.invoice_items where id = 'f1000000-0000-4000-8000-0000000000d1'$q$, 1);
  perform testkit.is_eq('rechnen: eine Rechnung ohne Positionen fordert 0 — die einzige ehrliche Antwort',
    (select amount_cents from app.invoices where id = 'f0000000-0000-4000-8000-0000000000d1'), 0);
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- C) Nur am ENTWURF (GoBD) — mit Gegenprobe.
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000003","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"treasurer"}}',
  true);
set local role authenticated;
do $$
begin
  perform testkit.throws('gobd: an einer AUSGESTELLTEN Rechnung kommt keine Position dazu',
    $q$insert into app.invoice_items
         (club_id, invoice_id, sort_order, description, quantity, unit_price_cents, vat_rate)
       values ('c1ab0000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000004',
               3, 'Nachtraeglich', 1.000, 500, 0.00)$q$, '42501');

  perform testkit.throws('gobd: und eine bestehende Position ist dort auch nicht aenderbar',
    $q$update app.invoice_items set unit_price_cents = 1
        where id = 'f1000000-0000-4000-8000-000000000001'$q$, '42501');

  perform testkit.throws('gobd: loeschen ebensowenig',
    $q$delete from app.invoice_items where id = 'f1000000-0000-4000-8000-000000000001'$q$, '42501');
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- D) Lesen folgt der RECHNUNG. Die Positionen haben bewusst keine eigene
--    Sichtbarkeitsregel — sonst gaebe es zwei Lesarten, und eine davon wuerde
--    beim naechsten Umbau vergessen.
--    Gestellt an einer Rechnung ueber Lina (a-07), dem Kind von Katrin (a-09).
-- ---------------------------------------------------------------------------
begin;
insert into app.invoices (id, club_id, member_id, number, title, amount_cents, status, issued_on, due_on)
values ('f0000000-0000-4000-8000-0000000000d2', 'c1ab0000-0000-4000-8000-000000000001',
        'a0000000-0000-4000-8000-000000000007', 'R-TEST-0002', 'Startgelder Lina', 0, 'draft',
        current_date, current_date + 14);

insert into app.invoice_items
  (id, club_id, invoice_id, sort_order, description, quantity, unit_price_cents, vat_rate)
values ('f1000000-0000-4000-8000-0000000000d2', 'c1ab0000-0000-4000-8000-000000000001',
        'f0000000-0000-4000-8000-0000000000d2', 1, 'Startgeld Bezirksmeisterschaft', 1.000, 2500, 0.00);

select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000009","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"member"}}',
  true);
set local role authenticated;
do $$
begin
  perform testkit.is_eq('positionen-familie: die Mutter sieht die Rechnung ihrer Tochter',
    (select count(*) from app.invoices where id = 'f0000000-0000-4000-8000-0000000000d2'), 1);
  perform testkit.is_eq('positionen-familie: und damit auch deren Positionen',
    (select count(*) from app.invoice_items
      where invoice_id = 'f0000000-0000-4000-8000-0000000000d2'), 1);

  -- Gegenprobe zur Sichtbarkeit: fremde Rechnungen bleiben zu, samt Positionen.
  perform testkit.is_eq('positionen-familie: die Positionen einer FREMDEN Rechnung sieht sie nicht',
    (select count(*) from app.invoice_items
      where invoice_id = 'f0000000-0000-4000-8000-000000000004'), 0);
end;
$$;

reset role;
select set_config('request.jwt.claims', '', true);

select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000012","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"member"}}',
  true);
set local role authenticated;
do $$
begin
  perform testkit.is_eq('positionen-familie: eine FREMDE Mutter sieht Linas Positionen NICHT',
    (select count(*) from app.invoice_items
      where invoice_id = 'f0000000-0000-4000-8000-0000000000d2'), 0);
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- E) TEILZAHLUNG. Ein Etikett ohne Zahl gibt es nicht, und mehr als gefordert
--    kann nicht ankommen.
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000003","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"treasurer"}}',
  true);
set local role authenticated;
do $$
begin
  -- f-001: 8600 + 500 Mahngebuehr = 9100 gesamt.
  perform testkit.affects('teilzahlung: 4000 von 9100 sind angekommen',
    $q$update app.invoices set status = 'partially_paid', paid_cents = 4000
        where id = 'f0000000-0000-4000-8000-000000000001'$q$, 1);

  perform testkit.is_eq('teilzahlung: offen bleiben 5100 — von der Datenbank gerechnet',
    (select open_cents from app.invoices where id = 'f0000000-0000-4000-8000-000000000001'), 5100);

  perform testkit.throws('teilzahlung: mehr als der Gesamtbetrag kann nicht ankommen',
    $q$update app.invoices set paid_cents = 999999
        where id = 'f0000000-0000-4000-8000-000000000001'$q$, '23514');

  perform testkit.throws('teilzahlung: "teilbezahlt" OHNE Zahlung ist ein falsches Etikett',
    $q$update app.invoices set status = 'partially_paid', paid_cents = 0
        where id = 'f0000000-0000-4000-8000-000000000005'$q$, '23514');
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- F) Modul 'finance' AUS -> auch die Positionen sind weg. Ohne Gate waere der
--    Finanz-Schalter eine halbe Wahrheit.
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000004","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"admin"}}',
  true);
set local role authenticated;

insert into app.club_modules (club_id, module_key, enabled)
values ('c1ab0000-0000-4000-8000-000000000001', 'finance', false)
on conflict (club_id, module_key) do update set enabled = false;

do $$
begin
  perform testkit.is_eq('positionen-modul: "finance" AUS -> 0 Rechnungen',
    (select count(*) from app.invoices), 0);
  perform testkit.is_eq('positionen-modul: "finance" AUS -> auch 0 Positionen',
    (select count(*) from app.invoice_items), 0);
end;
$$;
rollback;
