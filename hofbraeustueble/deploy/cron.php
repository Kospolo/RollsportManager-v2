<?php
// Hofbräustüble – Ergebnisse von OpenLigaDB holen (läuft im Container alle 15 Minuten).
// Ruft denselben Cronjob-Endpunkt auf, den man sonst beim Webhoster einträgt.
$raw = @file_get_contents('/srv/hbs-state/data/tipp-cron-token.php');
if (!is_string($raw) || !preg_match('/^TOKEN=([a-f0-9]{48})$/m', $raw, $m)) {
    exit(0); // noch kein Token – das Tippspiel holt Ergebnisse dann beim Öffnen nach
}
$ch = curl_init('http://127.0.0.1/cms/tipp-api.php?action=cron_sync&token=' . $m[1]);
curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 60, CURLOPT_HTTPHEADER => ['Host: localhost']]);
$out = curl_exec($ch);
$code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
fwrite(STDOUT, '[hbs] cron_sync ' . $code . ' ' . substr((string)$out, 0, 200) . "\n");
