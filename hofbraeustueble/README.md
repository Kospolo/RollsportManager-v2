# Hofbräustüble – Website mit eigener Verwaltung

Website für das **Hofbräustüble**, die gemütliche Raucherbar in Neckarsulm-Amorbach.
Die Inhaberin bzw. der Inhaber kann alle Inhalte selbst pflegen – ohne Programmierkenntnisse,
auch bequem vom Handy aus: Termine, Bilder, Öffnungszeiten, Sommer-/Außenbereich, Adresse,
Kontakt, Impressum und Datenschutz.

- **Drei Design-Entwürfe** (`variante-1/`, `variante-2/`, `variante-3/`) lesen alle dieselben Inhalte.
- **Mini-CMS** in PHP ohne Datenbank und ohne Zusatzsoftware – läuft auf üblichem Webhosting
  (IONOS, Strato, all-inkl, Hetzner Webhosting …) mit **PHP 8**.
- Keine externen Dienste: Schriften und Bilder liegen auf dem eigenen Server, kein Tracking,
  keine Cookies auf der öffentlichen Website (nur die Verwaltung setzt beim Anmelden ein Sitzungs-Cookie).

---

## Ordnerübersicht

```
hofbraeustueble/
├── index.html              Übersichtsseite der drei Entwürfe (später durch Weiterleitung ersetzen, s. u.)
├── variante-1/ … variante-3/   die drei Design-Varianten
├── admin/                  Verwaltung (Admin-Panel)  →  https://ihre-domain.de/admin/
│   ├── index.html
│   ├── admin.css
│   ├── admin.js
│   └── .htaccess           Sicherheits-Header, nicht von Google indexieren
├── assets/
│   ├── img/                mitgelieferte Fotos
│   ├── fonts/              selbst gehostete Schriften
│   └── js/cms-loader.js    lädt die Inhalte für alle Varianten
└── cms/
    ├── content.json        ALLE Inhalte der Website (wird von der Verwaltung geschrieben)
    ├── api.php             Schnittstelle der Verwaltung (Login, Speichern, Bilder-Upload …)
    ├── tipp-api.php        Schnittstelle des Tippspiels (siehe Abschnitt „Tippspiel“)
    ├── config.php          Passwort (nur als Hash) – nicht öffentlich abrufbar
    ├── .htaccess           sperrt alles außer api.php, tipp-api.php und content.json
    ├── .user.ini           PHP-Einstellungen (Upload-Größe), wo der Hoster das unterstützt
    ├── uploads/            hochgeladene Bilder (Skriptausführung abgeschaltet)
    ├── backups/            automatische Sicherungen (die letzten 20 Versionen)
    └── data/               Login-Sperre, Sitzungen, Tippspiel-Datenbank tippspiel.sqlite (intern)
```

---

## Lokal testen

Voraussetzung: PHP 8 ist installiert (`php -v`).

```bash
# im Ordner, der "hofbraeustueble" enthält:
php -S localhost:8080 -t hofbraeustueble
```

Dann im Browser öffnen:

- Website-Entwürfe: <http://localhost:8080/variante-1/> (bzw. `/variante-2/`, `/variante-3/`)
- Verwaltung: <http://localhost:8080/admin/>

Hinweise:

- Der eingebaute PHP-Server erlaubt standardmäßig nur Uploads bis 2 MB. Die Verwaltung verkleinert
  große Handyfotos zwar schon im Browser, für Tests mit großen Dateien aber besser so starten:
  `php -d upload_max_filesize=12M -d post_max_size=16M -S localhost:8080 -t hofbraeustueble`
- Der PHP-Testserver beachtet keine `.htaccess`-Dateien – die Zugriffssperren greifen erst auf dem
  echten Webserver (Apache).

### Demo-Modus (ohne PHP)

Wird die Seite von einem Server **ohne PHP** ausgeliefert (z. B. `python3 -m http.server`,
`npx http-server`, GitHub Pages), startet die Verwaltung automatisch im **Demo-Modus**:

- gelber Hinweis „Demo-Modus – Änderungen werden nur in diesem Browser gespeichert“, kein Login
- Inhalte werden im Browser gespeichert (`localStorage`: `hbs_demo_content`, `hbs_demo_mode = "1"`);
  die Design-Varianten zeigen diese Änderungen dann **nur in diesem Browser** an
- hochgeladene Bilder werden verkleinert direkt eingebettet
- unter **Einstellungen**: „JSON exportieren“ und „Demo zurücksetzen“

Sobald die Verwaltung mit echtem PHP-Server läuft, wird der Demo-Schalter automatisch entfernt.

---

## Veröffentlichen (Upload per FTP)

1. Beim Hoster ein Webhosting-Paket mit **PHP 8.0 oder neuer** wählen (im Kundenmenü meist unter
   „PHP-Version“ einstellbar). Eine Datenbank wird nicht benötigt.
2. Mit einem FTP-Programm (z. B. **FileZilla**) die Zugangsdaten des Hosters verwenden
   (Server, Benutzer, Passwort – bei vielen Hostern **SFTP** empfohlen).
3. Den **Inhalt** des Ordners `hofbraeustueble/` in das Hauptverzeichnis der Domain hochladen
   (oft `/`, `htdocs/` oder `public_html/`). **Wichtig:** Auch die versteckten Dateien
   `.htaccess` und `.user.ini` mit hochladen (in FileZilla: *Server → Anzeigen versteckter Dateien erzwingen*).
4. **Schreibrechte** setzen (Rechtsklick → *Dateiberechtigungen*), falls der Hoster das nicht
   automatisch erlaubt:

   | Ordner / Datei      | Rechte | Wozu                                   |
   |---------------------|--------|----------------------------------------|
   | `cms/`              | 755    | `content.json` und `config.php` werden neu geschrieben |
   | `cms/uploads/`      | 755    | hochgeladene Bilder                     |
   | `cms/backups/`      | 755    | automatische Sicherungen                |
   | `cms/data/`         | 755    | Login-Sperre, Sitzungen                 |
   | `cms/content.json`, `cms/config.php` | 644 | |

   Falls das Speichern trotzdem mit „nicht beschreibbar“ scheitert, beim Hoster nachfragen bzw.
   testweise **775** verwenden (777 nur als letzte Notlösung).
5. `https://ihre-domain.de/admin/` aufrufen, anmelden und **sofort das Passwort ändern**.
6. Prüfen, dass die Sperren greifen – diese Adressen müssen **„403 Forbidden“** liefern:
   `https://ihre-domain.de/cms/config.php`, `https://ihre-domain.de/cms/backups/`,
   `https://ihre-domain.de/cms/data/`.
7. SSL/HTTPS im Kundenmenü des Hosters aktivieren (bei allen genannten Hostern kostenlos).

Hinweis für **nginx**-Server (selten bei Shared Hosting): `.htaccess` wird dort ignoriert. Dann
den Zugriff auf `cms/config.php`, `cms/backups/`, `cms/data/` und `.user.ini` in der
Server-Konfiguration sperren und PHP in `cms/uploads/` deaktivieren.

---

## Passwort

**Start-Passwort:** `Hofbraeu2026!`

- Nach der ersten Anmeldung zeigt die Verwaltung einen deutlichen Hinweis, das Passwort zu ändern.
- Ändern unter **Verwaltung → Einstellungen → Passwort ändern** (mindestens 10 Zeichen).
- Gespeichert wird nur ein sicherer Hash (`password_hash`) in `cms/config.php`, niemals das Passwort selbst.
- Schutz gegen Ausprobieren: nach **5 Fehlversuchen** wird der Login für **15 Minuten** gesperrt
  (pro IP-Adresse; gespeichert wird nur ein Hash der IP).

**Passwort vergessen?** Die Datei `cms/config.php` per FTP durch die Originaldatei aus diesem
Paket ersetzen – dann gilt wieder das Start-Passwort `Hofbraeu2026!` (anschließend gleich wieder ändern).
Alternativ einen neuen Hash erzeugen: `php -r "echo password_hash('NeuesPasswort', PASSWORD_DEFAULT);"`
und in `config.php` bei `password_hash` eintragen.

---

## Bedienung der Verwaltung (Kurzüberblick)

| Bereich              | Was man dort macht |
|----------------------|--------------------|
| **Termine**          | Neue Veranstaltungen anlegen, bearbeiten, duplizieren (z. B. wöchentlicher Stammtisch), löschen. Vergangene Termine sind grau unter „Vergangene Termine“ eingeklappt. |
| **Tippspiel**        | Ergebnisse eintragen, Spiele & Wettbewerbe, Einladungen (Link, WhatsApp, QR-Code), Spieler, Punkte-Regeln, Website-Teaser – siehe Abschnitt „Tippspiel“. Wird pro Aktion **sofort** gespeichert (außer „Website-Teaser“). |
| **Bilder**           | Fotos hochladen (auch mehrere), Bildunterschrift, Reihenfolge mit Pfeilen, löschen. |
| **Startseite**       | Hinweis-Banner an/aus, Titelbild und Überschriften, „Über uns“ mit vier Highlights, Name/Beschreibung für Google. |
| **Öffnungszeiten**   | Pro Tag: geöffnet (von – bis), Ruhetag oder eigener Text; zusätzlicher Hinweis. |
| **Sommer**           | Außenbereich ein-/ausblenden, Text, Saison, Bild. |
| **Kontakt & Adresse**| Adresse, Telefon, E-Mail, Google-Maps-Link (per Knopfdruck aus der Adresse erzeugen), Facebook/Instagram. |
| **Impressum / Datenschutz** | Pflichttexte; noch vorhandene Platzhalter `[ … ]` werden rot markiert. |
| **Einstellungen**    | Passwort ändern, Inhalte als JSON sichern/importieren, frühere Versionen wiederherstellen. |

Änderungen werden erst mit **„Speichern“** (oben rechts) auf der Website sichtbar. Ein roter Punkt
am Knopf zeigt ungespeicherte Änderungen; beim Verlassen der Seite erscheint eine Warnung.
Bilder werden beim Hochladen automatisch auf max. 1920 px verkleinert, gedreht (Handyfotos) und von
Metadaten wie GPS-Position befreit.

---

## Welche Variante wird die Startseite?

Aktuell zeigt `index.html` im Hauptverzeichnis eine Übersicht der drei Entwürfe. Nach der
Entscheidung (Beispiel: Variante 2) gibt es zwei einfache Wege:

**A) Weiterleitung per `index.html` (funktioniert überall)** – Inhalt von `index.html` ersetzen durch:

```html
<!doctype html>
<html lang="de"><head><meta charset="utf-8">
<title>Hofbräustüble</title>
<meta http-equiv="refresh" content="0; url=variante-2/">
<link rel="canonical" href="variante-2/">
</head><body><a href="variante-2/">Weiter zum Hofbräustüble</a></body></html>
```

**B) Weiterleitung per `.htaccess` (Apache, etwas sauberer für Google)** – im Hauptverzeichnis eine
Datei `.htaccess` anlegen bzw. ergänzen:

```apache
RedirectMatch 301 ^/$ /variante-2/
RedirectMatch 301 ^/index\.html$ /variante-2/
```

Die Dateien einer Variante bitte **nicht** einfach ins Hauptverzeichnis kopieren – sie verweisen
relativ auf `../assets/` und `../cms/`. Nicht benötigte Varianten können anschließend gelöscht
werden (dann auch die Vorschau-Links in der Verwaltung ignorieren).

---

## Technische Details (für Entwickler)

`cms/api.php` – alle Antworten JSON:

| Aufruf | Zweck |
|--------|-------|
| `GET  api.php?action=get` | Inhalt (`content.json`) |
| `GET  api.php?action=status` | `{ok, api:"hbs-cms", loggedIn, csrf, mustChangePassword, maxUploadBytes, gd}` |
| `POST api.php?action=login` | Feld `password` (Formular oder JSON) → Session-Cookie `HBSCMS` (HttpOnly, SameSite=Strict, Secure bei HTTPS) + CSRF-Token |
| `POST api.php?action=save` | Header `X-CSRF-Token`; JSON `{"content": {...}}`. Prüft Struktur, Datentypen, Längen, Datum `JJJJ-MM-TT`, Uhrzeit `HH:MM` (oder leer), E-Mail/Links, Bildpfade (nur `assets/img/…` oder `cms/uploads/…`, Datei muss existieren). Setzt `meta.lastUpdated`, sichert die vorige Version nach `cms/backups/`, schreibt atomar. |
| `POST api.php?action=upload` | Header `X-CSRF-Token`; Feld `file`. Nur JPG/PNG/WebP (finfo + getimagesize), max. 10 MB, Zufallsname; mit GD: EXIF-Drehung, Verkleinerung auf 1920 px, Neukodierung (JPG bzw. PNG bei PNG-Quellen). Antwort `{path:"cms/uploads/….jpg"}` |
| `POST api.php?action=password` | Felder `current`, `new` |
| `POST api.php?action=logout` | Abmelden |
| `GET  api.php?action=images` / `backups` / `backup&name=…` | nur angemeldet: Bildliste, Sicherungsliste, Inhalt einer Sicherung |

Das Inhaltsschema ist durch `cms/content.json` festgelegt. Unbekannte Bereiche auf oberster Ebene
werden abgelehnt; zusätzliche einfache Felder (Text/Zahl/Ja-Nein) innerhalb bestehender Bereiche
bleiben beim Speichern erhalten.

---

## ⚠️ Vor dem Livegang

- **Impressum und Datenschutzerklärung** enthalten Platzhalter (`[Vorname Nachname …]`,
  `Musterstraße 1`, Telefonnummer, Hosting-Anbieter). Diese müssen vollständig ausgefüllt und
  **rechtlich geprüft** werden (z. B. durch IHK, DEHOGA oder eine Anwältin/einen Anwalt).
  Die mitgelieferten Texte sind nur Vorlagen und keine Rechtsberatung.
- Adresse, Telefonnummer, E-Mail und Google-Maps-Link unter „Kontakt & Adresse“ prüfen.
- Start-Passwort ändern.

---

## Tippspiel

Kostenloses Tippspiel für Stammgäste – **ohne Geld und ohne Einsätze**, nur Punkte und eine Rangliste.
Mitmachen kann nur, wer eine **Einladung** hat.

**So funktioniert's**

- Gäste registrieren sich mit Einladungscode, Nickname und Passwort (E-Mail freiwillig) und tippen bis zum Anstoß.
  Punkte: exaktes Ergebnis 4, richtige Tordifferenz 3, richtige Tendenz 2 (in der Verwaltung änderbar).
  Fremde Tipps und die „Community-Quote“ sind erst nach dem Anstoß sichtbar.

**Bedienung in der Verwaltung (Reiter „Tippspiel“)**

Wichtig: Alles im Tippspiel wird **sofort beim Klick gespeichert** (grüner Hinweis oben im Reiter) – der
Knopf „Speichern“ oben rechts ist dafür nicht nötig. Einzige Ausnahme ist „Website-Teaser“ (gelber Hinweis):
Das sind Texte der Website, die wie alle anderen Inhalte erst mit „Speichern“ veröffentlicht werden.

| Unterbereich | Was man dort macht |
|---|---|
| **Übersicht** | Anzahl Spieler, Tipps, kommende Spiele, gültige Einladungen; „3 Spiele warten auf ein Ergebnis“ mit Direktlink; Rangliste der Gesamtwertung (Top 5, „Alle anzeigen“ klappt die ganze Tabelle auf); Karte **„Tippspiel als Wirt ansehen“**. Karte **„Automatischer Abruf“**: Stand je Wettbewerb mit „Jetzt abrufen“, die Cronjob-Adresse (Kopieren-Knopf, Kurzanleitung, „Token neu erzeugen“). |
| **Ergebnisse eintragen** | Der wichtigste Bildschirm für den Spieltag: Angepfiffene Spiele ohne Ergebnis stehen oben. Tore mit den großen **−/+**-Knöpfen oder per Zahl eingeben, „Ergebnis speichern“ – fertig, die Punkte rechnet das Tippspiel selbst. Bereits eingetragene Ergebnisse lassen sich ändern oder löschen. Ein Ergebnis geht erst ab Anstoß. Bei Wettbewerben mit automatischem Abruf steht an jedem Ergebnis **„automatisch“** oder **„von Hand“**; offene Spiele sind mit „kommt automatisch“ markiert. |
| **Spiele & Wettbewerbe** | Wettbewerbe anlegen/bearbeiten/löschen (Name, aktiv/Archiv, Reihenfolge, **Spielplan automatisch abrufen** – siehe unten, Bonusfrage z. B. „Wer wird Deutscher Meister?“, die richtige Antwort erst nach Turnierende eintragen, Bonuspunkte). Spiele einzeln anlegen (Datum, Uhrzeit, Runde, Heim, Gast) oder unter „Viele Spiele auf einmal einfügen“ als Liste, eine Zeile pro Spiel: `2027-01-16 15:30; TSG Hoffenheim; Borussia Dortmund; 17. Spieltag` (Runde optional, auch Tabulator/Excel oder `16.01.2027 15:30`). Funktioniert genauso für Bundesliga, Champions League, EM oder WM. Fehlerhafte Zeilen werden mit Zeilennummer gemeldet und bleiben zum Korrigieren im Feld stehen. |
| **Einladungen** | Neue Einladung: Notiz, Anzahl Personen („1 Person“ = persönlich, „Thekenaushang 50“ = für viele), optional „Gültig bis“. Je Einladung: **Link kopieren**, **Per WhatsApp teilen** (öffnet WhatsApp mit fertigem Text), **QR-Code** (als PNG/SVG speichern oder als Aushang drucken: großer QR-Code + „Stüble-Tippspiel – scannen & mitmachen“ + Code) und **Zurückziehen**. Einladungslink: `https://ihre-domain.de/tippspiel/?code=XXXXXXXX`. |
| **Spieler** | Liste mit E-Mail, Registrierung, letztem Login, Tipps und Punkten. Deaktivieren/Aktivieren (deaktivierte Spieler können sich nicht anmelden und fehlen in der Rangliste), **Neues Passwort** (Passwort vergessen: das angezeigte vorläufige Passwort wird nur einmal gezeigt – dem Gast persönlich geben), Löschen (mit allen Tipps). |
| **Punkte-Regeln** | Punkte für exakt / Tordifferenz / Tendenz (exakt ≥ Differenz ≥ Tendenz) mit Live-Beispiel. Gilt sofort auch rückwirkend für die Rangliste. |
| **Website-Teaser** | Abschnitt „Tippspiel“ auf der Website ein-/ausblenden, Überschrift, Text, Knopftext, Hinweis – danach „Speichern“. |

**Wirt-Ansicht (ansehen ohne mitzuspielen):** Der Knopf **„Tippspiel ansehen (Wirt-Ansicht)“** (oben im Reiter
„Tippspiel“ und in der Übersicht) öffnet das Tippspiel in einem neuen Tab – ganz ohne Spielerkonto, solange man in
der Verwaltung angemeldet ist. Dort sieht der Wirt alle Spiele mit der Stammtisch-Quote (auch schon vor dem
Anstoß), per Tipp auf ein Spiel, wer was getippt hat und wer noch fehlt, die Rangliste (Name antippen = alle Tipps
dieses Spielers, auch die offenen) und eine Stammtisch-Statistik (Trefferquote, Punkte-Schnitt, häufigster Tipp,
Rundensieger). Getippt wird in der Wirt-Ansicht nicht – das lässt der Server gar nicht zu. Wer zusätzlich als
Spieler mitspielt, kann oben im Tippspiel zwischen „Als Wirt ansehen“ und „Als Spieler“ wechseln. Auf der
Anmeldeseite des Tippspiels führt „Als Wirt ansehen“ zur Verwaltung. Demo: `tippspiel/?wirt=1`.

Alle Löschungen fragen vorher nach. Im Demo-Modus der Verwaltung (ohne PHP) läuft der Tippspiel-Reiter mit
erfundenen Beispieldaten; „Demo-Tippspiel zurücksetzen“ in der Übersicht stellt sie wieder her.

**Spielplan & Ergebnisse automatisch (OpenLigaDB)**

Für 1. Bundesliga, 2. Bundesliga, DFB-Pokal und Champions League muss niemand mehr Spiele oder Ergebnisse
eintippen. Die Daten kommen kostenlos und ohne Anmeldung von **OpenLigaDB** (openligadb.de).

1. „Spiele & Wettbewerbe“ → Wettbewerb anlegen oder bearbeiten → Bereich **„Spielplan automatisch abrufen
   (OpenLigaDB)“** einschalten.
2. Wettbewerb wählen (1. Bundesliga / 2. Bundesliga / DFB-Pokal / Champions League oder „Eigenes Kürzel“, z. B.
   `bl3` für die 3. Liga) und die Saison (vorausgewählt ist die laufende, z. B. „2026/27“). Ist der Name leer,
   wird er vorgeschlagen („Bundesliga 2026/27“).
3. **„Vorschau“** zeigt, was OpenLigaDB kennt (Anzahl Spiele, Spieltage, die nächsten Partien) – so sieht man
   vor dem Speichern, ob Kürzel und Saison stimmen.
4. **„Jetzt abrufen“** legt alle Spiele der nächsten 14 Tage an (Zeitraum einstellbar, 1–90 Tage) und holt
   fehlende Ergebnisse. **„Ganze Saison importieren“** legt alle Spiele der Saison auf einmal an – bereits
   gespielte mit Ergebnis. Doppelte Spiele gibt es nicht: Jedes Spiel wird über seine OpenLigaDB-Nummer erkannt
   (ein vorher von Hand angelegtes, identisches Spiel – gleicher Anstoß, gleiche Namen – wird übernommen).

Danach läuft alles von selbst:

- **Anstoßzeiten, Mannschaften, Runde** werden bei jedem Abruf aktualisiert, solange das Spiel noch nicht
  angepfiffen ist. Ein bereits angepfiffenes Spiel wird nie verschoben (wie beim Bearbeiten von Hand); wurde es
  laut OpenLigaDB verlegt, erscheint ein Hinweis zum Ändern von Hand. Änderungen von Hand an noch nicht
  angepfiffenen, automatisch abgerufenen Spielen werden beim nächsten Abruf wieder überschrieben.
- **Ergebnisse** kommen von selbst: Öffnet jemand das Tippspiel und ein Spiel ist seit knapp 2 Stunden
  (110 Min.) angepfiffen und hat noch kein Ergebnis, holt das Tippspiel nebenbei die Ergebnisse dieses Spieltags
  (höchstens alle 10 Minuten, kurzes Zeitlimit von 5 Sekunden – klappt es nicht, merkt der Spieler nichts davon,
  der Fehler steht dann in der Verwaltung beim Wettbewerb). Zusätzlich kann der Webhoster per **Cronjob**
  regelmäßig abrufen (siehe unten).
- **Es zählt das Ergebnis nach 90 Minuten** (OpenLigaDB „Endergebnis“) – Verlängerung und Elfmeterschießen im
  Pokal zählen nicht, das ist die übliche Tippspiel-Regel. Übernommen wird ein Ergebnis erst, wenn OpenLigaDB das
  Spiel als beendet markiert (Zwischenstände während des Spiels nie); fehlt diese Markierung, erst 4 Stunden
  nach Anstoß.
- **Von Hand hat Vorrang:** Ein in „Ergebnisse eintragen“ selbst eingetragenes oder geändertes Ergebnis
  („von Hand“) wird vom Abruf **nie überschrieben**. Wird es gelöscht, darf der nächste Abruf es wieder
  automatisch eintragen.
- Andere Ligen bei OpenLigaDB werden von Freiwilligen angelegt und gepflegt – Qualität unterschiedlich, daher
  vorher die Vorschau ansehen. *Daten: OpenLigaDB (openligadb.de), Community-gepflegt, ohne Gewähr.* In der
  Spieler-App steht dann unter den Spielen „Spielplan & Ergebnisse: OpenLigaDB“.

**Vereinslogos (datenschutzfreundlich)**

Bei Spielen von OpenLigaDB zeigt das Tippspiel kleine Vereinswappen neben den Mannschaften (sonst bzw. wenn ein
Logo fehlt: farbiges Kürzel wie bisher). OpenLigaDB nennt zu jeder Mannschaft eine Bild-Adresse (Wikimedia, imgur,
UEFA …). **Der Server lädt jedes Logo genau einmal selbst herunter**, rechnet es klein (PNG, höchstens 128 px)
und liefert es aus `cms/uploads/logos/` aus – **die Browser der Gäste laden nichts von fremden Seiten**, es werden
also keine IP-Adressen an Dritte übertragen (DSGVO). Eine Ergänzung der Datenschutzerklärung ist dafür nicht nötig;
wer mag, kann im Abschnitt zur Hosting-/Server-Technik erwähnen, dass der Server Vereinslogos einmalig von
öffentlichen Quellen abruft (dabei werden keine Daten der Besucher übermittelt).

- In „Tippspiel → Übersicht → Vereinslogos“: Schalter **„Vereinslogos anzeigen“** (Standard: an), Stand
  („Logos: 120 geladen, 3 fehlgeschlagen“, mit Grund je Logo) und **„Logos neu laden“** (fehlgeschlagene erneut
  versuchen) bzw. „Alle neu laden“. Vereinslogos sind Marken der Vereine – bei Bedenken einfach ausschalten,
  dann stehen im Tippspiel nur Kürzel und es werden keine Logos mehr geladen.
- Geladen wird nach jedem Abruf in der Verwaltung, beim Cronjob und (höchstens 2 Stück, höchstens 3 Sekunden)
  nebenbei beim Öffnen des Tippspiels – je Durchlauf höchstens 25 Logos mit 5 Sekunden Zeitlimit. Fehlgeschlagene
  werden frühestens nach 24 Stunden erneut versucht, nach 5 Versuchen nicht mehr (bis „Logos neu laden“).
  Wikimedia bremst manchmal mit „bitte Pause“ (Fehler 429) – diese Logos holt der nächste Durchlauf nach.
- Sicherheit (die Adressen sind Community-Daten und werden wie feindliche Eingaben behandelt): nur `https`
  (`http` nur bei img.uefa.com und upload.wikimedia.org, dann automatisch als `https`), nur Port 443, keine
  IP-Adressen; der Servername wird aufgelöst und Adressen im eigenen Netz (z. B. 192.168.x.x, 127.0.0.1,
  169.254.169.254) werden abgelehnt, die Verbindung geht dann fest an die geprüfte Adresse. Weiterleitungen
  werden einzeln geprüft (höchstens 2), höchstens 2 MB, nur PNG/JPEG/GIF/WebP (Inhalt wird geprüft, nicht der
  Dateiname). **SVG wird nie gespeichert**: SVG-Logos von Wikimedia werden als fertige PNG-Vorschau von
  Wikimedia geholt, SVG von anderen Seiten übersprungen. Mit der PHP-Erweiterung GD (bei den üblichen Hostern
  vorhanden) wird jedes Bild neu als PNG gerechnet – das entfernt auch versteckte Inhalte.
- Ist auf dem Server ein HTTPS-Proxy eingestellt (Umgebungsvariable `https_proxy`) und der Name lokal nicht
  auflösbar, löst der Proxy auf. In der Docker-Vorschau liegen die Logos im Volume (`uploads/logos/`) und
  überstehen Updates; der `.htaccess`-Schutz von `cms/uploads/` gilt auch für den Unterordner.

**Cronjob einrichten (empfohlen, alle 15 Minuten)**

In „Tippspiel → Übersicht → Automatischer Abruf“ steht die geheime Adresse, z. B.
`https://ihre-domain.de/cms/tipp-api.php?action=cron_sync&token=…` (Knopf „Kopieren“). Diese Adresse im
Kundenmenü des Webhosters als Cronjob eintragen, der sie **alle 15 Minuten** aufruft – z. B. IONOS: Hosting →
Cronjobs; Strato: Einstellungen → Cronjob-Verwaltung; all-inkl: KAS → Tools → Cronjobs (Menünamen je nach
Tarif). Kann man nur einen Befehl eintragen: `curl -s "ADRESSE" > /dev/null`. Ohne Cronjob im Tarif geht auch ein
kostenloser Dienst wie cron-job.org. Der Aufruf holt für jeden aktiven Wettbewerb mit Abruf neue Spiele (Zeitraum
wie eingestellt), Zeitänderungen und Ergebnisse und antwortet mit einer kurzen Zusammenfassung (JSON).
Der Token wird beim ersten Öffnen erzeugt und liegt in `cms/data/tipp-cron-token.php` (nicht in `content.json`);
„Token neu erzeugen“ macht die alte Adresse ungültig. Falsche Tokens werden nach 10 Versuchen je IP für
15 Minuten gesperrt.

**Technik**

- Schnittstelle: `cms/tipp-api.php` (Beschreibung aller Aktionen in `tippspiel/SPEC.md`), App: `tippspiel/`.
  Verwaltung: Reiter in `admin/` (nutzt `tippspiel/js/tipp-client.js`). QR-Codes werden lokal im Browser erzeugt
  mit `assets/vendor/qrcode-generator.js` (npm-Paket `qrcode-generator` 2.0.4, MIT, Lizenz in
  `assets/vendor/qrcode-generator-LICENSE.txt`) – keine externen Dienste.
- Daten: **`cms/data/tippspiel.sqlite`** (SQLite-Datei, wird beim ersten Aufruf automatisch angelegt;
  daneben können kurzzeitig `tippspiel.sqlite-wal` und `-shm` liegen). Anmeldungen der Spieler liegen in
  `cms/data/tipp-sessions/`, der Cronjob-Token in `cms/data/tipp-cron-token.php`, dazu die Sperrdatei
  `cms/data/tipp-sync.lock` (verhindert gleichzeitige Abrufe) bzw. `cms/data/tipp-logos.lock`. Vereinslogos liegen
  in `cms/uploads/logos/` (nicht im Git, jederzeit löschbar – sie werden dann neu geladen). Der Ordner `cms/data/` ist per `.htaccess`
  gesperrt und nicht im Git. Bestehende Datenbanken werden beim ersten Aufruf automatisch ergänzt
  (neue Spalten, vorhandene Ergebnisse gelten als „von Hand“).
- **Sicherung:** einfach `cms/data/tippspiel.sqlite` per FTP herunterladen (am besten, wenn gerade niemand
  tippt). Wiederherstellen: Datei zurückkopieren (vorhandene `-wal`/`-shm`-Dateien vorher löschen).
- Voraussetzung: PHP 8 mit der Erweiterung **pdo_sqlite** – bei IONOS, Strato, all-inkl & Co.
  standardmäßig aktiv. Fehlt sie, meldet das Tippspiel das deutlich („Das Tippspiel braucht die
  PHP-Erweiterung pdo_sqlite“). Eine MySQL-Datenbank wird nicht benötigt.
- Ohne PHP (z. B. lokale Vorschau mit `python3 -m http.server`) läuft das Tippspiel im **Demo-Modus** mit
  erfundenen Stammgästen; Anmeldung mit „Gast“ / „demo1234“ oder Registrierung mit Code `DEMO2026`.
  Die Demo-Daten liegen nur im Browser (`localStorage`: `hbs_tipp_demo_v3`). Der automatische Abruf wird in der
  Demo nur simuliert (keine Verbindung zu OpenLigaDB; Vorschau mit Beispieldaten für bl1/bl2/dfb/ucl);
  Vereinslogos gibt es in der Demo nicht (Kürzel).
- Automatischer Abruf: Anfragen gehen nur an `https://api.openligadb.de` (fest eingestellt; Liga-Kürzel und
  Saison werden streng geprüft, nie eine frei eingegebene Adresse). Der Server braucht dafür die PHP-Erweiterung
  **curl** oder `allow_url_fopen` (Standard bei den üblichen Hostern), Zeitlimit 8 Sekunden (Verwaltung/Cronjob)
  bzw. 5 Sekunden (nebenbei), User-Agent `HBS-Tippspiel/1.0`. Für Tests lässt sich serverseitig per Konstante
  oder Umgebungsvariable `HBS_OLDB_BASE` ein lokaler Ersatz-Server einstellen, z. B.
  `HBS_OLDB_BASE=http://127.0.0.1:8091 php -S 127.0.0.1:8090 -t hofbraeustueble`.
- Schutz: Admin-Aktionen nur mit angemeldeter Verwaltung, Sperre nach mehreren falschen Anmeldungen,
  Tippschluss wird auf dem Server geprüft (Zeitzone Europe/Berlin).
- Wichtig: Das Tippspiel ist ein reines Spaß-Spiel. Keine Einsätze oder Geldpreise ausloben –
  Sportwetten mit Einsatz sind ohne Lizenz verboten.

**Schalter, Preise und Stammtischkasse (Verwaltung → „Funktionen“)**

- **Tippspiel aus:** Gäste sehen „Das Tippspiel macht gerade Pause“ und können sich nicht anmelden oder tippen
  (Server antwortet 403). Spieler, Tipps und Punkte bleiben gespeichert; der Wirt pflegt alles weiter und kann die
  Wirt-Ansicht öffnen, der automatische Abruf läuft weiter. Im Reiter „Tippspiel“ steht dann ein gelber Hinweis.
- **Preise im Tippspiel:** je Wettbewerb optional Preise für Platz 1–3 (freier Text, z. B. „50-€-Gutschein“) und ein
  Hinweis – im Wettbewerb-Dialog unter „Preise für die Besten“. Die App zeigt sie über der Rangliste („Um diese Preise
  wird gespielt“) und als Zeile auf der Tipp-Seite, immer mit „Spendiert vom Hofbräustüble, mitspielen bleibt
  kostenlos“. Preise spendiert das Haus – nie aus Einsätzen der Spieler.
- **Stammtischkasse:** Tippspiel → „Stammtischkasse“: Einzahlungen (Name frei oder Spieler auswählen, Betrag, Datum,
  Notiz) und Ausgaben (wofür, Betrag, Datum, Notiz), Kassenstand, Zweck („für die Saisonabschluss-Feier“) und der
  Schalter „Namen der Einzahler in der App zeigen“ (Standard aus; Beträge sieht in der App niemand). Die Kasse ist
  für alle – **nicht für den Tippsieger**: Sie hat mit Tipps, Rangliste und Preisen nichts zu tun, es gibt keine
  Auszahlung an Gewinner, und Mitspielen bleibt kostenlos (sonst wäre es ein verbotenes Glücksspiel).
  Gespeichert in `cms/data/tippspiel.sqlite` (Tabelle `kasse`, Beträge in Cent).
- Der Unterbereich „Website-Teaser“ heißt jetzt „Hinweis auf der Website“; technische Dinge (regelmäßiger Abruf
  beim Hoster, Reihenfolge, Zeitraum) stehen zugeklappt unter „Für den Techniker“.

## Team / Dienstplan

Kleiner Dienstplan für die Aushilfen und den Chef unter **`https://ihre-domain.de/team/`** – nicht öffentlich,
nur mit Einladung. Große Schrift, große Knöpfe, „du“-Ansprache, funktioniert am Handy und am iPad.
Technik: `team/` (App), `cms/team-api.php` (Schnittstelle), Datenbank `cms/data/team.sqlite` (wird automatisch
angelegt, braucht wie das Tippspiel `pdo_sqlite`). Vertrag und alle Regeln: `team/SPEC.md`.

**Für die Mitarbeiter** (Reiter unten): **Start** (nächste Schicht groß, „Bitte antworten“, offene Schichten,
neue Nachrichten, Aufgaben der laufenden Schicht zum Abhaken), **Plan** (meine Schichten mit Zusagen/Absagen/Tauschen,
Team-Woche, offene Schichten „Übernehmen“), **Frei** (Urlaub/krank/sonstiges beantragen, „Wann kann ich?“ für die
nächsten 8 Wochen antippen), **Chat** (Nachrichten mit dem Chef, Schwarzes Brett mit „Gelesen“), **Ich**
(geplante Stunden, Schichten in den Handy-Kalender übernehmen, Telefonnummer, Passwort, Abmelden, Konto löschen).
Über „Start → Bestellliste“ meldet man mit einem Tipp, was fast leer ist.

**Für den Chef:** In der Verwaltung anmelden, dann `…/team/` öffnen – es erscheint die **Chef-Ansicht**
(gelbes Band). Reiter: **Plan** (Woche/Monat, „Schicht anlegen“ mit Wiederholung „jede Woche bis …“, Schichten
über Mitternacht, Farben + Text für zugesagt/unbeantwortet/abgesagt/offen/angefragt, Warnungen bei Überschneidung,
Urlaub oder „kann nicht“), **Team** (Einladung mit Link und QR-Code, Stundenlohn, Monatsgrenze, Deaktivieren,
neues Passwort, Löschen; Übersicht „Stunden & Minijob“ – geplant, keine Lohnabrechnung), **Anfragen**
(Urlaub genehmigen/ablehnen, Tausch bestätigen, Übernahme-Anfragen, abgesagte Schichten neu besetzen, Bestellliste
„bestellt“/„geliefert“), **Nachrichten** (einzeln + Schwarzes Brett mit „wer hat gelesen“), **Einstellungen**
(Funktionen einzeln an/aus: Verfügbarkeit, Tauschen, Checklisten, Stunden, Schwarzes Brett, Kalender-Abo,
Bestellliste; Tausch nur mit Bestätigung; Minijob-Grenze – Standard 603 €, Stand bitte selbst prüfen;
Schicht-Bezeichnungen; Checklisten; Bestell-Artikel). Hat der Chef zusätzlich ein Mitarbeiterkonto, wechselt
oben ein Knopf zwischen beiden Ansichten.

**Ganz ausschalten:** `cms/content.json` → `"features": { "team": false }` (in der Verwaltung unter „Funktionen“).
Dann sehen Mitarbeiter nur einen Hinweis, die Chef-Ansicht funktioniert weiter. Fehlt der Eintrag, ist der Bereich an.

**Datenschutz:** Kollegen sehen nur Namen und Schichten (Telefon nur mit Freigabe, bei Abwesenheit nur „nicht da“).
Lohn und Stunden sehen nur der Chef und die Person selbst. Beim Löschen eines Kontos werden die persönlichen Daten
entfernt; vergangene Schichten bleiben ohne Namen als „ehem. Mitarbeiter“. Den Text der Datenschutzerklärung
der Website bitte um einen Abschnitt „Team-Bereich / Dienstplan“ ergänzen.

**Testen ohne Server:** Mit `python3 -m http.server` läuft `team/` im **Demo-Modus** (erfundenes Team, nur im
Browser gespeichert; „Als Anja“ / „Als Chef“ oben, Chef auch per `team/?chef=1`, Passwort `demo1234`).

**Updates:** `cms/.htaccess` lässt `team-api.php` durch; `team/.htaccess` setzt Sicherheits-Header und sperrt `SPEC.md`.
Im Docker-Container liegt die Datenbank in `cms/data` und damit im Volume – sie überlebt Updates.

## Vorschau auf kospolo.de (Mac Studio, Docker)

Für die Präsentation beim Eigentümer läuft die komplette Seite (Website, CMS, Tippspiel mit echtem Bundesliga-Spielplan) als ein Docker-Container auf dem Mac Studio. Davor sitzt wie bei `beta.rollsportmanager.de` der Nginx Proxy Manager. Alle Dateien liegen in `deploy/`.

**Einmalig: DNS.** Beim DNS-Anbieter von kospolo.de einen A-Record `hofbraeustueble.kospolo.de` auf die öffentliche IP des Anschlusses anlegen (genau wie bei `jochen.kospolo.de`).

**Ausrollen** (im Repo auf dem Mac Studio, aus dem letzten Commit):

```bash
git pull
./hofbraeustueble/deploy/deploy.sh          # baut das Image, startet den Container auf Port 8097
./hofbraeustueble/deploy/npm-proxy.sh       # einmalig: Proxy-Host + Let's-Encrypt-Zertifikat
```

Danach ist die Vorschau unter **https://hofbraeustueble.kospolo.de/** erreichbar. Port oder Name ändern: `HBS_PORT=8099 ./hofbraeustueble/deploy/deploy.sh` bzw. `DOMAIN=… HBS_PORT=… ./hofbraeustueble/deploy/npm-proxy.sh`.

**Beim ersten Start** passiert automatisch:
- Statt des öffentlich dokumentierten Start-Passworts wird ein **zufälliges CMS-Passwort** erzeugt.
- Im Tippspiel wird „Bundesliga 2026/27“ mit dem echten Spielplan von OpenLigaDB angelegt, dazu ein Einladungscode für bis zu 25 Personen.
- `deploy.sh` zeigt diese Zugangsdaten am Ende an. Später nachlesen: `docker exec hofbraeustueble-preview cat /srv/hbs-state/ZUGANGSDATEN.txt`

**Daten:** Inhalte, Passwort, hochgeladene Bilder, Backups und die Tippspiel-Datenbank liegen im Docker-Volume `hofbraeustueble-state` und überleben jedes Update (`deploy.sh` erneut ausführen). Ergebnisse holt der Container selbst alle 15 Minuten, ein Cronjob ist nicht nötig. Alles zurücksetzen: `docker compose -f hofbraeustueble/deploy/compose.yml down -v` (löscht alle Daten!).

**Vorschau-Schutz:** Jede Antwort trägt `X-Robots-Tag: noindex, nofollow`, damit Suchmaschinen die Platzhalter-Inhalte (Adresse, Impressum) nicht aufnehmen. Vor einem echten Start diese Zeile in `deploy/apache-site.conf` entfernen und Impressum/Datenschutz ausfüllen.

### Weitere Ligen anlegen (Vorschau auf dem Mac Studio)

```bash
./hofbraeustueble/deploy/ligen-anlegen.sh              # DFB-Pokal, Champions League, Frauen-Bundesliga
./hofbraeustueble/deploy/ligen-anlegen.sh bl2 wcl dfbf # 2. Bundesliga, Frauen-Champions-League, DFB-Pokal Frauen
```

Vorhandene Ligen werden übersprungen. Läuft die Saison schon, wird keine Bonusfrage angelegt (sie wäre nur bis zum ersten Spiel tippbar). Im CMS geht dasselbe unter Tippspiel → Spiele & Wettbewerbe → „Neuer Wettbewerb“; die Frauen-Ligen stehen dort jetzt auch in der Auswahl.

---

## Zusatzfunktionen (Speisekarte, Reservierung, Anmeldung, Fußball diese Woche)

Alle Zusatzfunktionen lassen sich in der Verwaltung unter **„Funktionen“** mit einem großen Schalter ein- und
ausschalten (danach „Speichern“). Ausgeschaltete Bereiche verschwinden von der Website (Abschnitt, Menüpunkt,
Knöpfe); gespeicherte Daten bleiben erhalten. Die Schalter stehen in `cms/content.json` unter `features`:

| Schlüssel | Standard | Bedeutung |
|---|---|---|
| `tippspiel` | an | Tippspiel-Abschnitt und -Menüpunkt auf der Website (Hauptschalter; der Teaser lässt sich zusätzlich unter Tippspiel → Website-Teaser ausblenden). Spieler und Tipps bleiben erhalten, der direkte Link funktioniert weiter. |
| `team` | an | Team-Bereich (Verlinkung auf der Website) |
| `speisekarte` | an | Getränke- & Speisekarte |
| `reservierung` | aus | Tisch-Anfrage über die Website |
| `anmeldung` | aus | Anmeldung zu Veranstaltungen |
| `programm` | an | „Diese Woche live bei uns“ (Spiele aus dem Tippspiel) |
| `preise` | aus | nur Schalter – „Preise für die Tippspiel-Sieger anzeigen“ (wird im Tippspiel umgesetzt) |
| `kasse` | aus | nur Schalter – „Stammtischkasse für gemeinsame Feiern (nicht für den Tippsieger)“ |

Für eigene Erweiterungen: Jedes Element der Website mit `data-feature="<schlüssel>"` wird automatisch entfernt,
wenn die Funktion aus ist (`HBS.applyFeatures()` in `assets/js/cms-loader.js`).

**Speisekarte** (Reiter „Speisekarte“): Kategorien und Einträge mit Name, Größe (z. B. „0,5 l“), Preis (nur die
Zahl, z. B. `3,90`), Kennzeichen (z. B. „vom Fass“), Hinweis und „verfügbar ja/nein“; Reihenfolge per Pfeilen.
Gleichnamige Einträge direkt untereinander (Pils 0,3 l / 0,5 l) erscheinen auf der Website in einer Zeile.
**Die mitgelieferten Preise sind Beispiele** – bitte ersetzen und den Hinweis „BEISPIEL-PREISE“ ändern.

**Tisch-Anfrage** (Reiter „Reservierungen“): Gäste schicken Name, Telefon, freiwillig E-Mail, Tag, Uhrzeit,
Personen, optional „Zum Fußballspiel“ (Auswahl aus dem Programm) und eine Nachricht. Das ist **keine automatische
Buchung**: Der Gast sieht „Wir melden uns telefonisch“, der Wirt ruft an und setzt den Status
(neu / bestätigt / abgelehnt), „Gast angerufen“ und eine interne Notiz – das wird sofort gespeichert.
Neue Anfragen zeigt ein Zähler im Menü (wird jede Minute aktualisiert). Einstellbar: Überschrift, Text,
höchstens Personen (Standard 12), Vorlauf in Stunden (3), höchstens Tage im Voraus (60), „nur zu den
Öffnungszeiten“ (Ruhetage gesperrt, letzte Uhrzeit 30 Min. vor Schluss), automatische Löschung N Tage nach dem
Termin (30), Datenschutz- und Einwilligungstext. Optional eine kurze **Hinweis-E-Mail** an den Wirt über PHP
`mail()` (Standard: aus) – sie nennt nur Tag/Uhrzeit/Personen, keine Namen. **Achtung:** `mail()` funktioniert
nicht bei jedem Hoster; deshalb trotzdem regelmäßig in der Verwaltung nachsehen.

**Anmeldung zu Veranstaltungen**: Im Termin-Editor „Anmeldung möglich“ einschalten, optional „Höchstens
Teilnehmer“ (0 = unbegrenzt), Anmeldeschluss und Hinweis. Die Termin-Karten zeigen „Anmelden“, „Noch X Plätze
frei“ bzw. „Ausgebucht“. Der Reiter „Anmeldungen“ zeigt je Termin die Teilnehmerliste (Name, Telefon, Personen)
mit „Liste drucken“, „Als Datei speichern“ (CSV für Excel) und Entfernen einzelner Einträge. Anmeldungen werden
7 Tage nach der Veranstaltung automatisch gelöscht. Überbuchung ist ausgeschlossen (Platzprüfung in einer
Datenbank-Transaktion).

**Datenschutz:** Unter „Reservierungen → Einstellungen“ gibt es einen Textvorschlag für die Datenschutzerklärung
(Knopf „In die Datenschutzerklärung übernehmen“) – bitte vor dem Einschalten übernehmen und rechtlich prüfen lassen.

**Fußball diese Woche**: Zeigt die Spiele der nächsten 7 Tage (einstellbar 1–14) aus der Tippspiel-Datenbank,
gruppiert nach Tag, mit Vereinslogos (falls im Tippspiel geladen) und „Läuft“ für angepfiffene Spiele; bei
eingeschalteter Reservierung mit Knopf „Tisch anfragen“ (füllt Tag, Uhrzeit und Spiel im Formular vor). Unter
„Funktionen → Fußball diese Woche → Einstellungen“: Überschrift, Text, Zeitraum und welche Wettbewerbe
(nichts angehakt = alle aktiven). Ohne Tippspiel-Datenbank bleibt der Abschnitt einfach weg.

**Technik**

- `cms/gast-api.php` – Anfragen und Anmeldungen, eigene SQLite-Datei `cms/data/gast.sqlite` (wird automatisch
  angelegt, `cms/data/` ist gesperrt). Öffentlich: `status`, `token`, `plaetze` (nur Zahlen, keine Namen),
  `reservieren`, `anmelden` (POST, JSON). Verwaltung (Sitzung aus `cms/api.php`, POST mit `X-CSRF-Token` und
  Origin-Prüfung): `admin_overview`, `admin_counts`, `admin_res_update`, `admin_res_delete`, `admin_anm_delete`,
  `admin_anm_seen`. Spam-Schutz ohne Fremddienste: verstecktes Feld `homepage` (Roboter bekommen „ok“, es wird
  nichts gespeichert), signierter Zeitstempel (mind. 3 Sekunden, höchstens 6 Stunden), je IP höchstens
  5 erfolgreiche Einsendungen bzw. 30 Versuche pro Stunde, insgesamt 60 pro Stunde (gespeichert wird nur ein Hash
  der IP, nach 24 Std. gelöscht), Längenbegrenzungen, keine Links im Namen. Doppelt abgeschickte Anfragen werden
  nur einmal gespeichert.
- `cms/programm-api.php` – öffentlich, **nur lesend**: öffnet `cms/data/tippspiel.sqlite` schreibgeschützt und
  liefert nur Wettbewerb, Anstoß, Heim, Gast, `home_logo`/`away_logo` (fehlende Tabellen/Spalten werden
  toleriert). `?action=wettbewerbe` liefert Id/Name/aktiv für die Auswahl. Zwischenspeicher 5 Minuten
  (`cms/data/programm-cache.json`, HTTP `max-age=300`).
- Website: `variante-1/extras.js` und `variante-2/extras.js` (identische Kopien – bei Änderungen beide
  anpassen), Aussehen in `extras.css` der jeweiligen Variante; Hilfsfunktionen in `assets/js/cms-loader.js`
  (`HBS.features`, `HBS.gast`, `HBS.programm`, `HBS.reservationDays` …). Variante 3 nutzt die Zusatzfunktionen
  (noch) nicht.
- Verwaltung: `admin/extras.js` + `admin/extras.css`, angemeldet über `window.HBS_ADMIN_EXT` (in `admin/admin.js`
  nur `EXT.init(...)` und das Feld im Termin-Editor).
- Vorschau ohne PHP: Die Formulare der Website melden „In der Vorschau werden keine Anfragen verschickt“; die
  Verwaltung zeigt im Demo-Modus Beispiel-Anfragen (localStorage `hbs_gast_demo_v1`) und die Website dann
  Beispielspiele.
