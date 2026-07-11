-- ============================================================================
-- 0015_finance_c.sql — RollsportManager v2 — Finance depth, Batch C.
--
-- Builds on 0005_finance.sql (invoices/ledger) + 0007_roles_moderator.sql
-- (capability helpers) + 0013/0014. Adds the last two finance surfaces the v1
-- screens relied on (bankabgleich.html, spenden.html):
--
--   * app.bank_transactions — imported/manual bank movements the treasurer
--     reconciles against open invoices (v1: bankabgleich.html). amount_cents is
--     SIGNED (+ Eingang / - Ausgang), status unmatched/matched/ignored.
--   * app.donations         — donations + their Spendenbescheinigung numbers
--     (v1: spenden.html). receipt_number is race-free per club+year (a counter
--     table + a security-definer RPC, exactly like the invoice number).
--
-- Hard rules (Blueprint §4 + GoBD, carried over):
--   * Finance = can_manage_finance (owner/admin/moderator/treasurer).
--       - bank_transactions: read + write = finance only. Members never see
--         bank data.
--       - donations: read = the donor member themselves (or their guardian) OR
--         finance; write = finance only. A member sees their OWN donation, never
--         a foreign one or the anonymous ones.
--   * NEVER ON DELETE CASCADE on financial FKs — RESTRICT everywhere.
--   * No client hard-delete: rows are retired via deleted_at (soft-delete);
--     DELETE is revoked as belt-and-suspenders.
--   * Money is integer cents (bigint). bank_transactions.amount_cents is signed;
--     donations.amount_cents is a non-negative amount (a donation is never
--     negative).
--   * receipt_number is unique per club and generated race-free (counter table
--     + atomic UPSERT … RETURNING) — never COUNT(*)+1.
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- bank_transactions — the Bankabgleich working set. Each row is one bank
-- movement (imported from CSV/JSON or entered by hand). The treasurer matches
-- an income row to an open invoice (matched_invoice_id) and optionally posts a
-- matching Kassenbuch entry (matched_ledger_entry_id); irrelevant rows are set
-- to 'ignored'. amount_cents is signed: + money in, - money out. Soft-delete
-- via deleted_at.
-- ----------------------------------------------------------------------------
create table app.bank_transactions (
  id                      uuid primary key default app.uuid_v7(),
  club_id                 uuid not null references app.clubs (id) on delete restrict,
  booked_on               date not null,
  -- signed integer cents: + Eingang / - Ausgang
  amount_cents            bigint not null,
  purpose                 text,
  counterparty            text,
  matched_invoice_id      uuid references app.invoices (id) on delete restrict,
  matched_ledger_entry_id uuid references app.ledger_entries (id) on delete restrict,
  status                  text not null default 'unmatched'
                            check (status in ('unmatched', 'matched', 'ignored')),
  imported_at             timestamptz not null default now(),
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  deleted_at              timestamptz
);

create index bank_transactions_club_idx
  on app.bank_transactions (club_id, status, booked_on desc)
  where deleted_at is null;
create index bank_transactions_matched_invoice_idx
  on app.bank_transactions (matched_invoice_id)
  where matched_invoice_id is not null;

create trigger bank_transactions_set_updated_at
  before update on app.bank_transactions
  for each row execute function app.set_updated_at();

-- ----------------------------------------------------------------------------
-- donation_receipt_counters — race-free receipt number sequence per club+year,
-- exactly like app.invoice_counters (0005). Only the API layer (service_role)
-- ever touches it via app.next_donation_receipt_number().
-- ----------------------------------------------------------------------------
create table app.donation_receipt_counters (
  club_id    uuid not null references app.clubs (id) on delete restrict,
  year       integer not null,
  last_value integer not null default 0,
  primary key (club_id, year)
);

alter table app.donation_receipt_counters enable row level security;
-- no policies: only the API layer (service_role) touches the counter.
revoke all on app.donation_receipt_counters from authenticated;

-- Atomic number generator: INSERT … ON CONFLICT … UPDATE … RETURNING takes a
-- row lock on the counter — two concurrent donations can never collide.
create or replace function app.next_donation_receipt_number(p_club_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_year  integer := extract(year from now())::integer;
  v_value integer;
begin
  insert into app.donation_receipt_counters (club_id, year, last_value)
  values (p_club_id, v_year, 1)
  on conflict (club_id, year)
  do update set last_value = app.donation_receipt_counters.last_value + 1
  returning last_value into v_value;

  return format('SP-%s-%s', v_year, lpad(v_value::text, 4, '0'));
end;
$$;

-- receipt-number generation is an API-layer operation only
revoke execute on function app.next_donation_receipt_number(uuid) from public;
grant execute on function app.next_donation_receipt_number(uuid) to service_role;

-- ----------------------------------------------------------------------------
-- donations — Spenden + Spendenbescheinigung. member_id is nullable (a donor
-- need not be a club member). donor_name/donor_address are the details printed
-- on the receipt; receipt_number is unique per club and issued at creation.
-- issued_at is set when the Bescheinigung is actually handed out (null = draft
-- receipt). Soft-delete via deleted_at.
-- ----------------------------------------------------------------------------
create table app.donations (
  id             uuid primary key default app.uuid_v7(),
  club_id        uuid not null references app.clubs (id) on delete restrict,
  member_id      uuid references app.club_members (id) on delete restrict,
  donor_name     text not null,
  donor_address  text,
  amount_cents   bigint not null check (amount_cents >= 0),
  donation_date  date not null,
  receipt_number text not null,
  purpose        text,
  issued_at      timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  deleted_at     timestamptz,
  constraint donations_receipt_uq unique (club_id, receipt_number)
);

create index donations_club_idx  on app.donations (club_id, donation_date desc) where deleted_at is null;
create index donations_member_idx on app.donations (member_id) where member_id is not null and deleted_at is null;

create trigger donations_set_updated_at
  before update on app.donations
  for each row execute function app.set_updated_at();

-- ----------------------------------------------------------------------------
-- RLS + grants.
--   * bank_transactions: read + write (incl. soft-delete via UPDATE) = finance.
--   * donations: read = the member (or their guardian) OR finance; write =
--     finance only.
--   * both soft-delete via UPDATE, so clients never need DELETE — revoke it.
-- ----------------------------------------------------------------------------
alter table app.bank_transactions enable row level security;
alter table app.donations         enable row level security;

revoke delete on app.bank_transactions from authenticated;
revoke delete on app.donations         from authenticated;

-- --- bank_transactions -----------------------------------------------------
create policy bank_transactions_select on app.bank_transactions
  for select to authenticated
  using (app.can_manage_finance(club_id));

create policy bank_transactions_insert on app.bank_transactions
  for insert to authenticated
  with check (app.can_manage_finance(club_id));

create policy bank_transactions_update on app.bank_transactions
  for update to authenticated
  using (app.can_manage_finance(club_id))
  with check (app.can_manage_finance(club_id));

-- --- donations -------------------------------------------------------------
create policy donations_select on app.donations
  for select to authenticated
  using (
    app.can_manage_finance(club_id)
    or (member_id is not null and app.can_act_for_member(member_id))
  );

create policy donations_insert on app.donations
  for insert to authenticated
  with check (app.can_manage_finance(club_id));

create policy donations_update on app.donations
  for update to authenticated
  using (app.can_manage_finance(club_id))
  with check (app.can_manage_finance(club_id));

commit;
