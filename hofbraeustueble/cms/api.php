<?php
/*
 * Hofbräustüble – Mini-CMS API
 * PHP 8, keine Abhängigkeiten. Läuft auf üblichem Shared Hosting (IONOS, Strato, all-inkl …).
 *
 * Öffentlich:
 *   GET  api.php?action=get        → Inhalt (content.json)
 *   GET  api.php?action=status     → {ok, api, loggedIn, csrf, mustChangePassword, …}
 *   POST api.php?action=login      → Feld "password" (Formular oder JSON)
 * Nur angemeldet (POST zusätzlich mit Header "X-CSRF-Token"):
 *   POST api.php?action=save       → JSON-Body {"content": {...}} (oder der Inhalt direkt)
 *   POST api.php?action=upload     → multipart, Feld "file" (JPG/PNG/WebP, max. 10 MB)
 *   POST api.php?action=logout
 *   POST api.php?action=password   → Felder "current", "new"
 *   GET  api.php?action=images     → vorhandene Bilder (assets/img + cms/uploads)
 *   GET  api.php?action=backups    → Liste der Sicherungen
 *   GET  api.php?action=backup&name=…  → Inhalt einer Sicherung
 *
 * Die API liefert niemals config.php, Login-Daten oder beliebige Dateien aus.
 */
declare(strict_types=1);

define('HBS_CMS', true);

const HBS_MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const HBS_MAX_SAVE_BYTES   = 3 * 1024 * 1024;
const HBS_MAX_IMAGE_DIM    = 1920;
const HBS_MAX_SOURCE_PIXELS = 50000000; // ~50 Megapixel
const HBS_JPEG_QUALITY     = 82;
const HBS_BACKUP_KEEP      = 20;
const HBS_LOGIN_MAX_FAILS  = 5;      // Fehlversuche …
const HBS_LOGIN_WINDOW     = 900;    // … innerhalb von 15 Minuten
const HBS_LOGIN_LOCK       = 900;    // → 15 Minuten Sperre
const HBS_MIN_PASSWORD_LEN = 10;

define('HBS_CMS_DIR', __DIR__);
define('HBS_ROOT_DIR', dirname(__DIR__));
define('HBS_CONTENT_FILE', HBS_CMS_DIR . '/content.json');
define('HBS_CONFIG_FILE', HBS_CMS_DIR . '/config.php');
define('HBS_BACKUP_DIR', HBS_CMS_DIR . '/backups');
define('HBS_UPLOAD_DIR', HBS_CMS_DIR . '/uploads');
define('HBS_DATA_DIR', HBS_CMS_DIR . '/data');
define('HBS_ATTEMPTS_FILE', HBS_DATA_DIR . '/login-attempts.php');

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
    error_log('[hbs-cms] ' . $e->getMessage() . ' in ' . $e->getFile() . ':' . $e->getLine());
    if (!headers_sent()) {
        http_response_code(500);
        header('Content-Type: application/json; charset=utf-8');
    }
    echo json_encode(['ok' => false, 'error' => 'Interner Serverfehler. Bitte später erneut versuchen.'], JSON_UNESCAPED_UNICODE);
});

/* ------------------------------------------------------------------ Hilfen */

function respond(array $data, int $code = 200): never
{
    http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function fail(string $message, int $code = 400, array $extra = []): never
{
    respond(['ok' => false, 'error' => $message] + $extra, $code);
}

function load_config(): array
{
    $cfg = is_file(HBS_CONFIG_FILE) ? require HBS_CONFIG_FILE : null;
    if (!is_array($cfg) || empty($cfg['password_hash'])) {
        fail('Konfiguration fehlt oder ist beschädigt (cms/config.php).', 500);
    }
    return $cfg;
}

/** Datei atomar schreiben: temporäre Datei im selben Ordner + rename(). */
function atomic_write(string $file, string $data, int $mode = 0644): void
{
    // Ist die Datei ein Symlink (z. B. im Docker-Container auf ein Daten-Volume),
    // ins Ziel schreiben – sonst würde rename() den Link durch eine Datei ersetzen.
    if (is_link($file)) {
        $real = realpath($file);
        if ($real !== false) {
            $file = $real;
        }
    }
    $dir = dirname($file);
    $tmp = @tempnam($dir, '.tmp-');
    if ($tmp === false) {
        throw new RuntimeException('Ordner nicht beschreibbar: ' . $dir);
    }
    try {
        if (@file_put_contents($tmp, $data, LOCK_EX) !== strlen($data)) {
            throw new RuntimeException('Schreiben fehlgeschlagen: ' . $tmp);
        }
        @chmod($tmp, $mode);
        if (!@rename($tmp, $file)) {
            throw new RuntimeException('Umbenennen fehlgeschlagen: ' . $file);
        }
    } finally {
        if (is_file($tmp)) {
            @unlink($tmp);
        }
    }
    if (function_exists('opcache_invalidate')) {
        @opcache_invalidate($file, true);
    }
}

function save_config(array $cfg): void
{
    $php = "<?php\n"
        . "/*\n * Hofbräustüble CMS – Konfiguration (automatisch geschrieben am " . date('Y-m-d H:i') . ")\n"
        . " * Das Passwort wird NUR als Hash gespeichert. Ändern im Admin unter \"Einstellungen\".\n"
        . " * Passwort vergessen? Diese Datei durch die Originaldatei aus dem Download-Paket ersetzen\n"
        . " * – dann gilt wieder das Start-Passwort (siehe README.md).\n */\n"
        . "if (!defined('HBS_CMS')) {\n    http_response_code(403);\n    exit;\n}\n\n"
        . 'return ' . var_export($cfg, true) . ";\n";
    atomic_write(HBS_CONFIG_FILE, $php, 0640);
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

function request_body_json(): array
{
    $len = (int)($_SERVER['CONTENT_LENGTH'] ?? 0);
    if ($len > HBS_MAX_SAVE_BYTES) {
        fail('Die Daten sind zu groß.', 413);
    }
    $raw = file_get_contents('php://input');
    if ($raw === false || $raw === '') {
        return [];
    }
    if (strlen($raw) > HBS_MAX_SAVE_BYTES) {
        fail('Die Daten sind zu groß.', 413);
    }
    $data = json_decode($raw, true, 64);
    if (!is_array($data)) {
        fail('Ungültiges JSON: ' . json_last_error_msg(), 400);
    }
    return $data;
}

/** Parameter aus Formular, JSON-Body oder (nur für GET) Query-String */
function param(string $name): string
{
    static $json = null;
    if (isset($_POST[$name]) && is_string($_POST[$name])) {
        return $_POST[$name];
    }
    if ($json === null) {
        $ct = strtolower((string)($_SERVER['CONTENT_TYPE'] ?? ''));
        $json = ($_SERVER['REQUEST_METHOD'] === 'POST' && str_contains($ct, 'application/json')) ? request_body_json() : [];
    }
    return (isset($json[$name]) && is_string($json[$name])) ? $json[$name] : '';
}

/* ---------------------------------------------------------------- Session */

function session_boot(array $cfg): void
{
    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }
    $idle = max(10, (int)($cfg['session_idle_minutes'] ?? 240)) * 60;
    $dir = HBS_DATA_DIR . '/sessions';
    if (ensure_dir($dir) && is_writable($dir)) {
        // Eigener Ordner: Sitzungen werden nicht von fremden Skripten nach 24 Min. gelöscht
        session_save_path($dir);
        ini_set('session.gc_maxlifetime', (string)$idle);
        ini_set('session.gc_probability', '1');
        ini_set('session.gc_divisor', '50');
    }
    ini_set('session.use_strict_mode', '1');
    ini_set('session.use_only_cookies', '1');
    ini_set('session.use_trans_sid', '0');
    ini_set('session.cookie_httponly', '1');
    $path = rtrim(str_replace('\\', '/', dirname((string)($_SERVER['SCRIPT_NAME'] ?? '/cms/api.php'))), '/') . '/';
    session_name('HBSCMS');
    session_set_cookie_params([
        'lifetime' => 0,
        'path'     => $path,
        'secure'   => is_https(),
        'httponly' => true,
        'samesite' => 'Strict',
    ]);
    session_start();

    if (!empty($_SESSION['auth'])) {
        $last = (int)($_SESSION['last'] ?? 0);
        if (time() - $last > $idle) {
            $_SESSION = [];
            session_regenerate_id(true);
        } else {
            $_SESSION['last'] = time();
        }
    }
}

function logged_in(): bool
{
    return !empty($_SESSION['auth']) && $_SESSION['auth'] === true;
}

function require_auth(bool $csrf): void
{
    if (!logged_in()) {
        fail('Nicht angemeldet oder Sitzung abgelaufen. Bitte erneut anmelden.', 401, ['loggedIn' => false]);
    }
    if ($csrf) {
        $sent = (string)($_SERVER['HTTP_X_CSRF_TOKEN'] ?? '');
        $tok = (string)($_SESSION['csrf'] ?? '');
        if ($tok === '' || $sent === '' || !hash_equals($tok, $sent)) {
            fail('Sicherheits-Token ungültig. Bitte Seite neu laden und erneut anmelden.', 403, ['csrfInvalid' => true]);
        }
    }
}

function require_post(): void
{
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        header('Allow: POST');
        fail('Nur POST erlaubt.', 405);
    }
}

/* --------------------------------------------------- Brute-Force-Schutz */

function client_key(): string
{
    // Nur ein Hash der IP wird gespeichert (Datensparsamkeit)
    return substr(hash('sha256', 'hbs|' . (string)($_SERVER['REMOTE_ADDR'] ?? 'unknown')), 0, 32);
}

/** Login-Versuchsdatei gesperrt öffnen, Callback darf die Daten ändern. */
function with_attempts(callable $fn): mixed
{
    ensure_dir(HBS_DATA_DIR);
    $fh = @fopen(HBS_ATTEMPTS_FILE, 'c+');
    if (!$fh) {
        // Ohne beschreibbaren Ordner: trotzdem arbeiten, aber ohne Zähler
        $dummy = [];
        return $fn($dummy);
    }
    try {
        flock($fh, LOCK_EX);
        $raw = stream_get_contents($fh);
        $json = preg_replace('/^<\?php exit; \?>\s*/', '', (string)$raw);
        $data = json_decode((string)$json, true);
        if (!is_array($data)) {
            $data = [];
        }
        $now = time();
        foreach ($data as $k => $e) { // alte Einträge aufräumen
            if (!is_array($e) || ($now - (int)($e['last'] ?? 0)) > 86400) {
                unset($data[$k]);
            }
        }
        $result = $fn($data);
        ftruncate($fh, 0);
        rewind($fh);
        fwrite($fh, "<?php exit; ?>\n" . json_encode($data));
        fflush($fh);
        flock($fh, LOCK_UN);
        return $result;
    } finally {
        fclose($fh);
    }
}

/* ------------------------------------------------------------- Validierung */

final class Validator
{
    public array $errors = [];
    private array $seenIds = [];

    private const IMAGE_RE = '~^(assets/img|cms/uploads)/[A-Za-z0-9][A-Za-z0-9._-]{0,150}\.(jpe?g|png|webp|gif|svg|avif)$~i';

    /**
     * Schema: Typen
     *  ['str', max, format?]  format: line|text|date|date-opt|time|email|url|image|id|req|price
     *  ['bool']
     *  ['int', min, max]
     *  ['obj', [feld => schema]]
     *  ['list', itemSchema, maxItems]
     */
    public static function schema(): array
    {
        $line = fn(int $max, string $fmt = 'line') => ['str', $max, $fmt];
        $text = fn(int $max) => ['str', $max, 'text'];
        return [
            'meta' => ['obj', [
                'siteName' => $line(120),
                'tagline' => $line(200),
                'seoDescription' => $text(400),
                'lastUpdated' => $line(40),
            ]],
            'banner' => ['obj', [
                'enabled' => ['bool'],
                'text' => $text(400),
            ]],
            'hero' => ['obj', [
                'title' => $line(120),
                'subtitle' => $text(400),
                'image' => $line(200, 'image'),
                'ctaText' => $line(60),
            ]],
            'about' => ['obj', [
                'title' => $line(150),
                'text' => $text(5000),
                'highlights' => ['list', ['obj', [
                    'icon' => $line(40),
                    'title' => $line(100),
                    'text' => $text(300),
                ]], 8],
            ]],
            'openingHours' => ['list', ['obj', [
                'day' => $line(40),
                'hours' => $line(80),
            ]], 14],
            'hoursNote' => $text(500),
            'summer' => ['obj', [
                'enabled' => ['bool'],
                'title' => $line(150),
                'text' => $text(5000),
                'image' => $line(200, 'image'),
                'season' => $line(200),
            ]],
            'events' => ['list', ['obj', [
                'id' => $line(80, 'id'),
                'date' => $line(10, 'date'),
                'time' => $line(5, 'time'),
                'title' => $line(150, 'req'),
                'description' => $text(5000),
                'category' => $line(60),
                'image' => $line(200, 'image'),
                // Anmeldung zum Termin (optional, siehe gast-api.php)
                'signup' => ['bool'],
                'signupMax' => ['int', 0, 10000],
                'signupDeadline' => $line(10, 'date-opt'),
                'signupNote' => $text(500),
            ]], 500],
            'tippspiel' => ['obj', [
                'enabled' => ['bool'],
                'title' => $line(150),
                'text' => $text(2000),
                'buttonText' => $line(60),
                'note' => $text(500),
            ]],
            'gallery' => ['list', ['obj', [
                'src' => $line(200, 'image-req'),
                'caption' => $line(250),
            ]], 300],
            'contact' => ['obj', [
                'street' => $line(150),
                'zip' => $line(10),
                'city' => $line(100),
                'district' => $line(100),
                'phone' => $line(60),
                'email' => $line(150, 'email'),
                'mapsUrl' => $line(1000, 'url'),
                'note' => $text(1000),
            ]],
            'social' => ['obj', [
                'facebook' => $line(500, 'url'),
                'instagram' => $line(500, 'url'),
            ]],
            'impressum' => ['obj', [
                'owner' => $line(200),
                'businessName' => $line(200),
                'street' => $line(200),
                'zipCity' => $line(200),
                'phone' => $line(60),
                'email' => $line(150, 'email'),
                'vatId' => $line(40),
                'responsible' => $text(500),
                'extraText' => $text(10000),
            ]],
            'datenschutz' => ['obj', [
                'text' => $text(50000),
            ]],
            /* ---- Zusatzfunktionen (optional, siehe self::OPTIONAL) ---- */
            'features' => ['obj', [
                'tippspiel' => ['bool'],
                'team' => ['bool'],
                'reservierung' => ['bool'],
                'speisekarte' => ['bool'],
                'anmeldung' => ['bool'],
                'programm' => ['bool'],
                'preise' => ['bool'],
                'kasse' => ['bool'],
            ]],
            'speisekarte' => ['obj', [
                'title' => $line(150),
                'intro' => $text(1000),
                'note' => $text(1000),
                'categories' => ['list', ['obj', [
                    'name' => $line(80, 'req'),
                    'note' => $text(300),
                    'items' => ['list', ['obj', [
                        'name' => $line(120, 'req'),
                        'size' => $line(30),
                        'price' => $line(12, 'price'),
                        'note' => $line(200),
                        'badge' => $line(30),
                        'available' => ['bool'],
                    ]], 150],
                ]], 40],
            ]],
            'reservierung' => ['obj', [
                'title' => $line(150),
                'text' => $text(2000),
                'maxPersons' => ['int', 1, 200],
                'leadHours' => ['int', 0, 336],
                'maxDaysAhead' => ['int', 1, 365],
                'useOpeningHours' => ['bool'],
                'deleteAfterDays' => ['int', 1, 365],
                'successText' => $text(1000),
                'privacyText' => $text(2000),
                'consentText' => $text(500),
                'notifyEmail' => ['bool'],
                'notifyAddress' => $line(150, 'email'),
            ]],
            'anmeldung' => ['obj', [
                'maxPersons' => ['int', 1, 50],
                'successText' => $text(1000),
                'privacyText' => $text(2000),
                'consentText' => $text(500),
                'notifyEmail' => ['bool'],
                'notifyAddress' => $line(150, 'email'),
            ]],
            'programm' => ['obj', [
                'title' => $line(150),
                'text' => $text(1000),
                'competitions' => ['list', ['int', 1, 1000000000], 50],
                'days' => ['int', 1, 14],
            ]],
        ];
    }

    /** Bereiche, die fehlen dürfen (ältere Inhalte, Sicherungen, JSON-Import) – die Website nimmt dann Standardwerte. */
    private const OPTIONAL = ['features', 'speisekarte', 'reservierung', 'anmeldung', 'programm'];

    public function validate(mixed $content): array
    {
        if (!is_array($content) || ($content !== [] && array_is_list($content))) {
            $this->errors[] = 'Der Inhalt muss ein JSON-Objekt sein.';
            return [];
        }
        $schema = self::schema();
        $out = [];
        foreach ($content as $key => $_) {
            if (!array_key_exists((string)$key, $schema)) {
                $this->errors[] = 'Unbekannter Bereich „' . self::short((string)$key) . '“.';
            }
        }
        foreach ($schema as $key => $node) {
            if (!array_key_exists($key, $content)) {
                if (in_array($key, self::OPTIONAL, true)) {
                    continue;
                }
                $this->errors[] = 'Bereich „' . $key . '“ fehlt.';
                continue;
            }
            $out[$key] = $this->node($content[$key], $node, $key);
        }
        return $out;
    }

    private function node(mixed $v, array $node, string $path): mixed
    {
        switch ($node[0]) {
            case 'bool':
                if (!is_bool($v)) {
                    $this->errors[] = "$path: muss true oder false sein.";
                    return false;
                }
                return $v;

            case 'str':
                return $this->str($v, $node[1], $node[2] ?? 'line', $path);

            case 'int': // ['int', min, max] – ganze Zahl (auch "12" als Text wird akzeptiert)
                if (is_string($v) && preg_match('/^-?\d{1,10}$/', trim($v))) {
                    $v = (int)trim($v);
                } elseif (is_float($v) && floor($v) === $v) {
                    $v = (int)$v;
                }
                if (!is_int($v)) {
                    $this->errors[] = "$path: muss eine ganze Zahl sein.";
                    return $node[1];
                }
                if ($v < $node[1] || $v > $node[2]) {
                    $this->errors[] = "$path: muss zwischen {$node[1]} und {$node[2]} liegen.";
                }
                return $v;

            case 'obj':
                if (!is_array($v) || ($v !== [] && array_is_list($v))) {
                    $this->errors[] = "$path: muss ein Objekt sein.";
                    return [];
                }
                $out = [];
                foreach ($node[1] as $k => $child) {
                    if (!array_key_exists($k, $v)) {
                        // fehlende Felder freundlich ergänzen
                        $out[$k] = $child[0] === 'bool' ? false : ($child[0] === 'int' ? $child[1] : ($child[0] === 'list' ? [] : ($child[0] === 'obj' ? $this->node([], $child, "$path.$k") : '')));
                        if ($child[0] === 'str' && in_array($child[2] ?? '', ['req', 'date', 'id', 'image-req'], true)) {
                            $this->errors[] = "$path.$k: fehlt.";
                        }
                        continue;
                    }
                    $out[$k] = $this->node($v[$k], $child, "$path.$k");
                }
                // Unbekannte Zusatzfelder (vorwärtskompatibel): nur einfache Werte
                foreach ($v as $k => $extra) {
                    $k = (string)$k;
                    if (array_key_exists($k, $node[1])) {
                        continue;
                    }
                    if (!preg_match('/^[A-Za-z][A-Za-z0-9_]{0,39}$/', $k)) {
                        $this->errors[] = "$path: ungültiger Feldname „" . self::short($k) . '“.';
                    } elseif (is_bool($extra) || is_int($extra) || is_float($extra) || $extra === null) {
                        $out[$k] = $extra;
                    } elseif (is_string($extra)) {
                        $out[$k] = $this->str($extra, 2000, 'text', "$path.$k");
                    } else {
                        $this->errors[] = "$path.$k: unbekanntes Feld mit verschachteltem Inhalt.";
                    }
                }
                return $out;

            case 'list':
                if (!is_array($v) || !array_is_list($v)) {
                    $this->errors[] = "$path: muss eine Liste sein.";
                    return [];
                }
                if (count($v) > $node[2]) {
                    $this->errors[] = "$path: höchstens {$node[2]} Einträge erlaubt.";
                    $v = array_slice($v, 0, $node[2]);
                }
                $out = [];
                foreach ($v as $i => $item) {
                    $out[] = $this->node($item, $node[1], $path . '[' . ($i + 1) . ']');
                }
                if ($path === 'events') {
                    foreach ($out as $i => $ev) {
                        $id = $ev['id'] ?? '';
                        if ($id !== '' && isset($this->seenIds[$id])) {
                            $this->errors[] = 'events[' . ($i + 1) . '].id: doppelte ID „' . $id . '“.';
                        }
                        $this->seenIds[$id] = true;
                    }
                }
                return $out;
        }
        throw new LogicException('Unbekannter Schema-Typ');
    }

    private function str(mixed $v, int $max, string $fmt, string $path): string
    {
        if (is_int($v) || is_float($v)) {
            $v = (string)$v;
        }
        if (!is_string($v)) {
            $this->errors[] = "$path: muss Text sein.";
            return '';
        }
        // Zeilenumbrüche vereinheitlichen, Steuerzeichen entfernen
        $v = str_replace(["\r\n", "\r"], "\n", $v);
        $v = (string)preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', $v);
        if ($fmt !== 'text') {
            $v = str_replace(["\n", "\t"], ' ', $v);
        }
        $len = preg_match_all('/./us', $v);
        if ($len > $max) {
            $this->errors[] = "$path: zu lang (höchstens $max Zeichen, aktuell $len).";
        }
        $t = trim($v);
        switch ($fmt) {
            case 'req':
                if ($t === '') {
                    $this->errors[] = "$path: darf nicht leer sein.";
                }
                break;
            case 'id':
                if (!preg_match('/^[A-Za-z0-9_-]{1,80}$/', $v)) {
                    $this->errors[] = "$path: ungültige ID (nur Buchstaben, Ziffern, - und _).";
                }
                break;
            case 'date':
                if (!preg_match('/^(\d{4})-(\d{2})-(\d{2})$/', $v, $m) || !checkdate((int)$m[2], (int)$m[3], (int)$m[1])) {
                    $this->errors[] = "$path: ungültiges Datum „" . self::short($v) . '“ (Format JJJJ-MM-TT).';
                }
                break;
            case 'date-opt':
                if ($v !== '' && (!preg_match('/^(\d{4})-(\d{2})-(\d{2})$/', $v, $m) || !checkdate((int)$m[2], (int)$m[3], (int)$m[1]))) {
                    $this->errors[] = "$path: ungültiges Datum „" . self::short($v) . '“ (Format JJJJ-MM-TT oder leer).';
                }
                break;
            case 'price':
                $v = str_replace('.', ',', $t);
                if ($v !== '' && !preg_match('/^\d{1,4}(,\d{1,2})?$/', $v)) {
                    $this->errors[] = "$path: ungültiger Preis „" . self::short($t) . '“ (z. B. 3,90 – ohne €-Zeichen).';
                }
                break;
            case 'time':
                if ($v !== '' && !preg_match('/^([01]\d|2[0-3]):[0-5]\d$/', $v)) {
                    $this->errors[] = "$path: ungültige Uhrzeit „" . self::short($v) . '“ (Format HH:MM).';
                }
                break;
            case 'email':
                if ($t !== '' && !filter_var($t, FILTER_VALIDATE_EMAIL)) {
                    $this->errors[] = "$path: ungültige E-Mail-Adresse.";
                }
                $v = $t;
                break;
            case 'url':
                if ($t !== '' && !preg_match('~^https?://[^\s<>"\'`]+$~i', $t)) {
                    $this->errors[] = "$path: ungültiger Link (muss mit https:// beginnen).";
                }
                $v = $t;
                break;
            case 'image':
            case 'image-req':
                if ($t === '') {
                    if ($fmt === 'image-req') {
                        $this->errors[] = "$path: Bild fehlt.";
                    }
                    break;
                }
                if (str_starts_with($t, 'data:')) {
                    $this->errors[] = "$path: Bild ist noch nicht hochgeladen (Demo-Bild). Bitte Bild neu hochladen.";
                } elseif (!preg_match(self::IMAGE_RE, $t) || str_contains($t, '..')) {
                    $this->errors[] = "$path: ungültiger Bildpfad „" . self::short($t) . '“.';
                } elseif (!is_file(HBS_ROOT_DIR . '/' . $t)) {
                    $this->errors[] = "$path: Bild „" . self::short($t) . '“ nicht gefunden.';
                }
                $v = $t;
                break;
        }
        return $v;
    }

    private static function short(string $s): string
    {
        $s = (string)preg_replace('/[^\P{C}]/u', '', $s);
        return strlen($s) > 60 ? substr($s, 0, 57) . '…' : $s;
    }
}

/* --------------------------------------------------------------- Backups */

function list_backups(): array
{
    $files = glob(HBS_BACKUP_DIR . '/content-*.json') ?: [];
    rsort($files, SORT_STRING); // neueste zuerst (Zeitstempel im Namen)
    return $files;
}

function make_backup(): ?string
{
    if (!is_file(HBS_CONTENT_FILE) || !ensure_dir(HBS_BACKUP_DIR)) {
        return null;
    }
    $name = 'content-' . date('Ymd-His') . '-' . bin2hex(random_bytes(4)) . '.json';
    if (!@copy(HBS_CONTENT_FILE, HBS_BACKUP_DIR . '/' . $name)) {
        throw new RuntimeException('Sicherung konnte nicht angelegt werden (Schreibrechte cms/backups?).');
    }
    @chmod(HBS_BACKUP_DIR . '/' . $name, 0640);
    foreach (array_slice(list_backups(), HBS_BACKUP_KEEP) as $old) {
        @unlink($old);
    }
    return $name;
}

/* -------------------------------------------------------------- Bilder */

function sniff_mime(string $file): string
{
    if (class_exists('finfo')) {
        $fi = new finfo(FILEINFO_MIME_TYPE);
        $m = $fi->file($file);
        if (is_string($m)) {
            return strtolower($m);
        }
    }
    // Fallback ohne fileinfo: Magic Bytes
    $head = (string)@file_get_contents($file, false, null, 0, 16);
    if (str_starts_with($head, "\xFF\xD8\xFF")) return 'image/jpeg';
    if (str_starts_with($head, "\x89PNG\r\n\x1A\n")) return 'image/png';
    if (str_starts_with($head, 'RIFF') && substr($head, 8, 4) === 'WEBP') return 'image/webp';
    return 'application/octet-stream';
}

/** EXIF-Orientation (1–8) aus JPEG lesen – mit exif-Erweiterung oder minimalem Parser. */
function jpeg_orientation(string $file): int
{
    if (function_exists('exif_read_data')) {
        $exif = @exif_read_data($file, 'IFD0');
        if (is_array($exif) && isset($exif['Orientation'])) {
            return (int)$exif['Orientation'];
        }
        return 1;
    }
    $data = (string)@file_get_contents($file, false, null, 0, 131072);
    $pos = 2;
    $len = strlen($data);
    while ($pos + 4 < $len && $data[$pos] === "\xFF") {
        $marker = ord($data[$pos + 1]);
        $size = unpack('n', substr($data, $pos + 2, 2))[1];
        if ($marker === 0xE1 && substr($data, $pos + 4, 6) === "Exif\0\0") {
            $tiff = $pos + 10;
            $le = substr($data, $tiff, 2) === 'II';
            $u16 = fn(int $o) => unpack($le ? 'v' : 'n', substr($data, $o, 2))[1] ?? 0;
            $u32 = fn(int $o) => unpack($le ? 'V' : 'N', substr($data, $o, 4))[1] ?? 0;
            $ifd = $tiff + $u32($tiff + 4);
            $n = $u16($ifd);
            for ($i = 0; $i < $n && $ifd + 2 + ($i + 1) * 12 <= $len; $i++) {
                $e = $ifd + 2 + $i * 12;
                if ($u16($e) === 0x0112) {
                    $o = $u16($e + 8);
                    return ($o >= 1 && $o <= 8) ? $o : 1;
                }
            }
            return 1;
        }
        if ($marker === 0xDA) {
            break;
        }
        $pos += 2 + $size;
    }
    return 1;
}

function gd_orient(GdImage $img, int $o): GdImage
{
    switch ($o) {
        case 2: imageflip($img, IMG_FLIP_HORIZONTAL); break;
        case 3: $img = imagerotate($img, 180, 0); break;
        case 4: imageflip($img, IMG_FLIP_VERTICAL); break;
        case 5: $img = imagerotate($img, -90, 0); imageflip($img, IMG_FLIP_HORIZONTAL); break;
        case 6: $img = imagerotate($img, -90, 0); break;
        case 7: $img = imagerotate($img, -90, 0); imageflip($img, IMG_FLIP_VERTICAL); break;
        case 8: $img = imagerotate($img, 90, 0); break;
    }
    return $img;
}

function memory_limit_bytes(): int
{
    $v = trim((string)ini_get('memory_limit'));
    if ($v === '' || $v === '-1') {
        return PHP_INT_MAX;
    }
    $n = (int)$v;
    return match (strtolower(substr($v, -1))) {
        'g' => $n * 1024 ** 3,
        'm' => $n * 1024 ** 2,
        'k' => $n * 1024,
        default => $n,
    };
}

/**
 * Bild mit GD neu kodieren (entfernt EXIF/GPS & versteckte Inhalte) und
 * auf max. 1920 px verkleinern. Gibt [Endung, Breite, Höhe] zurück oder null,
 * wenn GD nicht verfügbar ist bzw. der Speicher nicht reicht.
 */
function reencode_image(string $src, string $mime, int $w, int $h, string $targetBase): ?array
{
    $loader = ['image/jpeg' => 'imagecreatefromjpeg', 'image/png' => 'imagecreatefrompng', 'image/webp' => 'imagecreatefromwebp'][$mime] ?? null;
    if (!$loader || !function_exists($loader) || !function_exists('imagecreatetruecolor') || !function_exists('imagejpeg')) {
        return null;
    }
    $need = (int)($w * $h * 5 * 1.8) + 32 * 1024 * 1024;
    if (memory_limit_bytes() < $need) {
        @ini_set('memory_limit', (string)max(256, (int)ceil($need / 1048576)) . 'M');
        if (memory_limit_bytes() < $need) {
            return null;
        }
    }
    $img = @$loader($src);
    if (!$img instanceof GdImage) {
        return null;
    }
    if ($mime === 'image/jpeg') {
        $img = gd_orient($img, jpeg_orientation($src));
    }
    $sw = imagesx($img);
    $sh = imagesy($img);
    $scale = min(1, HBS_MAX_IMAGE_DIM / max($sw, $sh));
    $dw = max(1, (int)round($sw * $scale));
    $dh = max(1, (int)round($sh * $scale));
    $keepPng = $mime === 'image/png'; // PNG bleibt PNG (Transparenz, z. B. Logos)

    $dst = imagecreatetruecolor($dw, $dh);
    if ($keepPng) {
        imagealphablending($dst, false);
        imagesavealpha($dst, true);
        imagefill($dst, 0, 0, imagecolorallocatealpha($dst, 0, 0, 0, 127));
    } else {
        imagefill($dst, 0, 0, imagecolorallocate($dst, 255, 255, 255));
        imagealphablending($dst, true);
    }
    imagecopyresampled($dst, $img, 0, 0, 0, 0, $dw, $dh, $sw, $sh);
    imagedestroy($img);

    $ext = $keepPng ? 'png' : 'jpg';
    $tmp = $targetBase . '.tmp';
    if (!$keepPng) {
        imageinterlace($dst, true); // progressives JPEG
    }
    $ok = $keepPng ? imagepng($dst, $tmp, 6) : imagejpeg($dst, $tmp, HBS_JPEG_QUALITY);
    imagedestroy($dst);
    if (!$ok || !@rename($tmp, $targetBase . '.' . $ext)) {
        @unlink($tmp);
        throw new RuntimeException('Bild konnte nicht gespeichert werden (Schreibrechte cms/uploads?).');
    }
    return [$ext, $dw, $dh];
}

function upload_error_text(int $code): string
{
    return match ($code) {
        UPLOAD_ERR_INI_SIZE, UPLOAD_ERR_FORM_SIZE => 'Die Datei ist zu groß für den Server (max. ' . max_upload_mb() . ' MB).',
        UPLOAD_ERR_PARTIAL => 'Die Datei wurde nur teilweise übertragen. Bitte erneut versuchen.',
        UPLOAD_ERR_NO_FILE => 'Keine Datei ausgewählt.',
        UPLOAD_ERR_NO_TMP_DIR, UPLOAD_ERR_CANT_WRITE, UPLOAD_ERR_EXTENSION => 'Der Server konnte die Datei nicht speichern.',
        default => 'Unbekannter Fehler beim Hochladen.',
    };
}

function ini_bytes(string $key): int
{
    $v = trim((string)ini_get($key));
    $n = (int)$v;
    return match (strtolower(substr($v, -1))) {
        'g' => $n * 1024 ** 3, 'm' => $n * 1024 ** 2, 'k' => $n * 1024, default => $n,
    };
}

function max_upload_bytes(): int
{
    $limits = [HBS_MAX_UPLOAD_BYTES];
    foreach (['upload_max_filesize', 'post_max_size'] as $k) {
        $b = ini_bytes($k);
        if ($b > 0) {
            $limits[] = $b;
        }
    }
    return min($limits);
}

function max_upload_mb(): string
{
    return rtrim(rtrim(number_format(max_upload_bytes() / 1048576, 1, '.', ''), '0'), '.');
}

/* ================================================================ Router */

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$action = (string)($_GET['action'] ?? ($_POST['action'] ?? ''));

// Öffentliche Leseaktion ohne Session
if ($action === 'get') {
    if (!is_file(HBS_CONTENT_FILE)) {
        fail('Inhaltsdatei fehlt.', 404);
    }
    http_response_code(200);
    readfile(HBS_CONTENT_FILE);
    exit;
}

$cfg = load_config();

// Upload größer als post_max_size: PHP verwirft dann $_POST/$_FILES komplett
if ($method === 'POST' && empty($_POST) && empty($_FILES) && (int)($_SERVER['CONTENT_LENGTH'] ?? 0) > ini_bytes('post_max_size') && ini_bytes('post_max_size') > 0) {
    fail('Die Datei ist zu groß für den Server (max. ' . max_upload_mb() . ' MB).', 413);
}

session_boot($cfg);

switch ($action) {

    case 'status':
        respond([
            'ok' => true,
            'api' => 'hbs-cms',
            'loggedIn' => logged_in(),
            'csrf' => logged_in() ? ($_SESSION['csrf'] ?? null) : null,
            'mustChangePassword' => logged_in() && !empty($cfg['initial_password']),
            'maxUploadBytes' => max_upload_bytes(),
            'gd' => function_exists('imagecreatetruecolor'),
        ]);

    case 'login':
        require_post();
        $key = client_key();
        $now = time();
        $lock = with_attempts(function (array &$d) use ($key, $now) {
            return (int)($d[$key]['lockedUntil'] ?? 0) > $now ? (int)$d[$key]['lockedUntil'] - $now : 0;
        });
        if ($lock > 0) {
            header('Retry-After: ' . $lock);
            fail('Zu viele Fehlversuche. Bitte in ' . (int)ceil($lock / 60) . ' Minute(n) erneut versuchen.', 429, ['retryAfter' => $lock]);
        }
        $pw = param('password');
        if ($pw === '') {
            fail('Bitte das Passwort eingeben.', 400);
        }
        if (strlen($pw) > 200 || !password_verify($pw, (string)$cfg['password_hash'])) {
            $info = with_attempts(function (array &$d) use ($key, $now) {
                $e = $d[$key] ?? ['count' => 0, 'first' => $now];
                if ($now - (int)$e['first'] > HBS_LOGIN_WINDOW) {
                    $e = ['count' => 0, 'first' => $now];
                }
                $e['count'] = (int)$e['count'] + 1;
                $e['last'] = $now;
                if ($e['count'] >= HBS_LOGIN_MAX_FAILS) {
                    $e['lockedUntil'] = $now + HBS_LOGIN_LOCK;
                    $e['count'] = 0;
                    $e['first'] = $now;
                }
                $d[$key] = $e;
                return $e;
            });
            // Bremse gegen automatisiertes Raten (wächst mit der Zahl der Versuche)
            usleep(random_int(400000, 800000) + min(3, (int)$info['count']) * 400000);
            if (!empty($info['lockedUntil']) && $info['lockedUntil'] > $now) {
                header('Retry-After: ' . HBS_LOGIN_LOCK);
                fail('Zu viele Fehlversuche. Der Login ist für ' . (HBS_LOGIN_LOCK / 60) . ' Minuten gesperrt.', 429, ['retryAfter' => HBS_LOGIN_LOCK]);
            }
            fail('Falsches Passwort.', 401, ['attemptsLeft' => HBS_LOGIN_MAX_FAILS - (int)$info['count']]);
        }
        with_attempts(function (array &$d) use ($key) {
            unset($d[$key]);
        });
        if (password_needs_rehash((string)$cfg['password_hash'], PASSWORD_DEFAULT)) {
            $cfg['password_hash'] = password_hash($pw, PASSWORD_DEFAULT);
            try { save_config($cfg); } catch (Throwable) { /* nicht kritisch */ }
        }
        session_regenerate_id(true);
        $_SESSION = [
            'auth' => true,
            'csrf' => bin2hex(random_bytes(32)),
            'since' => time(),
            'last' => time(),
        ];
        respond([
            'ok' => true,
            'loggedIn' => true,
            'csrf' => $_SESSION['csrf'],
            'mustChangePassword' => !empty($cfg['initial_password']),
        ]);

    case 'logout':
        require_post();
        if (logged_in()) {
            require_auth(true);
        }
        $_SESSION = [];
        $p = session_get_cookie_params();
        setcookie(session_name(), '', ['expires' => time() - 3600, 'path' => $p['path'], 'secure' => $p['secure'], 'httponly' => true, 'samesite' => 'Strict']);
        session_destroy();
        respond(['ok' => true, 'loggedIn' => false]);

    case 'save':
        require_post();
        require_auth(true);
        $body = request_body_json();
        $content = (isset($body['content']) && is_array($body['content'])) ? $body['content'] : $body;
        $v = new Validator();
        $clean = $v->validate($content);
        if ($v->errors) {
            fail('Die Inhalte enthalten Fehler und wurden NICHT gespeichert: ' . $v->errors[0], 422, ['errors' => array_slice($v->errors, 0, 50)]);
        }
        $clean['meta']['lastUpdated'] = date('Y-m-d');
        $json = json_encode($clean, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . "\n";
        $json = (string)preg_replace_callback('/^( +)/m', fn($m) => str_repeat(' ', (int)(strlen($m[1]) / 2)), $json); // 2 statt 4 Leerzeichen
        $backup = make_backup();
        atomic_write(HBS_CONTENT_FILE, $json);
        respond(['ok' => true, 'lastUpdated' => $clean['meta']['lastUpdated'], 'backup' => $backup, 'content' => $clean]);

    case 'upload':
        require_post();
        require_auth(true);
        $f = $_FILES['file'] ?? null;
        if (!is_array($f) || is_array($f['name'] ?? null)) {
            fail('Keine Datei empfangen (Feld "file").', 400);
        }
        if ((int)$f['error'] !== UPLOAD_ERR_OK) {
            fail(upload_error_text((int)$f['error']), (int)$f['error'] === UPLOAD_ERR_INI_SIZE ? 413 : 400);
        }
        $tmp = (string)$f['tmp_name'];
        if (!is_uploaded_file($tmp)) {
            fail('Ungültiger Upload.', 400);
        }
        $size = (int)filesize($tmp);
        if ($size <= 0 || $size > HBS_MAX_UPLOAD_BYTES) {
            fail('Die Datei ist zu groß (max. 10 MB).', 413);
        }
        $mime = sniff_mime($tmp);
        $types = ['image/jpeg' => [IMAGETYPE_JPEG, 'jpg'], 'image/png' => [IMAGETYPE_PNG, 'png'], 'image/webp' => [IMAGETYPE_WEBP, 'webp']];
        if (!isset($types[$mime])) {
            fail('Nur Bilder im Format JPG, PNG oder WebP sind erlaubt.', 415);
        }
        $info = @getimagesize($tmp);
        if (!is_array($info) || (int)$info[2] !== $types[$mime][0] || (int)$info[0] < 1 || (int)$info[1] < 1) {
            fail('Die Datei ist kein gültiges Bild.', 415);
        }
        [$w, $h] = [(int)$info[0], (int)$info[1]];
        if ($w > 20000 || $h > 20000 || $w * $h > HBS_MAX_SOURCE_PIXELS) {
            fail('Das Bild ist zu groß (Auflösung). Bitte verkleinern und erneut hochladen.', 413);
        }
        if (!ensure_dir(HBS_UPLOAD_DIR) || !is_writable(HBS_UPLOAD_DIR)) {
            fail('Der Ordner cms/uploads ist nicht beschreibbar.', 500);
        }
        $base = HBS_UPLOAD_DIR . '/' . date('Ymd') . '-' . bin2hex(random_bytes(8));
        $res = reencode_image($tmp, $mime, $w, $h, $base);
        $reencoded = $res !== null;
        if ($res === null) {
            // Ohne GD: Original übernehmen (bereits per finfo + getimagesize geprüft)
            $ext = $types[$mime][1];
            if (!move_uploaded_file($tmp, $base . '.' . $ext)) {
                fail('Die Datei konnte nicht gespeichert werden.', 500);
            }
            $res = [$ext, $w, $h];
        }
        @chmod($base . '.' . $res[0], 0644);
        respond([
            'ok' => true,
            'path' => 'cms/uploads/' . basename($base) . '.' . $res[0],
            'width' => $res[1],
            'height' => $res[2],
            'reencoded' => $reencoded,
        ]);

    case 'password':
        require_post();
        require_auth(true);
        $cur = param('current');
        $new = param('new');
        if (!password_verify($cur, (string)$cfg['password_hash'])) {
            usleep(500000);
            fail('Das aktuelle Passwort ist falsch.', 400);
        }
        if (preg_match_all('/./us', $new) < HBS_MIN_PASSWORD_LEN || strlen($new) > 200) {
            fail('Das neue Passwort muss mindestens ' . HBS_MIN_PASSWORD_LEN . ' Zeichen lang sein.', 400);
        }
        if ($new === $cur) {
            fail('Das neue Passwort muss sich vom bisherigen unterscheiden.', 400);
        }
        $cfg['password_hash'] = password_hash($new, PASSWORD_DEFAULT);
        $cfg['initial_password'] = false;
        try {
            save_config($cfg);
        } catch (Throwable $e) {
            fail('Passwort konnte nicht gespeichert werden (Schreibrechte für cms/config.php prüfen).', 500);
        }
        session_regenerate_id(true);
        respond(['ok' => true, 'mustChangePassword' => false]);

    case 'images':
        require_auth(false);
        $list = [];
        foreach (['assets/img' => HBS_ROOT_DIR . '/assets/img', 'cms/uploads' => HBS_UPLOAD_DIR] as $rel => $dir) {
            $files = glob($dir . '/*.{jpg,jpeg,png,webp,gif,JPG,JPEG,PNG,WEBP,GIF}', GLOB_BRACE) ?: [];
            foreach ($files as $file) {
                $list[] = ['path' => $rel . '/' . basename($file), 'source' => $rel === 'assets/img' ? 'assets' : 'uploads', 'size' => (int)filesize($file), 'mtime' => (int)filemtime($file)];
            }
        }
        usort($list, fn($a, $b) => [$a['source'] === 'assets', $b['mtime']] <=> [$b['source'] === 'assets', $a['mtime']]);
        respond(['ok' => true, 'images' => $list]);

    case 'backups':
        require_auth(false);
        $out = [];
        foreach (list_backups() as $file) {
            if (preg_match('/^content-(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})-[0-9a-f]{8}\.json$/', basename($file), $m)) {
                $out[] = ['name' => basename($file), 'date' => "$m[1]-$m[2]-$m[3] $m[4]:$m[5]", 'size' => (int)filesize($file)];
            }
        }
        respond(['ok' => true, 'backups' => $out]);

    case 'backup':
        require_auth(false);
        $name = (string)($_GET['name'] ?? '');
        // Strenger Dateiname – kein Pfad, nur Sicherungen
        if (!preg_match('/^content-\d{8}-\d{6}-[0-9a-f]{8}\.json$/', $name) || !is_file(HBS_BACKUP_DIR . '/' . $name)) {
            fail('Sicherung nicht gefunden.', 404);
        }
        $data = json_decode((string)file_get_contents(HBS_BACKUP_DIR . '/' . $name), true);
        if (!is_array($data)) {
            fail('Sicherung ist beschädigt.', 500);
        }
        respond(['ok' => true, 'name' => $name, 'content' => $data]);

    default:
        fail('Unbekannte Aktion.', 400);
}
