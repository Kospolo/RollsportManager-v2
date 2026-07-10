-- ============================================================================
-- 42_finance_b.sql — test class: Beitragswesen (migration 0014).
--
-- Four tables with two visibility shapes:
--   * membership_categories + family_discounts — the club's public fee model:
--     READ = any club member, WRITE = can_manage_finance.
--   * member_fees + sepa_mandates — personal data: READ = the member (or their
--     guardian) OR can_manage_finance; WRITE = can_manage_finance only.
--
-- DATENSCHUTZ: sepa_mandates never carries a full IBAN (only iban_last4).
--
-- Fixed seed ids (seed.sql): club c1ab…-001; members Sandra a…-001 (coach),
-- Beate a…-003 (treasurer), Katrin a…-009 (member, guardian of Lina a…-007 and
-- Emma a…-008), Petra a…-014 (member). Categories bc10…-001…004; discount
-- fd10…-001; mandates 5e9a…-001 (Katrin), …-003 (Petra). Cross-tenant: club B
-- owner Bert (deadbeef-…) has NO finance-B rows of his own.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Plain member (Katrin Grünewald) — sees the fee model + her OWN + her
-- children's personal rows, never other members', and writes nothing.
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000009","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"member"}}',
  true);
set local role authenticated;

do $$
begin
  perform testkit.is_eq('finance-b: member reads the 4 fee categories (public fee model)',
    (select count(*) from app.membership_categories), 4);
  perform testkit.is_eq('finance-b: member reads the 1 family discount',
    (select count(*) from app.family_discounts), 1);
  perform testkit.is_eq('finance-b: member sees her OWN + 2 children''s fee assignments (3)',
    (select count(*) from app.member_fees), 3);
  perform testkit.is_eq('finance-b: member does NOT see a non-child member''s fee (Petra: 0)',
    (select count(*) from app.member_fees where member_id = 'a0000000-0000-4000-8000-000000000014'), 0);
  perform testkit.is_eq('finance-b: member sees her OWN SEPA mandate (1)',
    (select count(*) from app.sepa_mandates), 1);
  perform testkit.is_eq('finance-b: member does NOT see a foreign SEPA mandate (Petra: 0)',
    (select count(*) from app.sepa_mandates where member_id = 'a0000000-0000-4000-8000-000000000014'), 0);

  perform testkit.throws('finance-b: member INSERT of a category is rejected',
    $q$insert into app.membership_categories (club_id, name, amount_cents, period)
       values ('c1ab0000-0000-4000-8000-000000000001', 'Hack', 100, 'monthly')$q$, '42501');
  perform testkit.throws('finance-b: member INSERT of a family discount is rejected',
    $q$insert into app.family_discounts (club_id, label, kind, value_numeric)
       values ('c1ab0000-0000-4000-8000-000000000001', 'Hack', 'percent', 90)$q$, '42501');
  perform testkit.throws('finance-b: member INSERT of a fee assignment is rejected',
    $q$insert into app.member_fees (club_id, member_id, category_id, valid_from)
       values ('c1ab0000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000009',
               'bc100000-0000-4000-8000-000000000001', current_date)$q$, '42501');
  perform testkit.throws('finance-b: member INSERT of a SEPA mandate is rejected',
    $q$insert into app.sepa_mandates (club_id, member_id, mandate_reference, account_holder)
       values ('c1ab0000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000009',
               'HACK-1', 'Katrin Grünewald')$q$, '42501');
  -- UPDATE under an RLS using-clause the member fails is a silent no-op (0 rows).
  perform testkit.affects('finance-b: member UPDATE of a category is silently filtered (0 rows)',
    $q$update app.membership_categories set amount_cents = 1
        where id = 'bc100000-0000-4000-8000-000000000001'$q$, 0);
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- Coach (Sandra Vogel) — reads the public fee model, but has no fee/mandate of
-- her own and no children, so sees NONE of the personal rows.
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000001","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"coach"}}',
  true);
set local role authenticated;

do $$
begin
  perform testkit.is_eq('finance-b: coach reads the 4 categories (member of the club)',
    (select count(*) from app.membership_categories), 4);
  perform testkit.is_eq('finance-b: coach sees NO fee assignments (none own, no children)',
    (select count(*) from app.member_fees), 0);
  perform testkit.is_eq('finance-b: coach sees NO SEPA mandates',
    (select count(*) from app.sepa_mandates), 0);
  perform testkit.throws('finance-b: coach INSERT of a fee assignment is rejected',
    $q$insert into app.member_fees (club_id, member_id, category_id, valid_from)
       values ('c1ab0000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001',
               'bc100000-0000-4000-8000-000000000001', current_date)$q$, '42501');
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
  perform testkit.is_eq('finance-b: treasurer sees all 4 categories',
    (select count(*) from app.membership_categories), 4);
  perform testkit.is_eq('finance-b: treasurer sees all 10 fee assignments',
    (select count(*) from app.member_fees), 10);
  perform testkit.is_eq('finance-b: treasurer sees all 3 SEPA mandates',
    (select count(*) from app.sepa_mandates), 3);
  perform testkit.is_eq('finance-b: treasurer sees the 1 family discount',
    (select count(*) from app.family_discounts), 1);

  perform testkit.succeeds('finance-b: treasurer MAY create a category',
    $q$insert into app.membership_categories (club_id, name, amount_cents, period, sort_order)
       values ('c1ab0000-0000-4000-8000-000000000001', 'Fördermitglied', 3000, 'yearly', 5)$q$);
  perform testkit.succeeds('finance-b: treasurer MAY assign a fee to a member',
    $q$insert into app.member_fees (club_id, member_id, category_id, valid_from)
       values ('c1ab0000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001',
               'bc100000-0000-4000-8000-000000000003', current_date)$q$);
  perform testkit.succeeds('finance-b: treasurer MAY create a family discount',
    $q$insert into app.family_discounts (club_id, label, kind, value_numeric, applies_from_child)
       values ('c1ab0000-0000-4000-8000-000000000001', 'ab dem 3. Kind frei', 'percent', 100, 3)$q$);
  perform testkit.succeeds('finance-b: treasurer MAY create a SEPA mandate (iban_last4 only)',
    $q$insert into app.sepa_mandates (club_id, member_id, mandate_reference, iban_last4, account_holder, status)
       values ('c1ab0000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001',
               'RSV-M-NEW-0001', '0042', 'Sandra Vogel', 'active')$q$);

  perform testkit.affects('finance-b: treasurer MAY soft-delete a category (1 row)',
    $q$update app.membership_categories set deleted_at = now()
        where id = 'bc100000-0000-4000-8000-000000000004'$q$, 1);
  perform testkit.affects('finance-b: treasurer MAY revoke a SEPA mandate (1 row)',
    $q$update app.sepa_mandates set status = 'revoked'
        where id = '5e9a0000-0000-4000-8000-000000000003'$q$, 1);

  perform testkit.throws('finance-b: category HARD delete is rejected (grant revoked)',
    $q$delete from app.membership_categories
        where id = 'bc100000-0000-4000-8000-000000000001'$q$, '42501');
  perform testkit.throws('finance-b: SEPA mandate HARD delete is rejected (grant revoked)',
    $q$delete from app.sepa_mandates
        where id = '5e9a0000-0000-4000-8000-000000000001'$q$, '42501');
  -- iban_last4 CHECK: only 4 digits — a full IBAN can never be stored.
  perform testkit.throws('finance-b: iban_last4 rejects a full IBAN (CHECK)',
    $q$insert into app.sepa_mandates (club_id, member_id, mandate_reference, iban_last4, account_holder)
       values ('c1ab0000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001',
               'RSV-M-BAD-1', 'DE89370400440532013000', 'Sandra Vogel')$q$, '23514');
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- Cross-tenant isolation — club B owner (can_manage_finance in HIS club) sees
-- NONE of club A's fee model or personal rows.
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claims',
  '{"sub":"deadbeef-9000-4000-8000-000000000001","role":"authenticated","club_roles":{"deadbeef-0000-4000-8000-000000000001":"owner"}}',
  true);
set local role authenticated;

do $$
begin
  perform testkit.is_eq('finance-b: club-B owner sees NO club-A categories (0)',
    (select count(*) from app.membership_categories
      where club_id = 'c1ab0000-0000-4000-8000-000000000001'), 0);
  perform testkit.is_eq('finance-b: club-B owner sees NO club-A fee assignments (0)',
    (select count(*) from app.member_fees
      where club_id = 'c1ab0000-0000-4000-8000-000000000001'), 0);
  perform testkit.is_eq('finance-b: club-B owner sees NO club-A SEPA mandates (0)',
    (select count(*) from app.sepa_mandates
      where club_id = 'c1ab0000-0000-4000-8000-000000000001'), 0);
  perform testkit.throws('finance-b: club-B owner cannot INSERT into club A (RLS)',
    $q$insert into app.membership_categories (club_id, name, amount_cents, period)
       values ('c1ab0000-0000-4000-8000-000000000001', 'Cross', 100, 'monthly')$q$, '42501');
end;
$$;
rollback;
