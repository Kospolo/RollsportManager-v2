<?php
/*
 * Hofbräustüble – Gäste-Anfragen: Tischreservierung (Anfrage) und Anmeldung zu Veranstaltungen
 * PHP 8, eigene SQLite-Datei cms/data/gast.sqlite (wird automatisch angelegt, nicht öffentlich).
 *
 * Öffentlich (Website):
 *   GET  gast-api.php?action=status      → {ok, api:"hbs-gast", reservierung, anmeldung}
 *   GET  gast-api.php?action=token       → {ok, token}  Formular-Zeitstempel (signiert, gegen Spam-Roboter)
 *   GET  gast-api.php?action=plaetze     → {ok, events:{<id>:{max,taken,free,open,reason}}}  nur Zahlen, keine Namen
 *   POST gast-api.php?action=reservieren → JSON {name, phone, email?, date, time, persons, note?, anlass?, consent, token, homepage}
 *   POST gast-api.php?action=anmelden    → JSON {event, name, phone, persons, note?, consent, token, homepage}
 * Nur mit angemeldeter Verwaltung (Sitzung aus cms/api.php; POST zusätzlich Header X-CSRF-Token):
 *   GET  admin_overview                  → alle Anfragen und Anmeldungen (räumt vorher Abgelaufenes auf)
 *   GET  admin_counts                    → {neu, anmNeu} für den Hinweis-Punkt im Menü
 *   POST admin_res_update  {id, status?, internalNote?, called?}
 *   POST admin_res_delete  {id}
 *   POST admin_anm_delete  {id}
 *   POST admin_anm_seen    {}            → alle Anmeldungen als gesehen markieren
 *
 * Spam-Schutz ohne Fremddienste: verstecktes Feld ("homepage"), Mindestzeit zum Ausfüllen (signierter
 * Zeitstempel), Begrenzung je IP (nur Hash gespeichert) und insgesamt, Längenbegrenzungen.
 * Datensparsamkeit: Anfragen werden N Tage nach dem Termin gelöscht (Standard 30), Anmeldungen 7 Tage
 * nach der Veranstaltung. Öffentliche Antworten enthalten nie Namen oder Telefonnummern.
 */
declare(strict_types=1);

define('HBS_CMS', true);

define('GAST_CMS_DIR', __DIR__);
define('GAST_DATA_DIR', GAST_CMS_DIR . '/data');
define('GAST_DB_FILE', GAST_DATA_DIR . '/gast.sqlite');
define('GAST_CONTENT_FILE', GAST_CMS_DIR . '/content.json');
const GAST_CMS_SESSION_NAME = 'HBSCMS';
const GAST_MAX_BODY = 8192;
const GAST_MIN_SECONDS = 3;          // schneller kann kein Mensch das Formular ausfüllen
const GAST_TOKEN_MAX_AGE = 6 * 3600; // Formular gilt 6 Stunden
const GAST_IP_SUBMITS_PER_HOUR = 5;  // erfolgreiche Anfragen je IP und Stunde
const GAST_IP_POSTS_PER_HOUR = 30;   // Versuche (auch fehlerhafte) je IP und Stunde
const GAST_ALL_SUBMITS_PER_HOUR = 60; // insgesamt – Schutz vor Überflutung
const GAST_SIGNUP_KEEP_DAYS = 7;     // Anmeldungen: Löschung 7 Tage nach der Veranstaltung
const GAST_STATUSES = ['neu', 'bestaetigt', 'abgelehnt'];

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
    error_log('[hbs-gast] ' . $e->getMessage() . ' in ' . $e->getFile() . ':' . $e->getLine());
    if (!headers_sent()) {
        http_response_code(500);
        header('Content-Type: application/json; charset=utf-8');
    }
    echo json_encode(['ok' => false, 'api' => 'hbs-gast', 'error' => 'Interner Serverfehler. Bitte später erneut versuchen oder anrufen.'], JSON_UNESCAPED_UNICODE);
});

/* ================================================================== Hilfen */

function respond(array $data, int $code = 200): never
{
    http_response_code($code);
    echo json_encode(['ok' => true, 'api' => 'hbs-gast'] + $data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function fail(string $message, int $code = 400, array $extra = []): never
{
    http_response_code($code);
    echo json_encode(['ok' => false, 'api' => 'hbs-gast', 'error' => $message] + $extra, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function method(): string
{
    return strtoupper((string)($_SERVER['REQUEST_METHOD'] ?? 'GET'));
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

function str_len(string $s): int
{
    return (int)preg_match_all('/./us', $s);
}

function require_post(): void
{
    if (method() !== 'POST') {
        header('Allow: POST');
        fail('Nur POST erlaubt.', 405);
    }
}

function body(): array
{
    static $body = null;
    if ($body !== null) {
        return $body;
    }
    $ct = strtolower((string)($_SERVER['CONTENT_TYPE'] ?? ''));
    if (!str_contains($ct, 'application/json')) {
        fail('Bitte Daten als JSON senden.', 415);
    }
    if ((int)($_SERVER['CONTENT_LENGTH'] ?? 0) > GAST_MAX_BODY) {
        fail('Die Daten sind zu groß.', 413);
    }
    $raw = (string)file_get_contents('php://input', false, null, 0, GAST_MAX_BODY + 1);
    if (strlen($raw) > GAST_MAX_BODY) {
        fail('Die Daten sind zu groß.', 413);
    }
    $data = json_decode($raw, true, 8);
    if (!is_array($data) || ($data !== [] && array_is_list($data))) {
        fail('Ungültige Daten.', 400);
    }
    return $body = $data;
}

/** Text aus dem Body: Steuerzeichen raus, getrimmt; $multi erlaubt Zeilenumbrüche. */
function text_in(string $key, bool $multi = false): string
{
    $v = body()[$key] ?? '';
    if (is_int($v) || is_float($v)) {
        $v = (string)$v;
    }
    if (!is_string($v)) {
        return '';
    }
    if (preg_match('//u', $v) !== 1) { // kein gültiges UTF-8
        return '';
    }
    $v = str_replace(["\r\n", "\r"], "\n", $v);
    $v = (string)preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F\x{200B}-\x{200F}\x{202A}-\x{202E}\x{2066}-\x{2069}]/u', '', $v);
    if (!$multi) {
        $v = (string)preg_replace('/\s+/u', ' ', $v);
    } else {
        $v = (string)preg_replace("/\n{3,}/", "\n\n", $v);
    }
    return trim($v);
}

function int_in(string $key): ?int
{
    $v = body()[$key] ?? null;
    if (is_int($v)) {
        return $v;
    }
    if (is_string($v) && preg_match('/^\d{1,4}$/', trim($v))) {
        return (int)trim($v);
    }
    return null;
}

/** Fremde Seiten dürfen hier nichts absenden (Origin / Sec-Fetch-Site). */
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

function ip_hash(): string
{
    return substr(hash('sha256', 'hbs-gast|' . (string)($_SERVER['REMOTE_ADDR'] ?? 'unknown')), 0, 32);
}

/* ================================================================ Inhalte */

function content(): array
{
    static $c = null;
    if ($c === null) {
        $raw = is_file(GAST_CONTENT_FILE) ? (string)file_get_contents(GAST_CONTENT_FILE) : '';
        $c = json_decode($raw, true);
        if (!is_array($c)) {
            $c = [];
        }
    }
    return $c;
}

function features(): array
{
    $f = ['tippspiel' => true, 'team' => true, 'reservierung' => false, 'speisekarte' => true, 'anmeldung' => false, 'programm' => true, 'preise' => false, 'kasse' => false];
    $c = content()['features'] ?? null;
    if (is_array($c)) {
        foreach ($f as $k => $v) {
            if (isset($c[$k]) && is_bool($c[$k])) {
                $f[$k] = $c[$k];
            }
        }
    }
    return $f;
}

function clamp_int(mixed $v, int $min, int $max, int $def): int
{
    if (!is_int($v)) {
        return $def;
    }
    return max($min, min($max, $v));
}

function res_settings(): array
{
    $r = content()['reservierung'] ?? [];
    $r = is_array($r) ? $r : [];
    return [
        'maxPersons' => clamp_int($r['maxPersons'] ?? null, 1, 200, 12),
        'leadHours' => clamp_int($r['leadHours'] ?? null, 0, 336, 3),
        'maxDaysAhead' => clamp_int($r['maxDaysAhead'] ?? null, 1, 365, 60),
        'useOpeningHours' => ($r['useOpeningHours'] ?? true) !== false,
        'deleteAfterDays' => clamp_int($r['deleteAfterDays'] ?? null, 1, 365, 30),
        'notifyEmail' => ($r['notifyEmail'] ?? false) === true,
        'notifyAddress' => is_string($r['notifyAddress'] ?? null) ? trim($r['notifyAddress']) : '',
    ];
}

function anm_settings(): array
{
    $a = content()['anmeldung'] ?? [];
    $a = is_array($a) ? $a : [];
    return [
        'maxPersons' => clamp_int($a['maxPersons'] ?? null, 1, 50, 6),
        'notifyEmail' => ($a['notifyEmail'] ?? false) === true,
        'notifyAddress' => is_string($a['notifyAddress'] ?? null) ? trim($a['notifyAddress']) : '',
    ];
}

function contact_phone(): string
{
    $p = content()['contact']['phone'] ?? '';
    return is_string($p) ? $p : '';
}

/**
 * Öffnungszeiten-Text → Liste von [öffnet, schließt] in Minuten (schließt > öffnet, über Mitternacht +1440).
 * [] = Ruhetag, null = nicht auswertbar (dann ist jede Uhrzeit erlaubt). Gleiche Regeln wie HBS.parseHours (JS).
 */
function parse_hours(mixed $str): ?array
{
    $s = trim(is_string($str) ? $str : '');
    if ($s === '') {
        return null;
    }
    $out = [];
    if (preg_match_all('/(\d{1,2})(?:[:.](\d{2}))?\s*(?:uhr)?\s*(?:–|—|-|bis)\s*(\d{1,2})(?:[:.](\d{2}))?/iu', $s, $mm, PREG_SET_ORDER)) {
        foreach ($mm as $m) {
            $o = (int)$m[1] * 60 + (int)($m[2] ?? 0);
            $c = (int)$m[3] * 60 + (int)($m[4] ?? 0);
            if ($o > 1440 || $c > 1440) {
                continue;
            }
            if ($c <= $o) {
                $c += 1440;
            }
            $out[] = [$o, $c];
        }
    }
    if ($out) {
        return $out;
    }
    if (preg_match('/ruhetag|geschlossen|zu\b|closed/iu', $s)) {
        return [];
    }
    return null;
}

/** Prüft Wunschtermin gegen Öffnungszeiten (letzte Ankunft 30 Min. vor Schluss, spätestens 23:30). */
function check_opening(string $date, string $time): ?string
{
    $hours = content()['openingHours'] ?? null;
    if (!is_array($hours) || count($hours) !== 7) {
        return null;
    }
    $idx = (int)date('N', (int)strtotime($date . ' 12:00')) - 1; // 0 = Montag
    $ranges = parse_hours($hours[$idx]['hours'] ?? '');
    if ($ranges === null) {
        return null;
    }
    $day = is_string($hours[$idx]['day'] ?? null) ? $hours[$idx]['day'] : 'diesem Tag';
    if ($ranges === []) {
        return 'Am ' . $day . ' haben wir geschlossen (Ruhetag). Bitte einen anderen Tag wählen.';
    }
    [$h, $mi] = array_map('intval', explode(':', $time));
    $t = $h * 60 + $mi;
    foreach ($ranges as [$o, $c]) {
        $last = min($c - 30, 23 * 60 + 30);
        if ($t >= $o && $t <= $last) {
            return null;
        }
    }
    return 'Zu dieser Uhrzeit haben wir am ' . $day . ' nicht geöffnet. Bitte eine Uhrzeit innerhalb der Öffnungszeiten wählen.';
}

/* ================================================================ Datenbank */

function db(): PDO
{
    static $pdo = null;
    if ($pdo) {
        return $pdo;
    }
    if (!class_exists('PDO') || !in_array('sqlite', PDO::getAvailableDrivers(), true)) {
        fail('Die Anfragen brauchen die PHP-Erweiterung pdo_sqlite. Bitte beim Hoster aktivieren.', 500);
    }
    if (!ensure_dir(GAST_DATA_DIR) || !is_writable(GAST_DATA_DIR)) {
        fail('Der Ordner cms/data ist nicht beschreibbar.', 500);
    }
    $new = !is_file(GAST_DB_FILE);
    $pdo = new PDO('sqlite:' . GAST_DB_FILE, null, null, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_TIMEOUT => 5,
    ]);
    $pdo->exec('PRAGMA busy_timeout = 5000');
    $pdo->exec('PRAGMA journal_mode = WAL');
    $pdo->exec('PRAGMA foreign_keys = ON');
    if ($new) {
        @chmod(GAST_DB_FILE, 0640);
    }
    if ((int)$pdo->query('PRAGMA user_version')->fetchColumn() < 1) {
        $pdo->exec('BEGIN IMMEDIATE');
        try {
            $pdo->exec(<<<'SQL'
                CREATE TABLE IF NOT EXISTS meta (
                    k TEXT PRIMARY KEY,
                    v TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS reservations (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    created TEXT NOT NULL,
                    day TEXT NOT NULL,
                    time TEXT NOT NULL,
                    persons INTEGER NOT NULL,
                    name TEXT NOT NULL,
                    phone TEXT NOT NULL,
                    email TEXT NOT NULL DEFAULT '',
                    note TEXT NOT NULL DEFAULT '',
                    anlass TEXT NOT NULL DEFAULT '',
                    status TEXT NOT NULL DEFAULT 'neu',
                    internal_note TEXT NOT NULL DEFAULT '',
                    called INTEGER NOT NULL DEFAULT 0,
                    updated TEXT NULL
                );
                CREATE INDEX IF NOT EXISTS idx_res_day ON reservations(day);
                CREATE TABLE IF NOT EXISTS signups (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    created TEXT NOT NULL,
                    event_id TEXT NOT NULL,
                    event_title TEXT NOT NULL,
                    event_date TEXT NOT NULL,
                    name TEXT NOT NULL,
                    phone TEXT NOT NULL,
                    persons INTEGER NOT NULL,
                    note TEXT NOT NULL DEFAULT '',
                    seen INTEGER NOT NULL DEFAULT 0
                );
                CREATE INDEX IF NOT EXISTS idx_signups_event ON signups(event_id);
                CREATE TABLE IF NOT EXISTS hits (
                    k TEXT NOT NULL,
                    t INTEGER NOT NULL
                );
                CREATE INDEX IF NOT EXISTS idx_hits ON hits(k, t);
            SQL);
            $pdo->exec('PRAGMA user_version = 1');
            $pdo->exec('COMMIT');
        } catch (Throwable $e) {
            $pdo->exec('ROLLBACK');
            throw $e;
        }
    }
    return $pdo;
}

function q(string $sql, array $params = []): PDOStatement
{
    $st = db()->prepare($sql);
    $st->execute($params);
    return $st;
}

function secret(): string
{
    $s = q("SELECT v FROM meta WHERE k = 'secret'")->fetchColumn();
    if (is_string($s) && strlen($s) === 64) {
        return $s;
    }
    q("INSERT OR IGNORE INTO meta (k, v) VALUES ('secret', ?)", [bin2hex(random_bytes(32))]);
    return (string)q("SELECT v FROM meta WHERE k = 'secret'")->fetchColumn();
}

/** Abgelaufene Daten löschen (Datensparsamkeit) */
function cleanup(): void
{
    $days = res_settings()['deleteAfterDays'];
    q('DELETE FROM reservations WHERE day < ?', [date('Y-m-d', strtotime('-' . $days . ' days'))]);
    q('DELETE FROM signups WHERE event_date < ?', [date('Y-m-d', strtotime('-' . GAST_SIGNUP_KEEP_DAYS . ' days'))]);
    q('DELETE FROM hits WHERE t < ?', [time() - 86400]);
}

/* ================================================================ Spam-Schutz */

function make_token(): string
{
    $ts = (string)time();
    $nonce = bin2hex(random_bytes(6));
    $sig = substr(hash_hmac('sha256', $ts . '.' . $nonce, secret()), 0, 32);
    return $ts . '.' . $nonce . '.' . $sig;
}

function check_token(): void
{
    $t = body()['token'] ?? '';
    if (!is_string($t) || !preg_match('/^(\d{9,11})\.([0-9a-f]{12})\.([0-9a-f]{32})$/', $t, $m)) {
        fail('Das Formular ist nicht mehr gültig. Bitte die Seite neu laden und noch einmal absenden.', 400, ['code' => 'token']);
    }
    $sig = substr(hash_hmac('sha256', $m[1] . '.' . $m[2], secret()), 0, 32);
    if (!hash_equals($sig, $m[3])) {
        fail('Das Formular ist nicht mehr gültig. Bitte die Seite neu laden und noch einmal absenden.', 400, ['code' => 'token']);
    }
    $age = time() - (int)$m[1];
    if ($age > GAST_TOKEN_MAX_AGE || $age < -60) {
        fail('Das Formular war zu lange geöffnet. Bitte die Seite neu laden und noch einmal absenden.', 400, ['code' => 'token']);
    }
    if ($age < GAST_MIN_SECONDS) {
        fail('Das ging sehr schnell – bitte prüfen Sie Ihre Angaben und tippen Sie dann noch einmal auf „Absenden“.', 400, ['code' => 'fast']);
    }
}

function hits(string $k, int $window): int
{
    return (int)q('SELECT COUNT(*) FROM hits WHERE k = ? AND t > ?', [$k, time() - $window])->fetchColumn();
}

function hit(string $k): void
{
    q('INSERT INTO hits (k, t) VALUES (?, ?)', [$k, time()]);
}

/** Vor jeder öffentlichen Einsendung: Versuch zählen und Grenzen prüfen. */
function rate_limit_check(): void
{
    $ip = ip_hash();
    $phone = contact_phone();
    $call = $phone !== '' ? ' Rufen Sie uns gern an: ' . $phone . '.' : '';
    if (hits('a:' . $ip, 3600) >= GAST_IP_POSTS_PER_HOUR) {
        header('Retry-After: 3600');
        fail('Zu viele Versuche. Bitte später noch einmal versuchen.' . $call, 429);
    }
    hit('a:' . $ip);
    if (hits('s:' . $ip, 3600) >= GAST_IP_SUBMITS_PER_HOUR) {
        header('Retry-After: 3600');
        fail('Sie haben in der letzten Stunde schon mehrere Anfragen geschickt. Bitte später noch einmal versuchen.' . $call, 429);
    }
    if (hits('g', 3600) >= GAST_ALL_SUBMITS_PER_HOUR) {
        header('Retry-After: 900');
        fail('Gerade kommen sehr viele Anfragen an. Bitte etwas später noch einmal versuchen.' . $call, 429);
    }
}

function count_submit(): void
{
    hit('s:' . ip_hash());
    hit('g');
}

/** Verstecktes Feld ausgefüllt → Roboter. So tun, als hätte es geklappt, aber nichts speichern. */
function honeypot(): bool
{
    $hp = body()['homepage'] ?? '';
    return !(is_string($hp) && $hp === '');
}

/* ================================================================ Prüfen */

function valid_name(string $name): ?string
{
    $n = str_len($name);
    if ($n < 2) {
        return 'Bitte Ihren Namen eingeben.';
    }
    if ($n > 80) {
        return 'Der Name ist zu lang (höchstens 80 Zeichen).';
    }
    if (preg_match('~https?://|www\.|[<>{}]~i', $name)) {
        return 'Bitte nur Ihren Namen eingeben.';
    }
    return null;
}

function valid_phone(string $phone): ?string
{
    if ($phone === '') {
        return 'Bitte Ihre Telefonnummer eingeben – wir rufen Sie zurück.';
    }
    $digits = (int)preg_match_all('/\d/', $phone);
    if (str_len($phone) > 30 || !preg_match('~^[0-9+()/\-. ]+$~', $phone) || $digits < 6 || $digits > 20) {
        return 'Bitte eine gültige Telefonnummer eingeben (nur Ziffern, Leerzeichen, + / -).';
    }
    return null;
}

function valid_note(string $note, int $max = 500): ?string
{
    if (str_len($note) > $max) {
        return 'Die Nachricht ist zu lang (höchstens ' . $max . ' Zeichen).';
    }
    if (preg_match_all('~https?://~i', $note) > 2) {
        return 'Bitte keine Links in die Nachricht schreiben.';
    }
    return null;
}

function require_consent(): void
{
    if ((body()['consent'] ?? false) !== true) {
        fail('Bitte bestätigen Sie den Hinweis zum Datenschutz (Häkchen setzen).', 400, ['field' => 'consent']);
    }
}

function field_fail(string $field, string $msg): never
{
    fail($msg, 400, ['field' => $field]);
}

function find_event(string $id): ?array
{
    foreach ((content()['events'] ?? []) as $e) {
        if (is_array($e) && ($e['id'] ?? null) === $id) {
            return $e;
        }
    }
    return null;
}

/** Ist die Anmeldung für den Termin offen? → [offen, Grund] */
function signup_open(array $e): array
{
    if (($e['signup'] ?? false) !== true) {
        return [false, 'Für diesen Termin ist keine Anmeldung möglich.'];
    }
    $date = is_string($e['date'] ?? null) ? $e['date'] : '';
    $today = date('Y-m-d');
    if ($date === '' || $date < $today) {
        return [false, 'Dieser Termin ist schon vorbei.'];
    }
    $time = is_string($e['time'] ?? null) && preg_match('/^\d{2}:\d{2}$/', $e['time']) ? $e['time'] : '';
    if ($date === $today && $time !== '' && date('H:i') >= $time) {
        return [false, 'Die Veranstaltung hat schon begonnen.'];
    }
    $dl = is_string($e['signupDeadline'] ?? null) ? $e['signupDeadline'] : '';
    if ($dl !== '' && preg_match('/^\d{4}-\d{2}-\d{2}$/', $dl) && $today > $dl) {
        return [false, 'Die Anmeldefrist ist leider abgelaufen.'];
    }
    return [true, ''];
}

function signup_taken(string $eventId): int
{
    return (int)q('SELECT COALESCE(SUM(persons), 0) FROM signups WHERE event_id = ?', [$eventId])->fetchColumn();
}

/* ================================================================ E-Mail */

/**
 * Hinweis-Mail an den Wirt über PHP mail(). Enthält bewusst KEINE Namen/Telefonnummern (die stehen nur in der
 * Verwaltung). Ob mail() beim Hoster funktioniert, ist unterschiedlich – Fehler werden still ignoriert.
 */
function notify_owner(bool $on, string $address, string $subject, string $text): void
{
    if (!$on || $address === '' || !filter_var($address, FILTER_VALIDATE_EMAIL) || preg_match('/[\r\n,;]/', $address) || !function_exists('mail')) {
        return;
    }
    $site = content()['meta']['siteName'] ?? 'Website';
    $site = is_string($site) ? (string)preg_replace('/[\r\n]+/', ' ', $site) : 'Website';
    $subj = function_exists('mb_encode_mimeheader') ? mb_encode_mimeheader($site . ': ' . $subject, 'UTF-8') : $subject;
    $body = $text . "\n\nName und Telefonnummer stehen aus Datenschutzgründen nur in der Verwaltung (/admin/).\n-- \nAutomatische Nachricht der Website";
    $headers = "MIME-Version: 1.0\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: 8bit\r\nX-Mailer: HBS-Website";
    try {
        @mail($address, $subj, $body, $headers);
    } catch (Throwable) {
        // nicht kritisch
    }
}

function de_date(string $iso): string
{
    $wd = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
    $ts = strtotime($iso . ' 12:00');
    return $ts ? $wd[(int)date('w', $ts)] . ', ' . date('d.m.Y', $ts) : $iso;
}

/* ================================================================ Verwaltung (Sitzung aus cms/api.php) */

function valid_sid(mixed $v): bool
{
    return is_string($v) && preg_match('/^[A-Za-z0-9,\-]{22,256}$/', $v) === 1;
}

function cookie_path(): string
{
    return rtrim(str_replace('\\', '/', dirname((string)($_SERVER['SCRIPT_NAME'] ?? '/cms/gast-api.php'))), '/') . '/';
}

/** Kopie von cms_admin_state() aus cms/tipp-api.php: liest die Sitzung der Verwaltung, ohne sie zu verändern. */
function cms_admin_state(bool $touch = true): array
{
    static $state = null;
    if ($state !== null) {
        return $state;
    }
    $cookie = $_COOKIE[GAST_CMS_SESSION_NAME] ?? null;
    if (!valid_sid($cookie)) {
        return $state = ['auth' => false, 'csrf' => ''];
    }
    if (session_status() === PHP_SESSION_ACTIVE) {
        session_write_close();
    }
    $cfg = [];
    $cfgFile = GAST_CMS_DIR . '/config.php';
    if (is_file($cfgFile)) {
        $c = require $cfgFile;
        $cfg = is_array($c) ? $c : [];
    }
    $idle = max(10, (int)($cfg['session_idle_minutes'] ?? 240)) * 60;
    $dir = GAST_DATA_DIR . '/sessions';
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
    session_name(GAST_CMS_SESSION_NAME);
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
        $_SESSION['last'] = time();
        session_write_close();
    } else {
        session_abort();
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
        check_origin();
        $sent = (string)($_SERVER['HTTP_X_CSRF_TOKEN'] ?? '');
        if ($st['csrf'] === '' || $sent === '' || !hash_equals($st['csrf'], $sent)) {
            fail('Sicherheits-Token ungültig. Bitte Seite neu laden.', 403, ['csrfInvalid' => true]);
        }
    }
}

function res_row(array $r): array
{
    return [
        'id' => (int)$r['id'],
        'created' => $r['created'],
        'date' => $r['day'],
        'time' => $r['time'],
        'persons' => (int)$r['persons'],
        'name' => $r['name'],
        'phone' => $r['phone'],
        'email' => $r['email'],
        'note' => $r['note'],
        'anlass' => $r['anlass'],
        'status' => $r['status'],
        'internalNote' => $r['internal_note'],
        'called' => (bool)$r['called'],
        'updated' => $r['updated'],
    ];
}

function anm_row(array $r): array
{
    return [
        'id' => (int)$r['id'],
        'created' => $r['created'],
        'event' => $r['event_id'],
        'eventTitle' => $r['event_title'],
        'eventDate' => $r['event_date'],
        'name' => $r['name'],
        'phone' => $r['phone'],
        'persons' => (int)$r['persons'],
        'note' => $r['note'],
        'seen' => (bool)$r['seen'],
    ];
}

function counts(): array
{
    return [
        'neu' => (int)q("SELECT COUNT(*) FROM reservations WHERE status = 'neu'")->fetchColumn(),
        'anmNeu' => (int)q('SELECT COUNT(*) FROM signups WHERE seen = 0')->fetchColumn(),
    ];
}

function id_in(): int
{
    $id = body()['id'] ?? null;
    if (!is_int($id) || $id < 1) {
        fail('Ungültige ID.', 400);
    }
    return $id;
}

/* ================================================================ Aktionen */

$action = (string)($_GET['action'] ?? '');

switch ($action) {
    case 'status':
        $f = features();
        respond(['reservierung' => $f['reservierung'], 'anmeldung' => $f['anmeldung']]);

    case 'token':
        header('Cache-Control: no-store');
        respond(['token' => make_token()]);

    case 'plaetze':
        $out = [];
        if (features()['anmeldung']) {
            $today = date('Y-m-d');
            foreach ((content()['events'] ?? []) as $e) {
                if (!is_array($e) || ($e['signup'] ?? false) !== true || !is_string($e['id'] ?? null) || !is_string($e['date'] ?? null) || $e['date'] < $today) {
                    continue;
                }
                $max = is_int($e['signupMax'] ?? null) ? max(0, $e['signupMax']) : 0;
                $taken = signup_taken($e['id']);
                [$open, $reason] = signup_open($e);
                $free = $max > 0 ? max(0, $max - $taken) : null;
                if ($open && $max > 0 && $free === 0) {
                    $open = false;
                    $reason = 'ausgebucht';
                }
                $out[$e['id']] = ['max' => $max, 'taken' => $taken, 'free' => $free, 'open' => $open, 'reason' => $reason];
            }
        }
        respond(['events' => (object)$out]);

    case 'reservieren':
        require_post();
        check_origin();
        if (!features()['reservierung']) {
            fail('Tischanfragen über die Website sind zurzeit ausgeschaltet. Bitte rufen Sie uns an.', 403);
        }
        body();
        rate_limit_check();
        if (honeypot()) {
            respond(['saved' => true]);
        }
        check_token();
        $s = res_settings();
        $name = text_in('name');
        $phone = text_in('phone');
        $email = text_in('email');
        $date = text_in('date');
        $time = text_in('time');
        $persons = int_in('persons');
        $note = text_in('note', true);
        $anlass = text_in('anlass');
        if ($e = valid_name($name)) field_fail('name', $e);
        if ($e = valid_phone($phone)) field_fail('phone', $e);
        if ($email !== '' && (str_len($email) > 150 || !filter_var($email, FILTER_VALIDATE_EMAIL))) {
            field_fail('email', 'Die E-Mail-Adresse ist ungültig. Sie können das Feld auch leer lassen.');
        }
        if (!preg_match('/^(\d{4})-(\d{2})-(\d{2})$/', $date, $m) || !checkdate((int)$m[2], (int)$m[3], (int)$m[1])) {
            field_fail('date', 'Bitte ein Datum wählen.');
        }
        if (!preg_match('/^([01]\d|2[0-3]):[0-5]\d$/', $time)) {
            field_fail('time', 'Bitte eine Uhrzeit wählen.');
        }
        if ($persons === null || $persons < 1) {
            field_fail('persons', 'Bitte die Anzahl der Personen angeben.');
        }
        if ($persons > $s['maxPersons']) {
            $tel = contact_phone();
            field_fail('persons', 'Für mehr als ' . $s['maxPersons'] . ' Personen rufen Sie uns bitte direkt an' . ($tel !== '' ? ': ' . $tel : '') . '.');
        }
        $when = strtotime($date . ' ' . $time);
        if ($when === false || $when < time() + $s['leadHours'] * 3600) {
            field_fail('date', $s['leadHours'] > 0
                ? 'Bitte mindestens ' . $s['leadHours'] . ' Stunde' . ($s['leadHours'] === 1 ? '' : 'n') . ' im Voraus anfragen. Für kurzfristige Plätze einfach anrufen.'
                : 'Dieser Zeitpunkt liegt in der Vergangenheit.');
        }
        if ($date > date('Y-m-d', strtotime('+' . $s['maxDaysAhead'] . ' days'))) {
            field_fail('date', 'Anfragen sind höchstens ' . $s['maxDaysAhead'] . ' Tage im Voraus möglich.');
        }
        if ($s['useOpeningHours'] && ($e = check_opening($date, $time))) {
            field_fail('time', $e);
        }
        if ($e = valid_note($note)) field_fail('note', $e);
        if (str_len($anlass) > 150) field_fail('anlass', 'Der Anlass ist zu lang.');
        require_consent();

        cleanup();
        // Doppelt abgeschickt (z. B. zweimal getippt)? Dann nicht noch einmal speichern.
        $dup = q("SELECT id FROM reservations WHERE phone = ? AND day = ? AND time = ? AND status = 'neu'", [$phone, $date, $time])->fetchColumn();
        if (!$dup) {
            q('INSERT INTO reservations (created, day, time, persons, name, phone, email, note, anlass) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
                [date('Y-m-d H:i:s'), $date, $time, $persons, $name, $phone, $email, $note, $anlass]);
            count_submit();
            notify_owner($s['notifyEmail'], $s['notifyAddress'], 'Neue Tisch-Anfrage',
                'Neue Tisch-Anfrage über die Website: ' . de_date($date) . ', ' . $time . ' Uhr, ' . $persons . ' Person' . ($persons === 1 ? '' : 'en') . '.');
        }
        respond(['saved' => true]);

    case 'anmelden':
        require_post();
        check_origin();
        if (!features()['anmeldung']) {
            fail('Anmeldungen über die Website sind zurzeit ausgeschaltet. Bitte rufen Sie uns an.', 403);
        }
        body();
        rate_limit_check();
        if (honeypot()) {
            respond(['saved' => true]);
        }
        check_token();
        $s = anm_settings();
        $eventId = text_in('event');
        $ev = preg_match('/^[A-Za-z0-9_-]{1,80}$/', $eventId) ? find_event($eventId) : null;
        if ($ev === null) {
            fail('Diese Veranstaltung gibt es nicht mehr. Bitte die Seite neu laden.', 404);
        }
        [$open, $reason] = signup_open($ev);
        if (!$open) {
            fail($reason, 409, ['code' => 'closed']);
        }
        $name = text_in('name');
        $phone = text_in('phone');
        $persons = int_in('persons');
        $note = text_in('note', true);
        if ($e = valid_name($name)) field_fail('name', $e);
        if ($e = valid_phone($phone)) field_fail('phone', $e);
        if ($persons === null || $persons < 1) {
            field_fail('persons', 'Bitte die Anzahl der Personen angeben.');
        }
        if ($persons > $s['maxPersons']) {
            $tel = contact_phone();
            field_fail('persons', 'Für mehr als ' . $s['maxPersons'] . ' Personen rufen Sie uns bitte an' . ($tel !== '' ? ': ' . $tel : '') . '.');
        }
        if ($e = valid_note($note, 300)) field_fail('note', $e);
        require_consent();

        cleanup();
        $max = is_int($ev['signupMax'] ?? null) ? max(0, $ev['signupMax']) : 0;
        $pdo = db();
        $pdo->exec('BEGIN IMMEDIATE'); // Plätze zählen und eintragen ohne Überbuchung
        try {
            $dup = q('SELECT id FROM signups WHERE event_id = ? AND phone = ?', [$eventId, $phone])->fetchColumn();
            if ($dup) {
                $pdo->exec('COMMIT');
                respond(['saved' => true, 'free' => $max > 0 ? max(0, $max - signup_taken($eventId)) : null]);
            }
            $taken = signup_taken($eventId);
            if ($max > 0 && $taken + $persons > $max) {
                $pdo->exec('ROLLBACK');
                $free = max(0, $max - $taken);
                fail($free === 0 ? 'Leider ist die Veranstaltung schon ausgebucht.' : 'Leider sind nur noch ' . $free . ' Plätze frei. Bitte weniger Personen anmelden oder anrufen.', 409, ['code' => $free === 0 ? 'full' : 'few', 'free' => $free]);
            }
            q('INSERT INTO signups (created, event_id, event_title, event_date, name, phone, persons, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [
                date('Y-m-d H:i:s'), $eventId, (string)preg_replace('/^(.{0,150}).*$/us', '$1', is_string($ev['title'] ?? null) ? $ev['title'] : ''), (string)$ev['date'], $name, $phone, $persons, $note,
            ]);
            count_submit();
            $pdo->exec('COMMIT');
        } catch (Throwable $e) {
            if ($pdo->inTransaction()) {
                $pdo->exec('ROLLBACK');
            }
            throw $e;
        }
        notify_owner($s['notifyEmail'], $s['notifyAddress'], 'Neue Anmeldung',
            'Neue Anmeldung über die Website: „' . (string)($ev['title'] ?? '') . '“ am ' . de_date((string)$ev['date']) . ', ' . $persons . ' Person' . ($persons === 1 ? '' : 'en') . '.');
        respond(['saved' => true, 'free' => $max > 0 ? max(0, $max - signup_taken($eventId)) : null]);

    /* ------------------------------------------------------------ Verwaltung */

    case 'admin_overview':
        require_admin();
        cleanup();
        $res = array_map('res_row', q('SELECT * FROM reservations ORDER BY day, time, id')->fetchAll());
        $anm = array_map('anm_row', q('SELECT * FROM signups ORDER BY event_date, event_id, id')->fetchAll());
        respond(['reservierungen' => $res, 'anmeldungen' => $anm, 'counts' => counts(), 'deleteAfterDays' => res_settings()['deleteAfterDays'], 'signupKeepDays' => GAST_SIGNUP_KEEP_DAYS]);

    case 'admin_counts':
        require_admin();
        respond(['counts' => counts()]);

    case 'admin_res_update':
        require_post();
        require_admin();
        $id = id_in();
        $row = q('SELECT * FROM reservations WHERE id = ?', [$id])->fetch();
        if (!$row) {
            fail('Diese Anfrage gibt es nicht mehr.', 404);
        }
        $b = body();
        $status = $row['status'];
        if (array_key_exists('status', $b)) {
            if (!is_string($b['status']) || !in_array($b['status'], GAST_STATUSES, true)) {
                fail('Ungültiger Status.', 400);
            }
            $status = $b['status'];
        }
        $note = $row['internal_note'];
        if (array_key_exists('internalNote', $b)) {
            $note = text_in('internalNote', true);
            if (str_len($note) > 1000) {
                fail('Die Notiz ist zu lang (höchstens 1000 Zeichen).', 400);
            }
        }
        $called = (int)$row['called'];
        if (array_key_exists('called', $b)) {
            if (!is_bool($b['called'])) {
                fail('Ungültiger Wert.', 400);
            }
            $called = $b['called'] ? 1 : 0;
        }
        q('UPDATE reservations SET status = ?, internal_note = ?, called = ?, updated = ? WHERE id = ?', [$status, $note, $called, date('Y-m-d H:i:s'), $id]);
        respond(['reservierung' => res_row(q('SELECT * FROM reservations WHERE id = ?', [$id])->fetch()), 'counts' => counts()]);

    case 'admin_res_delete':
        require_post();
        require_admin();
        q('DELETE FROM reservations WHERE id = ?', [id_in()]);
        respond(['counts' => counts()]);

    case 'admin_anm_delete':
        require_post();
        require_admin();
        q('DELETE FROM signups WHERE id = ?', [id_in()]);
        respond(['counts' => counts()]);

    case 'admin_anm_seen':
        require_post();
        require_admin();
        q('UPDATE signups SET seen = 1 WHERE seen = 0');
        respond(['counts' => counts()]);

    default:
        fail('Unbekannte Aktion.', 400);
}
