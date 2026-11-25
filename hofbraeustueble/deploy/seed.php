<?php
// Hofbräustüble – einmalige Einrichtung des Tippspiels beim ersten Container-Start:
// Wettbewerb „Bundesliga JJJJ/JJ“ mit echtem Spielplan von OpenLigaDB + ein Einladungscode.
// Läuft nur, solange /srv/hbs-state/.tippspiel-eingerichtet fehlt und ZUGANGSDATEN.txt existiert.
const STATE = '/srv/hbs-state';
const BASE = 'http://127.0.0.1';
$marker = STATE . '/.tippspiel-eingerichtet';
$creds = STATE . '/ZUGANGSDATEN.txt';
if (is_file($marker) || !is_file($creds)) {
    exit(0);
}
if (!preg_match('/^Passwort: (\S+)$/m', (string)file_get_contents($creds), $m)) {
    exit(0);
}
$password = $m[1];

$ch = curl_init();
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 60, CURLOPT_COOKIEFILE => '',
    CURLOPT_HTTPHEADER => ['Host: localhost'],
]);
function call($ch, string $url, ?array $body = null, ?string $csrf = null): array
{
    $h = ['Host: localhost', 'Content-Type: application/json'];
    if ($csrf) {
        $h[] = 'X-CSRF-Token: ' . $csrf;
    }
    curl_setopt($ch, CURLOPT_URL, BASE . $url);
    curl_setopt($ch, CURLOPT_HTTPHEADER, $h);
    if ($body === null) {
        curl_setopt($ch, CURLOPT_HTTPGET, true);
    } else {
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($body));
    }
    $out = curl_exec($ch);
    $j = json_decode((string)$out, true);
    if (!is_array($j) || empty($j['ok'])) {
        throw new RuntimeException($url . ': ' . (is_array($j) ? ($j['error'] ?? 'Fehler') : substr((string)$out, 0, 200)));
    }
    return $j;
}

// auf Apache warten
for ($i = 0; $i < 30; $i++) {
    curl_setopt($ch, CURLOPT_URL, BASE . '/');
    curl_exec($ch);
    if (curl_getinfo($ch, CURLINFO_HTTP_CODE) === 200) {
        break;
    }
    sleep(1);
}

try {
    call($ch, '/cms/api.php?action=login', ['password' => $password]);
    $csrf = call($ch, '/cms/api.php?action=status')['csrf'];
    $y = (int)date('Y');
    $season = (int)date('n') >= 7 ? $y : $y - 1;
    $name = sprintf('Bundesliga %d/%02d', $season, ($season + 1) % 100);
    // Nicht doppelt anlegen, falls ein früherer Versuch abgebrochen ist
    $comp = null;
    foreach (call($ch, '/cms/tipp-api.php?action=admin_overview', null, $csrf)['competitions'] as $c) {
        if (($c['source_league'] ?? '') === 'bl1' && (string)($c['source_season'] ?? '') === (string)$season) {
            $comp = $c;
        }
    }
    $comp = $comp ?? call($ch, '/cms/tipp-api.php?action=admin_competition_save', [
        'name' => $name, 'active' => 1, 'sort' => 0,
        'bonus_question' => 'Wer wird Deutscher Meister?', 'bonus_answer' => '', 'bonus_points' => 10,
        'source' => 'openligadb', 'source_league' => 'bl1', 'source_season' => (string)$season, 'sync_window_days' => 14,
    ], $csrf)['competition'];
    try {
        $sync = call($ch, '/cms/tipp-api.php?action=admin_sync', ['competition_id' => $comp['id'], 'scope' => 'window'], $csrf);
    } catch (Throwable $e) {
        // OpenLigaDB gerade nicht erreichbar: der 15-Minuten-Abruf holt den Spielplan nach
        fwrite(STDERR, '[hbs] Spielplan noch nicht abrufbar (' . $e->getMessage() . ") – wird automatisch nachgeholt\n");
        $sync = ['inserted' => 0];
    }
    $inv = call($ch, '/cms/tipp-api.php?action=admin_invite_create', ['note' => 'Vorschau – zum Ausprobieren', 'max_uses' => 25], $csrf)['invite'];
    call($ch, '/cms/tipp-api.php?action=admin_cron_info', null, $csrf);
    call($ch, '/cms/api.php?action=logout', [], $csrf);
    file_put_contents($creds, "\nTippspiel: /tippspiel/?code={$inv['code']}\nEinladungscode: {$inv['code']} (bis zu 25 Personen)\n", FILE_APPEND);
    touch($marker);
    echo "[hbs] Tippspiel eingerichtet: {$name}, {$sync['inserted']} Spiele von OpenLigaDB, Einladungscode {$inv['code']}\n";
} catch (Throwable $e) {
    fwrite(STDERR, '[hbs] Tippspiel-Einrichtung fehlgeschlagen: ' . $e->getMessage() . "\n");
    exit(1);
}
