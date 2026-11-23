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
```

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

**Demo-Modus** (für die Vorschau ohne PHP, localStorage-Key `hbs_tipp_demo`): implementiert ALLE Spieler- und Admin-Aktionen mit identischer Logik (Punkte, Sperren, Tendenz, Rangliste, Statistik). Seed relativ zum aktuellen Datum, damit die Demo immer lebendig wirkt:
- Wettbewerb „Demo-Turnier“ mit Bonusfrage „Wer gewinnt das Turnier?“, Nationalteams (Deutschland, Frankreich, Spanien, Italien, Niederlande, Portugal, England, Österreich, Schweiz, Belgien, Kroatien, Dänemark …), ~18 Spiele: einige vergangene mit Ergebnis, eines „läuft gerade“ (Anstoß vor 30 Min., gesperrt, ohne Ergebnis), mehrere kommende in den nächsten Tagen.
- 8–10 erfundene Stammgäste mit Spitznamen (z. B. „Kalle“, „Uschi_66“, „Theken-Toni“) und plausiblen Tipps, damit Rangliste und Tendenz gefüllt sind.
- Einladungscode `DEMO2026` (gültig). Demo-Login: Registrierung mit diesem Code, oder Nickname „Gast“ / Passwort „demo1234“.
- Admin-Aktionen im Demo-Modus brauchen keine Anmeldung.
