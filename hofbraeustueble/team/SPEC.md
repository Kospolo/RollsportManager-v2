# Team & Dienstplan – Spezifikation (API-Vertrag)

Kleiner Dienstplan / Mitarbeiter-Kalender für ca. 5 Aushilfen (Minijob) und den Chef.
Oberfläche: `team/` (eine Seite, mobil zuerst, iPad mit Wochenraster). Backend: `cms/team-api.php`
(PHP 8 + PDO SQLite, Datenbank `cms/data/team.sqlite`, wird automatisch angelegt).
Client: `team/js/team-client.js` (`window.TeamAPI`, Live- und Demo-Modus mit derselben Schnittstelle).

## Rollen und Anmeldung

| Rolle | Wie | Session |
|---|---|---|
| Mitarbeiter | Name + Passwort (≥ 8 Zeichen), Konto nur per Einladung | Cookie `HBS_TEAM` (Pfad `/cms/`, 30 Tage gleitend, Ordner `cms/data/team-sessions`) |
| Chef | gültige **CMS-Anmeldung** (Verwaltung, Cookie `HBSCMS`) – wird genau wie in `tipp-api.php` gelesen und sofort wieder geschlossen | CSRF = CSRF-Token der Verwaltung (`status.chefCsrf`) |

Sind beide Sitzungen da, bietet die App einen Umschalter „Chef-Ansicht / Mitarbeiter-Ansicht“.

Sicherheit: nur Prepared Statements; strenge Prüfung aller Eingaben; POST nur als JSON (sonst 415),
max. 64 KB; Header `X-CSRF-Token` bei jedem POST (Mitarbeiter: Team-CSRF, `chef_*`: CMS-CSRF);
Origin-/`Sec-Fetch-Site`-Prüfung; Cookies `HttpOnly; SameSite=Strict`, `Secure` bei HTTPS
(auch hinter Proxy mit `X-Forwarded-Proto: https`). Passwort-Hashes mit `password_hash`.
Passwortänderung meldet andere Geräte ab (Stempel in der Session). Deaktivierte Konten sind sofort abgemeldet.

Brute-Force: Login 5 Fehlversuche je IP+Name bzw. 20 je IP in 15 Min. → 15 Min. Sperre (429, `Retry-After`);
falsche Einladungscodes 15 je IP; falsche Kalender-Tokens 30 je IP. Nachrichten: max. 30 je 10 Min.;
Bestellliste: max. 60 Einträge je 10 Min. Gespeichert wird nur ein Hash der IP (Tabelle `attempts`).

## Globaler Schalter (Website-Verwaltung)

`cms/content.json` → `features.team` (fehlt oder Datei unlesbar = **an**). Bei `false`:
alle Mitarbeiter-Aktionen (inkl. `register`, `login`, `invite_check`, `ical`) → **403**
`{"error":"Der Team-Bereich ist im Moment ausgeschaltet.","teamDisabled":true}`.
`status` (mit `enabled:false`), `logout` und alle `chef_*`-Aktionen funktionieren weiter.
Die App zeigt Mitarbeitern einen freundlichen Hinweis; der Chef sieht im Banner
„Team-Bereich ist für Mitarbeiter ausgeschaltet – einschalten im CMS unter Funktionen“.
Die API schreibt `content.json` nie.

## Module (Chef → Einstellungen)

`availability` (Verfügbarkeit), `swap` (Tauschen), `tasks` (Checklisten), `hours` (Stunden & Minijob),
`board` (Schwarzes Brett), `ical` (Kalender-Abo), `orders` (Bestellliste). Ausgeschaltet: verschwindet
aus der Mitarbeiter-App, die Daten fehlen in `staff_data`, Mitarbeiter-Aktionen → 403 `{module:"…"}`.
Weitere Einstellungen: `swap_needs_chef` (Standard an), `take_needs_ok` (Vorgabe für neue offene
Schichten, Standard aus), `minijob_limit` (Standard 603 € – „Stand bitte selbst prüfen“), `labels`
(Schicht-Bezeichnungen, Standard Theke/Aufbau/Putzen/Veranstaltung).

## Antworten

Immer JSON `{"ok":true,"api":"hbs-team",…}` bzw. `{"ok":false,"api":"hbs-team","error":"deutscher Text"}`
mit passendem HTTP-Status (400 Eingabe, 401 nicht angemeldet, 403 verboten/CSRF/Modul aus, 404, 405, 409 Konflikt,
415, 429). Ausnahme: `ical` liefert `text/calendar`.

Datum `YYYY-MM-DD`, Uhrzeit `HH:MM`, Zeitstempel `YYYY-MM-DD HH:MM:SS` (Europe/Berlin). Geld in Euro (Zahl).

### Schicht (Ausgabe)

```
{id, date, start, end, overnight, minutes, label, note, staff_id|null, staff_name|null ("ehem. Mitarbeiter"),
 former, status: "open"|"requested"|"none"|"yes"|"no", needs_ok, past, mine,
 // Mitarbeiter: requested_by_me; bei eigenen Schichten zusätzlich reason, conflicts (absence/overlap), tasks
 // Chef: reason, responded_at, series_id, requests[{staff_id,name,created}], conflicts[], swap, tasks{lists,done,total}}
```

`end <= start` bedeutet „über Mitternacht“ (Ende am Folgetag). `minutes` ist die echte Dauer
(Sommer-/Winterzeit berücksichtigt). Status: `open` offen, `requested` jemand hat angefragt,
`none` unbeantwortet, `yes` zugesagt, `no` abgesagt.

Konflikte (`conflicts[].type`): `overlap` (gleiche Person, Zeiten überschneiden sich – auch über Mitternacht),
`absence` (genehmigte Abwesenheit), `absence_pending`, `unavailable` („kann nicht“), `maybe`, `inactive`.
Konflikte sind Warnungen – gespeichert wird trotzdem (`chef_shift_save` liefert `warnings`).

## Aktionen

Öffentlich:

| Aktion | Methode | Daten | Ergebnis |
|---|---|---|---|
| `status` | GET | – | `me`, `csrf`, `chef`, `chefCsrf`, `settings`, `enabled`, `serverTime` |
| `invite_check` | GET | `code` | `valid`, `note` |
| `register` | POST | `code, name, password, phone?, phone_visible?` | wie `status` (angemeldet). Einladung einmalig; Name eindeutig (Groß/klein egal) |
| `login` | POST | `name, password` | wie `status` |
| `logout` | POST | – | – |
| `ical` | GET | `token=<id>-<64 hex>` | iCalendar-Feed |

Mitarbeiter (Session + CSRF):

| Aktion | Methode | Daten | Hinweis |
|---|---|---|---|
| `staff_data` | GET | `from?, to?` (Team-Woche, max. 62 Tage) | `me, settings, today, colleagues[{id,name,phone(nur bei Freigabe),me}], week[], my_shifts[], open_shifts[], absences[] (eigene), team_absences[{name,from,to}] (ohne Art/Notiz), availability{datum:wert}, swaps[], messages[], board[], hours[2 Monate]|null, orders{items,catalog}|null, unread{messages,board}` |
| `profile_save` | POST | `phone, phone_visible` | |
| `change_password` | POST | `old, new` | |
| `delete_account` | POST | `password` | löscht persönliche Daten (siehe Datenschutz) |
| `ical_reset` | POST | – | neuer Token, alter Link ungültig |
| `shift_respond` | POST | `id, answer: yes|no, reason?` | nur eigene, nicht vergangene Schichten |
| `shift_take` | POST | `id` | offene Schicht: `taken` (wer zuerst kommt) oder `requested` (bei `needs_ok`); 409 bei Überschneidung/Abwesenheit/schon vergeben |
| `take_cancel` | POST | `id` | eigene Anfrage zurückziehen |
| `absence_request` | POST | `from, to, type: urlaub|krank|sonstiges, note?` | |
| `absence_cancel` | POST | `id` | offen, abgelehnt oder genehmigt in der Zukunft |
| `availability_set` | POST | `days: {"YYYY-MM-DD": "yes"|"no"|"maybe"|""}` | heute bis +9 Wochen |
| `swap_offer` | POST | `shift_id, to_staff (0 = alle), note?` | |
| `swap_cancel` / `swap_accept` / `swap_reject` | POST | `id` | `swap_accept` → `waiting` (Chef bestätigt) oder `done` |
| `message_send` | POST | `body` (1–1000 Zeichen) | an den Chef |
| `message_read` | POST | – | Chef-Nachrichten als gelesen |
| `board_read` | POST | `id` | „gelesen“ am Schwarzen Brett |
| `check_tick` | POST | `shift_id, checklist_id, item_id, done` | nur eigene Schicht, ab 2 Std. vor Beginn bis 12 Std. nach Ende |
| `order_add` | POST | `catalog_id` **oder** `name, category: getraenke|kueche|putzmittel|sonstiges`; `qty?, note?` | steht es schon offen auf der Liste → `existing:true` |
| `order_remove` | POST | `id` | nur eigene, noch „fast leer“ |

Chef (CMS-Session + CMS-CSRF):

| Aktion | Methode | Daten |
|---|---|---|
| `chef_data` | GET | `from?, to?` → `settings, staff[] (mit Lohn, Grenze, Stunden des Monats, ungelesen), invites[], shifts[], absences[], availability{staff_id:{datum:wert}}, swaps[], takes[], declined[], threads[], board[] (mit reads/not_read), checklists[], orders, enabled, counts` |
| `chef_hours` | GET | `month=YYYY-MM` → je Person `minutes, minutes_unanswered, shifts, wage, earnings, earnings_with_unanswered, limit, limit_custom, over, over_with_unanswered` |
| `chef_thread` | GET | `staff_id` |
| `chef_message_send` / `chef_message_read` | POST | `staff_id, body` / `staff_id` |
| `chef_invite_create` / `chef_invite_revoke` | POST | `note?, expires?` / `code` |
| `chef_staff_update` | POST | `id, active?, wage? ("13,90", "" = keiner), limit? ("" = Standard)` |
| `chef_staff_reset` | POST | `id` → `temp_password` (nur einmal angezeigt) |
| `chef_staff_delete` | POST | `id` |
| `chef_shift_save` | POST | `id?, date, start, end, label, note, staff_id (0 = offen), needs_ok, confirmed, repeat_until? (nur neu: jede Woche bis …, max. 53)` → `ids, shifts, warnings` |
| `chef_shift_delete` | POST | `id, scope: one|following` |
| `chef_take_decide` | POST | `shift_id, staff_id, approve` |
| `chef_absence_decide` | POST | `id, approve, comment?` → `affected_shifts` |
| `chef_absence_delete` | POST | `id` |
| `chef_swap_decide` | POST | `id, approve` |
| `chef_board_post` / `chef_board_delete` | POST | `title?, body` / `id` |
| `chef_checklist_save` / `chef_checklist_delete` | POST | `id?, name, label ("" = alle Schichten), items[{id?,text}|text]` / `id` |
| `chef_settings_save` | POST | `modules{…}, swap_needs_chef, take_needs_ok, minijob_limit, labels[]` |
| `chef_order_add` | POST | wie `order_add` |
| `chef_order_status` | POST | `id, status: low|ordered|delivered` |
| `chef_order_delete` | POST | `id` |
| `chef_catalog_save` / `chef_catalog_delete` | POST | `id?, name, category, qty?` / `id` |

Regeln:
- Ändert der Chef Person oder Zeit einer Schicht, wird die Antwort zurückgesetzt („unbeantwortet“),
  laufende Tausch-Angebote werden beendet. „Ist schon abgesprochen“ (`confirmed`) setzt „zugesagt“.
- Tausch: Angebot an eine Person oder alle → Kollege nimmt an → (wenn `swap_needs_chef`) Chef bestätigt →
  Schicht wechselt (zugesagt). Überschneidungen/Abwesenheit des Übernehmenden werden abgelehnt.
- Stunden: zugesagte Schichten des Monats (Datum des Schichtbeginns), Verdienst = Minuten × Stundenlohn.
  Warnung `over`, wenn der geplante Verdienst die Grenze übersteigt. **Geplant, keine Lohnabrechnung.**

## Kalender-Abo (iCal)

`cms/team-api.php?action=ical&token=<id>-<64 hex>` (Token = 32 Zufallsbytes, Vergleich mit `hash_equals`).
Enthält: eigene Schichten mit Status „zugesagt“ oder „unbeantwortet“ (60 Tage zurück bis 400 Tage voraus,
`STATUS:CONFIRMED`/`TENTATIVE`, `VALARM` 2 Std. vorher) und genehmigte Abwesenheiten (ganztägig).
`VTIMEZONE` Europe/Berlin (Regeln: letzter Sonntag März 02:00 → CEST, letzter Sonntag Oktober 03:00 → CET),
CRLF, Zeilen auf 75 Oktette gefaltet. Die App zeigt einen `webcal://`-Knopf, „Link kopieren“ und Anleitungen.

## Datenschutz (Umsetzung)

- Gespeichert: Name (frei wählbar, z. B. Vorname), Passwort-Hash, freiwillig Telefon (+ Freigabe für Kollegen),
  Schichten/Antworten (+ freiwilliger Absage-Grund), Abwesenheiten (Art, Zeitraum, freiwillige Notiz),
  Verfügbarkeit, Nachrichten, Gelesen-Vermerke, Abhak-Vermerke, Bestell-Einträge; vom Chef: Stundenlohn, eigene Grenze.
- Kollegen sehen: Namen, Schichten, Status; Telefon nur mit Freigabe; bei Abwesenheit nur „nicht da“
  (nie Art/Notiz – „krank“ ist ein Gesundheitsdatum); nie Lohn, Grenze, Stunden, Absage-Gründe, Verfügbarkeit, Nachrichten.
- Lohn/Grenze/Stunden: nur Chef und die Person selbst.
- Konto löschen (selbst oder durch den Chef): Konto, Telefon, Nachrichten, Abwesenheiten, Verfügbarkeit,
  Tausch-Angebote, Übernahme-Anfragen, Gelesen-Vermerke werden gelöscht; Bestell-Einträge und Abhak-Vermerke
  verlieren den Namen; vergangene Schichten bleiben ohne Personenbezug als „ehem. Mitarbeiter“, kommende werden offen.
- Keine externen Anfragen (Schriften, Skripte, QR-Code lokal).

## Demo-Modus

Läuft automatisch, wenn `cms/team-api.php` nicht erreichbar ist (z. B. `python3 -m http.server`).
Daten im `localStorage` (`hbs_team_demo_v1`, nach 2 Tagen neu erzeugt), 5 erfundene Mitarbeiter
(Anja, Mehmet, Sabine, Jonas, Gerda – Passwort `demo1234`), Plan für diese und nächste Woche, offene Schichten,
Urlaubsantrag, Tausch-Angebot, Nachrichten, Aushänge, Checklisten, Bestellliste. Chef-Ansicht per `?chef=1`
oder Knopf „Als Chef“; `?teamaus=1` simuliert den ausgeschalteten Team-Bereich.
