#!/usr/bin/env bash
# =============================================================================
# api-db-test.sh - end-to-end smoke test of the API against a THROWAWAY DB.
#
# Boots the SHARED throwaway harness (supabase/scripts/lib/pg-harness.sh:
# postgres:16-alpine as rsm2-pg-test on 127.0.0.1:55436, Supabase shim, all
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

# -----------------------------------------------------------------------------
# 4. DAS BETREIBER-PROTOKOLL — "kein Zugriff ohne Eintrag" (0051), gemessen
#    statt behauptet.
#
# Warum HIER und nicht in smoke.mjs: es gibt bewusst keine API-Route, die das
# Protokoll ausliefert (der Betreiber soll es nicht bequem durchsehen koennen).
# Ueber HTTP ist die Zusage deshalb nicht pruefbar — wohl aber genau jetzt, wo
# die Smoke-Suite eben ECHTE Betreiber-Requests durch die echte Middleware
# geschickt hat und die Zeilen in der Wegwerf-DB stehen.
#
# Geprueft wird die Kernzusage aus 0051: JEDER Zugriff eines Plattform-Tokens
# hinterlaesst eine Zeile — auch der, der nichts zu sehen bekam. Gerade der:
# ein Protokoll, das nur die erfolgreichen Blicke kennt, verschweigt die
# Versuche.
# -----------------------------------------------------------------------------
log "checking operator audit trail (0051: kein Zugriff ohne Eintrag) ..."
audit_check() {
  local label="$1" expected="$2" sql="$3" got
  got="$(pgexec -tA -c "$sql" | tr -d '[:space:]')"
  if [ "$got" = "$expected" ]; then
    printf '  \033[1;32mok\033[0m   %s\n' "$label"
  else
    fail "$label >> got '$got', expected '$expected'"
  fi
}

PLATFORM_SUB="90000000-0000-4000-8000-000000000090"

audit_check "audit: die Smoke-Suite hat Betreiber-Zeilen hinterlassen" "t" \
  "select count(*) > 0 from app.operator_audit_log where actor_profile_id = '$PLATFORM_SUB';"

# Die Routen aus dem Zweckbindungs-Block. Jede MUSS eine Zeile haben — die
# gesperrten ganz besonders, denn ein Versuch ist genau das, was ein Verein
# nachlesen koennen muss.
#
# Schreibweise beachtet: gespeichert wird c.req.routePath, also HONOS Muster
# (/clubs/:clubId/members). Der Kommentar in 0051 nennt beispielhaft die
# OpenAPI-Schreibweise (/clubs/{clubId}/members) — die steht so NIE in der
# Tabelle. Hier der echte Wert, sonst prueft der Test an der Wirklichkeit vorbei.
for route in "/clubs/:clubId/members" "/coach-notes" "/locker-rentals" "/invoices" "/sepa-mandates"; do
  audit_check "audit: der Zugriff auf $route steht im Protokoll" "t" \
    "select count(*) > 0 from app.operator_audit_log
      where actor_profile_id = '$PLATFORM_SUB' and route = '$route';"
done

# Auch der SCHREIBVERSUCH auf die Trainer-Notiz steht drin, als 'write' und mit
# seinem Fehlerstatus. Ein Protokoll, das nur Lesezugriffe kennt, waere blind
# fuer genau die Zugriffe, die weh tun.
audit_check "audit: der abgewiesene SCHREIBversuch auf /coach-notes steht als 'write' drin" "t" \
  "select count(*) > 0 from app.operator_audit_log
    where actor_profile_id = '$PLATFORM_SUB' and route = '/coach-notes'
      and method = 'POST' and access = 'write' and status >= 400;"

# Der Vereinsbezug ist zugeordnet — ohne ihn koennte der betroffene Verein
# seine eigene Zeile nicht finden (Art. 28 Abs. 3 lit. h DSGVO).
audit_check "audit: die Vereins-Zuordnung ist gesetzt (der Verein findet seine Zeile)" "t" \
  "select count(*) > 0 from app.operator_audit_log
    where actor_profile_id = '$PLATFORM_SUB' and route = '/coach-notes'
      and club_id = 'c1ab0000-0000-4000-8000-000000000001';"

# GEGENPROBE: ein normales Mitglied erzeugt KEINE Zeile. Sonst waere das
# Protokoll kein Betreiber-Protokoll, sondern ein Zugriffslog aller Nutzer —
# und damit selbst eine Datensammlung ohne Rechtsgrundlage.
audit_check "audit/Gegenprobe: normale Mitglieder erzeugen KEINE Protokollzeile" "t" \
  "select count(*) = 0 from app.operator_audit_log
    where actor_profile_id <> '$PLATFORM_SUB';"

echo
log "API SMOKE SUITE PASSED (container $CONTAINER and API are torn down automatically)"
