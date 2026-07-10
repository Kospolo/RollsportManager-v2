#!/usr/bin/env bash
# =============================================================================
# run-tests.sh — RollsportManager v2 SQL security test suite (RLS / tenancy)
#
# Boots the SHARED throwaway harness (scripts/lib/pg-harness.sh: postgres:16-
# alpine as rsm2-pg-test on 127.0.0.1:55432, Supabase shim, all migrations +
# seed), then runs every tests/sql/*.sql suite in order.
#
# Why an own boot instead of reusing db-test.sh: db-test.sh mutates the seed
# on purpose (it expires the guest coach in its last step), so this suite
# always starts from a pristine database. Harness conventions are shared via
# lib/pg-harness.sh; both scripts use the same container name — they are never
# meant to run at the same time.
#
# Test protocol (TAP-like):
#   * each SQL suite sets request.jwt.claims via set_config(..., true) and
#     SET LOCAL ROLE anon/authenticated/service_role per test case
#   * assertions come from the testkit schema (00_testkit.sql):
#     pass -> NOTICE 'ok N - ...', fail -> EXCEPTION 'not ok N - ...'
#   * any failure aborts via ON_ERROR_STOP and this script exits non-zero
#
# The container is ALWAYS removed on exit (trap). This script never touches
# any other container on this machine.
#
# Usage: supabase/tests/run-tests.sh
# =============================================================================
set -euo pipefail

TESTS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SUPABASE_DIR="$(cd "$TESTS_DIR/.." && pwd)"
LOG="$(mktemp -t rsm2-sql-tests.XXXXXX)"
SUITE_LOG="$(mktemp -t rsm2-sql-suite.XXXXXX)"

HARNESS_LOG_PREFIX="sql-tests"
# shellcheck source=../scripts/lib/pg-harness.sh
source "$SUPABASE_DIR/scripts/lib/pg-harness.sh"

log()  { printf '\033[1;34m[sql-tests]\033[0m %s\n' "$*"; }
fail() { printf '\033[1;31m[sql-tests] FAIL:\033[0m %s\n' "$*"; exit 1; }

cleanup() {
  harness_teardown
  rm -f "$LOG" "$SUITE_LOG" >/dev/null 2>&1 || true
}
trap cleanup EXIT

# -----------------------------------------------------------------------------
# 1.-3. Shared harness: container + Supabase shim + migrations + seed
# -----------------------------------------------------------------------------
harness_start
harness_apply_migrations_and_seed

# -----------------------------------------------------------------------------
# 4. Run the SQL test suites in order
# -----------------------------------------------------------------------------
suites=("$TESTS_DIR"/sql/[0-9]*.sql)
[ ${#suites[@]} -gt 0 ] || fail "no test suites found in $TESTS_DIR/sql"

for f in "${suites[@]}"; do
  log "suite: $(basename "$f")"
  if ! pgexec < "$f" >"$SUITE_LOG" 2>&1; then
    grep -E 'ok [0-9]+ - ' "$SUITE_LOG" | sed -E 's/^.*NOTICE:[[:space:]]+/  /' || true
    echo
    printf '\033[1;31m'
    grep -E 'ERROR|not ok' "$SUITE_LOG" | head -10 || true
    printf '\033[0m'
    fail "suite $(basename "$f") FAILED (full log above)"
  fi
  grep -E 'ok [0-9]+ - ' "$SUITE_LOG" | sed -E 's/^.*NOTICE:[[:space:]]+/  /' || true
  cat "$SUITE_LOG" >> "$LOG"
done

# -----------------------------------------------------------------------------
# 5. TAP plan + consistency check (printed count == testkit sequence)
# -----------------------------------------------------------------------------
total="$(grep -cE 'NOTICE:.*ok [0-9]+ - ' "$LOG" || true)"
seq_max="$(pgexec -tA -c 'select last_value from testkit.test_no;')"

[ "$total" -gt 0 ] || fail "no tests were executed"
[ "$total" -eq "$seq_max" ] || fail "test count mismatch: $total printed, sequence at $seq_max"

echo
log "1..$total"
log "ALL $total SECURITY TESTS PASSED — tenant isolation, escalation paths,"
log "guest expiry, finance/GoBD, entitlements, anon and guardianships hold."
log "(container $CONTAINER is removed automatically)"
