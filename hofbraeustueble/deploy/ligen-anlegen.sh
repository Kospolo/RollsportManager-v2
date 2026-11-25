#!/usr/bin/env bash
# Weitere Ligen im Tippspiel der Hofbräustüble-Vorschau anlegen.
#
#   ./hofbraeustueble/deploy/ligen-anlegen.sh                 # DFB-Pokal, Champions League, Frauen-Bundesliga
#   ./hofbraeustueble/deploy/ligen-anlegen.sh bl2 wcl dfbf    # andere Ligen
#
# Kürzel: bl1 (Bundesliga), bl2 (2. Bundesliga), dfb (DFB-Pokal), ucl (Champions League),
#         ffb1 (Frauen-Bundesliga), wcl (Frauen-Champions-League), dfbf (DFB-Pokal Frauen)
# Vorhandene Ligen werden übersprungen. Spielplan und Ergebnisse laufen danach automatisch.
set -euo pipefail

CONTAINER="hofbraeustueble-preview"
[ $# -gt 0 ] || set -- dfb ucl ffb1

if ! docker ps --format '{{.Names}}' | grep -qx "$CONTAINER"; then
  echo "✗ Der Container $CONTAINER läuft nicht. Erst ./hofbraeustueble/deploy/deploy.sh ausführen." >&2
  exit 1
fi
if ! docker exec "$CONTAINER" test -f /usr/local/lib/hbs/ligen.php; then
  echo "✗ Der Container ist noch auf einem älteren Stand. Erst: git pull && ./hofbraeustueble/deploy/deploy.sh" >&2
  exit 1
fi

# Passwort aus den Zugangsdaten; wurde es im CMS geändert, wird nachgefragt.
PASS="$(docker exec "$CONTAINER" sed -n 's/^Passwort: //p' /srv/hbs-state/ZUGANGSDATEN.txt 2>/dev/null || true)"
if [ -z "$PASS" ] || ! docker exec -e HBS_PASS="$PASS" "$CONTAINER" php -r '
    $c = curl_init("http://127.0.0.1/cms/api.php?action=login");
    curl_setopt_array($c, [CURLOPT_RETURNTRANSFER => 1, CURLOPT_POST => 1, CURLOPT_HTTPHEADER => ["Host: localhost", "Content-Type: application/json"],
      CURLOPT_POSTFIELDS => json_encode(["password" => getenv("HBS_PASS")])]);
    $j = json_decode((string)curl_exec($c), true); exit(!empty($j["ok"]) ? 0 : 1);' ; then
  read -r -s -p "CMS-Passwort: " PASS; echo
fi

docker exec -e HBS_PASS="$PASS" "$CONTAINER" php /usr/local/lib/hbs/ligen.php "$@"
