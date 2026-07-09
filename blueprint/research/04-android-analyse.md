# Android-Analyse: RollsportManager (Kotlin / Jetpack Compose)

**Rolle:** Senior Android-Ingenieur
**Datum:** 2026-07-09
**Analysierte Codebase:** `/Users/marcelgoldfuss/Apps/RollsportManager/rollsportmanager-android`
**Zweck:** Ist-Zustand-Analyse als Grundlage für den Neuaufbau „RollsportManager v2"

---

## 1. Überblick

Die Android-App ist eine native Kotlin-/Jetpack-Compose-App, die als nachträgliche Portierung der iOS-App entstanden ist („iOS ist die Referenz/Vorlage", siehe `CLAUDE.md`). Sie spricht **direkt** gegen die self-hosted Supabase-Instanz (`https://rollsportmanager.de`) via Supabase-Kotlin-SDK 3.0.2 (Postgrest, Auth, Storage, Realtime) — es gibt keine eigene API-Schicht.

**Kennzahlen (selbst erhoben):**

| Metrik | Wert |
|---|---|
| Kotlin-Dateien | 307 (~108.700 Zeilen) |
| Compose-Screens | 139 Dateien in 40 Feature-Ordnern |
| ViewModels | 45 (`ui/viewmodel/`) |
| Repositories | 27 (`data/repository/`) |
| Datenmodelle | 46 (`data/model/`) |
| Navigations-Routen | 129 `composable(...)`-Registrierungen in **einer** Datei (`ui/navigation/MainNavigation.kt`, 1.953 Zeilen) |
| Unit-Tests | **1** Datei (`app/src/test/.../AuthRepositoryTest.kt`), keine UI-Tests |
| String-Ressourcen | 1.410 Keys × 5 Sprachen (DE/EN/FR/RU/TR) |
| Hardcodierte UI-Strings | ~879 `Text("…")`-Literale in Screens (trotz Ressourcen) |
| Version | versionCode 116, versionName 1.7, minSdk 26, target/compileSdk 35 |

**Stack:** Kotlin 2.0.0, AGP 8.7.0, Gradle 8.9, Compose BOM 2024.10.01, Material 3, Hilt 2.52, Navigation Compose 2.7.6, Room 2.6.1, Media3 1.2.1, Coil 2.5, CameraX 1.3.1, MLKit Barcode, ZXing, Firebase BOM 32.7.0 (siehe `app/build.gradle.kts`).

Funktional deckt die App nahezu den kompletten iOS-Funktionsumfang ab (Vereine, Teams, Termine, Küren mit Audio/Video, Chat + DMs, Finanzen inkl. Mahnwesen/SEPA/Ratenzahlung, Check-in per QR, Familien, Schließfächer, Equipment, Facilities, Wartelisten, Statistiken, Admin-/Super-Admin-Bereich, Wettkampf-Live-Modus). Die Harmonisierungs-Historie ist in `CLAUDE.md` und `info.md` dokumentiert.

---

## 2. Ist-Zustand im Detail

### 2.1 Architektur (MVVM + Repository, aber inkonsistent)

- **Muster:** MVVM mit Hilt-Constructor-Injection, `StateFlow` in ViewModels, Repository-Pattern über Supabase-Postgrest. Grundsätzlich sauber aufgesetzt (`di/AppModule.kt`, `di/RepositoryModule.kt`).
- **BaseViewModel existiert, wird aber ignoriert:** `ui/viewmodel/BaseViewModel.kt` bietet ein konsistentes Loading/Error/Success-Pattern inkl. eigener `UiState`-Sealed-Class — aber nur **2 von 45** ViewModels erben davon; 44 erben direkt von `ViewModel` und duplizieren jeweils eigene `_isLoading`/`_errorMessage`-Flows (z. B. `ui/viewmodel/TerminViewModel.kt`). Zusätzlich existiert ein zweites, konkurrierendes `UiState` in `util/UiState.kt`. Ergebnis: kein einheitliches State-Modell pro Screen.
- **Repositories halten UI-State:** Singleton-Repositories wie `TerminRepository` besitzen `MutableStateFlow<List<Termin>>` + `selectedTermin` als quasi-globalen App-State (`data/repository/TerminRepository.kt:27-31`). Das vermischt Datenzugriff und Präsentations-State, macht Screens implizit voneinander abhängig und ist nicht testbar isolierbar.
- **Kein Domain-Layer:** Business-Logik liegt verstreut in ViewModels, Screens (!) und Repositories. Berechnungen wie Timer/Countdown stecken direkt in Composables (`ui/screen/wettkampf/WettkampfLiveScreen.kt`).
- **Ein einziges Gradle-Modul:** Keine Feature-Modularisierung, keine Version-Catalogs (`libs.versions.toml` fehlt), Abhängigkeiten hart in `app/build.gradle.kts`.

### 2.2 Navigation

- String-Routen über eine `sealed class Screen` mit `createRoute()`-Helfern; **alle** 129 Routen + BottomBar + Rollen-Gating in der einen Datei `ui/navigation/MainNavigation.kt` (1.953 Zeilen, ~160 Imports).
- Fragile Parameterübergabe: Ganze Titel/Ortsnamen werden in die Route kodiert, z. B. `Screen.WettkampfDetail = "wettkampf/{terminId}/{terminTitle}/{terminOrt}"` (`MainNavigation.kt:417-421`) — Sonderzeichen/Umlaute/Slashes im Titel können die Navigation brechen.
- Alias-Routen als Altlast (`Anwesenheit` als „Alias", `FinanzExport` als „Alias", ebd.) — Zeichen gewachsener Doppelstrukturen.
- Kein type-safes Navigation-API (Navigation Compose 2.8+/kotlinx-serialization-Routen), keine Deep-Link-Definitionen im NavGraph (Push-Deep-Links laufen manuell über `FCMService`).

### 2.3 Compose-UI-Qualität & Material-Design-Stand

- **Material 3 ist durchgängig im Einsatz** (`androidx.compose.material3`, `NavigationBar`, `Scaffold`, `TopAppBar`) — kein Material-2-Altbestand. Dynamic Color (Material You) ist per Default **aktiviert** und überschreibt ab Android 12 das Marken-Grün komplett (`ui/theme/Theme.kt`: `dynamicColor: Boolean = true`) — Branding ist damit auf modernen Geräten zufällig statt markenkonform, und inkonsistent zu iOS.
- **Design-System praktisch nicht vorhanden:** `Typography` definiert nur 3 Styles, es gibt kein Spacing-/Shape-/Farb-Token-System. Stattdessen wurden iOS-„Hero-Sections" per Hand in Dutzende Screens kopiert (Gradient + halbtransparentes Icon + weiße Typo) — die `CLAUDE.md` dokumentiert diesen Copy-Paste-Prozess über ≥12 Screens (#16–#25). Jeder Screen re-implementiert `Brush.verticalGradient` selbst.
- **Monolithische Screens:** `ui/screen/kueren/KuerDetailScreen.kt` hat 2.316 Zeilen (Audio-Player, Waveform, A-B-Loop, Countdown, Tabs, Timestamps, Media-Verwaltung in einer Datei, inkl. zweifach dupliziertem MediaController-Setup bei Zeile 650 und 1953). Weitere: `FamilyScreen.kt` 1.428, `RegisterScreen.kt` 1.121, `AdminPremiumScreen.kt` 1.104 Zeilen.
- **Lifecycle-Hygiene:** 440× `collectAsState()`, **0×** `collectAsStateWithLifecycle()` — Flows werden auch im Hintergrund weiter gesammelt. 87× `!!`-Operator. Positionsupdates des Players laufen als 100-ms-Polling-Loop in `LaunchedEffect` (`KuerDetailScreen.kt:715-724`), der A-B-Loop wird ebenfalls über Recomposition-Polling statt Player-Callbacks realisiert — funktioniert, ist aber unpräzise und stromhungrig.
- **Positiv:** Gemeinsame Bausteine existieren (`ui/components/`: `LoadingState`, `ErrorState`, `PullRefresh`, `CommonUI`, `SpeechRecognizer`, `AdBanner`), Empty-/Error-States sind flächendeckend gepflegt, Pull-to-Refresh vorhanden, Icons konsequent Material Symbols.

### 2.4 Offline-Fähigkeit

Zwei getrennte Mechanismen, beide nur teilweise ausgebaut:

1. **Room-Cache (Lese-Cache, kein Offline-First):** `data/local/AppDatabase.kt` mit nur 5 Entities (`OfflineUser`, `OfflineVerein`, `OfflineKuer`, `OfflineTeam`, `OfflineTermin`), Version 2, `fallbackToDestructiveMigration()`. Muster in `TerminRepository.loadTermine()`: wenn `NetworkMonitor.isOnline == false` → aus Room lesen, sonst Netzwerk laden und danach in Room spiegeln. Es gibt **keine Schreib-Queue/Outbox** — offline erstellte Termine, Zusagen, Chat-Nachrichten etc. gehen verloren bzw. sind gar nicht möglich. Kein WorkManager, kein Konflikt-Handling. Alle anderen ~40 Datentypen (Chat, Zahlungen, Mitglieder, …) haben null Offline-Unterstützung.
2. **Offline-Medien für Küren (gut gedacht):** `data/local/OfflineSyncService.kt` + `OfflineMediaManager` laden Kür-Musik/-Videos herunter (2-GB-Limit, 500-MB-Mindest-Freispeicher, Auto-Sync bei Netz-Wiederkehr, 1-h-Throttle) — analog zu iOS `OfflineSyncService.swift`. Cleanup ist allerdings brachial („alle löschen wenn zu voll", `OfflineSyncService.kt:297-303`), und der Sync läuft in einem selbstgebauten `CoroutineScope` statt über WorkManager (überlebt keinen Prozess-Tod).

### 2.5 Media3-Hintergrund-Audio (Kürmusik) — das Aushängeschild

`audio/PlaybackService.kt` ist ein sauber begründeter `MediaSessionService`-Foreground-Service für den Wettkampf-Einsatz:

- `handleAudioFocus = false` + `setHandleAudioBecomingNoisy(false)`: Kürmusik pausiert **nicht** bei Anruf/Benachrichtigung/Gerätetrennung — bewusste Turnier-Entscheidung, im Code ausführlich dokumentiert (rechtfertigt `FOREGROUND_SERVICE_MEDIA_PLAYBACK` im Manifest).
- `WAKE_MODE_NETWORK`, korrektes `onTaskRemoved` (Service lebt weiter solange Musik läuft), sauberes Release in `onDestroy`.
- UI koppelt sich per `MediaController`/`SessionToken` an (`KuerDetailScreen.kt:677-713`) und gibt beim Verlassen nur den Controller frei, nicht den Player — Wiedergabe läuft bei Screen-Wechsel weiter. Tempo (0.5×–2×), A-B-Loop, 0/3/5/8-s-Countdown, animierte Waveform, klickbare Timestamps sind implementiert.
- Schwächen: Media3 1.2.1 ist veraltet (Stand 2026: 1.5+); Player-Steuerlogik (Loop, Countdown, Positions-Polling) lebt im Composable statt in einem Controller/ViewModel und ist in derselben Datei doppelt implementiert.

### 2.6 Paritäts-Lücken gegenüber iOS

| Bereich | iOS | Android |
|---|---|---|
| **In-App-Käufe** | StoreKit-Flows vorhanden | **Nicht funktionsfähig**: keine Play-Billing-Library in `app/build.gradle.kts`; in `ui/screen/premium/PremiumUpgradeScreen.kt` setzt `onPurchase` nur `isPurchasing = true` — es folgt kein Kauf, `showSuccessDialog` wird nie gesetzt, „Käufe wiederherstellen" ist ein leerer Callback (Zeile ~104: `// Käufe wiederherstellen`). Produkt-IDs existieren nur als Konstanten (`config/PricingConfig.kt`). |
| **Push-Notifications** | aktiv | **Faktisch deaktiviert**: `google-services`-Plugin auskommentiert („Aktivieren wenn google-services.json vorhanden", `app/build.gradle.kts:8`), `app/google-services.json` fehlt — `notification/FCMService.kt` inkl. Termin-Action-Buttons (`TerminResponseReceiver`) ist toter Code im Build. |
| **Widgets** | WidgetKit Home + Lock Screen (`RollsportManagerWidget/`) | 1 Legacy-`RemoteViews`-Widget (`widget/NextTrainingWidget.kt`), gefüttert aus SharedPreferences, kein Glance, keine Lock-Screen-Pendants. |
| **Watch** | eigene watchOS-App (`RollsportManager Watch App/`) | kein Wear-OS-Pendant. |
| **macOS/Tablet** | macOS-App | keine Tablet-/Foldable-Anpassung (keine adaptive Layouts, eine Breakpoint-lose BottomBar). |
| **Play-Store-Status** | App Store live | lt. Memory nur geschlossener Test (Tester-Hürde), Release unsigniert-minifiziert s. u. |

Funktional (Screens/Features) ist die Parität dagegen weitgehend erreicht — die Lücken liegen in Plattform-Integration und Monetarisierung.

### 2.7 Build-Setup, R8/ProGuard, Signing, Sicherheit

- **R8/Minify ist AUS:** `isMinifyEnabled = false` im Release-Buildtype (`app/build.gradle.kts`). Zusätzlich neutralisieren die `proguard-rules.pro` jede künftige Minifizierung durch Pauschal-Keeps (`-keep class io.github.jan.supabase.** { *; }`, `-keep class io.ktor.** { *; }`, `-keep class de.rollsportmanager.app.data.** { *; }`) → großes, unobfuskiertes APK/AAB.
- **Signing:** Release-Signing via `keystore.properties` ist korrekt verdrahtet; der letzte Commit (`f70b5c8`) hat Keystore + Properties aus der Versionskontrolle genommen — **aber** `rollsportmanager-release.keystore` und `keystore.properties` liegen weiterhin im Projekt-Root, und `info.md` dokumentiert das Keystore-Passwort im Klartext (`ch4ngeM3` — identisch zum bekannten HA-SSH-Fallback-Passwort). Für v2: neues Passwort, Secrets-Management.
- **Anon-Key = Demo-JWT:** Der fest einkompilierte `SUPABASE_ANON_KEY` trägt `iss: "supabase-demo"` (`app/build.gradle.kts`, defaultConfig) — deckt sich mit Befund K1 des Security-Audits vom 13.06.2026 (JWT-Demo-Default auf Prod). Jeder APK-Besitzer kann den Key extrahieren; Sicherheit hängt damit vollständig an Postgres-RLS.
- **Debug-Builds zeigen auf Produktion:** auch der `debug`-Buildtype setzt `SUPABASE_URL = https://rollsportmanager.de` — jede Entwicklungs-Session arbeitet gegen die Live-Datenbank.
- **Session-Tokens im Klartext:** `data/session/SessionManager.kt` speichert Access-/Refresh-Token in normalen `SharedPreferences` (kein `EncryptedSharedPreferences`/Keystore).
- **Super-Admin-Impersonation rein clientseitig:** `AuthRepository.enterUser()/enterVerein()` tauscht nur lokale StateFlows (`AuthRepository.kt:56-97`) — die Absicherung muss serverseitig via RLS geschehen, clientseitig ist es nur Kosmetik.
- **Kein CI**, keine Lint-Baseline, keine Detekt/ktlint-Konfiguration im Repo.
- Positiv: `network_security_config.xml` (nur HTTPS für Prod-Domain), granulare Manifest-Permissions mit `maxSdkVersion`-Abstufung, Foreground-Service-Typ korrekt deklariert, `localeConfig` für per-App-Sprache.

### 2.8 Lokalisierung

5 Sprachdateien (DE/EN/FR/RU/TR) mit je 1.410 Keys und `locales_config` sind vorhanden — gleichzeitig stehen ~879 hartkodierte deutsche `Text("…")`-Literale in den Screens (z. B. komplette Dialoge in `PremiumUpgradeScreen.kt`: „Kauf erfolgreich!", „Vielen Dank für deinen Kauf…"). Die Übersetzungsabdeckung ist also real deutlich niedriger als die Ressourcen suggerieren. (Verstößt gegen die Projektregel „neue Strings immer DE+EN".)

### 2.9 Daten-/Query-Qualität

- Direkte Postgrest-Table-Queries aus 27 Repositories; teils ineffizient: `MonetizationRepository.loadPremiumUserCount()` lädt **alle** User-Zeilen und zählt clientseitig per `decodeList().size` statt `count()` (`data/repository/MonetizationRepository.kt:41-56`).
- Keine Pagination irgendwo (keine Paging-3-Dependency) — Mitglieder-/Zahlungs-/Chat-Listen laden immer vollständig.
- Feldnamen-Drift zwischen Client-Modellen und DB war wiederholt Bug-Quelle (`Message.content` vs. DB `nachricht`, veraltetes `VereinNews`-Modell — dokumentiert in `CLAUDE.md` #27); es gibt keine gemeinsame Schema-Quelle (kein Codegen aus SQL, kein geteiltes Modell mit iOS).

---

## 3. Stärken (bewahrenswert)

1. **Enorme fachliche Abdeckung:** 139 Screens, 27 Repositories, 46 Modelle — die komplette Vereins-Domäne (inkl. Nischen wie Pflichtstunden, Schließfächer, Jubiläen, Verbandsmeldung, Kassenbuch, SEPA) ist einmal durchimplementiert und dient v2 als vollständige Feature-/Datenfeld-Referenz.
2. **Durchdachter Wettkampf-Audio-Service:** `audio/PlaybackService.kt` (MediaSessionService, kein Audio-Focus-Verlust, Task-Removal-Verhalten) ist fachlich genau richtig für den Turnier-Einsatz und gut dokumentiert.
3. **Offline-Medien-Sync für Küren** mit Speicher-Limits und Auto-Sync bei Netz-Wiederkehr (`data/local/OfflineSyncService.kt`).
4. **Konsequentes Hilt-DI** und klare Paketstruktur (`data/model|repository|local|realtime|session`, `ui/screen|viewmodel|components`).
5. **Realtime-Chat** über Supabase-Channels mit Flow-basierter API (`data/realtime/RealtimeManager.kt`), inkl. DMs, Bearbeiten/Löschen, Voice-to-Text (`ui/components/SpeechRecognizer.kt`).
6. **QR-Check-in-Kette komplett:** ZXing-Generierung + MLKit/CameraX-Scanner, kompatible Codes über alle Plattformen (Commit `ccd05f0`).
7. **Material 3 + Dark Mode + per-App-Sprache** bereits Grundausstattung; wiederverwendbare Zustands-Komponenten (`LoadingState`, `ErrorState`, `PullRefresh`).
8. **5-sprachige String-Basis** (1.410 Keys) als Übersetzungs-Rohstoff für v2.

---

## 4. Schwächen / Altlasten

1. **Monetarisierung kaputt:** Premium-/Lizenz-Kaufflows sind UI-Attrappen ohne Play Billing — Kauf-Button tut nichts (`PremiumUpgradeScreen.kt`), „Wiederherstellen" leer. Kein Umsatz über Android möglich.
2. **Push faktisch aus:** google-services-Plugin auskommentiert, `google-services.json` fehlt → gesamter FCM-Code (Service, Kanäle, Action-Receiver) ist im Build inaktiv.
3. **Sicherheits-Altlasten:** Demo-Issuer-Anon-Key im Binary, Session-Tokens in Klartext-SharedPreferences, Keystore-Passwort im Klartext in `info.md`, Debug-Builds gegen Prod-DB, clientseitige Super-Admin-Impersonation.
4. **Kein tragfähiges State-Management:** 44/45 ViewModels ignorieren das vorhandene `BaseViewModel`; zwei konkurrierende `UiState`-Definitionen; Repositories halten globalen UI-State; 0× `collectAsStateWithLifecycle`.
5. **Navigations-Monolith:** 1.953-Zeilen-`MainNavigation.kt`, String-Routen mit Titeln/Orten als Pfadsegmente, Alias-Routen, kein type-safety, keine Deep-Links.
6. **UI-Monolithen & Copy-Paste-Design:** 2.316-Zeilen-`KuerDetailScreen.kt` (mit dupliziertem Player-Code), Hero-Gradients in >12 Screens manuell kopiert statt als Komponente/Token-System; Dynamic Color zerstört das Branding.
7. **Offline nur Lese-Cache für 5 Entities**, keine Schreib-Queue, destruktive Room-Migrationen, kein WorkManager — echtes Offline-Arbeiten (Anwesenheit in der Halle ohne Netz!) ist nicht möglich.
8. **Keine Pagination, ineffiziente Queries** (Zählen per Volllast-Select), kein Schema-Codegen → wiederkehrende Feldnamen-Bugs.
9. **Test-Wüste:** 1 Unit-Test-Datei für ~108.000 Zeilen; kein CI, kein Lint/Detekt, keine Screenshot-Tests.
10. **Release-Hygiene:** R8 aus + Pauschal-Keep-Rules; veraltete Kernbibliotheken (Media3 1.2.1, Navigation 2.7.6, Compose BOM 2024.10, Coil 2.x); kein Version-Catalog, ein einziges Modul.
11. **i18n-Fassade:** ~879 hartkodierte deutsche Strings neben 5-sprachigen Ressourcen.
12. **Plattform-Lücken:** kein funktionierendes Widget-Erlebnis (Legacy-RemoteViews), kein Wear OS, keine Tablet-/Foldable-Layouts.

---

## 5. Empfehlungen für den Neuaufbau „v2"

### 5.1 Architektur

1. **Geteilte Datenschicht statt Doppel-Portierung:** Kotlin Multiplatform (KMP) für Modelle, Repositories, Validierung und Sync-Logik (Android + iOS teilen sich den Code; supabase-kt ist KMP-fähig). Alternativ: eine echte Backend-API (Edge Functions/REST) als einzige Vertragsfläche, damit Feldnamen-Drift (Kap. 2.9) strukturell unmöglich wird — idealerweise mit Codegen aus dem SQL-Schema/OpenAPI.
2. **Feature-Module + Version-Catalog + Convention-Plugins:** `:core:designsystem`, `:core:data`, `:core:database`, `:feature:termine`, `:feature:kueren`, … statt einem 108k-Zeilen-Monolith. `libs.versions.toml` von Tag 1.
3. **UDF/MVI konsequent:** genau EIN `UiState`-Modell pro Screen (sealed interface), ViewModel als einzige State-Quelle, `collectAsStateWithLifecycle`, keine State-haltenden Singleton-Repositories.
4. **Type-safe Navigation** (Navigation Compose ≥2.8 mit @Serializable-Routen oder Navigation 3), NavGraphs pro Feature-Modul, Deep-Links deklarativ (Push → Screen).

### 5.2 Offline-First (größter fachlicher Gewinn)

5. **Room als Single Source of Truth** für alle Kern-Entities (nicht nur 5): UI liest ausschließlich DB-Flows; Netzwerk synchronisiert die DB. Schreiboperationen in eine **Outbox** (WorkManager mit Retry/Backoff) — damit funktionieren Anwesenheit erfassen, Zusagen und Chat in der Trainingshalle ohne Empfang. Echte Migrationen statt `fallbackToDestructiveMigration`.
6. **Offline-Medien-Manager portieren, aber härten:** LRU-Eviction statt „alles löschen", Downloads über WorkManager (prozess-tod-sicher), Fortschritt persistent.

### 5.3 Audio/Wettkampf (USP schützen)

7. **PlaybackService-Konzept 1:1 übernehmen** (kein Audio-Focus-Verlust, FGS media_playback, onTaskRemoved-Logik) auf aktuellem Media3 (≥1.5): A-B-Loop und Countdown in eine `KuerPlayerController`-Klasse (ViewModel-Scope) verlagern, Loop über `Player.Listener`/`createMessage()` statt UI-Polling, Positions-Updates über `Flow` mit Lifecycle-Bindung. Wettkampf-Modus als eigenes Feature-Modul mit Bildschirm-Wachhalten und „Nicht-stören-Hinweis".

### 5.4 UI/Design

8. **Design-System als Modul:** Farb-/Typo-/Spacing-/Shape-Tokens (analog „GoMessMo 2.0"/KetoTokens-Ansatz aus den Schwesterprojekten), Hero-Header, StatCards, Badges als eine Komponente statt 12 Kopien. **Dynamic Color bewusst entscheiden** — Empfehlung: aus, Marken-Theme fest, optional als Nutzer-Toggle.
9. **Material 3 Expressive + adaptive Layouts:** `NavigationSuiteScaffold`/ListDetail-Panes für Tablets & Foldables (Trainer nutzen Tablets in der Halle), Predictive Back, große Touch-Ziele für den Hallen-Einsatz.
10. **Screens klein halten:** harte Obergrenze (~300 Zeilen), ein Composable-File pro Sektion; UI-Logik raus aus Composables.

### 5.5 Monetarisierung & Plattform-Integration

11. **Play Billing Library (≥7) mit serverseitiger Belegvalidierung** (Edge Function prüft Purchase-Token, setzt Premium-Flag in DB) — nie wieder Client-only-Premium (bekanntes Umsatzleck-Muster aus KetoTracker). Produkt-IDs aus `config/PricingConfig.kt` übernehmen.
12. **FCM korrekt aufsetzen** (google-services.json, Token-Registrierung serverseitig verifiziert) oder Push zentral über Backend-Worker; Notification-Kanäle und Termin-Action-Buttons aus v1 übernehmen.
13. **Glance-Widgets** (Nächster Termin, Nächster Wettkampf + Countdown) als moderne Pendants zu den iOS-Widgets; optional Wear-OS-Begleiter (Anwesenheits-Check-in am Handgelenk).

### 5.6 Sicherheit & Delivery

14. **Secrets-Hygiene:** neuer Prod-JWT-Secret/Anon-Key (kein „supabase-demo"-Issuer), Tokens in `EncryptedSharedPreferences`/DataStore+Keystore, neues Keystore-Passwort, Secrets nie im Repo/`info.md`; separate Staging-Umgebung für Debug-Builds (nie Prod-DB).
15. **R8 an** mit minimalen, gezielten Keep-Rules (`@Serializable`-Klassen via `kotlinx-serialization`-R8-Regeln statt Pauschal-Keeps); Baseline Profiles für Startzeit.
16. **Qualitäts-Fundament:** CI (Build+Test+Lint/Detekt), Unit-Tests für Repos/ViewModels (Turbine ist schon als Dependency da), Screenshot-Tests (Roborazzi) fürs Design-System, ein Compose-UI-Smoke-Test pro Feature. Pagination (Paging 3) für alle Listen; `count()`-Queries statt Volllast-Selects.
17. **i18n-Disziplin:** Lint-Regel `HardcodedText` als Fehler; DE+EN Pflicht (Projektregel), FR/RU/TR aus v1-Ressourcen migrieren.

### 5.7 Was aus v1 konkret wiederverwendbar ist

- **Fachmodell:** alle 46 `data/model/*.kt` inkl. `@SerialName`-Mappings auf das DB-Schema und das 6-Rollen-Modell (`User.kt:90-96`) — als Spezifikation, in v2 idealerweise generiert.
- **`audio/PlaybackService.kt`** (Konzept + Kommentare) und die Player-Feature-Liste (Tempo/Loop/Countdown/Waveform/Timestamps).
- **`data/local/OfflineSyncService.kt` / `OfflineMediaManager`** als Blaupause für Offline-Medien.
- **`config/PricingConfig.kt`** (Produkt-IDs, Preisstruktur, Lizenz-Staffeln 50/200/500 Mitglieder).
- **String-Ressourcen** (5 × 1.410 Keys) und `locales_config`.
- **`network_security_config.xml`**, Manifest-Permission-Setup, Notification-Channel-Struktur, `TerminResponseReceiver`-Aktionen (Zusage/Absage/Vielleicht/Krank).
- **UI-Bausteine** als Referenz: `LoadingState`, `ErrorState`, `PullRefresh`, `CommonUI`, `SpeechRecognizer`.
- **Nicht übernehmen:** MainNavigation-Monolith, Repository-StateFlows, die duplizierten Hero-Gradients, Klartext-SessionManager, ProGuard-Pauschal-Keeps.

---

*Ende des Reports. Alle Pfade relativ zu `/Users/marcelgoldfuss/Apps/RollsportManager/rollsportmanager-android`, sofern nicht anders angegeben.*
