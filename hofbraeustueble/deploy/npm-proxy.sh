#!/usr/bin/env bash
# Reverse-Proxy für die Hofbräustüble-Vorschau im Nginx Proxy Manager einrichten.
#
#   ./hofbraeustueble/deploy/npm-proxy.sh
#   DOMAIN=stueble.kospolo.de ./hofbraeustueble/deploy/npm-proxy.sh   # anderer Name
#
# Legt an (und ist wiederholbar — vorhandene Einträge werden erkannt):
#   hofbraeustueble.kospolo.de  ->  http://192.168.1.220:8097
#   + Let's-Encrypt-Zertifikat, + Zwang auf HTTPS
#
# Vorher nötig: DNS-Eintrag (A-Record) für den Namen auf deinen Anschluss,
# genau wie bei jochen.kospolo.de. Das Skript prüft das und bricht sonst ab.
#
# Nach dem Muster von infra/beta/npm-proxy.sh (dort steht auch, warum DU das
# ausführst und nicht eine Agenten-Sitzung: es erzeugt sich ein Admin-Token
# aus dem privaten Schlüssel des Proxy-Managers).
set -euo pipefail

NPM_CONTAINER="${NPM_CONTAINER:-nginx-proxy-manager-app-1}"
NPM_API="http://127.0.0.1:81/api"
DOMAIN="${DOMAIN:-hofbraeustueble.kospolo.de}"
TARGET_HOST="${TARGET_HOST:-192.168.1.220}"
TARGET_PORT="${HBS_PORT:-8097}"

echo "→ Vorprüfung"
if ! docker ps --format '{{.Names}}' | grep -qx "$NPM_CONTAINER"; then
  echo "✗ Der Proxy-Manager läuft nicht ($NPM_CONTAINER)." >&2; exit 1
fi
if ! curl -fsS -o /dev/null -m 5 "http://${TARGET_HOST}:${TARGET_PORT}/"; then
  echo "✗ Die Vorschau antwortet nicht auf ${TARGET_HOST}:${TARGET_PORT}." >&2
  echo "  Erst ./hofbraeustueble/deploy/deploy.sh laufen lassen." >&2; exit 1
fi
# Das Zertifikat wird über eine HTTP-Anfrage von außen geprüft (ACME). Zeigt
# der Name nicht hierher, scheitert das mit einer Meldung, die nach Nginx
# aussieht, aber DNS meint — deshalb vorher nachsehen.
DNS_IP="$(dig +short "$DOMAIN" A | tail -1)"
WAN_IP="$(curl -s -m 8 https://api.ipify.org || true)"
echo "  $DOMAIN → ${DNS_IP:-<nichts>} · Anschluss → ${WAN_IP:-?}"
if [ -n "$DNS_IP" ] && [ -n "$WAN_IP" ] && [ "$DNS_IP" != "$WAN_IP" ]; then
  echo "✗ Der Name zeigt woandershin. Let's Encrypt würde scheitern." >&2; exit 1
fi

echo "→ Admin-Token erzeugen"
TOKEN="$(docker exec "$NPM_CONTAINER" node -e "
const fs=require('fs');
const jwt=require('/app/node_modules/jsonwebtoken');
const k=JSON.parse(fs.readFileSync('/data/keys.json','utf8'));
process.stdout.write(jwt.sign(
  {iss:'api',attrs:{id:1},scope:['user'],jti:'hbs'+Date.now()},
  k.key,{algorithm:'RS256',expiresIn:'1d'}));
")"
[ ${#TOKEN} -gt 100 ] || { echo "✗ Kein Token bekommen." >&2; exit 1; }
AUTH=(-H "Authorization: Bearer $TOKEN")

api() { curl -sS -m 60 "${AUTH[@]}" -H 'Content-Type: application/json' "$@"; }

echo "→ Proxy-Host anlegen oder finden"
HOST_ID="$(api "$NPM_API/nginx/proxy-hosts" | python3 -c "
import sys,json
for h in json.load(sys.stdin):
    if '$DOMAIN' in h['domain_names']: print(h['id']); break
")"

if [ -z "$HOST_ID" ]; then
  # caching_enabled MUSS false bleiben: Das Portal ist eine SSR-Anwendung.
  # Mit Cache überschreibt NPM die Cache-Header der App, und Besucher hängen
  # nach einem Deploy auf altem JavaScript fest (schon zweimal passiert,
  # zuletzt bei jochen.kospolo.de).
  HOST_ID="$(api -X POST "$NPM_API/nginx/proxy-hosts" -d "{
    \"domain_names\": [\"$DOMAIN\"],
    \"forward_scheme\": \"http\",
    \"forward_host\": \"$TARGET_HOST\",
    \"forward_port\": $TARGET_PORT,
    \"access_list_id\": 0,
    \"certificate_id\": 0,
    \"ssl_forced\": false,
    \"hsts_enabled\": false,
    \"hsts_subdomains\": false,
    \"http2_support\": true,
    \"block_exploits\": true,
    \"caching_enabled\": false,
    \"allow_websocket_upgrade\": true,
    \"advanced_config\": \"\",
    \"enabled\": true,
    \"locations\": [],
    \"meta\": {}
  }" | python3 -c "import sys,json; print(json.load(sys.stdin).get('id',''))")"
  [ -n "$HOST_ID" ] || { echo "✗ Anlegen fehlgeschlagen." >&2; exit 1; }
  echo "  angelegt (id $HOST_ID)"
else
  echo "  vorhanden (id $HOST_ID)"
fi

echo "→ Zertifikat besorgen (Let's Encrypt)"
CERT_ID="$(api "$NPM_API/nginx/certificates" | python3 -c "
import sys,json
for c in json.load(sys.stdin):
    if '$DOMAIN' in c.get('domain_names',[]): print(c['id']); break
")"

if [ -z "$CERT_ID" ]; then
  # ACHTUNG (NPM aktuell): letsencrypt_email/letsencrypt_agree sind hier NICHT
  # mehr erlaubt (Schema additionalProperties:false) — die E-Mail kommt aus den
  # NPM-Einstellungen. Wer die alten Felder mitschickt, bekommt einen
  # Validierungsfehler, der nichts mit dem Zertifikat zu tun hat.
  RESP="$(api -X POST "$NPM_API/nginx/certificates" -d "{
    \"provider\": \"letsencrypt\",
    \"domain_names\": [\"$DOMAIN\"],
    \"meta\": {\"dns_challenge\": false}
  }")"
  CERT_ID="$(printf '%s' "$RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('id',''))" 2>/dev/null || true)"
  if [ -z "$CERT_ID" ]; then
    echo "✗ Zertifikat fehlgeschlagen:" >&2
    printf '%s\n' "$RESP" | head -c 600 >&2; echo >&2
    echo "  Häufigste Ursache: Port 80 von außen zu (ACME prüft über HTTP)." >&2
    exit 1
  fi
  echo "  ausgestellt (id $CERT_ID)"
else
  echo "  vorhanden (id $CERT_ID)"
fi

echo "→ Zertifikat am Host aktivieren"
# PUT ersetzt den ganzen Datensatz — deshalb ALLE Felder mitsenden, sonst
# fallen stillschweigend Einstellungen zurück auf Vorgaben.
api -X PUT "$NPM_API/nginx/proxy-hosts/$HOST_ID" -d "{
  \"domain_names\": [\"$DOMAIN\"],
  \"forward_scheme\": \"http\",
  \"forward_host\": \"$TARGET_HOST\",
  \"forward_port\": $TARGET_PORT,
  \"access_list_id\": 0,
  \"certificate_id\": $CERT_ID,
  \"ssl_forced\": true,
  \"hsts_enabled\": false,
  \"hsts_subdomains\": false,
  \"http2_support\": true,
  \"block_exploits\": true,
  \"caching_enabled\": false,
  \"allow_websocket_upgrade\": true,
  \"advanced_config\": \"\",
  \"enabled\": true,
  \"locations\": [],
  \"meta\": {}
}" > /dev/null
echo "  aktiv, HTTPS erzwungen"

echo "→ Nachmessen von außen"
sleep 3
CODE="$(curl -s -o /dev/null -m 20 -w '%{http_code}' "https://$DOMAIN/" || true)"
ROBOTS="$(curl -sD- -o /dev/null -m 20 "https://$DOMAIN/" | grep -i 'x-robots-tag' || true)"
echo "  https://$DOMAIN/ → HTTP $CODE"
echo "  ${ROBOTS:-KEIN X-Robots-Tag — bitte melden}"
[ "$CODE" = "200" ] && echo "✓ Fertig." || { echo "✗ Noch nicht erreichbar."; exit 1; }
