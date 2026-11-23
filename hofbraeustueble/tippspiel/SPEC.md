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
             bonus_points INT DEFAULT 10, created TEXT)
matches(id INTEGER PK, competition_id INT, round TEXT,   -- "Gruppe A · 1. Spieltag", "Achtelfinale", "12. Spieltag"
        kickoff TEXT,                           -- "YYYY-MM-DD HH:MM" Ortszeit Europe/Berlin
        home TEXT, away TEXT,
        home_goals INT NULL, away_goals INT NULL)   -- NULL = noch kein Ergebnis
players(id INTEGER PK, nickname TEXT UNIQUE COLLATE NOCASE, password_hash TEXT,
        email TEXT NULL, active INT DEFAULT 1, created TEXT, last_login TEXT NULL, invite_code TEXT)
invites(code TEXT PK, note TEXT, max_uses INT, uses INT DEFAULT 0, expires TEXT NULL, revoked INT DEFAULT 0, created TEXT)
tips(player_id INT, match_id INT, home_goals INT, away_goals INT, updated TEXT, PRIMARY KEY(player_id, match_id))
bonus_tips(player_id INT, competition_id INT, answer TEXT, updated TEXT, PRIMARY KEY(player_id, competition_id))
attempts(k TEXT PK, count INT, first INT, last INT, locked_until INT)   -- intern: Brute-Force-Zähler (nur Hash der IP)
```

IDs sind `AUTOINCREMENT` (werden nach dem Löschen nie wiederverwendet), Fremdschlüssel mit `ON DELETE CASCADE`, `PRAGMA user_version` = Schema-Version, WAL-Modus.

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
| `status` | GET | – | `{ api:"hbs-tipp", player: {id,nickname,email}\|null, csrf, settings:{points_exact,points_diff,points_tendency}, serverTime:"YYYY-MM-DD HH:MM:SS" }` |
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
| `admin_competition_save` POST | `{id?, name, active, sort, bonus_question, bonus_answer, bonus_points}` |
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

## JS-Client `tippspiel/js/tipp-client.js`

```js
await TippAPI.init({ base: '../cms/tipp-api.php', adminCsrf?: '...' })
  // prüft `status`; liefert kein gültiges JSON mit api:"hbs-tipp" → Demo-Modus
TippAPI.mode            // 'live' | 'demo'
await TippAPI.call(action, data?)   // GET-Aktionen: data als Query; POST: JSON-Body; wirft Error(message) bei ok:false
TippAPI.demoReset()     // Demo-Daten neu erzeugen
```

**Demo-Modus** (für die Vorschau ohne PHP, localStorage-Key `hbs_tipp_demo_v2`): implementiert ALLE Spieler- und Admin-Aktionen mit identischer Logik (Punkte, Sperren, Tendenz, Rangliste, Statistik). Seed relativ zum aktuellen Datum, damit die Demo immer lebendig wirkt:
- Zusätzlich Wettbewerb „Bundesliga 2026/27“ (Bonusfrage „Wer wird Deutscher Meister?“): 12. Spieltag (letztes Wochenende, mit Ergebnissen) und 13. Spieltag (nächstes Wochenende, Fr 20:30 / Sa 15:30 + 18:30 / So 15:30 + 17:30).
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
