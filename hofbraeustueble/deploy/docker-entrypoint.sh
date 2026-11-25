#!/usr/bin/env bash
# Hofbräustüble – Start des Containers.
#
# Alles Veränderliche liegt im Volume /srv/hbs-state:
#   content.json, config.php (Passwort-Hash), uploads/, backups/, data/ (Tippspiel-DB)
# Im Web-Ordner zeigen Symlinks dorthin. So überlebt jeder Inhalt ein Update des Images.
#
# Beim ALLERERSTEN Start (leeres Volume):
#   - zufälliges CMS-Passwort statt des öffentlich dokumentierten Start-Passworts
#   - Tippspiel: Wettbewerb „Bundesliga 2026/27“ mit echtem Spielplan (OpenLigaDB) + Einladungscode
#   - Zugangsdaten stehen danach in /srv/hbs-state/ZUGANGSDATEN.txt (und im Log)
set -euo pipefail

STATE=/srv/hbs-state
WEB=/var/www/html
SHARE=/usr/local/share/hbs

mkdir -p "$STATE/data" "$STATE/uploads" "$STATE/backups"
cp "$SHARE/uploads.htaccess" "$STATE/uploads/.htaccess"
cp "$SHARE/deny.htaccess" "$STATE/data/.htaccess"
cp "$SHARE/deny.htaccess" "$STATE/backups/.htaccess"

[ -f "$STATE/content.json" ] || cp "$SHARE/content.json" "$STATE/content.json"

# Update: neue Bereiche (z. B. „features“, Speisekarte) aus der mitgelieferten content.json ergänzen,
# wenn sie in den gespeicherten Inhalten noch fehlen. Vorhandene Inhalte werden NIE überschrieben;
# vorher wird eine Sicherung angelegt.
php -r '
  $state = "/srv/hbs-state/content.json"; $def = "/usr/local/share/hbs/content.json";
  $s = json_decode((string)file_get_contents($state), true); $d = json_decode((string)file_get_contents($def), true);
  if (!is_array($s) || !is_array($d)) { exit(0); }
  $added = [];
  foreach ($d as $k => $v) { if (!array_key_exists($k, $s)) { $s[$k] = $v; $added[] = $k; } }
  if (isset($d["features"], $s["features"]) && is_array($d["features"]) && is_array($s["features"])) {
    foreach ($d["features"] as $k => $v) { if (!array_key_exists($k, $s["features"])) { $s["features"][$k] = $v; $added[] = "features.$k"; } }
  }
  if (!$added) { exit(0); }
  @mkdir("/srv/hbs-state/backups", 0775, true);
  copy($state, "/srv/hbs-state/backups/content-vor-update-" . date("Ymd-His") . ".json");
  $tmp = $state . ".tmp";
  file_put_contents($tmp, json_encode($s, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . "\n");
  rename($tmp, $state);
  echo "[hbs] Inhalte ergänzt (Update): " . implode(", ", $added) . "\n";'

if [ ! -f "$STATE/config.php" ]; then
  PASS="$(php -r '$a="abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";$s="";for($i=0;$i<14;$i++){$s.=$a[random_int(0,strlen($a)-1)];}echo $s;')"
  HBS_PASS="$PASS" php -r '
    define("HBS_CMS", true);
    $cfg = require "/usr/local/share/hbs/config.php";
    $cfg["password_hash"] = password_hash(getenv("HBS_PASS"), PASSWORD_DEFAULT);
    $cfg["initial_password"] = false;
    $php = "<?php\n/*\n * Hofbräustüble CMS – Konfiguration (erzeugt beim ersten Start des Containers)\n * Das Passwort wird NUR als Hash gespeichert. Ändern im Admin unter \"Einstellungen\".\n */\n"
         . "if (!defined(\x27HBS_CMS\x27)) {\n    http_response_code(403);\n    exit;\n}\n\nreturn " . var_export($cfg, true) . ";\n";
    file_put_contents("/srv/hbs-state/config.php", $php);'
  umask 077
  printf 'Hofbräustüble – Zugangsdaten (Vorschau)\n\nCMS:      /admin/\nPasswort: %s\n' "$PASS" > "$STATE/ZUGANGSDATEN.txt"
  umask 022
  echo "[hbs] Neues CMS-Passwort erzeugt – steht in $STATE/ZUGANGSDATEN.txt"
fi

# Symlinks vom Web-Ordner ins Volume
ln -sfn "$STATE/content.json" "$WEB/cms/content.json"
ln -sfn "$STATE/config.php"   "$WEB/cms/config.php"
for d in data uploads backups; do
  rm -rf "${WEB:?}/cms/$d"
  ln -sfn "$STATE/$d" "$WEB/cms/$d"
done

chown -R www-data:www-data "$STATE"
chmod 640 "$STATE/config.php"
chmod 600 "$STATE/ZUGANGSDATEN.txt" 2>/dev/null || true

# Hintergrund: einmalige Einrichtung des Tippspiels, danach alle 15 Minuten Ergebnisse holen
(
  php /usr/local/lib/hbs/seed.php || echo "[hbs] Tippspiel-Einrichtung übersprungen (siehe oben)"
  while true; do
    sleep 900
    php /usr/local/lib/hbs/cron.php || true
  done
) &

exec "$@"
