-- ============================================================================
-- 80_gobd_immutability.sql — test class (h): GoBD immutability.
--
-- The cash book (ledger_entries) is an append-only journal: UPDATE/DELETE
-- must fail for EVERY role — treasurer, service_role, even the superuser.
-- Corrections happen via reversal entries (reverses_entry_id).
-- Issued invoices are never hard-deleted (cancel via status); only drafts
-- may be deleted, and only by the API layer.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Superuser: even the DBA cannot rewrite financial history
-- ---------------------------------------------------------------------------
begin;
do $$
begin
  perform testkit.throws('GoBD: ledger UPDATE is rejected even for the superuser',
    $q$update app.ledger_entries set amount_cents = 0
        where description = 'Musiklizenz Trainingsbetrieb'$q$, 'P0001');
  perform testkit.throws('GoBD: ledger DELETE is rejected even for the superuser',
    $q$delete from app.ledger_entries
        where description = 'Musiklizenz Trainingsbetrieb'$q$, 'P0001');
  perform testkit.throws('GoBD: deleting an OPEN invoice is rejected',
    $q$delete from app.invoices
        where id = 'f0000000-0000-4000-8000-000000000001'$q$, 'P0001');
  perform testkit.throws('GoBD: deleting a PAID invoice is rejected',
    $q$delete from app.invoices
        where id = 'f0000000-0000-4000-8000-000000000006'$q$, 'P0001');
  perform testkit.succeeds('GoBD: a DRAFT invoice may still be created',
    $q$insert into app.invoices (club_id, member_id, number, title, amount_cents, status)
       values ('c1ab0000-0000-4000-8000-000000000001',
               'a0000000-0000-4000-8000-000000000009',
               'R-TEST-0200', 'Draft to delete', 100, 'draft')$q$);
  perform testkit.affects('GoBD: a DRAFT invoice may be hard-deleted (1 row)',
    $q$delete from app.invoices where number = 'R-TEST-0200'$q$, 1);
  perform testkit.succeeds('GoBD: the documented correction path (reversal entry) works',
    $q$insert into app.ledger_entries
         (club_id, entry_on, description, counterparty_kind, counterparty_name,
          amount_cents, category, reverses_entry_id)
       select club_id, current_date, 'Reversal: Ersatzrollen und Schleifservice',
              'org', 'Sportbedarf Schmid', 8750, 'Material', id
         from app.ledger_entries
        where description = 'Ersatzrollen und Schleifservice'$q$);
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- Treasurer: grant-level protection fires BEFORE the trigger (42501)
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000003","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"treasurer"}}',
  true);
set local role authenticated;

do $$
begin
  perform testkit.throws('GoBD: treasurer ledger UPDATE is rejected (grant revoked)',
    $q$update app.ledger_entries set amount_cents = 0
        where description = 'Musiklizenz Trainingsbetrieb'$q$, '42501');
  perform testkit.throws('GoBD: treasurer ledger DELETE is rejected (grant revoked)',
    $q$delete from app.ledger_entries
        where description = 'Musiklizenz Trainingsbetrieb'$q$, '42501');
  perform testkit.throws('GoBD: treasurer invoice DELETE is rejected (grant revoked)',
    $q$delete from app.invoices
        where id = 'f0000000-0000-4000-8000-000000000001'$q$, '42501');
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- service_role: BYPASSRLS does not bypass the immutability trigger —
-- even the API layer cannot rewrite the journal
-- ---------------------------------------------------------------------------
begin;
set local role service_role;

do $$
begin
  perform testkit.throws('GoBD: service_role ledger UPDATE is rejected (trigger)',
    $q$update app.ledger_entries set amount_cents = 0
        where description = 'Musiklizenz Trainingsbetrieb'$q$, 'P0001');
  perform testkit.throws('GoBD: service_role ledger DELETE is rejected (trigger)',
    $q$delete from app.ledger_entries
        where description = 'Musiklizenz Trainingsbetrieb'$q$, 'P0001');
end;
$$;
rollback;
