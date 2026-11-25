# Hofbräustüble-Tippspiel – Spezifikation (gemeinsamer Vertrag)

Kostenloses, internes Tippspiel für Stammgäste. **Kein Echtgeld, keine Einsätze** (Sportwetten mit Einsatz sind in DE ohne Lizenz verboten – GlüStV). Teilnahme nur **per Einladung**. Gäste tippen Spielergebnisse (EM, WM, Bundesliga, Champions League …), sammeln Punkte, sehen Rangliste und Statistiken. Alle UI-Texte Deutsch, „du“-Ansprache.

## Ordner / Zuständigkeiten

| Pfad | Inhalt |
|---|---|
| `cms/tipp-api.php` | PHP-8-Backend (Spieler- und Admin-Aktionen). Ändert `cms/api.php` NICHT. |
| `cms/data/tippspiel.sqlite` | SQLite-Datenbank (PDO), wird beim ersten Aufruf automatisch angelegt. `cms/data/` ist per .htaccess gesperrt und per .gitignore ausgeschlossen. |
| `tippspiel/js/tipp-client.js` | JS-Client `window.TippAPI` mit Live-Modus (fetch auf tipp-api.php) **und** Demo-Modus (localStorage-Mock mit identischem Verhalten). |
| `tippspiel/index.html` + `tippspiel/app.css` + `tippspiel/app.js` | Spieler-App (mobil zuerst). |
| `admin/` | Neuer Admin-Reiter „Tippspiel“. |
| `variante-1/`, `variante-2/` | Teaser-Abschnitt + Nav-Link „Tippspiel“ → `../tippspiel/`. |

## Datenmodell (SQLite)

```
settings(key TEXT PK, value TEXT)                 -- points_exact=4, points_diff=3, points_tendency=2
competitions(id INTEGER PK, name TEXT, active INT 0/1, sort INT,
             bonus_question TEXT NULL,            -- z. B. "Wer wird Europameister?"
             bonus_answer TEXT NULL,              -- vom Admin nach Turnierende gesetzt
             bonus_points INT DEFAULT 10, created TEXT,
             source TEXT NULL,                    -- NULL = von Hand, 'openligadb' = automatischer Abruf
             source_league TEXT NULL,             -- OpenLigaDB-Kürzel, z. B. bl1, bl2, dfb, ucl
             source_season INT NULL,              -- Startjahr: 2026 = Saison 2026/27
             sync_window_days INT DEFAULT 14,     -- neue Spiele der nächsten N Tage anlegen (1–90)
             last_sync TEXT NULL,                 -- "YYYY-MM-DD HH:MM:SS" letzter Abruf(-versuch)
             last_sync_status TEXT NULL)          -- "OK – 9 neu, 2 Ergebnisse" | "Fehler: …"
matches(id INTEGER PK, competition_id INT, round TEXT,   -- "Gruppe A · 1. Spieltag", "Achtelfinale", "12. Spieltag"
        kickoff TEXT,                           -- "YYYY-MM-DD HH:MM" Ortszeit Europe/Berlin
        home TEXT, away TEXT,
        home_goals INT NULL, away_goals INT NULL,   -- NULL = noch kein Ergebnis
        external_id TEXT NULL,                  -- matchID bei OpenLigaDB, eindeutig je Wettbewerb
        external_group INT NULL,                -- intern: groupOrderID (Spieltag) für gezielten Ergebnis-Abruf
        result_source TEXT NULL)                -- 'manual' | 'auto' | NULL (kein Ergebnis)
players(id INTEGER PK, nickname TEXT UNIQUE COLLATE NOCASE, password_hash TEXT,
        email TEXT NULL, active INT DEFAULT 1, created TEXT, last_login TEXT NULL, invite_code TEXT)
invites(code TEXT PK, note TEXT, max_uses INT, uses INT DEFAULT 0, expires TEXT NULL, revoked INT DEFAULT 0, created TEXT)
tips(player_id INT, match_id INT, home_goals INT, away_goals INT, updated TEXT, PRIMARY KEY(player_id, match_id))
bonus_tips(player_id INT, competition_id INT, answer TEXT, updated TEXT, PRIMARY KEY(player_id, competition_id))
attempts(k TEXT PK, count INT, first INT, last INT, locked_until INT)   -- intern: Brute-Force-Zähler (nur Hash der IP)
team_logos(team TEXT PK COLLATE NOCASE, source_url TEXT, file TEXT NULL, status TEXT,  -- Vereinslogos (siehe Ergänzung)
           fetched TEXT, attempts INT, tried TEXT NULL, last_error TEXT NULL)
```

IDs sind `AUTOINCREMENT` (werden nach dem Löschen nie wiederverwendet), Fremdschlüssel mit `ON DELETE CASCADE`, `PRAGMA user_version` = Schema-Version (3), WAL-Modus. Migration 1 → 2 ist idempotent (`PRAGMA table_info` + `ALTER TABLE … ADD COLUMN`, Index `UNIQUE(competition_id, external_id) WHERE external_id IS NOT NULL`); vorhandene Ergebnisse bekommen `result_source='manual'`. `settings` enthält zusätzlich intern `cron_last` (JSON des letzten Cronjob-Aufrufs) und `logo_lazy_last`, sowie `show_logos` (0/1, Standard 1). Migration 2 → 3 (idempotent): Tabelle `team_logos`.

## Regeln

- **Punkte pro Spiel** (konfigurierbar): exaktes Ergebnis = `points_exact` (4); richtige Tordifferenz bei Sieg/Niederlage = `points_diff` (3); richtige Tendenz (Sieg/Unentschieden/Niederlage) = `points_tendency` (2); sonst 0. Ein Unentschieden, das nicht exakt stimmt, zählt als Tendenz (2).
- **Tippschluss** = Anstoß (serverseitig geprüft, Zeitzone Europe/Berlin). Danach keine Änderung mehr.
- **Fremde Tipps** und die **Tipp-Tendenz** („Community-Quote“: % Heimsieg / Remis / Auswärtssieg + Anzahl Tipps + häufigstes Ergebnis) werden erst **nach Tippschluss** angezeigt – vorher nur die Anzahl abgegebener Tipps.
- **Bonusfrage** je Wettbewerb (optional): tippbar bis zum Anstoß des ersten Spiels; Vergleich ohne Groß-/Kleinschreibung und Leerzeichen; gibt `bonus_points`.
- **Rangliste** je Wettbewerb und gesamt („Ewige Tabelle“): Punkte ↓, dann exakte Treffer ↓, dann Tordifferenz-Treffer ↓, dann Nickname. Gleichstand = gleicher Rang.
- **Einladungen**: Code (8 Zeichen, ohne verwechselbare Zeichen wie 0/O/1/I), `max_uses` (1 = persönlich, z. B. 50 = Thekenaushang), optional Ablaufdatum. Einladungslink: `tippspiel/?code=XXXXXXXX`.
- **Datenschutz**: nur Nickname + Passwort Pflicht, E-Mail optional. Rangliste zeigt nur Nicknames. Spieler kann sein Konto selbst löschen (löscht Tipps).

## HTTP-API `cms/tipp-api.php?action=…`

JSON rein/raus. Antwort immer `{ ok: true, ... }` oder `{ ok: false, error: "Deutsche Fehlermeldung" }` mit passendem HTTP-Status. POST-Aktionen brauchen den Header `X-CSRF-Token` (außer `login`/`register`, die per SameSite=Strict-Cookie + Origin-Prüfung geschützt sind). Spieler-Session getrennt von der CMS-Session (eigener Session-Name `HBS_TIPP`).

### Spieler
| Aktion | Methode | Eingabe | Antwort |
|---|---|---|---|
| `status` | GET | – | `{ api:"hbs-tipp", player: {id,nickname,email}\|null, csrf, settings:{points_exact,points_diff,points_tendency,show_logos}, serverTime:"YYYY-MM-DD HH:MM:SS", admin: bool }` (`admin` = Verwaltung angemeldet, siehe „Wirt-Ansicht“) |
| `invite_check` | GET | `code` | `{ valid: bool }` |
| `register` | POST | `{code, nickname, password, email?}` | wie `status` (eingeloggt). Nickname 2–24 Zeichen, Passwort ≥ 8. |
| `login` | POST | `{nickname, password}` | wie `status`. Brute-Force-Schutz. |
| `logout` | POST | – | `{}` |
| `matches` | GET | `competition_id?` (Standard: alle aktiven) | `{ competitions:[{id,name,active,bonus_question,bonus_answer,bonus_points,bonus_locked,my_bonus}], matches:[{id,competition_id,round,kickoff,home,away,home_goals,away_goals,locked,my_tip:{home,away}\|null,my_points\|null,tip_count,tendency:{home,draw,away,top:"2:1"}\|null}] }` (sortiert nach Anstoß) |
| `tip` | POST | `{match_id, home, away}` (0–20) | `{ tip:{home,away}, updated }` – 409 wenn gesperrt |
| `bonus_tip` | POST | `{competition_id, answer}` | `{ answer }` |
| `leaderboard` | GET | `competition_id?` (leer = gesamt) | `{ rows:[{rank,nickname,points,exact,diff,tendency,tips,is_me}], me_rank }` |
| `stats` | GET | `competition_id?` | `{ points, tips, scored_tips, exact, diff, tendency, miss, hit_rate, avg_points, avg_points_all, best_round:{round,points}, by_round:[{round,points,avg_all}], favorite_tip:"2:1", rank_history:[{label,rank}] }` |
| `player_tips` | GET | `nickname` | Tipps dieses Spielers **nur für gesperrte Spiele** |
| `change_password` | POST | `{old, new}` | `{}` |
| `delete_account` | POST | `{password}` | `{}` |

### Admin (erfordert eingeloggte **CMS**-Session + deren CSRF-Token; `cms/tipp-api.php` liest dazu die CMS-Session wie `cms/api.php`)
| Aktion | Eingabe |
|---|---|
| `admin_overview` GET | → `{ competitions, matches (alle, inkl. inaktiver), players:[{id,nickname,email,active,created,last_login,tips,points}], invites, settings }` |
| `admin_competition_save` POST | `{id?, name, active, sort, bonus_question, bonus_answer, bonus_points, source?, source_league?, source_season?, sync_window_days?}` |
| `admin_source_preview` GET | `league, season` → `{ league, season, season_label, league_name, match_count, round_count, team_count, finished, first_kickoff, last_kickoff, current_group:{name,order}\|null, matches:[{kickoff,home,away,round,result}] }` (die nächsten 5 Spiele) |
| `admin_sync` POST | `{competition_id, scope:'window'\|'season'}` → `{ inserted, updated, results, skipped_manual, errors:[{message}], last_sync, last_sync_status }` |
| `admin_cron_info` GET | → `{ url_with_token, last_cron:{time,ok,status}\|null }` |
| `admin_cron_token_reset` POST | → wie `admin_cron_info` (neuer Token) |
| `admin_competition_delete` POST | `{id}` (löscht Spiele + Tipps; Bestätigung im UI) |
| `admin_match_save` POST | `{id?, competition_id, round, kickoff, home, away}` |
| `admin_match_delete` POST | `{id}` |
| `admin_match_import` POST | `{competition_id, text}` – je Zeile `YYYY-MM-DD HH:MM; Heim; Gast; Runde` → `{ imported, errors:[{line,message}] }` |
| `admin_result` POST | `{match_id, home_goals, away_goals}` (null/null = Ergebnis löschen) |
| `admin_invite_create` POST | `{note, max_uses, expires?}` → `{ invite }` |
| `admin_invite_revoke` POST | `{code}` |
| `admin_player_update` POST | `{id, active}` |
| `admin_player_reset` POST | `{id}` → `{ temp_password }` |
| `admin_player_delete` POST | `{id}` |
| `admin_settings_save` POST | `{points_exact, points_diff, points_tendency}` |

### Cronjob (ohne Anmeldung)
| Aktion | Eingabe | Antwort |
|---|---|---|
| `cron_sync` GET | `token` (48 Hex-Zeichen) | `{ time, competitions:[{id,name,ok,inserted,updated,results,skipped_manual,errors,status}], summary }` – 403 bei falschem Token (nach 10 Fehlversuchen je IP 15 Min. Sperre, 429) |

## JS-Client `tippspiel/js/tipp-client.js`

```js
await TippAPI.init({ base: '../cms/tipp-api.php', adminCsrf?: '...' })
  // prüft `status`; liefert kein gültiges JSON mit api:"hbs-tipp" → Demo-Modus
TippAPI.mode            // 'live' | 'demo'
await TippAPI.call(action, data?)   // GET-Aktionen: data als Query; POST: JSON-Body; wirft Error(message) bei ok:false
TippAPI.demoReset()     // Demo-Daten neu erzeugen
```

**Demo-Modus** (für die Vorschau ohne PHP, localStorage-Key `hbs_tipp_demo_v3`): implementiert ALLE Spieler- und Admin-Aktionen mit identischer Logik (Punkte, Sperren, Tendenz, Rangliste, Statistik). Seed relativ zum aktuellen Datum, damit die Demo immer lebendig wirkt:
- Zusätzlich Wettbewerb „Bundesliga 2026/27“ (Bonusfrage „Wer wird Deutscher Meister?“, automatischer Abruf `openligadb`/`bl1`/2026, Ergebnisse `result_source='auto'`, Spiele mit `external_id`): 12. Spieltag (letztes Wochenende, mit Ergebnissen) und 13. Spieltag (nächstes Wochenende, Fr 20:30 / Sa 15:30 + 18:30 / So 15:30 + 17:30).
- Wettbewerb „Demo-Turnier“ mit Bonusfrage „Wer gewinnt das Turnier?“, Nationalteams (Deutschland, Frankreich, Spanien, Italien, Niederlande, Portugal, England, Österreich, Schweiz, Belgien, Kroatien, Dänemark …), ~18 Spiele: einige vergangene mit Ergebnis, eines „läuft gerade“ (Anstoß vor 30 Min., gesperrt, ohne Ergebnis), mehrere kommende in den nächsten Tagen.
- 8–10 erfundene Stammgäste mit Spitznamen (z. B. „Kalle“, „Uschi_66“, „Theken-Toni“) und plausiblen Tipps, damit Rangliste und Tendenz gefüllt sind.
- Einladungscode `DEMO2026` (gültig). Demo-Login: Registrierung mit diesem Code, oder Nickname „Gast“ / Passwort „demo1234“.
- Admin-Aktionen im Demo-Modus brauchen keine Anmeldung.

## Ergänzungen/Präzisierungen (Backend, umgesetzt in `cms/tipp-api.php` und `tipp-client.js`)

**Allgemein**
- Fehlerantworten: `{ ok:false, api:"hbs-tipp", error, …extra }`. Extra-Felder: `loggedIn:false` (401), `csrfInvalid:true` (403), `locked:true` (409 Tippschluss), `retryAfter` (429), `setup:"pdo_sqlite"|"data_dir"` (500, Server nicht eingerichtet). Statuscodes: 400 Eingabe, 401 nicht angemeldet, 403 CSRF/fremde Herkunft/Konto gesperrt, 404 nicht gefunden, 405 falsche Methode, 409 Konflikt (Tippschluss, Nickname vergeben, Ergebnis vor Anstoß), 413/415 Body zu groß/kein JSON, 429 Sperre.
- POST nur mit `Content-Type: application/json`; bei allen POSTs wird zusätzlich `Origin`/`Sec-Fetch-Site` geprüft.
- Ja/Nein-Felder in Antworten sind **Booleans** (`active`, `locked`, `bonus_locked`, `revoked`, `valid`, `is_me`); Eingabe akzeptiert `true/false/1/0`.
- Alle Spieler-Aktionen außer `status`, `invite_check`, `register`, `login` erfordern Anmeldung (sonst 401). `logout` ohne Anmeldung ist ok.
- Spieler-Session: Cookie `HBS_TIPP` (Pfad `/cms/`, 60 Tage, gleitend verlängert), Dateien in `cms/data/tipp-sessions/`. Anonyme Besucher bekommen kein Cookie. Passwortänderung, Passwort-Reset, Deaktivierung oder Löschen melden andere Geräte ab.
- Brute-Force: 5 Fehlversuche je IP+Nickname bzw. 30 je IP (Kneipen-WLAN!) bzw. 20 falsche Einladungscodes je IP in 15 Min. → 15 Min. Sperre (429). Gespeichert wird nur ein Hash der IP.
- Admin: GET-Aktionen brauchen nur die CMS-Session, POST zusätzlich `X-CSRF-Token` = CSRF-Token der CMS-Session (aus `cms/api.php?action=status|login`). Aktivität im Tippspiel-Reiter hält die CMS-Session am Leben.

**Validierung**
- Nickname 2–24 Zeichen: Buchstaben A–Z/a–z, Umlaute ÄÖÜäöüß, Ziffern, Leerzeichen, `_ - .` (mind. ein Buchstabe/Ziffer); eindeutig ohne Groß-/Kleinschreibung (auch Umlaute). Passwort 8–200 Zeichen. E-Mail optional, max. 150.
- Tore 0–20 (ganze Zahlen). Anstoß `YYYY-MM-DD HH:MM`; akzeptiert auch `YYYY-MM-DDTHH:MM` (input type=datetime-local) und `TT.MM.JJJJ HH:MM`, gespeichert immer als `YYYY-MM-DD HH:MM`.
- Längen: Wettbewerbsname 1–80, Bonusfrage ≤150, Bonus-Antwort ≤80 (Spieler: 1–80), `bonus_points` 0–100 (Standard 10), `sort` −9999…9999, Runde ≤60, Mannschaft 1–40 (Heim ≠ Gast), Einladungsnotiz ≤100, `max_uses` 1–1000.
- Einladungscode-Eingabe: Groß-/Kleinschreibung, Leerzeichen und `-` egal. `expires`: leer, `YYYY-MM-DD` (gilt bis Tagesende) oder `YYYY-MM-DD HH:MM`.
- Punkte-Einstellungen je 0–50 mit exakt ≥ Differenz ≥ Tendenz.

**Spieler-Aktionen – Details**
- `matches`: zusätzlich `my_kind` (`exact|diff|tendency|miss|null`) und `serverTime`. `tendency` nur bei `locked` und mind. 1 Tipp, Prozente ganzzahlig gerundet; `top` = häufigstes Ergebnis, bei Gleichstand das alphabetisch kleinste. `tip_count`/Tendenz zählen nur aktive Spieler. `competition_id` kann auch einen inaktiven Wettbewerb (Archiv) abfragen.
- `tip`: 404 unbekanntes Spiel, 409 bei inaktivem Wettbewerb oder ab Anstoß (`locked:true`).
- `bonus_tip`: 409 wenn gesperrt (`now ≥ erster Anstoß` des Wettbewerbs; ohne Spiele offen) oder Wettbewerb inaktiv; 400 wenn keine Bonusfrage. Bonus zählt nur, wenn `bonus_question` und `bonus_answer` gesetzt sind.
- `leaderboard`: enthält **alle aktiven Spieler** (auch mit 0 Punkten), deaktivierte nicht. Zeile zusätzlich `bonus` (Bonuspunkte); `points` = Spielpunkte + Bonus; `tips` = gewertete Tipps (Spiele mit Ergebnis). Gesamt = alle Wettbewerbe (auch inaktive).
- `stats`: `points` inkl. Bonus, zusätzlich `bonus`; `tips` = alle eigenen Tipps im Bereich, `scored_tips` = davon gewertete; `hit_rate` in Prozent (1 Nachkommastelle, Treffer = exakt+Differenz+Tendenz); `avg_points` = Spielpunkte/gewertete Tipps, `avg_points_all` = dasselbe über alle aktiven Spieler (2 Nachkommastellen). Runde = Wettbewerb + `round`, chronologisch nach erstem Anstoß, leere Runde heißt „Ohne Runde“, in der Gesamtansicht mit mehreren Wettbewerben als „Wettbewerb · Runde“. `by_round[].avg_all` = Durchschnitt der Spieler, die in der Runde getippt haben. `best_round` = erste Runde mit den meisten eigenen Punkten (null ohne gewertete Spiele). `favorite_tip` = häufigster eigener Tipp (Gleichstand: alphabetisch kleinster), null ohne Tipps. `rank_history[].rank` = Rang nach dieser Runde (kumuliert, nur Spielpunkte, ohne Bonus). Rundung kaufmännisch, ganzzahlig berechnet (PHP und JS identisch).
- `player_tips` → `{ player:{nickname,is_me}, tips:[{match_id,competition_id,round,kickoff,home,away,home_goals,away_goals,locked,tip:{home,away},points,kind}], bonus:[{competition_id,competition,question,answer,correct:true|false|null}] }`, Spiele neueste zuerst, nur gesperrte Spiele bzw. gesperrte Bonusfragen; 404 bei unbekanntem/deaktiviertem Spieler.
- `register`: 400 bei ungültigem/abgelaufenem/zurückgezogenem/aufgebrauchtem Code, 409 bei vergebenem Nickname. `login`: 401 falsche Daten, 403 Konto deaktiviert, 429 Sperre.

**Admin-Aktionen – Details**
- `admin_overview`: Wettbewerbe zusätzlich `created`, `match_count`, `bonus_locked`; Spiele zusätzlich `locked`, `tip_count`; Spieler zusätzlich `invite_code` (`points` = Gesamtpunkte inkl. Bonus, `tips` = alle Tipps); Einladungen `{code,note,max_uses,uses,expires,revoked,created,valid}` (neueste zuerst); dazu `serverTime`.
- `admin_competition_save` → `{ competition }`; `admin_match_save` → `{ match }`; `admin_result` → `{ match }`.
- `admin_result`: Ergebnis erst ab Anstoß (sonst 409); `home_goals`/`away_goals` beide `null` (oder leer) löscht das Ergebnis. `admin_match_save`: ein Spiel mit Ergebnis kann nicht in die Zukunft verlegt werden (409).
- `admin_match_import`: Trennzeichen `;` oder Tab, Runde optional, leere Zeilen und Zeilen mit `#` werden übersprungen, Duplikate (gleicher Anstoß + Heim + Gast im Wettbewerb) als Fehler gemeldet, max. 1000 Zeilen / 100 000 Zeichen. Gültige Zeilen werden importiert, fehlerhafte in `errors` gemeldet.
- `admin_player_reset` → `temp_password` (10 Zeichen, ohne verwechselbare Zeichen).

**JS-Client – Ergänzungen**
- `init()` gibt die `status`-Antwort zurück. Optionen: `base`, `adminCsrf`, `mode:'demo'|'live'` (erzwingen), `timeout` (ms, Standard 8000). Antwortet der Server mit `api:"hbs-tipp"`, aber `ok:false` (z. B. pdo_sqlite fehlt), ist `mode='live'`, `TippAPI.error` gesetzt und `init()` wirft den Fehler.
- `call()` wirft `Error(message)` mit `.status` (HTTP-Status, 0 = keine Verbindung) und `.data` (komplette Antwort). Admin-POSTs senden `adminCsrf`, Spieler-POSTs das `csrf` aus `status/login/register`.
- Zusätzlich: `TippAPI.setAdminCsrf(token)`, `TippAPI.player`, `TippAPI.csrf`, `TippAPI.settings`, `TippAPI.error`, `TippAPI.util` (reine Funktionen `tally, rankRows, tendency, leaderboard, stats, ratio, bonusNorm, berlinNow, parseKickoff`).
- `TippAPI.scoreTip(tip, result, settings)` → `{points, kind}` oder `null` (Tipp/Ergebnis fehlt). `tip` = `{home, away}`, `result` = Spiel-Objekt mit `home_goals/away_goals` (oder `{home, away}` mit Zahlen); ohne `settings` gelten 4/3/2.
- `demoReset({empty:true})` erzeugt eine leere Demo (für Tests). Demo-Daten älter als 3 Tage werden automatisch neu erzeugt. Demo-`status` enthält zusätzlich `demo:true`. Fehlermeldungen und Statuscodes im Demo-Modus = Live; im Demo-Modus kein Brute-Force-Schutz und keine CSRF-Prüfung. Demo-Seed: Wettbewerb „Demo-Turnier“, 18 Spiele (9 mit Ergebnis, 1 läuft, 8 kommend), 10 Stammgäste inkl. „Gast“/`demo1234`, Einladungen `DEMO2026` (gültig), `THEKE4UH` (gültig), `KALLE7KX` (aufgebraucht), `ALT3RCDE` (zurückgezogen).

## Ergänzung: Automatischer Abruf von Spielplan und Ergebnissen (OpenLigaDB)

Quelle: OpenLigaDB (`https://api.openligadb.de`, kostenlos, ohne Schlüssel, Community-gepflegt). Anfragen gehen **nur** an diese feste Adresse; `source_league` muss `^[A-Za-z0-9_-]{1,40}$`, `source_season` `^\d{4}$` (2000–2100) entsprechen und wird nur als Pfadteil eingesetzt. Nur für Tests: serverseitig Konstante oder Umgebungsvariable `HBS_OLDB_BASE` (nie aus der Anfrage). HTTP: curl-Erweiterung, sonst `file_get_contents` mit Stream-Kontext; User-Agent `HBS-Tippspiel/1.0`; Zeitlimit 8 s (Verwaltung, Cronjob) bzw. 5 s (nebenbei); max. 8 MB. Fehler (keine Verbindung, Zeitüberschreitung, HTTP ≠ 200, kein gültiges JSON, unbekannte Liga = leere Liste) → deutsche Meldung; `admin_sync`/`admin_source_preview` antworten dann mit **502** (`admin_sync` zusätzlich `last_sync`, `last_sync_status`), unbekannte Liga/Saison in der Vorschau mit 404.

**Felder:** `competitions.source/source_league/source_season/sync_window_days/last_sync/last_sync_status` erscheinen in `admin_overview` und `admin_competition_save` (Antwort). Spieler-Aktionen (`matches`) liefern je Wettbewerb nur `source` (`'openligadb'|null`). Spiele haben überall (`matches`, `admin_overview`, `admin_result`, `admin_match_save`, `player_tips`) `result_source` (`'manual'|'auto'|null`), in `admin_overview` zusätzlich `external_id`.

**`admin_competition_save`:** Die Quell-Felder werden nur verarbeitet, wenn `source` im JSON vorkommt (sonst bleiben sie unverändert). `source:'openligadb'` (oder `true`) verlangt gültiges `source_league` + `source_season`; leer/`null`/`false` schaltet ab (gültige Kürzel/Saison bleiben gespeichert). `sync_window_days` 1–90, Standard 14.

**Zuordnung (OpenLigaDB → Spiel):** `matchID` → `external_id`; `team1/team2.teamName` → `home/away` (gesäubert, max. 40 Zeichen; Paarungen ohne Namen werden übersprungen); `group.groupName` → `round` (max. 60); `matchDateTimeUTC` → `kickoff` in Europe/Berlin (Ersatz: `matchDateTime`). **Ergebnis = `matchResults[resultTypeID=2]` (Endergebnis nach 90 Minuten)** – Verlängerung (4) und Elfmeterschießen (5) zählen nicht. Übernommen nur ab Anstoß und wenn `matchIsFinished` (Live-Zwischenstände nie); ohne dieses Kennzeichen erst 4 Std. nach Anstoß.

**`admin_sync` (Upsert über `external_id`):**
- `scope:'window'`: neue Spiele mit Anstoß zwischen jetzt und jetzt + `sync_window_days` anlegen; `scope:'season'`: alle Spiele der Saison anlegen (vergangene mit Ergebnis). Ein vorhandenes Spiel ohne `external_id` mit gleichem Anstoß + Heim + Gast wird übernommen statt doppelt angelegt.
- Vorhandene, **noch nicht angepfiffene** Spiele: Anstoß, Mannschaften, Runde aktualisieren (`updated`). Angepfiffene Spiele werden nie verschoben; bei einer Verlegung laut OpenLigaDB (ohne Ergebnis) gibt es einen Hinweis in `errors`.
- Ergebnisse: `result_source='manual'` wird **nie** überschrieben (`skipped_manual` zählt abweichende Hand-Ergebnisse); sonst Ergebnis setzen/korrigieren mit `result_source='auto'` (`results`).
- Speichert `last_sync` + `last_sync_status` (`"OK – 18 neu, 3 Ergebnisse"` bzw. `"Fehler: …"`). Gleichzeitige Abrufe verhindert eine Dateisperre (`cms/data/tipp-sync.lock`); wartet bis 15 s, sonst 409.

**`admin_result`:** setzt `result_source='manual'`; Löschen (`null/null`) setzt `result_source=NULL`, damit der Abruf das Ergebnis wieder eintragen darf.

**Nebenbei-Abruf (lazy):** bei `status`, `matches`, `leaderboard`: Gibt es einen aktiven Wettbewerb mit Quelle, in dem ein Spiel mit `external_id` vor ≥ 110 Min. (und höchstens 3 Tagen) angepfiffen wurde und kein Ergebnis hat, und ist `last_sync` älter als 10 Min., werden nur die Ergebnisse der betroffenen Spieltage (`/getmatchdata/{league}/{season}/{groupOrderID}`, bei > 3 Spieltagen die ganze Saison) geholt – nicht blockierende Dateisperre, 5 s Zeitlimit, höchstens 2 Wettbewerbe je Aufruf. Fehler landen nur in `last_sync_status`; die Spieler-Antwort ist davon unberührt. Die Spieler-Session wird vorher geschlossen.

**Cronjob:** `GET cms/tipp-api.php?action=cron_sync&token=…` (empfohlen alle 15 Min.) führt für jeden aktiven Wettbewerb mit Quelle einen `window`-Abruf aus. Der Token (48 Hex-Zeichen) wird beim ersten `admin_cron_info` zufällig erzeugt und in `cms/data/tipp-cron-token.php` gespeichert (PHP-Datei, die beim direkten Aufruf 404 liefert; nicht in `content.json`). Der letzte Aufruf steht in `settings.cron_last`.

**Demo-Modus (`tipp-client.js`):** gleiche Aktionen und Felder, aber ohne Netzwerk. `admin_sync`/`cron_sync` simulieren den Abruf: angepfiffene Spiele ohne Hand-Ergebnis bekommen ein plausibles, je Spiel gleichbleibendes Ergebnis (`result_source='auto'`), `inserted/updated` = 0, zusätzlich `message: "Demo: Abruf simuliert – im echten Betrieb kommen die Daten von OpenLigaDB"`. `admin_source_preview` liefert feste Beispieldaten für `bl1`, `bl2`, `dfb`, `ucl` (sonst 404). Der Nebenbei-Abruf wird mit denselben Schwellen (110 Min., 10 Min., 3 Tage) nachgebildet. `admin_cron_info` liefert eine Demo-Adresse.

**Admin-Oberfläche:** Wettbewerb-Dialog mit Bereich „Spielplan automatisch abrufen (OpenLigaDB)“ (Schalter, Auswahl 1. Bundesliga / 2. Bundesliga / DFB-Pokal / Champions League / eigenes Kürzel, Saison = laufende Saison (ab Juli das aktuelle Jahr, sonst Vorjahr) als „2026/27“, Zeitraum in Tagen, „Vorschau“, „Jetzt abrufen“, „Ganze Saison importieren“), Stand je Wettbewerb in der Wettbewerbsliste und in der Übersicht, Badges „automatisch“/„von Hand“ an Ergebnissen, Übersicht-Karte mit Cronjob-Adresse (Kopieren, Kurzanleitung IONOS/Strato/all-inkl, „Token neu erzeugen“). **Spieler-App:** unter der Spieleliste „Spielplan & Ergebnisse: OpenLigaDB“, sobald ein Wettbewerb eine Quelle hat.

## Ergänzung: Wirt-Ansicht (nur ansehen, ohne Spielerkonto)

Der Wirt kann das Tippspiel jederzeit ansehen, ohne sich als Spieler zu registrieren. Grundlage ist die **CMS-Session** (Anmeldung in der Verwaltung, gelesen wie bei den Admin-Aktionen).

**Backend (`cms/tipp-api.php`)**
- `status`, `login`, `register` liefern zusätzlich `admin: true|false` (CMS-Session gültig). Dabei wird die CMS-Sitzung nur angesehen, nicht verlängert.
- Lese-Aktionen `matches`, `leaderboard`, `player_tips`: Mit Spieler-Session → normale Spieler-Antwort (Spieler hat Vorrang). Ohne Spieler, aber mit gültiger CMS-Session → **Wirt-Modus**. Mit `view=owner` wird der Wirt-Modus ausdrücklich verlangt (auch wenn zusätzlich ein Spieler angemeldet ist); ohne CMS-Session dann 401 mit `owner:true`. Ohne jede Anmeldung bleibt alles 401. Antworten im Wirt-Modus enthalten `owner:true`; Aktivität verlängert die CMS-Sitzung.
  - `matches` (Wirt): ohne `my_tip/my_points/my_kind/my_bonus`; Wettbewerbe mit `bonus_count` (Anzahl Bonus-Antworten aktiver Spieler); Spiele mit `tip_count` und `tendency` für **alle** Spiele (auch vor dem Anstoß, sobald ≥ 1 Tipp).
  - `leaderboard` (Wirt): wie gehabt, `is_me` immer false, `me_rank: null`.
  - `player_tips` (Wirt): **alle** Tipps des Spielers inkl. noch offener Spiele (`locked:false`), Bonus-Antworten auch vor Tippschluss mit zusätzlichem `locked`; `player.is_me:false`.
  - `stats` bleibt persönlich (ohne Spieler 401) – der Wirt nutzt `admin_stats`.
- **Schreiben ist im Wirt-Modus nie möglich**: `tip`, `bonus_tip`, `change_password`, `delete_account` usw. verlangen weiterhin die Spieler-Session (+ deren CSRF-Token) → 401 bzw. 403. CSRF-/Origin-Prüfung der POSTs unverändert.
- Neue Admin-Aktionen (GET, CMS-Session nötig, sonst 401):

| Aktion | Eingabe | Antwort |
|---|---|---|
| `admin_stats` | `competition_id?` (leer = alle) | `{ players, tippers, matches, scored_matches, tips, scored_tips, exact, diff, tendency, miss, hit_rate, points, bonus, avg_points_tip, avg_points_player, favorite_tip:{tip,count}\|null, by_round:[{round, matches, tips, avg_points, best:{nicknames:[…], points}\|null}] }` – nur aktive Spieler; `hit_rate` in % (1 Stelle), `avg_points_tip` = Spielpunkte/gewertete Tipps, `avg_points_player` = Punkte inkl. Bonus / aktive Spieler, `by_round[].avg_points` = Ø der Spieler, die in der Runde getippt haben, `best` = Spieler mit den meisten Spielpunkten der Runde (Gleichstand: alle, alphabetisch; null bei 0 Punkten). Runden wie bei `stats`. |
| `admin_match_tips` | `match_id` | `{ match:{…Spiel, competition, tip_count, tendency}, tips:[{nickname, tip:{home,away}, points, kind, updated}], missing:[nickname…] }` – alle Tipps aktiver Spieler (auch vor dem Anstoß), sortiert nach Punkten ↓ dann Nickname; `missing` = aktive Spieler ohne Tipp. 404 bei unbekanntem Spiel. |

**JS-Client:** `TippAPI.admin` (aus `status/login/register`), GET-Aktionen `admin_stats`/`admin_match_tips`. Demo-Modus: der Wirt gilt als angemeldet, wenn die URL `?wirt=1` enthält oder nach `TippAPI.demoSetOwner(true)` (sessionStorage `hbs_tipp_demo_owner`, gilt für den Tab); sonst unverändert. Admin-Aktionen brauchen im Demo-Modus weiterhin keine Anmeldung. Demo-Seed unverändert (Key `hbs_tipp_demo_v3`). `TippAPI.util.ownerStats` = reine Berechnung von `admin_stats`.

**Spieler-App:** `player:null` + `admin:true` → Wirt-Ansicht: Messing-Banner „Wirt-Ansicht – nur ansehen, hier wird nicht getippt“ mit Link „Zur Verwaltung“ (`../admin/#tippspiel`); Reiter Spiele (`#/spiele`, gruppiert wie „Tippen“, nur lesen, Ergebnis, Tipp-Anzahl, Stammtisch-Quote immer sichtbar; Tipp auf ein Spiel → Bottom-Sheet mit allen Tipps, Punkten und wer noch fehlt), Rangliste (Name → alle Tipps inkl. offener), Statistik (`admin_stats`). Kein Profil. Anmeldeseite: dezenter Link „Als Wirt ansehen“ → `../admin/#tippspiel`. Bestehen beide Anmeldungen: Spieler-App mit Umschalter „Als Wirt ansehen“ / „Als Spieler“ im Kopf (Auswahl gilt für den Tab, sessionStorage `hbs_tipp_view`); die Wirt-Ansicht fragt dann mit `view=owner`.

**Verwaltung:** Reiter „Tippspiel“: Knopf „Tippspiel ansehen (Wirt-Ansicht)“ im Kopf (über der Unter-Navigation, in allen Unterbereichen) und als Karte in der Übersicht → `../tippspiel/` (Demo: `../tippspiel/?wirt=1`) in neuem Tab. Übersicht: Rangliste (gesamt, aus `leaderboard` mit `view=owner`) zeigt die Top 5 mit „Alle N anzeigen“ / „Weniger anzeigen“.

## Ergänzung: Vereinslogos (datenschutzfreundlich, vom eigenen Server)

OpenLigaDB liefert je Mannschaft `team1/team2.teamIconUrl` (Wikimedia, imgur, UEFA, footylogos, `data:`-URIs …). Der Server lädt jedes Logo **einmal** selbst, prüft es, speichert es unter `cms/uploads/logos/<sha1(Name in Kleinbuchstaben)>.png` und liefert es aus. **Browser der Besucher laden nie etwas von fremden Hosts.**

**Daten:** Tabelle `team_logos` (Schlüssel = Mannschaftsname wie in `matches.home/away`, ohne Groß-/Kleinschreibung). Beim Abruf (`sync_apply`, alle Umfänge) wird je Mannschaft die `teamIconUrl` gemerkt; ändert sie sich, wird das Logo neu geladen (`status='pending'`, `attempts=0`; die alte Datei bleibt bis zum Ersatz sichtbar). `status`: `pending` | `ok` | `failed`. Logos gelten für alle Spiele mit diesem Mannschaftsnamen (auch von Hand angelegte).

**Laden:** fällig = `pending` (hat die Mannschaft schon ein Logo, frühestens 24 Std. nach dessen Download – verschiedene Adressen in zwei Ligen führen so nicht zu Dauer-Downloads), oder `failed` mit `attempts < 5` und letztem Versuch (`tried`) vor ≥ 24 Std.; „Logos neu laden“ (`failed`/`all`) setzt `fetched` zurück und lädt sofort; nur Mannschaften, die in Spielen vorkommen. Je Durchlauf höchstens 25 Downloads, 5 s Zeitlimit je Download, Gesamtbudget: nach `admin_sync` 20 s, `cron_sync` 30 s, `admin_logos_refresh` 45 s, nebenbei (bei `status`/`matches`/`leaderboard`, höchstens alle 2 Min., nur wenn etwas fällig ist) höchstens 2 Logos / 3 s. Dateisperre `cms/data/tipp-logos.lock`. Nur bei `show_logos` = an (außer `admin_logos_refresh`). Drosselt ein Server (HTTP 429/503), bleibt das Logo `pending` (zählt nicht als Fehlversuch) und der Server wird für den Rest des Durchlaufs ausgelassen (mit genug Budget wird bis zu 3× 10 s gewartet). Dauerhafte Fehler (SVG fremd, kein https, kein Bild, 404 …) setzen `attempts=5`.

**Sicherheit (teamIconUrl = feindliche Eingabe):**
- nur `https`, Port 443, keine Zugangsdaten, keine IP-Literale, keine internen Namen (`localhost`, `.local`, `.lan`, `.internal` …); `http://` nur für `img.uefa.com` und `upload.wikimedia.org` (wird zu `https://`).
- Name auflösen (A + AAAA); ist **irgendeine** Adresse nicht öffentlich (RFC 1918, 127/8, 169.254/16, 100.64/10, 0/8, Multicast/reserviert, IPv6 außer 2000::/3, Teredo/6to4/NAT64/IPv4-mapped …) → abgelehnt. Verbindung per `CURLOPT_RESOLVE` fest an die geprüfte IP, Proxy aus. Nur wenn der Name lokal nicht auflösbar ist **und** der Server einen `https_proxy` gesetzt hat, geht die Anfrage über diesen Proxy (er löst dann auf).
- keine automatischen Weiterleitungen; höchstens 2, jede wird wie die erste geprüft. Max. 2 MB (Abbruch beim Lesen). User-Agent `HBS-Tippspiel/1.0 (Vereinslogos; +https://openligadb.de)`, `Accept` ohne `image/webp` (Wikimedia würde sonst eigens WebP rechnen und drosseln; WebP wird trotzdem angenommen).
- Inhalt: Magic Bytes + `finfo` + `getimagesize` müssen übereinstimmen, nur PNG/JPEG/GIF/WebP, max. 4096 px je Kante und 6 Mio. Pixel, keine `<script`/`<html`/`<svg`/`<?php`-Spuren (Polyglot) → sonst abgelehnt. Mit GD: neu als PNG gerechnet (max. 128 px, Seitenverhältnis + Transparenz bleiben, nie vergrößert); ohne GD: geprüftes Original mit passender Endung.
- **SVG nie**: `upload.wikimedia.org`/`thumb.wikimedia.org` – Query weg; SVG-Original `/wikipedia/<proj>/<a>/<ab>/<Datei>.svg` bzw. SVG-Vorschau beliebiger Größe → `/wikipedia/<proj>/thumb/<a>/<ab>/<Datei>.svg/250px-<Datei>.svg.png` (Wikimedia erlaubt nur Standardgrößen; 256px → Fehler 400). Wiki-Dateiseiten `commons.wikimedia.org/wiki/File:…` bzw. `xx.wikipedia.org/wiki/Datei:…` werden über `md5(Dateiname)` in diese Adressen umgerechnet (Datei: erst `/wikipedia/xx/`, dann `/commons/`). Andere SVG → übersprungen. `data:image/(png|jpeg|gif|webp);base64,…` → ohne Netzwerk dekodiert und genauso geprüft.
- Auslieferung: `cms/uploads/.htaccess` gilt auch für `logos/` (nur jpg/png/webp/gif, kein PHP, `nosniff`, CSP `sandbox`). In Docker liegt `cms/uploads` im Volume – keine Änderung am Deployment nötig.

**API:**
- Jedes Spiel-Objekt (`matches`, `player_tips`, `admin_overview`, `admin_match_tips`, `admin_result`, `admin_match_save`) hat `home_logo`/`away_logo`: relativer Pfad ab Website-Hauptordner, z. B. `cms/uploads/logos/<sha1>.png?v=<Unix-Zeit des Downloads>`, oder `null` (kein Logo oder `show_logos` aus).
- `settings.show_logos` (Boolean) in `status`, `login`, `register`, `admin_overview`, `admin_settings_save`.
- `admin_overview.logos` = `{ ok, failed, pending, none (ohne Logo-Quelle), teams, failed_list:[{team,message}], show, gd }` (nur Mannschaften mit Spielen).
- `admin_sync` zusätzlich `logos:{loaded,failed,paused,remaining,errors:[{team,message}]}` (wenn `show_logos`); `cron_sync` zusätzlich `logos` (oder `null`).

| Aktion | Eingabe | Antwort |
|---|---|---|
| `admin_logos_save` POST | `{show_logos}` | `{ settings }` |
| `admin_logos_refresh` POST | `{mode:'failed'\|'all'\|'continue'}` (Standard `failed`: fehlgeschlagene zurücksetzen; `all`: alle neu laden; `continue`: nur Fälliges weiter) | `{ loaded, failed, paused, remaining, errors, logos:{…wie admin_overview} }` – 409, wenn gerade schon geladen wird |

**JS-Client (Demo):** kein Netzwerk → `home_logo/away_logo` immer `null`; `settings.show_logos` (Standard `true`) wird gespeichert, `admin_logos_save` speichert den Schalter, `admin_logos_refresh` lädt nichts (`loaded:0 …`); beide mit `message` („Demo: ohne Netzwerk keine Vereinslogos …“). `admin_overview.logos` = alle Mannschaften „ohne Logo“.

**Spieler-App:** Logo statt Kürzel-Badge (32 px, `<img loading="lazy" decoding="async" alt="">`, `object-fit: contain`, heller runder Hintergrund) in allen Spielkarten (Tippen, Ergebnisse, Wirt-Ansicht); kleine Logos (18 px) in „Als Nächstes“, im Spiel-Sheet der Wirt-Ansicht und im Spieler-Sheet. Nur Pfade `cms/uploads/logos/…` werden angenommen (`../` davor). Kein Logo, `show_logos` aus oder Ladefehler → Kürzel-Badge (gleiche Größe, kein Springen). **Verwaltung:** Übersicht → Karte „Vereinslogos“ (Schalter, Stand, Fehlergründe, „Logos neu laden“ – läuft automatisch in Runden à 25 weiter – und „Alle neu laden“, Hinweis zu Datenschutz/Markenrecht); kleine Logos in „Ergebnisse eintragen“, offenen Ergebnissen und „Als Nächstes“.

## Ergänzung: Schalter aus „Funktionen“, Preise und Stammtischkasse

**Schalter** (`cms/content.json` → `features`, bearbeitet in der Verwaltung unter „Funktionen“): `tippspiel` (fehlt = an), `preise` (fehlt = aus), `kasse` (fehlt = aus). `cms/tipp-api.php` liest sie bei jeder Anfrage (`features()`); `status`, `login`, `register` und `admin_overview` liefern `features:{tippspiel,preise,kasse}` (Booleans).

**`features.tippspiel` aus:** `invite_check`, `register`, `login`, `tip`, `bonus_tip`, `stats`, `change_password` → **403** `{error:"Das Tippspiel ist im Moment ausgeschaltet.", disabled:true}`. Lese-Aktionen (`matches`, `leaderboard`, `player_tips`, `kasse`) → 403 `disabled:true`, außer mit gültiger CMS-Session: dann immer Wirt-Modus (`owner:true`, auch wenn zusätzlich ein Spieler angemeldet ist). `status`, `logout`, `delete_account`, alle `admin_*`-Aktionen, `cron_sync` und der Nebenbei-Abruf laufen weiter. **Spieler-App:** Gäste sehen „Das Tippspiel macht gerade Pause“ (Daten bleiben gespeichert); der Wirt (Verwaltung angemeldet) kommt in die Wirt-Ansicht mit Hinweis in der Wirt-Leiste. **Verwaltung:** Banner im Reiter „Tippspiel“ mit Knopf „Zu ‚Funktionen‘“.

**Preise (nur mit `features.preise`)** – vom Haus spendiert, Teilnahme kostenlos:
- `competitions.prize_1/prize_2/prize_3` (≤ 80 Zeichen) und `prize_note` (≤ 200), alle optional (Migration 3 → 4, idempotent per `add_columns`).
- `admin_competition_save` nimmt `prize_1`, `prize_2`, `prize_3`, `prize_note` (nur wenn im JSON vorhanden, sonst bleiben sie unverändert); `admin_overview`/`admin_competition_save` liefern sie immer.
- Spieler-/Wirt-Aktionen (`matches`): je Wettbewerb `prizes:{first,second,third,note}` oder `null` (Schalter aus oder kein Preis eingetragen).
- App: Karte „Um diese Preise wird gespielt“ oben in der Rangliste (Gesamt: alle Wettbewerbe mit Preisen), Zeile auf der Tipp-Seite bzw. in der Wirt-Ansicht, jeweils mit „Spendiert vom Hofbräustüble, mitspielen bleibt kostenlos“.

**Stammtischkasse (nur mit `features.kasse`)** – eine gemeinsame Kasse (z. B. für die Saisonabschluss-Feier). **Rechtlich wichtig (kein Glücksspiel):** keinerlei Verknüpfung mit Tipps, Punkten, Rangliste oder Preisen (eigene Tabelle ohne Fremdschlüssel, Name nur als freier Text), keine Auszahlung an Gewinner, Mitspielen kostet nie etwas.
- Tabelle `kasse(id, kind 'in'|'out', amount_cents INT > 0, day 'YYYY-MM-DD', name, purpose, note, created, updated)`, Einstellungen `settings.kasse_purpose` (≤ 120) und `settings.kasse_show_names` (0/1, Standard 0).
- Validierung: `amount_cents` ganze Zahl 1 … 10 000 000 (100 000 €), `day` gültiges Datum (auch `TT.MM.JJJJ`), Einzahlung braucht `name` (1–60), Ausgabe `purpose` (1–80), `note` ≤ 200.

| Aktion | Eingabe | Antwort |
|---|---|---|
| `kasse` GET (Spieler oder Wirt) | – | `{ balance_cents, purpose, names:[…]\|null }` – Namen der Einzahler (ohne Beträge, alphabetisch, ohne Doppelte) nur bei `show_names` |
| `admin_kasse` GET | – | `{ entries:[{id,kind,amount_cents,day,name,purpose,note,created,updated}], total_in_cents, total_out_cents, balance_cents, settings:{purpose,show_names} }` (neueste zuerst) |
| `admin_kasse_save` POST | `{id?, kind, amount_cents, day, name?, purpose?, note?}` | wie `admin_kasse` + `entry` (404 bei unbekannter `id`) |
| `admin_kasse_delete` POST | `{id}` | wie `admin_kasse` |
| `admin_kasse_settings` POST | `{purpose, show_names}` | wie `admin_kasse` |

Schalter aus → alle Kassen-Aktionen 403 `featureOff:"kasse"`. Admin-POSTs mit CMS-CSRF wie gehabt. **App:** kleine Karte „Stammtischkasse: 85 € – für die Saisonabschluss-Feier“ (bei Freigabe mit Namen) im Seitenbereich der Tipp-Seite/Wirt-Ansicht – nicht neben Rangliste oder Preisen – mit dem Satz „Die Kasse ist für alle – mit dem Tippspiel, der Rangliste und den Preisen hat sie nichts zu tun.“ **Verwaltung:** Tippspiel → „Stammtischkasse“ (Erklärkasten „Die Kasse ist für alle – nicht für den Tippsieger. Mitspielen bleibt kostenlos.“, Kassenstand, Einzahlung/Ausgabe eintragen, bearbeiten, löschen, Zweck, Schalter „Namen der Einzahler in der App zeigen“).

**JS-Client:** `TippAPI.features` (aus `status`), `TippAPI.setFeatures(obj)` (Demo: von der Verwaltung vorgegeben). Demo ohne Vorgabe: Schalter aus den Demo-Inhalten der Verwaltung (`localStorage hbs_demo_content`, wenn `hbs_demo_mode = 1`), sonst aus `cms/content.json`, sonst Standard. Demo-Aktionen und Fehler wie live; Demo-Seed: Preise für „Bundesliga 2026/27“, Kasse 85 € „für die Saisonabschluss-Feier“ (3 Einzahlungen). `PRAGMA user_version` = 4.
