#!/usr/bin/env bash
# =============================================================================
# api-db-test.sh - end-to-end smoke test of the API against a THROWAWAY DB.
#
# Boots the SHARED throwaway harness (supabase/scripts/lib/pg-harness.sh:
# postgres:16-alpine as rsm2-pg-test on 127.0.0.1:55432, Supabase shim, all
# migrations + seed), then starts the API (tsx, port 3123) with dev HS256 auth
# and runs scripts/smoke.mjs (positive + negative RLS cases through HTTP).
#
# The container AND the API process are ALWAYS torn down on exit (trap).
# No production container on this machine is ever touched.
#
# Usage: services/api/scripts/api-db-test.sh
# =============================================================================
set -euo pipefail

API_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SUPABASE_DIR="$(cd "$API_DIR/../../supabase" && pwd)"
API_PORT="3123"   # NOT 3022 - a dev API may be running there
# throwaway credential for the ephemeral harness only - not a real secret
JWT_SECRET="rsm2-harness-smoke-secret-0123456789"

HARNESS_LOG_PREFIX="api-db-test"
# shellcheck source=../../../supabase/scripts/lib/pg-harness.sh
source "$SUPABASE_DIR/scripts/lib/pg-harness.sh"

API_PID=""

log()  { printf '\033[1;34m[api-db-test]\033[0m %s\n' "$*"; }
fail() { printf '\033[1;31m[api-db-test] FAIL:\033[0m %s\n' "$*"; exit 1; }

cleanup() {
  if [ -n "$API_PID" ]; then
    kill "$API_PID" >/dev/null 2>&1 || true
    wait "$API_PID" 2>/dev/null || true
  fi
  # the npx/tsx wrapper may leave a node grandchild behind - kill by port too
  lsof -ti ":$API_PORT" 2>/dev/null | xargs kill >/dev/null 2>&1 || true
  harness_teardown
}
trap cleanup EXIT

# -----------------------------------------------------------------------------
# 1. Shared harness: throwaway postgres + shim + migrations + seed
# -----------------------------------------------------------------------------
harness_start
harness_apply_migrations_and_seed

# -----------------------------------------------------------------------------
# 2. Start the API against the harness DB (dev HS256 auth)
# -----------------------------------------------------------------------------
log "starting API on 127.0.0.1:$API_PORT ..."
(
  cd "$API_DIR"
  PORT="$API_PORT" \
  DATABASE_URL="postgres://postgres:${PGPASS}@127.0.0.1:${HOST_PORT}/${DB}" \
  AUTH_MODE=dev \
  AUTH_JWT_SECRET="$JWT_SECRET" \
  AUTH_AUDIENCE=authenticated \
  npx tsx src/index.ts
) &
API_PID=$!

for i in $(seq 1 40); do
  if curl -sf "http://127.0.0.1:${API_PORT}/health" >/dev/null 2>&1; then
    break
  fi
  [ "$i" -eq 40 ] && fail "API did not become ready in time"
  sleep 0.5
done
log "API is ready"

# -----------------------------------------------------------------------------
# 3. Smoke suite (positive + negative RLS cases over HTTP)
# -----------------------------------------------------------------------------
(
  cd "$API_DIR"
  SMOKE_BASE_URL="http://127.0.0.1:${API_PORT}" \
  AUTH_JWT_SECRET="$JWT_SECRET" \
  node scripts/smoke.mjs
)

echo
log "API SMOKE SUITE PASSED (container $CONTAINER and API are torn down automatically)"
