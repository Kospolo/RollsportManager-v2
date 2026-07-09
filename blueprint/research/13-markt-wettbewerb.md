# 13 — Markt & Wettbewerb: Vereins-/Team-Management-Apps 2026

**Rolle:** Markt-Analyst · **Stand:** 09.07.2026
**Projekt:** RollsportManager v2 (Neuaufbau) · **Analysierte Codebases:** iOS/macOS/Watch, Android, Backend/Portal/Website

---

## 1. Überblick

RollsportManager ist eine funktional außergewöhnlich breite Vereins-Management-App für Rollkunstlauf: Die eigene Funktionsliste (`rollsportmanager-ios-macos/FUNKTIONEN.md`, Version 1.4, Build 111, Stand 10.02.2026) nennt „über 200 Funktionen" — von Mitglieder-, Team- und Trainerverwaltung über Termine, Anwesenheit/QR-Check-in, Chat, Küren-Bibliothek mit Audio-/Videoplayer, Wettkampf-Modus mit Live-Scoring, Zahlungen/Mahnwesen bis zu Ausrüstung, Schließfächern, Pflichtstunden und Gamification.

Im Marktvergleich 2026 zeigt sich ein klares Bild:

1. **In der Breite** ist RollsportManager den Generalisten (Spond, SportMember, Teamer) bereits überlegen — kaum ein Wettbewerber deckt Küren, Wettkampf-Live-Scoring, Pflichtstunden und Schließfach-Vermietung ab.
2. **In der Tiefe der „Pflicht-Features" 2026** liegt die App zurück: kein SEPA-Lastschrift-Einzug (bei ClubDesk/easyVerein Standard), kein DATEV-konformer Buchungsexport, kein echtes Eltern-/Guardian-Modell wie bei Spond, keine KI-Features, kein Website-Baukasten.
3. **In der Technik** ist die App eine Altlast: drei vollständig getrennte Implementierungen (Swift ~128.500 LOC, Kotlin ~108.800 LOC, 87 statische Portal-HTML-Seiten) plus ein produktiv auf einem privaten Mac laufendes Docker-Backend — das ist für einen Neuaufbau der wichtigste Hebel.

**Kernthese für v2:** Die Rollsport-Nische (Kür-Musik, Laufpläne/Startreihenfolgen, RollArt-Wertungsbogen, Video-Analyse) ist der Differenzierer, den kein Generalist bedient. Die Generalisten-Basics (Payments-Automatik, Eltern-Kommunikation, KI-Automatisierung) müssen aber auf 2026-Standard gehoben werden, sonst verliert v2 den Vergleich in Feature-Tabellen wie trusted.de/vergleich.org.

---

## 2. Ist-Zustand im Detail (mit Datei-Referenzen)

### 2.1 Plattformen & Umfang

| Plattform | Technologie | Umfang | Referenz |
|---|---|---|---|
| iOS/iPadOS/macOS + Watch + Widget | SwiftUI, GRDB (Offline), Supabase | ~128.500 Zeilen Swift, 151 View-Dateien | `rollsportmanager-ios-macos/RollsportManager/` |
| Android | Kotlin, Jetpack Compose, Hilt, 28 Data Classes, 9 Repositories, 10 ViewModels | ~108.800 Zeilen Kotlin | `rollsportmanager-android/app/src/`, `ENTWICKLUNGSPLAN.md` |
| Web-Portal | Statisches HTML + Vanilla-JS (kein Framework, kein Build-System) | 87 HTML-Seiten in `www/portal/` | `rollsportmanager-backend/www/portal/` |
| Öffentliche Website | Statisches HTML (Features, Pricing, FAQ, Blog) | `rollsportmanager-backend/www/` | Backend-`CLAUDE.md` |
| Backend | Self-hosted Supabase (Docker, Kong :8000, Postgres, Storage), 30+ SQL-Migrationen, 6 Edge Functions, 1 Push-Worker | `rollsportmanager-backend/migrations/`, `functions/` (paypal-webhook, stripe-webhook, send-push-notification …), `workers/push-worker.js` | Backend-`CLAUDE.md` |

### 2.2 Funktionsumfang (Ist)

Quelle: `FUNKTIONEN.md` und `HARMONISIERUNGSPLAN.md` (Backend):

- **Vereinsverwaltung:** Verein/Abteilungen, Join-Code, Bankdaten, E-Mail-Einstellungen, Premium-Lizenzierung (Benutzer-Abos 0/2/5 €, Vereins-Lizenzen 9/29/59 € — Backend-`CLAUDE.md`, Abschnitt „Preisstruktur").
- **Teams & Mitglieder:** Rollen (Admin, Moderator, Trainer, Kassenwart, Mitglied), Gast-Trainer mit Zeitlimit (`migrations/20260201_guest_trainer_access.sql`), Familien-Modell über `users.parent_id` (Backend-`CLAUDE.md`, „Familie").
- **Küren (Kernfeature):** CRUD, Medien (Video/Audio/Bild), Bewertungen, Notizen, Video-Timestamps, Audio-Player mit Tempo 0,5–2,0×, A-B-Loop, Countdown 0/3/5/8 s, Waveform-Animation (`rollsportmanager-android/.../KuerDetailScreen.kt`, Android-`CLAUDE.md` Punkte 14–15; iOS als Referenz).
- **Termine/Anwesenheit:** Wiederkehrende Termine, Zu-/Absagen mit 4 Status, QR-Check-in, Anwesenheitsquoten, Hallen-Belegungsplan (`www/portal/termine.html`, `trainer-attendance.html`).
- **Wettkampf-Modus:** Wettkampf-Termine, Live-Screen mit Timer (Aufwärm-Countdown/Elapsed), Checklisten (`migrations/20260201_wettkampf_modus.sql`, `WettkampfLiveScreen.kt`).
- **Finanzen:** Beitragskategorien, Rechnungen, Zahlungen, Mahnstufen, Pflichtstunden-Abrechnung (`migrations/20260111_payment_system.sql`, `20260215_finance_tables.sql`, `20260213_fix_pflichtstunden_function.sql`).
- **Kommunikation:** Team-Chat + DM (Realtime), Bilder im Chat, Voice-to-Text auf allen 3 Plattformen, Vereins-News, Push (eigener Worker `workers/push-worker.js` + `migrations/20260109_push_triggers.sql`).
- **Sonstiges:** Übungsbibliothek (`sql/create_ubungen_table.sql`, Tabelle `ubungen` mit Kategorien aufwaermen…kombination, Schwierigkeit 1–5), Trainingspläne, Equipment/Reservierungen, Schließfächer (`20260119_schliessfach_vermietung.sql`), Wartelisten, Achievements (`20260201_achievements.sql`), Geburtstage/Jubiläen, Galerie/Dokumente (`20260215_gallery_documents.sql`), Offline-Modus (GRDB-Cache iOS), 5 Sprachen (DE/EN/FR/RU/TR, `www/assets/js/translations.js`).

### 2.3 Zahlungssystem (Ist) — der kritischste Funktions-Rückstand

Quelle: `rollsportmanager-backend/ZAHLUNGSSYSTEM_STATUS.md` (Stand 12.01.2026):

| Methode | Status |
|---|---|
| Banküberweisung (manuell) | ✅ fertig |
| PayPal | ⏳ UI fertig, Webhook vorhanden |
| Stripe/Kreditkarte | ⏳ UI fertig, Webhook vorhanden |
| **SEPA-Lastschrift** | **❌ nicht begonnen** |

Zusätzlich brisant: Jeder Verein hinterlegt **eigene** PayPal-/Stripe-API-Keys, die im Klartext in der Tabelle `verein_payment_config` liegen (`paypal_client_secret`, `stripe_secret_key`, `stripe_webhook_secret` — dokumentiert in `ZAHLUNGSSYSTEM_STATUS.md`, Abschnitt „Datenbankstruktur"). Das ist sowohl ein Sicherheits- als auch ein Usability-Problem (kein Vereinskassier will Stripe-Keys erzeugen).

### 2.4 Architektur-Realität

- **Dreifach-Implementierung als Prozess-Zwang:** Backend-`CLAUDE.md` („KRITISCH — PLATTFORM-SYNCHRONISATION!") verlangt bei *jeder* Änderung Updates in iOS, Android und Portal inkl. manueller Versions-Bumps (`?v=X`-Cache-Busting). Der `HARMONISIERUNGSPLAN.md` und die Android-`CLAUDE.md` (Punkte 1–27: nachimplementierte iOS-Features) dokumentieren, dass Feature-Parität ein Dauerprojekt ist.
- **Produktion = lokaler Mac:** „Alles läuft LOKAL auf dem Mac in Docker … Die Domain rollsportmanager.de zeigt auf den lokalen Docker" (iOS-`CLAUDE.md` und Backend-`CLAUDE.md`). Kein CI/CD, Deploy = `docker compose build --no-cache`.
- **Demo-JWT-Secrets in Produktion:** ANON_KEY/SERVICE_ROLE_KEY mit Issuer `supabase-demo` und „JWT_SECRET: Supabase CLI Demo-Secret" (Backend-`CLAUDE.md`, „JWT-Keys"). Ein bereits im Security-Audit vom 13.06.2026 als K1 eingestuftes Risiko.
- **Medien als Base64 in der DB:** `kuer_media` speichert „Kür-Medien (Base64)" (Backend-`CLAUDE.md`, Tabellenübersicht; Spalte `file_data` in `HARMONISIERUNGSPLAN.md` §2.1) — parallel existiert Supabase Storage mit Buckets (`chat-images`, `kuer-media`, `avatars`) → zwei konkurrierende Medienpfade.
- **Sprach-Mischmasch im Schema:** deutsche Spalten (`ort`, `nachricht`, `betrag`, `faellig_am`) neben englischen (`start_datetime`, `image_url`), deutsche Enum-Werte (`bild`, `dokument`, `in_arbeit`) — Backend-`CLAUDE.md` „Wichtige Spalten-Namen"/„Enum-Werte". Auf Client-Seite erzwingt das manuelle CodingKeys ohne automatische Key-Konvertierung (iOS-`CLAUDE.md`: „NIEMALS keyDecodingStrategy…!") und hat bereits Bugs erzeugt (Android `Message.content` vs. DB `nachricht`, Android-`CLAUDE.md` Punkt 27).
- **Namenskollisionen im iOS-Code:** doppelte Typdefinitionen Models/ (GRDB) vs. ViewModels/ (Supabase) mit RSM-Prefix-Workaround, teilweise unerledigt (`REPARATUR_PLAN.md`: 8 Enums „NOCH ZU KORRIGIEREN").
- **Wildwuchs im Repo:** Fix-SQL-Skripte im App-Root (`COMPLETE-FIX.sql`, `FIX-ALL.sql`, `FIX-ENUM.sql`, `Podfile 2` …) zeugen von Hotfix-Kultur ohne Migrationsdisziplin.

---

## 3. Marktanalyse 2026

### 3.1 Die relevanten Wettbewerber

| Anbieter | Positionierung | Preis (Stand 2026) | Was sie besonders gut können |
|---|---|---|---|
| **Spond** (spond.com) | Kostenlose Team-/Klub-App, stark im Jugendsport | Kernfunktionen kostenlos, Monetarisierung über Payments/Fundraising | **Guardian-Modell**: Eltern-Konten mit voller Einsicht in die Kommunikation ihrer Kinder, DSGVO-konformes Messaging mit Nachvollziehbarkeit; Payment-Requests mit automatischen Zahlungs-Erinnerungen; wiederkehrende Termine für die ganze Saison; mehrere Teams/Altersklassen in einem Account |
| **SportMember** (sportmember.de) | Vereinsverwaltung + Kommunikationsplattform | ~15 €/Monat (2026 erhöht, vorher ~10 €) | Eigener Login je Mitglied mit personalisierten Inhalten; Beitragsverwaltung; Vereinshomepage; **neu: Banking-Schnittstelle** (trusted.de) |
| **ClubDesk** (clubdesk.de) | Klassische Vereinsverwaltung (nicht nur Sport) | Gratis bis 50 Mitglieder; S 10 €, M 16 €, L 28 €/Monat | Homepage-Baukasten mit Modul-Anbindung; Rechnungen/Buchhaltung; **SEPA-Lastschrift-Mandate**; Dokumentenablage |
| **Vereinsplaner** (vereinsplaner.at) | Moderne Mitglieder-App + Verwaltung | Freemium | Mitglieder-Chat, **Umfragen/Abstimmungen**, starke Mobile-App, Aufgabenverwaltung |
| **Teamer** (teamer.net) | Schlanke, kostenlose Team-Organisation | Kostenlos mit Werbung, Premium-Abo (werbefrei + SMS) | Benachrichtigungen über E-Mail/SMS/Push; Verfügbarkeits-Kalender; Teamer-Payments-Gateway |
| **easyVerein** | Buchhaltungsstarke DE-Vereinssoftware | Abo nach Vereinsgröße | **SEPA-Mandate + automatischer Einzug, DATEV-Anbindung**, Mitgliederportal |
| **TeamSnap / TeamLinkt / Heja** (US/CA) | Jugendsport-Team-Apps | TeamLinkt kostenlos | TeamLinkt wirbt 2026 explizit mit **eingebauten AI-Tools**, Registration + Payments + Website in einem |
| **Uplifter / EntryEeze** (Eiskunstlauf, US/CA) | Nischen-Vorbild: Skating-Club- & Wettkampf-Management | B2B-Pricing | Wettkampf-Registrierung im Shop-Prinzip (Events wählen, Practice-Ice reservieren, Merch vorbestellen); Test-Session-Verwaltung; Verbands-Integration (Skate Canada), sodass Läufer-Stammdaten/Testniveaus nicht neu erfasst werden |

### 3.2 Was 2026 Standard ist (Tabellen-Pflicht)

Aus trusted.de, vergleich.org, OMR Reviews, Waresport/VMR-Trendberichten destilliert:

1. **Automatischer SEPA-Lastschriftlauf** mit digitaler Mandatsverwaltung, Vorabankündigung (Pre-Notification) und SEPA-XML-Export an die Bank — „gehört zum Kernumfang guter Vereinsfinanzverwaltung".
2. **Buchhaltungs-Export**: DATEV-Format, zunehmend **E-Rechnung (XRechnung/ZUGFeRD)** — ab 2026 für Vereine relevant.
3. **Eltern-/Guardian-Konten** mit Kommunikations-Transparenz (Spond als Benchmark) — nicht nur „Kind verknüpfen", sondern eigene Rolle mit Antwortrecht auf Termine und Einsicht in Coach-Kommunikation.
4. **Payment-Requests + automatische Zahlungserinnerungen** in der App (Trikots, Fahrten, Startgelder) — getrennt vom Mitgliedsbeitrag.
5. **Mobile-first + Self-Service**: ~65 % der Mitglieder bevorzugen Mobilzugriff; Registrierung, Datenpflege, Abmeldungen komplett ohne Admin.
6. **Website-Baukasten** aus Vereinsdaten (ClubDesk, SportMember) — öffentliche Termine/News/Teams automatisch publiziert.
7. **Umfragen, Aufgaben-/Helferlisten** (Vereinsplaner) — Kuchendienst, Fahrdienste, Auf-/Abbau.
8. **DSGVO-Basics**: AV-Vertrag, Rollen-/Rechtekonzept, Daten-Export/-Löschung je Mitglied.

### 3.3 Trends 2026 (Differenzierung der Besten)

- **KI-first / „Active Systems":** Der Markt bewegt sich von passiven Datenbanken zu Systemen, die *sagen, was zu tun ist* — z. B. „5 Mitglieder sind 3× unentschuldigt gefehlt, hier ist der Nachrichtenentwurf" (Waresport, VMR 2026). TeamLinkt und neue Anbieter wie Vanta Sports/1club.ai vermarkten AI-Scheduling und Chat-Assistenten prominent.
- **Zero-Touch-Billing:** Automatisierte Abrechnungs-Lebenszyklen (Anmeldung → Mandat → Einzug → Retry → Mahnung) reduzieren Admin-Aufwand messbar (~30 % laut VMR-Award-Begründung für Tilt).
- **Parent-AI / Concierge:** Chatbots als „Game-Day-Concierge" für Eltern (Erinnerungen, Mitfahrgelegenheiten, Packlisten); Tools, die aus Kommunikationsströmen automatisch Erinnerungen erzeugen.
- **Konsolidierung:** Eltern klagen über „zu viele Apps" — Plattformen, die Registrierung + Kalender + Chat + Zahlungen + Website vereinen, gewinnen. (Das ist RollsportManagers Stärke — sie muss nur zuverlässig und modern werden.)
- **Video-Feedback als Coaching-Standard:** OnForm/CoachNow (240 fps, Zeitlupe, Telestration/Zeichenwerkzeuge, Side-by-Side/Overlay, Skeleton-Tracking mit Gelenkwinkeln) sind im Einzel-Techniksport (Turnen, Eiskunstlauf, Skating) etabliert — im Vereins-App-Markt aber *nicht* integriert. Große Chance für eine Kür-zentrierte App.

### 3.4 Die Rollsport-Nische: was niemand bedient

- **RollArt-Wertung:** World Skate hat das RollArt-Judging-System (Technical Panel, TVE/QOE je Element, Artistic-Impression-Komponenten Skating Skills/Transitions/Performance/Choreography) etabliert; es existieren nur isolierte Tools (RollArt Calculator App). **Kein Vereins-Management-System integriert Wertungsbögen, Element-Codes und Score-Historie pro Läufer.**
- **Kür-Musik-Workflow:** Musik schneiden/faden, Längen-Limits je Kategorie prüfen, Wettkampf-Playlist offline — heute mit Audacity + USB-Sticks gelöst. RollsportManager hat bereits Player-Features (Tempo, A-B-Loop, Countdown, Timestamps — `KuerDetailScreen.kt`), aber keinen Musik-Schnitt und keine Wettkampf-Playlist-Ausgabe.
- **Laufpläne/Startreihenfolgen:** Aufwärmgruppen, Startreihenfolge, Zeitplan-Generierung für Vereinswettbewerbe — EntryEeze macht das für US-Eiskunstlauf, im DACH-Rollsport (DRIV-Umfeld) gibt es nur Verbands-Portale für Ausschreibungen/Ergebnisse (rollkunstlauf-driv.de), kein Club-Tool.
- **Test-/Prüfungsverwaltung:** DRIV-Prüfungsstruktur (Läuferklassen) je Athlet nachhalten — Uplifter zeigt mit Skate-Canada-Integration den Wert von Verbandsdaten am Profil.

---

## 4. Stärken (Ist-App)

1. **Einzigartige Funktionsbreite in der Nische** — Küren mit Medien/Bewertungen/Timestamps, Wettkampf-Live-Modus, Pflichtstunden: kein Generalist hat das (`FUNKTIONEN.md`).
2. **Alle Plattformen nativ bedient** — iPhone/iPad/Mac/Watch/Widget + Android + Web; echte Offline-Fähigkeit auf iOS via GRDB (`rollsportmanager-ios-macos/RollsportManager/Models/` GRDB-Typen).
3. **Kür-Audio-Player auf Trainings-Niveau** — Tempo 0,5–2,0×, A-B-Loop mit Slider-Visualisierung, 8-s-Countdown, klickbare Timestamps (Android-`CLAUDE.md` Punkte 14–15, 6) — genau die Werkzeuge, die Trainer im Kürtraining brauchen.
4. **Familien-/Kinder-Modell vorhanden** (`users.parent_id`, `www/portal/family.html`, Account-Upgrade ab 16) — gute Basis für ein echtes Guardian-Modell.
5. **Rollen-/RLS-Konzept durchgezogen** — Row Level Security auf allen Kerntabellen (Backend-`CLAUDE.md`, „RLS-POLICIES"), Kassenwart-Rolle (`20260122_add_kassenwart_role.sql`).
6. **Monetarisierung angelegt** — User-Abos + Vereins-Lizenzen + Werbung/Limits (AdsManager.swift, `20260215_trainer_limits.sql`); v2 startet nicht bei null.
7. **5-sprachig** (DE/EN/FR/RU/TR) — mehr als die meisten DACH-Wettbewerber.

---

## 5. Schwächen / Altlasten

1. **Dreifache Codebasis + statisches Portal** — jede Änderung ×3 (Backend-`CLAUDE.md` „PLATTFORM-SYNCHRONISATION"-Checkliste); Harmonisierung ist ein dokumentiertes Dauerprojekt (`HARMONISIERUNGSPLAN.md`, Android-`CLAUDE.md` mit 27 Nachzieh-Punkten). Das Web-Portal (87 HTML-Seiten, Vanilla-JS, manuelles `?v=X`-Cache-Busting) ist nicht wartbar skalierbar.
2. **SEPA-Lastschrift fehlt komplett** (`ZAHLUNGSSYSTEM_STATUS.md`: ❌) — im DACH-Vereinsmarkt das K.-o.-Kriterium; ClubDesk/easyVerein/Clubway führen damit jede Vergleichstabelle an.
3. **Payment-Architektur unsicher & unpraktisch** — Vereins-eigene Stripe/PayPal-Secrets im Klartext in `verein_payment_config` (`ZAHLUNGSSYSTEM_STATUS.md`); PayPal/Stripe clientseitig nur „UI fertig".
4. **Produktivbetrieb auf privatem Mac** mit Demo-JWT-Secrets (Issuer `supabase-demo`, Backend-`CLAUDE.md`) — Verfügbarkeits-, Sicherheits- und Vertrauensrisiko; Security-Audit-Befund K1 (13.06.2026) weiterhin offen.
5. **Medien als Base64 in Postgres** (`kuer_media.file_data`) parallel zu Storage-Buckets — DB-Bloat, langsame Sync, doppelte Wahrheit.
6. **Schema-Altlasten** — Deutsch/Englisch gemischt, deutsche Enums, keine automatische Key-Konvertierung möglich; bereits nachweislich Bug-Quelle (Android `nachricht`-Feld, Android-`CLAUDE.md` Punkt 27; iOS-`CLAUDE.md` CodingKeys-Warnblöcke).
7. **iOS-Typ-Chaos** — GRDB- vs. Supabase-Typen mit RSM-Prefix-Workaround, unvollständig (`REPARATUR_PLAN.md`); Fix-SQL-Dateien im App-Root statt Migrationen.
8. **Kein echtes Eltern-Erlebnis** — Kinder sind verknüpfte User, aber Eltern haben keine Kommunikations-Transparenz, keine Antwortrechte im Namen des Kindes à la Spond.
9. **Keine KI/Automatisierung** — keine Auto-Erinnerungen bei offenen Zusagen/Rechnungen jenseits von Mahnstufen, kein Assistent, keine Insights (2026-Trend „Active Systems").
10. **Wettkampf-Modus ohne Nischen-Tiefe** — Live-Timer + Ergebnistabellen existieren (`WettkampfLiveScreen.kt`), aber kein RollArt-Wertungsbogen, keine Startreihenfolgen/Laufpläne, keine Meldungen/Startgelder.
11. **i18n dreifach gepflegt** — `translations.js` (Web), `strings.xml` (Android), iOS-Strings; Bilingual-Pflege (DE/EN) ist damit ×3-Aufwand.

---

## 6. Konkrete Feature-Ideen für v2 (mit Priorität)

**P0 = Launch-kritisch · P1 = ersten 6 Monate · P2 = Differenzierung/Ausbau**

| # | Feature | Prio | Begründung / Vorbild |
|---|---|---|---|
| 1 | **SEPA-Lastschrift-Automatik**: digitale Mandatserteilung (E-Signatur im Onboarding), Pre-Notification-Mails, SEPA-XML-Export bzw. Einzug via Payment-Provider (Stripe SEPA Debit / GoCardless), Retry-Logik | **P0** | Pflicht-Feature jeder DE-Vereinssoftware (ClubDesk, easyVerein, Clubway); heute ❌ (`ZAHLUNGSSYSTEM_STATUS.md`) |
| 2 | **Zentraler Payment-Provider statt Vereins-API-Keys** (Stripe Connect: Verein onboardet per KYC-Flow, Plattform nimmt optional Gebühr) | **P0** | Beseitigt Klartext-Secrets in `verein_payment_config`, senkt Einstiegshürde für Kassenwarte, schafft Plattform-Umsatz |
| 3 | **RollArt-kompatibler digitaler Wertungsbogen**: Element-Bibliothek (Sprünge/Pirouetten/Schritte mit Codes), TVE/QOE-Eingabe, Komponenten-Noten, Score-Historie pro Läufer & Kür | **P0 (Nische)** | Alleinstellungsmerkmal; nur isolierte Tools wie RollArt Calculator existieren; verzahnt Küren-Modul mit Wettkampf-Modus |
| 4 | **Wettkampf-Management komplett**: Online-Meldung mit Startgeld-Zahlung, Startlisten-/Laufplan-Generator (Aufwärmgruppen, Startreihenfolge, Zeitplan), Live-Ergebnisse öffentlich teilbar, PDF-Urkunden | **P0 (Nische)** | EntryEeze-Prinzip („Shopping-Cart" für Events + Practice-Ice) auf DACH-Rollsport übertragen; DRIV-Umfeld bietet das nicht als Club-Tool |
| 5 | **Guardian-Modell 2.0**: Eltern-Rolle mit Einsicht in alle Coach-Kommunikation des Kindes, Zu-/Absagen im Namen des Kindes, Familien-Kalender-Feed, Fahrgemeinschafts-Funktion | **P1** | Spond-Benchmark; DSGVO-/Jugendschutz-Verkaufsargument; Basis (`parent_id`) existiert |
| 6 | **Vereins-Copilot (KI)**: Chat-Assistent für Admins („Wer hat 3× unentschuldigt gefehlt?", „Entwurf Mahnmail"), Auto-Zusammenfassung des Team-Chats für Eltern, KI-generierte Termin-Erinnerungstexte | **P1** | 2026-Trend „Active Systems"/Parent-AI (Waresport, TeamLinkt, Vanta); lokales Ollama-Backend als kostengünstige Option vorhanden |
| 7 | **Kür-Musik-Studio**: Trimmen/Fade-in/-out im Browser/App, automatische Längen-Prüfung je Kategorie/Altersklasse, Wettkampf-Playlist-Export (offline, mit Startreihenfolge), Versionierung der Kürmusik | **P1 (Nische)** | Löst den realen Audacity-+-USB-Stick-Workflow ab; Player-Basis (Tempo/Loop/Countdown) schon stark |
| 8 | **Video-Analyse light**: Zeitlupe/Frame-Stepping, Zeichenwerkzeuge (Telestration), Side-by-Side-Vergleich zweier Kür-Videos, Sprung-Tagging auf Timestamps | **P1 (Nische)** | OnForm/CoachNow-Funktionen, integriert in die vorhandenen `kuer_media`/`kuer_video_timestamps`-Strukturen — kein Wettbewerber im Vereinssegment hat das |
| 9 | **Digitales Onboarding**: Beitrittsformular mit Tarifwahl, SEPA-Mandat, Foto-/Datenschutz-Einwilligungen, automatische Willkommensstrecke, Warteliste→Aufnahme-Flow | **P1** | 2026-Standard „Lifecycle-Automation"; Wartelisten-Tabelle existiert bereits |
| 10 | **Buchhaltungs-Integration**: DATEV-Export der Buchungssätze, E-Rechnung (XRechnung/ZUGFeRD), Jahresabschluss-Report, offene-Posten-Liste | **P1** | easyVerein-Kernargument; E-Rechnungs-Pflicht macht es 2026 akut |
| 11 | **Umfragen & Helfereinsätze**: Abstimmungen, Aufgabenlisten mit Slots (Kuchendienst, Fahrdienst, Aufbau), Pflichtstunden-Anrechnung automatisch | **P2** | Vereinsplaner-Stärke; dockt an vorhandenes Pflichtstunden-Modul an |
| 12 | **Anwesenheits- & Churn-Insights**: Trend-Dashboards, automatische Warnung bei sinkender Beteiligung, Auto-Nachricht-Entwürfe | **P2** | „Analytics-driven Insights" (VMR 2026); Daten (`attendance`, `checkins`) sind vorhanden |
| 13 | **Öffentliche Vereinsseite aus App-Daten**: Mini-Website je Verein (Termine, Teams, News, Erfolge) mit eigenem Branding statt statischer zentraler Website | **P2** | ClubDesk/SportMember-Homepage-Baukasten als Retention-Anker |
| 14 | **Test-/Prüfungsverwaltung (DRIV-Läuferklassen)** je Athlet: absolvierte Prüfungen, nächste Ziele, Prüfungs-Anmeldungen | **P2 (Nische)** | Uplifter/Skate-Canada-Prinzip: Verbandsniveau am Profil |
| 15 | **Lesebestätigungen + Auto-Übersetzung im Chat** (DE↔EN↔FR↔RU↔TR) | **P2** | Nutzt vorhandene 5-Sprachen-Basis; Eltern-Kommunikation in Migrantensport-Realität |

---

## 7. Empfehlungen für den Neuaufbau v2

1. **Eine Client-Codebasis statt drei**: Cross-Platform-Stack (z. B. Flutter für iOS/Android/macOS + Web, oder KMP + ein modernes Web-Frontend). Das Web-Portal als echte SPA/SSR-App mit Build-Pipeline ersetzt die 87 statischen HTML-Seiten. Ziel: Feature-Parität per Konstruktion, nicht per `HARMONISIERUNGSPLAN.md`.
2. **Sauberes, englisches, konsistentes Datenmodell** mit i18n nur in der Präsentationsschicht; ein zentraler, generierter API-Client (OpenAPI/Codegen) statt handgepflegter CodingKeys/`@SerialName`-Mappings.
3. **Medien konsequent in Object Storage** (signierte URLs, Thumbnails serverseitig); kein Base64 in Postgres.
4. **Payments als Plattform-Service** (Stripe Connect inkl. SEPA-Lastschrift) statt Vereins-eigener API-Keys; Mandate, Pre-Notifications, Mahnwesen und Beitrags-Lifecycle als „Zero-Touch-Billing"-Kern von v2.
5. **Gehostete, reproduzierbare Infrastruktur** (Managed Supabase oder Cloud-VM/K8s) mit CI/CD, Staging, Secrets-Management und rotierten JWT-Keys — weg vom privaten Mac und den Demo-Secrets.
6. **Nische zuerst sichtbar machen**: Küren + RollArt-Wertung + Wettkampf-Management als Marketing-Speerspitze („Die App für Rollkunstlauf-Vereine"), Generalisten-Features als solide Basis darunter. Gegen Spond & Co. gewinnt v2 nicht über Chat, sondern über Kür-Musik, Laufpläne und Wertungsbögen.
7. **KI von Anfang an als Assistenz-Schicht** (Copilot, Auto-Erinnerungen, Insights) einplanen — 2026 ein Erwartungswert, und mit vorhandener lokaler Ollama-Infrastruktur günstig pilotierbar.
8. **Preismodell vereinfachen**: Das Doppelmodell (User-Abo + Vereins-Lizenz + Werbung + Trainer-Limits, vgl. `20260215_trainer_limits.sql`) ist erklärungsbedürftig und bremst Trainer-Adoption. v2: Verein zahlt (Staffel nach Mitgliedern, wie ClubDesk 0/10/16/28 €), Mitglieder/Eltern immer kostenlos & werbefrei — das ist das Spond-Erfolgsmuster.
9. **DSGVO als Feature**: AV-Vertrag, Datenexport/-löschung je Mitglied, Einwilligungs-Verwaltung (Fotos!), Hosting in DE — im Vereinsmarkt ein echtes Verkaufsargument.

---

## 8. Quellen (Auswahl)

- Spond: [spond.com/en-us](https://www.spond.com/en-us/) · [Youth Sports Team Management App](https://www.spond.com/en-us/news-and-blog/youth-sports-team-management-app/) · [Free App for Sports Club Payments](https://www.spond.com/news-and-blog/free-app-for-sports-club-payments/) · [Capterra: Spond](https://www.capterra.com/p/181253/Spond/)
- DACH-Vergleiche: [trusted.de/vereinsverwaltung](https://trusted.de/vereinsverwaltung) · [trusted.de/sportmember](https://trusted.de/sportmember) · [trusted.de/clubdesk](https://trusted.de/clubdesk) · [OMR: Beste Vereinssoftware](https://omr.com/de/reviews/contenthub/beste-vereinssoftware-im-vergleich) · [vergleich.org/vereinssoftware](https://www.vergleich.org/vereinssoftware/) · [ClubDesk](https://www.clubdesk.de/de/startseite) · [ClubDesk SEPA](https://www.clubdesk.de/de/rechnungen-und-vereinsbuchhaltung/sepa-lastschrift-mandat-verein) · [easyVerein-Erfahrungen](https://matchmakers.one/blog/easyverein-erfahrungen) · [asverein.de: Vereinssoftware 2026](https://asverein.de/blog/vereinssoftware-2026-was-beim-digitalisieren-wirklich-hilft/) · [MeinVerein: SEPA-Lastschrift](https://www.meinverein.de/blog/vereinsbuchhaltung-finanzierung/sepa-lastschrift/) · [Clubway SEPA](https://www.clubway.de/funktionen/sepa-lastschriften/)
- Trends 2026: [Waresport: Future of Sports Club Management (AI/Automation)](https://www.waresport.com/blog/future-of-sports-club-management-ai-automation) · [Waresport: Guide 2026](https://www.waresport.com/blog/sports-club-management-software-2026-guide) · [VMR: Top Club Management Software 2026](https://www.verifiedmarketresearch.com/blog/top-club-management-software/) · [Vanta Sports: Best Team Management Apps](https://www.vantasports.ai/blog/best-team-management-apps) · [Parendipity: AI Family Reminders](https://parendipity.ai/blog/ai-tools-automate-family-reminders) · [TeamLinkt: TeamSnap-Alternativen](https://teamlinkt.com/blog/best-teamsnap-alternatives) · [Klubraum: 17 Apps im Vergleich](https://klubraum.com/blog/the-17-best-apps-for-your-team-comparison/)
- Teamer: [GetApp: Teamer](https://www.getapp.com/recreation-wellness-software/a/teamer/) · [Capterra: Teamer Alternatives](https://www.capterra.com/p/160000/Teamer/alternatives/)
- Nische Skating: [EntryEeze](https://www.entryeeze.com/) · [EntryEeze: How It Works](https://www.entryeeze.com/howitworks_comp.htm) · [Uplifter: Skate Club Software](https://www.uplifterinc.com/skate-club-management-software) · [World Skate: RollArt](https://www.worldskate.org/artistic/news-artistic/1601-rollart-the-new-born-artistic-judging-system.html) · [RollArt Calculator Launch](https://www.worldskate.org/news/45-artistic/3251-rollart-calculator-app-launched-in-lisbon.html) · [RollArt System (PDF)](https://www.universopatin.com/files/ROLLART_The_System.pdf) · [DRIV Rollkunstlauf](https://www.rollkunstlauf-driv.de/) · [DRIV Wertungskriterien](https://www.rollkunstlauf-driv.de/reglement/wertungskriterien)
- Video-Coaching: [OnForm](https://onform.com/) · [OnForm vs. CoachNow/V1/Sportsbox](https://onform.com/blog/onform-vs-v1-coachnow-and-sportsbox-the-best-video-analysis-tool-for-coaches/) · [CoachNow Video Analysis](https://coachnow.com/video-analysis) · [CoachNow Analyze](https://coachnow.com/analyze)
