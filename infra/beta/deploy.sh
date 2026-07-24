#!/usr/bin/env bash
# Beta ausrollen — beta.rollsportmanager.de
#
#   ./infra/beta/deploy.sh
#
# === WARUM NICHT EINFACH `docker compose up --build`? ===
# Weil dann der ARBEITSSTAND ausgerollt würde — also auch das, was gerade halb
# fertig auf der Platte liegt. Am 24.07.2026 ist genau das passiert: Ein Build
# lief, während ein Agent noch in lib/data schrieb; das Image bekam eine Datei
# zu sehen, die es eine Minute später gar nicht mehr gab, und der Build brach
# mit einem Typfehler ab, den niemand verursacht hatte.
#
# Dieses Skript rollt deshalb IMMER den letzten Commit aus (`git archive HEAD`)
# und nie den Arbeitsstand. Das hat zwei Folgen, die man kennen muss:
#   1. Nicht committete Änderungen erscheinen NICHT auf der Beta. Wer sie sehen
#      will, muss sie committen. Das ist Absicht — so ist jederzeit sagbar,
#      welcher Stand draußen steht.
#   2. Der Build ist reproduzierbar: gleicher Commit, gleiches Image.
set -euo pipefail

cd "$(dirname "$0")/../.."
REPO="$(pwd)"
IMAGE="rollsportmanager-beta:latest"
STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT

COMMIT="$(git rev-parse --short HEAD)"
echo "→ Ausgerollt wird Commit ${COMMIT}: $(git log -1 --format=%s)"

if ! git diff --quiet -- apps/web || ! git diff --cached --quiet -- apps/web; then
  echo "  Hinweis: In apps/web liegen nicht committete Änderungen."
  echo "  Die kommen NICHT mit — die Beta zeigt ${COMMIT}."
fi

# Nur getrackte Dateien, damit nichts Zufälliges aus dem Arbeitsverzeichnis
# mitwandert (Skizzen, Notizen, halbe Versuche).
git archive HEAD apps/web | tar -x -C "$STAGE"

echo "→ Image bauen …"
docker build --quiet -t "$IMAGE" "$STAGE/apps/web" >/dev/null

echo "→ Container neu starten …"
docker compose -f "$REPO/infra/beta/compose.yml" up -d --no-build

# Erst melden, wenn die Seite wirklich antwortet — nicht schon, wenn der
# Container "läuft". Das ist der Unterschied zwischen gestartet und benutzbar.
echo -n "→ Warte auf Antwort auf :8095 "
for _ in $(seq 1 30); do
  if curl -fsS -o /dev/null -m 2 http://127.0.0.1:8095/; then
    echo
    echo "✓ Beta läuft — Commit ${COMMIT}"
    echo "  lokal:     http://127.0.0.1:8095/"
    echo "  öffentlich: https://beta.rollsportmanager.de/"
    exit 0
  fi
  echo -n "."
  sleep 2
done

echo
echo "✗ Die Seite antwortet nicht. Log:"
docker logs --tail 40 rollsportmanager-beta
exit 1
