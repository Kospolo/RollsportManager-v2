#!/usr/bin/env bash
# =============================================================================
# dev-stack.sh — bequemer lokaler Dev-Stack für RollsportManager v2.
#
#   scripts/dev-stack.sh up      Dev-DB (rsm2-pg-dev, 127.0.0.1:55433, Daten
#                                persistent als Bind-Mount in .dev/pgdata)
#                                + API (127.0.0.1:3022, AUTH_MODE=dev).
#                                Idempotent: läuft etwas schon, wird es benutzt.
#                                Bei LEERER DB: Supabase-Shim + Migrations + Seed.
#   scripts/dev-stack.sh down    API-Prozess beenden + Container STOPPEN
#                                (nicht löschen — die Daten bleiben erhalten).
#   scripts/dev-stack.sh reset   down + .dev/pgdata löschen + up (frische Seed-DB).
#   scripts/dev-stack.sh status  Zeigt was gerade läuft.
#
# Nutzt die geteilte Harness-Lib (supabase/scripts/lib/pg-harness.sh) im
# persistenten Modus (HARNESS_PERSIST_DIR). Der Test-Container rsm2-pg-test
# (55432) der Test-Scripts wird hiervon NICHT berührt; Prod-Container sowieso
# nicht. Alles Laufzeit-Zeug liegt unter .dev/ (gitignored):
#   .dev/pgdata       Postgres-Datenverzeichnis (Bind-Mount)
#   .dev/secrets.env  generiertes Dev-HS256-Secret (AUTH_JWT_SECRET)
#   .dev/api.pid      PID der Hintergrund-API
#   .dev/api.log      API-Log
# =============================================================================
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEV_DIR="$ROOT/.dev"
PGDATA_DIR="$DEV_DIR/pgdata"
SECRETS_FILE="$DEV_DIR/secrets.env"
API_PID_FILE="$DEV_DIR/api.pid"
API_LOG_FILE="$DEV_DIR/api.log"
API_DIR="$ROOT/services/api"
API_PORT="3022"

# --- geteilte Harness-Lib im PERSISTENTEN Dev-Modus laden --------------------
HARNESS_CONTAINER="rsm2-pg-dev"
HARNESS_HOST_PORT="55433"
HARNESS_PERSIST_DIR="$PGDATA_DIR"
HARNESS_LOG_PREFIX="dev-stack"
SUPABASE_DIR="$ROOT/supabase"
# shellcheck source=../supabase/scripts/lib/pg-harness.sh
source "$SUPABASE_DIR/scripts/lib/pg-harness.sh"

log()  { printf '\033[1;32m[dev-stack]\033[0m %s\n' "$*"; }
fail() { printf '\033[1;31m[dev-stack] FAIL:\033[0m %s\n' "$*"; exit 1; }

api_pid() {
  # PID nur zurückgeben, wenn der Prozess noch lebt (sonst: stale file weg)
  if [ -f "$API_PID_FILE" ]; then
    local pid
    pid="$(cat "$API_PID_FILE")"
    if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
      printf '%s' "$pid"
      return 0
    fi
    rm -f "$API_PID_FILE"
  fi
  return 1
}

api_healthy() {
  curl -sf --max-time 2 "http://127.0.0.1:${API_PORT}/health" >/dev/null 2>&1
}

ensure_secret() {
  if [ ! -f "$SECRETS_FILE" ]; then
    log "generiere Dev-Secret nach .dev/secrets.env (gitignored) ..."
    umask 077
    printf 'AUTH_JWT_SECRET=%s\n' "$(openssl rand -hex 32)" > "$SECRETS_FILE"
  fi
  # shellcheck source=/dev/null
  source "$SECRETS_FILE"
  [ -n "${AUTH_JWT_SECRET:-}" ] || fail ".dev/secrets.env enthält kein AUTH_JWT_SECRET"
}

db_is_empty() {
  local n
  n="$(pgexec -tA -c "select count(*) from pg_tables where schemaname = 'app'")"
  [ "${n:-0}" = "0" ]
}

start_api() {
  if pid="$(api_pid)" && api_healthy; then
    log "API läuft bereits (PID $pid, http://127.0.0.1:${API_PORT})"
    return 0
  fi
  # Port belegt, aber kein von uns verwalteter Prozess? Nicht anfassen.
  if ! api_pid >/dev/null && lsof -ti ":$API_PORT" >/dev/null 2>&1; then
    fail "Port $API_PORT ist belegt, aber nicht von dev-stack (kein .dev/api.pid). Bitte manuell prüfen."
  fi
  ensure_secret
  log "starte API auf http://127.0.0.1:${API_PORT} (AUTH_MODE=dev, Log: .dev/api.log) ..."
  (
    cd "$API_DIR"
    PORT="$API_PORT" \
    DATABASE_URL="postgres://postgres:${PGPASS}@127.0.0.1:${HOST_PORT}/${DB}" \
    AUTH_MODE=dev \
    AUTH_JWT_SECRET="$AUTH_JWT_SECRET" \
    AUTH_AUDIENCE=authenticated \
    nohup npx tsx src/index.ts >> "$API_LOG_FILE" 2>&1 &
    echo $! > "$API_PID_FILE"
  )
  local i
  for i in $(seq 1 40); do
    if api_healthy; then
      log "API ist bereit (PID $(cat "$API_PID_FILE"))"
      return 0
    fi
    [ "$i" -eq 40 ] && { tail -n 20 "$API_LOG_FILE" || true; fail "API wurde nicht rechtzeitig bereit (siehe .dev/api.log)"; }
    sleep 0.5
  done
}

stop_api() {
  local pid
  if pid="$(api_pid)"; then
    log "stoppe API (PID $pid) ..."
    kill "$pid" 2>/dev/null || true
  fi
  # tsx/npx lässt u. U. einen node-Enkelprozess zurück — zusätzlich über den Port
  lsof -ti ":$API_PORT" 2>/dev/null | xargs kill 2>/dev/null || true
  rm -f "$API_PID_FILE"
}

cmd_up() {
  mkdir -p "$DEV_DIR"
  harness_start
  if db_is_empty; then
    log "DB ist leer — spiele Migrations + Seed ein ..."
    harness_apply_migrations_and_seed
  else
    log "DB enthält bereits das app-Schema — Migrations/Seed übersprungen"
  fi
  start_api
  echo
  log "Dev-Stack läuft:"
  log "  DB:   postgres://postgres:***@127.0.0.1:${HOST_PORT}/${DB}  (Container ${CONTAINER})"
  log "  API:  http://127.0.0.1:${API_PORT}  (Dev-Login: POST /dev/login {\"persona\":\"coach\"})"
  log "  Web:  http://localhost:3021 (CORS dafür ist in der API freigeschaltet)"
}

cmd_down() {
  stop_api
  if docker inspect "$CONTAINER" >/dev/null 2>&1; then
    log "stoppe Container $CONTAINER (Daten bleiben in .dev/pgdata) ..."
    docker stop "$CONTAINER" >/dev/null 2>&1 || true
  fi
  log "down fertig"
}

cmd_reset() {
  cmd_down
  log "lösche Container + Datenverzeichnis .dev/pgdata ..."
  docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
  rm -rf "$PGDATA_DIR"
  cmd_up
}

cmd_status() {
  local running
  running="$(docker inspect -f '{{.State.Running}}' "$CONTAINER" 2>/dev/null || echo missing)"
  case "$running" in
    true)    log "DB:  $CONTAINER LÄUFT (127.0.0.1:${HOST_PORT}, Daten: .dev/pgdata)";;
    false)   log "DB:  $CONTAINER existiert, ist aber GESTOPPT";;
    missing) log "DB:  $CONTAINER existiert nicht";;
  esac
  if pid="$(api_pid)"; then
    if api_healthy; then
      log "API: LÄUFT (PID $pid, http://127.0.0.1:${API_PORT}/health ok)"
    else
      log "API: Prozess $pid lebt, /health antwortet aber NICHT"
    fi
  else
    log "API: läuft nicht"
  fi
  [ -f "$SECRETS_FILE" ] && log "Secret: .dev/secrets.env vorhanden" || log "Secret: noch nicht generiert"
}

case "${1:-}" in
  up)     cmd_up ;;
  down)   cmd_down ;;
  reset)  cmd_reset ;;
  status) cmd_status ;;
  *)      echo "Usage: scripts/dev-stack.sh up|down|reset|status"; exit 2 ;;
esac
