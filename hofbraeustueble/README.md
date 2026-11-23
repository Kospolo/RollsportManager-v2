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
    ├── config.php          Passwort (nur als Hash) – nicht öffentlich abrufbar
    ├── .htaccess           sperrt alles außer api.php und content.json
    ├── .user.ini           PHP-Einstellungen (Upload-Größe), wo der Hoster das unterstützt
    ├── uploads/            hochgeladene Bilder (Skriptausführung abgeschaltet)
    ├── backups/            automatische Sicherungen (die letzten 20 Versionen)
    └── data/               Login-Sperre und Sitzungen (intern)
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
