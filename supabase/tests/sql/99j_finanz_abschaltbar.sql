-- ============================================================================
-- 99j_finanz_abschaltbar.sql — 'finance' ist ein abschaltbares Modul (0061).
--
-- WARUM DIESE DATEI
-- ---------------------------------------------------------------------------
-- 0061 nimmt 'finance' aus den Kernmodulen und macht es 'enforced'. Der Nutzer
-- war klar: "nicht jeder verein moechte die finanzen mit dieser app machen,
-- dann sollte es ausschaltbar sein und dann auch in keinem bereich was mit
-- finanzen/rechnungen anzeigen." Diese Datei MISST das nach:
--   B) AUS -> jede Finanztabelle liefert 0 Zeilen, Schreiben scheitert (42501).
--   C) Die DATEN bleiben in der DB (GoBD-sicher) — der Schalter verbirgt nur.
--   D) Wieder EIN -> alles zurueck. Kein Datenverlust.
--   E) Positivkontrolle (Sabotage): ohne das Gate ist der Schalter wirkungslos.
--   F) members/manage bleiben Kern (P0001), finance NICHT.
--
-- Personas (seed), Verein A = c1ab..01 (RSV Neckarsulm):
--   Thomas  90..04  admin      (is_club_admin -> darf schalten; FINANCE_ROLES)
--   Beate   90..03  treasurer  (Finanz-Zugriff, aber KEIN Admin)
--   Katrin  90..09  member     (kein Finanz-Zugriff)
-- Seed-Finanzdaten: 10 invoices, 10 member_fees, 10 ledger_entries,
--   3 donations, 3 sepa_mandates, 4 membership_categories, 5 budgets.
--
-- Diese Datei ist NEU. Bestands-Tests bleiben unberuehrt.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- A) Ausgangslage: nie einen Schalter angefasst = finance AN (fehlende Zeile).
--    Der admin sieht die Finanzen wie bisher.
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000004","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"admin"}}',
  true);
set local role authenticated;
do $$
begin
  perform testkit.is_eq('finance: unberuehrt ist "finance" eingeschaltet',
    (select case when app.module_enabled('c1ab0000-0000-4000-8000-000000000001','finance') then 1 else 0 end), 1);
  perform testkit.is_eq('finance AN: admin sieht 10 Rechnungen', (select count(*) from app.invoices), 10);
  perform testkit.is_eq('finance AN: admin sieht 10 Beitraege',  (select count(*) from app.member_fees), 10);
  perform testkit.is_eq('finance AN: admin sieht 10 Kassenbuch-Zeilen', (select count(*) from app.ledger_entries), 10);
  perform testkit.is_eq('finance AN: admin sieht 3 Spenden',     (select count(*) from app.donations), 3);
  perform testkit.is_eq('finance AN: admin sieht 3 SEPA-Mandate',(select count(*) from app.sepa_mandates), 3);
  perform testkit.is_eq('finance AN: admin sieht 5 Budgets',     (select count(*) from app.budgets), 5);
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- B) Der admin schaltet finance AUS (erlaubt seit 0061 — KEIN P0001) und sieht
--    danach in KEINEM Finanzbereich mehr etwas; Schreiben scheitert mit 42501.
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000004","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"admin"}}',
  true);
set local role authenticated;

do $$
begin
  perform testkit.succeeds('finance: der admin DARF "finance" abschalten (kein Kernmodul mehr)',
    $q$insert into app.club_modules (club_id, module_key, enabled)
       values ('c1ab0000-0000-4000-8000-000000000001', 'finance', false)$q$);

  perform testkit.is_eq('finance AUS: 0 Rechnungen (die Daten sind weg, nicht nur die Kachel)',
    (select count(*) from app.invoices), 0);
  perform testkit.is_eq('finance AUS: 0 Beitraege',          (select count(*) from app.member_fees), 0);
  perform testkit.is_eq('finance AUS: 0 Kassenbuch-Zeilen',  (select count(*) from app.ledger_entries), 0);
  perform testkit.is_eq('finance AUS: 0 Spenden',            (select count(*) from app.donations), 0);
  perform testkit.is_eq('finance AUS: 0 SEPA-Mandate',       (select count(*) from app.sepa_mandates), 0);
  perform testkit.is_eq('finance AUS: 0 Budgets',            (select count(*) from app.budgets), 0);
  perform testkit.is_eq('finance AUS: 0 Beitragskategorien', (select count(*) from app.membership_categories), 0);

  -- Schreiben scheitert (restriktives with check -> 42501). Auch der admin.
  perform testkit.throws('finance AUS: admin kann KEINE Rechnung anlegen (42501)',
    $q$insert into app.invoices (club_id, member_id, number, title, amount_cents, status)
       values ('c1ab0000-0000-4000-8000-000000000001',
               (select id from app.club_members where club_id='c1ab0000-0000-4000-8000-000000000001' and deleted_at is null limit 1),
               'X-999', 'Trotzdem', 100, 'draft')$q$, '42501');
end;
$$;

-- C) DIE DATEN BLEIBEN. Als Tabellen-Owner (postgres umgeht RLS) sind die Zeilen
--    trotz ausgeschaltetem Modul unveraendert da — der Schalter loescht NIE.
reset role;
do $$
begin
  perform testkit.is_eq('finance AUS: die 10 Rechnungen liegen WEITER in der DB (GoBD-sicher)',
    (select count(*) from app.invoices where club_id='c1ab0000-0000-4000-8000-000000000001'), 10);
  perform testkit.is_eq('finance AUS: die 10 Kassenbuch-Zeilen liegen WEITER in der DB',
    (select count(*) from app.ledger_entries where club_id='c1ab0000-0000-4000-8000-000000000001'), 10);
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- D) Wieder EIN -> alles zurueck. Der Schalter ist keine Einbahnstrasse.
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000004","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"admin"}}',
  true);
set local role authenticated;
insert into app.club_modules (club_id, module_key, enabled)
values ('c1ab0000-0000-4000-8000-000000000001', 'finance', false);
update app.club_modules set enabled = true
 where club_id='c1ab0000-0000-4000-8000-000000000001' and module_key='finance';
do $$
begin
  perform testkit.is_eq('finance wieder AN: die 10 Rechnungen sind zurueck',
    (select count(*) from app.invoices), 10);
  perform testkit.is_eq('finance wieder AN: die 3 Spenden sind zurueck',
    (select count(*) from app.donations), 3);
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- E) POSITIVKONTROLLE (Sabotage, wie 99e Block F): OHNE das Gate ist der
--    Schalter wirkungslos. Wir werfen das invoices-Gate weg, schalten finance
--    AUS und verlangen: die Rechnungen sind trotzdem sichtbar -> der Fix (das
--    Gate) ist also der Wirksame. Alles in begin/rollback, das Gate ueberlebt.
-- ---------------------------------------------------------------------------
begin;
-- Etikett/Gate-Ausgangslage.
do $$
begin
  perform testkit.is_eq('finance: Ausgangslage — "finance" ist "enforced" etikettiert',
    (select count(*) from app.modules where key='finance' and enforcement='enforced'), 1);
  perform testkit.is_eq('finance: Ausgangslage — "finance" hat >=1 Gate',
    (select case when count(*) > 0 then 1 else 0 end from app.module_policy_usage() where module_key='finance'), 1);
end;
$$;

-- Der nachgestellte Drift: das invoices-Gate faellt weg.
drop policy invoices_module_gate on app.invoices;

-- finance ausschalten ...
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000004","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"admin"}}',
  true);
set local role authenticated;
insert into app.club_modules (club_id, module_key, enabled)
values ('c1ab0000-0000-4000-8000-000000000001', 'finance', false);

do $$
declare v_seen int;
begin
  select count(*) into v_seen from app.invoices;
  if v_seen > 0 then
    perform testkit.ok(format(
      'finance: OHNE invoices-Gate ist der Schalter wirkungslos (%s Rechnungen trotz finance=aus) — das Gate ist der Wirksame', v_seen));
  else
    perform testkit.fail('finance: OHNE invoices-Gate ist der Schalter wirkungslos',
      'auch ohne Gate 0 Rechnungen — dann misst Block B etwas anderes als das Gate');
  end if;
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- F) Die Schutzlinien: members/manage bleiben Kern (P0001), finance NICHT.
--    Und wer kein Admin ist, schaltet gar nicht.
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000004","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"admin"}}',
  true);
set local role authenticated;
do $$
begin
  perform testkit.throws('finance: "members" bleibt Kern — nicht abschaltbar (P0001)',
    $q$insert into app.club_modules (club_id, module_key, enabled)
       values ('c1ab0000-0000-4000-8000-000000000001','members',false)$q$, 'P0001');
  perform testkit.throws('finance: "manage" bleibt Kern — nicht abschaltbar (P0001)',
    $q$insert into app.club_modules (club_id, module_key, enabled)
       values ('c1ab0000-0000-4000-8000-000000000001','manage',false)$q$, 'P0001');
end;
$$;
rollback;

-- Der treasurer hat Finanz-Zugriff, ist aber KEIN Vereins-Admin -> darf den
-- Schalter NICHT stellen (RLS 42501). Der Schalter gehoert zur Verwaltung.
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000003","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"treasurer"}}',
  true);
set local role authenticated;
do $$
begin
  perform testkit.is_eq('finance: der treasurer SIEHT die Finanzen (10 Rechnungen)',
    (select count(*) from app.invoices), 10);
  perform testkit.throws('finance: der treasurer kann "finance" NICHT abschalten (kein Admin, 42501)',
    $q$insert into app.club_modules (club_id, module_key, enabled)
       values ('c1ab0000-0000-4000-8000-000000000001','finance',false)$q$, '42501');
end;
$$;
rollback;
