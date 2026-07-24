# =============================================================================
# lib/pg-harness.sh — SHARED throwaway Postgres harness for RollsportManager v2.
#
# Sourced (never executed) by:
#   * supabase/scripts/db-test.sh      (schema/seed/RLS assertions)
#   * supabase/tests/run-tests.sh      (SQL security suite)
#   * services/api/scripts/api-db-test.sh (API end-to-end smoke)
#
# One single source of truth for the harness conventions:
#   container rsm2-pg-test, postgres:16-alpine, 127.0.0.1:55436, --rm,
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
#   HARNESS_HOST_PORT    optional host port override (default 55436)
#                        ⚠️ Der Default war 55432 — dort laeuft auf Entwickler-
#                        maschinen ein FREMDER Container (rapportmanager-
#                        postgres-1). Die Suiten waren deshalb schlicht nicht
#                        startbar. 55436 ist frei und liegt neben dem Dev-Stack
#                        (rsm2-pg-dev auf 55433). Bestehende Overrides bleiben
#                        unveraendert gueltig; wer 55432 will, setzt es explizit.
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
HOST_PORT="${HARNESS_HOST_PORT:-55436}"
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

# Ist HOST_PORT von einem FREMDEN Prozess belegt? Dann sofort und verstaendlich
# abbrechen statt in einen Docker-Bind-Fehler zu laufen. Nennt, wenn moeglich,
# den Container, dem der Port gehoert — angefasst wird er nie.
_harness_assert_port_free() {
  if ! nc -z 127.0.0.1 "$HOST_PORT" >/dev/null 2>&1; then
    return 0
  fi
  local owner
  owner="$(docker ps --format '{{.Names}} {{.Ports}}' 2>/dev/null \
            | grep -E "(^|[^0-9])${HOST_PORT}->" | awk '{print $1}' | head -1 || true)"
  _harness_fail "host port $HOST_PORT is already in use${owner:+ by container '$owner'} — \
that container is NOT touched. Re-run with an override, e.g. HARNESS_HOST_PORT=55437 $0"
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
    # Preflight: der eigene Container ist jetzt weg — wenn der Port TROTZDEM
    # antwortet, gehoert er jemand anderem. Frueher lief das in einen kryptischen
    # docker-Bind-Fehler; jetzt sagt die Suite, WAS zu tun ist. Fremde Container
    # werden NICHT angefasst.
    _harness_assert_port_free
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

# === DAS MIGRATIONS-BUCH =====================================================
#
# WARUM ES DAS GIBT (24.07.2026, teuer gelernt)
# Bis heute wusste NIEMAND, welche Migrationen in einer bestehenden Datenbank
# stecken. `dev-stack.sh up` spielte sie nur ein, wenn die DB LEER war, und
# meldete sonst "Migrations/Seed uebersprungen". Eine einmal angelegte Dev-DB
# blieb damit fuer immer auf dem Stand ihres Anlegetages.
#
# Der Schaden war nicht theoretisch: In der Dev-DB fehlten ZWOELF Migrationen
# (0066-0077) — Fahrgemeinschaften, Trainer-Notizen, Schliessfach-Miete,
# Mahngebuehren, MwSt, Pflichtstunden, Betreiber-Zweckbindung,
# Modul-Sichtbarkeit. `GET /coach-notes` antwortete mit 500, weil die Tabelle
# schlicht nicht existierte.
#
# Das Bittere daran ist nicht der 500er, sondern was er mit der PRUEFUNG macht:
# Wer eine dieser Funktionen "im Browser nachgesehen" oder "per curl geprueft"
# hat, hat gegen eine Datenbank geprueft, die sie gar nicht kannte. Ein gruener
# Haken, der nichts bedeutet, ist schlimmer als gar kein Haken — er beendet die
# Suche. (Die SQL-Testsuite war davon NIE betroffen: run-tests.sh startet einen
# eigenen Wegwerf-Container und spielt immer alles frisch ein.)
#
# Das Buch steht bewusst in `public` und nicht in `app`: Es muss existieren
# koennen, BEVOR die erste Migration das Schema `app` ueberhaupt anlegt.
_harness_ledger_ensure() {
  # client_min_messages: sonst meldet `if not exists` bei jedem Start ein
  # NOTICE, das wie ein Problem aussieht und keines ist.
  pgexec -c "set client_min_messages to warning;
             create table if not exists public.rsm_schema_migrations (
               name text primary key,
               applied_at timestamptz not null default now()
             );" >/dev/null
}

_harness_ledger_record() {
  pgexec -c "insert into public.rsm_schema_migrations (name) values ('$1')
             on conflict (name) do nothing;" >/dev/null
}

# Apply every migration in order, then the seed. Requires SUPABASE_DIR.
harness_apply_migrations_and_seed() {
  [ -n "${SUPABASE_DIR:-}" ] || _harness_fail "SUPABASE_DIR is not set"
  shopt -s nullglob
  local migrations=("$SUPABASE_DIR"/migrations/[0-9]*.sql)
  [ ${#migrations[@]} -gt 0 ] || _harness_fail "no migrations found in $SUPABASE_DIR/migrations"

  _harness_ledger_ensure

  local f
  for f in "${migrations[@]}"; do
    _harness_log "migration: $(basename "$f")"
    pgexec < "$f"
    _harness_ledger_record "$(basename "$f")"
  done

  _harness_log "seed: seed/seed.sql"
  pgexec < "$SUPABASE_DIR/seed/seed.sql"
}

# Spielt NUR die Migrationen ein, die im Buch noch fehlen — fuer eine bereits
# bestehende Datenbank. Gibt die Anzahl der nachgetragenen Dateien aus.
#
# Eine Datenbank aus der Zeit VOR dem Buch hat keinen Eintrag. Dann waere jede
# Migration "ausstehend", und die erste wuerde an einer laengst existierenden
# Tabelle scheitern. Deshalb der Erstbefund: Ist das Buch leer, obwohl `app`
# schon Tabellen hat, wird nichts eingespielt, sondern nach `dev-stack.sh
# reset` verlangt. Lieber ein klarer Abbruch als ein halb angewandter Stand.
harness_apply_pending_migrations() {
  [ -n "${SUPABASE_DIR:-}" ] || _harness_fail "SUPABASE_DIR is not set"
  shopt -s nullglob
  local migrations=("$SUPABASE_DIR"/migrations/[0-9]*.sql)
  [ ${#migrations[@]} -gt 0 ] || _harness_fail "no migrations found in $SUPABASE_DIR/migrations"

  _harness_ledger_ensure

  local applied count
  applied="$(pgexec -tA -c "select name from public.rsm_schema_migrations")"
  count="$(printf '%s' "$applied" | grep -c . || true)"

  if [ "$count" = "0" ]; then
    _harness_fail "Die Datenbank hat Tabellen, aber kein Migrations-Buch — sie
  stammt aus der Zeit davor. Welche Migrationen drinstecken, ist von aussen
  nicht sicher feststellbar. Bitte einmal neu aufsetzen:
      ./scripts/dev-stack.sh down && rm -rf .dev/pgdata && ./scripts/dev-stack.sh up"
  fi

  local f base pending=0
  for f in "${migrations[@]}"; do
    base="$(basename "$f")"
    if ! printf '%s\n' "$applied" | grep -qx "$base"; then
      # Meldung nach stderr: stdout traegt hier den Rueckgabewert (die Anzahl),
      # der Aufrufer liest ihn per $(...). Eine Log-Zeile auf stdout wuerde
      # still zur "Anzahl" werden.
      _harness_log "nachtragen: $base" >&2
      pgexec < "$f"
      _harness_ledger_record "$base"
      pending=$((pending + 1))
    fi
  done

  printf '%s' "$pending"
}
