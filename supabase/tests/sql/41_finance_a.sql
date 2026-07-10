-- ============================================================================
-- 41_finance_a.sql — test class (d'): Finance Batch A (migration 0013).
--
-- ledger_categories + dunning_log are finance-only (can_manage_finance) and
-- carry the same GoBD guarantees as the ledger:
--   * plain members / coaches: no read, no write on either table
--   * treasurer: full read + legitimate writes; categories soft-delete only;
--     dunning_log is append-only (no UPDATE/DELETE for ANYONE)
--   * cross-club isolation: a treasurer sees only their OWN club's rows
-- Fixed seed ids: club c1ab…-001, treasurer member a0…-003, open invoice
-- f0…-003, category ca10…-005.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Plain member (Katrin Gruenewald) — no finance visibility at all
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000009","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"member"}}',
  true);
set local role authenticated;

do $$
begin
  perform testkit.is_eq('finance-a: member sees NO ledger categories (0)',
    (select count(*) from app.ledger_categories), 0);
  perform testkit.is_eq('finance-a: member sees NO dunning log (0)',
    (select count(*) from app.dunning_log), 0);
  perform testkit.throws('finance-a: member INSERT of a category is rejected',
    $q$insert into app.ledger_categories (club_id, name, kind)
       values ('c1ab0000-0000-4000-8000-000000000001', 'Hack', 'income')$q$, '42501');
  perform testkit.throws('finance-a: member INSERT into the dunning log is rejected',
    $q$insert into app.dunning_log (club_id, invoice_id, from_stage, to_stage, action)
       values ('c1ab0000-0000-4000-8000-000000000001',
               'f0000000-0000-4000-8000-000000000003', 0, 1, 'reminder')$q$, '42501');
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
  perform testkit.is_eq('finance-a: coach sees no categories (0)',
    (select count(*) from app.ledger_categories), 0);
  perform testkit.is_eq('finance-a: coach sees no dunning log (0)',
    (select count(*) from app.dunning_log), 0);
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
  perform testkit.is_eq('finance-a: treasurer sees all 5 seeded categories (isolation: own club only)',
    (select count(*) from app.ledger_categories), 5);
  perform testkit.is_eq('finance-a: treasurer sees both seeded dunning-log rows (2)',
    (select count(*) from app.dunning_log), 2);
  perform testkit.succeeds('finance-a: treasurer MAY create a category',
    $q$insert into app.ledger_categories (club_id, name, kind, sort_order)
       values ('c1ab0000-0000-4000-8000-000000000001', 'Zuschuss', 'income', 6)$q$);
  perform testkit.succeeds('finance-a: treasurer MAY append a dunning-log row',
    $q$insert into app.dunning_log (club_id, invoice_id, from_stage, to_stage, action, actor_member_id, note)
       values ('c1ab0000-0000-4000-8000-000000000001',
               'f0000000-0000-4000-8000-000000000003', 0, 1, 'reminder',
               'a0000000-0000-4000-8000-000000000003', 'Zahlungserinnerung')$q$);
  perform testkit.affects('finance-a: treasurer MAY soft-delete a category (1 row)',
    $q$update app.ledger_categories set deleted_at = now()
        where id = 'ca100000-0000-4000-8000-000000000005'$q$, 1);
  perform testkit.throws('finance-a: category HARD delete is rejected (grant revoked)',
    $q$delete from app.ledger_categories
        where id = 'ca100000-0000-4000-8000-000000000004'$q$, '42501');
  perform testkit.throws('finance-a: treasurer cannot UPDATE the dunning log (grant revoked)',
    $q$update app.dunning_log set to_stage = 3
        where invoice_id = 'f0000000-0000-4000-8000-000000000001'$q$, '42501');
  perform testkit.throws('finance-a: treasurer cannot DELETE from the dunning log (grant revoked)',
    $q$delete from app.dunning_log
        where invoice_id = 'f0000000-0000-4000-8000-000000000001'$q$, '42501');
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- Superuser & service_role — the append-only trigger fires even for them
-- ---------------------------------------------------------------------------
begin;
do $$
begin
  perform testkit.throws('finance-a: dunning-log UPDATE is rejected even for the superuser',
    $q$update app.dunning_log set to_stage = 3
        where invoice_id = 'f0000000-0000-4000-8000-000000000001'$q$, 'P0001');
  perform testkit.throws('finance-a: dunning-log DELETE is rejected even for the superuser',
    $q$delete from app.dunning_log
        where invoice_id = 'f0000000-0000-4000-8000-000000000001'$q$, 'P0001');
end;
$$;
rollback;

begin;
set local role service_role;
do $$
begin
  perform testkit.throws('finance-a: service_role dunning-log UPDATE is rejected (trigger)',
    $q$update app.dunning_log set to_stage = 3
        where invoice_id = 'f0000000-0000-4000-8000-000000000001'$q$, 'P0001');
  perform testkit.throws('finance-a: service_role dunning-log DELETE is rejected (trigger)',
    $q$delete from app.dunning_log
        where invoice_id = 'f0000000-0000-4000-8000-000000000001'$q$, 'P0001');
end;
$$;
rollback;
