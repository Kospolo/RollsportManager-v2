# =============================================================================
# lib/pg-harness.sh — SHARED throwaway Postgres harness for RollsportManager v2.
#
# Sourced (never executed) by:
#   * supabase/scripts/db-test.sh      (schema/seed/RLS assertions)
#   * supabase/tests/run-tests.sh      (SQL security suite)
#   * services/api/scripts/api-db-test.sh (API end-to-end smoke)
#
# One single source of truth for the harness conventions:
#   container rsm2-pg-test, postgres:16-alpine, 127.0.0.1:55432, --rm,
#   minimal Supabase shim (auth schema, auth.uid()/auth.jwt(), client roles),
#   all migrations + seed applied in order.
#
# The callers own their trap; they MUST call harness_teardown from it so the
# container is ALWAYS removed. No production container is ever touched.
#
# Caller contract:
#   HARNESS_LOG_PREFIX   optional log tag (defaults to pg-harness)
#   SUPABASE_DIR         required by harness_apply_migrations_and_seed
#   HARNESS_CONTAINER    optional container name override (default rsm2-pg-test)
#   HARNESS_HOST_PORT    optional host port override (default 55432)
#   HARNESS_PERSIST_DIR  optional: host dir bind-mounted to /var/lib/postgresql/data.
#                        When set, harness_start becomes IDEMPOTENT and PERSISTENT:
#                        a running container is reused, a stopped one is started,
#                        and the container is created WITHOUT --rm (data survives).
#                        Used by scripts/dev-stack.sh (rsm2-pg-dev on 55433).
#                        Unset (the default) = classic throwaway test behaviour.
# Provides:
#   CONTAINER HOST_PORT DB PGPASS
#   pgexec, harness_start, harness_apply_migrations_and_seed, harness_teardown
# =============================================================================

CONTAINER="${HARNESS_CONTAINER:-rsm2-pg-test}"
HOST_PORT="${HARNESS_HOST_PORT:-55432}"
DB="rsm2"
# throwaway credential for the ephemeral test container only — not a real secret
PGPASS="${RSM2_TEST_PGPASSWORD:-rsm2-local-test}"

_harness_log()  { printf '\033[1;34m[%s]\033[0m %s\n' "${HARNESS_LOG_PREFIX:-pg-harness}" "$*"; }
_harness_fail() { printf '\033[1;31m[%s] FAIL:\033[0m %s\n' "${HARNESS_LOG_PREFIX:-pg-harness}" "$*"; exit 1; }

# psql inside the container (no local psql required)
pgexec() {
  docker exec -i -e PGPASSWORD="$PGPASS" "$CONTAINER" \
    psql -h 127.0.0.1 -U postgres -d "$DB" -v ON_ERROR_STOP=1 -q "$@"
}

harness_teardown() {
  docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
}

# Boot the container, wait for readiness, install the Supabase shim.
# Default: throwaway (--rm, always recreated). With HARNESS_PERSIST_DIR set:
# persistent bind-mount + idempotent reuse of an existing container.
harness_start() {
  if [ -n "${HARNESS_PERSIST_DIR:-}" ]; then
    mkdir -p "$HARNESS_PERSIST_DIR"
    local running
    running="$(docker inspect -f '{{.State.Running}}' "$CONTAINER" 2>/dev/null || echo missing)"
    if [ "$running" = "true" ]; then
      _harness_log "$CONTAINER already running on 127.0.0.1:$HOST_PORT - reusing"
    elif [ "$running" = "false" ]; then
      _harness_log "starting existing container $CONTAINER (127.0.0.1:$HOST_PORT) ..."
      docker start "$CONTAINER" >/dev/null
    else
      _harness_log "creating $CONTAINER (postgres:16-alpine on 127.0.0.1:$HOST_PORT, data: $HARNESS_PERSIST_DIR) ..."
      docker run -d --name "$CONTAINER" \
        -p "127.0.0.1:${HOST_PORT}:5432" \
        -v "$HARNESS_PERSIST_DIR:/var/lib/postgresql/data" \
        -e POSTGRES_PASSWORD="$PGPASS" \
        -e POSTGRES_DB="$DB" \
        postgres:16-alpine >/dev/null
    fi
  else
    _harness_log "starting $CONTAINER (postgres:16-alpine on 127.0.0.1:$HOST_PORT) ..."
    docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
    docker run -d --rm --name "$CONTAINER" \
      -p "127.0.0.1:${HOST_PORT}:5432" \
      -e POSTGRES_PASSWORD="$PGPASS" \
      -e POSTGRES_DB="$DB" \
      postgres:16-alpine >/dev/null
  fi

  # readiness: TCP check hits only the FINAL server (the init-time temp server
  # listens on the unix socket only), so this cannot race the initdb restart.
  local i
  for i in $(seq 1 60); do
    if docker exec "$CONTAINER" pg_isready -h 127.0.0.1 -p 5432 -U postgres -d "$DB" >/dev/null 2>&1; then
      break
    fi
    [ "$i" -eq 60 ] && _harness_fail "postgres did not become ready in time"
    sleep 0.5
  done
  sleep 1
  _harness_log "postgres is ready"

  # minimal Supabase shim — what self-hosted Supabase provides out of the box
  _harness_log "installing supabase shim (auth schema, auth.uid(), client roles) ..."
  pgexec <<'SQL'
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin bypassrls;
  end if;
end
$$;

create schema if not exists auth;

create table if not exists auth.users (
  id                 uuid primary key,
  email              text unique,
  raw_app_meta_data  jsonb not null default '{}'::jsonb,
  raw_user_meta_data jsonb not null default '{}'::jsonb,
  created_at         timestamptz not null default now()
);

create or replace function auth.uid()
returns uuid
language sql
stable
as $fn$
  select nullif(
    coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub', ''),
    ''
  )::uuid
$fn$;

create or replace function auth.jwt()
returns jsonb
language sql
stable
as $fn$
  select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb)
$fn$;

grant usage on schema auth to anon, authenticated, service_role;
SQL
}

# Apply every migration in order, then the seed. Requires SUPABASE_DIR.
harness_apply_migrations_and_seed() {
  [ -n "${SUPABASE_DIR:-}" ] || _harness_fail "SUPABASE_DIR is not set"
  shopt -s nullglob
  local migrations=("$SUPABASE_DIR"/migrations/[0-9]*.sql)
  [ ${#migrations[@]} -gt 0 ] || _harness_fail "no migrations found in $SUPABASE_DIR/migrations"

  local f
  for f in "${migrations[@]}"; do
    _harness_log "migration: $(basename "$f")"
    pgexec < "$f"
  done

  _harness_log "seed: seed/seed.sql"
  pgexec < "$SUPABASE_DIR/seed/seed.sql"
}
