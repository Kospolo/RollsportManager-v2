<?php
/*
 * Hofbräustüble – Team-API (Dienstplan / Mitarbeiter-Kalender)
 * PHP 8 + PDO SQLite. Datenbank: cms/data/team.sqlite (wird automatisch angelegt).
 * Vertrag: team/SPEC.md
 *
 * Mitarbeiter-Session: eigener Session-Name HBS_TEAM (Ordner cms/data/team-sessions).
 * Chef-Aktionen (chef_*): prüfen die bestehende CMS-Session (HBSCMS, wie cms/api.php) + deren CSRF-Token.
 * Kalender-Abo: GET ?action=ical&token=… (geheimer Token je Mitarbeiter, ohne Session).
 * Globaler Schalter: cms/content.json → features.team (fehlt = an). Aus → Mitarbeiter-Aktionen 403, Chef arbeitet weiter.
 */
declare(strict_types=1);

define('HBS_CMS', true); // erlaubt das Einlesen von cms/config.php (Sitzungsdauer der Verwaltung)

const TEAM_DB_VERSION       = 1;
const TEAM_SESSION_NAME     = 'HBS_TEAM';
const TEAM_SESSION_DAYS     = 30;      // so lange bleibt man am Handy angemeldet (gleitend)
const TEAM_CMS_SESSION_NAME = 'HBSCMS';
const TEAM_BF_WINDOW        = 900;     // Fehlversuche innerhalb von 15 Minuten …
const TEAM_BF_LOCK          = 900;     // … führen zu 15 Minuten Sperre
const TEAM_BF_NAME_FAILS    = 5;       // pro IP + Name
const TEAM_BF_IP_FAILS      = 20;      // pro IP
const TEAM_BF_CODE_FAILS    = 15;      // falsche Einladungscodes pro IP
const TEAM_BF_ICAL_FAILS    = 30;      // falsche Kalender-Tokens pro IP
const TEAM_MAX_BODY         = 65536;
const TEAM_MSG_MAX          = 1000;    // Zeichen pro Nachricht
const TEAM_MSG_RATE         = 30;      // Nachrichten …
const TEAM_MSG_WINDOW       = 600;     // … je 10 Minuten
const TEAM_INVITE_ALPHABET  = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // ohne 0/O/1/I
const TEAM_PW_ALPHABET      = 'abcdefghjkmnpqrstuvwxyz23456789';
const TEAM_NAME_RE          = '/^[\p{L}][\p{L} .\'\-]*$/u';
const TEAM_PHONE_RE         = '/^\+?[0-9 ()\/\-]{4,30}$/';
const TEAM_AVAIL_DAYS       = 63;      // Verfügbarkeit: heute + 9 Wochen (UI zeigt 8 Wochen ab Montag)
const TEAM_MAX_RANGE        = 62;      // Tage je Plan-Abfrage
const TEAM_MAX_REPEAT       = 53;      // Wiederholungen („jeden Freitag bis …“)
const TEAM_TICK_BEFORE_MIN  = 120;     // Aufgaben abhaken: ab 2 Std. vor Schichtbeginn …
const TEAM_TICK_AFTER_MIN   = 720;     // … bis 12 Std. nach Schichtende
const TEAM_MODULES          = ['availability', 'swap', 'tasks', 'hours', 'board', 'ical', 'orders'];
const TEAM_ORDER_CATS       = ['getraenke', 'kueche', 'putzmittel', 'sonstiges'];
const TEAM_ORDER_STATUS     = ['low', 'ordered', 'delivered'];
const TEAM_ABSENCE_TYPES    = ['urlaub', 'krank', 'sonstiges'];
const TEAM_DEFAULT_SETTINGS = [
    'modules' => ['availability' => true, 'swap' => true, 'tasks' => true, 'hours' => true, 'board' => true, 'ical' => true, 'orders' => true],
    'swap_needs_chef' => true,       // Tausch muss vom Chef bestätigt werden
    'take_needs_ok' => false,        // Vorgabe für neue offene Schichten: „nur nach Bestätigung“
    'minijob_limit_cents' => 60300,  // Minijob-Grenze (Stand 2026: 603 €) – bitte selbst prüfen
    'labels' => ['Theke', 'Aufbau', 'Putzen', 'Veranstaltung'],
];

define('TEAM_CMS_DIR', __DIR__);
define('TEAM_DATA_DIR', __DIR__ . '/data');
define('TEAM_DB_FILE', TEAM_DATA_DIR . '/team.sqlite');

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
    error_log('[hbs-team] ' . $e->getMessage() . ' in ' . $e->getFile() . ':' . $e->getLine());
    if (!headers_sent()) {
        http_response_code(500);
        header('Content-Type: application/json; charset=utf-8');
    }
    echo json_encode(['ok' => false, 'api' => 'hbs-team', 'error' => 'Interner Serverfehler. Bitte später noch mal versuchen.'], JSON_UNESCAPED_UNICODE);
});

/* ================================================================== Hilfen */

function respond(array $data, int $code = 200): never
{
    http_response_code($code);
    echo json_encode(['ok' => true, 'api' => 'hbs-team'] + $data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function fail(string $message, int $code = 400, array $extra = []): never
{
    http_response_code($code);
    echo json_encode(['ok' => false, 'api' => 'hbs-team', 'error' => $message] + $extra, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
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

function now_full(): string { return date('Y-m-d H:i:s'); }
function today(): string { return date('Y-m-d'); }

function lower(string $s): string
{
    return function_exists('mb_strtolower') ? mb_strtolower($s, 'UTF-8') : strtr(strtolower($s), ['Ä' => 'ä', 'Ö' => 'ö', 'Ü' => 'ü']);
}

function str_len(string $s): int
{
    return (int)preg_match_all('/./us', $s);
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

function date_add_days(string $date, int $days): string
{
    return (new DateTimeImmutable($date . ' 12:00:00'))->modify(($days >= 0 ? '+' : '') . $days . ' days')->format('Y-m-d');
}

function days_between(string $a, string $b): int
{
    return (int)round(((new DateTimeImmutable($b . ' 12:00:00'))->getTimestamp() - (new DateTimeImmutable($a . ' 12:00:00'))->getTimestamp()) / 86400);
}

/** Beginn/Ende einer Schicht als Unix-Zeit (echte Berliner Zeit, Ende über Mitternacht → Folgetag) */
function shift_bounds(string $date, string $start, string $end): array
{
    $s = (new DateTimeImmutable("$date $start:00"))->getTimestamp();
    $endDate = $end <= $start ? date_add_days($date, 1) : $date;
    $e = (new DateTimeImmutable("$endDate $end:00"))->getTimestamp();
    return [$s, max($e, $s + 60)];
}

function shift_minutes(array $sh): int
{
    [$s, $e] = shift_bounds((string)$sh['date'], (string)$sh['start'], (string)$sh['end']);
    return (int)round(($e - $s) / 60);
}

function cents_out(?int $c): ?float
{
    return $c === null ? null : round($c / 100, 2);
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
    if ((int)($_SERVER['CONTENT_LENGTH'] ?? 0) > TEAM_MAX_BODY) {
        fail('Die Daten sind zu groß.', 413);
    }
    $raw = (string)file_get_contents('php://input', false, null, 0, TEAM_MAX_BODY + 1);
    if (strlen($raw) > TEAM_MAX_BODY) {
        fail('Die Daten sind zu groß.', 413);
    }
    if (trim($raw) === '') {
        return $body = [];
    }
    $data = json_decode($raw, true, 16);
    if (!is_array($data) || ($data !== [] && array_is_list($data))) {
        fail('Ungültige Daten.', 400);
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

function v_bool(mixed $v, string $label): bool
{
    if ($v === true || $v === 1 || $v === '1' || $v === 'true') {
        return true;
    }
    if ($v === false || $v === 0 || $v === '0' || $v === 'false') {
        return false;
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
        $v = (string)preg_replace("/\n{3,}/", "\n\n", $v);
    } else {
        $v = (string)preg_replace('/\s+/u', ' ', $v);
    }
    $v = trim($v);
    $len = str_len($v);
    if ($len < $min) {
        fail($min <= 1 ? "Bitte $label ausfüllen." : "$label muss mindestens $min Zeichen lang sein.", 400);
    }
    if ($len > $max) {
        fail("$label ist zu lang (höchstens $max Zeichen).", 400);
    }
    return $v;
}

function v_date(mixed $v, string $label = 'Datum'): string
{
    if (is_string($v) && preg_match('/^(\d{4})-(\d{2})-(\d{2})$/', trim($v), $m)
        && checkdate((int)$m[2], (int)$m[3], (int)$m[1]) && (int)$m[1] >= 2000 && (int)$m[1] <= 2100) {
        return trim($v);
    }
    fail("$label: bitte ein gültiges Datum wählen.", 400);
}

function v_time(mixed $v, string $label): string
{
    if (is_string($v) && preg_match('/^([01]?\d|2[0-3]):([0-5]\d)$/', trim($v), $m)) {
        return sprintf('%02d:%02d', (int)$m[1], (int)$m[2]);
    }
    fail("$label: bitte eine Uhrzeit wie 18:00 angeben.", 400);
}

function v_month(mixed $v): string
{
    if (is_string($v) && preg_match('/^(\d{4})-(0[1-9]|1[0-2])$/', $v)) {
        return $v;
    }
    return date('Y-m');
}

/** Geldbetrag in Euro („12,82“, „12.82“, 12.82) → Cent; leer → null */
function v_money(mixed $v, string $label, int $maxCents): ?int
{
    if ($v === null || $v === '') {
        return null;
    }
    if (is_int($v) || is_float($v)) {
        $f = (float)$v;
    } elseif (is_string($v) && preg_match('/^\s*(\d{1,6})(?:[.,](\d{1,2}))?\s*(€|eur)?\s*$/i', $v, $m)) {
        $f = (float)($m[1] . '.' . str_pad($m[2] ?? '0', 2, '0'));
    } else {
        fail("$label: bitte einen Betrag wie 13,90 angeben.", 400);
    }
    $c = (int)round($f * 100);
    if ($c < 0 || $c > $maxCents) {
        fail("$label ist nicht plausibel.", 400);
    }
    return $c;
}

function v_name(mixed $v): string
{
    $n = v_str($v, 2, 30, 'dein Name');
    if (!preg_match(TEAM_NAME_RE, $n)) {
        fail('Der Name darf nur Buchstaben, Leerzeichen, Punkt und Bindestrich enthalten.', 400);
    }
    return $n;
}

function v_phone(mixed $v): ?string
{
    $p = v_str($v, 0, 30, 'Telefonnummer');
    if ($p === '') {
        return null;
    }
    if (!preg_match(TEAM_PHONE_RE, $p)) {
        fail('Die Telefonnummer sieht nicht richtig aus (nur Ziffern, Leerzeichen, + - / ( )).', 400);
    }
    return $p;
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
        fail('Der Dienstplan braucht die PHP-Erweiterung „pdo_sqlite“. Bitte im Kundenmenü des Hosters aktivieren.', 500, ['setup' => 'pdo_sqlite']);
    }
    if (!ensure_dir(TEAM_DATA_DIR) || !is_writable(TEAM_DATA_DIR)) {
        fail('Der Ordner cms/data ist nicht beschreibbar. Bitte Schreibrechte setzen (755 bzw. 775).', 500, ['setup' => 'data_dir']);
    }
    $isNew = !is_file(TEAM_DB_FILE);
    $pdo = new PDO('sqlite:' . TEAM_DB_FILE, null, null, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);
    $pdo->exec('PRAGMA busy_timeout = 5000');
    try {
        $pdo->query('PRAGMA journal_mode = WAL')->fetchColumn();
    } catch (Throwable) {
        // Netzwerk-Dateisystem ohne WAL: Standard-Journal genügt
    }
    $pdo->exec('PRAGMA foreign_keys = ON');
    $pdo->exec('PRAGMA synchronous = NORMAL');
    if ($isNew) {
        @chmod(TEAM_DB_FILE, 0640);
    }
    if ((int)$pdo->query('PRAGMA user_version')->fetchColumn() < TEAM_DB_VERSION) {
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
                CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
                CREATE TABLE IF NOT EXISTS staff (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL,
                    name_key TEXT NOT NULL UNIQUE,
                    password_hash TEXT NOT NULL,
                    phone TEXT,
                    phone_visible INTEGER NOT NULL DEFAULT 0,
                    active INTEGER NOT NULL DEFAULT 1,
                    wage_cents INTEGER,
                    limit_cents INTEGER,
                    ical_token TEXT NOT NULL,
                    created TEXT NOT NULL,
                    last_login TEXT
                );
                CREATE TABLE IF NOT EXISTS invites (
                    code TEXT PRIMARY KEY,
                    note TEXT NOT NULL DEFAULT '',
                    expires TEXT,
                    used_by INTEGER,
                    used_at TEXT,
                    revoked INTEGER NOT NULL DEFAULT 0,
                    created TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS shifts (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    date TEXT NOT NULL,
                    start TEXT NOT NULL,
                    "end" TEXT NOT NULL,
                    label TEXT NOT NULL DEFAULT '',
                    note TEXT NOT NULL DEFAULT '',
                    staff_id INTEGER REFERENCES staff(id) ON DELETE SET NULL,
                    response TEXT NOT NULL DEFAULT 'none',
                    reason TEXT NOT NULL DEFAULT '',
                    responded_at TEXT,
                    needs_ok INTEGER NOT NULL DEFAULT 0,
                    former INTEGER NOT NULL DEFAULT 0,
                    series_id TEXT,
                    created TEXT NOT NULL,
                    updated TEXT NOT NULL
                );
                CREATE INDEX IF NOT EXISTS shifts_date ON shifts(date);
                CREATE INDEX IF NOT EXISTS shifts_staff ON shifts(staff_id, date);
                CREATE TABLE IF NOT EXISTS takes (
                    shift_id INTEGER NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
                    staff_id INTEGER NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
                    created TEXT NOT NULL,
                    PRIMARY KEY (shift_id, staff_id)
                );
                CREATE TABLE IF NOT EXISTS absences (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    staff_id INTEGER NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
                    date_from TEXT NOT NULL,
                    date_to TEXT NOT NULL,
                    type TEXT NOT NULL,
                    note TEXT NOT NULL DEFAULT '',
                    status TEXT NOT NULL DEFAULT 'pending',
                    chef_comment TEXT NOT NULL DEFAULT '',
                    created TEXT NOT NULL,
                    decided_at TEXT
                );
                CREATE INDEX IF NOT EXISTS absences_staff ON absences(staff_id, date_from);
                CREATE TABLE IF NOT EXISTS availability (
                    staff_id INTEGER NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
                    date TEXT NOT NULL,
                    value TEXT NOT NULL,
                    PRIMARY KEY (staff_id, date)
                );
                CREATE TABLE IF NOT EXISTS swaps (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    shift_id INTEGER NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
                    from_staff INTEGER NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
                    to_staff INTEGER REFERENCES staff(id) ON DELETE CASCADE,
                    taker_id INTEGER REFERENCES staff(id) ON DELETE CASCADE,
                    status TEXT NOT NULL,
                    note TEXT NOT NULL DEFAULT '',
                    created TEXT NOT NULL,
                    updated TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS messages (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    staff_id INTEGER NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
                    from_chef INTEGER NOT NULL,
                    body TEXT NOT NULL,
                    created TEXT NOT NULL,
                    read_at TEXT
                );
                CREATE INDEX IF NOT EXISTS messages_staff ON messages(staff_id, id);
                CREATE TABLE IF NOT EXISTS board (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    title TEXT NOT NULL DEFAULT '',
                    body TEXT NOT NULL,
                    created TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS board_reads (
                    post_id INTEGER NOT NULL REFERENCES board(id) ON DELETE CASCADE,
                    staff_id INTEGER NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
                    read_at TEXT NOT NULL,
                    PRIMARY KEY (post_id, staff_id)
                );
                CREATE TABLE IF NOT EXISTS checklists (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL,
                    label TEXT NOT NULL DEFAULT '',
                    items TEXT NOT NULL,
                    created TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS checks (
                    shift_id INTEGER NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
                    checklist_id INTEGER NOT NULL REFERENCES checklists(id) ON DELETE CASCADE,
                    item_id TEXT NOT NULL,
                    staff_id INTEGER REFERENCES staff(id) ON DELETE SET NULL,
                    done_at TEXT NOT NULL,
                    PRIMARY KEY (shift_id, checklist_id, item_id)
                );
                CREATE TABLE IF NOT EXISTS order_catalog (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL,
                    category TEXT NOT NULL,
                    qty TEXT NOT NULL DEFAULT ''
                );
                CREATE TABLE IF NOT EXISTS order_items (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL,
                    qty TEXT NOT NULL DEFAULT '',
                    note TEXT NOT NULL DEFAULT '',
                    category TEXT NOT NULL,
                    catalog_id INTEGER REFERENCES order_catalog(id) ON DELETE SET NULL,
                    status TEXT NOT NULL DEFAULT 'low',
                    created_by INTEGER REFERENCES staff(id) ON DELETE SET NULL,
                    by_chef INTEGER NOT NULL DEFAULT 0,
                    created TEXT NOT NULL,
                    updated TEXT NOT NULL
                );
                CREATE INDEX IF NOT EXISTS order_items_status ON order_items(status, updated);
                CREATE TABLE IF NOT EXISTS attempts (
                    k TEXT PRIMARY KEY,
                    count INTEGER NOT NULL,
                    first INTEGER NOT NULL,
                    last INTEGER NOT NULL,
                    locked_until INTEGER NOT NULL DEFAULT 0
                );
                PRAGMA user_version = 1;
            SQL);
        }
        $pdo->exec('COMMIT');
    } catch (Throwable $e) {
        $pdo->exec('ROLLBACK');
        throw $e;
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

function settings(): array
{
    static $cache = null;
    if ($cache !== null) {
        return $cache;
    }
    $s = TEAM_DEFAULT_SETTINGS;
    $raw = q("SELECT value FROM settings WHERE key = 'config'")->fetchColumn();
    $d = is_string($raw) ? json_decode($raw, true) : null;
    if (is_array($d)) {
        foreach (TEAM_MODULES as $m) {
            if (isset($d['modules'][$m]) && is_bool($d['modules'][$m])) {
                $s['modules'][$m] = $d['modules'][$m];
            }
        }
        foreach (['swap_needs_chef', 'take_needs_ok'] as $k) {
            if (isset($d[$k]) && is_bool($d[$k])) {
                $s[$k] = $d[$k];
            }
        }
        if (isset($d['minijob_limit_cents']) && is_int($d['minijob_limit_cents'])) {
            $s['minijob_limit_cents'] = $d['minijob_limit_cents'];
        }
        if (isset($d['labels']) && is_array($d['labels'])) {
            $s['labels'] = array_values(array_filter($d['labels'], 'is_string'));
        }
    }
    return $cache = $s;
}

function settings_save(array $s): void
{
    q("INSERT INTO settings (key, value) VALUES ('config', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        [json_encode($s, JSON_UNESCAPED_UNICODE)]);
}

function module_on(string $m): bool
{
    return !empty(settings()['modules'][$m]);
}

function require_module(string $m): void
{
    if (!module_on($m)) {
        fail('Diese Funktion ist zurzeit ausgeschaltet.', 403, ['module' => $m]);
    }
}

function public_settings(): array
{
    $s = settings();
    return [
        'modules' => $s['modules'],
        'swap_needs_chef' => $s['swap_needs_chef'],
        'take_needs_ok' => $s['take_needs_ok'],
        'labels' => $s['labels'],
        'minijob_limit' => cents_out($s['minijob_limit_cents']),
    ];
}

/** Globaler Schalter aus der Website-Verwaltung: content.json → features.team (fehlt/kaputt = an) */
function team_enabled(): bool
{
    static $on = null;
    if ($on !== null) {
        return $on;
    }
    $file = TEAM_CMS_DIR . '/content.json';
    $raw = is_file($file) ? @file_get_contents($file, false, null, 0, 4 * 1024 * 1024) : false;
    $d = is_string($raw) ? json_decode($raw, true) : null;
    $v = is_array($d) && isset($d['features']) && is_array($d['features']) && array_key_exists('team', $d['features']) ? $d['features']['team'] : true;
    return $on = !($v === false || $v === 0 || $v === '0' || $v === 'false');
}

function require_team_enabled(): void
{
    if (!team_enabled()) {
        fail('Der Team-Bereich ist im Moment ausgeschaltet.', 403, ['teamDisabled' => true]);
    }
}

/* ============================================================ Brute-Force */

function ip_hash(): string
{
    return substr(hash('sha256', 'hbs-team|' . (string)($_SERVER['REMOTE_ADDR'] ?? 'unknown')), 0, 32);
}

function bf_key(string $kind, string $extra = ''): string
{
    return $kind . ':' . substr(hash('sha256', ip_hash() . '|' . $extra), 0, 32);
}

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

/** Fehlversuch zählen; true = dadurch gesperrt */
function bf_fail(string $key, int $maxFails, int $window = TEAM_BF_WINDOW, int $lock = TEAM_BF_LOCK): bool
{
    $now = time();
    return (bool)tx(function (PDO $pdo) use ($key, $maxFails, $now, $window, $lock) {
        $st = $pdo->prepare('SELECT count, first FROM attempts WHERE k = ?');
        $st->execute([$key]);
        $e = $st->fetch() ?: ['count' => 0, 'first' => $now];
        if ($now - (int)$e['first'] > $window) {
            $e = ['count' => 0, 'first' => $now];
        }
        $count = (int)$e['count'] + 1;
        $first = (int)$e['first'];
        $locked = 0;
        if ($count >= $maxFails) {
            $locked = $now + $lock;
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
    fail('Zu viele Fehlversuche. Bitte in ' . max(1, (int)ceil($seconds / 60)) . ' Minute(n) noch mal versuchen.', 429, ['retryAfter' => $seconds]);
}

/** Einfache Mengenbremse (z. B. Nachrichten): true = Grenze erreicht */
function rate_limited(string $key, int $max, int $window): bool
{
    if (bf_locked([$key]) > 0) {
        return true;
    }
    bf_fail($key, $max + 1, $window, $window);
    return false;
}

/* ======================================================= Mitarbeiter-Session */

function cookie_path(): string
{
    return rtrim(str_replace('\\', '/', dirname((string)($_SERVER['SCRIPT_NAME'] ?? '/cms/team-api.php'))), '/') . '/';
}

function valid_sid(mixed $v): bool
{
    return is_string($v) && preg_match('/^[A-Za-z0-9,\-]{22,256}$/', $v) === 1;
}

function session_close_any(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) {
        session_write_close();
    }
}

/** Team-Session öffnen. Ohne $create nur, wenn bereits ein HBS_TEAM-Cookie existiert. */
function team_session_open(bool $create): bool
{
    if (session_status() === PHP_SESSION_ACTIVE) {
        if (session_name() === TEAM_SESSION_NAME) {
            return true;
        }
        session_write_close();
    }
    $cookie = $_COOKIE[TEAM_SESSION_NAME] ?? null;
    if (!$create && !valid_sid($cookie)) {
        return false;
    }
    $lifetime = TEAM_SESSION_DAYS * 86400;
    $dir = TEAM_DATA_DIR . '/team-sessions';
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
    session_name(TEAM_SESSION_NAME);
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

/** Angemeldete Person ermitteln (Konto aktiv + Passwort unverändert) */
function current_staff(): ?array
{
    static $cache = false;
    if ($cache !== false) {
        return $cache;
    }
    if (!team_session_open(false)) {
        return $cache = null;
    }
    $sid = (int)($_SESSION['sid'] ?? 0);
    $p = $sid > 0 && time() - (int)($_SESSION['last'] ?? 0) <= TEAM_SESSION_DAYS * 86400
        ? q('SELECT * FROM staff WHERE id = ?', [$sid])->fetch()
        : false;
    if (!$p || !(int)$p['active'] || !hash_equals(pw_stamp((string)$p['password_hash']), (string)($_SESSION['stamp'] ?? ''))) {
        end_staff_session();
        return $cache = null;
    }
    $now = time();
    if ($now - (int)($_SESSION['refreshed'] ?? 0) > 86400) {
        $prm = session_get_cookie_params();
        setcookie(session_name(), session_id(), ['expires' => $now + TEAM_SESSION_DAYS * 86400, 'path' => $prm['path'], 'secure' => $prm['secure'], 'httponly' => true, 'samesite' => 'Strict']);
        $_SESSION['refreshed'] = $now;
    }
    $_SESSION['last'] = $now;
    return $cache = $p;
}

function check_csrf(string $expected): void
{
    $sent = (string)($_SERVER['HTTP_X_CSRF_TOKEN'] ?? '');
    if ($expected === '' || $sent === '' || !hash_equals($expected, $sent)) {
        fail('Sicherheits-Token ungültig. Bitte lade die Seite neu.', 403, ['csrfInvalid' => true]);
    }
}

function require_staff(): array
{
    $p = current_staff();
    if ($p === null) {
        fail('Bitte melde dich an.', 401, ['loggedIn' => false]);
    }
    if (method() === 'POST') {
        check_csrf((string)($_SESSION['csrf'] ?? ''));
    }
    return $p;
}

function login_session(int $id, string $hash): void
{
    team_session_open(true);
    session_regenerate_id(true);
    $_SESSION = [
        'sid' => $id,
        'stamp' => pw_stamp($hash),
        'csrf' => bin2hex(random_bytes(32)),
        'since' => time(),
        'last' => time(),
        'refreshed' => time(),
    ];
}

function end_staff_session(): void
{
    if (session_status() === PHP_SESSION_ACTIVE && session_name() === TEAM_SESSION_NAME) {
        $_SESSION = [];
        $p = session_get_cookie_params();
        setcookie(session_name(), '', ['expires' => time() - 3600, 'path' => $p['path'], 'secure' => $p['secure'], 'httponly' => true, 'samesite' => 'Strict']);
        session_destroy();
    }
}

/* ========================================================= Chef (CMS-Session) */

/**
 * Liest die CMS-Session genau wie cms/api.php (Name HBSCMS, Ordner cms/data/sessions, Cookie-Pfad /cms/)
 * und schließt sie sofort wieder. → ['auth' => bool, 'csrf' => string]
 */
function cms_chef_state(bool $touch = true): array
{
    static $state = null;
    if ($state !== null) {
        return $state;
    }
    $cookie = $_COOKIE[TEAM_CMS_SESSION_NAME] ?? null;
    if (!valid_sid($cookie)) {
        return $state = ['auth' => false, 'csrf' => ''];
    }
    session_close_any();
    $cfg = [];
    $cfgFile = TEAM_CMS_DIR . '/config.php';
    if (is_file($cfgFile)) {
        $c = require $cfgFile;
        $cfg = is_array($c) ? $c : [];
    }
    $idle = max(10, (int)($cfg['session_idle_minutes'] ?? 240)) * 60;
    $dir = TEAM_DATA_DIR . '/sessions';
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
    session_name(TEAM_CMS_SESSION_NAME);
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
        $_SESSION['last'] = time(); // Arbeit im Dienstplan hält die Verwaltung angemeldet
        session_write_close();
    } else {
        session_abort();
    }
    $_SESSION = [];
    return $state = ['auth' => $auth, 'csrf' => $auth ? $csrf : ''];
}

function require_chef(): void
{
    $st = cms_chef_state();
    if (!$st['auth']) {
        fail('Die Chef-Ansicht braucht eine Anmeldung in der Verwaltung.', 401, ['loggedIn' => false, 'chef' => true]);
    }
    if (method() === 'POST') {
        check_csrf($st['csrf']);
    }
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

function find_staff_by_name(string $name): ?array
{
    $p = q('SELECT * FROM staff WHERE name_key = ?', [lower($name)])->fetch();
    return $p ?: null;
}

function staff_or_404(int $id): array
{
    $p = q('SELECT * FROM staff WHERE id = ?', [$id])->fetch();
    if (!$p) {
        fail('Mitarbeiter nicht gefunden.', 404);
    }
    return $p;
}

function shift_or_404(int $id): array
{
    $s = q('SELECT * FROM shifts WHERE id = ?', [$id])->fetch();
    if (!$s) {
        fail('Schicht nicht gefunden.', 404);
    }
    return $s;
}

function invite_valid(array $inv): bool
{
    if ((int)$inv['revoked'] || $inv['used_at'] !== null) {
        return false;
    }
    return $inv['expires'] === null || $inv['expires'] === '' || today() <= (string)$inv['expires'];
}

function invite_out(array $i): array
{
    return [
        'code' => (string)$i['code'],
        'note' => (string)$i['note'],
        'expires' => $i['expires'] !== null ? (string)$i['expires'] : null,
        'used' => $i['used_at'] !== null,
        'used_at' => $i['used_at'],
        'used_by' => $i['used_by'] !== null ? (int)$i['used_by'] : null,
        'revoked' => (bool)$i['revoked'],
        'created' => (string)$i['created'],
        'valid' => invite_valid($i),
    ];
}

function new_ical_token(): string
{
    return bin2hex(random_bytes(32)); // 256 Bit
}

function effective_limit(array $staff): int
{
    return $staff['limit_cents'] !== null ? (int)$staff['limit_cents'] : (int)settings()['minijob_limit_cents'];
}

function staff_names(): array
{
    $out = [];
    foreach (q('SELECT id, name FROM staff')->fetchAll() as $r) {
        $out[(int)$r['id']] = (string)$r['name'];
    }
    return $out;
}

function absence_type_text(string $t): string
{
    return ['urlaub' => 'Urlaub', 'krank' => 'krank', 'sonstiges' => 'abwesend'][$t] ?? 'abwesend';
}

/* ====================================================== Schichten aufbereiten */

function shift_status(array $sh, int $requests): string
{
    if ($sh['staff_id'] === null) {
        return $requests > 0 ? 'requested' : 'open';
    }
    return (string)$sh['response']; // none | yes | no
}

function shift_is_past(array $sh): bool
{
    return shift_bounds((string)$sh['date'], (string)$sh['start'], (string)$sh['end'])[1] < time();
}

/** Schichten im Zeitraum (inkl. Vortag wegen Mitternacht) */
function load_shifts(string $from, string $to): array
{
    return q('SELECT * FROM shifts WHERE date BETWEEN ? AND ? ORDER BY date, start, id', [$from, $to])->fetchAll();
}

function takes_by_shift(array $shiftIds): array
{
    $out = [];
    if (!$shiftIds) {
        return $out;
    }
    $in = implode(',', array_map('intval', $shiftIds));
    foreach (q("SELECT shift_id, staff_id, created FROM takes WHERE shift_id IN ($in) ORDER BY created")->fetchAll() as $r) {
        $out[(int)$r['shift_id']][] = ['staff_id' => (int)$r['staff_id'], 'created' => (string)$r['created']];
    }
    return $out;
}

function active_swaps_by_shift(array $shiftIds): array
{
    $out = [];
    if (!$shiftIds) {
        return $out;
    }
    $in = implode(',', array_map('intval', $shiftIds));
    foreach (q("SELECT * FROM swaps WHERE shift_id IN ($in) AND status IN ('offered','accepted')")->fetchAll() as $r) {
        $out[(int)$r['shift_id']] = $r;
    }
    return $out;
}

/** Checklisten, die zu einer Schicht passen (Bezeichnung oder „alle Schichten“) */
function checklists_all(): array
{
    $out = [];
    foreach (q('SELECT * FROM checklists ORDER BY id')->fetchAll() as $c) {
        $items = json_decode((string)$c['items'], true);
        $out[] = ['id' => (int)$c['id'], 'name' => (string)$c['name'], 'label' => (string)$c['label'], 'items' => is_array($items) ? $items : []];
    }
    return $out;
}

function checklists_for(array $sh, array $lists): array
{
    return array_values(array_filter($lists, fn($c) => $c['label'] === '' || lower($c['label']) === lower((string)$sh['label'])));
}

function checks_by_shift(array $shiftIds): array
{
    $out = [];
    if (!$shiftIds) {
        return $out;
    }
    $in = implode(',', array_map('intval', $shiftIds));
    foreach (q("SELECT * FROM checks WHERE shift_id IN ($in)")->fetchAll() as $r) {
        $out[(int)$r['shift_id']][(int)$r['checklist_id'] . ':' . $r['item_id']] = $r;
    }
    return $out;
}

function shift_tasks(array $sh, array $lists, array $checks, array $names): array
{
    $out = [];
    $done = 0;
    $total = 0;
    foreach (checklists_for($sh, $lists) as $c) {
        $items = [];
        foreach ($c['items'] as $it) {
            $ck = $checks[(int)$sh['id']][$c['id'] . ':' . $it['id']] ?? null;
            $items[] = [
                'id' => (string)$it['id'],
                'text' => (string)$it['text'],
                'done' => $ck !== null,
                'by' => $ck && $ck['staff_id'] !== null ? ($names[(int)$ck['staff_id']] ?? null) : null,
                'at' => $ck ? (string)$ck['done_at'] : null,
            ];
            $total++;
            $done += $ck !== null ? 1 : 0;
        }
        $out[] = ['id' => $c['id'], 'name' => $c['name'], 'items' => $items];
    }
    return ['lists' => $out, 'done' => $done, 'total' => $total];
}

/**
 * Konflikte einer Schicht (für den Chef und für die eigene Schicht):
 * overlap (gleiche Person, Zeit überschneidet sich), absence (genehmigt), absence_pending, unavailable, maybe, inactive
 */
function shift_conflicts(array $sh, array $staffShifts, array $absences, array $avail, ?array $staffRow): array
{
    $out = [];
    if ($sh['staff_id'] === null || $sh['response'] === 'no') {
        return $out;
    }
    $sid = (int)$sh['staff_id'];
    [$s1, $e1] = shift_bounds((string)$sh['date'], (string)$sh['start'], (string)$sh['end']);
    foreach ($staffShifts[$sid] ?? [] as $o) {
        if ((int)$o['id'] === (int)$sh['id'] || $o['response'] === 'no') {
            continue;
        }
        [$s2, $e2] = shift_bounds((string)$o['date'], (string)$o['start'], (string)$o['end']);
        if ($s1 < $e2 && $s2 < $e1) {
            $out[] = ['type' => 'overlap', 'text' => 'Überschneidet sich mit einer anderen Schicht (' . $o['start'] . '–' . $o['end'] . ')', 'shift_id' => (int)$o['id']];
        }
    }
    foreach ($absences[$sid] ?? [] as $a) {
        if ($a['date_from'] <= $sh['date'] && $a['date_to'] >= $sh['date']) {
            if ($a['status'] === 'approved') {
                $out[] = ['type' => 'absence', 'text' => 'Ist an dem Tag ' . absence_type_text((string)$a['type']) . ' (genehmigt)'];
            } elseif ($a['status'] === 'pending') {
                $out[] = ['type' => 'absence_pending', 'text' => 'Hat für den Tag ' . ($a['type'] === 'urlaub' ? 'Urlaub' : 'frei') . ' beantragt'];
            }
        }
    }
    $av = $avail[$sid][(string)$sh['date']] ?? null;
    if ($av === 'no') {
        $out[] = ['type' => 'unavailable', 'text' => 'Hat „kann nicht“ eingetragen'];
    } elseif ($av === 'maybe') {
        $out[] = ['type' => 'maybe', 'text' => 'Hat „vielleicht“ eingetragen'];
    }
    if ($staffRow !== null && !(int)$staffRow['active']) {
        $out[] = ['type' => 'inactive', 'text' => 'Konto ist deaktiviert'];
    }
    return $out;
}

function absences_by_staff(string $from, string $to, bool $withPending = true): array
{
    $sql = 'SELECT * FROM absences WHERE date_to >= ? AND date_from <= ?' . ($withPending ? " AND status IN ('approved','pending')" : " AND status = 'approved'");
    $out = [];
    foreach (q($sql, [$from, $to])->fetchAll() as $a) {
        $out[(int)$a['staff_id']][] = $a;
    }
    return $out;
}

function avail_by_staff(string $from, string $to): array
{
    $out = [];
    foreach (q('SELECT staff_id, date, value FROM availability WHERE date BETWEEN ? AND ?', [$from, $to])->fetchAll() as $r) {
        $out[(int)$r['staff_id']][(string)$r['date']] = (string)$r['value'];
    }
    return $out;
}

function group_by_staff(array $shifts): array
{
    $out = [];
    foreach ($shifts as $s) {
        if ($s['staff_id'] !== null) {
            $out[(int)$s['staff_id']][] = $s;
        }
    }
    return $out;
}

/**
 * Schicht für die Ausgabe. $viewer: null = Chef, sonst Mitarbeiter-ID.
 * Mitarbeiter sehen bei fremden Schichten nur Vorname, Zeit, Bezeichnung, Status (keine Absage-Gründe).
 */
function shift_out(array $sh, ?int $viewer, array $ctx): array
{
    $id = (int)$sh['id'];
    $reqs = $ctx['takes'][$id] ?? [];
    $names = $ctx['names'];
    $sid = $sh['staff_id'] !== null ? (int)$sh['staff_id'] : null;
    $mine = $viewer !== null && $sid === $viewer;
    $out = [
        'id' => $id,
        'date' => (string)$sh['date'],
        'start' => (string)$sh['start'],
        'end' => (string)$sh['end'],
        'overnight' => (string)$sh['end'] <= (string)$sh['start'],
        'minutes' => shift_minutes($sh),
        'label' => (string)$sh['label'],
        'note' => (string)$sh['note'],
        'staff_id' => $sid,
        'staff_name' => $sid !== null ? ($names[$sid] ?? '?') : ((int)$sh['former'] ? 'ehem. Mitarbeiter' : null),
        'former' => (bool)(int)$sh['former'],
        'status' => shift_status($sh, count($reqs)),
        'needs_ok' => (bool)(int)$sh['needs_ok'],
        'past' => shift_is_past($sh),
        'mine' => $mine,
    ];
    $swap = $ctx['swaps'][$id] ?? null;
    if ($viewer === null) {
        $out['reason'] = (string)$sh['reason'];
        $out['responded_at'] = $sh['responded_at'];
        $out['series_id'] = $sh['series_id'];
        $out['requests'] = array_map(fn($r) => ['staff_id' => $r['staff_id'], 'name' => $names[$r['staff_id']] ?? '?', 'created' => $r['created']], $reqs);
        $out['conflicts'] = shift_conflicts($sh, $ctx['byStaff'], $ctx['absences'], $ctx['avail'], $sid !== null ? ($ctx['staffRows'][$sid] ?? null) : null);
        if ($swap) {
            $out['swap'] = swap_out($swap, $names, null);
        }
        if (module_on('tasks')) {
            $t = shift_tasks($sh, $ctx['lists'], $ctx['checks'], $names);
            $out['tasks'] = $t;
        }
    } else {
        $out['requested_by_me'] = (bool)array_filter($reqs, fn($r) => $r['staff_id'] === $viewer);
        if ($mine) {
            $out['reason'] = (string)$sh['reason'];
            $out['conflicts'] = array_values(array_filter(
                shift_conflicts($sh, $ctx['byStaff'], $ctx['absences'], [], null),
                fn($c) => in_array($c['type'], ['absence', 'overlap'], true)
            ));
            if (module_on('tasks')) {
                $out['tasks'] = shift_tasks($sh, $ctx['lists'], $ctx['checks'], $names);
            }
        }
        if ($swap && module_on('swap') && ((int)$swap['from_staff'] === $viewer || $swap['to_staff'] === null || (int)$swap['to_staff'] === $viewer || (int)($swap['taker_id'] ?? 0) === $viewer)) {
            $out['swap'] = swap_out($swap, $names, $viewer);
        }
    }
    return $out;
}

function shift_ctx(array $shifts, string $from, string $to, ?int $viewer): array
{
    $ids = array_map(fn($s) => (int)$s['id'], $shifts);
    // Für Überschneidungen auch die Nachbartage laden (Schichten über Mitternacht)
    $neighbors = load_shifts(date_add_days($from, -1), date_add_days($to, 1));
    $staffRows = [];
    foreach (q('SELECT id, active FROM staff')->fetchAll() as $r) {
        $staffRows[(int)$r['id']] = $r;
    }
    return [
        'names' => staff_names(),
        'takes' => takes_by_shift($ids),
        'swaps' => active_swaps_by_shift($ids),
        'byStaff' => group_by_staff($neighbors),
        'absences' => $viewer === null ? absences_by_staff($from, $to) : absences_by_staff($from, $to, false),
        'avail' => $viewer === null ? avail_by_staff($from, $to) : [],
        'lists' => checklists_all(),
        'checks' => checks_by_shift($ids),
        'staffRows' => $staffRows,
    ];
}

function shifts_out(array $shifts, string $from, string $to, ?int $viewer): array
{
    $ctx = shift_ctx($shifts, $from, $to, $viewer);
    return array_map(fn($s) => shift_out($s, $viewer, $ctx), $shifts);
}

function swap_out(array $w, array $names, ?int $viewer): array
{
    return [
        'id' => (int)$w['id'],
        'shift_id' => (int)$w['shift_id'],
        'from_staff' => (int)$w['from_staff'],
        'from_name' => $names[(int)$w['from_staff']] ?? '?',
        'to_staff' => $w['to_staff'] !== null ? (int)$w['to_staff'] : null,
        'to_name' => $w['to_staff'] !== null ? ($names[(int)$w['to_staff']] ?? '?') : null,
        'taker_id' => $w['taker_id'] !== null ? (int)$w['taker_id'] : null,
        'taker_name' => $w['taker_id'] !== null ? ($names[(int)$w['taker_id']] ?? '?') : null,
        'status' => (string)$w['status'],
        'note' => (string)$w['note'],
        'created' => (string)$w['created'],
        'updated' => (string)$w['updated'],
        'mine' => $viewer !== null && (int)$w['from_staff'] === $viewer,
        'for_me' => $viewer !== null && (int)$w['from_staff'] !== $viewer && ($w['to_staff'] === null || (int)$w['to_staff'] === $viewer),
    ];
}

function absence_out(array $a, array $names, bool $full = true): array
{
    $o = [
        'id' => (int)$a['id'],
        'staff_id' => (int)$a['staff_id'],
        'name' => $names[(int)$a['staff_id']] ?? '?',
        'from' => (string)$a['date_from'],
        'to' => (string)$a['date_to'],
        'status' => (string)$a['status'],
    ];
    if ($full) {
        $o += [
            'type' => (string)$a['type'],
            'note' => (string)$a['note'],
            'chef_comment' => (string)$a['chef_comment'],
            'created' => (string)$a['created'],
            'decided_at' => $a['decided_at'],
        ];
    }
    return $o;
}

/* ================================================================ Stunden */

/** Geplante Stunden je Person im Monat: zugesagt (yes) + noch unbeantwortet (none) */
function hours_for(string $month, ?int $staffId = null): array
{
    $from = $month . '-01';
    $to = date('Y-m-t', strtotime($from . ' 12:00:00'));
    $sql = 'SELECT * FROM shifts WHERE date BETWEEN ? AND ? AND staff_id IS NOT NULL' . ($staffId !== null ? ' AND staff_id = ?' : '');
    $params = $staffId !== null ? [$from, $to, $staffId] : [$from, $to];
    $acc = [];
    foreach (q($sql, $params)->fetchAll() as $s) {
        $id = (int)$s['staff_id'];
        $acc[$id] ??= ['minutes' => 0, 'minutes_unanswered' => 0, 'shifts' => 0];
        if ($s['response'] === 'yes') {
            $acc[$id]['minutes'] += shift_minutes($s);
            $acc[$id]['shifts']++;
        } elseif ($s['response'] === 'none') {
            $acc[$id]['minutes_unanswered'] += shift_minutes($s);
        }
    }
    $rows = $staffId !== null ? [staff_or_404($staffId)] : q('SELECT * FROM staff ORDER BY name_key')->fetchAll();
    $out = [];
    foreach ($rows as $st) {
        $id = (int)$st['id'];
        $a = $acc[$id] ?? ['minutes' => 0, 'minutes_unanswered' => 0, 'shifts' => 0];
        $wage = $st['wage_cents'] !== null ? (int)$st['wage_cents'] : null;
        $limit = effective_limit($st);
        $earn = $wage !== null ? (int)round($a['minutes'] * $wage / 60) : null;
        $earnAll = $wage !== null ? (int)round(($a['minutes'] + $a['minutes_unanswered']) * $wage / 60) : null;
        $out[] = [
            'staff_id' => $id,
            'name' => (string)$st['name'],
            'month' => $month,
            'minutes' => $a['minutes'],
            'minutes_unanswered' => $a['minutes_unanswered'],
            'shifts' => $a['shifts'],
            'wage' => cents_out($wage),
            'earnings' => cents_out($earn),
            'earnings_with_unanswered' => cents_out($earnAll),
            'limit' => cents_out($limit),
            'limit_custom' => $st['limit_cents'] !== null,
            'over' => $earn !== null && $earn > $limit,
            'over_with_unanswered' => $earnAll !== null && $earnAll > $limit,
        ];
    }
    return $out;
}

/* ================================================================== iCal */

function ical_escape(string $s): string
{
    return str_replace(["\\", ';', ',', "\n"], ["\\\\", '\\;', '\\,', '\\n'], $s);
}

/** Zeilen nach RFC 5545 auf 75 Oktette falten (ohne UTF-8-Zeichen zu zerschneiden) */
function ical_fold(string $line): string
{
    if (strlen($line) <= 75) {
        return $line;
    }
    $out = '';
    $cur = '';
    $limit = 75;
    foreach (preg_split('//u', $line, -1, PREG_SPLIT_NO_EMPTY) as $ch) {
        if (strlen($cur) + strlen($ch) > $limit) {
            $out .= $cur . "\r\n ";
            $cur = '';
            $limit = 74;
        }
        $cur .= $ch;
    }
    return $out . $cur;
}

function ical_url(array $staff): string
{
    $host = (string)($_SERVER['HTTP_HOST'] ?? '');
    if (!preg_match('/^[A-Za-z0-9.\-]+(:\d{1,5})?$|^\[[0-9A-Fa-f:.]+\](:\d{1,5})?$/', $host)) {
        $host = (string)($_SERVER['SERVER_NAME'] ?? 'localhost');
    }
    $path = (string)($_SERVER['SCRIPT_NAME'] ?? '/cms/team-api.php');
    return (is_https() ? 'https' : 'http') . '://' . $host . $path . '?action=ical&token=' . (int)$staff['id'] . '-' . $staff['ical_token'];
}

function ical_feed(array $staff): string
{
    $id = (int)$staff['id'];
    $host = preg_replace('/[^A-Za-z0-9.\-]/', '', (string)($_SERVER['HTTP_HOST'] ?? 'hofbraeustueble')) ?: 'hofbraeustueble';
    $stamp = gmdate('Ymd\THis\Z');
    $from = date_add_days(today(), -60);
    $to = date_add_days(today(), 400);
    $L = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//Hofbraeustueble//Dienstplan//DE',
        'CALSCALE:GREGORIAN',
        'METHOD:PUBLISH',
        'X-WR-CALNAME:' . ical_escape('Hofbräustüble – meine Schichten'),
        'X-WR-TIMEZONE:Europe/Berlin',
        'REFRESH-INTERVAL;VALUE=DURATION:PT1H',
        'X-PUBLISHED-TTL:PT1H',
        'BEGIN:VTIMEZONE',
        'TZID:Europe/Berlin',
        'X-LIC-LOCATION:Europe/Berlin',
        'BEGIN:DAYLIGHT',
        'TZOFFSETFROM:+0100',
        'TZOFFSETTO:+0200',
        'TZNAME:CEST',
        'DTSTART:19700329T020000',
        'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU',
        'END:DAYLIGHT',
        'BEGIN:STANDARD',
        'TZOFFSETFROM:+0200',
        'TZOFFSETTO:+0100',
        'TZNAME:CET',
        'DTSTART:19701025T030000',
        'RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU',
        'END:STANDARD',
        'END:VTIMEZONE',
    ];
    $shifts = q("SELECT * FROM shifts WHERE staff_id = ? AND response IN ('none','yes') AND date BETWEEN ? AND ? ORDER BY date, start", [$id, $from, $to])->fetchAll();
    foreach ($shifts as $s) {
        $endDate = $s['end'] <= $s['start'] ? date_add_days((string)$s['date'], 1) : (string)$s['date'];
        $title = 'Schicht' . ($s['label'] !== '' ? ': ' . $s['label'] : '') . ($s['response'] === 'none' ? ' (noch nicht zugesagt)' : '');
        $desc = 'Hofbräustüble – ' . $s['start'] . '–' . $s['end'] . ' Uhr' . ($s['note'] !== '' ? "\n" . $s['note'] : '');
        $L[] = 'BEGIN:VEVENT';
        $L[] = 'UID:team-shift-' . (int)$s['id'] . '@' . $host;
        $L[] = 'DTSTAMP:' . $stamp;
        $L[] = 'LAST-MODIFIED:' . gmdate('Ymd\THis\Z', strtotime((string)$s['updated']) ?: time());
        $L[] = 'DTSTART;TZID=Europe/Berlin:' . str_replace('-', '', (string)$s['date']) . 'T' . str_replace(':', '', (string)$s['start']) . '00';
        $L[] = 'DTEND;TZID=Europe/Berlin:' . str_replace('-', '', $endDate) . 'T' . str_replace(':', '', (string)$s['end']) . '00';
        $L[] = 'SUMMARY:' . ical_escape($title);
        $L[] = 'DESCRIPTION:' . ical_escape($desc);
        $L[] = 'LOCATION:' . ical_escape('Hofbräustüble');
        $L[] = 'STATUS:' . ($s['response'] === 'yes' ? 'CONFIRMED' : 'TENTATIVE');
        $L[] = 'BEGIN:VALARM';
        $L[] = 'ACTION:DISPLAY';
        $L[] = 'DESCRIPTION:' . ical_escape('Schicht in 2 Stunden');
        $L[] = 'TRIGGER:-PT2H';
        $L[] = 'END:VALARM';
        $L[] = 'END:VEVENT';
    }
    $abs = q("SELECT * FROM absences WHERE staff_id = ? AND status = 'approved' AND date_to >= ? AND date_from <= ?", [$id, $from, $to])->fetchAll();
    foreach ($abs as $a) {
        $L[] = 'BEGIN:VEVENT';
        $L[] = 'UID:team-absence-' . (int)$a['id'] . '@' . $host;
        $L[] = 'DTSTAMP:' . $stamp;
        $L[] = 'DTSTART;VALUE=DATE:' . str_replace('-', '', (string)$a['date_from']);
        $L[] = 'DTEND;VALUE=DATE:' . str_replace('-', '', date_add_days((string)$a['date_to'], 1));
        $L[] = 'SUMMARY:' . ical_escape(['urlaub' => 'Urlaub', 'krank' => 'Krank', 'sonstiges' => 'Frei'][(string)$a['type']] ?? 'Frei');
        $L[] = 'TRANSP:TRANSPARENT';
        $L[] = 'STATUS:CONFIRMED';
        $L[] = 'END:VEVENT';
    }
    $L[] = 'END:VCALENDAR';
    return implode("\r\n", array_map('ical_fold', $L)) . "\r\n";
}

/* ======================================================== Ausgabe Mitarbeiter */

function me_out(array $p): array
{
    $o = [
        'id' => (int)$p['id'],
        'name' => (string)$p['name'],
        'phone' => $p['phone'] !== null ? (string)$p['phone'] : null,
        'phone_visible' => (bool)(int)$p['phone_visible'],
        'created' => (string)$p['created'],
    ];
    if (module_on('hours')) {
        $o['wage'] = cents_out($p['wage_cents'] !== null ? (int)$p['wage_cents'] : null);
        $o['limit'] = cents_out(effective_limit($p));
    }
    if (module_on('ical')) {
        $o['ical_url'] = ical_url($p);
    }
    return $o;
}

function status_payload(?array $p): array
{
    $staffCsrf = $p ? (string)($_SESSION['csrf'] ?? '') : null;
    session_close_any();
    $chef = cms_chef_state(false);
    return [
        'me' => $p ? me_out($p) : null,
        'csrf' => $staffCsrf,
        'chef' => $chef['auth'],
        'chefCsrf' => $chef['auth'] ? $chef['csrf'] : null,
        'settings' => public_settings(),
        'enabled' => team_enabled(),
        'serverTime' => now_full(),
    ];
}

/** Alles, was die Mitarbeiter-App braucht (nur eigene Daten + Vornamen/Schichten der Kollegen) */
function staff_data(array $me, string $from, string $to): array
{
    $id = (int)$me['id'];
    $today = today();
    $names = staff_names();
    $mod = settings()['modules'];

    // Team-Woche (Zeitraum) + eigene/offene Schichten der nächsten 8 Wochen
    $horizon = date_add_days($today, 56);
    $range = load_shifts($from, $to);
    $ahead = q('SELECT * FROM shifts WHERE date BETWEEN ? AND ? AND (staff_id = ? OR staff_id IS NULL) ORDER BY date, start, id',
        [date_add_days($today, -1), $horizon, $id])->fetchAll();
    $all = [];
    foreach (array_merge($range, $ahead) as $s) {
        $all[(int)$s['id']] = $s;
    }
    $cf = min($from, date_add_days($today, -1));
    $ct = max($to, $horizon);
    $ctx = shift_ctx(array_values($all), $cf, $ct, $id);
    $outAll = [];
    foreach ($all as $sid => $s) {
        $outAll[$sid] = shift_out($s, $id, $ctx);
    }
    $week = array_map(fn($s) => $outAll[(int)$s['id']], $range);
    $mine = [];
    $open = [];
    foreach ($ahead as $s) {
        $o = $outAll[(int)$s['id']];
        if ($o['past']) {
            continue;
        }
        if ($o['mine']) {
            $mine[] = $o;
        } elseif ($o['staff_id'] === null) {
            $open[] = $o;
        }
    }

    $colleagues = [];
    foreach (q('SELECT id, name, phone, phone_visible FROM staff WHERE active = 1 ORDER BY name_key')->fetchAll() as $c) {
        $colleagues[] = [
            'id' => (int)$c['id'],
            'name' => (string)$c['name'],
            'phone' => (int)$c['phone_visible'] && $c['phone'] !== null ? (string)$c['phone'] : null,
            'me' => (int)$c['id'] === $id,
        ];
    }

    $myAbs = array_map(fn($a) => absence_out($a, $names), q('SELECT * FROM absences WHERE staff_id = ? AND date_to >= ? ORDER BY date_from DESC LIMIT 50', [$id, date_add_days($today, -90)])->fetchAll());
    // Kollegen: nur „nicht da“ (genehmigt), ohne Art und Notiz (Gesundheitsdaten!)
    $teamAbs = [];
    foreach (q("SELECT * FROM absences WHERE status = 'approved' AND staff_id != ? AND date_to >= ? AND date_from <= ? ORDER BY date_from", [$id, $from, $to])->fetchAll() as $a) {
        $teamAbs[] = absence_out($a, $names, false);
    }

    $avail = [];
    if ($mod['availability']) {
        foreach (q('SELECT date, value FROM availability WHERE staff_id = ? AND date BETWEEN ? AND ?', [$id, date_add_days($today, -7), date_add_days($today, TEAM_AVAIL_DAYS)])->fetchAll() as $r) {
            $avail[(string)$r['date']] = (string)$r['value'];
        }
    }

    $swaps = [];
    if ($mod['swap']) {
        $rows = q("SELECT w.* FROM swaps w JOIN shifts s ON s.id = w.shift_id
                   WHERE s.date >= ? AND (
                        (w.status IN ('offered','accepted') AND (w.from_staff = ? OR w.to_staff = ? OR w.to_staff IS NULL OR w.taker_id = ?))
                     OR (w.status IN ('done','declined','rejected') AND (w.from_staff = ? OR w.taker_id = ?) AND w.updated >= ?))
                   ORDER BY w.created DESC LIMIT 50",
            [date_add_days($today, -1), $id, $id, $id, $id, $id, date('Y-m-d H:i:s', time() - 14 * 86400)])->fetchAll();
        $swapShifts = [];
        foreach ($rows as $w) {
            $swapShifts[(int)$w['shift_id']] = true;
        }
        $shiftMap = [];
        if ($swapShifts) {
            $in = implode(',', array_keys($swapShifts));
            foreach (q("SELECT * FROM shifts WHERE id IN ($in)")->fetchAll() as $s) {
                $shiftMap[(int)$s['id']] = ['id' => (int)$s['id'], 'date' => $s['date'], 'start' => $s['start'], 'end' => $s['end'], 'label' => $s['label']];
            }
        }
        foreach ($rows as $w) {
            if ($w['status'] === 'offered' && (int)$w['from_staff'] !== $id && $w['to_staff'] === null && !isset($names[(int)$w['from_staff']])) {
                continue;
            }
            $o = swap_out($w, $names, $id);
            $o['shift'] = $shiftMap[(int)$w['shift_id']] ?? null;
            $swaps[] = $o;
        }
    }

    $messages = array_map(fn($m) => [
        'id' => (int)$m['id'], 'from_chef' => (bool)(int)$m['from_chef'], 'body' => (string)$m['body'],
        'created' => (string)$m['created'], 'read' => $m['read_at'] !== null,
    ], array_reverse(q('SELECT * FROM messages WHERE staff_id = ? ORDER BY id DESC LIMIT 200', [$id])->fetchAll()));
    $unreadMsg = (int)q('SELECT COUNT(*) FROM messages WHERE staff_id = ? AND from_chef = 1 AND read_at IS NULL', [$id])->fetchColumn();

    $board = [];
    $unreadBoard = 0;
    if ($mod['board']) {
        foreach (q('SELECT b.*, r.read_at FROM board b LEFT JOIN board_reads r ON r.post_id = b.id AND r.staff_id = ? ORDER BY b.id DESC LIMIT 30', [$id])->fetchAll() as $b) {
            $read = $b['read_at'] !== null;
            $unreadBoard += $read ? 0 : 1;
            $board[] = ['id' => (int)$b['id'], 'title' => (string)$b['title'], 'body' => (string)$b['body'], 'created' => (string)$b['created'], 'read' => $read];
        }
    }

    $hours = null;
    if ($mod['hours']) {
        $m1 = date('Y-m');
        $m2 = date('Y-m', strtotime(date('Y-m-01') . ' +1 month'));
        $hours = [hours_for($m1, $id)[0], hours_for($m2, $id)[0]];
    }

    return [
        'me' => me_out($me),
        'settings' => public_settings(),
        'orders' => $mod['orders'] ? orders_out($id) : null,
        'today' => $today,
        'serverTime' => now_full(),
        'from' => $from,
        'to' => $to,
        'colleagues' => $colleagues,
        'week' => $week,
        'my_shifts' => $mine,
        'open_shifts' => $open,
        'absences' => $myAbs,
        'team_absences' => $teamAbs,
        'availability' => (object)$avail,
        'swaps' => $swaps,
        'messages' => $messages,
        'board' => $board,
        'hours' => $hours,
        'unread' => ['messages' => $unreadMsg, 'board' => $unreadBoard],
    ];
}

function chef_data(string $from, string $to): array
{
    $names = staff_names();
    $today = today();
    $shifts = shifts_out(load_shifts($from, $to), $from, $to, null);
    $month = date('Y-m');
    $hours = [];
    foreach (hours_for($month) as $h) {
        $hours[$h['staff_id']] = $h;
    }
    $unread = [];
    foreach (q('SELECT staff_id, COUNT(*) n FROM messages WHERE from_chef = 0 AND read_at IS NULL GROUP BY staff_id')->fetchAll() as $r) {
        $unread[(int)$r['staff_id']] = (int)$r['n'];
    }
    $staff = [];
    foreach (q('SELECT * FROM staff ORDER BY name_key')->fetchAll() as $s) {
        $sid = (int)$s['id'];
        $staff[] = [
            'id' => $sid,
            'name' => (string)$s['name'],
            'phone' => $s['phone'] !== null ? (string)$s['phone'] : null,
            'phone_visible' => (bool)(int)$s['phone_visible'],
            'active' => (bool)(int)$s['active'],
            'wage' => cents_out($s['wage_cents'] !== null ? (int)$s['wage_cents'] : null),
            'limit' => cents_out(effective_limit($s)),
            'limit_custom' => $s['limit_cents'] !== null,
            'created' => (string)$s['created'],
            'last_login' => $s['last_login'],
            'hours' => $hours[$sid] ?? null,
            'unread' => $unread[$sid] ?? 0,
        ];
    }
    $invites = array_map('invite_out', q('SELECT * FROM invites ORDER BY created DESC LIMIT 50')->fetchAll());
    $abs = q("SELECT * FROM absences WHERE status = 'pending' OR (date_to >= ? AND date_from <= ?) OR date_to >= ? ORDER BY CASE status WHEN 'pending' THEN 0 ELSE 1 END, date_from LIMIT 200",
        [$from, $to, $today])->fetchAll();
    $absOut = array_map(fn($a) => absence_out($a, $names), $abs);

    $swaps = [];
    $rows = q("SELECT w.* FROM swaps w JOIN shifts s ON s.id = w.shift_id WHERE w.status IN ('offered','accepted') OR w.updated >= ? ORDER BY CASE w.status WHEN 'accepted' THEN 0 WHEN 'offered' THEN 1 ELSE 2 END, w.created DESC LIMIT 60",
        [date('Y-m-d H:i:s', time() - 14 * 86400)])->fetchAll();
    foreach ($rows as $w) {
        $o = swap_out($w, $names, null);
        $s = q('SELECT id, date, start, "end", label FROM shifts WHERE id = ?', [(int)$w['shift_id']])->fetch();
        $o['shift'] = $s ?: null;
        $swaps[] = $o;
    }

    $takes = [];
    foreach (q('SELECT t.*, s.date, s.start, s."end", s.label FROM takes t JOIN shifts s ON s.id = t.shift_id WHERE s.staff_id IS NULL ORDER BY s.date, s.start')->fetchAll() as $t) {
        $takes[] = ['shift_id' => (int)$t['shift_id'], 'staff_id' => (int)$t['staff_id'], 'name' => $names[(int)$t['staff_id']] ?? '?', 'created' => (string)$t['created'],
            'shift' => ['id' => (int)$t['shift_id'], 'date' => $t['date'], 'start' => $t['start'], 'end' => $t['end'], 'label' => $t['label']]];
    }
    $declined = [];
    foreach (q("SELECT * FROM shifts WHERE staff_id IS NOT NULL AND response = 'no' AND date >= ? ORDER BY date, start", [$today])->fetchAll() as $s) {
        $declined[] = ['id' => (int)$s['id'], 'date' => $s['date'], 'start' => $s['start'], 'end' => $s['end'], 'label' => $s['label'],
            'staff_id' => (int)$s['staff_id'], 'name' => $names[(int)$s['staff_id']] ?? '?', 'reason' => (string)$s['reason']];
    }

    $threads = [];
    foreach (q('SELECT m.staff_id, MAX(m.id) last_id FROM messages m GROUP BY m.staff_id')->fetchAll() as $r) {
        $m = q('SELECT * FROM messages WHERE id = ?', [(int)$r['last_id']])->fetch();
        $threads[] = ['staff_id' => (int)$r['staff_id'], 'name' => $names[(int)$r['staff_id']] ?? '?', 'last' => mb_substr((string)$m['body'], 0, 120),
            'last_from_chef' => (bool)(int)$m['from_chef'], 'last_at' => (string)$m['created'], 'unread' => $unread[(int)$r['staff_id']] ?? 0];
    }
    usort($threads, fn($a, $b) => strcmp($b['last_at'], $a['last_at']));

    $activeIds = [];
    foreach ($staff as $s) {
        if ($s['active']) {
            $activeIds[$s['id']] = $s['name'];
        }
    }
    $board = [];
    foreach (q('SELECT * FROM board ORDER BY id DESC LIMIT 30')->fetchAll() as $b) {
        $reads = [];
        foreach (q('SELECT staff_id, read_at FROM board_reads WHERE post_id = ? ORDER BY read_at', [(int)$b['id']])->fetchAll() as $r) {
            $reads[] = ['staff_id' => (int)$r['staff_id'], 'name' => $names[(int)$r['staff_id']] ?? '?', 'read_at' => (string)$r['read_at']];
        }
        $readIds = array_column($reads, 'staff_id');
        $notRead = [];
        foreach ($activeIds as $sid => $n) {
            if (!in_array($sid, $readIds, true)) {
                $notRead[] = $n;
            }
        }
        $board[] = ['id' => (int)$b['id'], 'title' => (string)$b['title'], 'body' => (string)$b['body'], 'created' => (string)$b['created'], 'reads' => $reads, 'not_read' => $notRead];
    }

    $avail = avail_by_staff($from, $to);
    $pendingAbs = count(array_filter($absOut, fn($a) => $a['status'] === 'pending'));
    $pendingSwaps = count(array_filter($swaps, fn($w) => $w['status'] === 'accepted'));
    return [
        'settings' => public_settings() + ['minijob_limit_cents' => settings()['minijob_limit_cents']],
        'today' => $today,
        'serverTime' => now_full(),
        'from' => $from,
        'to' => $to,
        'staff' => $staff,
        'invites' => $invites,
        'shifts' => $shifts,
        'absences' => $absOut,
        'availability' => (object)array_map(fn($x) => (object)$x, $avail),
        'swaps' => $swaps,
        'takes' => $takes,
        'declined' => $declined,
        'threads' => $threads,
        'board' => $board,
        'checklists' => checklists_all(),
        'orders' => orders_out(null),
        'enabled' => team_enabled(),
        'counts' => [
            'requests' => $pendingAbs + $pendingSwaps + count($takes) + count($declined),
            'absences' => $pendingAbs,
            'swaps' => $pendingSwaps,
            'takes' => count($takes),
            'declined' => count($declined),
            'unread' => array_sum($unread),
            'orders' => (int)q("SELECT COUNT(*) FROM order_items WHERE status = 'low'")->fetchColumn(),
        ],
    ];
}

function range_params(): array
{
    $today = today();
    $from = present('from') ? v_date(inp('from'), 'Von') : date('Y-m-d', strtotime('monday this week'));
    $to = present('to') ? v_date(inp('to'), 'Bis') : date_add_days($from, 6);
    if ($to < $from) {
        [$from, $to] = [$to, $from];
    }
    if (days_between($from, $to) > TEAM_MAX_RANGE) {
        $to = date_add_days($from, TEAM_MAX_RANGE);
    }
    unset($today);
    return [$from, $to];
}

/** Person aus allem entfernen, Schichtverlauf anonym behalten („ehem. Mitarbeiter“) */
function delete_staff(int $id): void
{
    tx(function (PDO $pdo) use ($id) {
        $today = today();
        $pdo->prepare("UPDATE shifts SET staff_id = NULL, former = 1, reason = '', responded_at = NULL WHERE staff_id = ? AND date < ?")->execute([$id, $today]);
        $pdo->prepare("UPDATE shifts SET staff_id = NULL, response = 'none', reason = '', responded_at = NULL, updated = ? WHERE staff_id = ?")->execute([now_full(), $id]);
        $pdo->prepare('UPDATE invites SET used_by = NULL WHERE used_by = ?')->execute([$id]);
        $pdo->prepare('UPDATE checks SET staff_id = NULL WHERE staff_id = ?')->execute([$id]);
        // Rest per ON DELETE CASCADE: Nachrichten, Abwesenheiten, Verfügbarkeit, Tausch, Übernahme-Anfragen, Gelesen-Vermerke
        $pdo->prepare('DELETE FROM staff WHERE id = ?')->execute([$id]);
    });
}

/** Prüft, ob $staffId die Schicht ohne Überschneidung/genehmigte Abwesenheit übernehmen kann */
function take_blockers(array $sh, int $staffId): ?string
{
    $from = date_add_days((string)$sh['date'], -1);
    $to = date_add_days((string)$sh['date'], 1);
    $others = q("SELECT * FROM shifts WHERE staff_id = ? AND response != 'no' AND date BETWEEN ? AND ? AND id != ?", [$staffId, $from, $to, (int)$sh['id']])->fetchAll();
    [$s1, $e1] = shift_bounds((string)$sh['date'], (string)$sh['start'], (string)$sh['end']);
    foreach ($others as $o) {
        [$s2, $e2] = shift_bounds((string)$o['date'], (string)$o['start'], (string)$o['end']);
        if ($s1 < $e2 && $s2 < $e1) {
            return 'Du hast zu der Zeit schon eine Schicht (' . $o['start'] . '–' . $o['end'] . ' Uhr).';
        }
    }
    $abs = q("SELECT 1 FROM absences WHERE staff_id = ? AND status = 'approved' AND date_from <= ? AND date_to >= ?", [$staffId, $sh['date'], $sh['date']])->fetchColumn();
    if ($abs) {
        return 'Du bist an dem Tag als abwesend eingetragen.';
    }
    return null;
}

function execute_swap(PDO $pdo, array $w): void
{
    $sh = $pdo->prepare('SELECT * FROM shifts WHERE id = ?');
    $sh->execute([(int)$w['shift_id']]);
    $s = $sh->fetch();
    if (!$s || (int)$s['staff_id'] !== (int)$w['from_staff']) {
        throw new DomainException('Die Schicht gehört inzwischen nicht mehr der Person, die sie angeboten hat.');
    }
    $pdo->prepare("UPDATE shifts SET staff_id = ?, response = 'yes', reason = '', responded_at = ?, updated = ? WHERE id = ?")
        ->execute([(int)$w['taker_id'], now_full(), now_full(), (int)$s['id']]);
    $pdo->prepare("UPDATE swaps SET status = 'done', updated = ? WHERE id = ?")->execute([now_full(), (int)$w['id']]);
    $pdo->prepare('DELETE FROM checks WHERE shift_id = ?')->execute([(int)$s['id']]);
}

function v_items(mixed $v): array
{
    if (!is_array($v) || !array_is_list($v)) {
        fail('Aufgaben: bitte eine Liste angeben.', 400);
    }
    if (count($v) > 30) {
        fail('Höchstens 30 Aufgaben je Liste.', 400);
    }
    $out = [];
    $seen = [];
    foreach ($v as $i => $it) {
        $id = '';
        $text = $it;
        if (is_array($it)) {
            $text = $it['text'] ?? '';
            $id = is_string($it['id'] ?? null) && preg_match('/^[a-z0-9]{4,16}$/', $it['id']) ? $it['id'] : '';
        }
        $t = v_str($text, 0, 120, 'Aufgabe ' . ($i + 1));
        if ($t === '') {
            continue;
        }
        if ($id === '' || isset($seen[$id])) {
            $id = bin2hex(random_bytes(4));
        }
        $seen[$id] = true;
        $out[] = ['id' => $id, 'text' => $t];
    }
    if (!$out) {
        fail('Bitte mindestens eine Aufgabe eintragen.', 400);
    }
    return $out;
}

/* ======================================================= Bestellliste */

function order_cat(mixed $v): string
{
    if (!in_array($v, TEAM_ORDER_CATS, true)) {
        fail('Bitte eine Art auswählen (Getränke, Küche, Putzmittel, Sonstiges).', 400);
    }
    return $v;
}

function orders_out(?int $viewer): array
{
    $names = staff_names();
    $items = [];
    $rows = q("SELECT * FROM order_items WHERE status IN ('low','ordered') OR (status = 'delivered' AND updated >= ?)
               ORDER BY CASE status WHEN 'low' THEN 0 WHEN 'ordered' THEN 1 ELSE 2 END, category, name", [date('Y-m-d H:i:s', time() - 7 * 86400)])->fetchAll();
    foreach ($rows as $r) {
        $items[] = [
            'id' => (int)$r['id'],
            'name' => (string)$r['name'],
            'qty' => (string)$r['qty'],
            'note' => (string)$r['note'],
            'category' => (string)$r['category'],
            'catalog_id' => $r['catalog_id'] !== null ? (int)$r['catalog_id'] : null,
            'status' => (string)$r['status'],
            'by' => (int)$r['by_chef'] ? 'Chef' : ($r['created_by'] !== null ? ($names[(int)$r['created_by']] ?? '?') : 'ehem. Mitarbeiter'),
            'mine' => $viewer !== null && $r['created_by'] !== null && (int)$r['created_by'] === $viewer,
            'created' => (string)$r['created'],
            'updated' => (string)$r['updated'],
        ];
    }
    $catalog = array_map(fn($c) => ['id' => (int)$c['id'], 'name' => (string)$c['name'], 'category' => (string)$c['category'], 'qty' => (string)$c['qty']],
        q('SELECT * FROM order_catalog ORDER BY category, name')->fetchAll());
    return ['items' => $items, 'catalog' => $catalog];
}

/** Eintrag „fast leer“ anlegen (Katalog oder frei); gibt [id, existing] zurück */
function order_add(?int $staffId): array
{
    $catId = present('catalog_id') ? v_id(inp('catalog_id'), 'Artikel') : null;
    $qty = v_str(inp('qty'), 0, 40, 'Menge');
    $note = v_str(inp('note'), 0, 200, 'Notiz');
    if ($catId !== null) {
        $c = q('SELECT * FROM order_catalog WHERE id = ?', [$catId])->fetch();
        if (!$c) {
            fail('Artikel nicht gefunden.', 404);
        }
        $name = (string)$c['name'];
        $cat = (string)$c['category'];
        if ($qty === '') {
            $qty = (string)$c['qty'];
        }
    } else {
        $name = v_str(inp('name'), 1, 80, 'was fehlt');
        $cat = order_cat(inp('category'));
    }
    foreach (q("SELECT id, name, catalog_id FROM order_items WHERE status IN ('low','ordered')")->fetchAll() as $r) {
        if (($catId !== null && (int)$r['catalog_id'] === $catId) || lower((string)$r['name']) === lower($name)) {
            return [(int)$r['id'], true];
        }
    }
    q('INSERT INTO order_items (name, qty, note, category, catalog_id, status, created_by, by_chef, created, updated) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [$name, $qty, $note, $cat, $catId, 'low', $staffId, $staffId === null ? 1 : 0, now_full(), now_full()]);
    return [(int)db()->lastInsertId(), false];
}

/* ================================================================= Router */

$action = (string)($_GET['action'] ?? '');
if (!preg_match('/^[a-z_]{1,40}$/', $action)) {
    fail('Unbekannte Aktion.', 400);
}
if (method() === 'POST') {
    check_origin();
    body();
} elseif (method() !== 'GET') {
    fail('Methode nicht erlaubt.', 405);
}

db();

// Globaler Schalter (Website-Verwaltung → Funktionen): Mitarbeiter-Aktionen gesperrt, Chef-Aktionen + status + logout frei
if (!str_starts_with($action, 'chef_') && !in_array($action, ['status', 'logout'], true)) {
    require_team_enabled();
}

try {
switch ($action) {

    /* ---------------------------------------------------------- Öffentlich */

    case 'status':
        require_method('GET');
        respond(status_payload(current_staff()));

    case 'invite_check':
        require_method('GET');
        $lock = bf_locked([bf_key('code')]);
        if ($lock > 0) {
            fail_locked($lock);
        }
        $code = norm_code(inp('code'));
        $inv = $code !== '' ? q('SELECT * FROM invites WHERE code = ?', [$code])->fetch() : false;
        if (!$inv) {
            bf_fail(bf_key('code'), TEAM_BF_CODE_FAILS);
        }
        respond(['valid' => $inv && invite_valid($inv), 'note' => $inv && invite_valid($inv) ? (string)$inv['note'] : null]);

    case 'register':
        require_method('POST');
        $lock = bf_locked([bf_key('code'), bf_key('ip')]);
        if ($lock > 0) {
            fail_locked($lock);
        }
        $code = norm_code(inp('code'));
        $name = v_name(inp('name'));
        $pw = v_new_password(inp('password'));
        $phone = v_phone(inp('phone'));
        $phoneVisible = present('phone_visible') ? v_bool(inp('phone_visible'), 'Telefon sichtbar') : false;
        $hash = password_hash($pw, PASSWORD_DEFAULT);
        $res = tx(function (PDO $pdo) use ($code, $name, $hash, $phone, $phoneVisible) {
            $inv = false;
            if ($code !== '') {
                $st = $pdo->prepare('SELECT * FROM invites WHERE code = ?');
                $st->execute([$code]);
                $inv = $st->fetch();
            }
            if (!$inv || !invite_valid($inv)) {
                return ['error' => $inv ? 'used' : 'invalid'];
            }
            if (find_staff_by_name($name)) {
                return ['error' => 'taken'];
            }
            $now = now_full();
            $pdo->prepare('INSERT INTO staff (name, name_key, password_hash, phone, phone_visible, active, ical_token, created, last_login) VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?)')
                ->execute([$name, lower($name), $hash, $phone, $phone !== null && $phoneVisible ? 1 : 0, new_ical_token(), $now, $now]);
            $id = (int)$pdo->lastInsertId();
            $pdo->prepare('UPDATE invites SET used_by = ?, used_at = ? WHERE code = ? AND used_at IS NULL')->execute([$id, $now, $code]);
            return ['id' => $id];
        });
        if (isset($res['error'])) {
            if ($res['error'] === 'taken') {
                fail('Diesen Namen gibt es schon im Team. Nimm z. B. noch den ersten Buchstaben vom Nachnamen dazu („Anja K.“).', 409);
            }
            if ($res['error'] === 'invalid') {
                bf_fail(bf_key('code'), TEAM_BF_CODE_FAILS);
            }
            fail('Die Einladung ist ungültig, abgelaufen oder wurde schon benutzt. Bitte frag den Chef nach einer neuen.', 400);
        }
        login_session($res['id'], $hash);
        respond(status_payload(staff_or_404($res['id'])));

    case 'login':
        require_method('POST');
        $nameRaw = inp('name');
        $name = is_string($nameRaw) ? trim((string)preg_replace('/\s+/u', ' ', $nameRaw)) : '';
        $pw = inp('password');
        if ($name === '' || !is_string($pw) || $pw === '') {
            fail('Bitte Name und Passwort eingeben.', 400);
        }
        $nameKey = bf_key('login', lower($name));
        $ipKey = bf_key('ip');
        $lock = bf_locked([$nameKey, $ipKey]);
        if ($lock > 0) {
            fail_locked($lock);
        }
        $p = (str_len($name) <= 30 && strlen($pw) <= 200) ? find_staff_by_name($name) : null;
        if ($p) {
            $ok = password_verify($pw, (string)$p['password_hash']);
        } else {
            password_hash($pw, PASSWORD_DEFAULT); // gleiche Rechenzeit
            $ok = false;
        }
        if (!$ok) {
            $l1 = bf_fail($nameKey, TEAM_BF_NAME_FAILS);
            $l2 = bf_fail($ipKey, TEAM_BF_IP_FAILS);
            usleep(random_int(300000, 600000));
            if ($l1 || $l2) {
                header('Retry-After: ' . TEAM_BF_LOCK);
                fail('Zu viele Fehlversuche. Die Anmeldung ist für ' . (TEAM_BF_LOCK / 60) . ' Minuten gesperrt.', 429, ['retryAfter' => TEAM_BF_LOCK]);
            }
            fail('Name oder Passwort stimmt nicht.', 401);
        }
        if (!(int)$p['active']) {
            fail('Dein Zugang ist gerade gesperrt. Bitte sprich mit dem Chef.', 403);
        }
        bf_clear($nameKey);
        $hash = (string)$p['password_hash'];
        if (password_needs_rehash($hash, PASSWORD_DEFAULT)) {
            $hash = password_hash($pw, PASSWORD_DEFAULT);
            q('UPDATE staff SET password_hash = ? WHERE id = ?', [$hash, (int)$p['id']]);
        }
        q('UPDATE staff SET last_login = ? WHERE id = ?', [now_full(), (int)$p['id']]);
        login_session((int)$p['id'], $hash);
        respond(status_payload(staff_or_404((int)$p['id'])));

    case 'logout':
        require_method('POST');
        if (current_staff() !== null) {
            check_csrf((string)($_SESSION['csrf'] ?? ''));
        }
        end_staff_session();
        respond([]);

    case 'ical':
        require_method('GET');
        $lock = bf_locked([bf_key('ical')]);
        if ($lock > 0) {
            fail_locked($lock);
        }
        $tok = (string)($_GET['token'] ?? '');
        $staff = null;
        if (preg_match('/^(\d{1,9})-([0-9a-f]{64})$/', $tok, $m)) {
            $row = q('SELECT * FROM staff WHERE id = ?', [(int)$m[1]])->fetch();
            $stored = $row ? (string)$row['ical_token'] : str_repeat('0', 64);
            if (hash_equals($stored, $m[2]) && $row && (int)$row['active']) {
                $staff = $row;
            }
        }
        if ($staff === null) {
            bf_fail(bf_key('ical'), TEAM_BF_ICAL_FAILS);
            fail('Kalender nicht gefunden.', 404);
        }
        if (!module_on('ical')) {
            fail('Das Kalender-Abo ist zurzeit ausgeschaltet.', 404);
        }
        $ics = ical_feed($staff);
        header('Content-Type: text/calendar; charset=utf-8');
        header('Content-Disposition: inline; filename="hofbraeustueble-schichten.ics"');
        header('Cache-Control: private, max-age=900');
        echo $ics;
        exit;

    /* -------------------------------------------------------- Mitarbeiter */

    case 'staff_data':
        require_method('GET');
        $me = require_staff();
        session_close_any();
        [$from, $to] = range_params();
        respond(staff_data($me, $from, $to));

    case 'profile_save':
        require_method('POST');
        $me = require_staff();
        $phone = v_phone(inp('phone'));
        $vis = present('phone_visible') ? v_bool(inp('phone_visible'), 'Telefon sichtbar') : false;
        q('UPDATE staff SET phone = ?, phone_visible = ? WHERE id = ?', [$phone, $phone !== null && $vis ? 1 : 0, (int)$me['id']]);
        respond(['me' => me_out(staff_or_404((int)$me['id']))]);

    case 'change_password':
        require_method('POST');
        $me = require_staff();
        $old = inp('old');
        if (!is_string($old) || strlen($old) > 200 || !password_verify($old, (string)$me['password_hash'])) {
            usleep(400000);
            fail('Das bisherige Passwort stimmt nicht.', 400);
        }
        $new = v_new_password(inp('new'), 'Das neue Passwort');
        if ($new === $old) {
            fail('Das neue Passwort muss anders sein als das bisherige.', 400);
        }
        $hash = password_hash($new, PASSWORD_DEFAULT);
        q('UPDATE staff SET password_hash = ? WHERE id = ?', [$hash, (int)$me['id']]);
        session_regenerate_id(true);
        $_SESSION['stamp'] = pw_stamp($hash); // andere Geräte werden abgemeldet
        respond([]);

    case 'delete_account':
        require_method('POST');
        $me = require_staff();
        $pw = inp('password');
        if (!is_string($pw) || strlen($pw) > 200 || !password_verify($pw, (string)$me['password_hash'])) {
            usleep(400000);
            fail('Das Passwort stimmt nicht.', 400);
        }
        delete_staff((int)$me['id']);
        end_staff_session();
        respond([]);

    case 'ical_reset':
        require_method('POST');
        $me = require_staff();
        require_module('ical');
        q('UPDATE staff SET ical_token = ? WHERE id = ?', [new_ical_token(), (int)$me['id']]);
        respond(['me' => me_out(staff_or_404((int)$me['id']))]);

    case 'shift_respond':
        require_method('POST');
        $me = require_staff();
        $sh = shift_or_404(v_id(inp('id'), 'Schicht'));
        if ((int)($sh['staff_id'] ?? 0) !== (int)$me['id']) {
            fail('Das ist nicht deine Schicht.', 403);
        }
        if (shift_is_past($sh)) {
            fail('Diese Schicht ist schon vorbei.', 400);
        }
        $ans = inp('answer');
        if (!in_array($ans, ['yes', 'no'], true)) {
            fail('Bitte „Zusagen“ oder „Absagen“ wählen.', 400);
        }
        $reason = $ans === 'no' ? v_str(inp('reason'), 0, 200, 'Grund') : '';
        tx(function (PDO $pdo) use ($sh, $ans, $reason) {
            $pdo->prepare('UPDATE shifts SET response = ?, reason = ?, responded_at = ?, updated = ? WHERE id = ?')
                ->execute([$ans, $reason, now_full(), now_full(), (int)$sh['id']]);
            if ($ans === 'no') {
                $pdo->prepare("UPDATE swaps SET status = 'cancelled', updated = ? WHERE shift_id = ? AND status IN ('offered','accepted')")->execute([now_full(), (int)$sh['id']]);
            }
        });
        respond(['answer' => $ans]);

    case 'shift_take':
        require_method('POST');
        $me = require_staff();
        $id = v_id(inp('id'), 'Schicht');
        $res = tx(function (PDO $pdo) use ($id, $me) {
            $st = $pdo->prepare('SELECT * FROM shifts WHERE id = ?');
            $st->execute([$id]);
            $sh = $st->fetch();
            if (!$sh) {
                return ['error' => 'Schicht nicht gefunden.', 'code' => 404];
            }
            if ($sh['staff_id'] !== null) {
                return ['error' => 'Zu spät – diese Schicht hat schon jemand übernommen.', 'code' => 409];
            }
            if (shift_is_past($sh)) {
                return ['error' => 'Diese Schicht ist schon vorbei.', 'code' => 400];
            }
            $block = take_blockers($sh, (int)$me['id']);
            if ($block !== null) {
                return ['error' => $block, 'code' => 409];
            }
            if ((int)$sh['needs_ok']) {
                $pdo->prepare('INSERT OR IGNORE INTO takes (shift_id, staff_id, created) VALUES (?, ?, ?)')->execute([$id, (int)$me['id'], now_full()]);
                return ['result' => 'requested'];
            }
            $pdo->prepare("UPDATE shifts SET staff_id = ?, response = 'yes', reason = '', responded_at = ?, updated = ? WHERE id = ? AND staff_id IS NULL")
                ->execute([(int)$me['id'], now_full(), now_full(), $id]);
            $pdo->prepare('DELETE FROM takes WHERE shift_id = ?')->execute([$id]);
            return ['result' => 'taken'];
        });
        if (isset($res['error'])) {
            fail($res['error'], $res['code']);
        }
        respond($res);

    case 'take_cancel':
        require_method('POST');
        $me = require_staff();
        $id = v_id(inp('id'), 'Schicht');
        q('DELETE FROM takes WHERE shift_id = ? AND staff_id = ?', [$id, (int)$me['id']]);
        respond([]);

    case 'absence_request':
        require_method('POST');
        $me = require_staff();
        $from = v_date(inp('from'), 'Von');
        $to = present('to') ? v_date(inp('to'), 'Bis') : $from;
        if ($to < $from) {
            fail('„Bis“ darf nicht vor „Von“ liegen.', 400);
        }
        if ($from < date_add_days(today(), -30)) {
            fail('Das Datum liegt zu weit zurück.', 400);
        }
        if (days_between($from, $to) > 92) {
            fail('Bitte höchstens 3 Monate auf einmal eintragen.', 400);
        }
        $type = inp('type');
        if (!in_array($type, TEAM_ABSENCE_TYPES, true)) {
            fail('Bitte die Art auswählen (Urlaub, krank, sonstiges).', 400);
        }
        $note = v_str(inp('note'), 0, 300, 'Notiz', true);
        if ((int)q("SELECT COUNT(*) FROM absences WHERE staff_id = ? AND status = 'pending'", [(int)$me['id']])->fetchColumn() >= 20) {
            fail('Du hast schon viele offene Anträge. Bitte warte auf die Antwort vom Chef.', 429);
        }
        q('INSERT INTO absences (staff_id, date_from, date_to, type, note, status, created) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [(int)$me['id'], $from, $to, $type, $note, 'pending', now_full()]);
        respond(['id' => (int)db()->lastInsertId()]);

    case 'absence_cancel':
        require_method('POST');
        $me = require_staff();
        $id = v_id(inp('id'));
        $a = q('SELECT * FROM absences WHERE id = ? AND staff_id = ?', [$id, (int)$me['id']])->fetch();
        if (!$a) {
            fail('Eintrag nicht gefunden.', 404);
        }
        if ($a['status'] === 'approved' && $a['date_from'] <= today()) {
            fail('Eine laufende oder vergangene genehmigte Abwesenheit kann nur der Chef ändern.', 400);
        }
        q('DELETE FROM absences WHERE id = ?', [$id]);
        respond([]);

    case 'availability_set':
        require_method('POST');
        $me = require_staff();
        require_module('availability');
        $days = inp('days');
        if (!is_array($days) || array_is_list($days) && $days !== []) {
            fail('Ungültige Angabe.', 400);
        }
        if (count($days) > 80) {
            fail('Zu viele Tage auf einmal.', 400);
        }
        $min = date_add_days(today(), -1);
        $max = date_add_days(today(), TEAM_AVAIL_DAYS + 7);
        $clean = [];
        foreach ($days as $d => $v) {
            $d = v_date((string)$d);
            if ($d < $min || $d > $max) {
                fail('Verfügbarkeit geht nur für die nächsten 8 Wochen.', 400);
            }
            if (!in_array($v, ['yes', 'no', 'maybe', '', null], true)) {
                fail('Ungültiger Wert.', 400);
            }
            $clean[$d] = $v ?? '';
        }
        tx(function (PDO $pdo) use ($clean, $me) {
            foreach ($clean as $d => $v) {
                if ($v === '') {
                    $pdo->prepare('DELETE FROM availability WHERE staff_id = ? AND date = ?')->execute([(int)$me['id'], $d]);
                } else {
                    $pdo->prepare('INSERT INTO availability (staff_id, date, value) VALUES (?, ?, ?) ON CONFLICT(staff_id, date) DO UPDATE SET value = excluded.value')
                        ->execute([(int)$me['id'], $d, $v]);
                }
            }
        });
        respond(['saved' => count($clean)]);

    case 'swap_offer':
        require_method('POST');
        $me = require_staff();
        require_module('swap');
        $sh = shift_or_404(v_id(inp('shift_id'), 'Schicht'));
        if ((int)($sh['staff_id'] ?? 0) !== (int)$me['id']) {
            fail('Das ist nicht deine Schicht.', 403);
        }
        if (shift_is_past($sh)) {
            fail('Diese Schicht ist schon vorbei.', 400);
        }
        if ($sh['response'] === 'no') {
            fail('Du hast diese Schicht schon abgesagt – der Chef kümmert sich.', 400);
        }
        $to = present('to_staff') ? v_int(inp('to_staff'), 0, 2147483647, 'Kollege') : 0;
        if ($to !== 0) {
            $t = staff_or_404($to);
            if ($to === (int)$me['id'] || !(int)$t['active']) {
                fail('Diese Person kann die Schicht nicht übernehmen.', 400);
            }
        }
        $note = v_str(inp('note'), 0, 200, 'Notiz');
        if (q("SELECT 1 FROM swaps WHERE shift_id = ? AND status IN ('offered','accepted')", [(int)$sh['id']])->fetchColumn()) {
            fail('Für diese Schicht läuft schon ein Tausch-Angebot.', 409);
        }
        q("INSERT INTO swaps (shift_id, from_staff, to_staff, status, note, created, updated) VALUES (?, ?, ?, 'offered', ?, ?, ?)",
            [(int)$sh['id'], (int)$me['id'], $to ?: null, $note, now_full(), now_full()]);
        respond(['id' => (int)db()->lastInsertId()]);

    case 'swap_cancel':
        require_method('POST');
        $me = require_staff();
        require_module('swap');
        $id = v_id(inp('id'));
        $w = q("SELECT * FROM swaps WHERE id = ? AND from_staff = ? AND status IN ('offered','accepted')", [$id, (int)$me['id']])->fetch();
        if (!$w) {
            fail('Tausch-Angebot nicht gefunden.', 404);
        }
        q("UPDATE swaps SET status = 'cancelled', updated = ? WHERE id = ?", [now_full(), $id]);
        respond([]);

    case 'swap_accept':
    case 'swap_reject':
        require_method('POST');
        $me = require_staff();
        require_module('swap');
        $id = v_id(inp('id'));
        $res = tx(function (PDO $pdo) use ($id, $me, $action) {
            $st = $pdo->prepare("SELECT * FROM swaps WHERE id = ? AND status = 'offered'");
            $st->execute([$id]);
            $w = $st->fetch();
            $mid = (int)$me['id'];
            if (!$w || (int)$w['from_staff'] === $mid || ($w['to_staff'] !== null && (int)$w['to_staff'] !== $mid)) {
                return ['error' => 'Dieses Angebot gibt es nicht mehr.', 'code' => 404];
            }
            if ($action === 'swap_reject') {
                if ($w['to_staff'] === null) {
                    return ['error' => 'Ein Angebot an alle musst du nicht ablehnen – lass es einfach liegen.', 'code' => 400];
                }
                $pdo->prepare("UPDATE swaps SET status = 'rejected', updated = ? WHERE id = ?")->execute([now_full(), $id]);
                return ['result' => 'rejected'];
            }
            $s = $pdo->prepare('SELECT * FROM shifts WHERE id = ?');
            $s->execute([(int)$w['shift_id']]);
            $sh = $s->fetch();
            if (!$sh || shift_is_past($sh)) {
                return ['error' => 'Diese Schicht ist schon vorbei.', 'code' => 400];
            }
            $block = take_blockers($sh, $mid);
            if ($block !== null) {
                return ['error' => $block, 'code' => 409];
            }
            $pdo->prepare("UPDATE swaps SET taker_id = ?, status = 'accepted', updated = ? WHERE id = ?")->execute([$mid, now_full(), $id]);
            $w['taker_id'] = $mid;
            if (!settings()['swap_needs_chef']) {
                execute_swap($pdo, $w);
                return ['result' => 'done'];
            }
            return ['result' => 'waiting'];
        });
        if (isset($res['error'])) {
            fail($res['error'], $res['code']);
        }
        respond($res);

    case 'message_send':
        require_method('POST');
        $me = require_staff();
        $body = v_str(inp('body'), 1, TEAM_MSG_MAX, 'die Nachricht', true);
        if (rate_limited('msg:' . (int)$me['id'], TEAM_MSG_RATE, TEAM_MSG_WINDOW)) {
            fail('Du hast gerade sehr viele Nachrichten geschickt. Bitte warte ein paar Minuten.', 429);
        }
        q('INSERT INTO messages (staff_id, from_chef, body, created) VALUES (?, 0, ?, ?)', [(int)$me['id'], $body, now_full()]);
        respond(['id' => (int)db()->lastInsertId()]);

    case 'message_read':
        require_method('POST');
        $me = require_staff();
        q('UPDATE messages SET read_at = ? WHERE staff_id = ? AND from_chef = 1 AND read_at IS NULL', [now_full(), (int)$me['id']]);
        respond([]);

    case 'board_read':
        require_method('POST');
        $me = require_staff();
        require_module('board');
        $id = v_id(inp('id'));
        if (!q('SELECT 1 FROM board WHERE id = ?', [$id])->fetchColumn()) {
            fail('Aushang nicht gefunden.', 404);
        }
        q('INSERT OR IGNORE INTO board_reads (post_id, staff_id, read_at) VALUES (?, ?, ?)', [$id, (int)$me['id'], now_full()]);
        respond([]);

    case 'check_tick':
        require_method('POST');
        $me = require_staff();
        require_module('tasks');
        $sh = shift_or_404(v_id(inp('shift_id'), 'Schicht'));
        if ((int)($sh['staff_id'] ?? 0) !== (int)$me['id']) {
            fail('Das ist nicht deine Schicht.', 403);
        }
        [$s, $e] = shift_bounds((string)$sh['date'], (string)$sh['start'], (string)$sh['end']);
        if (time() < $s - TEAM_TICK_BEFORE_MIN * 60 || time() > $e + TEAM_TICK_AFTER_MIN * 60) {
            fail('Abhaken geht nur während deiner Schicht (ab 2 Stunden vorher).', 400);
        }
        $cid = v_id(inp('checklist_id'), 'Liste');
        $item = inp('item_id');
        $list = null;
        foreach (checklists_for($sh, checklists_all()) as $c) {
            if ($c['id'] === $cid) {
                $list = $c;
            }
        }
        if ($list === null || !is_string($item) || !in_array($item, array_column($list['items'], 'id'), true)) {
            fail('Aufgabe nicht gefunden.', 404);
        }
        $done = v_bool(inp('done'), 'Erledigt');
        if ($done) {
            q('INSERT OR REPLACE INTO checks (shift_id, checklist_id, item_id, staff_id, done_at) VALUES (?, ?, ?, ?, ?)', [(int)$sh['id'], $cid, $item, (int)$me['id'], now_full()]);
        } else {
            q('DELETE FROM checks WHERE shift_id = ? AND checklist_id = ? AND item_id = ?', [(int)$sh['id'], $cid, $item]);
        }
        respond(['done' => $done]);

    case 'order_add':
        require_method('POST');
        $me = require_staff();
        require_module('orders');
        if (rate_limited('order:' . (int)$me['id'], 60, 600)) {
            fail('Sehr viele Einträge in kurzer Zeit. Bitte warte ein paar Minuten.', 429);
        }
        [$oid, $existing] = order_add((int)$me['id']);
        respond(['id' => $oid, 'existing' => $existing]);

    case 'order_remove':
        require_method('POST');
        $me = require_staff();
        require_module('orders');
        $id = v_id(inp('id'));
        $n = q("DELETE FROM order_items WHERE id = ? AND created_by = ? AND status = 'low'", [$id, (int)$me['id']])->rowCount();
        if (!$n) {
            fail('Nur eigene Einträge, die noch nicht bestellt sind, kannst du entfernen.', 403);
        }
        respond([]);

    /* --------------------------------------------------------------- Chef */

    case 'chef_order_add':
        require_method('POST');
        require_chef();
        [$oid, $existing] = order_add(null);
        respond(['id' => $oid, 'existing' => $existing]);

    case 'chef_order_status':
        require_method('POST');
        require_chef();
        $id = v_id(inp('id'));
        $st = inp('status');
        if (!in_array($st, TEAM_ORDER_STATUS, true)) {
            fail('Ungültiger Status.', 400);
        }
        if (!q('UPDATE order_items SET status = ?, updated = ? WHERE id = ?', [$st, now_full(), $id])->rowCount()) {
            fail('Eintrag nicht gefunden.', 404);
        }
        respond([]);

    case 'chef_order_delete':
        require_method('POST');
        require_chef();
        q('DELETE FROM order_items WHERE id = ?', [v_id(inp('id'))]);
        respond([]);

    case 'chef_catalog_save':
        require_method('POST');
        require_chef();
        $id = present('id') ? v_id(inp('id')) : null;
        $name = v_str(inp('name'), 1, 80, 'den Artikel');
        $cat = order_cat(inp('category'));
        $qty = v_str(inp('qty'), 0, 40, 'Menge');
        if ($id !== null) {
            if (!q('UPDATE order_catalog SET name = ?, category = ?, qty = ? WHERE id = ?', [$name, $cat, $qty, $id])->rowCount()) {
                fail('Artikel nicht gefunden.', 404);
            }
        } else {
            if ((int)q('SELECT COUNT(*) FROM order_catalog')->fetchColumn() >= 200) {
                fail('Höchstens 200 Artikel.', 400);
            }
            q('INSERT INTO order_catalog (name, category, qty) VALUES (?, ?, ?)', [$name, $cat, $qty]);
            $id = (int)db()->lastInsertId();
        }
        respond(['id' => $id]);

    case 'chef_catalog_delete':
        require_method('POST');
        require_chef();
        q('DELETE FROM order_catalog WHERE id = ?', [v_id(inp('id'))]);
        respond([]);

    case 'chef_data':
        require_method('GET');
        require_chef();
        [$from, $to] = range_params();
        respond(chef_data($from, $to));

    case 'chef_hours':
        require_method('GET');
        require_chef();
        respond(['month' => v_month(inp('month')), 'rows' => hours_for(v_month(inp('month')))]);

    case 'chef_thread':
        require_method('GET');
        require_chef();
        $sid = v_id(inp('staff_id'), 'Mitarbeiter');
        $st = staff_or_404($sid);
        $msgs = array_map(fn($m) => ['id' => (int)$m['id'], 'from_chef' => (bool)(int)$m['from_chef'], 'body' => (string)$m['body'], 'created' => (string)$m['created'], 'read' => $m['read_at'] !== null],
            array_reverse(q('SELECT * FROM messages WHERE staff_id = ? ORDER BY id DESC LIMIT 200', [$sid])->fetchAll()));
        respond(['staff_id' => $sid, 'name' => (string)$st['name'], 'messages' => $msgs]);

    case 'chef_message_send':
        require_method('POST');
        require_chef();
        $sid = v_id(inp('staff_id'), 'Mitarbeiter');
        staff_or_404($sid);
        $body = v_str(inp('body'), 1, TEAM_MSG_MAX, 'die Nachricht', true);
        q('INSERT INTO messages (staff_id, from_chef, body, created) VALUES (?, 1, ?, ?)', [$sid, $body, now_full()]);
        respond(['id' => (int)db()->lastInsertId()]);

    case 'chef_message_read':
        require_method('POST');
        require_chef();
        $sid = v_id(inp('staff_id'), 'Mitarbeiter');
        q('UPDATE messages SET read_at = ? WHERE staff_id = ? AND from_chef = 0 AND read_at IS NULL', [now_full(), $sid]);
        respond([]);

    case 'chef_invite_create':
        require_method('POST');
        require_chef();
        $note = v_str(inp('note'), 0, 60, 'Notiz');
        $exp = present('expires') ? v_date(inp('expires'), 'Gültig bis') : null;
        if ($exp !== null && $exp < today()) {
            fail('„Gültig bis“ liegt in der Vergangenheit.', 400);
        }
        $code = '';
        for ($i = 0; $i < 10; $i++) {
            $code = random_string(TEAM_INVITE_ALPHABET, 8);
            if (!q('SELECT 1 FROM invites WHERE code = ?', [$code])->fetchColumn()) {
                break;
            }
        }
        q('INSERT INTO invites (code, note, expires, revoked, created) VALUES (?, ?, ?, 0, ?)', [$code, $note, $exp, now_full()]);
        respond(['invite' => invite_out(q('SELECT * FROM invites WHERE code = ?', [$code])->fetch())]);

    case 'chef_invite_revoke':
        require_method('POST');
        require_chef();
        $code = norm_code(inp('code'));
        if ($code === '' || !q('SELECT 1 FROM invites WHERE code = ?', [$code])->fetchColumn()) {
            fail('Einladung nicht gefunden.', 404);
        }
        q('UPDATE invites SET revoked = 1 WHERE code = ?', [$code]);
        respond([]);

    case 'chef_staff_update':
        require_method('POST');
        require_chef();
        $id = v_id(inp('id'), 'Mitarbeiter');
        $st = staff_or_404($id);
        $active = present('active') ? (v_bool(inp('active'), 'Aktiv') ? 1 : 0) : (int)$st['active'];
        $wage = array_key_exists('wage', body()) ? v_money(inp('wage'), 'Stundenlohn', 20000) : ($st['wage_cents'] !== null ? (int)$st['wage_cents'] : null);
        $limit = array_key_exists('limit', body()) ? v_money(inp('limit'), 'Monatsgrenze', 1000000) : ($st['limit_cents'] !== null ? (int)$st['limit_cents'] : null);
        q('UPDATE staff SET active = ?, wage_cents = ?, limit_cents = ? WHERE id = ?', [$active, $wage, $limit, $id]);
        respond([]);

    case 'chef_staff_reset':
        require_method('POST');
        require_chef();
        $id = v_id(inp('id'), 'Mitarbeiter');
        staff_or_404($id);
        $temp = random_string(TEAM_PW_ALPHABET, 10);
        q('UPDATE staff SET password_hash = ? WHERE id = ?', [password_hash($temp, PASSWORD_DEFAULT), $id]);
        respond(['temp_password' => $temp]);

    case 'chef_staff_delete':
        require_method('POST');
        require_chef();
        $id = v_id(inp('id'), 'Mitarbeiter');
        staff_or_404($id);
        delete_staff($id);
        respond([]);

    case 'chef_shift_save':
        require_method('POST');
        require_chef();
        $id = present('id') ? v_id(inp('id'), 'Schicht') : null;
        $old = $id !== null ? shift_or_404($id) : null;
        $date = v_date(inp('date'));
        $start = v_time(inp('start'), 'Beginn');
        $end = v_time(inp('end'), 'Ende');
        if ($start === $end) {
            fail('Beginn und Ende dürfen nicht gleich sein.', 400);
        }
        $label = v_str(inp('label'), 0, 40, 'Bezeichnung');
        $note = v_str(inp('note'), 0, 300, 'Notiz', true);
        $staffId = present('staff_id') ? v_int(inp('staff_id'), 0, 2147483647, 'Mitarbeiter') : 0;
        if ($staffId !== 0) {
            staff_or_404($staffId);
        }
        $needsOk = present('needs_ok') ? v_bool(inp('needs_ok'), 'Nur nach Bestätigung') : settings()['take_needs_ok'];
        $confirmed = present('confirmed') ? v_bool(inp('confirmed'), 'Zugesagt') : false;
        $repeatUntil = ($old === null && present('repeat_until')) ? v_date(inp('repeat_until'), 'Wiederholen bis') : null;
        $dates = [$date];
        if ($repeatUntil !== null) {
            if ($repeatUntil <= $date) {
                fail('„Wiederholen bis“ muss nach dem ersten Datum liegen.', 400);
            }
            $d = $date;
            while (true) {
                $d = date_add_days($d, 7);
                if ($d > $repeatUntil) {
                    break;
                }
                $dates[] = $d;
                if (count($dates) > TEAM_MAX_REPEAT) {
                    fail('Höchstens ' . TEAM_MAX_REPEAT . ' Wiederholungen (ca. 1 Jahr) auf einmal.', 400);
                }
            }
        }
        $ids = tx(function (PDO $pdo) use ($old, $dates, $start, $end, $label, $note, $staffId, $needsOk, $confirmed) {
            $now = now_full();
            $sid = $staffId ?: null;
            if ($old !== null) {
                $sameStaff = (int)($old['staff_id'] ?? 0) === $staffId;
                $sameTime = $old['date'] === $dates[0] && $old['start'] === $start && $old['end'] === $end;
                $response = (string)$old['response'];
                $reason = (string)$old['reason'];
                $responded = $old['responded_at'];
                if (!$sameStaff || !$sameTime || $sid === null) {
                    $response = 'none';
                    $reason = '';
                    $responded = null;
                }
                if ($confirmed && $sid !== null) {
                    $response = 'yes';
                    $reason = '';
                    $responded = $responded ?? $now;
                }
                $pdo->prepare('UPDATE shifts SET date = ?, start = ?, "end" = ?, label = ?, note = ?, staff_id = ?, response = ?, reason = ?, responded_at = ?, needs_ok = ?, former = CASE WHEN ? IS NULL THEN former ELSE 0 END, updated = ? WHERE id = ?')
                    ->execute([$dates[0], $start, $end, $label, $note, $sid, $response, $reason, $responded, $needsOk ? 1 : 0, $sid, $now, (int)$old['id']]);
                if (!$sameStaff || $sid !== null) {
                    $pdo->prepare('DELETE FROM takes WHERE shift_id = ?')->execute([(int)$old['id']]);
                }
                if (!$sameStaff || !$sameTime) {
                    $pdo->prepare("UPDATE swaps SET status = 'cancelled', updated = ? WHERE shift_id = ? AND status IN ('offered','accepted')")->execute([$now, (int)$old['id']]);
                }
                return [(int)$old['id']];
            }
            $series = count($dates) > 1 ? bin2hex(random_bytes(6)) : null;
            $ids = [];
            foreach ($dates as $d) {
                $pdo->prepare('INSERT INTO shifts (date, start, "end", label, note, staff_id, response, responded_at, needs_ok, series_id, created, updated) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
                    ->execute([$d, $start, $end, $label, $note, $sid, $confirmed && $sid ? 'yes' : 'none', $confirmed && $sid ? $now : null, $needsOk ? 1 : 0, $series, $now, $now]);
                $ids[] = (int)$pdo->lastInsertId();
            }
            return $ids;
        });
        $from = $dates[0];
        $to = end($dates);
        $all = shifts_out(load_shifts($from, $to), $from, $to, null);
        $created = array_values(array_filter($all, fn($s) => in_array($s['id'], $ids, true)));
        $warnings = [];
        foreach ($created as $s) {
            foreach ($s['conflicts'] ?? [] as $c) {
                $warnings[] = ['date' => $s['date'], 'type' => $c['type'], 'text' => $c['text']];
            }
        }
        respond(['ids' => $ids, 'shifts' => $created, 'warnings' => $warnings]);

    case 'chef_shift_delete':
        require_method('POST');
        require_chef();
        $sh = shift_or_404(v_id(inp('id'), 'Schicht'));
        $scope = inp('scope') === 'following' && $sh['series_id'] !== null ? 'following' : 'one';
        if ($scope === 'following') {
            $n = q('DELETE FROM shifts WHERE series_id = ? AND date >= ?', [$sh['series_id'], $sh['date']])->rowCount();
        } else {
            $n = q('DELETE FROM shifts WHERE id = ?', [(int)$sh['id']])->rowCount();
        }
        respond(['deleted' => $n]);

    case 'chef_take_decide':
        require_method('POST');
        require_chef();
        $id = v_id(inp('shift_id'), 'Schicht');
        $sid = v_id(inp('staff_id'), 'Mitarbeiter');
        $approve = v_bool(inp('approve'), 'Entscheidung');
        $res = tx(function (PDO $pdo) use ($id, $sid, $approve) {
            $st = $pdo->prepare('SELECT 1 FROM takes WHERE shift_id = ? AND staff_id = ?');
            $st->execute([$id, $sid]);
            if (!$st->fetchColumn()) {
                return ['error' => 'Anfrage nicht gefunden.', 'code' => 404];
            }
            if (!$approve) {
                $pdo->prepare('DELETE FROM takes WHERE shift_id = ? AND staff_id = ?')->execute([$id, $sid]);
                return ['result' => 'declined'];
            }
            $s = $pdo->prepare('SELECT * FROM shifts WHERE id = ?');
            $s->execute([$id]);
            $sh = $s->fetch();
            if (!$sh || $sh['staff_id'] !== null) {
                return ['error' => 'Die Schicht ist schon vergeben.', 'code' => 409];
            }
            $pdo->prepare("UPDATE shifts SET staff_id = ?, response = 'yes', reason = '', responded_at = ?, updated = ? WHERE id = ?")->execute([$sid, now_full(), now_full(), $id]);
            $pdo->prepare('DELETE FROM takes WHERE shift_id = ?')->execute([$id]);
            return ['result' => 'approved'];
        });
        if (isset($res['error'])) {
            fail($res['error'], $res['code']);
        }
        respond($res);

    case 'chef_absence_decide':
        require_method('POST');
        require_chef();
        $id = v_id(inp('id'));
        $a = q('SELECT * FROM absences WHERE id = ?', [$id])->fetch();
        if (!$a) {
            fail('Antrag nicht gefunden.', 404);
        }
        $approve = v_bool(inp('approve'), 'Entscheidung');
        $comment = v_str(inp('comment'), 0, 300, 'Kommentar', true);
        q('UPDATE absences SET status = ?, chef_comment = ?, decided_at = ? WHERE id = ?', [$approve ? 'approved' : 'declined', $comment, now_full(), $id]);
        $affected = [];
        if ($approve) {
            foreach (q("SELECT id, date, start, \"end\", label FROM shifts WHERE staff_id = ? AND response != 'no' AND date BETWEEN ? AND ? ORDER BY date", [(int)$a['staff_id'], $a['date_from'], $a['date_to']])->fetchAll() as $s) {
                $affected[] = $s;
            }
        }
        respond(['affected_shifts' => $affected]);

    case 'chef_absence_delete':
        require_method('POST');
        require_chef();
        $id = v_id(inp('id'));
        q('DELETE FROM absences WHERE id = ?', [$id]);
        respond([]);

    case 'chef_swap_decide':
        require_method('POST');
        require_chef();
        $id = v_id(inp('id'));
        $approve = v_bool(inp('approve'), 'Entscheidung');
        $res = tx(function (PDO $pdo) use ($id, $approve) {
            $st = $pdo->prepare("SELECT * FROM swaps WHERE id = ? AND status IN ('accepted','offered')");
            $st->execute([$id]);
            $w = $st->fetch();
            if (!$w) {
                return ['error' => 'Tausch nicht gefunden.', 'code' => 404];
            }
            if (!$approve) {
                $pdo->prepare("UPDATE swaps SET status = 'declined', updated = ? WHERE id = ?")->execute([now_full(), $id]);
                return ['result' => 'declined'];
            }
            if ($w['status'] !== 'accepted' || $w['taker_id'] === null) {
                return ['error' => 'Es hat noch niemand den Tausch angenommen.', 'code' => 400];
            }
            try {
                execute_swap($pdo, $w);
            } catch (DomainException $e) {
                return ['error' => $e->getMessage(), 'code' => 409];
            }
            return ['result' => 'done'];
        });
        if (isset($res['error'])) {
            fail($res['error'], $res['code']);
        }
        respond($res);

    case 'chef_board_post':
        require_method('POST');
        require_chef();
        $title = v_str(inp('title'), 0, 80, 'Überschrift');
        $body = v_str(inp('body'), 1, 2000, 'den Text', true);
        q('INSERT INTO board (title, body, created) VALUES (?, ?, ?)', [$title, $body, now_full()]);
        respond(['id' => (int)db()->lastInsertId()]);

    case 'chef_board_delete':
        require_method('POST');
        require_chef();
        q('DELETE FROM board WHERE id = ?', [v_id(inp('id'))]);
        respond([]);

    case 'chef_checklist_save':
        require_method('POST');
        require_chef();
        $id = present('id') ? v_id(inp('id')) : null;
        $name = v_str(inp('name'), 1, 60, 'einen Namen für die Liste');
        $label = v_str(inp('label'), 0, 40, 'Bezeichnung');
        $items = v_items(inp('items'));
        if ($id !== null) {
            if (!q('SELECT 1 FROM checklists WHERE id = ?', [$id])->fetchColumn()) {
                fail('Liste nicht gefunden.', 404);
            }
            q('UPDATE checklists SET name = ?, label = ?, items = ? WHERE id = ?', [$name, $label, json_encode($items, JSON_UNESCAPED_UNICODE), $id]);
        } else {
            if ((int)q('SELECT COUNT(*) FROM checklists')->fetchColumn() >= 30) {
                fail('Höchstens 30 Listen.', 400);
            }
            q('INSERT INTO checklists (name, label, items, created) VALUES (?, ?, ?, ?)', [$name, $label, json_encode($items, JSON_UNESCAPED_UNICODE), now_full()]);
            $id = (int)db()->lastInsertId();
        }
        respond(['id' => $id, 'checklists' => checklists_all()]);

    case 'chef_checklist_delete':
        require_method('POST');
        require_chef();
        q('DELETE FROM checklists WHERE id = ?', [v_id(inp('id'))]);
        respond(['checklists' => checklists_all()]);

    case 'chef_settings_save':
        require_method('POST');
        require_chef();
        $s = settings();
        $mods = inp('modules');
        if ($mods !== null) {
            if (!is_array($mods)) {
                fail('Ungültige Angabe.', 400);
            }
            foreach (TEAM_MODULES as $m) {
                if (array_key_exists($m, $mods)) {
                    $s['modules'][$m] = v_bool($mods[$m], 'Funktion');
                }
            }
        }
        foreach (['swap_needs_chef', 'take_needs_ok'] as $k) {
            if (present($k)) {
                $s[$k] = v_bool(inp($k), 'Einstellung');
            }
        }
        if (present('minijob_limit')) {
            $s['minijob_limit_cents'] = v_money(inp('minijob_limit'), 'Minijob-Grenze', 1000000) ?? TEAM_DEFAULT_SETTINGS['minijob_limit_cents'];
        }
        $labels = inp('labels');
        if ($labels !== null) {
            if (!is_array($labels) || !array_is_list($labels) || count($labels) > 20) {
                fail('Bezeichnungen: höchstens 20.', 400);
            }
            $clean = [];
            foreach ($labels as $l) {
                $l = v_str($l, 0, 40, 'Bezeichnung');
                if ($l !== '' && !in_array(lower($l), array_map('lower', $clean), true)) {
                    $clean[] = $l;
                }
            }
            $s['labels'] = $clean;
        }
        settings_save($s);
        respond(['settings' => $s]);

    default:
        fail('Unbekannte Aktion.', 400);
}
} catch (PDOException $e) {
    error_log('[hbs-team] DB: ' . $e->getMessage());
    fail('Datenbankfehler. Bitte später noch mal versuchen.', 500);
}
