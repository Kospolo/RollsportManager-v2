<?php
/*
 * Hofbräustüble CMS – Konfiguration
 *
 * Diese Datei ist per .htaccess vor Webzugriff geschützt und gibt bei direktem
 * Aufruf nichts aus. Das Passwort wird NUR als Hash gespeichert.
 * Das Passwort ändern Sie im Admin-Bereich unter "Einstellungen".
 *
 * Passwort vergessen? Diese Datei durch die Originaldatei aus dem
 * Download-Paket ersetzen – dann gilt wieder das Start-Passwort (siehe README.md).
 */
if (!defined('HBS_CMS')) {
    http_response_code(403);
    exit;
}

return array (
  'password_hash' => '$2y$10$HzzOj2SnhAz2LJBWQb1lNeH53R/3aXoYbKu3ZkhIf2IdVa4sA1fTW',
  'initial_password' => true,
  'session_idle_minutes' => 240,
);
