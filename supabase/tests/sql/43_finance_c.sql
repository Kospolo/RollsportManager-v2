-- ============================================================================
-- 43_finance_c.sql — test class: Bankabgleich + Spenden (migration 0015).
--
-- Two visibility shapes:
--   * bank_transactions — finance-only: READ + WRITE = can_manage_finance.
--     Members/coaches see nothing and write nothing.
--   * donations — READ = the donor member (or their guardian) OR finance;
--     WRITE = finance only. A plain member sees ONLY their OWN donation, never
--     a foreign one or an anonymous one.
--
-- GoBD: neither table can be hard-deleted by a client (grant revoked).
-- receipt_number is unique per club (donations_receipt_uq).
--
-- Fixed seed ids (seed.sql): club c1ab…-001; Sandra a…-001 (coach), Beate
-- a…-003 (treasurer), Katrin a…-009 (member, donation d1a…-001), Petra a…-014
-- (moderator, donation d1a…-003). Bank tx ba…-001…006 (…006 ignored). Anonymous
-- donation d1a…-002 (member_id null). Cross-tenant: club B owner deadbeef-….
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Plain member (Katrin Grünewald) — no bank visibility; sees ONLY her own
-- donation; writes nothing.
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000009","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"member"}}',
  true);
set local role authenticated;

do $$
begin
  perform testkit.is_eq('finance-c: member sees NO bank transactions (0)',
    (select count(*) from app.bank_transactions), 0);
  perform testkit.is_eq('finance-c: member sees her OWN donation only (1)',
    (select count(*) from app.donations), 1);
  perform testkit.is_eq('finance-c: member does NOT see a foreign donation (Petra: 0)',
    (select count(*) from app.donations where member_id = 'a0000000-0000-4000-8000-000000000014'), 0);
  perform testkit.is_eq('finance-c: member does NOT see the anonymous donation (0)',
    (select count(*) from app.donations where member_id is null), 0);

  perform testkit.throws('finance-c: member INSERT of a bank transaction is rejected',
    $q$insert into app.bank_transactions (club_id, booked_on, amount_cents)
       values ('c1ab0000-0000-4000-8000-000000000001', current_date, 100)$q$, '42501');
  perform testkit.throws('finance-c: member INSERT of a donation is rejected',
    $q$insert into app.donations (club_id, donor_name, amount_cents, donation_date, receipt_number)
       values ('c1ab0000-0000-4000-8000-000000000001', 'Hack', 100, current_date, 'SP-HACK-1')$q$, '42501');
  -- UPDATE under an RLS using-clause the member fails is a silent no-op (0 rows).
  perform testkit.affects('finance-c: member UPDATE of her own donation is silently filtered (0 rows)',
    $q$update app.donations set donor_name = 'X'
        where id = 'd1a00000-0000-4000-8000-000000000001'$q$, 0);
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- Coach (Sandra Vogel) — coaching staff has no finance visibility at all.
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000001","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"coach"}}',
  true);
set local role authenticated;

do $$
begin
  perform testkit.is_eq('finance-c: coach sees NO bank transactions (0)',
    (select count(*) from app.bank_transactions), 0);
  perform testkit.is_eq('finance-c: coach sees NO donations (none own, no children)',
    (select count(*) from app.donations), 0);
  perform testkit.throws('finance-c: coach INSERT of a bank transaction is rejected',
    $q$insert into app.bank_transactions (club_id, booked_on, amount_cents)
       values ('c1ab0000-0000-4000-8000-000000000001', current_date, 100)$q$, '42501');
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- Treasurer (Beate Schäfer) — the legitimate finance role: full read + writes.
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000003","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"treasurer"}}',
  true);
set local role authenticated;

do $$
begin
  perform testkit.is_eq('finance-c: treasurer sees all 6 bank transactions',
    (select count(*) from app.bank_transactions), 6);
  perform testkit.is_eq('finance-c: treasurer sees the 5 unmatched bank transactions',
    (select count(*) from app.bank_transactions where status = 'unmatched'), 5);
  perform testkit.is_eq('finance-c: treasurer sees all 3 donations (incl. anonymous)',
    (select count(*) from app.donations), 3);

  perform testkit.succeeds('finance-c: treasurer MAY record a bank transaction',
    $q$insert into app.bank_transactions (club_id, booked_on, amount_cents, purpose, counterparty)
       values ('c1ab0000-0000-4000-8000-000000000001', current_date, 4200, 'Testbuchung', 'Test')$q$);
  perform testkit.affects('finance-c: treasurer MAY match a bank transaction (1 row)',
    $q$update app.bank_transactions
         set status = 'matched', matched_invoice_id = 'f0000000-0000-4000-8000-000000000002'
        where id = 'ba000000-0000-4000-8000-000000000001'$q$, 1);
  perform testkit.affects('finance-c: treasurer MAY soft-delete a bank transaction (1 row)',
    $q$update app.bank_transactions set deleted_at = now()
        where id = 'ba000000-0000-4000-8000-000000000006'$q$, 1);

  perform testkit.succeeds('finance-c: treasurer MAY create a donation',
    $q$insert into app.donations (club_id, donor_name, amount_cents, donation_date, receipt_number)
       values ('c1ab0000-0000-4000-8000-000000000001', 'Neuer Spender', 5000, current_date, 'SP-TEST-0001')$q$);
  perform testkit.affects('finance-c: treasurer MAY issue a donation (1 row)',
    $q$update app.donations set issued_at = now()
        where id = 'd1a00000-0000-4000-8000-000000000002'$q$, 1);

  -- receipt_number is unique per club: a duplicate is rejected (23505).
  perform testkit.throws('finance-c: duplicate receipt_number per club is rejected (unique)',
    $q$insert into app.donations (club_id, donor_name, amount_cents, donation_date, receipt_number)
       values ('c1ab0000-0000-4000-8000-000000000001', 'Doppelt', 100, current_date, 'SP-TEST-0001')$q$, '23505');

  perform testkit.throws('finance-c: bank transaction HARD delete is rejected (grant revoked)',
    $q$delete from app.bank_transactions where id = 'ba000000-0000-4000-8000-000000000002'$q$, '42501');
  perform testkit.throws('finance-c: donation HARD delete is rejected (grant revoked)',
    $q$delete from app.donations where id = 'd1a00000-0000-4000-8000-000000000001'$q$, '42501');
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- Cross-tenant isolation — club B owner (finance in HIS club) sees NONE of
-- club A's bank data or donations, and cannot write into club A.
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claims',
  '{"sub":"deadbeef-9000-4000-8000-000000000001","role":"authenticated","club_roles":{"deadbeef-0000-4000-8000-000000000001":"owner"}}',
  true);
set local role authenticated;

do $$
begin
  perform testkit.is_eq('finance-c: club-B owner sees NO club-A bank transactions (0)',
    (select count(*) from app.bank_transactions
      where club_id = 'c1ab0000-0000-4000-8000-000000000001'), 0);
  perform testkit.is_eq('finance-c: club-B owner sees NO club-A donations (0)',
    (select count(*) from app.donations
      where club_id = 'c1ab0000-0000-4000-8000-000000000001'), 0);
  perform testkit.throws('finance-c: club-B owner cannot INSERT a bank transaction into club A (RLS)',
    $q$insert into app.bank_transactions (club_id, booked_on, amount_cents)
       values ('c1ab0000-0000-4000-8000-000000000001', current_date, 100)$q$, '42501');
  perform testkit.throws('finance-c: club-B owner cannot INSERT a donation into club A (RLS)',
    $q$insert into app.donations (club_id, donor_name, amount_cents, donation_date, receipt_number)
       values ('c1ab0000-0000-4000-8000-000000000001', 'Cross', 100, current_date, 'SP-X-1')$q$, '42501');
end;
$$;
rollback;
