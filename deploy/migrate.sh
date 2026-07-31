#!/usr/bin/env bash
# ============================================================================
# migrate.sh — Prod-DB aufsetzen/aktualisieren.
#
# Reihenfolge (idempotent, mehrfach ausfuehrbar):
#   1. Bootstrap (bootstrap/00_supabase_shim.sql) — Rollen, auth-Schema,
#      auth.users, Migrations-Buch. MUSS vor den Migrationen laufen.
#   2. Alle supabase/migrations/[0-9]*.sql in Nummern-Reihenfolge, aber NUR die,
#      die noch nicht in public.rsm_schema_migrations stehen. Jede erfolgreiche
#      wird dort eingetragen.
#
# KEIN Dev-Seed (dev-accounts.sql/seed.sql) — Prod startet ohne Demo-Personas.
# Referenzdaten (Rollen/Module) stecken in den Migrationen selbst (0024/0044).
#
# Nutzung (im deploy/-Verzeichnis, nachdem `docker compose up -d db` laeuft):
#   ./migrate.sh
# ============================================================================
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$HERE/.." && pwd)"
MIGRATIONS_DIR="$REPO_ROOT/supabase/migrations"
CONTAINER="${DB_CONTAINER:-rsm2-prod-db}"
DB="${POSTGRES_DB:-rsm2}"

# Passwort aus .env ziehen (nicht ausgeben).
if [ -f "$HERE/.env" ]; then
  # shellcheck disable=SC1091
  set -a; . "$HERE/.env"; set +a
fi
: "${POSTGRES_PASSWORD:?POSTGRES_PASSWORD fehlt (deploy/.env)}"

psql() {
  docker exec -i -e PGPASSWORD="$POSTGRES_PASSWORD" "$CONTAINER" \
    psql -h 127.0.0.1 -U postgres -d "$DB" -v ON_ERROR_STOP=1 -q "$@"
}

echo "[migrate] Bootstrap (Rollen, auth-Schema, Migrations-Buch) ..."
psql < "$HERE/bootstrap/00_supabase_shim.sql"

echo "[migrate] ausstehende Migrationen anwenden ..."
applied="$(psql -tA -c 'select name from public.rsm_schema_migrations')"
count=0
for f in "$MIGRATIONS_DIR"/[0-9]*.sql; do
  base="$(basename "$f")"
  if printf '%s\n' "$applied" | grep -qx "$base"; then
    continue
  fi
  echo "  → $base"
  psql < "$f"
  psql -c "insert into public.rsm_schema_migrations(name) values ('$base') on conflict do nothing;" >/dev/null
  count=$((count + 1))
done
echo "[migrate] fertig — $count neue Migration(en)."
