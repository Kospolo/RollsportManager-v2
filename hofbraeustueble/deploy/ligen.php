<?php
// Hofbräustüble – weitere Ligen im Tippspiel anlegen (läuft im Container, über die CMS-Schnittstelle).
//   php ligen.php dfb ucl ffb1
// Passwort kommt aus der Umgebungsvariable HBS_PASS. Bereits vorhandene Ligen (gleiches
// OpenLigaDB-Kürzel und gleiche Saison) werden übersprungen, nicht doppelt angelegt.
const BASE = 'http://127.0.0.1';
// Kürzel => [Name, Bonusfrage, Abruf-Fenster in Tagen]
// Frauen-Ligen mit größerem Fenster: dort liegen oft mehr als zwei Wochen zwischen den Spieltagen.
const LIGEN = [
    'bl1'  => ['Bundesliga', 'Wer wird Deutscher Meister?', 14],
    'bl2'  => ['2. Bundesliga', 'Wer wird Meister der 2. Bundesliga?', 14],
    'dfb'  => ['DFB-Pokal', 'Wer gewinnt den DFB-Pokal?', 21],
    'ucl'  => ['Champions League', 'Wer gewinnt die Champions League?', 14],
    'ffb1' => ['Frauen-Bundesliga', 'Wer wird Deutscher Meister bei den Frauen?', 35],
    'wcl'  => ['Frauen-Champions-League', 'Wer gewinnt die Champions League der Frauen?', 35],
    'dfbf' => ['DFB-Pokal Frauen', 'Wer gewinnt den DFB-Pokal der Frauen?', 35],
];

$wanted = array_slice($argv, 1);
$password = (string)getenv('HBS_PASS');
if (!$wanted || $password === '') {
    fwrite(STDERR, "Aufruf: HBS_PASS=… php ligen.php dfb ucl ffb1\nBekannte Kürzel: " . implode(', ', array_keys(LIGEN)) . "\n");
    exit(2);
}

$ch = curl_init();
curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 60, CURLOPT_COOKIEFILE => '']);
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
    $j = json_decode((string)curl_exec($ch), true);
    if (!is_array($j) || empty($j['ok'])) {
        throw new RuntimeException(is_array($j) ? (string)($j['error'] ?? 'Fehler') : 'Keine Antwort vom Server');
    }
    return $j;
}

try {
    call($ch, '/cms/api.php?action=login', ['password' => $password]);
} catch (Throwable $e) {
    fwrite(STDERR, "✗ CMS-Anmeldung fehlgeschlagen: " . $e->getMessage() . "\n");
    exit(3);
}
$csrf = call($ch, '/cms/api.php?action=status')['csrf'];
$y = (int)date('Y');
$season = (int)date('n') >= 7 ? $y : $y - 1;
$label = sprintf('%d/%02d', $season, ($season + 1) % 100);

$existing = call($ch, '/cms/tipp-api.php?action=admin_overview', null, $csrf)['competitions'];
$sort = count($existing);
$rc = 0;
foreach ($wanted as $key) {
    $key = strtolower(trim($key));
    if (!isset(LIGEN[$key])) {
        echo "✗ Unbekanntes Kürzel „{$key}“ – bekannt: " . implode(', ', array_keys(LIGEN)) . "\n";
        $rc = 1;
        continue;
    }
    [$name, $bonus, $window] = LIGEN[$key];
    $name .= ' ' . $label;
    foreach ($existing as $c) {
        if (strtolower((string)($c['source_league'] ?? '')) === $key && (string)($c['source_season'] ?? '') === (string)$season) {
            echo "• {$name}: schon vorhanden, übersprungen\n";
            continue 2;
        }
    }
    try {
        $prev = call($ch, '/cms/tipp-api.php?action=admin_source_preview&league=' . urlencode($key) . '&season=' . $season, null, $csrf);
        $comp = call($ch, '/cms/tipp-api.php?action=admin_competition_save', [
            'name' => $name, 'active' => 1, 'sort' => $sort++,
            // Bonusfrage nur, wenn die Saison noch nicht begonnen hat – sie ist bis zum ersten
            // Spiel tippbar und wäre mitten in der Saison sofort (oder nach Stunden) gesperrt.
            'bonus_question' => (int)($prev['finished'] ?? 0) === 0 ? $bonus : '', 'bonus_answer' => '', 'bonus_points' => 10,
            'source' => 'openligadb', 'source_league' => $key, 'source_season' => (string)$season, 'sync_window_days' => $window,
        ], $csrf)['competition'];
        $sync = call($ch, '/cms/tipp-api.php?action=admin_sync', ['competition_id' => $comp['id'], 'scope' => 'window'], $csrf);
        $count = $prev['match_count'] ?? '?';
        echo "✓ {$name}: angelegt – {$sync['inserted']} Spiele der nächsten {$window} Tage geholt (ganze Saison bei OpenLigaDB: {$count} Spiele)\n";
        if ((int)$sync['inserted'] === 0) {
            echo "  Hinweis: gerade keine Spiele in den nächsten {$window} Tagen – sie kommen automatisch, sobald sie angesetzt sind.\n";
        }
    } catch (Throwable $e) {
        echo "✗ {$name}: " . $e->getMessage() . "\n";
        $rc = 1;
    }
}
call($ch, '/cms/api.php?action=logout', [], $csrf);
exit($rc);
