# 14 — Tech-Stack-Optionen für den v2-Neuaufbau

**Rolle:** Software-Architekt (Tech-Scout)
**Datum:** 2026-07-09
**Scope:** Web + iOS + macOS + Android (+ Apple Watch / Widgets), Backend bleibt evolvierbares self-hosted Supabase
**Rahmenbedingung:** Solo-Entwickler mit Claude-Code-Unterstützung; bestehende Erfahrung mit SwiftUI, Jetpack Compose, Next.js (GOMESSMO) und Flutter/React (KetoTracker)

---

## 1. Überblick

RollsportManager v1 ist eine funktional sehr breite Vereins-Management-Suite (200+ Funktionen laut `rollsportmanager-ios-macos/FUNKTIONEN.md`): Mitglieder, Teams, Trainer, Termine, Wettkämpfe, Küren mit Audio/Video-Player, Zahlungen/Abos inkl. Mahnwesen, Übungsbibliothek, Dokumente, Galerie, Check-in per QR, Schließfächer, Pflichtstunden, Gamification.

Die Suite wurde **viermal parallel implementiert**:

| Plattform | Technologie | Umfang |
|---|---|---|
| iOS + iPadOS + macOS | SwiftUI (ein Codebase, 3 Targets) | 277 Swift-Dateien, ~128.500 Zeilen |
| Apple Watch + Widgets | SwiftUI (eigene Targets) | Watch-App + WidgetKit-Target |
| Android | Kotlin / Jetpack Compose | 307 Kotlin-Dateien, ~108.800 Zeilen |
| Web-Portal + Website | Statisches HTML/JS (kein Framework, kein Build) | 129 HTML-Dateien (~78.700 Zeilen), 18 JS-Dateien (~30.300 Zeilen) |
| Backend | Self-hosted Supabase (Docker: Kong, Postgres, GoTrue, Realtime, Storage, Edge Functions, Supavisor u. a.) | 34 Migrationen, 6 Edge Functions, 1 Node-Push-Worker |

Das zentrale strukturelle Problem von v1 ist **nicht die Wahl der Frameworks**, sondern die **manuell gepflegte Vierfach-Implementierung ohne geteilten Vertrag**: Jedes Feature wird per Checkliste auf allen Plattformen nachgezogen (`rollsportmanager-backend/CLAUDE.md`, Abschnitt „KRITISCH – PLATTFORM-SYNCHRONISATION"), Modelle driften nachweislich auseinander (dokumentierte Bugs), und der Abgleich benötigt eigene Planungsdokumente (`HARMONISIERUNGSPLAN.md`, `ENTWICKLUNGSPLAN.md`). Die Tech-Stack-Entscheidung für v2 muss daher primär die Frage beantworten: **Wie wird Drift architektonisch unmöglich gemacht — durch geteilten Code oder durch geteilte, generierte Verträge?**

---

## 2. Ist-Zustand im Detail (mit Datei-Referenzen)

### 2.1 iOS / macOS / Watch (SwiftUI)

- **Projektstruktur:** `xcodegen` mit `project.yml`; SPM-Pakete `supabase-swift` (ab 2.0) und `GRDB.swift` (ab 7.0) für Offline-SQLite (`rollsportmanager-ios-macos/project.yml`). Zusätzlich CocoaPods **nur** für Google Mobile Ads (`rollsportmanager-ios-macos/Podfile`) — zwei Dependency-Manager parallel.
- **God-Object:** `RollsportManager/Services/SupabaseManager.swift` hat **8.520 Zeilen** und laut Wissensgraph (`graphify-out/GRAPH_REPORT.md`) **412 Kanten** — der zweitgrößte Knoten des gesamten Systems nach `String`. Praktisch die gesamte API-Schicht, Payment-Modelle, Auth und Business-Logik in einer Datei.
- **Weitere Monolithen:** `Views/Admin/AdminView.swift` (3.591 Zeilen), `Views/Kuer/KuerDetailView.swift` (3.510), `Views/Mitglieder/MitgliederListView.swift` (2.279), `Views/Dashboard/DashboardView.swift` (2.258), `Services/DatabaseManager.swift` (2.127, GRDB-Offline-Schicht).
- **Doppelte Typwelten:** `REPARATUR_PLAN.md` dokumentiert doppelte Typ-Definitionen (GRDB-Modelle in `Models/` vs. Supabase-API-Typen in `ViewModels/`), die per `RSM`-Prefix-Umbenennung „repariert" wurden — ein Symptom fehlender Codegenerierung.
- **Fragiles Mapping:** Jedes Modell braucht handgeschriebene `CodingKeys` (snake_case ↔ camelCase); `CLAUDE.md` warnt mehrfach in Großbuchstaben, niemals `keyDecodingStrategy` zu aktivieren, weil sonst Login bricht — ein klassischer „Tribal-Knowledge"-Vertrag statt eines maschinellen.
- **Repo-Hygiene:** Im Repo-Root liegen Altlasten wie `FIX-ALL.sql`, `FIX-ENUM.sql`, `COMPLETE-FIX.sql`, `Podfile 2`, `RollsportManager 2.xcodeproj`, diverse Ruby-Reparaturskripte (`fix_watch_target.rb`, `fix_watch_target2.rb`, `remove_watch_dependency.rb`) — Spuren manueller Projektdatei-Chirurgie.
- **Watch + Widgets existieren** (`RollsportManager Watch App/`, `RollsportManagerWidget/`) und sind reine SwiftUI/WidgetKit-Targets — genau der Teil, der in jedem Szenario nativ bleiben muss.
- **Tests: faktisch null.** `RollsportManagerTests/RollsportManagerTests.swift` hat 17 Zeilen (Xcode-Template).

### 2.2 Android (Kotlin / Jetpack Compose)

- **Stack:** Compose BOM 2024.10.01, Material3, Hilt, `supabase-kt` 3.x (postgrest/auth/storage/realtime), Ktor 3, Room für Offline, Media3/ExoPlayer inkl. Foreground-Service für Hintergrund-Audio, CameraX + ML Kit für QR (`rollsportmanager-android/app/build.gradle.kts`).
- **Harmonisierung als Dauerprojekt:** `rollsportmanager-android/CLAUDE.md` ist im Kern ein Protokoll des Hinterherbauens („iOS ist die Referenz/Vorlage — NICHT ÄNDERN!"), mit Feature-Paritätstabellen und Punkt-für-Punkt-Nachbauten (Gradient-Hero-Sections, Waveform mit 24 Balken, 8-Sekunden-Countdown „wie iOS").
- **Belegte Drift-Bugs:** Android-`Message.kt` nutzte `content`, die DB aber `nachricht`; `VereinNews.kt` war „komplett veraltet" gegenüber iOS/DB und musste generalüberholt werden (`rollsportmanager-android/CLAUDE.md`, Punkt 27). Genau diese Bug-Klasse entsteht zwangsläufig ohne generierte Typen.
- **Tests:** 1 Kotlin-Testdatei im gesamten Projekt.

### 2.3 Web-Portal + Website (statisches HTML/JS)

- **Kein Framework, kein Build-System:** 87 Portal-Seiten unter `rollsportmanager-backend/www/portal/` plus Admin-Panel unter `www/admin/` (10+ Sektionen), alles Vanilla-JS mit globalem Zustand `window.PortalState` (`www/assets/js/portal.js`).
- **Cache-Busting von Hand:** JS-Versionierung per manuellem `?v=X`-Query-Parameter, dokumentiert als Pflichtritual inkl. bekanntem Fehlerbild „Änderungen nicht sichtbar" (`rollsportmanager-backend/CLAUDE.md`).
- **Deployment koppelt Content an Image-Build:** Website-Änderungen erfordern `docker compose build --no-cache` — „Nur restart reicht NICHT" (`rollsportmanager-backend/CLAUDE.md`).
- **i18n als 13.026-Zeilen-Monolith:** `www/assets/js/translations.js` hält 5 Sprachen (DE, EN, FR, RU, TR) in einer Datei.
- **Demo-Modus hart einkodiert** in `portal.js` (DEMO_DATA mit Fake-User).
- **Duplizierte Fachlogik in JS:** z. B. Chat (`portal-chat.js`, 779 Zeilen), Küren (`portal-kueren.js`, 1.191 Zeilen) — dritte Vollimplementierung derselben Features.

### 2.4 Backend (self-hosted Supabase)

- **Vollständiger Supabase-Stack in Docker** (`rollsportmanager-backend/docker-compose.yml`): studio, kong, auth, rest, realtime, storage, imgproxy, meta, functions, analytics, db, vector, supavisor. Produktion läuft auf diesem Mac hinter rollsportmanager.de.
- **34 SQL-Migrationen** (`migrations/`), fachlich gut geschnitten (z. B. `20260111_payment_system.sql`, `20260215_finance_tables.sql`, `20260201_wettkampf_modus.sql`), plus RLS-Policies als Sicherheitsmodell.
- **Edge Functions (Deno):** `functions/stripe-webhook`, `paypal-webhook`, `send-push-notification`, `send-parent-invitation`, `send-beta-welcome`, `send-test-email`.
- **Push-Worker (Node):** `workers/push-worker.js` arbeitet eine `push_queue`-Tabelle ab und sendet direkt via APNs-HTTP/2 — solide Idee, aber ein weiterer eigener Runtime-Prozess.
- **Kritische Altlast — Demo-JWT in Produktion:** ANON_KEY/SERVICE_ROLE_KEY mit Issuer `supabase-demo` und dem öffentlich bekannten Supabase-CLI-Demo-Secret stehen im Klartext in `rollsportmanager-backend/CLAUDE.md` (Zeilen 152–155), `rollsportmanager-ios-macos/CLAUDE.md` und hartkodiert in `www/assets/js/supabase.js` (Zeile 21). Das deckt sich mit dem offenen K1-Befund des Security-Audits vom 13.06.2026. **Jeder, der das Demo-Secret kennt, kann sich Service-Role-Tokens signieren.**
- **Base64-Medien in der DB:** `kuer_media` speichert Medien als Base64 (`rollsportmanager-backend/CLAUDE.md`, Tabellenübersicht) — obwohl Supabase Storage existiert und für Chat-Bilder/Avatare genutzt wird. Bläht die DB auf und macht Backups/Streaming teuer.
- **Zahlungs-Secrets im Datenmodell des Clients:** `VereinPaymentConfig` in `SupabaseManager.swift` enthält Felder für `stripeSecretKey`, `stripeWebhookSecret`, `paypalClientSecret` — laut Kommentar „verschlüsselt gespeichert", aber das Modell ist clientseitig dekodierbar; das Design gehört in v2 vollständig serverseitig.
- **Deutsch/Englisch-Misch-Schema:** deutsche Enum-Werte (`bild`, `dokument`, `in_arbeit`), deutsche Spalten (`nachricht`, `ort`) neben englischen (`start_datetime`, `image_url`) — jede neue Integration stolpert darüber (dokumentiert als „Wichtige Spalten-Namen"-Warnliste in `rollsportmanager-backend/CLAUDE.md`).

### 2.5 Wissensgraph-Befund

`graphify-out/GRAPH_REPORT.md`: 12.668 Knoten, 26.850 Kanten, 632 Communities. Auffällig:
- `SupabaseManager` (iOS) ist mit 412 Kanten der dominante Fach-Hub — Single Point of Change für fast alles.
- `MainNavigation()` (Android, 137 Kanten) und `Screen` (136) zeigen dieselbe Zentralisierung auf Android-Seite.
- Keine Import-Zyklen — das Gesamtsystem ist groß, aber nicht zyklisch verfilzt. Gute Nachricht für eine schrittweise Migration.

---

## 3. Stärken (was v2 übernehmen sollte)

1. **Das Datenmodell ist der wertvollste Asset.** 34 Migrationen, durchdachte RLS-Policies, fachlich vollständige Tabellen (users mit parent_id-Familienmodell, memberships/invoices/payments/dunning, facilities/bookings, kueren-Komplex). Das Backend kann als Basis evolvieren statt neu entstehen.
2. **Feature-Vollständigkeit und Domänenwissen.** FUNKTIONEN.md + HARMONISIERUNGSPLAN.md sind faktisch ein fertiges, praxisvalidiertes Anforderungsdokument für v2.
3. **Native Qualität dort, wo sie zählt:** Kür-Audio-Player mit Tempo-Steuerung, A-B-Loop, Waveform, Hintergrund-Wiedergabe (Media3-Foreground-Service, AVAudioEngine mit TimePitch auf iOS), QR-Check-in via CameraX/ML Kit bzw. nativer Kamera, Offline-Sync (GRDB/Room). Diese Features rechtfertigen native Mobile-Apps.
4. **Watch-App und Widgets existieren bereits** und sind vom Nutzer auch in anderen Projekten (GOMESSMO, KetoTracker) routiniert gebaut worden — inklusive TestFlight/App-Store-Prozess.
5. **Realtime-Architektur** (Supabase Realtime für Chat/Live-Scoring) funktioniert über alle Clients.
6. **Mehrsprachigkeit (5 Sprachen)** ist vorhanden, wenn auch technisch unschön gelöst.

---

## 4. Schwächen / Altlasten

1. **Vierfach-Implementierung ohne geteilten Vertrag** — der Kern-Kostentreiber. Jedes Feature: Swift + Kotlin + JS + ggf. Watch. Drift-Bugs sind dokumentiert (Message-`content`/`nachricht`, veraltetes `VereinNews`-Modell).
2. **Handgepflegte Serialisierung** (CodingKeys/`@SerialName`) statt generierter Typen aus dem Postgres-Schema; „NIEMALS keyDecodingStrategy"-Warnungen als Ersatz für Tooling.
3. **God-Objects:** `SupabaseManager.swift` (8.520 Zeilen), `AdminView.swift` (3.591), `KuerDetailView.swift` (3.510) — schwer wart- und testbar.
4. **Sicherheits-Altlasten:** Demo-JWT-Secret in Produktion (K1, offen), Anon-Key + Service-Role-Key im Klartext in Doku-Dateien, Payment-Secrets im clientseitigen Datenmodell.
5. **Web-Portal technologisch am Ende:** 87 Seiten Vanilla-HTML/JS, globaler State, manuelles Cache-Busting, i18n-Monolith mit 13k Zeilen, Deployment nur per Docker-Rebuild. Keine Komponenten, kein Typing, kein SSR/SEO-Konzept für die öffentliche Website.
6. **Faktisch keine Tests** (iOS: 17-Zeilen-Template; Android: 1 Datei; Web: 0) bei ~350.000 Zeilen Client-Code.
7. **Base64-Medien in der DB** statt Storage/CDN.
8. **Gemischtes DE/EN-Schema** und deutsche Enums als dauerhafte Stolperfalle.
9. **Werkzeug-Zoo im iOS-Repo:** CocoaPods + SPM parallel, xcodegen plus Ruby-Fixskripte, duplizierte Projektdateien.
10. **Doku beschreibt veraltete Pfade** (`/Users/marcelgoldfuss/Desktop/claude-code/...` statt `/Users/marcelgoldfuss/Apps/...`) — CLAUDE.md-Dateien sind teils selbst gedriftet.

---

## 5. Tech-Stack-Optionen für v2 (Stand 2026, ehrlich verglichen)

Vorbemerkung zum Stand 2026 (Websuche):
- **Compose Multiplatform für iOS ist seit Mai 2025 stabil**; Version 1.11 (Mai 2026) bringt nativen Textinput und standardmäßig nebenläufiges Rendering. KMP gilt 2026 als produktionsreif und ist von Google offiziell für geteilte Logik empfohlen; Adoption von ~7% auf ~23% in 18 Monaten gestiegen.
- **Flutter** hält ~46% Marktanteil unter Cross-Platform-Frameworks; stark bei design-getriebenen Neuentwicklungen, schwach bei Web-Rendering (Canvas) und ohne Weg zu watchOS.
- **React Native:** New Architecture (JSI/Fabric/TurboModules) ist seit RN 0.76 Standard, Legacy-Architektur 2026 entfernt; Expo (SDK 55) ist der De-facto-Standardweg. Performance „nah genug an nativ für 90% der Apps".
- **Widgets/Watch bleiben in jedem Szenario nativ:** WidgetKit ist SwiftUI-only, watchOS unterstützt weder Flutter noch RN; Apple hat auf der WWDC 2025 den SwiftUI-first-Kurs (App Intents, interaktive Widgets) bekräftigt.
- **Supabase-SDKs:** Swift, Kotlin, Flutter und TypeScript sind alle offiziell supported und in v2-Generation der Client-Libraries — kein SDK-Argument gegen irgendeine Option.

Quellen: [JetBrains-Blog zu Compose Multiplatform 1.11](https://blog.jetbrains.com/kotlin/2026/05/compose-multiplatform-1-11-0/), [Kotlin-Doku: Supported Platforms](https://kotlinlang.org/docs/multiplatform/supported-platforms.html), [KMP vs. Flutter vs. RN 2026 (JavaCodeGeeks)](https://www.javacodegeeks.com/2026/02/kotlin-multiplatform-vs-flutter-vs-react-native-the-2026-cross-platform-reality.html), [Vergleich 2026 (syedali.dev)](https://syedali.dev/flutter-vs-react-native-vs-kotlin-multiplatform-2026), [Expo New-Architecture-Doku](https://docs.expo.dev/guides/new-architecture/), [RN 2026 Lagebild (Apptitude)](https://apptitude.io/blog/react-native-2026-whats-actually-changed/), [Swift vs. RN vs. Flutter für iOS 2026 (StudioKrew)](https://studiokrew.com/blog/swift-vs-react-native-vs-flutter-ios-2026/), [Supabase Client Libraries v2](https://supabase.com/blog/client-libraries-v2), [WidgetKit-Doku](https://developer.apple.com/documentation/widgetkit).

### Option A — Native bleiben: SwiftUI + Jetpack Compose + Next.js, geteiltes Design-Token-System

**Architektur:** Drei UI-Codebases wie bisher, aber mit hartem „Shared Contract": (1) Typen für Swift/Kotlin/TypeScript werden aus dem Postgres-Schema **generiert** (supabase gen types für TS; Codegen für Swift/Kotlin aus derselben Quelle), (2) Fachlogik wandert konsequent in Postgres-RPCs/Edge Functions („thin clients"), (3) Design-Tokens (W3C-Token-JSON → Style Dictionary → Swift/Kotlin/CSS-Variablen) als gemeinsame visuelle Wahrheit.

**Pro:**
- Nutzt 100% der vorhandenen Erfahrung: GOMESSMO (SwiftUI + eigenes Theme.swift/GMComponents-Designsystem + Next.js-Web), KetoTracker (KetoTokens-Design-System). Der Nutzer hat den kompletten Release-Weg (xcodegen/xcodebuild/TestFlight, Play-Signing) mehrfach durchexerziert.
- Beste erreichbare Plattformqualität: Kür-Audio-Player, Kamera/QR, Offline-Sync, Hintergrund-Audio — alles bleibt erstklassig; Watch/Widgets sind ohnehin nativ und teilen sich mit der iOS-App Modelle und App Group.
- Geringstes App-Review-Risiko (keine Framework-Eigenheiten, keine JS-Bundles).
- Mit Claude Code sinken die Kosten der Mehrfach-Implementierung drastisch: UI-Portierung Swift↔Kotlin ist genau die Art repetitiver, gut spezifizierter Arbeit, die AI-gestützt schnell geht — v1 wurde de facto schon so gebaut.
- Kein Migrationsrisiko, kein neues Toolchain-Lernen; jede Plattform kann unabhängig releasen.

**Contra:**
- Die Fachlogik existiert weiterhin 3× — Drift wird nur durch Disziplin + Codegen + Contract-Tests verhindert, nicht durch den Compiler.
- Höchste Gesamt-Codemenge; jede UI-Änderung ist 3 Arbeiten (wenn auch AI-beschleunigt).
- macOS als viertes „Gratis"-Target verführt zu Sonderfällen (v1: `#if os(macOS)`-Streuung).

### Option B — Kotlin Multiplatform: geteilte Logik, native UI (SwiftUI + Compose), Web weiterhin Next.js

**Architektur:** Ein KMP-Modul enthält Modelle, Repositories, Validierung, Offline-Sync und den Supabase-Zugriff (`supabase-kt` ist multiplatform-fähig, inkl. iOS-Targets). Android nutzt es direkt, iOS via Framework-Export; UI bleibt SwiftUI bzw. Compose. Web bleibt Next.js mit `supabase-js` + generierten TS-Typen.

**Pro:**
- Löst die dokumentierte v1-Kernkrankheit (Modell-/Logik-Drift zwischen iOS und Android) **im Compiler** statt per Checkliste: `Message`, `VereinNews`, Preisberechnung, Mahnstufen-Logik existieren genau einmal.
- Native UI bleibt vollständig erhalten — keinerlei Kompromiss bei Watch, Widgets, Audio, Kamera.
- 2026 stabil und von Google empfohlen; Compose-Kenntnisse übertragen sich direkt.
- Optionaler Ausbaupfad: einzelne unkritische Screens später via Compose Multiplatform auf iOS teilen (seit Mai 2025 stabil).

**Contra für einen Solo-Entwickler:**
- **Toolchain-Doppelbelastung:** Gradle + Xcode + Kotlin/Native-Kompilierung; iOS-Debugging durch das exportierte Framework hindurch ist spürbar unbequemer; langsame Kotlin/Native-Buildzeiten.
- Swift-Interop ist weiterhin Objective-C-basiert (kein sauberer Swift-Export; Swift-Export in Arbeit, aber 2026 nicht stabil) — keine Swift-Enums-mit-Werten, keine Structs, umständliche Fehlertypen.
- **Web bleibt außen vor:** Die geteilte KMP-Logik erreicht das Next.js-Portal nicht; die Drift-Grenze verschiebt sich nur von „iOS↔Android" zu „Mobile↔Web". Für eine Verwaltungs-App mit starkem Web-Admin-Anteil ist das die Hälfte des Problems.
- AI-Unterstützung relativiert den Hauptnutzen: Das, was KMP einspart (doppelte Logik), ist genau das, was Claude Code am billigsten macht; das, was KMP kostet (Toolchain-Komplexität, Interop-Debugging), kann AI kaum abnehmen.

### Option C — Flutter für alles (realistisch: Flutter Mobile + Next.js Web)

**Architektur:** Eine Flutter-Codebase für iOS + Android (+ theoretisch macOS/Web). `supabase-flutter` ist offiziell supported. Ehrlicherweise bliebe die Website/das Portal trotzdem Next.js — Flutter Web rendert auf Canvas und ist für ein SEO-relevantes, formular- und tabellenlastiges Portal mit 87 Seiten die falsche Technologie (Accessibility, Ladezeiten, Text-Selektion).

**Pro:**
- Nur noch **eine** Mobile-Codebase; schnellste Feature-Velocity für iOS+Android gleichzeitig; Hot Reload.
- Der Nutzer hat reale Flutter-Produktionserfahrung (KetoTracker: Flutter-App live im App Store inkl. IAP/Paywall, Widgets, Watch-Anbindung, R8/MLKit-Fallen bekannt).
- Sehr konsistentes UI auf beiden Plattformen; Design-System 1× bauen.

**Contra:**
- **Watch-App unmöglich, Widgets nur als natives Swift-Add-on** mit App-Group-Datenbrücke — der v1-Bestand (Watch-Check-in, Home/Lock-Widgets) müsste ohnehin in Swift weiterleben; es entsteht wieder ein Zwei-Sprachen-Projekt.
- macOS-Desktop-Qualität von Flutter ist für eine Verwaltungs-App mittelmäßig (Menüs, Shortcuts, Fensterverhalten); realistisch ersetzt das Web-Portal die Mac-App — das gilt aber für alle Optionen.
- ~240.000 Zeilen native Erfahrung/Muster aus v1 werden entwertet; die anspruchsvollsten v1-Features (A-B-Loop-Audio mit Time-Pitch, Hintergrund-Audio, Kamera-Pipelines) müssten über Plugin-Grenzen neu gelöst werden.
- Dart als dritte aktive Sprache neben Swift-Ökosystem (Widgets/Watch) und TypeScript (Web) — für einen Solo-Dev die maximale Sprachstreuung.

### Option D — React Native (Expo) + Next.js: TypeScript-Monorepo

**Architektur:** Expo/RN für iOS+Android, Next.js für Web, gemeinsames TS-Monorepo mit geteilten Packages (Typen aus `supabase gen types`, Zod-Validierung, API-Hooks, Business-Logik). Widgets/Watch als native Swift-Targets im selben Repo.

**Pro:**
- **Einzige Option, die Web UND Mobile in einer Sprache mit echt geteiltem Code abdeckt** — Typen, Validierung, Berechnungen (Beiträge, Mahnstufen, Statistiken) existieren genau einmal und laufen im Portal wie in der App.
- Expo 2026 ist reif: New Architecture Standard, EAS Build/Submit automatisiert genau den Release-Weg, den der Nutzer sonst manuell pflegt.
- Supabase-js ist das am besten gepflegte Supabase-SDK; Realtime/Auth-Flows identisch auf Web und App.

**Contra:**
- Geringste vorhandene Erfahrung des Nutzers (React ja via KetoTracker-Web, aber kein RN-Produktions-Track-Record; kein Expo-Release-Know-how).
- Watch unmöglich, Widgets nativ — wie bei Flutter entsteht ein Swift-Anteil sowieso.
- Audio-Player mit Time-Pitch/A-B-Loop und Offline-Sync sind in RN machbar, aber Plugin-abhängig und genau die Stellen, an denen RN-Projekte Zeit verlieren.
- macOS: `react-native-macos` ist Nische; realistisch ersetzt auch hier das Web-Portal die Mac-App.

### 5.1 Vergleichsmatrix (Solo-Dev mit Claude Code)

| Kriterium | A Native+ | B KMP | C Flutter | D RN+Next |
|---|---|---|---|---|
| Nutzt vorhandene Skills (SwiftUI/Compose/Next.js) | ★★★ | ★★☆ | ★★☆ (Flutter-Erfahrung da) | ★☆☆ |
| Drift-Schutz Mobile↔Mobile | ★☆☆ (nur via Codegen/Disziplin) | ★★★ | ★★★ | ★★★ |
| Drift-Schutz Mobile↔Web | ★★☆ (generierte Typen) | ★☆☆ | ★☆☆ | ★★★ |
| Watch/Widgets/App Intents | ★★★ | ★★★ | ★☆☆ | ★☆☆ |
| Audio/Kamera/Offline-Qualität | ★★★ | ★★★ | ★★☆ | ★★☆ |
| Toolchain-Einfachheit für Solo-Dev | ★★☆ | ★☆☆ | ★★★ | ★★☆ |
| Feature-Velocity (mit Claude Code) | ★★☆ | ★★☆ | ★★★ | ★★★ |
| App-Store-Risiko | ★★★ (minimal) | ★★★ | ★★☆ | ★★☆ |
| Wiederverwendung v1-Wissen/Code-Muster | ★★★ | ★★☆ | ★☆☆ | ★☆☆ |
| macOS-Antwort | SwiftUI fast gratis | SwiftUI fast gratis | Web-Portal | Web-Portal |

---

## 6. Empfehlung

**Empfohlen: Option A — Native bleiben (SwiftUI + Jetpack Compose + Next.js), aber als „Native+ mit Shared Contract".** Zweite Wahl und späterer Ausbaupfad: Option B (KMP für den Mobile-Datenlayer).

**Begründung:**

1. **Das v1-Problem war nie das Framework, sondern der fehlende Vertrag.** Die dokumentierten Schmerzen (CodingKeys-Fragilität, `nachricht`-vs-`content`-Bugs, Harmonisierungspläne) verschwinden nicht durch einen Framework-Wechsel, sondern durch **Schema-first-Codegenerierung** (Postgres-Schema → Swift/Kotlin/TS-Typen), **serverseitige Fachlogik** (RPCs/Edge Functions statt 3× Client-Logik) und **Contract-Tests**. Das ist mit Option A vollständig erreichbar — ohne Migrationsrisiko.
2. **Watch, Widgets, App Intents und die Audio-Engine erzwingen ohnehin Swift.** Flutter und RN würden das Projekt nicht auf eine Sprache reduzieren, sondern nur die Hauptsprache austauschen und einen nativen Satelliten-Anteil übrig lassen. Der Nutzer baut Widgets/Watch-Apps nachweislich routiniert (GOMESSMO-, RollsportManager-, KetoTracker-Widgets).
3. **Der Solo-Dev-Multiplikator heißt hier Claude Code, nicht Code-Sharing.** Die repetitive Portierung SwiftUI↔Compose ist AI-gestützt billig; die Kosten von KMP (Kotlin/Native-Toolchain, ObjC-Interop-Debugging) und RN/Flutter (Plugin-Grenzen bei Audio/Kamera/Offline) sind es nicht. Bei einem 3-Personen-Team würde die Empfehlung anders ausfallen (dann KMP).
4. **Die Erfahrungslage ist eindeutig:** GOMESSMO (SwiftUI + Compose-Android + Next.js + Design-System „GoMessMo 2.0") und KetoTracker (Design-Token-System, TestFlight/Play-Pipelines) sind exakt das Muster von Option A — inklusive erprobter Deploy-Workflows.
5. **Risikominimierung für die Migration:** v2 kann Feature für Feature gegen dasselbe (gehärtete) Supabase-Backend gebaut werden; v1-Apps bleiben parallel lauffähig. Kein Big-Bang.

**Klare Nebenentscheidungen:**
- **Web-Portal wird Next.js (App Router) mit TypeScript, Tailwind, generierten Supabase-Typen und next-intl** — der größte Einzelgewinn des Neuaufbaus, ersetzt 87 Vanilla-HTML-Seiten + 30k Zeilen JS + 13k-Zeilen-i18n-Monolith.
- **macOS bleibt als SwiftUI-Target nur, solange es „gratis" mitläuft**; primäres Desktop-Erlebnis wird das neue Web-Portal (Admin/Verwaltung ist Desktop-Web-Terrain).
- **Option B bleibt der dokumentierte Plan B:** Wenn trotz Codegen der Mobile-Drift schmerzt, kann der Daten-/Sync-Layer später als KMP-Modul extrahiert werden — die v2-Architektur (Repository-Schicht, dünne ViewModels) soll das explizit offenhalten.

---

## 7. Konkrete Empfehlungen für den v2-Neuaufbau

### 7.1 Sofort (Phase 0, unabhängig vom Stack)
1. **JWT-Secrets rotieren:** Demo-Secret (`supabase-demo`) durch echtes Secret ersetzen, neue ANON/SERVICE-Keys ausrollen, Secrets aus allen `CLAUDE.md`/JS-Dateien entfernen (K1 aus Security-Audit, seit 13.06.2026 offen).
2. **Payment-Secrets serverseitig kapseln:** `VereinPaymentConfig`-Secret-Felder aus clientseitigen Selects/Modellen entfernen; Checkout ausschließlich über Edge Functions.
3. **Base64-Medien aus `kuer_media` in Supabase Storage migrieren.**

### 7.2 Backend evolvieren (bleibt Supabase)
4. **Schema als Single Source of Truth:** Migrations-Disziplin beibehalten; pro Release `supabase gen types typescript` + Codegen für Swift/Kotlin (z. B. eigenes Generator-Skript über `information_schema` oder OpenAPI von PostgREST) in CI — handgeschriebene CodingKeys/`@SerialName` verschwinden.
5. **Fachlogik in die DB/Edge Functions ziehen:** Beitrag/Rechnung/Mahnstufen-Berechnung, Limits, Trainer-Regeln als RPCs (v1 hat mit `get_user_limits`, `register_user_rpc`, `can_trainer_create_kuer_for_member` bereits den richtigen Ansatz) — Clients rendern nur noch.
6. **Schema-Bereinigung per Views:** Neues, konsistent englisches API-Schema (Views/RPCs) über die deutschen Alt-Tabellen legen, statt Big-Bang-Renames; deutsche Enums hinter Mapping-Views kapseln.
7. **Push konsolidieren:** `workers/push-worker.js` + `functions/send-push-notification` zu einem Weg zusammenführen (Queue-Tabelle + ein Worker, FCM+APNs).

### 7.3 Clients (Option A umgesetzt)
8. **Monorepo `RollsportManager-v2/`** mit `apps/ios` (SwiftUI, nur SPM — CocoaPods eliminieren, Google Ads via SPM), `apps/android` (Compose, aktuelle BOM, Kotlin 2.x), `apps/web` (Next.js), `packages/tokens` (Design-Tokens → Style Dictionary → Swift/Kotlin/CSS), `packages/contract` (generierte Typen, OpenAPI, Testfixtures).
9. **God-Objects verbieten:** `SupabaseManager` (8.520 Zeilen) in Feature-Services zerlegen (AuthService, KuerService, PaymentService, …) mit Größenbudget (~400 Zeilen/Datei) und Feature-Ordnerstruktur je Plattform identisch benennen — erleichtert AI-gestützte Portierung enorm.
10. **Design-Token-System als erste Deliverable** (Erfahrung aus „GoMessMo 2.0" und „KetoTokens" wiederverwenden): Farben, Typo, Spacing, Radii, Dark/Light — eine JSON-Quelle, drei Generatoren.
11. **Watch + Widgets von Tag 1 als Targets anlegen** (App Group, gemeinsame Modelle mit iOS-App) — v1-Widget/Watch-Code als Vorlage.
12. **Offline-Strategie vereinheitlichen:** gleiche Sync-Semantik (Pull-Timestamps, Konflikt „Server gewinnt", Outbox-Queue) als geteilte Spezifikation in `packages/contract`, implementiert mit GRDB (iOS) und Room (Android); Web bleibt online-first.
13. **Testfundament statt Nachrüstung:** Contract-Tests gegen eine lokale Supabase-Instanz (jede RPC/kritische Query), Snapshot-Tests für Token-Rendering, je Plattform ein dünner E2E-Smoke (Login → Dashboard → Termin zusagen).
14. **i18n richtig:** iOS String Catalogs (Erfahrung aus GOMESSMO-Lokalisierung), Android-Ressourcen, next-intl im Web; DE+EN Pflicht ab Feature-Start, FR/RU/TR nachziehen; Übersetzungs-Keys im Contract-Package zentral gelistet.
15. **Migrationsreihenfolge:** (1) Backend härten + Codegen, (2) Next.js-Portal (ersetzt Portal + Admin + Website, größter Hebel, kein Store-Review), (3) iOS v2, (4) Android v2, (5) v1-Sunset. Beide App-Generationen laufen übergangsweise gegen dasselbe Backend.

### 7.4 Explizit nicht empfohlen
- **Kein Flutter/RN-Rewrite:** entwertet die native Erfahrungs- und Code-Basis, löst das Web-Problem nicht (Portal bliebe ohnehin Next.js) und lässt Watch/Widgets als Swift-Restprojekt zurück.
- **Kein Compose Multiplatform für iOS-UI in v2.0:** zwar seit 2025 stabil, aber für eine Apple-Plattform-affine App (Widgets, Watch, App Intents, plattformtypische Navigation) ohne Not ein Qualitäts- und Debugging-Risiko; als Experiment für einzelne interne Screens später denkbar.
