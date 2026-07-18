#!/usr/bin/env bash
# =============================================================================
# db-test.sh — RollsportManager v2 schema test harness (local, throwaway)
#
# Boots the SHARED throwaway harness (see lib/pg-harness.sh: postgres:16-alpine
# as rsm2-pg-test on 127.0.0.1:55436, Supabase shim, all migrations + seed),
# then runs assertions: seed counts/sums, RLS tenant isolation, the closed v1
# gaps (role self-change, entitlement writes, ledger immutability, guest expiry).
#
# The container is ALWAYS removed on exit (trap). It never touches any
# production container on this machine.
#
# Usage: supabase/scripts/db-test.sh
# =============================================================================
set -euo pipefail

SCRIPTS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SUPABASE_DIR="$(cd "$SCRIPTS_DIR/.." && pwd)"

HARNESS_LOG_PREFIX="db-test"
# shellcheck source=lib/pg-harness.sh
source "$SCRIPTS_DIR/lib/pg-harness.sh"

log()  { printf '\033[1;34m[db-test]\033[0m %s\n' "$*"; }
fail() { printf '\033[1;31m[db-test] FAIL:\033[0m %s\n' "$*"; exit 1; }

trap harness_teardown EXIT

# run SQL that is EXPECTED to fail (returns 0 if it failed as expected)
expect_error() {
  local label="$1" sql="$2"
  if printf '%s' "$sql" | docker exec -i -e PGPASSWORD="$PGPASS" "$CONTAINER" \
       psql -h 127.0.0.1 -U postgres -d "$DB" -v ON_ERROR_STOP=1 -q >/dev/null 2>&1; then
    fail "$label — statement succeeded but MUST be rejected"
  else
    log "ok: $label (rejected as expected)"
  fi
}

# -----------------------------------------------------------------------------
# 1.-3. Shared harness: container + Supabase shim + migrations + seed
# -----------------------------------------------------------------------------
harness_start
harness_apply_migrations_and_seed

# -----------------------------------------------------------------------------
# 4. Structural + seed assertions
# -----------------------------------------------------------------------------
log "running assertions ..."
pgexec <<'SQL'
create or replace function pg_temp.assert_eq(label text, actual bigint, expected bigint)
returns void
language plpgsql
as $fn$
begin
  if actual is distinct from expected then
    raise exception 'ASSERT "%" failed: got %, expected %', label, actual, expected;
  end if;
  raise notice 'ok: % = %', label, actual;
end;
$fn$;

-- ---------------------------------------------------------------------------
-- STRUKTUR
--
-- Hier stand bis 0067 `count(*) from pg_tables where schemaname='app' = 23` —
-- eine Zahl aus dem allerersten Commit, die nach ~60 Migrationen (75 Tabellen)
-- nur noch die Suite blockierte und NICHTS aussagte: sie waere bei jeder neuen
-- Migration rot geworden, egal ob die Migration gut oder kaputt war. Eine
-- nachgezogene Zahl (75) haette exakt dasselbe Problem am naechsten Tag.
--
-- Ersetzt durch drei Pruefungen, die tatsaechlich etwas WERT sind, weil sie
-- auf Fehler zeigen statt auf Wachstum:
--   (a) KERN-TABELLEN: keine davon darf je verschwinden/umbenannt werden.
--   (b) RLS an JEDER Tabelle in app/internal (unveraendert — der Kernschutz).
--   (c) KEINE app-Tabelle ohne Policy: RLS an + null Policies heisst fuer
--       Clients "unsichtbar". Fail-closed ist sicher, aber es ist der typische
--       halbfertige Migrations-Fehler (Tabelle da, Policy vergessen) und faellt
--       sonst erst im UI auf. Ausgenommen sind nur die dokumentierten
--       Zaehler-Tabellen, die absichtlich NUR ueber SECURITY-DEFINER-
--       Funktionen laufen. internal.* ist bewusst komplett client-dicht.
-- ---------------------------------------------------------------------------

-- (a) Kern-Tabellen — namentlich, damit ein Drop/Rename sofort auffliegt.
do $fn$
declare
  expected text[] := array[
    'app.clubs', 'app.profiles', 'app.club_members', 'app.guardianships',
    'app.teams', 'app.team_members', 'app.events', 'app.event_teams',
    'app.event_rsvps', 'app.attendance', 'app.media_assets', 'app.routines',
    'app.routine_skaters', 'app.routine_markers', 'app.routine_scores',
    'app.competitions', 'app.competition_entries', 'app.invoices',
    'app.ledger_entries', 'app.tasks', 'app.products', 'app.entitlements',
    'app.sparten', 'app.sparte_members', 'app.event_rides',
    'app.event_ride_riders', 'app.event_ride_contacts',
    'internal.webhook_events'
  ];
  missing text[];
begin
  select array_agg(t) into missing
    from unnest(expected) as t
   where to_regclass(t) is null;
  if missing is not null then
    raise exception 'ASSERT "Kern-Tabellen" failed: fehlen: %', array_to_string(missing, ', ');
  end if;
  raise notice 'ok: alle % Kern-Tabellen vorhanden', array_length(expected, 1);
end;
$fn$;

-- (b) RLS ueberall
select pg_temp.assert_eq('tables WITHOUT row level security (must be 0)',
  (select count(*)
   from pg_class c
   join pg_namespace n on n.oid = c.relnamespace
   where n.nspname in ('app', 'internal')
     and c.relkind = 'r'
     and not c.relrowsecurity), 0);

-- (c) keine app-Tabelle ohne Policy (ausser den Zaehler-Tabellen)
do $fn$
declare orphans text;
begin
  select string_agg(c.relname, ', ' order by c.relname) into orphans
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'app'
     and c.relkind = 'r'
     and c.relname not in ('invoice_counters', 'donation_receipt_counters')
     and not exists (select 1 from pg_policy p where p.polrelid = c.oid);
  if orphans is not null then
    raise exception 'ASSERT "app-Tabellen ohne Policy" failed: % (RLS an, aber keine Policy -> fuer Clients unsichtbar; Migration unvollstaendig?)', orphans;
  end if;
  raise notice 'ok: jede app-Tabelle hat mindestens eine Policy';
end;
$fn$;

-- (d) Speicher-Keys sind FLACH. Genau die Invariante, an der Kuer-Musik UND
-- Kuer-Bild gescheitert sind: GET /media/:key ist ein EIN-Segment-Pfad und
-- assertValidKey() (modules/media/storage.ts) verbietet '/' als
-- Traversal-Schutz. Ein verschachtelter Seed-Key ist damit tote Ware.
select pg_temp.assert_eq('media_assets mit verschachteltem storage_path (muss 0 sein)',
  (select count(*) from app.media_assets where storage_path like '%/%'), 0);
select pg_temp.assert_eq('media_assets mit nicht-key-konformem storage_path (muss 0 sein)',
  (select count(*) from app.media_assets where storage_path !~ '^[A-Za-z0-9._-]+$'), 0);

-- seed counts (consistent with apps/web/lib/mock)
select pg_temp.assert_eq('clubs',               (select count(*) from app.clubs), 1);
select pg_temp.assert_eq('profiles',            (select count(*) from app.profiles), 11);
select pg_temp.assert_eq('club_members',        (select count(*) from app.club_members), 24);
select pg_temp.assert_eq('guardianships',       (select count(*) from app.guardianships), 5);
select pg_temp.assert_eq('teams',               (select count(*) from app.teams), 3);
select pg_temp.assert_eq('team_members',        (select count(*) from app.team_members), 20);
select pg_temp.assert_eq('events',              (select count(*) from app.events), 16);
select pg_temp.assert_eq('event_teams',         (select count(*) from app.event_teams), 18);
select pg_temp.assert_eq('event_rsvps',         (select count(*) from app.event_rsvps), 28);
select pg_temp.assert_eq('attendance',          (select count(*) from app.attendance), 11);
-- 6 Audio (eine pro Kuer) + 2 Kuer-Bilder (0057) = 8, alle mit ECHTEN Bytes
-- unter supabase/seed/media/.
select pg_temp.assert_eq('media_assets',        (select count(*) from app.media_assets), 8);
select pg_temp.assert_eq('media_assets: Kuer-Audio',  (select count(*) from app.media_assets where mime_type like 'audio/%'), 6);
select pg_temp.assert_eq('media_assets: Kuer-Bilder', (select count(*) from app.media_assets where mime_type like 'image/%'), 2);
select pg_temp.assert_eq('Kueren MIT Bild',           (select count(*) from app.routines where image_asset_id is not null), 2);
select pg_temp.assert_eq('routines',            (select count(*) from app.routines), 6);
select pg_temp.assert_eq('routine_skaters',     (select count(*) from app.routine_skaters), 8);
select pg_temp.assert_eq('routine_markers',     (select count(*) from app.routine_markers), 22);
select pg_temp.assert_eq('routine_scores',      (select count(*) from app.routine_scores), 8);
select pg_temp.assert_eq('competitions',        (select count(*) from app.competitions), 2);
select pg_temp.assert_eq('competition_entries', (select count(*) from app.competition_entries), 11);
select pg_temp.assert_eq('invoices',            (select count(*) from app.invoices), 10);
select pg_temp.assert_eq('open invoices',       (select count(*) from app.invoices where status = 'open'), 5);
select pg_temp.assert_eq('OPEN INVOICE SUM = 381.00 EUR',
  (select sum(amount_cents)::bigint from app.invoices where status = 'open'), 38100);
select pg_temp.assert_eq('paid invoice sum',
  (select sum(amount_cents)::bigint from app.invoices where status = 'paid'), 31700);
select pg_temp.assert_eq('ledger_entries',      (select count(*) from app.ledger_entries), 10);
select pg_temp.assert_eq('ledger balance (cents)',
  (select sum(amount_cents)::bigint from app.ledger_entries), -27750);
select pg_temp.assert_eq('ledger rows linked to invoices',
  (select count(*) from app.ledger_entries where invoice_id is not null), 5);
select pg_temp.assert_eq('tasks',               (select count(*) from app.tasks), 7);
select pg_temp.assert_eq('open tasks',          (select count(*) from app.tasks where not done), 5);
select pg_temp.assert_eq('products',            (select count(*) from app.products), 4);
select pg_temp.assert_eq('entitlements',        (select count(*) from app.entitlements), 1);
-- Nur Audio traegt eine Waveform; die Bild-Assets haben keine (NULL). Ohne
-- die Einschraenkung wuerde min() die NULLs still ignorieren.
select pg_temp.assert_eq('waveform peaks per audio asset',
  (select min(jsonb_array_length(waveform_peaks)) from app.media_assets where mime_type like 'audio/%'), 96);
select pg_temp.assert_eq('Bild-Assets ohne Waveform (erwartet 2)',
  (select count(*) from app.media_assets where mime_type like 'image/%' and waveform_peaks is null), 2);

-- invoice number generator is race-free and continues after the seed (0090 → 0091)
do $fn$
declare v text;
begin
  v := app.next_invoice_number('c1ab0000-0000-4000-8000-000000000001');
  if v !~ '^R-\d{4}-0091$' then
    raise exception 'ASSERT next_invoice_number failed: got %', v;
  end if;
  raise notice 'ok: next_invoice_number = %', v;
end;
$fn$;

-- ---------------------------------------------------------------------------
-- RLS behavioural tests (positive)
-- ---------------------------------------------------------------------------

-- coach (Sandra Vogel) sees her club, roster, events — but NOT the cash book
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000001","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"coach"}}',
  true);
set local role authenticated;
select pg_temp.assert_eq('RLS coach: sees own club',        (select count(*) from app.clubs), 1);
select pg_temp.assert_eq('RLS coach: sees roster (24)',     (select count(*) from app.club_members), 24);
-- 16 Termine im Seed, 13 fuer die Trainerin sichtbar: die Zielgruppen-Filter
-- aus 0050 blenden die uebrigen aus. (Stand vor der Reparatur: 15 — die Zahl
-- war seit dem ersten Commit nicht nachgezogen worden.)
select pg_temp.assert_eq('RLS coach: sees events (13 von 16, Zielgruppe 0050)',
  (select count(*) from app.events), 13);
select pg_temp.assert_eq('RLS coach: sees routines (6)',    (select count(*) from app.routines), 6);
select pg_temp.assert_eq('RLS coach: ledger hidden (0)',    (select count(*) from app.ledger_entries), 0);
select pg_temp.assert_eq('RLS coach: sees club entitlement',(select count(*) from app.entitlements), 1);
rollback;

-- treasurer (Beate Schäfer) sees finances
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000003","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"treasurer"}}',
  true);
set local role authenticated;
select pg_temp.assert_eq('RLS treasurer: sees ledger (10)',   (select count(*) from app.ledger_entries), 10);
select pg_temp.assert_eq('RLS treasurer: sees invoices (10)', (select count(*) from app.invoices), 10);
rollback;

-- parent (Katrin Grünewald, plain member): sees only own/children invoices
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000009","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"member"}}',
  true);
set local role authenticated;
select pg_temp.assert_eq('RLS parent: sees only own invoices (2)', (select count(*) from app.invoices), 2);
select pg_temp.assert_eq('RLS parent: ledger hidden (0)',          (select count(*) from app.ledger_entries), 0);
-- ⚠️ KINDERDATEN — der Grund fuer den Join in GET /media/:key
-- (services/api/src/modules/media/routes.ts). Ein einfaches Mitglied sieht
-- unter can_read_routine NUR die eigene Kuer, media_assets_select haengt aber
-- allein an is_club_member und zeigt ihm ALLE Medien-Zeilen. Die DB-Policy
-- ist also BREITER als die Kuer. Deshalb darf die Ausliefer-Route sich
-- niemals auf media_assets allein stuetzen, sondern joint auf app.routines.
-- Faellt eine der beiden Zahlen, ist diese Annahme hinfaellig und der
-- Media-Endpunkt gehoert neu geprueft.
select pg_temp.assert_eq('RLS parent: sieht nur die EIGENE Kuer (1)',
  (select count(*) from app.routines), 1);
select pg_temp.assert_eq('RLS parent: media_assets-Policy ist BREITER (8) -> API-Join noetig',
  (select count(*) from app.media_assets), 8);
rollback;

-- tenant isolation: valid token of ANOTHER club sees nothing
begin;
select set_config('request.jwt.claims',
  '{"sub":"99999999-0000-4000-8000-000000000099","role":"authenticated","club_roles":{"deadbeef-0000-4000-8000-000000000001":"owner"}}',
  true);
set local role authenticated;
select pg_temp.assert_eq('RLS foreign club: clubs (0)',    (select count(*) from app.clubs), 0);
select pg_temp.assert_eq('RLS foreign club: members (0)',  (select count(*) from app.club_members), 0);
select pg_temp.assert_eq('RLS foreign club: invoices (0)', (select count(*) from app.invoices), 0);
select pg_temp.assert_eq('RLS foreign club: routines (0)', (select count(*) from app.routines), 0);
rollback;

-- guest coach (Milena Öztürk): valid today → member access works
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000006","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"guest_coach"}}',
  true);
set local role authenticated;
select pg_temp.assert_eq('RLS guest_coach (valid): sees club', (select count(*) from app.clubs), 1);
rollback;
SQL

# -----------------------------------------------------------------------------
# 5. Negative tests — the closed v1 gaps MUST be rejected
# -----------------------------------------------------------------------------

# 5a. v1 gap: admin tries to escalate his OWN role (Thomas Krüger, admin)
expect_error "self role-change blocked (v1 gap)" "
begin;
select set_config('request.jwt.claims',
  '{\"sub\":\"90000000-0000-4000-8000-000000000004\",\"role\":\"authenticated\",\"club_roles\":{\"c1ab0000-0000-4000-8000-000000000001\":\"admin\"}}',
  true);
set local role authenticated;
update app.club_members set role = 'owner'
 where id = 'a0000000-0000-4000-8000-000000000004';
commit;
"

# 5b. admin tries to demote the owner (only owners may touch owner rows)
expect_error "admin demoting owner blocked" "
begin;
select set_config('request.jwt.claims',
  '{\"sub\":\"90000000-0000-4000-8000-000000000004\",\"role\":\"authenticated\",\"club_roles\":{\"c1ab0000-0000-4000-8000-000000000001\":\"admin\"}}',
  true);
set local role authenticated;
update app.club_members set role = 'member'
 where id = 'a0000000-0000-4000-8000-000000000002';
commit;
"

# 5c. v1 gap: client writes an entitlement (activate_premium for everyone)
expect_error "client entitlement INSERT blocked" "
begin;
select set_config('request.jwt.claims',
  '{\"sub\":\"90000000-0000-4000-8000-000000000002\",\"role\":\"authenticated\",\"club_roles\":{\"c1ab0000-0000-4000-8000-000000000001\":\"owner\"}}',
  true);
set local role authenticated;
insert into app.entitlements (subject_type, subject_id, entitlement, source)
values ('club', 'c1ab0000-0000-4000-8000-000000000001', 'club_license', 'manual');
commit;
"

# 5d. GoBD: ledger entries are immutable — even for the superuser
expect_error "ledger UPDATE blocked (GoBD)" "
update app.ledger_entries set amount_cents = 0
 where description = 'Musiklizenz Trainingsbetrieb';
"
expect_error "ledger DELETE blocked (GoBD)" "
delete from app.ledger_entries
 where description = 'Musiklizenz Trainingsbetrieb';
"

# 5e. issued invoices cannot be deleted
expect_error "issued invoice DELETE blocked (GoBD)" "
delete from app.invoices where number like '%-0083';
"

# 5f. client roles cannot touch internal.webhook_events at all
expect_error "webhook_events invisible to clients" "
begin;
select set_config('request.jwt.claims',
  '{\"sub\":\"90000000-0000-4000-8000-000000000002\",\"role\":\"authenticated\",\"club_roles\":{\"c1ab0000-0000-4000-8000-000000000001\":\"owner\"}}',
  true);
set local role authenticated;
select count(*) from internal.webhook_events;
commit;
"

# 5g. guest_coach access dies with valid_until (server-side, not just claims)
log "guest_coach expiry: expiring Milena's membership ..."
pgexec <<'SQL'
update app.club_members
   set valid_until = now() - interval '1 day'
 where id = 'a0000000-0000-4000-8000-000000000006';
SQL

pgexec <<'SQL'
create or replace function pg_temp.assert_eq(label text, actual bigint, expected bigint)
returns void
language plpgsql
as $fn$
begin
  if actual is distinct from expected then
    raise exception 'ASSERT "%" failed: got %, expected %', label, actual, expected;
  end if;
  raise notice 'ok: % = %', label, actual;
end;
$fn$;

begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000006","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"guest_coach"}}',
  true);
set local role authenticated;
select pg_temp.assert_eq('RLS guest_coach (expired): sees nothing', (select count(*) from app.clubs), 0);
select pg_temp.assert_eq('RLS guest_coach (expired): no roster',    (select count(*) from app.club_members), 0);
rollback;
SQL

echo
log "ALL CHECKS PASSED — schema, seed and RLS behave as specified."
log "(container $CONTAINER is removed automatically)"
