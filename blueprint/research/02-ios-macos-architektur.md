# RollsportManager – iOS/macOS-Architektur-Analyse (Ist-Zustand & Empfehlungen für v2)

**Rolle:** Senior iOS/macOS-Ingenieur
**Datum:** 2026-07-09
**Analysierte Codebase:** `/Users/marcelgoldfuss/Apps/RollsportManager/rollsportmanager-ios-macos` (nur Lesezugriff, Stand main `b33b1ef`)

---

## 1. Überblick

Die iOS/macOS-App ist eine SwiftUI-Codebase mit **277 Swift-Dateien und ~128.500 Zeilen** im App-Target, dazu eine Watch-App (~1.600 Zeilen, `RollsportManager Watch App/`) und eine WidgetKit-Extension (664 Zeilen, `RollsportManagerWidget/RollsportManagerWidget.swift`). Version laut `RollsportManager/Info.plist`: **1.8 (Build 123)**, Deployment-Targets iOS 16 / macOS 13 (`project.yml`).

iOS und macOS teilen sich **denselben Quellcode** (zwei Targets `RollsportManager-iOS` und `RollsportManager-macOS` auf identischen Sources, `project.yml`), plattformspezifisches Verhalten wird über **637 `#if os(...)`-Blöcke** verzweigt. Die App spricht ein self-hosted Supabase-Backend (`https://rollsportmanager.de`) über `supabase-swift` an und hält parallel eine lokale GRDB/SQLite-Datenbank für Offline-Funktionen.

Die App ist funktional beeindruckend breit (laut `FUNKTIONEN.md` über 200 Funktionen: Vereine, Teams, Küren, Termine, Finanzen inkl. Mahnwesen, Check-in, Wettkampf-Modus, Gamification, Inventar, Pflichtstunden u.v.m.), architektonisch aber ein **organisch gewachsener Monolith** mit einem 8.500-Zeilen-God-Object als Netzwerkschicht, dreifach duplizierten Modelltypen, drei parallelen Persistenz-Systemen und praktisch keiner Testabdeckung.

---

## 2. Ist-Zustand im Detail

### 2.1 Projektstruktur und das Doppel „RollsportManager 2.xcodeproj"

Das Verdachtsmoment bestätigt sich – es handelt sich um **committete macOS-Finder-Duplikate** (Suffix „ 2"), vermutlich durch eine Kopier-/Entpack-Aktion entstanden:

| Artefakt | Befund |
|---|---|
| `RollsportManager 2.xcodeproj/project.pbxproj` | **Veralteter Snapshot** (714 Zeilen, ~50 Dateien, Stand eines frühen Projektstands) |
| `RollsportManager.xcodeproj/project.pbxproj` | **Das echte Projekt** (2.971 Zeilen, 236 KB, enthält iOS-, macOS-, Widget-Targets, zuletzt geändert Jul 2026) |
| `RollsportManager 2.xcworkspace` | Redundant – `contents.xcworkspacedata` referenziert **dasselbe** `RollsportManager.xcodeproj` wie der echte Workspace |
| `Podfile 2`, `Podfile 2.lock` | Duplikate mit abweichendem Deployment-Target (15.0 statt 16.0) |
| `RollsportManager/Info 2.plist`, `icon_1024 2.png` | weitere Duplikate |
| `Pods/Google-Mobile-Ads-SDK 2/`, `Pods/Pods 2.xcodeproj`, `Pods/Target Support Files 2/` | duplizierte, **git-getrackte** Binär-Frameworks |

Insgesamt sind **297 Dateien mit „ 2" im Namen git-getrackt** (`git ls-files | grep " 2"`). Zusätzlich liegen im Repo-Root: der komplette `Pods/`-Ordner (inkl. AdMob-Binaries), Build-Ordner (`build/`, `build_ios/` mit DerivedData/ModuleCache), ein 1,4-MB-PNG-Screenshot, sechs lose SQL-Hotfix-Dateien (`FIX-ALL.sql`, `COMPLETE-FIX.sql`, …), Ruby-Patch-Skripte (`add_watch_target.rb`, `add_widget_target.rb`, `fix_watch_signing.rb`, …) und Python-i18n-Skripte (`fix_ios_i18n.py`, `translate_keys.py`). Ein Ordner `SW/` enthält offenbar versehentlich kopierte Website-Assets (`SW/portal/payments.html`).

**Build-System-Drift:** `project.yml` (XcodeGen) definiert nur die iOS/macOS-Targets. Watch- und Widget-Target wurden nachträglich per Ruby-Skript direkt ins `pbxproj` gepatcht – `project.yml` ist damit **nicht mehr die Quelle der Wahrheit**; ein `xcodegen generate` würde das Projekt zerstören.

**Dependencies (Misch-Betrieb zweier Paketmanager):**
- SPM (`project.yml`): `supabase-swift` ≥ 2.0, `GRDB.swift` ≥ 7.0
- CocoaPods (`Podfile`): nur `Google-Mobile-Ads-SDK` 12.14.0 (+ UserMessagingPlatform), Pods eingecheckt

### 2.2 Services-Schicht – das God-Object `SupabaseManager`

`RollsportManager/Services/SupabaseManager.swift` ist mit **8.520 Zeilen, 301 Funktionen und 139 Typ-Definitionen** das Zentrum der App. Die Datei enthält u. a. (per `// MARK`-Sektionen): Auth, Verein-, Team-, Termin-, Message-, Kür-, Storage-, News-, Admin-, Lizenz-, Invitation-, Trainingsplan-, Attendance-, Facility-, Family-, Premium-, Membership-, Invoice-, Payment-, Pflichtstunden-, Schließfach-, Abteilungs-, Notiz-, Check-in-, Demo-Daten- und Verbandsmeldungs-Operationen – **die gesamte Fachlogik der App in einer Datei**, inklusive der Payment-DTOs (`VereinPaymentConfig`, `DBInvoice`, `DBPayment` ab Zeile 11).

Weitere Befunde:

- **`@MainActor`-Singleton mit globalem Zustand:** `currentUser`, `currentVerein` als `@Published` (Zeile 278 ff.) plus `adminOverrideVereinId`/`adminOverrideUserId` (Zeile 285–288) – Super-Admin-Impersonation als global mutierbare Flags, die von `effectiveVereinId` überall implizit eingerechnet werden.
- **Hartkodierter Anon-Key mit Supabase-DEMO-JWT:** Zeile 509 – der Key trägt `iss: supabase-demo`, d. h. das **öffentlich bekannte Supabase-CLI-Demo-Secret** signiert Produktions-Tokens (deckt sich mit Befund K1 des Security-Audits vom 13.06.2026). Der Key steht zusätzlich im Klartext in `CLAUDE.md` (Zeile 70 f., inkl. **Service-Role-Key!**).
- **Toter Umgebungs-Code:** Das `Environment`-Enum (`.local`/`.lan`/`.remote`, Zeile 311 ff.) mit hartkodierten LAN-IPs (`192.168.0.5`) existiert weiter, aber der Getter erzwingt immer `.remote` (Zeile 359–369). `autoSelectBestServer()` (Zeile 429) und `adaptImageUrl()` (Zeile 473) sind dadurch faktisch wirkungslos, laufen aber weiter beim App-Start (`App/RollsportManagerApp.swift` Zeile 211).
- Custom Date-Decoder (Zeile 523–544) ist solide (Fractional Seconds + Date-only-Fallback); die Konvention „explizite CodingKeys, niemals `keyDecodingStrategy`" ist in `CLAUDE.md` dokumentiert und konsequent umgesetzt.

**34 Singletons** (`static let/var shared`) verteilen sich über 26 Services (u. a. `DatabaseManager`, `AdsManager`, `PushNotificationManager`, `StoreKitManager`, `OfflineSyncService`, `NetworkMonitor`, `WatchConnectivityManager`, `Finance/DunningService`, `Backup/BackupManager`) – sogar View-Dateien definieren shared-Instanzen (`Views/Chat/ChatListView.swift`, `Views/Kuer/KuerenNavigationView.swift`). Es gibt **keinerlei Dependency Injection und keine Protokoll-Abstraktionen** – nichts ist mockbar.

### 2.3 GRDB-Offline-Datenbank

- `Database/Schema.swift` (28 KB): `AppDatabase.createTables()` legt ~18 Tabellen an. Migrationen laufen **nicht** über GRDBs `DatabaseMigrator`, sondern als ad-hoc `if !columns.contains("x") { alter table }`-Kaskaden direkt im Schema-Code (Zeile 62–104 für `vereine`, Zeile 320–420 für ~20 `users`-Spalten) – unversioniert, ungeordnet, nicht rückverfolgbar.
- `Services/DatabaseManager.swift` (2.127 Zeilen): Bei korrupter DB wird die Datei **kommentarlos gelöscht und neu erstellt** (Zeile 42–57); fehlt in `kuer_media` die Spalte `fileData`, wird die **Tabelle gedroppt** (Zeile 64–89) – Datenverlust by design. Fehler beim Setup werden geschluckt („wir nutzen hauptsächlich Supabase", Zeile 93). Die Datei enthält außerdem einen kompletten **Legacy-Lokal-Auth-Stack** (User-CRUD mit Passwort-Hash, Test-User mit `test123`, Zeile 100 ff.) aus der Vor-Supabase-Zeit.
- **Base64-Medien in der Datenbank:** `Models/KuerMedia.swift` Zeile 27 – `fileData: String // Base64-encodierte Datei` wird sowohl in Supabase (`file_data`) als auch in SQLite als TEXT gespeichert; parallel legt `OfflineSyncService` die dekodierten Dateien nochmal unter `Documents/OfflineMedia/` ab (doppelte Speicherung, hoher RAM-Druck beim Decode).

### 2.4 Sync-Mechanismus

`Services/OfflineSyncService.swift` (398 Zeilen) ist ein **Ein-Weg-Downloader**, keine Sync-Engine:

- Lädt bei Login/Netzwerk-Wiederkehr **alle** Küren aller Teams inkl. Medien komplett neu herunter (`syncAllTeamKueren()`, kein Delta-/Cursor-Sync, Drossel: max. 1×/Stunde, Zeile 200–208).
- **Keine Offline-Writes:** Es gibt keine Outbox/Queue für offline erstellte Daten – die in `FUNKTIONEN.md` beworbene „Offline-Nachrichten-Queue" existiert im Code nicht (keine Treffer für Queue-Strukturen). Offline ist die App read-only auf gecachte Küren/Teams/User.
- **Keine Konfliktbehandlung**, keine `updated_at`-Vergleiche – letzter Download gewinnt.
- Offline-Login: `AuthViewModel.hashPassword()` nutzt **SHA256 ohne Salt** (selbst im Code als „nicht ideal" kommentiert, `ViewModels/AuthViewModel.swift` Zeile 499–506); der Fallback vergleicht lokal gespeicherte Hashes (`DatabaseManager.swift` Zeile 1373).
- Zusätzlich existiert als **drittes Persistenz-System** der JSON-Datei-Cache des `BaseViewModel` (`loadFromCache`/`saveToCache` in Documents, `ViewModels/BaseViewModel.swift` Zeile 176–244) – GRDB, JSON-Dateien und UserDefaults konkurrieren als Cache.

### 2.5 ViewModels und UI/Logik-Trennung

- 21 ViewModels in `ViewModels/`, seit 10.02.2026 gibt es ein brauchbares `BaseViewModel` (Loading/Error-State, `performAsync`, Cache-Helfer) – es kam aber zu spät: **90 von 151 View-Dateien greifen direkt auf `SupabaseManager.shared` zu** und umgehen die ViewModel-Schicht komplett. MVVM existiert nur nominell.
- **Doppelter Auth-Zustand:** `AuthViewModel` hält `currentUser`/`currentVerein`/`isLoggedIn` parallel zu `SupabaseManager.currentUser`/`currentVerein`; die App synchronisiert beides manuell (`RollsportManagerApp.swift` Zeile 271–290 bei `didBecomeActive`). Zwei Quellen der Wahrheit → die aus dem Umfeld bekannten Session-/Berechtigungs-Bugs (vgl. Commits `07eba13`, `b54f5a7`).
- **Typ-Chaos (dokumentierte Altlast):** `REPARATUR_PLAN.md` beschreibt es selbst – dieselben Fachtypen existieren dreifach: GRDB-Typen in `Models/` (mit `RSM`-Prefix als Kollisions-Workaround), Supabase-Typen in `ViewModels/`, UI-Typen in `Views/`. Der Plan ist **bis heute unvollendet**: `ReservationStatus` ist dreifach definiert (`ViewModels/EquipmentViewModel.swift:89`, `Views/Equipment/EquipmentListView.swift:230`, `Models/` als `RSMReservationStatus`), ebenso `EquipmentCondition` (`Views/Equipment/EquipmentListView.swift:79`). Insgesamt stecken **558 Typ-Definitionen in View-Dateien**.
- **Deutsch/Englisch-Mischmasch bis in die DB:** `DBInvoice` akzeptiert Status „offen" **oder** „pending" (Helper `isOffen` etc., `SupabaseManager.swift` Zeile 141–177); CodingKeys mappen deutsch auf englisch gemischt (`mwstBetrag = "tax_amount"`, `beschreibung = "notes"`, aber `faelligAm = "faellig_am"`).

### 2.6 Views

- 151 View-Dateien mit **86.633 Zeilen (⅔ des gesamten Codes)**. Ausreißer: `Views/Admin/AdminView.swift` 3.591 Zeilen, `Views/Kuer/KuerDetailView.swift` 3.510, `Views/Mitglieder/MitgliederListView.swift` 2.279, `Views/Dashboard/DashboardView.swift` 2.258, `Views/MainView.swift` 1.579.
- `MainView` steuert TabBar (iPhone) vs. Sidebar (iPad/macOS) und erzwingt View-Neuaufbau über wechselnde `UUID`-IDs (`contentResetID`, `adminVereinRefreshID`, fünf `…NavID`s – `MainView.swift` Zeile 27–30, 56–72): ein Workaround für fehlendes reaktives State-Management beim Super-Admin-Vereinswechsel.
- Nur 5 wiederverwendbare Komponenten in `Components/` – bei 151 Views praktisch kein Design-System.
- Lokalisierung: eigener `L("key", "fallback")`-Mechanismus (`Extensions/LocalizationExtension.swift`) über Legacy-`.strings` (de 2.695 Zeilen; en/fr/ru/tr vorhanden) – kein String Catalog, Fallback-Texte doppeln die deutschen Strings im Code.

### 2.7 Code-Qualität, Logging, Tests

| Metrik | Wert |
|---|---|
| `print()`-Statements | **948** (kein `os.Logger`, teils mit E-Mail/User-Daten) |
| `try!` / `as!` | 0 / 0 (positiv!) |
| `fatalError` | 4 |
| `#if os(...)` | 637 |
| Singletons | 34 |
| Tests | **1 Placeholder** (`RollsportManagerTests.swift`: `XCTAssertTrue(true)`) |

### 2.8 Watch-App und Widget

- Watch-App (`RollsportManager Watch App/`): 8 Dateien, ~1.627 Zeilen; Views für Check-in, Termine, Chat, News, Timer; Datenfluss über `WatchConnectivityService` + `Services/WatchConnectivityManager.swift` (kein eigener Netzwerkzugriff) – schlank und vernünftig.
- Widget (`RollsportManagerWidget/`, Jul 2026): Home-/Lock-Screen-Widgets; `Services/WidgetDataManager.swift` schreibt kompaktes JSON in die App Group `group.de.rollsportmanager.ios` – **einer der saubersten, jüngsten Teile der Codebase** (inkl. dokumentiertem Typechecker-Workaround).

---

## 3. Stärken

1. **Enorme fachliche Abdeckung**, produktiv erprobt (Vereinsverwaltung, Finanzen mit Mahnwesen/PDF, Check-in per QR, Wettkampf-Live-Scoring, Familien-Konten, Gast-Trainer, Pflichtstunden …) – das Domänenwissen steckt vollständig im Code.
2. **Echte Multi-Plattform-Präsenz:** iPhone, iPad, macOS, watchOS, Widgets aus einer Codebase.
3. **Offline-Fähigkeit als Alleinstellungsmerkmal** (Küren + Medien lokal, Offline-Login) – konzeptionell wertvoll, auch wenn die Umsetzung schwach ist.
4. **Konsistente Serialisierungs-Konvention:** explizite CodingKeys überall, robuster Date-Decoder; die Regeln sind in `CLAUDE.md` dokumentiert.
5. **Disziplinierter Umgang mit Force-Unwraps:** kein `try!`, kein `as!` in 128k Zeilen.
6. **Neuere Teile zeigen den richtigen Weg:** `BaseViewModel` (einheitliches Loading/Error-Pattern), `WidgetDataManager`, Watch-Anbindung.
7. **5 Sprachen** bereits übersetzt (de/en/fr/ru/tr) – die Übersetzungs-Assets sind wiederverwendbar.
8. Saubere PDF-/Finanz-Services (`Services/Finance/InvoicePDFGenerator.swift`, `DunningPDFGenerator.swift`, `DunningService.swift`, `FinanceExportService.swift`) als abgrenzbare Fachmodule.

---

## 4. Schwächen / Altlasten

1. **God-Object `SupabaseManager` (8.520 Zeilen, 301 Funktionen):** gesamte Fach- und Netzwerklogik in einer `@MainActor`-Singleton-Klasse; untestbar, merge-feindlich, jede Änderung berührt dieselbe Datei.
2. **Dreifache Typ-Duplikation** (Models/ViewModels/Views) mit `RSM`-Prefix-Workaround; `REPARATUR_PLAN.md` ist seit Monaten unvollendet – ein Symptom dafür, dass GRDB-Schicht und API-Schicht nie integriert wurden.
3. **MVVM nur Fassade:** 90 von 151 Views rufen `SupabaseManager.shared` direkt; doppelter Auth-State in `AuthViewModel` vs. `SupabaseManager` mit manueller Synchronisation.
4. **Drei konkurrierende Persistenz-Systeme** (GRDB, JSON-Datei-Cache, UserDefaults) ohne klare Zuständigkeit; GRDB-Migrationen ad hoc statt `DatabaseMigrator`; korrupte DB / fehlende Spalten ⇒ Löschen der Daten.
5. **Kein echter Sync:** Voll-Download statt Delta, keine Offline-Write-Queue (beworbenes Feature fehlt), keine Konfliktbehandlung.
6. **Base64-Medien in DB-Spalten** (Supabase `file_data` + SQLite TEXT) plus doppelte Datei-Ablage – Speicher-, Traffic- und RAM-Verschwendung.
7. **Security-Altlasten:** Produktion läuft auf dem öffentlich bekannten Supabase-**Demo**-JWT-Secret (Anon-Key hartkodiert `SupabaseManager.swift:509`; Anon- **und Service-Role-Key** im Klartext in `CLAUDE.md`); lokaler Auth-Fallback mit ungesalzenem SHA256; `aps-environment: development` im Release-Entitlement (`RollsportManager/RollsportManager.entitlements`).
8. **Repo-Hygiene:** 297 git-getrackte „ 2"-Finder-Duplikate inkl. veraltetem `RollsportManager 2.xcodeproj`; eingecheckte Pods-Binaries, Build-Ordner, SQL-Hotfixes, Patch-Skripte, Website-Reste (`SW/`); `project.yml` (XcodeGen) stimmt nicht mehr mit dem `pbxproj` überein.
9. **Monster-Views** (bis 3.591 Zeilen) mit eingebetteter Fachlogik, 558 Typ-Definitionen in Views, UUID-Reset-Hacks für Navigation, kaum Komponenten-Wiederverwendung.
10. **948 `print()`** statt strukturiertem Logging; **null Testabdeckung** (1 Placeholder-Test); 637 `#if os`-Verzweigungen ohne Plattform-Abstraktionsschicht.
11. Zwei Paketmanager parallel (SPM + CocoaPods nur für AdMob); toter Environment-/LAN-Code mit hartkodierten privaten IPs.
12. Deutsch/englische Statuswerte und Spaltennamen gemischt bis in die DB (`DBInvoice`) – jede Schicht muss beide Welten kennen.

---

## 5. Empfehlungen für den Neuaufbau „v2"

### Architektur
1. **Offline-First mit einer einzigen Quelle der Wahrheit:** GRDB (oder SwiftData, wenn iOS-17+-Baseline) als lokale Wahrheit; UI liest ausschließlich reaktiv aus der DB (GRDB `ValueObservation`), die Netzwerkschicht schreibt in die DB. Damit verschwinden JSON-Cache, UserDefaults-Cache und doppelter Auth-State strukturell.
2. **Repository-Schicht statt God-Object:** pro Domäne ein Repository (`AuthRepository`, `MemberRepository`, `FinanceRepository`, `KuerRepository`, `TerminRepository` …) hinter Protokollen; `SupabaseClient` nur als injizierte Transport-Abhängigkeit. Ziel: keine Datei > 500 Zeilen, alles mockbar.
3. **Eine Modellschicht:** gemeinsame Domain-Modelle + dünne DTO-Mapper (Supabase snake_case ↔ Domain). Nie wieder drei Definitionen desselben Typs; `RSM`-Prefix entfällt. Einheitlich **englische** DB-Werte/Spalten, deutsche Texte nur in der Lokalisierung.
4. **Modularisierung als lokale Swift Packages** (Feature-Module: Mitglieder, Termine, Finanzen, Küren, Chat, Check-in; Basis-Module: CoreModels, CoreDatabase, CoreNetworking, DesignSystem) – erzwingt Schichtengrenzen über Sichtbarkeiten und beschleunigt Builds.
5. **Sync-Engine richtig:** Delta-Sync über `updated_at`-Cursor pro Tabelle, **Outbox-Pattern** für Offline-Writes (Queue-Tabelle in GRDB, Replay bei Reconnect), definierte Konfliktstrategie (Last-Write-Wins mit Server-Timestamp, kritische Entitäten mit Versionszähler). Medien: nur Storage-URLs + lokaler Datei-Cache mit Checksumme – **niemals Base64 in DB-Spalten**.
6. **Dependency Injection** (SwiftUI-Environment oder leichtgewichtiger Container) statt 34 Singletons; Admin-Impersonation als expliziter `SessionContext` (eigener Scope), nicht als globale Override-IDs.

### Modernes SwiftUI
7. **Baseline iOS 17/macOS 14** (besser 18/15): `@Observable` (Observation-Framework) statt `ObservableObject`/`@Published`, `NavigationStack`/`NavigationSplitView` konsequent, keine UUID-Reset-Hacks.
8. **Design-System von Tag 1** (analog „GoMessMo 2.0"/KetoTokens aus den Schwesterprojekten): Token (Farben/Typo/Spacing) + Komponentenbibliothek; harte Obergrenze ~300 Zeilen pro View, Feature-Screens aus Komponenten komponieren.
9. **Plattform-Adaption statt `#if os`-Streuung:** ein `PlatformAdaptiveNavigation`-Layer und wenige gezielte Abstraktionen (Bild, Farben, Share) kapseln die 637 Verzweigungen.
10. **String Catalogs (`.xcstrings`)** statt `.strings` + `L()`-Funktion; bestehende de/en/fr/ru/tr-Übersetzungen migrieren (Skript-gestützt). DE + EN immer gemeinsam pflegen.

### Sicherheit & Betrieb
11. **Neues JWT-Secret + Key-Handling:** Demo-Secret ersetzen (Backend-Thema, aber App-Blocker), Anon-Key aus `xcconfig`/Build-Setting statt Quellcode, keine Secrets in Doku-Dateien; Environment-Auswahl über Build-Konfigurationen (Debug→Staging, Release→Prod), kein toter LAN-Code.
12. **Offline-Auth ohne eigenen Passwort-Stack:** Supabase-Session im Keychain + Offline-Grace-Period (Token-basiert); den lokalen SHA256-Login komplett streichen. Wenn Offline-Login zwingend: Gerät-PIN/Face ID statt Passwort-Hash.
13. **`os.Logger` mit Kategorien** statt 948 `print()`; keine personenbezogenen Daten in Logs (DSGVO).
14. **Repo-Hygiene v2:** ein Projekt-Generator als Wahrheit (XcodeGen oder Tuist, inkl. Watch/Widget-Targets), nur SPM (AdMob gibt es inzwischen als SPM-Paket – falls Werbung in v2 überhaupt bleibt), `.gitignore` für Pods/build/DerivedData, keine SQL-Hotfixes im App-Repo.
15. **Tests von Anfang an:** Unit-Tests für Repositories/Sync (mit In-Memory-GRDB), Snapshot-Tests für Design-System-Komponenten, ein UI-Smoke-Test pro Kern-Flow. Zielgröße: kritische Pfade (Auth, Sync, Finanzen) ≥ 80 %.

### Wiederverwendbar aus v1
- **Domänenwissen & Feldlisten:** die 63 Model-Dateien in `RollsportManager/Models/` + CodingKeys dokumentieren das komplette DB-Schema faktisch fehlerfrei – als Spezifikation für v2-Modelle nutzen.
- **Finanz-/PDF-Logik:** `Services/Finance/*` (Rechnungs-/Mahnungs-PDF, Export) ist fachlich ausgereift und portierbar.
- **Widget + WidgetDataManager** (`RollsportManagerWidget/`, `Services/WidgetDataManager.swift`): fast unverändert übernehmbar.
- **Watch-App-Konzept** (Check-in, Termine via WatchConnectivity) und **QR-Check-in-Logik** (`ViewModels/CheckinViewModel.swift`).
- **Lokalisierungs-Bestand** (5 Sprachen, ~2.700 Keys) nach Bereinigung in String Catalogs.
- **StoreKit-Grundgerüst** (`Services/StoreKitManager.swift`) und Premium-/Limit-Modell als fachliche Vorlage – in v2 aber serverseitig durchsetzen (vgl. Paywall-Lektion aus KetoTracker v2).

---

## 6. Fazit

v1 ist ein fachlich reiches, aber architektonisch erschöpftes System: Ein 8.500-Zeilen-Manager, dreifache Modelle, drei Cache-Systeme, Pseudo-Sync, Demo-JWT in Produktion und null Tests machen jede weitere Funktion teurer als die vorherige. Der wertvollste Bestandteil ist nicht der Code, sondern das darin kodierte **Domänenwissen** (Modelle, Abläufe, Übersetzungen, Finanzlogik). v2 sollte als offline-first, modular gepackter SwiftUI-Neubau (iOS 17+, `@Observable`, Repository-Pattern, GRDB-ValueObservation, Outbox-Sync) entstehen und v1 gezielt als Spezifikation plündern – nicht als Codebasis fortführen.
