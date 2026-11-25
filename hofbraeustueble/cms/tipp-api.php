<?php
/*
 * Hofbräustüble – Tippspiel-API (kostenlos, ohne Einsätze, nur Punkte)
 * PHP 8 + PDO SQLite. Datenbank: cms/data/tippspiel.sqlite (wird automatisch angelegt).
 * Vertrag: tippspiel/SPEC.md
 *
 * Spieler-Session: eigener Session-Name HBS_TIPP (Ordner cms/data/tipp-sessions).
 * Admin-Aktionen: prüfen die bestehende CMS-Session (HBSCMS, wie cms/api.php) + deren CSRF-Token.
 */
declare(strict_types=1);

define('HBS_CMS', true); // erlaubt das Einlesen von cms/config.php (Sitzungsdauer)

const TIPP_DB_VERSION        = 2;      // 2: automatischer Abruf (OpenLigaDB)
const TIPP_SESSION_NAME      = 'HBS_TIPP';
const TIPP_SESSION_DAYS      = 60;      // so lange bleibt man am Handy angemeldet
const TIPP_CMS_SESSION_NAME  = 'HBSCMS';
const TIPP_BF_WINDOW         = 900;     // Fehlversuche innerhalb von 15 Minuten …
const TIPP_BF_LOCK           = 900;     // … führen zu 15 Minuten Sperre
const TIPP_BF_NICK_FAILS     = 5;       // pro IP + Nickname
const TIPP_BF_IP_FAILS       = 30;      // pro IP (Kneipen-WLAN: viele Gäste teilen eine IP)
const TIPP_BF_CODE_FAILS     = 20;      // falsche Einladungscodes pro IP
const TIPP_MAX_BODY          = 262144;
const TIPP_MAX_GOALS         = 20;
const TIPP_INVITE_ALPHABET   = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // ohne 0/O/1/I
const TIPP_PW_ALPHABET       = 'abcdefghjkmnpqrstuvwxyz23456789';
const TIPP_NICK_RE           = '/^[A-Za-z0-9ÄÖÜäöüß _.\-]+$/u';
const TIPP_DEFAULT_SETTINGS  = ['points_exact' => 4, 'points_diff' => 3, 'points_tendency' => 2];

// Automatischer Abruf von Spielplan und Ergebnissen (OpenLigaDB, kostenlos, ohne Schlüssel)
const TIPP_OLDB_BASE         = 'https://api.openligadb.de'; // fest – Nutzereingaben ergeben NIE eine URL
const TIPP_OLDB_UA           = 'HBS-Tippspiel/1.0';
const TIPP_OLDB_MAX_BYTES    = 8388608;  // 8 MB
const TIPP_SYNC_ADMIN_TIMEOUT = 8;       // Sekunden (Verwaltung, Cronjob)
const TIPP_SYNC_LAZY_TIMEOUT = 5;        // Sekunden (nebenbei beim Öffnen des Tippspiels)
const TIPP_SYNC_LAZY_AFTER   = 110;      // Minuten nach Anstoß wird ein fehlendes Ergebnis nachgeschaut …
const TIPP_SYNC_LAZY_EVERY   = 10;       // … höchstens alle 10 Minuten je Wettbewerb
const TIPP_SYNC_LAZY_DAYS    = 3;        // Spiele, die länger her sind, lösen keinen Abruf mehr aus (z. B. abgesagt)
const TIPP_SYNC_STALE_MIN    = 240;      // Ergebnis ohne „beendet“-Kennzeichen erst 4 Std. nach Anstoß übernehmen
const TIPP_SYNC_WINDOW_MAX   = 90;
const TIPP_LEAGUE_RE         = '/^[A-Za-z0-9_-]{1,40}$/';

define('TIPP_CMS_DIR', __DIR__);
define('TIPP_DATA_DIR', __DIR__ . '/data');
define('TIPP_DB_FILE', TIPP_DATA_DIR . '/tippspiel.sqlite');
define('TIPP_CRON_FILE', TIPP_DATA_DIR . '/tipp-cron-token.php'); // geheimer Token für den Cronjob-Aufruf
define('TIPP_SYNC_LOCK', TIPP_DATA_DIR . '/tipp-sync.lock');

date_default_timezone_set('Europe/Berlin');
error_reporting(E_ALL);
ini_set('display_errors', '0');

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');
header('Referrer-Policy: same-origin');
header('X-Frame-Options: DENY');
header('X-Robots-Tag: noindex, nofollow');

set_exception_handler(function (Throwable $e): void {
    error_log('[hbs-tipp] ' . $e->getMessage() . ' in ' . $e->getFile() . ':' . $e->getLine());
    if (!headers_sent()) {
        http_response_code(500);
        header('Content-Type: application/json; charset=utf-8');
    }
    echo json_encode(['ok' => false, 'api' => 'hbs-tipp', 'error' => 'Interner Serverfehler. Bitte später erneut versuchen.'], JSON_UNESCAPED_UNICODE);
});

/* ================================================================== Hilfen */

function respond(array $data, int $code = 200): never
{
    http_response_code($code);
    echo json_encode(['ok' => true] + $data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function fail(string $message, int $code = 400, array $extra = []): never
{
    http_response_code($code);
    echo json_encode(['ok' => false, 'api' => 'hbs-tipp', 'error' => $message] + $extra, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function is_https(): bool
{
    if (!empty($_SERVER['HTTPS']) && strtolower((string)$_SERVER['HTTPS']) !== 'off') {
        return true;
    }
    if (strtolower((string)($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '')) === 'https') {
        return true;
    }
    return (string)($_SERVER['SERVER_PORT'] ?? '') === '443';
}

function ensure_dir(string $dir): bool
{
    return is_dir($dir) || @mkdir($dir, 0755, true);
}

function now_min(): string { return date('Y-m-d H:i'); }
function now_full(): string { return date('Y-m-d H:i:s'); }

function lower(string $s): string
{
    return function_exists('mb_strtolower') ? mb_strtolower($s, 'UTF-8') : strtr(strtolower($s), ['Ä' => 'ä', 'Ö' => 'ö', 'Ü' => 'ü']);
}

function str_len(string $s): int
{
    return (int)preg_match_all('/./us', $s);
}

/** Vergleich der Bonus-Antwort: ohne Groß-/Kleinschreibung und ohne Leerzeichen */
function bonus_norm(?string $s): string
{
    return lower((string)preg_replace('/\s+/u', '', (string)$s));
}

/** Gerundet (kaufmännisch) auf $dec Nachkommastellen – rein ganzzahlig, identisch zum JS-Client */
function ratio(int $num, int $den, int $dec = 2): float|int
{
    if ($den <= 0) {
        return 0;
    }
    $f = 10 ** $dec;
    $v = intdiv($num * $f * 2 + $den, 2 * $den) / $f;
    return $v;
}

function random_string(string $alphabet, int $len): string
{
    $out = '';
    $max = strlen($alphabet) - 1;
    for ($i = 0; $i < $len; $i++) {
        $out .= $alphabet[random_int(0, $max)];
    }
    return $out;
}

/* ============================================================== Eingaben */

function method(): string
{
    return strtoupper((string)($_SERVER['REQUEST_METHOD'] ?? 'GET'));
}

function body(): array
{
    static $body = null;
    if ($body !== null) {
        return $body;
    }
    if (method() !== 'POST') {
        return $body = [];
    }
    $ct = strtolower((string)($_SERVER['CONTENT_TYPE'] ?? ''));
    if (!str_contains($ct, 'application/json')) {
        fail('Bitte Daten als JSON senden.', 415);
    }
    if ((int)($_SERVER['CONTENT_LENGTH'] ?? 0) > TIPP_MAX_BODY) {
        fail('Die Daten sind zu groß.', 413);
    }
    $raw = (string)file_get_contents('php://input', false, null, 0, TIPP_MAX_BODY + 1);
    if (strlen($raw) > TIPP_MAX_BODY) {
        fail('Die Daten sind zu groß.', 413);
    }
    if (trim($raw) === '') {
        return $body = [];
    }
    $data = json_decode($raw, true, 16);
    if (!is_array($data) || ($data !== [] && array_is_list($data))) {
        fail('Ungültiges JSON.', 400);
    }
    return $body = $data;
}

function inp(string $key): mixed
{
    if (method() === 'GET') {
        return $_GET[$key] ?? null;
    }
    $b = body();
    return array_key_exists($key, $b) ? $b[$key] : null;
}

function present(string $key): bool
{
    $v = inp($key);
    return $v !== null && $v !== '';
}

function v_int(mixed $v, int $min, int $max, string $label): int
{
    if (is_int($v)) {
        $n = $v;
    } elseif (is_string($v) && preg_match('/^\s*-?\d{1,9}\s*$/', $v)) {
        $n = (int)trim($v);
    } elseif (is_float($v) && floor($v) === $v && abs($v) < 1e9) {
        $n = (int)$v;
    } else {
        fail("$label: bitte eine ganze Zahl angeben.", 400);
    }
    if ($n < $min || $n > $max) {
        fail("$label muss zwischen $min und $max liegen.", 400);
    }
    return $n;
}

function v_id(mixed $v, string $label = 'ID'): int
{
    return v_int($v, 1, 2147483647, $label);
}

function v_goals(mixed $v, string $label): int
{
    return v_int($v, 0, TIPP_MAX_GOALS, $label);
}

function v_bool(mixed $v, string $label): int
{
    if ($v === true || $v === 1 || $v === '1' || $v === 'true') {
        return 1;
    }
    if ($v === false || $v === 0 || $v === '0' || $v === 'false') {
        return 0;
    }
    fail("$label: ungültiger Wert (ja/nein erwartet).", 400);
}

function v_str(mixed $v, int $min, int $max, string $label, bool $multiline = false): string
{
    if ($v === null) {
        $v = '';
    }
    if (is_int($v) || is_float($v)) {
        $v = (string)$v;
    }
    if (!is_string($v) || preg_match('//u', $v) !== 1) {
        fail("$label: ungültiger Text.", 400);
    }
    $v = str_replace(["\r\n", "\r"], "\n", $v);
    $v = (string)preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F\x{200B}-\x{200F}\x{202A}-\x{202E}\x{2066}-\x{2069}\x{FEFF}]/u', '', $v);
    if ($multiline) {
        $v = str_replace("\t", ' ', $v);
    } else {
        $v = (string)preg_replace('/\s+/u', ' ', $v);
    }
    $v = trim($v);
    $len = str_len($v);
    if ($len < $min) {
        fail($min <= 1 ? "Bitte $label angeben." : "$label muss mindestens $min Zeichen lang sein.", 400);
    }
    if ($len > $max) {
        fail("$label ist zu lang (höchstens $max Zeichen).", 400);
    }
    return $v;
}

/** Optionaler Text → null, wenn leer */
function v_opt_str(mixed $v, int $max, string $label): ?string
{
    $s = v_str($v, 0, $max, $label);
    return $s === '' ? null : $s;
}

/** Anstoß: "YYYY-MM-DD HH:MM" (auch "YYYY-MM-DDTHH:MM[:SS]" oder "TT.MM.JJJJ HH:MM") → "YYYY-MM-DD HH:MM" oder null */
function parse_kickoff(mixed $v): ?string
{
    if (!is_string($v)) {
        return null;
    }
    $v = trim($v);
    if (preg_match('/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::00)?$/', $v, $m)) {
        [$y, $mo, $d, $h, $mi] = [(int)$m[1], (int)$m[2], (int)$m[3], (int)$m[4], (int)$m[5]];
    } elseif (preg_match('/^(\d{1,2})\.(\d{1,2})\.(\d{4}),? (\d{1,2}):(\d{2})$/', $v, $m)) {
        [$d, $mo, $y, $h, $mi] = [(int)$m[1], (int)$m[2], (int)$m[3], (int)$m[4], (int)$m[5]];
    } else {
        return null;
    }
    if ($y < 2000 || $y > 2100 || !checkdate($mo, $d, $y) || $h > 23 || $mi > 59) {
        return null;
    }
    return sprintf('%04d-%02d-%02d %02d:%02d', $y, $mo, $d, $h, $mi);
}

function v_kickoff(mixed $v): string
{
    $k = parse_kickoff($v);
    if ($k === null) {
        fail('Anstoß: bitte im Format JJJJ-MM-TT HH:MM angeben (z. B. 2026-06-14 21:00).', 400);
    }
    return $k;
}

/** Ablaufdatum einer Einladung: leer, "YYYY-MM-DD" (gilt bis Tagesende) oder "YYYY-MM-DD HH:MM" */
function v_expires(mixed $v): ?string
{
    if ($v === null || $v === '') {
        return null;
    }
    if (is_string($v) && preg_match('/^(\d{4})-(\d{2})-(\d{2})$/', trim($v), $m) && checkdate((int)$m[2], (int)$m[3], (int)$m[1])) {
        return trim($v);
    }
    $k = parse_kickoff($v);
    if ($k === null) {
        fail('Ablaufdatum: bitte im Format JJJJ-MM-TT angeben.', 400);
    }
    return $k;
}

function v_nickname(mixed $v): string
{
    $n = v_str($v, 2, 24, 'Nickname');
    if (!preg_match(TIPP_NICK_RE, $n) || !preg_match('/[A-Za-z0-9ÄÖÜäöüß]/u', $n)) {
        fail('Der Nickname darf nur Buchstaben (auch Umlaute), Ziffern, Leerzeichen sowie _ - . enthalten.', 400);
    }
    return $n;
}

function v_new_password(mixed $v, string $label = 'Das Passwort'): string
{
    if (!is_string($v) || preg_match('//u', $v) !== 1) {
        fail("$label ist ungültig.", 400);
    }
    if (str_len($v) < 8) {
        fail("$label muss mindestens 8 Zeichen lang sein.", 400);
    }
    if (strlen($v) > 200) {
        fail("$label ist zu lang (höchstens 200 Zeichen).", 400);
    }
    return $v;
}

function v_email(mixed $v): ?string
{
    $e = v_str($v, 0, 150, 'E-Mail');
    if ($e === '') {
        return null;
    }
    if (!filter_var($e, FILTER_VALIDATE_EMAIL)) {
        fail('Die E-Mail-Adresse ist ungültig.', 400);
    }
    return $e;
}

function norm_code(mixed $v): string
{
    if (!is_string($v)) {
        return '';
    }
    $c = strtoupper((string)preg_replace('/[\s\-]+/', '', $v));
    return preg_match('/^[A-Z0-9]{4,16}$/', $c) ? $c : '';
}

/* ============================================================== Datenbank */

function db(): PDO
{
    static $pdo = null;
    if ($pdo instanceof PDO) {
        return $pdo;
    }
    if (!class_exists('PDO') || !in_array('sqlite', PDO::getAvailableDrivers(), true)) {
        fail('Das Tippspiel braucht die PHP-Erweiterung „pdo_sqlite“. Bitte im Kundenmenü des Hosters aktivieren (bei IONOS, Strato und all-inkl ist sie normalerweise schon an).', 500, ['setup' => 'pdo_sqlite']);
    }
    if (!ensure_dir(TIPP_DATA_DIR) || !is_writable(TIPP_DATA_DIR)) {
        fail('Der Ordner cms/data ist nicht beschreibbar. Bitte Schreibrechte setzen (755 bzw. 775).', 500, ['setup' => 'data_dir']);
    }
    $isNew = !is_file(TIPP_DB_FILE);
    $pdo = new PDO('sqlite:' . TIPP_DB_FILE, null, null, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);
    $pdo->exec('PRAGMA busy_timeout = 5000');
    try {
        $pdo->query('PRAGMA journal_mode = WAL')->fetchColumn();
    } catch (Throwable) {
        // z. B. Netzwerk-Dateisystem ohne WAL-Unterstützung: Standard-Journal genügt
    }
    $pdo->exec('PRAGMA foreign_keys = ON');
    $pdo->exec('PRAGMA synchronous = NORMAL');
    if ($isNew) {
        @chmod(TIPP_DB_FILE, 0640);
    }
    if ((int)$pdo->query('PRAGMA user_version')->fetchColumn() < TIPP_DB_VERSION) {
        migrate($pdo);
    }
    return $pdo;
}

function migrate(PDO $pdo): void
{
    $pdo->exec('BEGIN IMMEDIATE');
    try {
        if ((int)$pdo->query('PRAGMA user_version')->fetchColumn() < 1) {
            $pdo->exec(<<<SQL
                CREATE TABLE IF NOT EXISTS settings (
                    key TEXT PRIMARY KEY,
                    value TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS competitions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL,
                    active INTEGER NOT NULL DEFAULT 1,
                    sort INTEGER NOT NULL DEFAULT 0,
                    bonus_question TEXT NULL,
                    bonus_answer TEXT NULL,
                    bonus_points INTEGER NOT NULL DEFAULT 10,
                    created TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS matches (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    competition_id INTEGER NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
                    round TEXT NOT NULL DEFAULT '',
                    kickoff TEXT NOT NULL,
                    home TEXT NOT NULL,
                    away TEXT NOT NULL,
                    home_goals INTEGER NULL,
                    away_goals INTEGER NULL
                );
                CREATE INDEX IF NOT EXISTS idx_matches_comp ON matches(competition_id, kickoff);
                CREATE TABLE IF NOT EXISTS players (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    nickname TEXT NOT NULL UNIQUE COLLATE NOCASE,
                    password_hash TEXT NOT NULL,
                    email TEXT NULL,
                    active INTEGER NOT NULL DEFAULT 1,
                    created TEXT NOT NULL,
                    last_login TEXT NULL,
                    invite_code TEXT NULL
                );
                CREATE TABLE IF NOT EXISTS invites (
                    code TEXT PRIMARY KEY,
                    note TEXT NOT NULL DEFAULT '',
                    max_uses INTEGER NOT NULL DEFAULT 1,
                    uses INTEGER NOT NULL DEFAULT 0,
                    expires TEXT NULL,
                    revoked INTEGER NOT NULL DEFAULT 0,
                    created TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS tips (
                    player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
                    match_id INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
                    home_goals INTEGER NOT NULL,
                    away_goals INTEGER NOT NULL,
                    updated TEXT NOT NULL,
                    PRIMARY KEY (player_id, match_id)
                );
                CREATE INDEX IF NOT EXISTS idx_tips_match ON tips(match_id);
                CREATE TABLE IF NOT EXISTS bonus_tips (
                    player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
                    competition_id INTEGER NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
                    answer TEXT NOT NULL,
                    updated TEXT NOT NULL,
                    PRIMARY KEY (player_id, competition_id)
                );
                CREATE TABLE IF NOT EXISTS attempts (
                    k TEXT PRIMARY KEY,
                    count INTEGER NOT NULL DEFAULT 0,
                    first INTEGER NOT NULL,
                    last INTEGER NOT NULL,
                    locked_until INTEGER NOT NULL DEFAULT 0
                );
            SQL);
            $ins = $pdo->prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
            foreach (TIPP_DEFAULT_SETTINGS as $k => $v) {
                $ins->execute([$k, (string)$v]);
            }
            $pdo->exec('PRAGMA user_version = 1');
        }
        if ((int)$pdo->query('PRAGMA user_version')->fetchColumn() < 2) {
            // Automatischer Abruf (OpenLigaDB) – auch für bestehende Datenbanken (idempotent)
            add_columns($pdo, 'competitions', [
                'source' => 'TEXT NULL',                       // NULL = von Hand, 'openligadb'
                'source_league' => 'TEXT NULL',                // z. B. bl1
                'source_season' => 'INTEGER NULL',             // Startjahr, z. B. 2026 für 2026/27
                'sync_window_days' => 'INTEGER NOT NULL DEFAULT 14',
                'last_sync' => 'TEXT NULL',
                'last_sync_status' => 'TEXT NULL',
            ]);
            add_columns($pdo, 'matches', [
                'external_id' => 'TEXT NULL',                  // matchID bei OpenLigaDB
                'external_group' => 'INTEGER NULL',            // intern: groupOrderID (Spieltag) für gezielten Ergebnis-Abruf
                'result_source' => 'TEXT NULL',                // 'manual' | 'auto' | NULL
            ]);
            $pdo->exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_matches_ext ON matches(competition_id, external_id) WHERE external_id IS NOT NULL');
            $pdo->exec("UPDATE matches SET result_source = 'manual' WHERE home_goals IS NOT NULL AND result_source IS NULL");
            $pdo->exec('PRAGMA user_version = 2');
        }
        $pdo->exec('COMMIT');
    } catch (Throwable $e) {
        $pdo->exec('ROLLBACK');
        throw $e;
    }
}

/** Spalten ergänzen, falls sie fehlen (PRAGMA table_info + ALTER TABLE ADD COLUMN) */
function add_columns(PDO $pdo, string $table, array $cols): void
{
    $have = [];
    foreach ($pdo->query('PRAGMA table_info(' . $table . ')')->fetchAll() as $c) {
        $have[strtolower((string)$c['name'])] = true;
    }
    foreach ($cols as $name => $def) {
        if (!isset($have[strtolower($name)])) {
            $pdo->exec("ALTER TABLE $table ADD COLUMN $name $def");
        }
    }
}

/** Funktion in einer Schreib-Transaktion ausführen */
function tx(callable $fn): mixed
{
    $pdo = db();
    $pdo->exec('BEGIN IMMEDIATE');
    try {
        $r = $fn($pdo);
        $pdo->exec('COMMIT');
        return $r;
    } catch (Throwable $e) {
        $pdo->exec('ROLLBACK');
        throw $e;
    }
}

function q(string $sql, array $params = []): PDOStatement
{
    $st = db()->prepare($sql);
    $st->execute($params);
    return $st;
}

function placeholders(array $list): string
{
    return implode(',', array_fill(0, count($list), '?'));
}

function settings(): array
{
    $s = TIPP_DEFAULT_SETTINGS;
    foreach (q('SELECT key, value FROM settings')->fetchAll() as $r) {
        if (array_key_exists($r['key'], $s)) {
            $s[$r['key']] = (int)$r['value'];
        }
    }
    return $s;
}

/* ============================================================ Punkte-Logik */

/**
 * Punkte für einen Tipp. Rückgabe ['points'=>int, 'kind'=>'exact'|'diff'|'tendency'|'miss'] oder null,
 * wenn Tipp oder Ergebnis fehlt. Identisch zu TippAPI.scoreTip() im JS-Client.
 */
function score_tip(?int $th, ?int $ta, ?int $rh, ?int $ra, array $s): ?array
{
    if ($th === null || $ta === null || $rh === null || $ra === null) {
        return null;
    }
    if ($th === $rh && $ta === $ra) {
        return ['points' => (int)$s['points_exact'], 'kind' => 'exact'];
    }
    $tt = $th <=> $ta;
    $rt = $rh <=> $ra;
    if ($tt !== $rt) {
        return ['points' => 0, 'kind' => 'miss'];
    }
    if ($rt !== 0 && ($th - $ta) === ($rh - $ra)) {
        return ['points' => (int)$s['points_diff'], 'kind' => 'diff'];
    }
    return ['points' => (int)$s['points_tendency'], 'kind' => 'tendency'];
}

function int_or_null(mixed $v): ?int
{
    return $v === null ? null : (int)$v;
}

/**
 * Punkte je Spieler zusammenzählen.
 * $players: [id => nickname], $matches: Spiele MIT Ergebnis, $tips: Zeilen (player_id, match_id, home_goals, away_goals),
 * $comps: Wettbewerbe (für Bonus), $bonusTips: Zeilen (player_id, competition_id, answer).
 */
function tally(array $players, array $matches, array $tips, array $comps, array $bonusTips, array $s, bool $withBonus = true): array
{
    $t = [];
    foreach ($players as $pid => $_) {
        $t[$pid] = ['points' => 0, 'match_points' => 0, 'bonus' => 0, 'exact' => 0, 'diff' => 0, 'tendency' => 0, 'miss' => 0, 'tips' => 0];
    }
    $byId = [];
    foreach ($matches as $m) {
        if ($m['home_goals'] !== null && $m['away_goals'] !== null) {
            $byId[(int)$m['id']] = $m;
        }
    }
    foreach ($tips as $tp) {
        $pid = (int)$tp['player_id'];
        $m = $byId[(int)$tp['match_id']] ?? null;
        if ($m === null || !isset($t[$pid])) {
            continue;
        }
        $sc = score_tip((int)$tp['home_goals'], (int)$tp['away_goals'], (int)$m['home_goals'], (int)$m['away_goals'], $s);
        $t[$pid]['tips']++;
        $t[$pid][$sc['kind']]++;
        $t[$pid]['match_points'] += $sc['points'];
    }
    if ($withBonus) {
        $answers = [];
        foreach ($comps as $c) {
            if (($c['bonus_question'] ?? null) !== null && trim((string)$c['bonus_question']) !== '' && bonus_norm($c['bonus_answer'] ?? null) !== '') {
                $answers[(int)$c['id']] = [bonus_norm($c['bonus_answer']), (int)$c['bonus_points']];
            }
        }
        foreach ($bonusTips as $b) {
            $pid = (int)$b['player_id'];
            $a = $answers[(int)$b['competition_id']] ?? null;
            if ($a !== null && isset($t[$pid]) && bonus_norm($b['answer']) === $a[0]) {
                $t[$pid]['bonus'] += $a[1];
            }
        }
    }
    foreach ($t as $pid => $row) {
        $t[$pid]['points'] = $row['match_points'] + $row['bonus'];
    }
    return $t;
}

/** Sortierte Ranglisten-Zeilen mit Rang (Gleichstand = gleicher Rang) */
function rank_rows(array $players, array $tally, ?int $meId): array
{
    $rows = [];
    foreach ($players as $pid => $nick) {
        $x = $tally[$pid];
        $rows[] = [
            'rank' => 0, 'nickname' => (string)$nick, 'points' => $x['points'], 'exact' => $x['exact'],
            'diff' => $x['diff'], 'tendency' => $x['tendency'], 'tips' => $x['tips'], 'bonus' => $x['bonus'],
            'is_me' => $meId !== null && $pid === $meId, '_id' => $pid,
        ];
    }
    usort($rows, fn($a, $b) => [$b['points'], $b['exact'], $b['diff']] <=> [$a['points'], $a['exact'], $a['diff']]
        ?: strcmp(lower($a['nickname']), lower($b['nickname'])));
    $prev = null;
    foreach ($rows as $i => &$r) {
        $key = [$r['points'], $r['exact'], $r['diff']];
        $r['rank'] = ($prev !== null && $prev[0] === $key) ? $prev[1] : $i + 1;
        $prev = [$key, $r['rank']];
    }
    unset($r);
    return $rows;
}

/** Daten für Rangliste/Statistik laden: Wettbewerb-Filter oder alle Wettbewerbe */
function load_scope(?int $compId, bool $onlyActivePlayers = true): array
{
    $comps = $compId !== null
        ? q('SELECT * FROM competitions WHERE id = ?', [$compId])->fetchAll()
        : q('SELECT * FROM competitions ORDER BY sort, id')->fetchAll();
    $players = [];
    foreach (q('SELECT id, nickname FROM players' . ($onlyActivePlayers ? ' WHERE active = 1' : '') . ' ORDER BY id')->fetchAll() as $p) {
        $players[(int)$p['id']] = (string)$p['nickname'];
    }
    $compIds = array_map(fn($c) => (int)$c['id'], $comps);
    $matches = $tips = $bonus = [];
    if ($compIds) {
        $ph = placeholders($compIds);
        $matches = q("SELECT * FROM matches WHERE competition_id IN ($ph) ORDER BY kickoff, id", $compIds)->fetchAll();
        $tips = q("SELECT t.player_id, t.match_id, t.home_goals, t.away_goals FROM tips t JOIN matches m ON m.id = t.match_id WHERE m.competition_id IN ($ph)", $compIds)->fetchAll();
        $bonus = q("SELECT player_id, competition_id, answer FROM bonus_tips WHERE competition_id IN ($ph)", $compIds)->fetchAll();
    }
    $tips = array_values(array_filter($tips, fn($t) => isset($players[(int)$t['player_id']])));
    $bonus = array_values(array_filter($bonus, fn($b) => isset($players[(int)$b['player_id']])));
    return compact('comps', 'players', 'matches', 'tips', 'bonus');
}

function scored_matches(array $matches): array
{
    return array_values(array_filter($matches, fn($m) => $m['home_goals'] !== null && $m['away_goals'] !== null));
}

function leaderboard(?int $compId, ?int $meId): array
{
    $sc = load_scope($compId);
    $tally = tally($sc['players'], scored_matches($sc['matches']), $sc['tips'], $sc['comps'], $sc['bonus'], settings());
    $rows = rank_rows($sc['players'], $tally, $meId);
    $meRank = null;
    foreach ($rows as &$r) {
        if ($r['is_me']) {
            $meRank = $r['rank'];
        }
        unset($r['_id']);
    }
    unset($r);
    return ['rows' => $rows, 'me_rank' => $meRank];
}

function stats(?int $compId, int $meId): array
{
    $s = settings();
    $sc = load_scope($compId);
    $players = $sc['players'];
    $scored = scored_matches($sc['matches']);
    $tally = tally($players, $scored, $sc['tips'], $sc['comps'], $sc['bonus'], $s);
    $me = $tally[$meId] ?? ['points' => 0, 'match_points' => 0, 'bonus' => 0, 'exact' => 0, 'diff' => 0, 'tendency' => 0, 'miss' => 0, 'tips' => 0];

    $myTips = array_values(array_filter($sc['tips'], fn($t) => (int)$t['player_id'] === $meId));
    $allMatchPoints = 0;
    $allScored = 0;
    foreach ($tally as $x) {
        $allMatchPoints += $x['match_points'];
        $allScored += $x['tips'];
    }

    // Runden (Wettbewerb + Runde) chronologisch nach erstem Anstoß
    $compNames = [];
    foreach ($sc['comps'] as $c) {
        $compNames[(int)$c['id']] = (string)$c['name'];
    }
    $groups = [];
    foreach ($scored as $m) {
        $key = (int)$m['competition_id'] . '|' . (string)$m['round'];
        $groups[$key] ??= ['cid' => (int)$m['competition_id'], 'round' => (string)$m['round'], 'matches' => []];
        $groups[$key]['matches'][] = $m; // $scored ist nach Anstoß sortiert → erste Einfügung = frühester Anstoß
    }
    $groups = array_values($groups);
    $multiComp = count(array_unique(array_map(fn($g) => $g['cid'], $groups))) > 1;

    $byRound = [];
    $rankHistory = [];
    $cumMatches = [];
    $best = null;
    foreach ($groups as $g) {
        $label = ($g['round'] !== '' ? $g['round'] : 'Ohne Runde');
        if ($multiComp) {
            $label = ($compNames[$g['cid']] ?? '') . ' · ' . $label;
        }
        $ids = [];
        foreach ($g['matches'] as $m) {
            $ids[(int)$m['id']] = true;
        }
        $gTips = array_values(array_filter($sc['tips'], fn($t) => isset($ids[(int)$t['match_id']])));
        $gt = tally($players, $g['matches'], $gTips, [], [], $s, false);
        $sum = 0;
        $n = 0;
        foreach ($gt as $x) {
            if ($x['tips'] > 0) {
                $sum += $x['match_points'];
                $n++;
            }
        }
        $mine = $gt[$meId]['match_points'] ?? 0;
        $byRound[] = ['round' => $label, 'points' => $mine, 'avg_all' => ratio($sum, $n)];
        if ($best === null || $mine > $best['points']) {
            $best = ['round' => $label, 'points' => $mine];
        }
        array_push($cumMatches, ...$g['matches']);
        $ct = tally($players, $cumMatches, $sc['tips'], [], [], $s, false);
        $rank = null;
        foreach (rank_rows($players, $ct, $meId) as $r) {
            if ($r['is_me']) {
                $rank = $r['rank'];
            }
        }
        $rankHistory[] = ['label' => $label, 'rank' => $rank];
    }

    $fav = [];
    foreach ($myTips as $t) {
        $k = (int)$t['home_goals'] . ':' . (int)$t['away_goals'];
        $fav[$k] = ($fav[$k] ?? 0) + 1;
    }
    $favorite = null;
    foreach ($fav as $k => $c) {
        $k = (string)$k;
        if ($favorite === null || $c > $fav[$favorite] || ($c === $fav[$favorite] && strcmp($k, $favorite) < 0)) {
            $favorite = $k;
        }
    }

    $hits = $me['exact'] + $me['diff'] + $me['tendency'];
    return [
        'points' => $me['points'],
        'bonus' => $me['bonus'],
        'tips' => count($myTips),
        'scored_tips' => $me['tips'],
        'exact' => $me['exact'],
        'diff' => $me['diff'],
        'tendency' => $me['tendency'],
        'miss' => $me['miss'],
        'hit_rate' => ratio($hits * 100, $me['tips'], 1),
        'avg_points' => ratio($me['match_points'], $me['tips']),
        'avg_points_all' => ratio($allMatchPoints, $allScored),
        'best_round' => $best,
        'by_round' => $byRound,
        'favorite_tip' => $favorite,
        'rank_history' => $rankHistory,
    ];
}

/** Community-Quote eines Spiels (nur nach Tippschluss anzeigen) */
function tendency(array $tips): ?array
{
    $n = count($tips);
    if ($n === 0) {
        return null;
    }
    $h = $d = $a = 0;
    $res = [];
    foreach ($tips as $t) {
        $th = (int)$t['home_goals'];
        $ta = (int)$t['away_goals'];
        if ($th > $ta) $h++; elseif ($th === $ta) $d++; else $a++;
        $k = "$th:$ta";
        $res[$k] = ($res[$k] ?? 0) + 1;
    }
    $top = null;
    foreach ($res as $k => $c) {
        $k = (string)$k;
        if ($top === null || $c > $res[$top] || ($c === $res[$top] && strcmp($k, $top) < 0)) {
            $top = $k;
        }
    }
    return ['home' => ratio($h * 100, $n, 0), 'draw' => ratio($d * 100, $n, 0), 'away' => ratio($a * 100, $n, 0), 'top' => $top];
}

/** Gewertete Spiele nach Runde (Wettbewerb + round) gruppieren – chronologisch, Beschriftung wie in stats() */
function round_groups(array $scored, array $comps): array
{
    $compNames = [];
    foreach ($comps as $c) {
        $compNames[(int)$c['id']] = (string)$c['name'];
    }
    $groups = [];
    foreach ($scored as $m) {
        $key = (int)$m['competition_id'] . '|' . (string)$m['round'];
        $groups[$key] ??= ['cid' => (int)$m['competition_id'], 'round' => (string)$m['round'], 'matches' => []];
        $groups[$key]['matches'][] = $m;
    }
    $groups = array_values($groups);
    $multiComp = count(array_unique(array_map(fn($g) => $g['cid'], $groups))) > 1;
    foreach ($groups as &$g) {
        $g['label'] = ($g['round'] !== '' ? $g['round'] : 'Ohne Runde');
        if ($multiComp) {
            $g['label'] = ($compNames[$g['cid']] ?? '') . ' · ' . $g['label'];
        }
    }
    unset($g);
    return $groups;
}

/** Häufigstes Ergebnis einer Tipp-Liste (Gleichstand: alphabetisch kleinstes) → ['tip' => '2:1', 'count' => n] | null */
function top_tip(array $tips): ?array
{
    $res = [];
    foreach ($tips as $t) {
        $k = (int)$t['home_goals'] . ':' . (int)$t['away_goals'];
        $res[$k] = ($res[$k] ?? 0) + 1;
    }
    $top = null;
    foreach ($res as $k => $c) {
        $k = (string)$k;
        if ($top === null || $c > $res[$top] || ($c === $res[$top] && strcmp($k, $top) < 0)) {
            $top = $k;
        }
    }
    return $top === null ? null : ['tip' => $top, 'count' => $res[$top]];
}

/** Stammtisch-Statistik für die Wirt-Ansicht (alle aktiven Spieler zusammen) */
function owner_stats(?int $compId): array
{
    $s = settings();
    $sc = load_scope($compId);
    $players = $sc['players'];
    $scored = scored_matches($sc['matches']);
    $tally = tally($players, $scored, $sc['tips'], $sc['comps'], $sc['bonus'], $s);
    $sum = ['points' => 0, 'match_points' => 0, 'bonus' => 0, 'exact' => 0, 'diff' => 0, 'tendency' => 0, 'miss' => 0, 'tips' => 0];
    foreach ($tally as $x) {
        foreach ($sum as $k => $_) {
            $sum[$k] += $x[$k];
        }
    }
    $tippers = [];
    foreach ($sc['tips'] as $t) {
        $tippers[(int)$t['player_id']] = true;
    }
    $byRound = [];
    foreach (round_groups($scored, $sc['comps']) as $g) {
        $ids = [];
        foreach ($g['matches'] as $m) {
            $ids[(int)$m['id']] = true;
        }
        $gTips = array_values(array_filter($sc['tips'], fn($t) => isset($ids[(int)$t['match_id']])));
        $gt = tally($players, $g['matches'], $gTips, [], [], $s, false);
        $pts = 0;
        $n = 0;
        $max = 0;
        foreach ($gt as $x) {
            if ($x['tips'] > 0) {
                $pts += $x['match_points'];
                $n++;
                $max = max($max, $x['match_points']);
            }
        }
        $best = [];
        if ($max > 0) {
            foreach ($gt as $pid => $x) {
                if ($x['tips'] > 0 && $x['match_points'] === $max) {
                    $best[] = (string)$players[$pid];
                }
            }
            usort($best, fn($a, $b) => strcmp(lower($a), lower($b)));
        }
        $byRound[] = [
            'round' => $g['label'],
            'matches' => count($g['matches']),
            'tips' => count($gTips),
            'avg_points' => ratio($pts, $n),
            'best' => $max > 0 ? ['nicknames' => $best, 'points' => $max] : null,
        ];
    }
    $hits = $sum['exact'] + $sum['diff'] + $sum['tendency'];
    return [
        'players' => count($players),
        'tippers' => count($tippers),
        'matches' => count($sc['matches']),
        'scored_matches' => count($scored),
        'tips' => count($sc['tips']),
        'scored_tips' => $sum['tips'],
        'exact' => $sum['exact'],
        'diff' => $sum['diff'],
        'tendency' => $sum['tendency'],
        'miss' => $sum['miss'],
        'hit_rate' => ratio($hits * 100, $sum['tips'], 1),
        'points' => $sum['points'],
        'bonus' => $sum['bonus'],
        'avg_points_tip' => ratio($sum['match_points'], $sum['tips']),
        'avg_points_player' => ratio($sum['points'], count($players)),
        'favorite_tip' => top_tip($sc['tips']),
        'by_round' => $byRound,
    ];
}

function first_kickoffs(): array
{
    $out = [];
    foreach (q('SELECT competition_id, MIN(kickoff) AS k FROM matches GROUP BY competition_id')->fetchAll() as $r) {
        $out[(int)$r['competition_id']] = (string)$r['k'];
    }
    return $out;
}

function bonus_locked(int $compId, array $firstKick): bool
{
    return isset($firstKick[$compId]) && now_min() >= $firstKick[$compId];
}

function comp_out(array $c, array $firstKick): array
{
    return [
        'id' => (int)$c['id'],
        'name' => (string)$c['name'],
        'active' => (bool)$c['active'],
        'sort' => (int)$c['sort'],
        'bonus_question' => $c['bonus_question'] !== null ? (string)$c['bonus_question'] : null,
        'bonus_answer' => $c['bonus_answer'] !== null ? (string)$c['bonus_answer'] : null,
        'bonus_points' => (int)$c['bonus_points'],
        'bonus_locked' => bonus_locked((int)$c['id'], $firstKick),
        'source' => ($c['source'] ?? null) !== null ? (string)$c['source'] : null,
    ];
}

/** Wettbewerb für die Verwaltung: zusätzlich die Einstellungen des automatischen Abrufs */
function comp_admin_out(array $c, array $firstKick): array
{
    return comp_out($c, $firstKick) + [
        'source_league' => ($c['source_league'] ?? null) !== null ? (string)$c['source_league'] : null,
        'source_season' => ($c['source_season'] ?? null) !== null ? (int)$c['source_season'] : null,
        'sync_window_days' => (int)($c['sync_window_days'] ?? 14),
        'last_sync' => ($c['last_sync'] ?? null) !== null ? (string)$c['last_sync'] : null,
        'last_sync_status' => ($c['last_sync_status'] ?? null) !== null ? (string)$c['last_sync_status'] : null,
    ];
}

function match_base(array $m): array
{
    return [
        'id' => (int)$m['id'],
        'competition_id' => (int)$m['competition_id'],
        'round' => (string)$m['round'],
        'kickoff' => (string)$m['kickoff'],
        'home' => (string)$m['home'],
        'away' => (string)$m['away'],
        'home_goals' => int_or_null($m['home_goals']),
        'away_goals' => int_or_null($m['away_goals']),
        'locked' => now_min() >= (string)$m['kickoff'],
        'result_source' => ($m['result_source'] ?? null) !== null ? (string)$m['result_source'] : null,
    ];
}

/* ============================================================ Brute-Force */

function ip_hash(): string
{
    return substr(hash('sha256', 'hbs-tipp|' . (string)($_SERVER['REMOTE_ADDR'] ?? 'unknown')), 0, 32);
}

function bf_key(string $kind, string $extra = ''): string
{
    return $kind . ':' . substr(hash('sha256', ip_hash() . '|' . $extra), 0, 32);
}

/** Restliche Sperrzeit in Sekunden (0 = frei) */
function bf_locked(array $keys): int
{
    $now = time();
    if (random_int(1, 50) === 1) {
        q('DELETE FROM attempts WHERE last < ? AND locked_until < ?', [$now - 86400, $now]);
    }
    $max = 0;
    foreach ($keys as $k) {
        $until = (int)(q('SELECT locked_until FROM attempts WHERE k = ?', [$k])->fetchColumn() ?: 0);
        $max = max($max, $until - $now);
    }
    return max(0, $max);
}

/** Fehlversuch zählen; gibt true zurück, wenn dadurch gesperrt wurde */
function bf_fail(string $key, int $maxFails): bool
{
    $now = time();
    return (bool)tx(function (PDO $pdo) use ($key, $maxFails, $now) {
        $st = $pdo->prepare('SELECT count, first FROM attempts WHERE k = ?');
        $st->execute([$key]);
        $e = $st->fetch() ?: ['count' => 0, 'first' => $now];
        if ($now - (int)$e['first'] > TIPP_BF_WINDOW) {
            $e = ['count' => 0, 'first' => $now];
        }
        $count = (int)$e['count'] + 1;
        $first = (int)$e['first'];
        $locked = 0;
        if ($count >= $maxFails) {
            $locked = $now + TIPP_BF_LOCK;
            $count = 0;
            $first = $now;
        }
        $pdo->prepare('INSERT INTO attempts (k, count, first, last, locked_until) VALUES (?, ?, ?, ?, ?)
                       ON CONFLICT(k) DO UPDATE SET count = excluded.count, first = excluded.first, last = excluded.last,
                       locked_until = MAX(attempts.locked_until, excluded.locked_until)')
            ->execute([$key, $count, $first, $now, $locked]);
        return $locked > 0;
    });
}

function bf_clear(string $key): void
{
    q('DELETE FROM attempts WHERE k = ?', [$key]);
}

function fail_locked(int $seconds): never
{
    header('Retry-After: ' . $seconds);
    fail('Zu viele Fehlversuche. Bitte in ' . max(1, (int)ceil($seconds / 60)) . ' Minute(n) erneut versuchen.', 429, ['retryAfter' => $seconds]);
}

/* ======================================================== Spieler-Session */

function cookie_path(): string
{
    return rtrim(str_replace('\\', '/', dirname((string)($_SERVER['SCRIPT_NAME'] ?? '/cms/tipp-api.php'))), '/') . '/';
}

function valid_sid(mixed $v): bool
{
    return is_string($v) && preg_match('/^[A-Za-z0-9,\-]{22,256}$/', $v) === 1;
}

/** Laufende Session (egal welche) speichern und schließen, damit eine andere geöffnet werden kann. */
function session_close_any(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) {
        session_write_close();
    }
}

/**
 * Spieler-Session öffnen. Ohne $create nur, wenn bereits ein HBS_TIPP-Cookie existiert
 * (anonyme Besucher bekommen kein Cookie).
 */
function tipp_session_open(bool $create): bool
{
    if (session_status() === PHP_SESSION_ACTIVE) {
        if (session_name() === TIPP_SESSION_NAME) {
            return true;
        }
        session_write_close();
    }
    $cookie = $_COOKIE[TIPP_SESSION_NAME] ?? null;
    if (!$create && !valid_sid($cookie)) {
        return false;
    }
    $lifetime = TIPP_SESSION_DAYS * 86400;
    $dir = TIPP_DATA_DIR . '/tipp-sessions';
    if (ensure_dir($dir) && is_writable($dir)) {
        session_save_path($dir);
        ini_set('session.gc_maxlifetime', (string)$lifetime);
        ini_set('session.gc_probability', '1');
        ini_set('session.gc_divisor', '100');
    }
    ini_set('session.use_strict_mode', '1');
    ini_set('session.use_only_cookies', '1');
    ini_set('session.use_trans_sid', '0');
    ini_set('session.cookie_httponly', '1');
    session_name(TIPP_SESSION_NAME);
    // Falls vorher eine andere Session offen war: deren ID nicht übernehmen
    session_id(valid_sid($cookie) ? $cookie : session_create_id());
    session_set_cookie_params([
        'lifetime' => $lifetime,
        'path' => cookie_path(),
        'secure' => is_https(),
        'httponly' => true,
        'samesite' => 'Strict',
    ]);
    session_start();
    return true;
}

function pw_stamp(string $hash): string
{
    return substr(hash('sha256', $hash), 0, 16);
}

/** Angemeldeten Spieler ermitteln (prüft Konto aktiv + Passwort unverändert) */
function current_player(): ?array
{
    static $cache = false;
    if ($cache !== false) {
        return $cache;
    }
    if (!tipp_session_open(false)) {
        return $cache = null;
    }
    $pid = (int)($_SESSION['pid'] ?? 0);
    $p = $pid > 0 && time() - (int)($_SESSION['last'] ?? 0) <= TIPP_SESSION_DAYS * 86400
        ? q('SELECT id, nickname, email, active, password_hash FROM players WHERE id = ?', [$pid])->fetch()
        : false;
    if (!$p || !(int)$p['active'] || !hash_equals(pw_stamp((string)$p['password_hash']), (string)($_SESSION['stamp'] ?? ''))) {
        // abgelaufen, Konto gelöscht/gesperrt, Passwort geändert oder unbekanntes Cookie → Cookie entfernen
        end_player_session();
        return $cache = null;
    }
    $now = time();
    if ($now - (int)($_SESSION['refreshed'] ?? 0) > 86400) {
        // Cookie-Laufzeit verlängern (gleitend), höchstens einmal pro Tag
        $prm = session_get_cookie_params();
        setcookie(session_name(), session_id(), ['expires' => $now + TIPP_SESSION_DAYS * 86400, 'path' => $prm['path'], 'secure' => $prm['secure'], 'httponly' => true, 'samesite' => 'Strict']);
        $_SESSION['refreshed'] = $now;
    }
    $_SESSION['last'] = $now;
    return $cache = ['id' => (int)$p['id'], 'nickname' => (string)$p['nickname'], 'email' => $p['email'] !== null ? (string)$p['email'] : null, 'password_hash' => (string)$p['password_hash']];
}

function check_csrf(string $expected): void
{
    $sent = (string)($_SERVER['HTTP_X_CSRF_TOKEN'] ?? '');
    if ($expected === '' || $sent === '' || !hash_equals($expected, $sent)) {
        fail('Sicherheits-Token ungültig. Bitte Seite neu laden.', 403, ['csrfInvalid' => true]);
    }
}

function require_player(): array
{
    $p = current_player();
    if ($p === null) {
        fail('Bitte melde dich an.', 401, ['loggedIn' => false]);
    }
    if (method() === 'POST') {
        check_csrf((string)($_SESSION['csrf'] ?? ''));
    }
    return $p;
}

function login_session(array $player): void
{
    tipp_session_open(true);
    session_regenerate_id(true);
    $_SESSION = [
        'pid' => (int)$player['id'],
        'stamp' => pw_stamp((string)$player['password_hash']),
        'csrf' => bin2hex(random_bytes(32)),
        'since' => time(),
        'last' => time(),
        'refreshed' => time(),
    ];
}

function end_player_session(): void
{
    if (session_status() === PHP_SESSION_ACTIVE && session_name() === TIPP_SESSION_NAME) {
        $_SESSION = [];
        $p = session_get_cookie_params();
        setcookie(session_name(), '', ['expires' => time() - 3600, 'path' => $p['path'], 'secure' => $p['secure'], 'httponly' => true, 'samesite' => 'Strict']);
        session_destroy();
    }
}

function status_payload(?array $p): array
{
    return [
        'api' => 'hbs-tipp',
        'player' => $p ? ['id' => $p['id'], 'nickname' => $p['nickname'], 'email' => $p['email']] : null,
        'csrf' => $p ? (string)($_SESSION['csrf'] ?? '') : null,
        'settings' => settings(),
        'serverTime' => now_full(),
    ];
}

/**
 * status/login/register: wie status_payload(), zusätzlich admin = Verwaltung (CMS) angemeldet → Wirt-Ansicht möglich.
 * Die CMS-Sitzung wird dabei nur angesehen, nicht verlängert. Schließt die Spieler-Session.
 */
function status_with_admin(?array $p): array
{
    $payload = status_payload($p);
    session_close_any();
    $payload['admin'] = cms_admin_state(false)['auth'];
    return $payload;
}

/* ========================================================= Admin (CMS-Session) */

/**
 * Liest die CMS-Session genau wie cms/api.php (Name HBSCMS, Ordner cms/data/sessions, Cookie-Pfad /cms/)
 * und schließt sie sofort wieder. Gibt ['auth' => bool, 'csrf' => string] zurück.
 */
function cms_admin_state(bool $touch = true): array
{
    static $state = null;
    if ($state !== null) {
        return $state;
    }
    $cookie = $_COOKIE[TIPP_CMS_SESSION_NAME] ?? null;
    if (!valid_sid($cookie)) {
        return $state = ['auth' => false, 'csrf' => ''];
    }
    session_close_any();
    $cfg = [];
    $cfgFile = TIPP_CMS_DIR . '/config.php';
    if (is_file($cfgFile)) {
        $c = require $cfgFile;
        $cfg = is_array($c) ? $c : [];
    }
    $idle = max(10, (int)($cfg['session_idle_minutes'] ?? 240)) * 60;
    $dir = TIPP_DATA_DIR . '/sessions';
    if (ensure_dir($dir) && is_writable($dir)) {
        session_save_path($dir);
        ini_set('session.gc_maxlifetime', (string)$idle);
        ini_set('session.gc_probability', '1');
        ini_set('session.gc_divisor', '50');
    }
    ini_set('session.use_strict_mode', '1');
    ini_set('session.use_only_cookies', '1');
    ini_set('session.use_trans_sid', '0');
    ini_set('session.cookie_httponly', '1');
    session_name(TIPP_CMS_SESSION_NAME);
    session_id($cookie);
    session_set_cookie_params([
        'lifetime' => 0,
        'path' => cookie_path(),
        'secure' => is_https(),
        'httponly' => true,
        'samesite' => 'Strict',
    ]);
    session_start();
    $auth = !empty($_SESSION['auth']) && $_SESSION['auth'] === true && (time() - (int)($_SESSION['last'] ?? 0)) <= $idle;
    $csrf = (string)($_SESSION['csrf'] ?? '');
    if ($auth && $touch) {
        $_SESSION['last'] = time(); // Aktivität im Tippspiel-Reiter / in der Wirt-Ansicht hält die Verwaltung angemeldet
        session_write_close();
    } else {
        session_abort(); // nichts verändern – cms/api.php räumt abgelaufene Sitzungen selbst auf (status: nur nachsehen)
    }
    $_SESSION = [];
    return $state = ['auth' => $auth, 'csrf' => $auth ? $csrf : ''];
}

function require_admin(): void
{
    $st = cms_admin_state();
    if (!$st['auth']) {
        fail('Nicht angemeldet oder Sitzung abgelaufen. Bitte in der Verwaltung erneut anmelden.', 401, ['loggedIn' => false]);
    }
    if (method() === 'POST') {
        check_csrf($st['csrf']);
    }
}

/**
 * Lese-Aktionen (matches, leaderboard, player_tips): Eine Spieler-Session hat Vorrang (normale App).
 * Ohne Spieler – oder ausdrücklich mit view=owner – reicht eine gültige CMS-Session: „Wirt-Ansicht“, NUR lesen.
 * Schreibende Aktionen (tip, bonus_tip, …) verlangen weiterhin require_player().
 * → ['player' => array|null, 'owner' => bool], sonst 401.
 */
function require_reader(): array
{
    $forceOwner = (string)($_GET['view'] ?? '') === 'owner';
    if (!$forceOwner) {
        $p = current_player();
        if ($p !== null) {
            return ['player' => $p, 'owner' => false];
        }
    }
    if (cms_admin_state()['auth']) {
        return ['player' => null, 'owner' => true];
    }
    if ($forceOwner) {
        fail('Die Wirt-Ansicht braucht eine Anmeldung in der Verwaltung.', 401, ['loggedIn' => false, 'owner' => true]);
    }
    fail('Bitte melde dich an.', 401, ['loggedIn' => false]);
}

/* ============================================================== Sonstiges */

function require_method(string $m): void
{
    if (method() !== $m) {
        header('Allow: ' . $m);
        fail('Nur ' . $m . ' erlaubt.', 405);
    }
}

/** Schutz gegen fremde Seiten (zusätzlich zu SameSite=Strict und JSON-Pflicht) */
function check_origin(): void
{
    $origin = (string)($_SERVER['HTTP_ORIGIN'] ?? '');
    if ($origin !== '') {
        $host = parse_url($origin, PHP_URL_HOST);
        $port = parse_url($origin, PHP_URL_PORT);
        $o = is_string($host) ? strtolower($host . ($port ? ':' . $port : '')) : 'null';
        $h = strtolower((string)($_SERVER['HTTP_HOST'] ?? ''));
        $hNoPort = (string)preg_replace('/:(80|443)$/', '', $h);
        if ($o !== $h && $o !== $hNoPort) {
            fail('Anfrage von einer fremden Seite abgelehnt.', 403);
        }
    }
    if (strtolower((string)($_SERVER['HTTP_SEC_FETCH_SITE'] ?? '')) === 'cross-site') {
        fail('Anfrage von einer fremden Seite abgelehnt.', 403);
    }
}

function find_player_by_nick(string $nick): ?array
{
    $p = q('SELECT * FROM players WHERE nickname = ? COLLATE NOCASE', [$nick])->fetch();
    if ($p) {
        return $p;
    }
    $key = lower($nick);
    foreach (q('SELECT id, nickname FROM players')->fetchAll() as $r) { // Umlaute (Ü/ü) ohne mbstring-Collation
        if (lower((string)$r['nickname']) === $key) {
            return q('SELECT * FROM players WHERE id = ?', [(int)$r['id']])->fetch() ?: null;
        }
    }
    return null;
}

function invite_valid(array $inv): bool
{
    if ((int)$inv['revoked'] || (int)$inv['uses'] >= (int)$inv['max_uses']) {
        return false;
    }
    $exp = $inv['expires'];
    if ($exp === null || $exp === '') {
        return true;
    }
    return strlen((string)$exp) === 10 ? date('Y-m-d') <= $exp : now_min() < $exp;
}

function invite_out(array $i): array
{
    return [
        'code' => (string)$i['code'],
        'note' => (string)$i['note'],
        'max_uses' => (int)$i['max_uses'],
        'uses' => (int)$i['uses'],
        'expires' => $i['expires'] !== null ? (string)$i['expires'] : null,
        'revoked' => (bool)$i['revoked'],
        'created' => (string)$i['created'],
        'valid' => invite_valid($i),
    ];
}

function competition_or_404(int $id): array
{
    $c = q('SELECT * FROM competitions WHERE id = ?', [$id])->fetch();
    if (!$c) {
        fail('Wettbewerb nicht gefunden.', 404);
    }
    return $c;
}

function match_or_404(int $id): array
{
    $m = q('SELECT * FROM matches WHERE id = ?', [$id])->fetch();
    if (!$m) {
        fail('Spiel nicht gefunden.', 404);
    }
    return $m;
}

function player_or_404(int $id): array
{
    $p = q('SELECT * FROM players WHERE id = ?', [$id])->fetch();
    if (!$p) {
        fail('Spieler nicht gefunden.', 404);
    }
    return $p;
}

function opt_comp_id(): ?int
{
    if (!present('competition_id')) {
        return null;
    }
    $id = v_id(inp('competition_id'), 'Wettbewerb');
    competition_or_404($id);
    return $id;
}

/* ============================================= Automatischer Abruf (OpenLigaDB) */
/*
 * Spielplan und Ergebnisse kommen von OpenLigaDB (https://www.openligadb.de, Community-gepflegt, ohne Schlüssel).
 * Anfragen gehen NUR an TIPP_OLDB_BASE; Liga-Kürzel und Saison werden streng geprüft und nur als Pfadteile
 * eingesetzt. Für Tests kann serverseitig (Konstante oder Umgebungsvariable HBS_OLDB_BASE) ein lokaler
 * Ersatz-Server eingestellt werden – nie über Eingaben einer Anfrage.
 * Gewertet wird das Ergebnis nach 90 Minuten (resultTypeID 2 „Endergebnis“) – Verlängerung/Elfmeterschießen zählen nicht.
 */

final class OldbException extends RuntimeException
{
}

function oldb_base(): string
{
    $b = defined('HBS_OLDB_BASE') ? (string)constant('HBS_OLDB_BASE') : (string)(getenv('HBS_OLDB_BASE') ?: '');
    $b = rtrim(trim($b), '/');
    return $b !== '' && preg_match('~^https?://[A-Za-z0-9.\-]+(:\d{1,5})?(/[A-Za-z0-9._\-/]*)?$~', $b) ? $b : TIPP_OLDB_BASE;
}

function v_league(mixed $v): string
{
    $l = is_string($v) ? trim($v) : '';
    if (!preg_match(TIPP_LEAGUE_RE, $l)) {
        fail('Liga-Kürzel: bitte nur Buchstaben, Ziffern, _ und - (z. B. bl1).', 400);
    }
    return $l;
}

function v_season(mixed $v): int
{
    $s = is_int($v) ? (string)$v : (is_string($v) ? trim($v) : '');
    if (!preg_match('/^\d{4}$/', $s) || (int)$s < 2000 || (int)$s > 2100) {
        fail('Saison: bitte das Startjahr angeben (z. B. 2026 für 2026/27).', 400);
    }
    return (int)$s;
}

function season_label(int $y): string
{
    return $y . '/' . str_pad((string)(($y + 1) % 100), 2, '0', STR_PAD_LEFT);
}

/** GET auf OpenLigaDB → dekodiertes JSON. Wirft OldbException mit deutscher Meldung. */
function oldb_get(string $path, int $timeout): mixed
{
    $url = oldb_base() . $path;
    $status = 0;
    $body = '';
    if (function_exists('curl_init')) {
        $ch = curl_init($url);
        $buf = '';
        curl_setopt_array($ch, [
            CURLOPT_WRITEFUNCTION => function ($ch, string $chunk) use (&$buf): int {
                $buf .= $chunk;
                return strlen($buf) > TIPP_OLDB_MAX_BYTES ? 0 : strlen($chunk);
            },
            CURLOPT_TIMEOUT => $timeout,
            CURLOPT_CONNECTTIMEOUT => min($timeout, 4),
            CURLOPT_FOLLOWLOCATION => false,
            CURLOPT_USERAGENT => TIPP_OLDB_UA,
            CURLOPT_HTTPHEADER => ['Accept: application/json'],
            CURLOPT_ENCODING => '',
            CURLOPT_PROTOCOLS => CURLPROTO_HTTP | CURLPROTO_HTTPS,
        ]);
        $ok = curl_exec($ch);
        $errno = curl_errno($ch);
        $status = (int)curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
        unset($ch);
        if ($ok === false) {
            if ($errno === 28) {
                throw new OldbException('OpenLigaDB antwortet gerade nicht (Zeitüberschreitung nach ' . $timeout . ' Sekunden). Bitte später erneut versuchen.');
            }
            if ($errno === 23) {
                throw new OldbException('OpenLigaDB hat ungewöhnlich viele Daten geschickt – Abruf abgebrochen.');
            }
            throw new OldbException('OpenLigaDB ist gerade nicht erreichbar (keine Verbindung). Bitte später erneut versuchen.');
        }
        $body = $buf;
    } elseif (filter_var(ini_get('allow_url_fopen'), FILTER_VALIDATE_BOOLEAN)) {
        $ctx = stream_context_create(['http' => [
            'method' => 'GET', 'timeout' => $timeout, 'ignore_errors' => true, 'follow_location' => 0,
            'user_agent' => TIPP_OLDB_UA, 'header' => "Accept: application/json\r\n",
        ]]);
        $res = @file_get_contents($url, false, $ctx, 0, TIPP_OLDB_MAX_BYTES + 1);
        $headers = function_exists('http_get_last_response_headers') ? (http_get_last_response_headers() ?? []) : ($http_response_header ?? []);
        if ($res === false || !$headers) {
            throw new OldbException('OpenLigaDB ist gerade nicht erreichbar (keine Verbindung oder Zeitüberschreitung). Bitte später erneut versuchen.');
        }
        if (strlen($res) > TIPP_OLDB_MAX_BYTES) {
            throw new OldbException('OpenLigaDB hat ungewöhnlich viele Daten geschickt – Abruf abgebrochen.');
        }
        if (preg_match('#^HTTP/\S+\s+(\d{3})#', (string)$headers[0], $m)) {
            $status = (int)$m[1];
        }
        $body = $res;
    } else {
        throw new OldbException('Der Server darf keine Daten aus dem Internet abrufen (PHP-Erweiterung „curl“ fehlt und „allow_url_fopen“ ist aus). Bitte im Kundenmenü des Hosters aktivieren.');
    }
    if ($status !== 200) {
        throw new OldbException(match (true) {
            $status === 404 => 'OpenLigaDB kennt diese Liga oder Saison nicht (Fehler 404). Bitte Kürzel und Saison prüfen.',
            $status === 429 => 'OpenLigaDB meldet zu viele Anfragen. Bitte in ein paar Minuten erneut versuchen.',
            $status >= 500 => 'OpenLigaDB hat gerade technische Probleme (Fehler ' . $status . '). Bitte später erneut versuchen.',
            default => 'OpenLigaDB hat mit Fehler ' . $status . ' geantwortet.',
        });
    }
    $data = json_decode($body, true, 64);
    if ($data === null) {
        throw new OldbException('OpenLigaDB hat keine gültigen Daten geliefert. Bitte später erneut versuchen.');
    }
    return $data;
}

/** Spiele-Liste von OpenLigaDB holen (ganze Saison oder ein Spieltag) */
function oldb_matches(string $league, int $season, ?int $group, int $timeout): array
{
    $path = '/getmatchdata/' . rawurlencode($league) . '/' . $season . ($group !== null ? '/' . $group : '');
    $data = oldb_get($path, $timeout);
    if (!is_array($data) || ($data !== [] && !array_is_list($data))) {
        throw new OldbException('OpenLigaDB hat keine gültigen Daten geliefert. Bitte später erneut versuchen.');
    }
    return $data;
}

/** Text aus fremden Daten säubern (Steuerzeichen, Leerraum) und kürzen */
function oldb_text(mixed $v, int $max): string
{
    if (!is_string($v) || preg_match('//u', $v) !== 1) {
        return '';
    }
    $v = (string)preg_replace('/[\x00-\x1F\x7F\x{200B}-\x{200F}\x{202A}-\x{202E}\x{2066}-\x{2069}\x{FEFF}]/u', ' ', $v);
    $v = trim((string)preg_replace('/\s+/u', ' ', $v));
    if (str_len($v) > $max) {
        $v = rtrim(implode('', array_slice(preg_split('//u', $v, -1, PREG_SPLIT_NO_EMPTY) ?: [], 0, $max)));
    }
    return $v;
}

/** Anstoß aus matchDateTimeUTC (bevorzugt) bzw. matchDateTime → "YYYY-MM-DD HH:MM" Europe/Berlin */
function oldb_kickoff(array $m): ?string
{
    $utc = $m['matchDateTimeUTC'] ?? null;
    if (is_string($utc) && preg_match('/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})(:\d{2}(\.\d+)?)?Z?$/', $utc, $x)) {
        try {
            $dt = new DateTimeImmutable($x[1] . ' ' . $x[2] . ':00', new DateTimeZone('UTC'));
            return parse_kickoff($dt->setTimezone(new DateTimeZone('Europe/Berlin'))->format('Y-m-d H:i'));
        } catch (Throwable) {
            // weiter mit Ortszeit
        }
    }
    $loc = $m['matchDateTime'] ?? null;
    if (is_string($loc) && preg_match('/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/', $loc, $x)) {
        return parse_kickoff($x[1] . ' ' . $x[2]);
    }
    return null;
}

/**
 * Ein Spiel von OpenLigaDB normalisieren.
 * → ['id','kickoff','home','away','round','group','finished','result'=>[h,a]|null] oder ['error'=>…] oder null (überspringen)
 */
function oldb_match(mixed $m): ?array
{
    if (!is_array($m) || !isset($m['matchID']) || !is_int($m['matchID']) || $m['matchID'] <= 0) {
        return ['error' => 'Ein Datensatz ohne gültige Spiel-ID wurde übersprungen.'];
    }
    $home = oldb_text($m['team1']['teamName'] ?? '', 40) ?: oldb_text($m['team1']['shortName'] ?? '', 40);
    $away = oldb_text($m['team2']['teamName'] ?? '', 40) ?: oldb_text($m['team2']['shortName'] ?? '', 40);
    if ($home === '' || $away === '') {
        return null; // Paarung steht noch nicht fest (z. B. spätere Pokalrunde)
    }
    $kick = oldb_kickoff($m);
    if ($kick === null) {
        return ['error' => "$home – $away: Anstoßzeit fehlt oder ist ungültig, übersprungen."];
    }
    if (lower($home) === lower($away)) {
        return ['error' => "$home – $away: gleiche Mannschaft zweimal, übersprungen."];
    }
    $result = null;
    foreach (is_array($m['matchResults'] ?? null) ? $m['matchResults'] : [] as $r) {
        if (is_array($r) && ($r['resultTypeID'] ?? null) === 2 // 2 = Endergebnis nach 90 Minuten
            && is_int($r['pointsTeam1'] ?? null) && is_int($r['pointsTeam2'] ?? null)
            && $r['pointsTeam1'] >= 0 && $r['pointsTeam1'] <= 99 && $r['pointsTeam2'] >= 0 && $r['pointsTeam2'] <= 99) {
            $result = [$r['pointsTeam1'], $r['pointsTeam2']];
        }
    }
    $g = $m['group']['groupOrderID'] ?? null;
    return [
        'id' => (string)$m['matchID'],
        'kickoff' => $kick,
        'home' => $home,
        'away' => $away,
        'round' => oldb_text($m['group']['groupName'] ?? '', 60),
        'group' => is_int($g) && $g >= 0 && $g < 100000 ? $g : null,
        'finished' => ($m['matchIsFinished'] ?? false) === true,
        'result' => $result,
    ];
}

/** Ergebnis übernehmen? Nur wenn als beendet markiert (live-Zwischenstände nie) – oder lange vorbei. */
function oldb_final(array $x, string $kickoff): ?array
{
    if ($x['result'] === null || now_min() < $kickoff) {
        return null;
    }
    if ($x['finished']) {
        return $x['result'];
    }
    return date('Y-m-d H:i', time() - TIPP_SYNC_STALE_MIN * 60) >= $kickoff ? $x['result'] : null;
}

/**
 * Abgerufene Spiele in die Datenbank übernehmen (Upsert über external_id).
 * $mode 'window': neue Spiele mit Anstoß in den nächsten sync_window_days Tagen anlegen; 'season': alle;
 * 'results': nur Ergebnisse vorhandener Spiele. Vorhandene, noch nicht angepfiffene Spiele: Anstoß/Mannschaften/Runde
 * aktualisieren (nicht bei 'results'). Ergebnisse von Hand (result_source='manual') werden NIE überschrieben.
 */
function sync_apply(array $comp, array $list, string $mode): array
{
    $cid = (int)$comp['id'];
    $now = now_min();
    $days = max(1, min(TIPP_SYNC_WINDOW_MAX, (int)($comp['sync_window_days'] ?? 14)));
    $windowEnd = date('Y-m-d H:i', time() + $days * 86400);
    return tx(function (PDO $pdo) use ($cid, $list, $mode, $now, $windowEnd) {
        $st = ['inserted' => 0, 'updated' => 0, 'results' => 0, 'skipped_manual' => 0, 'errors' => []];
        $byExt = $byKey = [];
        $sel = $pdo->prepare('SELECT * FROM matches WHERE competition_id = ?');
        $sel->execute([$cid]);
        foreach ($sel->fetchAll() as $r) {
            if ($r['external_id'] !== null) {
                $byExt[(string)$r['external_id']] = $r;
            } else {
                $byKey[$r['kickoff'] . '|' . lower((string)$r['home']) . '|' . lower((string)$r['away'])] = $r;
            }
        }
        $upd = $pdo->prepare('UPDATE matches SET kickoff = ?, home = ?, away = ?, round = ?, external_id = ?, external_group = ? WHERE id = ?');
        $res = $pdo->prepare("UPDATE matches SET home_goals = ?, away_goals = ?, result_source = 'auto' WHERE id = ?");
        $ins = $pdo->prepare('INSERT INTO matches (competition_id, round, kickoff, home, away, home_goals, away_goals, external_id, external_group, result_source) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
        $seen = [];
        $addErr = function (string $msg) use (&$st): void {
            if (count($st['errors']) < 25) {
                $st['errors'][] = ['message' => $msg];
            }
        };
        foreach ($list as $raw) {
            $x = oldb_match($raw);
            if ($x === null) {
                continue;
            }
            if (isset($x['error'])) {
                $addErr($x['error']);
                continue;
            }
            if (isset($seen[$x['id']])) {
                continue;
            }
            $seen[$x['id']] = true;
            $row = $byExt[$x['id']] ?? null;
            $key = $x['kickoff'] . '|' . lower($x['home']) . '|' . lower($x['away']);
            if ($row === null && $mode !== 'results' && isset($byKey[$key])) {
                $row = $byKey[$key]; // von Hand angelegtes, identisches Spiel übernehmen statt doppelt anlegen
                unset($byKey[$key]);
                $row['external_id'] = null;
            }
            if ($row !== null) {
                $id = (int)$row['id'];
                $kick = (string)$row['kickoff'];
                $new = ['kickoff' => $kick, 'home' => (string)$row['home'], 'away' => (string)$row['away'], 'round' => (string)$row['round']];
                if ($mode !== 'results') {
                    if ($now < $kick) { // noch nicht angepfiffen: Anstoß, Mannschaften, Runde übernehmen
                        $new = ['kickoff' => $x['kickoff'], 'home' => $x['home'], 'away' => $x['away'], 'round' => $x['round']];
                    } elseif ($x['kickoff'] !== $kick && $row['home_goals'] === null && $x['kickoff'] > $now) {
                        $addErr($row['home'] . ' – ' . $row['away'] . ': laut OpenLigaDB verlegt auf ' . preg_replace('/^(\d{4})-(\d{2})-(\d{2}) (\d{2}:\d{2})$/', '$3.$2.$1, $4', $x['kickoff']) . ' Uhr. Bereits angepfiffene Spiele werden nicht automatisch verschoben – bei Bedarf von Hand ändern.');
                    }
                }
                $changed = $new['kickoff'] !== $kick || $new['home'] !== (string)$row['home'] || $new['away'] !== (string)$row['away'] || $new['round'] !== (string)$row['round'];
                if ($changed || $row['external_id'] === null || (int)$row['external_group'] !== (int)$x['group'] || ($row['external_group'] === null) !== ($x['group'] === null)) {
                    $upd->execute([$new['kickoff'], $new['home'], $new['away'], $new['round'], $x['id'], $x['group'], $id]);
                    if ($changed) {
                        $st['updated']++;
                    }
                }
                $final = oldb_final($x, $new['kickoff']);
                if ($final !== null) {
                    $same = $row['home_goals'] !== null && (int)$row['home_goals'] === $final[0] && (int)$row['away_goals'] === $final[1];
                    if ($row['result_source'] === 'manual' && $row['home_goals'] !== null) {
                        if (!$same) {
                            $st['skipped_manual']++;
                        }
                    } elseif (!$same || $row['result_source'] !== 'auto') {
                        $res->execute([$final[0], $final[1], $id]);
                        $st['results']++;
                    }
                }
                continue;
            }
            if ($mode === 'season' || ($mode === 'window' && $x['kickoff'] > $now && $x['kickoff'] <= $windowEnd)) {
                $final = oldb_final($x, $x['kickoff']);
                $ins->execute([$cid, $x['round'], $x['kickoff'], $x['home'], $x['away'], $final[0] ?? null, $final[1] ?? null, $x['id'], $x['group'], $final !== null ? 'auto' : null]);
                $st['inserted']++;
                if ($final !== null) {
                    $st['results']++;
                }
            }
        }
        return $st;
    });
}

function sync_status_text(array $r, string $mode): string
{
    $parts = [];
    if ($r['inserted']) $parts[] = $r['inserted'] . ' neu';
    if ($r['updated']) $parts[] = $r['updated'] . ' geändert';
    if ($r['results']) $parts[] = $r['results'] . ($r['results'] === 1 ? ' Ergebnis' : ' Ergebnisse');
    if ($r['skipped_manual']) $parts[] = $r['skipped_manual'] . ' von Hand behalten';
    if ($r['errors']) $parts[] = count($r['errors']) . ' Hinweis' . (count($r['errors']) === 1 ? '' : 'e');
    return 'OK' . ($mode === 'results' ? ' (Ergebnisse)' : '') . ' – ' . ($parts ? implode(', ', $parts) : 'keine Änderungen');
}

/**
 * Abruf für einen Wettbewerb ausführen und last_sync/last_sync_status speichern.
 * $scope: 'window' | 'season' | 'results' (nur fällige Spieltage, nur Ergebnisse). Wirft OldbException.
 */
function run_sync(array $comp, string $scope, int $timeout): array
{
    $cid = (int)$comp['id'];
    $league = (string)($comp['source_league'] ?? '');
    $season = (int)($comp['source_season'] ?? 0);
    try {
        if (($comp['source'] ?? null) !== 'openligadb' || !preg_match(TIPP_LEAGUE_RE, $league) || $season < 2000 || $season > 2100) {
            throw new OldbException('Der automatische Abruf ist für diesen Wettbewerb nicht vollständig eingerichtet (Liga-Kürzel und Saison).');
        }
        if ($scope === 'results') {
            $groups = [];
            $whole = false;
            foreach (q('SELECT DISTINCT external_group FROM matches WHERE competition_id = ? AND external_id IS NOT NULL AND home_goals IS NULL AND kickoff <= ? AND kickoff >= ?',
                [$cid, date('Y-m-d H:i', time() - TIPP_SYNC_LAZY_AFTER * 60), date('Y-m-d H:i', time() - TIPP_SYNC_LAZY_DAYS * 86400)])->fetchAll() as $r) {
                if ($r['external_group'] === null) {
                    $whole = true;
                } else {
                    $groups[] = (int)$r['external_group'];
                }
            }
            $list = [];
            if ($whole || count($groups) > 3) {
                $list = oldb_matches($league, $season, null, $timeout);
            } else {
                foreach ($groups as $g) {
                    array_push($list, ...oldb_matches($league, $season, $g, $timeout));
                }
            }
        } else {
            $list = oldb_matches($league, $season, null, $timeout);
            if ($list === []) {
                throw new OldbException('OpenLigaDB kennt für „' . $league . '“ in der Saison ' . season_label($season) . ' keine Spiele. Bitte Kürzel und Saison prüfen.');
            }
        }
        $r = sync_apply($comp, $list, $scope);
        $status = sync_status_text($r, $scope);
    } catch (OldbException $e) {
        q('UPDATE competitions SET last_sync = ?, last_sync_status = ? WHERE id = ?', [now_full(), 'Fehler: ' . $e->getMessage(), $cid]);
        throw $e;
    }
    $when = now_full();
    q('UPDATE competitions SET last_sync = ?, last_sync_status = ? WHERE id = ?', [$when, $status, $cid]);
    return $r + ['last_sync' => $when, 'last_sync_status' => $status];
}

/** Sperre gegen gleichzeitige Abrufe (Datei-Lock). $wait=false: sofort aufgeben, wenn belegt. */
function sync_lock(bool $wait): mixed
{
    $fh = @fopen(TIPP_SYNC_LOCK, 'c');
    if (!$fh) {
        return $wait ? true : null; // ohne Lock-Datei trotzdem arbeiten (Verwaltung) bzw. auslassen (nebenbei)
    }
    if ($wait) {
        $until = microtime(true) + 15;
        while (!flock($fh, LOCK_EX | LOCK_NB)) {
            if (microtime(true) > $until) {
                fclose($fh);
                fail('Gerade läuft schon ein Abruf. Bitte gleich noch einmal versuchen.', 409);
            }
            usleep(200000);
        }
        return $fh;
    }
    if (!flock($fh, LOCK_EX | LOCK_NB)) {
        fclose($fh);
        return null;
    }
    return $fh;
}

function sync_unlock(mixed $fh): void
{
    if (is_resource($fh)) {
        flock($fh, LOCK_UN);
        fclose($fh);
    }
}

/**
 * „Nebenbei“-Abruf beim Öffnen des Tippspiels: Gibt es in einem Wettbewerb mit automatischem Abruf ein Spiel, das vor
 * ≥ 110 Min. angepfiffen wurde und noch kein Ergebnis hat, und war der letzte Abruf vor > 10 Min., werden die
 * Ergebnisse der betroffenen Spieltage geholt (kurzes Zeitlimit, nicht blockierend). Fehler werden nur gespeichert.
 */
function lazy_sync(): void
{
    try {
        $t = time();
        $due = q("SELECT c.* FROM competitions c WHERE c.source = 'openligadb' AND c.active = 1
                  AND (c.last_sync IS NULL OR c.last_sync <= ?)
                  AND EXISTS (SELECT 1 FROM matches m WHERE m.competition_id = c.id AND m.external_id IS NOT NULL
                              AND m.home_goals IS NULL AND m.kickoff <= ? AND m.kickoff >= ?)
                  ORDER BY c.last_sync LIMIT 2",
            [date('Y-m-d H:i:s', $t - TIPP_SYNC_LAZY_EVERY * 60), date('Y-m-d H:i', $t - TIPP_SYNC_LAZY_AFTER * 60), date('Y-m-d H:i', $t - TIPP_SYNC_LAZY_DAYS * 86400)])->fetchAll();
        if (!$due) {
            return;
        }
        $fh = sync_lock(false);
        if ($fh === null) {
            return; // ein anderer Aufruf holt gerade
        }
        try {
            $deadline = microtime(true) + 6;
            foreach ($due as $c) {
                $last = q('SELECT last_sync FROM competitions WHERE id = ?', [(int)$c['id']])->fetchColumn();
                if ($last !== null && $last !== false && (string)$last > date('Y-m-d H:i:s', $t - TIPP_SYNC_LAZY_EVERY * 60)) {
                    continue; // inzwischen von einem anderen Aufruf erledigt
                }
                q('UPDATE competitions SET last_sync = ? WHERE id = ?', [now_full(), (int)$c['id']]); // Versuch vormerken
                try {
                    run_sync($c, 'results', TIPP_SYNC_LAZY_TIMEOUT);
                } catch (OldbException $e) {
                    // Status ist gespeichert – Spieler merken davon nichts
                }
                if (microtime(true) > $deadline) {
                    break;
                }
            }
        } finally {
            sync_unlock($fh);
        }
    } catch (Throwable $e) {
        error_log('[hbs-tipp] lazy_sync: ' . $e->getMessage());
    }
}

/* ---------- Cronjob-Token */

function cron_token(): string
{
    $raw = is_file(TIPP_CRON_FILE) ? (string)@file_get_contents(TIPP_CRON_FILE) : '';
    if (preg_match('/^TOKEN=([a-f0-9]{48})$/m', $raw, $m)) {
        return $m[1];
    }
    return cron_token_reset();
}

function cron_token_reset(): string
{
    $token = bin2hex(random_bytes(24));
    // als PHP-Datei, damit der Token auch ohne .htaccess-Schutz nie im Browser lesbar ist
    $content = "<?php http_response_code(404); exit; ?>\n# Geheimer Token für den Cronjob-Aufruf des Tippspiels (cms/tipp-api.php?action=cron_sync&token=…)\nTOKEN=$token\n";
    if (@file_put_contents(TIPP_CRON_FILE, $content, LOCK_EX) === false) {
        fail('Der Cronjob-Token konnte nicht gespeichert werden (cms/data nicht beschreibbar).', 500, ['setup' => 'data_dir']);
    }
    @chmod(TIPP_CRON_FILE, 0640);
    return $token;
}

function cron_url(string $token): string
{
    $host = (string)($_SERVER['HTTP_HOST'] ?? '');
    if (!preg_match('/^[A-Za-z0-9.\-]+(:\d{1,5})?$|^\[[0-9A-Fa-f:.]+\](:\d{1,5})?$/', $host)) {
        $host = (string)($_SERVER['SERVER_NAME'] ?? 'localhost');
    }
    $path = (string)($_SERVER['SCRIPT_NAME'] ?? '/cms/tipp-api.php');
    return (is_https() ? 'https' : 'http') . '://' . $host . $path . '?action=cron_sync&token=' . $token;
}

function cron_info(): array
{
    $last = q("SELECT value FROM settings WHERE key = 'cron_last'")->fetchColumn();
    $lastData = is_string($last) ? json_decode($last, true) : null;
    return ['url_with_token' => cron_url(cron_token()), 'last_cron' => is_array($lastData) ? $lastData : null];
}

/* ================================================================= Router */

$action = (string)($_GET['action'] ?? '');
if (!preg_match('/^[a-z_]{1,40}$/', $action)) {
    fail('Unbekannte Aktion.', 400);
}
if (method() === 'POST') {
    check_origin();
    body(); // JSON-Pflicht + Größenlimit früh prüfen
} elseif (method() !== 'GET') {
    fail('Methode nicht erlaubt.', 405);
}

db(); // legt die Datenbank beim ersten Aufruf an (oder meldet fehlendes pdo_sqlite)

switch ($action) {

    /* ------------------------------------------------------------ Spieler */

    case 'status':
        require_method('GET');
        $payload = status_with_admin(current_player()); // schließt die Sitzung – nicht während des Abrufs sperren
        lazy_sync();
        respond($payload);

    case 'invite_check':
        require_method('GET');
        $lock = bf_locked([bf_key('code')]);
        if ($lock > 0) {
            fail_locked($lock);
        }
        $code = norm_code(inp('code'));
        $inv = $code !== '' ? q('SELECT * FROM invites WHERE code = ?', [$code])->fetch() : false;
        $valid = $inv && invite_valid($inv);
        if (!$inv) {
            bf_fail(bf_key('code'), TIPP_BF_CODE_FAILS);
        }
        respond(['valid' => (bool)$valid]);

    case 'register':
        require_method('POST');
        $lock = bf_locked([bf_key('code'), bf_key('ip')]);
        if ($lock > 0) {
            fail_locked($lock);
        }
        $code = norm_code(inp('code'));
        $nick = v_nickname(inp('nickname'));
        $pw = v_new_password(inp('password'));
        $email = v_email(inp('email'));
        $hash = password_hash($pw, PASSWORD_DEFAULT);
        $player = tx(function (PDO $pdo) use ($code, $nick, $hash, $email) {
            $inv = false;
            if ($code !== '') {
                $st = $pdo->prepare('SELECT * FROM invites WHERE code = ?');
                $st->execute([$code]);
                $inv = $st->fetch();
            }
            if (!$inv || !invite_valid($inv)) {
                return ['error' => $inv ? 'used' : 'invalid'];
            }
            if (find_player_by_nick($nick)) {
                return ['error' => 'taken'];
            }
            $now = now_full();
            $pdo->prepare('INSERT INTO players (nickname, password_hash, email, active, created, last_login, invite_code) VALUES (?, ?, ?, 1, ?, ?, ?)')
                ->execute([$nick, $hash, $email, $now, $now, $code]);
            $id = (int)$pdo->lastInsertId();
            $pdo->prepare('UPDATE invites SET uses = uses + 1 WHERE code = ?')->execute([$code]);
            return ['id' => $id, 'password_hash' => $hash];
        });
        if (isset($player['error'])) {
            if ($player['error'] === 'taken') {
                fail('Dieser Nickname ist schon vergeben. Bitte such dir einen anderen aus.', 409);
            }
            if ($player['error'] === 'invalid') {
                bf_fail(bf_key('code'), TIPP_BF_CODE_FAILS);
            }
            fail('Der Einladungscode ist ungültig, abgelaufen oder schon aufgebraucht.', 400);
        }
        login_session($player);
        respond(status_with_admin(['id' => $player['id'], 'nickname' => $nick, 'email' => $email]));

    case 'login':
        require_method('POST');
        $nickRaw = inp('nickname');
        $nick = is_string($nickRaw) ? trim((string)preg_replace('/\s+/u', ' ', $nickRaw)) : '';
        $pw = inp('password');
        if ($nick === '' || !is_string($pw) || $pw === '') {
            fail('Bitte Nickname und Passwort eingeben.', 400);
        }
        $nickKey = bf_key('login', lower($nick));
        $ipKey = bf_key('ip');
        $lock = bf_locked([$nickKey, $ipKey]);
        if ($lock > 0) {
            fail_locked($lock);
        }
        $p = (str_len($nick) <= 24 && strlen($pw) <= 200) ? find_player_by_nick($nick) : null;
        if ($p) {
            $ok = password_verify($pw, (string)$p['password_hash']);
        } else {
            password_hash($pw, PASSWORD_DEFAULT); // gleiche Rechenzeit wie bei existierendem Nickname
            $ok = false;
        }
        if (!$ok) {
            $l1 = bf_fail($nickKey, TIPP_BF_NICK_FAILS);
            $l2 = bf_fail($ipKey, TIPP_BF_IP_FAILS);
            usleep(random_int(300000, 600000));
            if ($l1 || $l2) {
                header('Retry-After: ' . TIPP_BF_LOCK);
                fail('Zu viele Fehlversuche. Die Anmeldung ist für ' . (TIPP_BF_LOCK / 60) . ' Minuten gesperrt.', 429, ['retryAfter' => TIPP_BF_LOCK]);
            }
            fail('Nickname oder Passwort falsch.', 401);
        }
        if (!(int)$p['active']) {
            fail('Dein Konto ist gesperrt. Bitte sprich uns an der Theke an.', 403);
        }
        bf_clear($nickKey);
        $hash = (string)$p['password_hash'];
        if (password_needs_rehash($hash, PASSWORD_DEFAULT)) {
            $hash = password_hash($pw, PASSWORD_DEFAULT);
            q('UPDATE players SET password_hash = ? WHERE id = ?', [$hash, (int)$p['id']]);
        }
        q('UPDATE players SET last_login = ? WHERE id = ?', [now_full(), (int)$p['id']]);
        login_session(['id' => (int)$p['id'], 'password_hash' => $hash]);
        respond(status_with_admin(['id' => (int)$p['id'], 'nickname' => (string)$p['nickname'], 'email' => $p['email'] !== null ? (string)$p['email'] : null]));

    case 'logout':
        require_method('POST');
        if (current_player() !== null) {
            check_csrf((string)($_SESSION['csrf'] ?? ''));
        }
        end_player_session();
        respond([]);

    case 'matches':
        require_method('GET');
        $rd = require_reader();
        $me = $rd['player'];
        $owner = $rd['owner'];
        $cid = opt_comp_id();
        session_close_any();
        lazy_sync();
        $comps = $cid !== null
            ? q('SELECT * FROM competitions WHERE id = ?', [$cid])->fetchAll()
            : q('SELECT * FROM competitions WHERE active = 1 ORDER BY sort, id')->fetchAll();
        $compIds = array_map(fn($c) => (int)$c['id'], $comps);
        $firstKick = first_kickoffs();
        $s = settings();
        $outComps = $outMatches = [];
        if ($compIds) {
            $ph = placeholders($compIds);
            if ($owner) {
                // Wirt-Ansicht: keine eigenen Tipps, dafür Anzahl der Bonus-Antworten (aktive Spieler)
                $bonusCount = [];
                foreach (q("SELECT b.competition_id, COUNT(*) AS n FROM bonus_tips b JOIN players p ON p.id = b.player_id AND p.active = 1
                            WHERE b.competition_id IN ($ph) GROUP BY b.competition_id", $compIds)->fetchAll() as $b) {
                    $bonusCount[(int)$b['competition_id']] = (int)$b['n'];
                }
                foreach ($comps as $c) {
                    $outComps[] = comp_out($c, $firstKick) + ['bonus_count' => $bonusCount[(int)$c['id']] ?? 0];
                }
            } else {
                $myBonus = [];
                foreach (q("SELECT competition_id, answer FROM bonus_tips WHERE player_id = ? AND competition_id IN ($ph)", array_merge([$me['id']], $compIds))->fetchAll() as $b) {
                    $myBonus[(int)$b['competition_id']] = (string)$b['answer'];
                }
                foreach ($comps as $c) {
                    $outComps[] = comp_out($c, $firstKick) + ['my_bonus' => $myBonus[(int)$c['id']] ?? null];
                }
            }
            $tipsBy = [];
            foreach (q("SELECT t.player_id, t.match_id, t.home_goals, t.away_goals FROM tips t
                        JOIN players p ON p.id = t.player_id AND p.active = 1
                        JOIN matches m ON m.id = t.match_id WHERE m.competition_id IN ($ph)", $compIds)->fetchAll() as $t) {
                $tipsBy[(int)$t['match_id']][] = $t;
            }
            foreach (q("SELECT * FROM matches WHERE competition_id IN ($ph) ORDER BY kickoff, id", $compIds)->fetchAll() as $m) {
                $o = match_base($m);
                $list = $tipsBy[$o['id']] ?? [];
                if ($owner) {
                    // Der Wirt darf alles sehen – Quote auch schon vor dem Anstoß
                    $o['tip_count'] = count($list);
                    $o['tendency'] = tendency($list);
                    $outMatches[] = $o;
                    continue;
                }
                $mine = null;
                foreach ($list as $t) {
                    if ((int)$t['player_id'] === $me['id']) {
                        $mine = ['home' => (int)$t['home_goals'], 'away' => (int)$t['away_goals']];
                    }
                }
                $sc = $mine ? score_tip($mine['home'], $mine['away'], $o['home_goals'], $o['away_goals'], $s) : null;
                $o['my_tip'] = $mine;
                $o['my_points'] = $sc['points'] ?? null;
                $o['my_kind'] = $sc['kind'] ?? null;
                $o['tip_count'] = count($list);
                $o['tendency'] = $o['locked'] ? tendency($list) : null;
                $outMatches[] = $o;
            }
        }
        respond(['competitions' => $outComps, 'matches' => $outMatches, 'serverTime' => now_full()] + ($owner ? ['owner' => true] : []));

    case 'tip':
        require_method('POST');
        $me = require_player();
        $mid = v_id(inp('match_id'), 'Spiel');
        $h = v_goals(inp('home'), 'Tore Heim');
        $a = v_goals(inp('away'), 'Tore Gast');
        $res = tx(function (PDO $pdo) use ($me, $mid, $h, $a) {
            $st = $pdo->prepare('SELECT m.kickoff, c.active FROM matches m JOIN competitions c ON c.id = m.competition_id WHERE m.id = ?');
            $st->execute([$mid]);
            $m = $st->fetch();
            if (!$m) {
                return 404;
            }
            if (!(int)$m['active']) {
                return 'inactive';
            }
            if (now_min() >= (string)$m['kickoff']) {
                return 409;
            }
            $now = now_full();
            $pdo->prepare('INSERT INTO tips (player_id, match_id, home_goals, away_goals, updated) VALUES (?, ?, ?, ?, ?)
                           ON CONFLICT(player_id, match_id) DO UPDATE SET home_goals = excluded.home_goals, away_goals = excluded.away_goals, updated = excluded.updated')
                ->execute([$me['id'], $mid, $h, $a, $now]);
            return $now;
        });
        if ($res === 404) {
            fail('Spiel nicht gefunden.', 404);
        }
        if ($res === 'inactive') {
            fail('Dieser Wettbewerb ist gerade nicht aktiv.', 409);
        }
        if ($res === 409) {
            fail('Tippschluss! Das Spiel hat schon begonnen – dein Tipp kann nicht mehr geändert werden.', 409, ['locked' => true]);
        }
        respond(['tip' => ['home' => $h, 'away' => $a], 'updated' => $res]);

    case 'bonus_tip':
        require_method('POST');
        $me = require_player();
        $cid = v_id(inp('competition_id'), 'Wettbewerb');
        $answer = v_str(inp('answer'), 1, 80, 'eine Antwort');
        $res = tx(function (PDO $pdo) use ($me, $cid, $answer) {
            $st = $pdo->prepare('SELECT * FROM competitions WHERE id = ?');
            $st->execute([$cid]);
            $c = $st->fetch();
            if (!$c) {
                return 404;
            }
            if (!(int)$c['active']) {
                return 'inactive';
            }
            if ($c['bonus_question'] === null || trim((string)$c['bonus_question']) === '') {
                return 'none';
            }
            if (bonus_locked($cid, first_kickoffs())) {
                return 409;
            }
            $pdo->prepare('INSERT INTO bonus_tips (player_id, competition_id, answer, updated) VALUES (?, ?, ?, ?)
                           ON CONFLICT(player_id, competition_id) DO UPDATE SET answer = excluded.answer, updated = excluded.updated')
                ->execute([$me['id'], $cid, $answer, now_full()]);
            return true;
        });
        match ($res) {
            404 => fail('Wettbewerb nicht gefunden.', 404),
            'inactive' => fail('Dieser Wettbewerb ist gerade nicht aktiv.', 409),
            'none' => fail('Für diesen Wettbewerb gibt es keine Bonusfrage.', 400),
            409 => fail('Tippschluss! Die Bonusfrage konnte nur bis zum Anstoß des ersten Spiels beantwortet werden.', 409, ['locked' => true]),
            default => null,
        };
        respond(['answer' => $answer]);

    case 'leaderboard':
        require_method('GET');
        $rd = require_reader();
        $cid = opt_comp_id();
        session_close_any();
        lazy_sync();
        respond(leaderboard($cid, $rd['owner'] ? null : $rd['player']['id']) + ($rd['owner'] ? ['owner' => true] : []));

    case 'stats':
        require_method('GET');
        $me = require_player();
        respond(stats(opt_comp_id(), $me['id']));

    case 'player_tips':
        require_method('GET');
        $rd = require_reader();
        $owner = $rd['owner'];
        $me = $rd['player'];
        $nick = inp('nickname');
        $p = is_string($nick) && trim($nick) !== '' && str_len($nick) <= 40 ? find_player_by_nick(trim((string)preg_replace('/\s+/u', ' ', $nick))) : null;
        if (!$p || !(int)$p['active']) {
            fail('Spieler nicht gefunden.', 404);
        }
        $s = settings();
        $now = now_min();
        $tips = [];
        // Wirt-Ansicht: alle Tipps, auch für noch offene Spiele (locked:false); Spieler: nur gesperrte Spiele
        foreach (q('SELECT m.*, t.home_goals AS t_home, t.away_goals AS t_away FROM tips t JOIN matches m ON m.id = t.match_id
                    WHERE t.player_id = ?' . ($owner ? '' : ' AND m.kickoff <= ?') . ' ORDER BY m.kickoff DESC, m.id DESC', $owner ? [(int)$p['id']] : [(int)$p['id'], $now])->fetchAll() as $r) {
            $o = match_base($r);
            if (!$o['locked'] && !$owner) {
                continue;
            }
            $sc = score_tip((int)$r['t_home'], (int)$r['t_away'], $o['home_goals'], $o['away_goals'], $s);
            $tips[] = ['match_id' => $o['id']] + $o + ['tip' => ['home' => (int)$r['t_home'], 'away' => (int)$r['t_away']], 'points' => $sc['points'] ?? null, 'kind' => $sc['kind'] ?? null];
        }
        foreach ($tips as &$t) {
            unset($t['id']);
        }
        unset($t);
        $firstKick = first_kickoffs();
        $bonus = [];
        foreach (q('SELECT b.answer, c.* FROM bonus_tips b JOIN competitions c ON c.id = b.competition_id WHERE b.player_id = ? ORDER BY c.sort, c.id', [(int)$p['id']])->fetchAll() as $r) {
            $bLocked = bonus_locked((int)$r['id'], $firstKick);
            if (!$bLocked && !$owner) {
                continue;
            }
            $hasAnswer = bonus_norm($r['bonus_answer']) !== '';
            $bonus[] = [
                'competition_id' => (int)$r['id'],
                'competition' => (string)$r['name'],
                'question' => $r['bonus_question'] !== null ? (string)$r['bonus_question'] : null,
                'answer' => (string)$r['answer'],
                'correct' => $hasAnswer ? bonus_norm($r['answer']) === bonus_norm($r['bonus_answer']) : null,
            ] + ($owner ? ['locked' => $bLocked] : []);
        }
        respond(['player' => ['nickname' => (string)$p['nickname'], 'is_me' => !$owner && (int)$p['id'] === $me['id']], 'tips' => $tips, 'bonus' => $bonus] + ($owner ? ['owner' => true] : []));

    case 'change_password':
        require_method('POST');
        $me = require_player();
        $old = inp('old');
        if (!is_string($old) || strlen($old) > 200 || !password_verify($old, $me['password_hash'])) {
            usleep(400000);
            fail('Das aktuelle Passwort ist falsch.', 400);
        }
        $new = v_new_password(inp('new'), 'Das neue Passwort');
        if ($new === $old) {
            fail('Das neue Passwort muss sich vom bisherigen unterscheiden.', 400);
        }
        $hash = password_hash($new, PASSWORD_DEFAULT);
        q('UPDATE players SET password_hash = ? WHERE id = ?', [$hash, $me['id']]);
        session_regenerate_id(true);
        $_SESSION['stamp'] = pw_stamp($hash); // andere Geräte werden damit abgemeldet
        respond([]);

    case 'delete_account':
        require_method('POST');
        $me = require_player();
        $pw = inp('password');
        if (!is_string($pw) || strlen($pw) > 200 || !password_verify($pw, $me['password_hash'])) {
            usleep(400000);
            fail('Das Passwort ist falsch.', 400);
        }
        tx(function (PDO $pdo) use ($me) {
            $pdo->prepare('DELETE FROM tips WHERE player_id = ?')->execute([$me['id']]);
            $pdo->prepare('DELETE FROM bonus_tips WHERE player_id = ?')->execute([$me['id']]);
            $pdo->prepare('DELETE FROM players WHERE id = ?')->execute([$me['id']]);
        });
        end_player_session();
        respond([]);

    /* -------------------------------------------------------------- Admin */

    case 'admin_overview':
        require_method('GET');
        require_admin();
        $firstKick = first_kickoffs();
        $comps = [];
        $mc = [];
        foreach (q('SELECT competition_id, COUNT(*) AS n FROM matches GROUP BY competition_id')->fetchAll() as $r) {
            $mc[(int)$r['competition_id']] = (int)$r['n'];
        }
        foreach (q('SELECT * FROM competitions ORDER BY sort, id')->fetchAll() as $c) {
            $comps[] = comp_admin_out($c, $firstKick) + ['created' => (string)$c['created'], 'match_count' => $mc[(int)$c['id']] ?? 0];
        }
        $tc = [];
        foreach (q('SELECT match_id, COUNT(*) AS n FROM tips GROUP BY match_id')->fetchAll() as $r) {
            $tc[(int)$r['match_id']] = (int)$r['n'];
        }
        $matches = [];
        foreach (q('SELECT * FROM matches ORDER BY kickoff, id')->fetchAll() as $m) {
            $matches[] = match_base($m) + ['tip_count' => $tc[(int)$m['id']] ?? 0, 'external_id' => $m['external_id'] !== null ? (string)$m['external_id'] : null];
        }
        $sc = load_scope(null, false);
        $tally = tally($sc['players'], scored_matches($sc['matches']), $sc['tips'], $sc['comps'], $sc['bonus'], settings());
        $ptc = [];
        foreach (q('SELECT player_id, COUNT(*) AS n FROM tips GROUP BY player_id')->fetchAll() as $r) {
            $ptc[(int)$r['player_id']] = (int)$r['n'];
        }
        $players = [];
        foreach (q('SELECT id, nickname, email, active, created, last_login, invite_code FROM players ORDER BY nickname COLLATE NOCASE')->fetchAll() as $p) {
            $pid = (int)$p['id'];
            $players[] = [
                'id' => $pid, 'nickname' => (string)$p['nickname'], 'email' => $p['email'] !== null ? (string)$p['email'] : null,
                'active' => (bool)$p['active'], 'created' => (string)$p['created'], 'last_login' => $p['last_login'] !== null ? (string)$p['last_login'] : null,
                'invite_code' => $p['invite_code'] !== null ? (string)$p['invite_code'] : null,
                'tips' => $ptc[$pid] ?? 0, 'points' => $tally[$pid]['points'] ?? 0,
            ];
        }
        $invites = array_map('invite_out', q('SELECT * FROM invites ORDER BY created DESC, code')->fetchAll());
        respond(['competitions' => $comps, 'matches' => $matches, 'players' => $players, 'invites' => $invites, 'settings' => settings(), 'serverTime' => now_full()]);

    case 'admin_stats':
        // Wirt-Ansicht: Stammtisch-Statistik (alle aktiven Spieler)
        require_method('GET');
        require_admin();
        respond(owner_stats(opt_comp_id()));

    case 'admin_match_tips':
        // Wirt-Ansicht: alle Tipps zu einem Spiel – auch vor dem Anstoß
        require_method('GET');
        require_admin();
        $m = match_or_404(v_id(inp('match_id'), 'Spiel'));
        $s = settings();
        $o = match_base($m);
        $c = q('SELECT name FROM competitions WHERE id = ?', [(int)$m['competition_id']])->fetchColumn();
        $rows = q('SELECT t.player_id, t.home_goals, t.away_goals, t.updated, p.nickname FROM tips t
                   JOIN players p ON p.id = t.player_id AND p.active = 1 WHERE t.match_id = ?', [$o['id']])->fetchAll();
        $tips = [];
        foreach ($rows as $r) {
            $sc = score_tip((int)$r['home_goals'], (int)$r['away_goals'], $o['home_goals'], $o['away_goals'], $s);
            $tips[] = [
                'nickname' => (string)$r['nickname'],
                'tip' => ['home' => (int)$r['home_goals'], 'away' => (int)$r['away_goals']],
                'points' => $sc['points'] ?? null,
                'kind' => $sc['kind'] ?? null,
                'updated' => (string)$r['updated'],
            ];
        }
        usort($tips, fn($a, $b) => ($b['points'] ?? -1) <=> ($a['points'] ?? -1) ?: strcmp(lower($a['nickname']), lower($b['nickname'])));
        $tipped = [];
        foreach ($rows as $r) {
            $tipped[(int)$r['player_id']] = true;
        }
        $missing = [];
        foreach (q('SELECT id, nickname FROM players WHERE active = 1')->fetchAll() as $p) {
            if (!isset($tipped[(int)$p['id']])) {
                $missing[] = (string)$p['nickname'];
            }
        }
        usort($missing, fn($a, $b) => strcmp(lower($a), lower($b)));
        $o['competition'] = $c !== false ? (string)$c : '';
        $o['tip_count'] = count($tips);
        $o['tendency'] = tendency($rows);
        respond(['match' => $o, 'tips' => $tips, 'missing' => $missing]);

    case 'admin_competition_save':
        require_method('POST');
        require_admin();
        $id = present('id') ? v_id(inp('id'), 'ID') : null;
        $name = v_str(inp('name'), 1, 80, 'einen Namen');
        $active = inp('active') === null ? 1 : v_bool(inp('active'), 'Aktiv');
        $sort = inp('sort') === null || inp('sort') === '' ? 0 : v_int(inp('sort'), -9999, 9999, 'Reihenfolge');
        $bq = v_opt_str(inp('bonus_question'), 150, 'Bonusfrage');
        $ba = v_opt_str(inp('bonus_answer'), 80, 'Bonus-Antwort');
        $bp = inp('bonus_points') === null || inp('bonus_points') === '' ? 10 : v_int(inp('bonus_points'), 0, 100, 'Bonuspunkte');
        $old = $id !== null ? competition_or_404($id) : null;
        // Automatischer Abruf: nur ändern, wenn „source“ mitgeschickt wird (ältere Oberflächen lassen ihn unverändert)
        $src = ['source' => $old['source'] ?? null, 'source_league' => $old['source_league'] ?? null,
                'source_season' => $old['source_season'] ?? null, 'sync_window_days' => (int)($old['sync_window_days'] ?? 14)];
        if (array_key_exists('source', body())) {
            $sv = inp('source');
            $on = $sv === 'openligadb' || $sv === true;
            if (!$on && !in_array($sv, [null, '', false, 0, '0', 'false', 'manual'], true)) {
                fail('Quelle: nur „openligadb“ oder leer (von Hand) möglich.', 400);
            }
            $lg = inp('source_league');
            $se = inp('source_season');
            if ($on) {
                $src['source_league'] = v_league($lg);
                $src['source_season'] = v_season($se);
            } else { // ausgeschaltet: Angaben merken, falls gültig
                $src['source_league'] = is_string($lg) && preg_match(TIPP_LEAGUE_RE, trim($lg)) ? trim($lg) : null;
                $src['source_season'] = (is_int($se) || is_string($se)) && preg_match('/^\d{4}$/', trim((string)$se)) ? (int)trim((string)$se) : null;
            }
            $src['source'] = $on ? 'openligadb' : null;
            $wd = inp('sync_window_days');
            $src['sync_window_days'] = $wd === null || $wd === '' ? 14 : v_int($wd, 1, TIPP_SYNC_WINDOW_MAX, 'Zeitraum (Tage)');
        }
        if ($id !== null) {
            q('UPDATE competitions SET name = ?, active = ?, sort = ?, bonus_question = ?, bonus_answer = ?, bonus_points = ?,
               source = ?, source_league = ?, source_season = ?, sync_window_days = ? WHERE id = ?',
                [$name, $active, $sort, $bq, $ba, $bp, $src['source'], $src['source_league'], $src['source_season'], $src['sync_window_days'], $id]);
        } else {
            q('INSERT INTO competitions (name, active, sort, bonus_question, bonus_answer, bonus_points, created, source, source_league, source_season, sync_window_days)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                [$name, $active, $sort, $bq, $ba, $bp, now_full(), $src['source'], $src['source_league'], $src['source_season'], $src['sync_window_days']]);
            $id = (int)db()->lastInsertId();
        }
        respond(['competition' => comp_admin_out(competition_or_404($id), first_kickoffs())]);

    case 'admin_competition_delete':
        require_method('POST');
        require_admin();
        $id = v_id(inp('id'));
        competition_or_404($id);
        tx(function (PDO $pdo) use ($id) {
            $pdo->prepare('DELETE FROM tips WHERE match_id IN (SELECT id FROM matches WHERE competition_id = ?)')->execute([$id]);
            $pdo->prepare('DELETE FROM matches WHERE competition_id = ?')->execute([$id]);
            $pdo->prepare('DELETE FROM bonus_tips WHERE competition_id = ?')->execute([$id]);
            $pdo->prepare('DELETE FROM competitions WHERE id = ?')->execute([$id]);
        });
        respond([]);

    case 'admin_match_save':
        require_method('POST');
        require_admin();
        $id = present('id') ? v_id(inp('id'), 'ID') : null;
        $cid = v_id(inp('competition_id'), 'Wettbewerb');
        competition_or_404($cid);
        $round = v_str(inp('round'), 0, 60, 'Runde');
        $kick = v_kickoff(inp('kickoff'));
        $home = v_str(inp('home'), 1, 40, 'die Heimmannschaft');
        $away = v_str(inp('away'), 1, 40, 'die Gastmannschaft');
        if (lower($home) === lower($away)) {
            fail('Heim- und Gastmannschaft müssen verschieden sein.', 400);
        }
        if ($id !== null) {
            $old = match_or_404($id);
            if ($old['home_goals'] !== null && $kick > now_min()) {
                fail('Das Spiel hat schon ein Ergebnis – der Anstoß kann nicht in die Zukunft verlegt werden. Bitte zuerst das Ergebnis löschen.', 409);
            }
            q('UPDATE matches SET competition_id = ?, round = ?, kickoff = ?, home = ?, away = ? WHERE id = ?', [$cid, $round, $kick, $home, $away, $id]);
        } else {
            q('INSERT INTO matches (competition_id, round, kickoff, home, away) VALUES (?, ?, ?, ?, ?)', [$cid, $round, $kick, $home, $away]);
            $id = (int)db()->lastInsertId();
        }
        respond(['match' => match_base(match_or_404($id))]);

    case 'admin_match_delete':
        require_method('POST');
        require_admin();
        $id = v_id(inp('id'));
        match_or_404($id);
        tx(function (PDO $pdo) use ($id) {
            $pdo->prepare('DELETE FROM tips WHERE match_id = ?')->execute([$id]);
            $pdo->prepare('DELETE FROM matches WHERE id = ?')->execute([$id]);
        });
        respond([]);

    case 'admin_match_import':
        require_method('POST');
        require_admin();
        $cid = v_id(inp('competition_id'), 'Wettbewerb');
        competition_or_404($cid);
        $text = inp('text');
        if (!is_string($text) || preg_match('//u', $text) !== 1) {
            fail('Bitte die Spiele als Text einfügen.', 400);
        }
        if (strlen($text) > 100000) {
            fail('Der Text ist zu lang (höchstens 100 000 Zeichen).', 400);
        }
        $lines = preg_split('/\r\n|\r|\n/', $text) ?: [];
        if (count($lines) > 1000) {
            fail('Zu viele Zeilen (höchstens 1000).', 400);
        }
        $errors = [];
        $rows = [];
        $seen = [];
        foreach (q('SELECT kickoff, home, away FROM matches WHERE competition_id = ?', [$cid])->fetchAll() as $m) {
            $seen[$m['kickoff'] . '|' . lower((string)$m['home']) . '|' . lower((string)$m['away'])] = true;
        }
        foreach ($lines as $i => $line) {
            $no = $i + 1;
            $line = trim((string)preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F\x{FEFF}]/u', '', $line));
            if ($line === '' || str_starts_with($line, '#')) {
                continue;
            }
            $parts = array_map('trim', preg_split('/\s*[;\t]\s*/', $line) ?: []);
            if (count($parts) < 3 || count($parts) > 4) {
                $errors[] = ['line' => $no, 'message' => 'Erwartet: JJJJ-MM-TT HH:MM; Heim; Gast; Runde'];
                continue;
            }
            $kick = parse_kickoff($parts[0]);
            $home = (string)preg_replace('/\s+/u', ' ', $parts[1]);
            $away = (string)preg_replace('/\s+/u', ' ', $parts[2]);
            $round = (string)preg_replace('/\s+/u', ' ', $parts[3] ?? '');
            if ($kick === null) {
                $errors[] = ['line' => $no, 'message' => 'Ungültiger Anstoß „' . implode('', array_slice(preg_split('//u', $parts[0], -1, PREG_SPLIT_NO_EMPTY) ?: [], 0, 30)) . '“ (Format JJJJ-MM-TT HH:MM).'];
            } elseif ($home === '' || $away === '' || str_len($home) > 40 || str_len($away) > 40) {
                $errors[] = ['line' => $no, 'message' => 'Mannschaftsnamen fehlen oder sind zu lang (höchstens 40 Zeichen).'];
            } elseif (lower($home) === lower($away)) {
                $errors[] = ['line' => $no, 'message' => 'Heim- und Gastmannschaft sind gleich.'];
            } elseif (str_len($round) > 60) {
                $errors[] = ['line' => $no, 'message' => 'Runde ist zu lang (höchstens 60 Zeichen).'];
            } elseif (isset($seen[$kick . '|' . lower($home) . '|' . lower($away)])) {
                $errors[] = ['line' => $no, 'message' => 'Dieses Spiel gibt es schon.'];
            } else {
                $seen[$kick . '|' . lower($home) . '|' . lower($away)] = true;
                $rows[] = [$cid, $round, $kick, $home, $away];
            }
        }
        tx(function (PDO $pdo) use ($rows) {
            $st = $pdo->prepare('INSERT INTO matches (competition_id, round, kickoff, home, away) VALUES (?, ?, ?, ?, ?)');
            foreach ($rows as $r) {
                $st->execute($r);
            }
        });
        respond(['imported' => count($rows), 'errors' => $errors]);

    case 'admin_result':
        require_method('POST');
        require_admin();
        $id = v_id(inp('match_id'), 'Spiel');
        $m = match_or_404($id);
        $hg = inp('home_goals');
        $ag = inp('away_goals');
        if (($hg === null || $hg === '') && ($ag === null || $ag === '')) {
            // gelöscht: ein automatischer Abruf darf das Ergebnis wieder eintragen
            q('UPDATE matches SET home_goals = NULL, away_goals = NULL, result_source = NULL WHERE id = ?', [$id]);
        } else {
            $hg = v_goals($hg, 'Tore Heim');
            $ag = v_goals($ag, 'Tore Gast');
            if (now_min() < (string)$m['kickoff']) {
                fail('Das Spiel hat noch nicht begonnen – ein Ergebnis kann erst nach dem Anstoß eingetragen werden.', 409);
            }
            q("UPDATE matches SET home_goals = ?, away_goals = ?, result_source = 'manual' WHERE id = ?", [$hg, $ag, $id]);
        }
        respond(['match' => match_base(match_or_404($id))]);

    case 'admin_invite_create':
        require_method('POST');
        require_admin();
        $note = v_str(inp('note'), 0, 100, 'Notiz');
        $max = v_int(inp('max_uses') ?? 1, 1, 1000, 'Anzahl Verwendungen');
        $exp = v_expires(inp('expires'));
        $code = '';
        for ($i = 0; $i < 10; $i++) {
            $code = random_string(TIPP_INVITE_ALPHABET, 8);
            if (!q('SELECT 1 FROM invites WHERE code = ?', [$code])->fetchColumn()) {
                break;
            }
        }
        q('INSERT INTO invites (code, note, max_uses, uses, expires, revoked, created) VALUES (?, ?, ?, 0, ?, 0, ?)', [$code, $note, $max, $exp, now_full()]);
        respond(['invite' => invite_out(q('SELECT * FROM invites WHERE code = ?', [$code])->fetch())]);

    case 'admin_invite_revoke':
        require_method('POST');
        require_admin();
        $code = norm_code(inp('code'));
        if ($code === '' || !q('SELECT 1 FROM invites WHERE code = ?', [$code])->fetchColumn()) {
            fail('Einladung nicht gefunden.', 404);
        }
        q('UPDATE invites SET revoked = 1 WHERE code = ?', [$code]);
        respond([]);

    case 'admin_player_update':
        require_method('POST');
        require_admin();
        $id = v_id(inp('id'));
        player_or_404($id);
        q('UPDATE players SET active = ? WHERE id = ?', [v_bool(inp('active'), 'Aktiv'), $id]);
        respond([]);

    case 'admin_player_reset':
        require_method('POST');
        require_admin();
        $id = v_id(inp('id'));
        player_or_404($id);
        $temp = random_string(TIPP_PW_ALPHABET, 10);
        q('UPDATE players SET password_hash = ? WHERE id = ?', [password_hash($temp, PASSWORD_DEFAULT), $id]);
        respond(['temp_password' => $temp]);

    case 'admin_player_delete':
        require_method('POST');
        require_admin();
        $id = v_id(inp('id'));
        player_or_404($id);
        tx(function (PDO $pdo) use ($id) {
            $pdo->prepare('DELETE FROM tips WHERE player_id = ?')->execute([$id]);
            $pdo->prepare('DELETE FROM bonus_tips WHERE player_id = ?')->execute([$id]);
            $pdo->prepare('DELETE FROM players WHERE id = ?')->execute([$id]);
        });
        respond([]);

    case 'admin_settings_save':
        require_method('POST');
        require_admin();
        $new = [
            'points_exact' => v_int(inp('points_exact'), 0, 50, 'Punkte exaktes Ergebnis'),
            'points_diff' => v_int(inp('points_diff'), 0, 50, 'Punkte Tordifferenz'),
            'points_tendency' => v_int(inp('points_tendency'), 0, 50, 'Punkte Tendenz'),
        ];
        if (!($new['points_exact'] >= $new['points_diff'] && $new['points_diff'] >= $new['points_tendency'])) {
            fail('Bitte so wählen: exaktes Ergebnis ≥ Tordifferenz ≥ Tendenz.', 400);
        }
        tx(function (PDO $pdo) use ($new) {
            $st = $pdo->prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value');
            foreach ($new as $k => $v) {
                $st->execute([$k, (string)$v]);
            }
        });
        respond(['settings' => settings()]);

    /* ------------------------------------------- Automatischer Abruf (OpenLigaDB) */

    case 'admin_source_preview':
        require_method('GET');
        require_admin();
        $league = v_league(inp('league'));
        $season = v_season(inp('season'));
        session_close_any();
        set_time_limit(60);
        try {
            $list = oldb_matches($league, $season, null, TIPP_SYNC_ADMIN_TIMEOUT);
        } catch (OldbException $e) {
            fail($e->getMessage(), 502);
        }
        if ($list === []) {
            fail('OpenLigaDB kennt für „' . $league . '“ in der Saison ' . season_label($season) . ' keine Spiele. Bitte Kürzel und Saison prüfen.', 404);
        }
        $norm = [];
        $rounds = [];
        $teams = [];
        $finished = 0;
        $leagueName = null;
        foreach ($list as $raw) {
            $x = oldb_match($raw);
            if ($x === null || isset($x['error'])) {
                continue;
            }
            $leagueName ??= oldb_text($raw['leagueName'] ?? '', 80) ?: null;
            $rounds[$x['round']] = true;
            $teams[lower($x['home'])] = true;
            $teams[lower($x['away'])] = true;
            if ($x['finished']) {
                $finished++;
            }
            $norm[] = $x;
        }
        usort($norm, fn($a, $b) => strcmp($a['kickoff'], $b['kickoff']));
        $now = now_min();
        $upcoming = array_values(array_filter($norm, fn($x) => $x['kickoff'] > $now));
        $current = null;
        try {
            $cg = oldb_get('/getcurrentgroup/' . rawurlencode($league), TIPP_SYNC_LAZY_TIMEOUT);
            if (is_array($cg) && isset($cg['groupName'])) {
                $current = ['name' => oldb_text($cg['groupName'], 60), 'order' => is_int($cg['groupOrderID'] ?? null) ? $cg['groupOrderID'] : null];
            }
        } catch (OldbException) {
            // optional
        }
        $pv = fn($x) => ['kickoff' => $x['kickoff'], 'home' => $x['home'], 'away' => $x['away'], 'round' => $x['round'],
            'result' => ($f = oldb_final($x, $x['kickoff'])) !== null ? ['home' => $f[0], 'away' => $f[1]] : null];
        respond([
            'league' => $league,
            'season' => $season,
            'season_label' => season_label($season),
            'league_name' => $leagueName,
            'match_count' => count($norm),
            'round_count' => count($rounds),
            'team_count' => count($teams),
            'finished' => $finished,
            'first_kickoff' => $norm[0]['kickoff'] ?? null,
            'last_kickoff' => $norm ? $norm[count($norm) - 1]['kickoff'] : null,
            'current_group' => $current,
            'matches' => array_map($pv, array_slice($upcoming ?: $norm, 0, 5)),
        ]);

    case 'admin_sync':
        require_method('POST');
        require_admin();
        $cid = v_id(inp('competition_id'), 'Wettbewerb');
        $scope = inp('scope') ?? 'window';
        if (!in_array($scope, ['window', 'season'], true)) {
            fail('Umfang: „window“ oder „season“.', 400);
        }
        $c = competition_or_404($cid);
        if (($c['source'] ?? null) !== 'openligadb') {
            fail('Für diesen Wettbewerb ist kein automatischer Abruf eingerichtet.', 400);
        }
        set_time_limit(90);
        $fh = sync_lock(true);
        $err = null;
        try {
            $r = run_sync(competition_or_404($cid), $scope, TIPP_SYNC_ADMIN_TIMEOUT);
        } catch (OldbException $e) {
            $err = $e->getMessage();
        } finally {
            sync_unlock($fh);
        }
        if ($err !== null) {
            $c = competition_or_404($cid);
            fail($err, 502, ['last_sync' => $c['last_sync'], 'last_sync_status' => $c['last_sync_status']]);
        }
        respond($r);

    case 'admin_cron_info':
        require_method('GET');
        require_admin();
        respond(cron_info());

    case 'admin_cron_token_reset':
        require_method('POST');
        require_admin();
        cron_token_reset();
        respond(cron_info());

    case 'cron_sync':
        // Für den Cronjob des Webhosters (alle 15 Min.): …/cms/tipp-api.php?action=cron_sync&token=…
        require_method('GET');
        $lock = bf_locked([bf_key('cron')]);
        if ($lock > 0) {
            fail_locked($lock);
        }
        $tok = inp('token');
        $have = is_file(TIPP_CRON_FILE) ? cron_token() : '';
        if ($have === '' || !is_string($tok) || !hash_equals($have, $tok)) {
            bf_fail(bf_key('cron'), 10);
            usleep(random_int(200000, 500000));
            fail('Ungültiger Token.', 403);
        }
        set_time_limit(300);
        $fh = sync_lock(true);
        $out = [];
        try {
            foreach (q("SELECT * FROM competitions WHERE source = 'openligadb' AND active = 1 ORDER BY sort, id")->fetchAll() as $c) {
                try {
                    $r = run_sync($c, 'window', TIPP_SYNC_ADMIN_TIMEOUT);
                    $out[] = ['id' => (int)$c['id'], 'name' => (string)$c['name'], 'ok' => true, 'inserted' => $r['inserted'], 'updated' => $r['updated'],
                        'results' => $r['results'], 'skipped_manual' => $r['skipped_manual'], 'errors' => count($r['errors']), 'status' => $r['last_sync_status']];
                } catch (OldbException $e) {
                    $out[] = ['id' => (int)$c['id'], 'name' => (string)$c['name'], 'ok' => false, 'status' => 'Fehler: ' . $e->getMessage()];
                }
            }
        } finally {
            sync_unlock($fh);
        }
        $summary = $out ? implode(' · ', array_map(fn($o) => $o['name'] . ': ' . $o['status'], $out)) : 'Kein aktiver Wettbewerb mit automatischem Abruf.';
        $okAll = !array_filter($out, fn($o) => !$o['ok']);
        q("INSERT INTO settings (key, value) VALUES ('cron_last', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            [json_encode(['time' => now_full(), 'ok' => $okAll, 'status' => $summary], JSON_UNESCAPED_UNICODE)]);
        respond(['time' => now_full(), 'competitions' => $out, 'summary' => $summary]);

    default:
        fail('Unbekannte Aktion.', 400);
}
