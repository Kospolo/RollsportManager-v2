-- ============================================================================
-- 0005_finance.sql — RollsportManager v2
-- Membership fees: invoices with a race-free number sequence and dunning
-- levels; ledger_entries (Kassenbuch) as an immutable, GoBD-compliant journal.
--
-- Hard rules (Blueprint §4 + v1 lessons):
--   * NEVER ON DELETE CASCADE on financial FKs — RESTRICT everywhere.
--   * Ledger entries are append-only: corrections via reversal entries
--     (Storno pattern, reverses_entry_id), enforced by trigger for ALL roles.
--   * Invoice numbers via per-club/per-year counter table with an atomic
--     UPSERT … RETURNING — never COUNT(*)+1 (the v1 race condition).
--   * No deleted_at on financial tables: GoBD data is anonymized, not deleted
--     (Art. 17(3)(b) GDPR); invoices are cancelled via status, drafts may be
--     hard-deleted.
--   * Finance visibility: owner/admin/treasurer; members see their OWN
--     invoices (and those of their children via guardianships).
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- Enums
-- ----------------------------------------------------------------------------
create type app.invoice_status as enum ('draft', 'open', 'paid', 'cancelled');

create type app.counterparty_kind as enum ('person', 'org');

-- ----------------------------------------------------------------------------
-- invoice_counters — race-free invoice number sequence per club and year
-- ----------------------------------------------------------------------------
create table app.invoice_counters (
  club_id    uuid not null references app.clubs (id) on delete restrict,
  year       integer not null,
  last_value integer not null default 0,
  primary key (club_id, year)
);

alter table app.invoice_counters enable row level security;
-- no policies: only the API layer (service_role) touches the counter.
revoke all on app.invoice_counters from authenticated;

-- Atomic number generator: INSERT … ON CONFLICT … UPDATE … RETURNING takes a
-- row lock on the counter — two concurrent invoices can never collide.
create or replace function app.next_invoice_number(p_club_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_year  integer := extract(year from now())::integer;
  v_value integer;
begin
  insert into app.invoice_counters (club_id, year, last_value)
  values (p_club_id, v_year, 1)
  on conflict (club_id, year)
  do update set last_value = app.invoice_counters.last_value + 1
  returning last_value into v_value;

  return format('R-%s-%s', v_year, lpad(v_value::text, 4, '0'));
end;
$$;

-- number generation is an API-layer operation only
revoke execute on function app.next_invoice_number(uuid) from public;
grant execute on function app.next_invoice_number(uuid) to service_role;

-- ----------------------------------------------------------------------------
-- invoices — membership fees & other charges
-- dunning_level: 0 = open, 1 = reminder, 2 = 1st dunning, 3 = 2nd dunning
-- ----------------------------------------------------------------------------
create table app.invoices (
  id            uuid primary key default app.uuid_v7(),
  club_id       uuid not null references app.clubs (id) on delete restrict,
  member_id     uuid not null references app.club_members (id) on delete restrict,
  number        text not null,
  title         text not null,
  amount_cents  bigint not null check (amount_cents >= 0),
  currency      char(3) not null default 'EUR',
  status        app.invoice_status not null default 'draft',
  dunning_level smallint not null default 0 check (dunning_level between 0 and 3),
  issued_on     date,
  due_on        date,
  paid_at       timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint invoices_number_uq unique (club_id, number)
);

create index invoices_club_status_idx on app.invoices (club_id, status, due_on);
create index invoices_member_idx      on app.invoices (member_id);

create trigger invoices_set_updated_at
  before update on app.invoices
  for each row execute function app.set_updated_at();

-- GoBD: issued invoices are never hard-deleted — cancel via status instead.
create or replace function app.protect_invoice_delete()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status <> 'draft' then
    raise exception 'issued invoices cannot be deleted (GoBD) — cancel them instead';
  end if;
  return old;
end;
$$;

create trigger invoices_protect_delete
  before delete on app.invoices
  for each row execute function app.protect_invoice_delete();

-- ----------------------------------------------------------------------------
-- ledger_entries — cash book (Kassenbuch), append-only journal.
-- amount_cents is signed: income > 0, expense < 0.
-- Counterparty: person (FK to club_members) or org (free-text name).
-- ----------------------------------------------------------------------------
create table app.ledger_entries (
  id                     uuid primary key default app.uuid_v7(),
  club_id                uuid not null references app.clubs (id) on delete restrict,
  entry_on               date not null,
  description            text not null,
  counterparty_kind      app.counterparty_kind not null,
  counterparty_member_id uuid references app.club_members (id) on delete restrict,
  counterparty_name      text,
  amount_cents           bigint not null,
  currency               char(3) not null default 'EUR',
  category               text,
  invoice_id             uuid references app.invoices (id) on delete restrict,
  reverses_entry_id      uuid references app.ledger_entries (id) on delete restrict,
  created_by             uuid references app.profiles (id) on delete set null,
  created_at             timestamptz not null default now(),
  constraint ledger_entries_counterparty check (
    (counterparty_kind = 'person' and counterparty_member_id is not null)
    or (counterparty_kind = 'org' and counterparty_name is not null)
  )
);

create index ledger_entries_club_date_idx on app.ledger_entries (club_id, entry_on);
create index ledger_entries_invoice_idx   on app.ledger_entries (invoice_id)
  where invoice_id is not null;

-- Append-only for EVERY role (incl. service_role/superuser): the GoBD journal
-- is corrected via reversal entries, never edited in place.
create or replace function app.ledger_entries_immutable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'ledger entries are immutable (GoBD) — create a reversal entry (reverses_entry_id) instead';
end;
$$;

create trigger ledger_entries_no_update
  before update on app.ledger_entries
  for each row execute function app.ledger_entries_immutable();

create trigger ledger_entries_no_delete
  before delete on app.ledger_entries
  for each row execute function app.ledger_entries_immutable();

-- ----------------------------------------------------------------------------
-- RLS + grants
-- ----------------------------------------------------------------------------
alter table app.invoices       enable row level security;
alter table app.ledger_entries enable row level security;

-- belt and suspenders on top of RLS: clients can never delete invoices or
-- modify ledger rows even if a policy were added by mistake.
revoke delete on app.invoices from authenticated;
revoke update, delete on app.ledger_entries from authenticated;

-- invoices: finance roles see all; members see their own / their children's.
create policy invoices_select on app.invoices
  for select to authenticated
  using (
    app.has_club_role(club_id, array['owner', 'admin', 'treasurer'])
    or app.can_act_for_member(member_id)
  );

create policy invoices_insert on app.invoices
  for insert to authenticated
  with check (app.has_club_role(club_id, array['owner', 'admin', 'treasurer']));

create policy invoices_update on app.invoices
  for update to authenticated
  using (app.has_club_role(club_id, array['owner', 'admin', 'treasurer']))
  with check (app.has_club_role(club_id, array['owner', 'admin', 'treasurer']));

-- ledger: finance roles only (coaches/members never see the cash book)
create policy ledger_entries_select on app.ledger_entries
  for select to authenticated
  using (app.has_club_role(club_id, array['owner', 'admin', 'treasurer']));

create policy ledger_entries_insert on app.ledger_entries
  for insert to authenticated
  with check (app.has_club_role(club_id, array['owner', 'admin', 'treasurer']));
-- no UPDATE/DELETE policies — and the immutability trigger guards everyone.

commit;
