<?php
/*
 * Hofbräustüble – „Diese Woche live bei uns“: öffentliche, NUR LESENDE Schnittstelle zum Fußball-Programm.
 *
 *   GET programm-api.php                    → {ok, api:"hbs-programm", enabled, available, days, matches:[…]}
 *   GET programm-api.php?action=wettbewerbe → {ok, competitions:[{id, name, active}]}  (für die Auswahl in der Verwaltung)
 *
 * Liest die Tippspiel-Datenbank cms/data/tippspiel.sqlite schreibgeschützt (SQLITE_OPEN_READONLY) und gibt nur
 * Wettbewerb, Anstoß, Heim, Gast und – falls vorhanden – die lokal gespeicherten Vereinslogos aus.
 * Niemals Spieler, Tipps, E-Mail-Adressen o. ä. Fehlt die Datenbank (Tippspiel nie benutzt), kommt eine leere Liste.
 * Antworten werden 5 Minuten zwischengespeichert (cms/data/programm-cache.json + HTTP-Cache).
 */
declare(strict_types=1);

define('PROG_CMS_DIR', __DIR__);
define('PROG_DATA_DIR', PROG_CMS_DIR . '/data');
define('PROG_DB_FILE', PROG_DATA_DIR . '/tippspiel.sqlite');
define('PROG_CACHE_FILE', PROG_DATA_DIR . '/programm-cache.json');
define('PROG_CONTENT_FILE', PROG_CMS_DIR . '/content.json');
define('PROG_LOGO_DIR', PROG_CMS_DIR . '/uploads/logos');
const PROG_LOGO_PUBLIC = 'cms/uploads/logos/';
const PROG_CACHE_TTL = 300;
const PROG_MAX_MATCHES = 80;

date_default_timezone_set('Europe/Berlin');
error_reporting(E_ALL);
ini_set('display_errors', '0');

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: same-origin');
header('X-Frame-Options: DENY');
header('X-Robots-Tag: noindex, nofollow');

function out(array $data, int $code = 200, int $maxAge = PROG_CACHE_TTL): never
{
    http_response_code($code);
    header($maxAge > 0 ? 'Cache-Control: public, max-age=' . $maxAge : 'Cache-Control: no-store');
    echo json_encode(['ok' => $code < 400, 'api' => 'hbs-programm'] + $data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

set_exception_handler(function (Throwable $e): void {
    error_log('[hbs-programm] ' . $e->getMessage() . ' in ' . $e->getFile() . ':' . $e->getLine());
    if (!headers_sent()) {
        http_response_code(200);
        header('Content-Type: application/json; charset=utf-8');
        header('Cache-Control: no-store');
    }
    // Die Website soll nie kaputt aussehen: leere Liste statt Fehler
    echo json_encode(['ok' => true, 'api' => 'hbs-programm', 'enabled' => true, 'available' => false, 'matches' => []], JSON_UNESCAPED_UNICODE);
});

if (!in_array(strtoupper((string)($_SERVER['REQUEST_METHOD'] ?? 'GET')), ['GET', 'HEAD'], true)) {
    header('Allow: GET');
    out(['error' => 'Nur GET erlaubt.'], 405, 0);
}

function lower(string $s): string
{
    return function_exists('mb_strtolower') ? mb_strtolower($s, 'UTF-8') : strtr(strtolower($s), ['Ä' => 'ä', 'Ö' => 'ö', 'Ü' => 'ü']);
}

function content(): array
{
    $c = is_file(PROG_CONTENT_FILE) ? json_decode((string)file_get_contents(PROG_CONTENT_FILE), true) : null;
    return is_array($c) ? $c : [];
}

/** Datenbank schreibgeschützt öffnen – oder null, wenn es sie (noch) nicht gibt. */
function open_db(): ?PDO
{
    if (!is_file(PROG_DB_FILE) || !class_exists('PDO') || !in_array('sqlite', PDO::getAvailableDrivers(), true)) {
        return null;
    }
    try {
        $pdo = new PDO('sqlite:' . PROG_DB_FILE, null, null, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_TIMEOUT => 3,
            PDO::SQLITE_ATTR_OPEN_FLAGS => PDO::SQLITE_OPEN_READONLY,
        ]);
        $pdo->exec('PRAGMA busy_timeout = 3000');
        $pdo->exec('PRAGMA query_only = 1');
        return $pdo;
    } catch (Throwable $e) {
        error_log('[hbs-programm] DB: ' . $e->getMessage());
        return null;
    }
}

function table_columns(PDO $pdo, string $table): array
{
    $cols = [];
    $st = $pdo->query("SELECT name FROM sqlite_master WHERE type = 'table' AND name = " . $pdo->quote($table));
    if (!$st || !$st->fetchColumn()) {
        return [];
    }
    foreach ($pdo->query('PRAGMA table_info(' . $table . ')') ?: [] as $r) {
        $cols[(string)$r['name']] = true;
    }
    return $cols;
}

$action = (string)($_GET['action'] ?? '');
$c = content();

if ($action === 'wettbewerbe') {
    $pdo = open_db();
    $list = [];
    if ($pdo && ($cols = table_columns($pdo, 'competitions')) && isset($cols['id'], $cols['name'])) {
        $order = isset($cols['sort']) ? 'sort, id' : 'id';
        $active = isset($cols['active']) ? 'active' : '1 AS active';
        foreach ($pdo->query("SELECT id, name, $active FROM competitions ORDER BY $order") as $r) {
            $list[] = ['id' => (int)$r['id'], 'name' => (string)$r['name'], 'active' => (bool)$r['active']];
        }
    }
    out(['available' => $pdo !== null, 'competitions' => $list], 200, 60);
}
if ($action !== '' && $action !== 'woche') {
    out(['error' => 'Unbekannte Aktion.'], 400, 0);
}

/* ---------------------------------------------------------------- Einstellungen aus content.json */
$features = is_array($c['features'] ?? null) ? $c['features'] : [];
$enabled = ($features['programm'] ?? true) !== false;
$p = is_array($c['programm'] ?? null) ? $c['programm'] : [];
$days = is_int($p['days'] ?? null) ? max(1, min(14, $p['days'])) : 7;
$comps = [];
foreach ((is_array($p['competitions'] ?? null) ? $p['competitions'] : []) as $id) {
    if (is_int($id) && $id > 0) {
        $comps[$id] = $id;
    }
}
$comps = array_values($comps);
sort($comps);

if (!$enabled) {
    out(['enabled' => false, 'available' => false, 'days' => $days, 'matches' => []], 200, 60);
}

/* ---------------------------------------------------------------- Zwischenspeicher (5 Minuten) */
$key = hash('sha256', json_encode([$days, $comps]) . '|' . (is_file(PROG_DB_FILE) ? '1' : '0'));
$cache = is_file(PROG_CACHE_FILE) ? json_decode((string)@file_get_contents(PROG_CACHE_FILE), true) : null;
if (is_array($cache) && ($cache['key'] ?? '') === $key && (int)($cache['time'] ?? 0) > time() - PROG_CACHE_TTL && is_array($cache['data'] ?? null)) {
    header('X-HBS-Cache: hit');
    out($cache['data'], 200, max(1, PROG_CACHE_TTL - (time() - (int)$cache['time'])));
}

/* ---------------------------------------------------------------- Abfrage */
$pdo = open_db();
$matches = [];
$available = false;
if ($pdo) {
    $mc = table_columns($pdo, 'matches');
    $cc = table_columns($pdo, 'competitions');
    if (isset($mc['kickoff'], $mc['home'], $mc['away'], $mc['competition_id']) && isset($cc['id'], $cc['name'])) {
        $available = true;
        $from = date('Y-m-d H:i', time() - 110 * 60); // laufende Spiele (bis ca. 2 Std. nach Anstoß) bleiben sichtbar
        $to = date('Y-m-d', strtotime('+' . $days . ' days')) . ' 23:59';
        $where = ['m.kickoff >= ?', 'm.kickoff <= ?'];
        $params = [$from, $to];
        if ($comps) {
            $where[] = 'm.competition_id IN (' . implode(',', array_fill(0, count($comps), '?')) . ')';
            array_push($params, ...$comps);
        } elseif (isset($cc['active'])) {
            $where[] = 'c.active = 1';
        }
        $st = $pdo->prepare('SELECT c.name AS competition, m.kickoff, m.home, m.away FROM matches m JOIN competitions c ON c.id = m.competition_id WHERE '
            . implode(' AND ', $where) . ' ORDER BY m.kickoff, m.id LIMIT ' . PROG_MAX_MATCHES);
        $st->execute($params);
        $rows = $st->fetchAll();

        // Vereinslogos (nur wenn die Tabelle existiert und Logos im Tippspiel eingeschaltet sind)
        $logos = [];
        $lc = table_columns($pdo, 'team_logos');
        $show = true;
        if (table_columns($pdo, 'settings')) {
            $v = $pdo->query("SELECT value FROM settings WHERE key = 'show_logos'")->fetchColumn();
            $show = $v === false || !in_array((string)$v, ['0', 'false', ''], true);
        }
        if ($show && isset($lc['team'], $lc['file']) && $rows) {
            $teams = [];
            foreach ($rows as $r) {
                $teams[(string)$r['home']] = true;
                $teams[(string)$r['away']] = true;
            }
            $names = array_keys($teams);
            $sql = 'SELECT team, file' . (isset($lc['status']) ? ', status' : ", 'ok' AS status") . ' FROM team_logos WHERE team IN (' . implode(',', array_fill(0, count($names), '?')) . ')';
            $ls = $pdo->prepare($sql);
            $ls->execute($names);
            foreach ($ls->fetchAll() as $l) {
                $file = (string)($l['file'] ?? '');
                if ($l['status'] === 'ok' && preg_match('/^[a-f0-9]{40}\.(png|jpe?g|gif|webp)$/', $file) && is_file(PROG_LOGO_DIR . '/' . $file)) {
                    $logos[lower((string)$l['team'])] = PROG_LOGO_PUBLIC . $file;
                }
            }
        }
        foreach ($rows as $r) {
            $home = (string)$r['home'];
            $away = (string)$r['away'];
            $m = [
                'competition' => (string)$r['competition'],
                'kickoff' => (string)$r['kickoff'],
                'home' => $home,
                'away' => $away,
            ];
            if ($lc) {
                $m['home_logo'] = $logos[lower($home)] ?? null;
                $m['away_logo'] = $logos[lower($away)] ?? null;
            }
            $matches[] = $m;
        }
    }
}

$data = ['enabled' => true, 'available' => $available, 'days' => $days, 'generated' => date('Y-m-d H:i'), 'matches' => $matches];
if (is_dir(PROG_DATA_DIR) && is_writable(PROG_DATA_DIR)) {
    $tmp = PROG_CACHE_FILE . '.' . bin2hex(random_bytes(4)) . '.tmp';
    if (@file_put_contents($tmp, json_encode(['key' => $key, 'time' => time(), 'data' => $data], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)) !== false) {
        @rename($tmp, PROG_CACHE_FILE);
    }
    @unlink($tmp);
}
out($data);
