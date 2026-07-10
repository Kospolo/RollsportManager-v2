-- ============================================================================
-- 40_finance.sql — test class (d): finance visibility & write protection.
--
--   * plain members: see ONLY their own invoices, never the cash book,
--     and cannot write any financial row
--   * coaches: no finance access at all
--   * treasurer: full read + legitimate writes (invoice, ledger, reversal)
--   * invoice numbers: generator is service_role-only, counter table is
--     invisible to clients (no COUNT(*)+1, no readable counters — v1 race)
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Plain member (Katrin Gruenewald)
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000009","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"member"}}',
  true);
set local role authenticated;

do $$
begin
  perform testkit.is_eq('finance: member sees ONLY her own invoices (2)',
    (select count(*) from app.invoices), 2);
  perform testkit.is_eq('finance: cash book is hidden from members (0 rows)',
    (select count(*) from app.ledger_entries), 0);
  perform testkit.throws('finance: member INSERT into the cash book is rejected',
    $q$insert into app.ledger_entries
         (club_id, entry_on, description, counterparty_kind, counterparty_name, amount_cents)
       values ('c1ab0000-0000-4000-8000-000000000001', current_date,
               'Fake income', 'org', 'Evil Corp', 100000)$q$, '42501');
  perform testkit.throws('finance: member INSERT of an invoice is rejected',
    $q$insert into app.invoices (club_id, member_id, number, title, amount_cents, status)
       values ('c1ab0000-0000-4000-8000-000000000001',
               'a0000000-0000-4000-8000-000000000009',
               'R-HACK-0001', 'Selfmade', 0, 'paid')$q$, '42501');
  perform testkit.affects('finance: member cannot mark her OWN invoice as paid (0 rows)',
    $q$update app.invoices set status = 'paid'
        where id = 'f0000000-0000-4000-8000-000000000001'$q$, 0);
  perform testkit.affects('finance: member cannot touch foreign invoices (0 rows)',
    $q$update app.invoices set status = 'paid'
        where id = 'f0000000-0000-4000-8000-000000000005'$q$, 0);
  perform testkit.throws('finance: member DELETE of her own invoice is rejected (grant revoked)',
    $q$delete from app.invoices
        where id = 'f0000000-0000-4000-8000-000000000001'$q$, '42501');
  perform testkit.throws('finance: invoice counter table is invisible to clients',
    $q$select count(*) from app.invoice_counters$q$, '42501');
  perform testkit.throws('finance: invoice number generator is not executable by clients',
    $q$select app.next_invoice_number('c1ab0000-0000-4000-8000-000000000001')$q$, '42501');
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- Coach (Sandra Vogel) — coaching staff has no finance visibility
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000001","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"coach"}}',
  true);
set local role authenticated;

do $$
begin
  perform testkit.is_eq('finance: coach sees no cash book (0 rows)',
    (select count(*) from app.ledger_entries), 0);
  perform testkit.is_eq('finance: coach sees no invoices (0 rows, none of her own)',
    (select count(*) from app.invoices), 0);
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- Treasurer (Beate Schaefer) — the legitimate finance role
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000003","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"treasurer"}}',
  true);
set local role authenticated;

do $$
begin
  perform testkit.is_eq('finance: treasurer sees ALL invoices (10)',
    (select count(*) from app.invoices), 10);
  perform testkit.is_eq('finance: treasurer sees the full cash book (10)',
    (select count(*) from app.ledger_entries), 10);
  perform testkit.succeeds('finance: treasurer MAY create an invoice',
    $q$insert into app.invoices (club_id, member_id, number, title, amount_cents, status)
       values ('c1ab0000-0000-4000-8000-000000000001',
               'a0000000-0000-4000-8000-000000000009',
               'R-TEST-9001', 'Testrechnung', 1000, 'draft')$q$);
  perform testkit.succeeds('finance: treasurer MAY append a cash book entry',
    $q$insert into app.ledger_entries
         (club_id, entry_on, description, counterparty_kind, counterparty_name, amount_cents, category)
       values ('c1ab0000-0000-4000-8000-000000000001', current_date,
               'Bankgebuehren Test', 'org', 'Volksbank', -500, 'Gebuehren')$q$);
  perform testkit.succeeds('finance: treasurer MAY append a REVERSAL entry (Storno pattern)',
    $q$insert into app.ledger_entries
         (club_id, entry_on, description, counterparty_kind, counterparty_name,
          amount_cents, category, reverses_entry_id)
       select club_id, current_date, 'Reversal: Musiklizenz Trainingsbetrieb',
              'org', 'GEMA', 4900, 'Lizenzen', id
         from app.ledger_entries
        where description = 'Musiklizenz Trainingsbetrieb'$q$);
  perform testkit.affects('finance: treasurer MAY raise a dunning level (1 row)',
    $q$update app.invoices set dunning_level = 3
        where id = 'f0000000-0000-4000-8000-000000000001'$q$, 1);
  perform testkit.throws('finance: even the treasurer cannot UPDATE the cash book',
    $q$update app.ledger_entries set amount_cents = 0
        where description = 'Musiklizenz Trainingsbetrieb'$q$, '42501');
  perform testkit.throws('finance: even the treasurer cannot DELETE from the cash book',
    $q$delete from app.ledger_entries
        where description = 'Musiklizenz Trainingsbetrieb'$q$, '42501');
  perform testkit.throws('finance: even the treasurer must not call the number generator directly',
    $q$select app.next_invoice_number('c1ab0000-0000-4000-8000-000000000001')$q$, '42501');
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- service_role — the only legitimate caller of the number generator
-- ---------------------------------------------------------------------------
begin;
set local role service_role;
do $$
declare
  v text;
begin
  v := app.next_invoice_number('c1ab0000-0000-4000-8000-000000000001');
  if v !~ '^R-\d{4}-0091$' then
    perform testkit.fail('finance: next_invoice_number continues the seed sequence (0090 -> 0091)',
      format('got %s', v));
  end if;
  perform testkit.ok('finance: next_invoice_number continues the seed sequence (0090 -> 0091)');
end;
$$;
rollback;
