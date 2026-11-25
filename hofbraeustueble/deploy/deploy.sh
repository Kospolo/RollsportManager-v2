#!/usr/bin/env bash
# Hofbräustüble-Vorschau ausrollen — hofbraeustueble.kospolo.de
#
#   ./hofbraeustueble/deploy/deploy.sh
#   HBS_PORT=8099 ./hofbraeustueble/deploy/deploy.sh   # falls 8097 belegt ist
#
# Wie bei infra/beta/deploy.sh wird IMMER der letzte Commit ausgerollt
# (`git archive HEAD`), nie der Arbeitsstand. Nicht committete Änderungen
# erscheinen also NICHT auf der Vorschau.
#
# Beim ersten Start erzeugt der Container ein zufälliges CMS-Passwort, legt im
# Tippspiel „Bundesliga 2026/27“ mit dem echten Spielplan (OpenLigaDB) an und
# erstellt einen Einladungscode. Diese Zugangsdaten zeigt das Skript am Ende an.
set -euo pipefail

cd "$(dirname "$0")/../.."
REPO="$(pwd)"
IMAGE="hofbraeustueble-preview:latest"
CONTAINER="hofbraeustueble-preview"
PORT="${HBS_PORT:-8097}"
STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT

COMMIT="$(git rev-parse --short HEAD)"
echo "→ Ausgerollt wird Commit ${COMMIT}: $(git log -1 --format=%s)"
if ! git diff --quiet -- hofbraeustueble || ! git diff --cached --quiet -- hofbraeustueble; then
  echo "  Hinweis: In hofbraeustueble/ liegen nicht committete Änderungen."
  echo "  Die kommen NICHT mit — die Vorschau zeigt ${COMMIT}."
fi

# Port frei? (Nur prüfen, wenn nicht unser eigener Container ihn hält.)
if ! docker ps --format '{{.Names}}' | grep -qx "$CONTAINER" \
   && curl -s -o /dev/null -m 2 "http://127.0.0.1:${PORT}/"; then
  echo "✗ Port ${PORT} ist schon belegt. Anderen wählen: HBS_PORT=8099 $0" >&2
  exit 1
fi

git archive HEAD hofbraeustueble | tar -x -C "$STAGE"

# Basis-Image sichtbar vorab holen (siehe infra/beta/deploy.sh: ein stiller
# Build, der auf ein gelöschtes Basis-Image wartet, sieht aus wie ein hängender).
BASE_IMAGE="php:8.3-apache"
if ! docker image inspect "$BASE_IMAGE" >/dev/null 2>&1; then
  echo "→ Basis-Image $BASE_IMAGE liegt nicht lokal — hole es (kann dauern) …"
  docker pull "$BASE_IMAGE" || { echo "✗ $BASE_IMAGE liess sich nicht laden." >&2; exit 1; }
fi

echo "→ Image bauen …"
docker build --quiet -f "$STAGE/hofbraeustueble/deploy/Dockerfile" -t "$IMAGE" "$STAGE/hofbraeustueble" >/dev/null

echo "→ Container neu starten …"
HBS_PORT="$PORT" docker compose -f "$REPO/hofbraeustueble/deploy/compose.yml" up -d --no-build

echo -n "→ Warte auf Antwort auf :${PORT} "
for _ in $(seq 1 30); do
  if curl -fsS -o /dev/null -m 2 "http://127.0.0.1:${PORT}/"; then
    echo
    # Ersteinrichtung (Tippspiel) läuft im Hintergrund – kurz Zeit geben
    for _ in $(seq 1 20); do
      docker exec "$CONTAINER" test -f /srv/hbs-state/.tippspiel-eingerichtet 2>/dev/null && break
      sleep 1
    done
    echo "✓ Vorschau läuft — Commit ${COMMIT}"
    echo "  lokal:      http://127.0.0.1:${PORT}/"
    echo "  öffentlich: https://${DOMAIN:-hofbraeustueble.kospolo.de}/  (nach ./hofbraeustueble/deploy/npm-proxy.sh)"
    echo
    docker exec "$CONTAINER" cat /srv/hbs-state/ZUGANGSDATEN.txt 2>/dev/null \
      || echo "  (Zugangsdaten: docker exec $CONTAINER cat /srv/hbs-state/ZUGANGSDATEN.txt)"
    docker logs "$CONTAINER" 2>&1 | grep '\[hbs\]' | tail -3 || true
    exit 0
  fi
  echo -n "."
  sleep 2
done

echo
echo "✗ Die Seite antwortet nicht. Log:"
docker logs --tail 40 "$CONTAINER"
exit 1
