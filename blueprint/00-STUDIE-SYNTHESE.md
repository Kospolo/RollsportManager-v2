# RollsportManager v2 — Gesamt-Synthese der Studie

**Rolle:** Chef-Architekt (Synthese aus 14 Fachreports)
**Datum:** 2026-07-09
**Grundlage:** Die 14 Reports in `blueprint/research/01–14`. Diese Synthese dedupliziert und priorisiert deren Befunde; Detailbelege und Datei-Referenzen stehen in den Einzelreports.

---

## 1. Was die App heute ist (Feature-Kern)

RollsportManager ist eine **funktional außergewöhnlich breite Vereins-Management-Plattform für Rollkunstlauf** — „200+ Funktionen" über 40+ Domänen, die kein Generalist (Spond, SportMember, ClubDesk, easyVerein, Teamer) in dieser Tiefe abdeckt.

**Plattform-Landschaft — 5 Frontends, 1 Backend, jedes Feature bis zu 4× implementiert:**

| Frontend | Technologie | Umfang |
|---|---|---|
| iOS/iPadOS/macOS | SwiftUI, GRDB (Offline), StoreKit | 277 Swift-Dateien, ~128.500 Zeilen, v1.8 |
| watchOS | SwiftUI | 5 Views, ~1.600 Zeilen |
| iOS-Widgets | WidgetKit | Home + Lock Screen |
| Android | Kotlin, Jetpack Compose, Hilt, Room, Media3 | 307 Dateien, ~108.700 Zeilen |
| Web-Portal + Website + Admin | Statisches HTML/Vanilla-JS (kein Build) | ~129 HTML-Seiten (Portal 87), ~30k Zeilen JS |
| Backend | Self-hosted Supabase (Docker/Kong/Postgres/Realtime/Storage) | 34 Migrationen, 6 Edge Functions, 1 Push-Worker |

Produktion läuft als **Docker-Stack auf einem privaten Mac Studio** unter `rollsportmanager.de`.

**Der fachliche Kern (Domänen-Moat, den v2 bewahren muss):**
- **Küren & Training** (Alleinstellungsmerkmal): CRUD mit Status-Workflow, Medien, Bewertungen (Technik/Ausdruck/Synchron), Video-Timestamps und ein **Trainings-Audio-Player** mit Tempo 0,5–2,0×, A-B-Loop, Countdown (0/3/5/8 s), Waveform, klickbaren Timestamps — auf Android als **Media3-Hintergrund-Service**, der Audio-Focus bewusst nicht abgibt (Kürmusik läuft bei Anruf/Sperre/Turnier weiter). Der stärkste Einzel-Baustein der ganzen App.
- **Verein/Team/Familie**: 6-Rollen-Modell (mitglied → super_admin, Level 0–5) plus granularer, zeitlich befristeter Gast-Trainer-Zugang; Familien-Modell (parent_id/parent2_id, Kind-Konten ohne E-Mail, Upgrade ab 16).
- **Termine/Anwesenheit/QR-Check-in** mit 4 Antwort-Status inkl. „krank", Belegungsplan-Konfliktprüfung.
- **Wettkampf** mit Live-Scoring und Verbandsmeldung.
- **Finanz-Suite** (überraschend tief): Rechnungen, 5-stufiges Mahnwesen, Kassenbuch, Budget, Jahresabschluss, SEPA-Export, Spendenbescheinigungen, GoBD-Archivierung, Pflichtstunden.
- **Kommunikation** (Chat/DM/Voice-to-Text/News), Gamification, Equipment/Hallen/Schließfächer, Dokumente/Galerie.
- **Monetarisierung** zweigleisig: Nutzer-IAP (0/2/5 €) + Vereins-Lizenzen (9/29/59 €) + Werbung + Trainer-Limits.
- **5 Sprachen** (DE/EN/FR/RU/TR) auf allen Plattformen.

**Feature-Parität** der Fach-Features über iOS/Android/Web ist nach dokumentierten Harmonisierungswellen hoch — erkauft durch manuelle Checklisten-Synchronisation. Größte Lücken: Android ohne Offline-Modus & Widgets, Watch-App funktional tot, Zahlungs-Flows überall unfertig.

---

## 2. Die 10 größten Probleme/Altlasten (dedupliziert, priorisiert)

Über alle 14 Reports hinweg kondensiert. Priorität = P0 (sofort, existenzkritisch/Sicherheit) bis P3.

### P0 — Sicherheit & Geld (existenzkritisch, auch für v1 sofort)

**1. Gebrochener Vertrauensanker: Supabase-Demo-JWT-Secret in Produktion (K1, seit 13.06.2026 offen).**
Das `JWT_SECRET` ist der weltweit bekannte Supabase-CLI-Demo-Default (in `.env`, `signing_keys.json`, `volumes/db/jwt.sql`, im Klartext in mehreren `CLAUDE.md` und in `www/assets/js/supabase.js`). Jeder kann sich ein gültiges `service_role`-Token signieren und über das öffentliche Gateway **die komplette DB unter Umgehung aller RLS lesen/schreiben** — inklusive Minderjährigen-Daten, Zahlungen, SEPA. Meldepflichtiger DSGVO-Vorfall. Entwertet jede weitere Sicherheitsmaßnahme. (Reports 01, 02, 06, 07, 08, 13, 14)

**2. Zweite, unabhängige Privilege-Escalation: `users`-Update-Policy ohne `WITH CHECK`.**
Jedes eingeloggte Mitglied kann per PostgREST-PATCH die eigene `role` auf `super_admin` setzen (kein `WITH CHECK`, kein Trigger). Funktioniert auch bei behobenem Demo-Secret. Dazu: `activate_premium`/`process_purchase`-RPCs sind für alle `authenticated` ohne Kaufnachweis ausführbar (Selbst-Freischaltung), Vereinsinhaber können sich per RLS selbst lizenzieren, `payment_method_config` gibt Stripe-Secrets an jeden eingeloggten User aus. (Reports 07, 08, 09)

**3. Zahlungssystem kaputt — größeres Umsatzleck als KetoTracker.**
Die Kauf-zu-Freischaltung-Kette ist an jeder Stelle unterbrochen: iOS-`activatePremium()` hat null Aufrufer (Server erfährt vom Kauf nichts, zahlender Kunde sieht weiter Werbung); Vereinslizenz-Kauf scheitert am Super-Admin-Guard, während Apple abbucht; Android hat **kein Play Billing** (Kauf-Buttons sind Attrappen); Stripe/PayPal/SEPA-Checkouts sind überall Stubs — real funktioniert nur manuelle Überweisung. Webhooks ohne verpflichtende Signaturprüfung (Rechnungen fälschbar bezahlbar), 3 widersprüchliche Preisquellen, 2 unsynchronisierte Lizenz-Datenmodelle, iOS-Kaufsheet bewirbt externe Zahlwege (Guideline-3.1.1-Reject-Risiko). **SEPA-Lastschrift fehlt komplett** — im DACH-Vereinsmarkt K.-o.-Kriterium. (Reports 01, 09, 12, 13)

**4. Secrets im Repo + weitere schwache Betriebssecrets.**
`signing_keys.json` trotz `.gitignore` in Git-Historie; Service-Role-Key + APNs-Key hartkodiert in `workers/start-push-worker.sh`; SMTP-Klartext in `config.toml`; Android-Keystore-Passwort `ch4ngeM3` (Malware-Update-Risiko); `admin@rollsportmanager.de / admin123` im Klartext in `www/portal/debug.html` **im öffentlichen Prod-Image**; Service-Role-Key wird in `admin/server-settings.html` ins DOM gerendert. Passwort-Stamm `ch4ngeM3` projektübergreifend wiederverwendet. (Reports 04, 05, 06, 08)

### P1 — Struktur & Architektur (Kern-Kostentreiber)

**5. Vierfach-Implementierung ohne geteilten Vertrag — die Systemkrankheit.**
Jedes Feature wird bis zu 4× (Swift/Kotlin/JS/Watch) manuell nachgezogen; Synchronisation per Checkliste (`HARMONISIERUNGSPLAN.md`, Android-`CLAUDE.md` mit 27 Nachzieh-Punkten). Handgeschriebene CodingKeys/`@SerialName` statt generierter Typen → **belegte Drift-Bugs** (Android `content` vs. DB `nachricht`, veraltetes `VereinNews`-Modell). Kein Codegen, faktisch keine Tests bei ~350.000 Zeilen Client-Code. (Reports 01, 04, 13, 14)

**6. God-Objects & Monolithen.**
iOS `SupabaseManager.swift` = 8.520 Zeilen / 301 Funktionen (die gesamte Fachlogik in einer `@MainActor`-Singleton-Klasse, zweitgrößter Graph-Knoten); dazu Views bis 3.591 Zeilen (`AdminView`), 3.510 (`KuerDetailView`). Android: `MainNavigation.kt` 1.953 Zeilen mit 129 String-Routen, `KuerDetailScreen.kt` 2.316 Zeilen. Web: `portal.js` 3.349 Zeilen God-Object. 90/151 iOS-Views greifen direkt auf `SupabaseManager.shared` zu (MVVM nur Fassade); Android: 44/45 ViewModels ignorieren `BaseViewModel`. (Reports 02, 03, 04, 05)

**7. Web-Portal technologisch am Ende.**
87 statische HTML-Seiten (bis 113 KB), Sidebar per `sed`-Skript in jede Seite kopiert, 2 parallele i18n-Systeme (`translations.js` 13k + `i18n.js` 7,7k Zeilen), 338 `innerHTML`-Zuweisungen mit inkonsistentem Escaping (systematisches XSS-Risiko), manuelles `?v=N`-Cache-Busting, Deploy nur per `docker compose build --no-cache`. Admin-Gate rein clientseitig. SEO schwach (veraltete Sitemap, kein hreflang/JSON-LD trotz 5 Sprachen). (Reports 05, 13, 14)

**8. Schema-Chaos: 5 unkoordinierte Quellen, kein Migrationstool.**
Backend-Migrationen (34) + Portal-Parallel-Schema (718 Zeilen, englisch) + iOS-FIX-SQLs + Android-Migration + direkte Live-DB-Änderungen ohne Migration. Kollidierende Doppel-Tabellen (`invoices`/`payments` deutsch UND englisch, `team_trainer` vs. `team_trainers`, `uebungen` vs. `ubungen`, `documents` in 4 Versionen), Duplikat-Spalten (`termine.titel`+`title`), deutsch/englisches Misch-Schema mit deutschen Enums. **Der echte Prod-Schemazustand ist nur aus der laufenden DB rekonstruierbar.** Dazu RLS-Lücken (öffentlich lesbare SMTP-/Bankdaten via `vereine`-SELECT), Finanzdaten via `ON DELETE CASCADE` löschbar (GoBD-Verstoß), Race-Conditions (Rechnungsnummer per `COUNT(*)+1`). (Reports 06, 07, 09)

### P2 — Daten, Betrieb, Offline

**9. Betrieb als Prototyp in Produktion + Medien als Base64 in Postgres.**
Single Point of Failure auf privatem Mac (Backups auf derselben Platte, DB-Port 5432 im LAN exponiert, kein Staging/CI/CD/Monitoring, kein Git-Remote fürs Backend). Push defekt (APNs-Sandbox in Prod, Worker ohne Autostart, Android-FCM über abgekündigte Legacy-API). Kür-Medien liegen als **Base64-TEXT in Postgres** (`kuer_media.file_data`, DB 1,3 GB, Storage-Volume 0 B) — parallel zu Supabase Storage für Chat/Avatare: zwei Medien-Welten, DB-Bloat, kein Streaming, bis zu 3 Kopien pro Medium auf iOS. (Reports 01, 06, 07, 10, 11)

**10. Kein echter Offline-Sync + kaputte Plattform-Extras.**
Drei divergierende Offline-Implementierungen (iOS GRDB + JSON-Schatten-Cache, Android Room mit nur 5 Entities, Web gar nichts), alle **read-only** — keine Outbox/Write-Queue, kein Delta-Sync, keine Konfliktlösung, keine Tombstones. Offline Anwesenheit/Zusage/Chat in der Halle unmöglich, obwohl `FUNKTIONEN.md` es verspricht. Watch-App funktional tot (`WatchConnectivityManager` in keinem Build-Target). Kein Design-System (631 Ad-hoc-Farben, >130 fixe Schriftgrößen, 1 accessibilityLabel im ganzen iOS-Projekt, Dark-Mode erzwingt Light). Realtime-Wildwuchs (iOS-Chat toter Code, Portal pollt trotz Publikation). (Reports 02, 03, 04, 10, 11)

---

## 3. Die wichtigsten Chancen/Erneuerungen für v2

**A. Zahlungen zuerst end-to-end fertigstellen — Umsatz-Fundament.**
Entitlements **strikt serverseitig** (eigene `entitlements`-Tabelle, nur `service_role`-beschreibbar, Clients nur SELECT). RevenueCat für Mobile-IAP; Stripe Billing für Vereinslizenzen im Web (spart 30 % Provision, umgeht Guideline 3.1.1); **Stripe Connect** für Mitgliedsbeiträge statt Vereins-eigener Klartext-Keys; SEPA-Lastschrift via Stripe SEPA Debit/GoCardless mit echtem Mandats-Management. Rechnungs- und Mahnläufe serverseitig automatisieren (Zero-Touch-Billing). Kein Zahlungs-Button existiert in v2, bevor er funktioniert.

**B. Eine Business-Logik, viele Oberflächen — Drift strukturell eliminieren.**
Typen aus dem Postgres-Schema für Swift/Kotlin/TypeScript generieren (Codegen in CI), Fachlogik in RPCs/Edge Functions ziehen (thin clients), geteiltes Design-Token-System (Style Dictionary → Swift/Kotlin/CSS). Beendet CodingKeys-Fragilität und die 4×-Checklisten-Synchronisation.

**C. Web-Portal als echte Next.js/React/TS-SPA — größter Einzelgewinn.**
Ersetzt 87 statische HTML-Seiten + 30k Zeilen JS + i18n-Monolith. Server Components beenden das XSS-Muster strukturell, echte geschützte Routen (Middleware statt clientseitiger Redirect), SSR/SSG für SEO (hreflang, JSON-LD, lokalisierte Routen), ein Design-System, ein i18n-Framework. Wird das primäre Desktop-Erlebnis (Kassenwart-Persona).

**D. Kern vs. aktivierbare Module trennen.**
Kern = Mitglieder/Teams/Familie, Termine/Anwesenheit, Küren/Training, Kommunikation, Beiträge. Rest (Schließfächer, Equipment, Hallen, Pflichtstunden, Buchhaltung, Wettkampf, Gamification) als pro Verein aktivierbare Module → löst Feature-Sprawl und schafft Lizenz-Tiers. Rollenbasierte Workspaces statt 45-Ziele-Navigation.

**E. Die Rollsport-Nische als Marketing-Speerspitze ausbauen (Moat, den kein Generalist bedient).**
RollArt-kompatibler digitaler Wertungsbogen (Element-Codes, TVE/QOE/Komponenten, Score-Historie); Wettkampf-Management komplett (Online-Meldung mit Startgeld, Laufplan-/Startreihenfolgen-Generator, PDF-Urkunden — EntryEeze-Prinzip); Kür-Musik-Studio (Trim/Fade, Längen-Check je Kategorie, Offline-Wettkampf-Playlist); Video-Analyse light (Zeitlupe, Telestration, Side-by-Side — OnForm/CoachNow-Funktionen).

**F. Marktstandard-2026-Features nachziehen.**
Guardian-Modell 2.0 nach Spond (Eltern-Einsicht, Zu-/Absagen im Namen des Kindes, Fahrgemeinschaften); KI-Copilot (Admin-Assistent, Auto-Erinnerungen, Chat-Zusammenfassungen — lokales Ollama günstig pilotierbar); DATEV-Export + E-Rechnung (XRechnung/ZUGFeRD); digitales Onboarding (Beitritt + Tarif + SEPA-Mandat + Einwilligungen).

**G. Offline-First plattformübergreifend + Medien in Object Storage.**
Offline-Tiering nach realen Hallen-Szenarien (Tier 1 voll offline: Anwesenheit/Zusagen/Notizen/Chat-Queue; Tier 3 server-autoritativ: Zahlungen/Rollen). Eine Sync-Engine für alle Plattformen (PowerSync als Empfehlung). Base64-Medien nach Storage migrieren, Background-Downloads mit Pinning/LRU.

**H. Betrieb professionalisieren.**
Weg vom privaten Mac (Managed Supabase EU oder Hetzner-Self-Host), frische Keys + Secret-Management ab Tag 1, ein Migrationstool mit Prod-Schema-Baseline, CI/CD + Staging + Sentry, 3-2-1-Backups mit Offsite + Uptime-Monitoring.

**I. Design-System, Accessibility & Ökosystem als Merge-Gates.**
Design-Token-System als erstes Artefakt (Farben/Typo/Spacing/Dark-Light); Accessibility (Labels, Dynamic Type, Kontrast — BFSG-Pflicht) und Dark Mode als Definition of Done statt Nachtrag. Ökosystem-Chancen: Live Activities/Dynamic Island für Wettkampf-Tag, App Intents für Check-in, eine Push-Pipeline (APNs+FCM v1+Web-Push), Universal/App Links als plattformübergreifender Routen-Contract.

---

## 4. Offene Architektur-Entscheidungen für das Design-Team

Diese Weichen muss das Design-Team bewusst stellen. Report 14 vergleicht die Client-Stack-Optionen im Detail.

### E1 — Client-Stack (die zentrale Entscheidung)

Vier Optionen (Report 14), bewertet für **Solo-Dev mit Claude Code**:

| Option | Ansatz | Kern-Pro | Kern-Contra |
|---|---|---|---|
| **A — Native+ mit Shared Contract** *(empfohlen)* | SwiftUI + Jetpack Compose + Next.js-Web; Typen aus Schema generiert, Logik in RPCs, geteilte Design-Tokens | Nutzt vorhandene Skills 100 % (GOMESSMO/KetoTracker-Muster); beste Watch/Widgets/Audio-Qualität; minimales Store-Risiko; Claude Code macht UI-Portierung billig | Fachlogik-Drift nur via Codegen/Disziplin verhindert, nicht per Compiler; höchste Gesamt-Codemenge |
| **B — KMP** *(Plan B)* | Geteilte Logik in Kotlin Multiplatform, native UI (SwiftUI/Compose), Web weiter Next.js | Löst Mobile↔Mobile-Drift im Compiler | Toolchain-Doppelbelastung, ObjC-Interop-Debugging; Web bleibt außen vor; genau das, was KMP spart, macht Claude Code ohnehin billig |
| **C — Flutter** | Eine Mobile-Codebase | Höchste Feature-Velocity Mobile | Watch unmöglich, Widgets nur nativ; entwertet ~240k Zeilen native Erfahrung; Audio-Engine über Plugin-Grenzen neu |
| **D — React Native + Next.js** | TS-Monorepo Web+Mobile | Einzige Option mit echt geteiltem Code Web↔Mobile | Geringste Nutzer-Erfahrung; Watch unmöglich; Audio/Offline plugin-abhängig |

**Report-14-Empfehlung: Option A** („Native+ mit Shared Contract"), **KMP als dokumentierter Plan B** für den Mobile-Datenlayer, falls Drift trotz Codegen schmerzt (Repository-Schicht dafür extraktionsfähig halten). Begründung: Das v1-Problem war nie das Framework, sondern der fehlende Vertrag; Watch/Widgets/App Intents/Audio erzwingen ohnehin Swift; der Solo-Dev-Multiplikator heißt Claude Code, nicht Code-Sharing.
**Offen für das Design-Team:** Zustimmung zu A, oder bewusste Abweichung (z. B. wenn Team wächst → dann KMP).

### E2 — Backend: evolvieren oder neu?
Konsens aller Reports: **Supabase-Idee (Postgres + RLS + Realtime) behalten, Schema neu aufbauen** (nicht sanieren). Offen: (a) **Managed Supabase EU** vs. **Hetzner-Self-Host** (Datenschutz-Argument für Self-Host vs. Betriebslast); (b) **dünne typisierte API-Schicht** für alle Schreiboperationen (Hono/Fastify/Next oder Edge Functions mit Per-Function-JWT) vs. weiter PostgREST-Direktzugriff mit RLS.

### E3 — Auth-Fundament
**Asymmetrische Signatur (RS256/ES256)** statt geteiltem HS256-Secret (beseitigt K1-Ursache); Rollen aus **verifizierten JWT-Claims** statt editierbarer `users.role`-Spalte; kurzlebige Access-Tokens (5–15 min) + Refresh-Rotation. Offen: Umfang der API-Schicht als Durchsetzungspunkt.

### E4 — Identität & Mandanten-Modell
Report 07 empfiehlt: **eine Identität** (`profiles.id UUID = auth.users.id`, kein BIGSERIAL-Doppel) und **`club_members(club_id, user_id, role)`** statt globaler `users.verein_id` + `users.role` → Mehrvereins-Fähigkeit, Gast-Trainer als befristete Mitgliedschaft. Offen: Wird Mehrvereins-Mitgliedschaft ein v2-Ziel? (Beeinflusst RLS-Design grundlegend.)

### E5 — Offline-/Sync-Strategie
Report 10 empfiehlt **PowerSync** (self-hostbar, offizielle Supabase-Integration, Swift/Kotlin/JS-SDKs, eingebaute Upload-Queue) als eine Sync-Engine für alle Plattformen; ElectricSQL nur bei TypeScript-first; Eigenbau nur bei bewusst kleinem Offline-Scope. Offen: PowerSync als Infrastruktur-Baustein akzeptieren vs. Offline-Scope klein halten und Eigenbau-Outbox. Voraussetzung in jedem Fall: UUIDs + `updated_at` + Soft-Deletes im Schema.

### E6 — Payment-Provider
RevenueCat (Mobile-IAP) + Stripe Billing (B2B-Lizenzen) + Stripe Connect (Mitgliedsbeiträge) vs. Eigenbau (App Store Server API v2 + Play RTDN). Offen: RevenueCat-Abhängigkeit akzeptieren (robuster für Solo-Dev) vs. vermeiden.

### E7 — Schema-Sprache & Preismodell
Konsens: **englisches, konsistentes Schema**, deutsche Begriffe nur in i18n. Offen: (a) Big-Bang-Rename vs. `api`-Schema mit Views über Alt-Tabellen; (b) Preismodell — Report 13 empfiehlt Vereinfachung zum **Spond-Muster** (Verein zahlt Staffel, Mitglieder/Eltern kostenlos & werbefrei) statt des erklärungsbedürftigen Doppelmodells.

### E8 — Migrationsstrategie
Report-14-Reihenfolge: (1) Backend härten + Codegen, (2) Next.js-Portal (größter Hebel, kein Store-Review), (3) iOS v2, (4) Android v2, (5) v1-Sunset — beide Generationen laufen übergangsweise gegen dasselbe Backend. Bestandsdaten per einmaligem ETL (1,3-GB-DB klein genug für Big-Bang mit Wartungsfenster). Offen: Bestätigung der Reihenfolge.

---

## 5. Was aus der alten App übernommen werden kann

Der wertvollste Bestandteil ist **nicht der Code, sondern das darin kodierte Domänenwissen**. v1 gezielt als Spezifikation plündern.

**Als fachliche Spezifikation (Gold wert):**
- **Feature-/Datenfeld-Referenz**: 63 iOS-Model-Dateien + 46 Android-Data-Classes inkl. CodingKeys/`@SerialName` dokumentieren das komplette Schema faktisch fehlerfrei; `FUNKTIONEN.md` + `HARMONISIERUNGSPLAN.md` + `docs/modules/01–11` sind ein praxisvalidiertes Anforderungsdokument.
- **Fachliches Domänenmodell**: Küren-Komplex, Wettkampf-Livemodus, Finanz-/GoBD-Konzept, Pflichtstunden, Familien-Modell (parent_id), Per-Verein-Zahlungskonfiguration-Idee, 6-Rollen-Modell + granulare Gast-Trainer-Flags (als generisches Permission-System übernehmen).
- **UX-Journeys**: die 4 Kern-Flows, Termin-Erstellungsmaske mit Konfliktprüfung, Mahnwesen-Stufenlogik, Join-Code-Onboarding mit Demo-Daten.

**Als konkret portierbarer Code/Assets:**
- **Kür-Audio-Player-Konzept**: Android `PlaybackService.kt` (MediaSessionService, kein Audio-Focus-Verlust, `onTaskRemoved`-Logik) 1:1 auf aktuellem Media3 (≥1.5) — der USP. Feature-Liste Tempo/Loop/Countdown/Waveform/Timestamps.
- **Finanz-/PDF-Services** (iOS `Services/Finance/*`: Rechnungs-/Mahn-PDF, Export) — fachlich ausgereift.
- **Widget + WidgetDataManager** (fast unverändert), **QR-Check-in-Kette** (ZXing + MLKit/CameraX, plattformkompatible Codes).
- **5-Sprachen-Übersetzungsbestand** (~1.410 Keys × 5) nach Bereinigung in String Catalogs / next-intl.
- **StoreKit-Grundgerüst** und Preis-/Limit-Modell als fachliche Vorlage — in v2 aber **serverseitig durchsetzen**.
- **Backend-Muster**: RLS-Grundidee, Outbox-Pattern für Push (`push_queue` + Trigger + Worker), Webhook-Signaturverifikation, gute Einzel-Migrationen (Audit-Log/Archivierung, Attendance-Policies), Nginx-Reverse-Proxy-Muster (`/rest`, `/auth` same-origin).
- **Android-Struktur** als saubere Vorlage: Repository-Pattern mit Offline-Branch, Hilt-DI, NetworkMonitor als Flow.

**Ausdrücklich NICHT übernehmen:**
`SupabaseManager`-God-Object, dreifache Typwelten/RSM-Prefix, `MainNavigation`-Monolith, `portal.js`-God-Object + 87 statische HTML-Seiten, `PaymentManager.swift` (Demo-Stripe mit eigener Kartenvalidierung, PCI-Risiko), doppeltes Lizenzmodell, Secrets in client-lesbaren Tabellen, Base64-Medien-Ablage, deutsch/englisches Misch-Schema, Klartext-SessionManager, ProGuard-Pauschal-Keeps, iOS-GRDB-Schema als lokale Voll-Duplikat-Altlast.

---

## 6. Fazit in einem Satz

RollsportManager v1 ist ein **fachlich reiches, praxisvalidiertes Domänenmodell in einer architektonisch erschöpften, sicherheitskritisch gebrochenen 4×-Codebasis** — v2 sollte das Domänenwissen und den Rollsport-Nischen-Moat bewahren, aber auf ein neues Fundament stellen: gehärtete Auth ohne Demo-Secret, serverseitige Entitlements + funktionierende Zahlungen (inkl. SEPA), ein schema-generierter Shared Contract statt manueller Vierfach-Synchronisation, ein Next.js-Portal statt 87 HTML-Seiten, Medien im Object Storage und professioneller Betrieb weg vom privaten Mac — bei Client-Stack-Option **A (Native+ mit Shared Contract)** als empfohlener Grundentscheidung.
