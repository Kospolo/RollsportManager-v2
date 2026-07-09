# iOS/macOS UI/UX-Audit — RollsportManager (Bestandsapp)

**Rolle:** iOS-UI/UX-Auditor
**Datum:** 09.07.2026
**Codebase:** `/Users/marcelgoldfuss/Apps/RollsportManager/rollsportmanager-ios-macos`
**Umfang:** 277 Swift-Dateien, ca. 128.500 Zeilen (App + Watch App + Widget)
**Deployment-Targets:** iOS 16.0 (teilweise 17.0 im pbxproj), macOS 13.0 (`project.yml` Zeilen 4–6)

---

## 1. Überblick

Die iOS/macOS-App ist eine SwiftUI-Multiplattform-App (ein gemeinsamer Code für iPhone, iPad und macOS, dazu eine Watch App und ein Widget-Target). Die Grundarchitektur der Navigation ist richtig gedacht — TabBar auf dem iPhone, `NavigationSplitView` mit Sidebar auf iPad und Mac —, aber die Umsetzung ist über 14 Monate organisch gewachsen: riesige monolithische View-Dateien (bis 3.591 Zeilen), praktisch kein Design-System, Navigation über UUID-Reset-Hacks, ein manueller Dark-Mode-Schalter, der die Systemeinstellung ignoriert, und quasi null Accessibility. macOS erhält im Wesentlichen die iOS-Oberfläche in einem großen Fenster; echte Mac-Idiome (Menübefehle, Tastaturkürzel, Tabellen, Hover) fehlen fast vollständig — die Menübefehle im App-Target sind sogar leere TODO-Stubs.

Funktional ist die App beeindruckend breit (45 Navigationsziele, 26 konfigurierbare Menüpunkte, modulare Feature-Flags pro Verein), aber genau diese Breite hat ohne Systematik zu massiver UI-Inkonsistenz geführt. Für v2 ist ein Neuaufbau mit Design-System, typisiertem Router und echten Plattform-Idiomen klar die richtige Entscheidung.

---

## 2. Ist-Zustand im Detail

### 2.1 Navigationsstruktur

**Zentrale Datei:** `RollsportManager/Views/MainView.swift` (1.579 Zeilen — enthält MainView, MoreMenuView, MoreMenu-Karten, UserInfoView und das 45-Fälle-Enum `NavigationTab` in einer Datei).

| Plattform | Muster | Fundstelle |
|---|---|---|
| iPhone | `TabView` mit 5 Tabs: Home, Kalender, Teams, Chat, Mehr | `MainView.swift:207–283` |
| iPad | `NavigationSplitView` (doubleColumn, Sidebar 250–320 pt) | `MainView.swift:310–350` |
| macOS | `NavigationSplitView` (Sidebar min. 220 pt) | `MainView.swift:395–433` |
| Watch | `NavigationStack` + `List` (Check-in, Timer, Chat, Termine) | `RollsportManager Watch App/ContentView.swift` |

**Routing-Mechanik:**
- Ein einziges `@State selectedTab: NavigationTab` steuert alles; der Detailbereich ist ein gigantisches `switch selectedTab` mit 45 Fällen (`MainView.swift:665–765`).
- Die Sidebar besteht nicht aus `List(selection:)`-Zeilen, sondern aus manuellen `Button`s mit `listRowBackground`-Highlight (`MainView.swift:616–646`) — dadurch keine Pfeiltasten-Navigation auf dem Mac, kein natives Selektionsverhalten.
- **UUID-Reset-Antipattern:** Bei jedem Tab-/Sidebar-Wechsel und bei Admin-Vereinswechsel werden `NavigationStack`s per `.id(UUID())` komplett zerstört und neu aufgebaut (`dashboardNavID`, `kalenderNavID`, `iPadDetailNavID`, `contentResetID` usw., `MainView.swift:59–70, 200–205, 286–301, 649–661`). Das verwirft sämtlichen View-State, Scroll-Positionen und laufende Ladevorgänge — spürbar als „die App vergisst, wo ich war".
- Cross-View-Kommunikation läuft über `NotificationCenter` (`.modulesDidChange`, `.adminVereinDidChange`, `.messagesReadNotification`, `.badgeDidChange` — `MainView.swift:83–122`) statt über beobachtbaren State.
- Deep-Links (Push → Chat/Termin/News) werden imperativ in `handleDeepLinkNavigation()` behandelt und öffnen Sheets statt in den Navigationspfad zu routen (`MainView.swift:856–903`).
- Reste von Legacy-`NavigationView` in 3 Dateien (`MainView.swift`, `Views/Kuer/KuerenNavigationView.swift`, `Views/Dashboard/DashboardView.swift`); daneben 229 `NavigationStack`- und nur 9 `NavigationSplitView`-Vorkommen.
- Der iPhone-„Mehr"-Tab (`MoreMenuView`, `MainView.swift:909–1207`) ist ein 2-spaltiges Kachelgrid mit 26 Menüpunkt-Typen (`Models/AppCustomization.swift`), jeder mit eigenem Farbverlauf — de facto eine zweite, redundante Navigationswelt neben der Sidebar.

### 2.2 Wichtigste Views (nach Größe und Bedeutung)

| View | Zeilen | Zweck |
|---|---|---|
| `Views/Admin/AdminView.swift` | 3.591 | Admin-Hub, 24 View-Structs in einer Datei |
| `Views/Kuer/KuerDetailView.swift` | 3.510 | Kür-Detail mit Video/Audio/Bewertung |
| `Views/Mitglieder/MitgliederListView.swift` | 2.279 | Mitgliederliste inkl. Lösch-Logik in der View |
| `Views/Dashboard/DashboardView.swift` | 2.258 | Dashboard, 44 `@State`-Properties, 18 Sheets |
| `Views/Verein/VereinSettingsView.swift` | 1.840 | Vereinseinstellungen |
| `Views/Kuer/KuerenNavigationView.swift` | 1.801 | Küren-Navigation |
| `Views/Chat/ChatListView.swift` | 1.765 | Team-Chat + DM + SpeechRecognizer-Klasse (!) |
| `Views/MainView.swift` | 1.579 | Shell/Navigation |
| `Views/Payment/InvoiceListView.swift` | 1.199 | Rechnungen |
| `Views/Finance/DunningView.swift` | 1.035 | Mahnwesen |

Insgesamt 37 Feature-Ordner unter `Views/` (Abteilung, Admin, Auth, Calendar, Chat, Checkin, Dashboard, Dokumente, Equipment, Events, Facility, Family, Favoriten, Finance, Galerie, Jubilaeum, Kuer, Membership, Mitglieder, News, Notizen, Payment, Pflichtstunden, Premium, Profile, Schliessfach, Search, Settings, Stats, Team, Termin, Training, Verein, Waitlist, Wettkampf …).

### 2.3 Design-Patterns und Konsistenz

**Design-System: praktisch nicht vorhanden.**
- Wiederverwendbare Komponenten: genau 6 Dateien (`Components/StatCard.swift`, `EmptyStateView.swift`, `OfflineStatusView.swift`, `PriorityBadge.swift`, `VereinLogoView.swift` sowie `Views/Components/ChartComponents.swift`). Kein Theme-/Token-File (kein Treffer für `Theme`/`DesignSystem` im Projekt; einzige Farb-Infrastruktur ist `Extensions/Color+Hex.swift`).
- **Farbchaos:** 631 direkte `foregroundColor(.blue/.purple/.orange/…)`-Aufrufe in Views, 66 hartcodierte `Color(red:)`/`Color(hex:)`-Konstruktionen, 95 `LinearGradient`s. Jede MoreMenu-Kachel und jede Admin-Sektion definiert eigene Farben (`AdminView.swift:44–56`).
- **Eckenradien:** 12 verschiedene Werte im Einsatz (2, 3, 4, 6, 8, 10, 12, 14, 16, 20, 24, 25) — 197× `cornerRadius(12)`, 113× `(16)`, 100× `(8)` usw.
- **Typografie:** über 130 fixe Schriftgrößen (`.font(.system(size: 40/48/50/60/80/100))`) statt semantischer Textstile — bricht Dynamic Type vollständig.
- Plattform-Systemfarben nur über selbstgebaute Compat-Wrapper (`Color+Hex.swift:71–104`: `systemBackgroundCompat`, `systemGroupedBackgroundCompat` …), die auf macOS teils nur Näherungen sind (z. B. `tertiary` = `controlBackgroundColor.opacity(0.5)`).

**Architektur-Inkonsistenz in Views:**
- 90 View-Dateien greifen direkt auf das Singleton `SupabaseManager.shared` zu (Netzwerk-Aufrufe, Business-Regeln wie „User 15 nie löschen" direkt in der View, `MitgliederListView.swift:44–66`). Die 20 ViewModels unter `ViewModels/` werden nur teilweise benutzt.
- Kein `@Observable` (Observation-Framework, 0 Treffer) — durchgängig `ObservableObject`/`@StateObject`; 83 Alt-Syntax-`onChange(of:)`-Closures.
- 324 `print()`-Statements in Views (Debug-Ausgaben in Produktion).
- 193 `.sheet(`-Modifier und 129 `.alert(`-Modifier — Sheets als universelles Navigationsmittel, teils 18 Sheets an einer einzigen View (`DashboardView.swift`).
- **Doppelte Typdefinitionen** (dokumentiert in `REPARATUR_PLAN.md`): GRDB-Typen in `Models/`, Supabase-Typen in `ViewModels/`, lokale UI-Typen in `Views/` — Workaround war ein `RSM`-Prefix, das laut Plan immer noch unvollständig ist (8 Enums offen).
- Modernere Patterns sind punktuell vorhanden: 43× `.refreshable`, 21× `.searchable`, 11× `swipeActions`, 12× `contextMenu`, 190× `.toolbar` — aber ohne einheitliche Regeln, wo was verwendet wird.

**Lokalisierung:**
- Eigene Hilfsfunktion `L(key, default)` über `NSLocalizedString` (`Extensions/LocalizationExtension.swift:27`), 5 Sprachen (`de/en/tr/ru/fr.lproj/Localizable.strings`). Keine String Catalogs (.xcstrings), keine Typsicherheit; im Repo liegen Hilfsskripte (`translate_keys.py`, `fix_ios_i18n.py`, `append_strings.py`) — Indiz für einen fehleranfälligen manuellen Prozess.
- Viele Strings umgehen `L()` komplett und sind roh Deutsch hartcodiert (z. B. alle `AdminSection`-Beschreibungen `AdminView.swift:58–71`, `navigationTitle "Vereinsverwaltung"` `AdminView.swift:118`, komplette Watch-App).

### 2.4 macOS-Anpassungen (weitgehend fehlend)

- Nur **47** `#if os(macOS)`-Blöcke gegenüber **590** `#if os(iOS)` — der Mac bekommt fast überall unverändert die iOS-UI.
- **Menübefehle sind Attrappen:** In `App/RollsportManagerApp.swift:303–313` sind „Neuer Termin" (Cmd+N) und „Neue Nachricht" (Cmd+Shift+N) als leere `// TODO:`-Buttons implementiert — die einzigen 2 `keyboardShortcut`-Vorkommen der gesamten App.
- Keine `Settings`-Scene (Cmd+,), kein Multi-Window/`WindowGroup`-Konzept (App beendet sich beim Schließen des letzten Fensters, `MacAppDelegate`, `RollsportManagerApp.swift:165–170`), keine Toolbar-Anpassung, kein `Table` für datenlastige Listen (Mitglieder, Rechnungen, Zahlungen — alles iPhone-Listen im 1.200×800-Fenster).
- Nur **2** `onHover`-Vorkommen; keine Hover-States auf klickbaren Karten.
- Sheets werden mit `frame()`-Hacks dimensioniert (`adaptiveSheetSize`, `macOSSheet` in `Services/PlatformHelper.swift:207–234`).
- Positiv: Share/Clipboard sind sauber abstrahiert (`PlatformHelper.swift`: `NSSharingServicePicker`, `NSPasteboard`, `NSSavePanel` für CSV-Export).
- Auf macOS wird sogar der Werbe-/Premium-Banner (`SmartAdBanner`) per `safeAreaInset` unter jede Seite gelegt (`MainView.swift:420–425`) — auf einer Desktop-App ein sehr untypisches Muster.

### 2.5 iPad-Layouts

- Grundgerüst gut: `NavigationSplitView(columnVisibility:)` mit `.balanced`, Sidebar-Breite 250–320 pt, User-Info-Karte unten in der Sidebar (`MainView.swift:310–388`).
- Dashboard hat ein eigenes Zwei-Spalten-Layout für iPad/macOS (`DashboardView.swift`, `twoColumnLayoutWithoutQuickActions`).
- **Aber:** Geräteerkennung läuft über `UIDevice.current.userInterfaceIdiom` und `UIScreen.main.bounds.width < 600` (`PlatformHelper.swift:43–76`, 7× deprecated `UIScreen.main`) statt über Size Classes. Konsequenz: Im iPad-Split-View/Stage-Manager (kompakte Breite) bleibt das „iPad-Layout" aktiv und bricht; iPhone-Landscape wird nie als regular behandelt.
- `AdaptiveGrid`/`adaptiveColumns` (fix 2 Spalten auf iPad/Mac, `PlatformHelper.swift:260–333`) reagieren nicht auf tatsächliche Fensterbreite.
- Werbebanner wird auf dem iPad per `safeAreaInset` auf **jeder** Detailseite eingeblendet (`MainView.swift:333–338`); auf dem iPhone schwebt er mit `padding(.bottom, 50)` **über** der Tab-Leiste (`MainView.swift:274–280`) — ein fragiler Magic-Number-Hack.

### 2.6 Dark Mode

- **Kern-Altlast:** `@AppStorage("darkMode") private var darkMode = false` + `.preferredColorScheme(darkMode ? .dark : .light)` (`App/RollsportManagerApp.swift:364, 379`). Die App **erzwingt** damit standardmäßig Light Mode und ignoriert die Systemeinstellung komplett; es gibt keinen „System"-Modus.
- Da Farben überwiegend Systemfarben oder Paletten-Farben sind, würde Dark Mode teilweise funktionieren — aber hartcodierte Hex-Farben ohne Dark-Variante (66 Stellen), schwarze Schatten-Overlays (`DashboardView.swift:27–51` NameStyleModifier) und weiße Text-auf-Gradient-Karten sind nicht Dark-Mode-geprüft. Es existieren keine Asset-Catalog-Farben mit Any/Dark-Appearance.

### 2.7 Accessibility

Praktisch nicht vorhanden — der gravierendste Einzelbefund:
- **1** einziges `accessibilityLabel`/`accessibilityHint`-Vorkommen in 277 Dateien.
- **0** `dynamicTypeSize` / `@ScaledMetric`; stattdessen >130 fixe Pixel-Schriftgrößen.
- **0** Abfragen von `accessibilityReduceMotion`, `differentiateWithoutColor`, `reduceTransparency`.
- Icon-only-Buttons (Logout-Icon `MainView.swift:376–382`, QR-Scanner, Chat-Send) ohne Label → VoiceOver liest nichts Sinnvolles vor.
- Rollen-/Statusinformation wird häufig nur über Farbe transportiert (Rollenfarben, Mahnstufen, Badge-Farben).
- `@FocusState` nur 1× — Formulare (Registrierung, 895 Zeilen `Auth/RegisterView.swift`) ohne Tastatur-Fokusführung.

### 2.8 Charts / Statistiken

- Swift Charts wird genutzt: `Views/Components/ChartComponents.swift` (Line-, Area-, Point-Marks, eigene Achsen; `AttendanceLineChart`, Termin-Typ-Verteilung u. a.), eingebettet in `Views/Stats/StatsView.swift` (630 Zeilen).
- Wegen iOS-16-Target existiert ein manueller `PieSlice`-Shape-Fallback für Kreisdiagramme (`ChartComponents.swift:11–27`) — mit iOS 17+ (`SectorMark`) obsolet.
- Charts sind statisch: kein `chartScrollableAxes`, keine Selektion/Interaktion, keine `.chartXSelection`.

### 2.9 Watch App und Widget

- Watch App (`RollsportManager Watch App/`, ~500 Zeilen + Views/Services): sinnvoller, fokussierter Umfang (nächster Termin, Check-in, Timer, Nachrichten, News) via `WatchConnectivityService`. Strings komplett hartcodiert Deutsch — keine Lokalisierung.
- Widget (`RollsportManagerWidget/RollsportManagerWidget.swift`, 664 Zeilen): Home- und Lock-Screen-Widgets vorhanden (laut Projektstand 07/2026 fertig; App-Group-Login auf Gerät war offen).

### 2.10 Projekt-Hygiene (UI-relevant)

- Duplikate im Repo-Root: `RollsportManager 2.xcodeproj`, `RollsportManager 2.xcworkspace`, `Podfile 2`, `Podfile 2.lock` sowie eingecheckte `build/`- und `build_ios/`-Ordner und ein Dutzend `FIX-*.sql`-Dateien — erschwert Orientierung und CI.
- Mischung aus CocoaPods (Google Mobile Ads, iOS-only) und SPM (GRDB) — Pods erzwingen Workspace-Handling.
- Werbung ist tief in die UI-Shell verdrahtet (AdsManager-Init im AppDelegate, Interstitial-Logik nach Kür-Wiedergabe, Banner in MainView) — für v2 mit anderem Monetarisierungsmodell (siehe KetoTracker-Learnings: Paywall serverseitig durchsetzen) neu zu denken.

---

## 3. Stärken (mitnehmen nach v2)

1. **Adaptive Navigations-Grundidee:** TabBar (iPhone) vs. `NavigationSplitView` (iPad/Mac) ist das richtige Muster und bereits etabliert (`MainView.swift:180–194`).
2. **Modul-System pro Verein:** Sidebar/Menü blenden Features anhand von Feature-Flags (`modulKuerenEnabled`, `modulChatEnabled` …) und Rollen sauber aus (`MainView.swift:438–614`) — starkes Konzept für einen Mandanten-fähigen Vereinsmanager.
3. **Rollenbasierte UI-Gates** konsequent durchgezogen (Trainer/Kassenwart/Moderator/Admin/Super-Admin inkl. Super-Admin-Override-Banner, `MainView.swift:769–815`).
4. **Personalisierung:** konfigurierbares Dashboard (`DashboardConfig`) und sortierbares „Mehr"-Menü mit Drag&Drop (`Views/Settings/AnpassungenView.swift`) — Nutzer lieben das, in v2 beibehalten.
5. **Swift Charts bereits im Einsatz** (`ChartComponents.swift`) — Team kennt das Framework.
6. **Plattform-Abstraktionen existieren** (Haptics, Clipboard, Share, `PlatformHelper.swift`) — gutes Fundament, nur unvollständig genutzt.
7. **Ökosystem-Abdeckung:** Watch App, Home-/Lock-Widgets, Push mit Deep-Links, Offline-Sync-Anzeige (`Components/OfflineStatusView.swift`).
8. **5 Sprachen** bereits gepflegt (de/en/fr/ru/tr) — Übersetzungsbestand als Ausgangsbasis für v2-String-Catalogs verwertbar.
9. Punktuell moderne UX: Pull-to-Refresh, `.searchable`, Swipe-Actions, EmptyStates, `.ultraThinMaterial`-Karten.

---

## 4. Schwächen / Altlasten

1. **Kein Design-System:** 631 Ad-hoc-Farben, 12 Eckenradien, >130 fixe Schriftgrößen, nur 6 wiederverwendbare Komponenten — jede der ~37 Feature-Sektionen sieht anders aus.
2. **Monolithische View-Dateien:** AdminView 3.591, KuerDetailView 3.510, MitgliederListView 2.279, DashboardView 2.258 Zeilen (44 `@State`, 18 Sheets) — unwartbar und Compile-Zeit-Killer.
3. **Navigation per UUID-Reset-Hack** statt State-getriebenem Routing; kein `navigationDestination`-basiertes, typisiertes Routing; Deep-Links als Sheets; Sidebar ohne native Selektion; kein State-Restore.
4. **Dark Mode kaputt konzipiert:** manueller Toggle mit Light-Default, Systemeinstellung wird überschrieben (`RollsportManagerApp.swift:379`).
5. **Accessibility de facto null** (1 Label, kein Dynamic Type, keine Reduce-Motion-Pfade) — auch ein App-Review-/DSGVO-/BFSG-Risiko (Barrierefreiheitsstärkungsgesetz gilt seit 06/2025 für Verbraucher-Apps).
6. **macOS ist eine hochskalierte iPhone-App:** leere Menü-TODOs, 2 Shortcuts, keine Settings-Scene, kein `Table`, kein Multi-Window, kaum Hover — für Vereinsverwaltung am Desktop (der Kern-Anwendungsfall von Kassenwarten!) unzureichend.
7. **iPad-Erkennung über Idiom/UIScreen statt Size Classes** — bricht in Split View/Stage Manager; `UIScreen.main` ist deprecated.
8. **Views sprechen direkt mit `SupabaseManager.shared`** (90 Dateien), Business-Regeln in Views, `NotificationCenter` als Event-Bus, 324 `print()` — UI und Datenlogik untrennbar verfilzt.
9. **Doppelte Typwelten** (GRDB vs. Supabase vs. UI, `REPARATUR_PLAN.md`) mit halbfertigem RSM-Prefix-Workaround.
10. **Lokalisierung fragil:** `L(key, default)`-Muster mit hartcodierten Fallbacks, keine String Catalogs, viele un-lokalisierte Roh-Strings (Admin-Bereich, Watch App komplett).
11. **Werbe-Banner in die Shell gehackt** (schwebt über der Tab-Bar, liegt auf jeder iPad-/macOS-Seite) — Layout-Hacks mit Magic Numbers.
12. **Veraltete/gemischte API-Stände:** Legacy-`NavigationView`-Reste, 83 alte `onChange`-Signaturen, kein `@Observable`, iOS-16-Fallbacks (PieSlice) neben iOS-17-Code.
13. **Projekt-Hygiene:** duplizierte xcodeproj/Podfiles, eingecheckte Build-Ordner, SQL-Fixes im App-Repo.

---

## 5. Konkrete Empfehlungen für den Neuaufbau (v2)

### 5.1 Fundament (zuerst bauen)

1. **Design-System als eigenes SPM-Package** (`RSMDesignSystem`): semantische Farb-Tokens im Asset Catalog (Any/Dark-Appearance), Typo-Skala ausschließlich über `Font.TextStyle` (+ `@ScaledMetric` für Sonderfälle), Spacing-Skala (4/8/12/16/24/32), genau 2–3 Eckenradien, Schatten-/Material-Tokens. Analog zum bewährten Vorgehen bei GoMessMo („Theme.swift + GMComponents") und KetoTracker („KetoTokens").
2. **Komponentenbibliothek** vor Feature-Bau: `RSMCard`, `RSMListRow`, `RSMBadge`, `RSMStatTile`, `RSMEmptyState`, `RSMAvatar`, `RSMSectionHeader`, Formular-Bausteine — jede Komponente mit Preview, Dark-Mode- und Dynamic-Type-Snapshot.
3. **Ziel-Betriebssysteme anheben: iOS 17+ (besser 18), macOS 14+.** Damit: `@Observable` statt `ObservableObject`, `SectorMark` statt PieSlice-Fallback, neue `onChange`-Signatur, `NavigationSplitView`-Reife, `ContentUnavailableView` für Empty States.
4. **CocoaPods eliminieren** (reines SPM); Ads-SDK nur laden, wenn Monetarisierung es in v2 überhaupt noch braucht — Monetarisierung serverseitig durchsetzen statt nur im Client (Learning aus KetoTracker-v2-Blueprint).

### 5.2 Navigation und Struktur

5. **Typisierter Router als Single Source of Truth:** ein `@Observable AppRouter` mit `NavigationPath` pro Bereich, `enum Route: Hashable` (Mitglied(id), Rechnung(id), Kür(id) …) und `.navigationDestination(for:)`. Tab-/Sidebar-Auswahl, Deep-Links (Push, URL, Widget-Intents) und State-Restoration (`@SceneStorage`) laufen alle über denselben Router — keine UUID-Resets, keine NotificationCenter-Events mehr.
6. **Sidebar als `List(selection:)`** mit `NavigationSplitView` (iPad/Mac), auf dem iPhone `TabView` mit maximal 5 Tabs plus durchsuchbarem „Mehr"-Bereich; die 45 Ziele des Alt-Enums auf klare Hubs konsolidieren (Vorschlag: Heute/Dashboard, Kalender, Verein [Teams/Mitglieder/Küren/Training], Kommunikation, Finanzen, Einstellungen). iOS 18 `TabView`/`TabSection`-API mit Sidebar-Adaptivität auf dem iPad evaluieren.
7. **Size Classes statt Idiom-Checks:** `@Environment(\.horizontalSizeClass)` als einziges Kriterium für kompakt/regulär; `UIScreen.main` und `userInterfaceIdiom`-Layout-Weichen verbieten (Lint-Regel). Stage-Manager-/Split-View-Tauglichkeit als Definition of Done.
8. **View-Größenbudget:** harte Richtlinie ~300 Zeilen pro View-Datei; Feature-Module als SPM-Packages (Members, Finance, Kueren, Events, Chat …) mit eigener Preview-App.

### 5.3 Plattform-Idiome

9. **macOS ernst nehmen:** funktionierende `commands {}` (Neuer Termin, Neues Mitglied, Suche Cmd+F, Navigation Cmd+1…9), `Settings`-Scene, `Table` mit Sortierung/Mehrfachauswahl/Kontextmenü für Mitglieder-, Rechnungs- und Zahlungslisten, Hover-States auf allen klickbaren Karten, Drag&Drop (z. B. Dokumente, Galerie), Multi-Window (Kür-Video in eigenem Fenster), Menüleisten-Export (CSV/PDF). Der Kassenwart am Mac ist eine Kern-Persona.
10. **iPad:** dreispaltiges `NavigationSplitView` wo sinnvoll (Liste → Detail → Inspector, z. B. Mitglieder), Pointer-/Pencil-Support, Tastaturkürzel via `keyboardShortcut` auch auf iPad, `Table` im regular-Layout.
11. **iPhone:** Termin-/Wettkampf-Live-Scoring als **Live Activity** (Dynamic Island), App Intents für „Check-in", „Nächster Termin" (Siri/Shortcuts/Widgets interaktiv), bestehende Widgets auf App-Intent-Basis portieren.
12. **Watch:** fokussierten Umfang beibehalten (Check-in, nächster Termin, Timer), aber lokalisieren und auf gemeinsame Modelle/Design-Tokens umstellen.

### 5.4 Erscheinungsbild und Zugänglichkeit

13. **Dark Mode korrekt:** Tri-State-Einstellung System/Hell/Dunkel mit System als Default (`preferredColorScheme(nil)` für System); alle Farben als Asset-Catalog-Tokens mit Dark-Variante; verbotene Muster (fixe `.black`-Schatten auf Text, weiße Schrift auf hellen Gradients) im Review-Check.
14. **Accessibility als Gate, nicht als Nachtrag:** Labels auf allen Icon-Buttons, `accessibilityElement(children: .combine)` auf Karten, Dynamic Type bis XXL getestet (keine fixen Größen), `Reduce Motion`-Pfade für Animationen, Kontrast ≥ 4,5:1, VoiceOver-Smoke-Test pro Feature vor Merge. BFSG-Konformität explizit als Anforderung dokumentieren.
15. **Haptik/Feedback systematisieren:** vorhandenen `PlatformHelper`-Haptics-Ansatz zu einem `FeedbackManager` ausbauen (Erfolg/Fehler/Selektion einheitlich).

### 5.5 Daten, Zustand, Inhalte

16. **Eine Modellwelt:** ein einziges Domain-Model-Package (kein GRDB-/Supabase-/UI-Typ-Dreiklang, kein RSM-Prefix-Workaround); Mapping zu Persistenz/API an den Rändern. UI konsumiert nur noch Stores/UseCases — nie `SupabaseManager.shared` direkt.
17. **`@Observable`-Stores pro Feature** + Swift Concurrency; `NotificationCenter`-Event-Bus und `print()`-Debugging (durch `Logger`/OSLog ersetzen) verbannen.
18. **String Catalogs (.xcstrings)** mit typsicheren generierten Keys; DE+EN vollständig als Pflichtpaar (bestehende fr/ru/tr-Bestände migrieren), Umlaute strikt (ä/ö/ü/ß). Kein `L(key, fallback)`-Muster mehr — der Fallback verdeckt fehlende Übersetzungen.
19. **Skeleton-/Redaction-Loading** (`.redacted(reason: .placeholder)`) statt Spinner, `ContentUnavailableView` für Empty/Fehler/Offline; Offline-Status als dezente Capsule beibehalten.

### 5.6 Auswertungen und besondere Chancen

20. **Swift Charts ausbauen:** interaktive Charts (`chartXSelection`, scrollbare Achsen), `SectorMark`-Donuts für Beitragsstatus, Heatmap (RectangleMark) für Anwesenheit pro Wochentag, Sparklines in StatTiles; einheitliche Chart-Farbpalette aus dem Design-System.
21. **Kür-Editor als Leuchtturm-Feature:** Video-Player mit Kapitel-Markern (Timestamps existieren als Modell `Models/KuerVideoTimestamp.swift`), Frame-genaues Scrubbing, Split-View Video+Notizen auf iPad/Mac — hier kann v2 sich vom Wettbewerb absetzen.
22. **Onboarding & leere Zustände gestalten:** Der Alt-Flow (Verein anlegen → Demo-Daten-Sheet → Lizenz-Sheet nach 1 s Delay, `MainView.swift:130–178`) wirkt gestapelt; in v2 als geführter, unterbrechbarer Onboarding-Flow mit klarer Trial-Kommunikation neu bauen.

### 5.7 Priorisierung (Vorschlag)

| Phase | Inhalt |
|---|---|
| P0 | Design-System + Komponentenbibliothek, Router/Navigation-Shell (Tab + SplitView), Dark-Mode-/A11y-Grundregeln, iOS 17+/macOS 14+ |
| P1 | Kern-Flows: Dashboard, Kalender/Termine, Mitglieder (mit `Table` auf Mac/iPad), Chat |
| P2 | Finanzen (Rechnungen/Mahnwesen — Desktop-first), Küren-Editor, Statistiken mit interaktiven Charts |
| P3 | Watch, Widgets/Live Activities/App Intents, Galerie/Dokumente, Gamification |

---

## 6. Referenzierte Schlüsseldateien

- `RollsportManager/Views/MainView.swift` — Navigations-Shell, UUID-Reset-Hacks, MoreMenu, 45-Fälle-Routing
- `RollsportManager/App/RollsportManagerApp.swift` — Dark-Mode-Zwang (Z. 364/379), leere macOS-Menü-TODOs (Z. 303–313)
- `RollsportManager/Services/PlatformHelper.swift` — Idiom-/UIScreen-basierte Layout-Weichen, Sheet-Größen-Hacks
- `RollsportManager/Extensions/Color+Hex.swift` — einzige Farb-Infrastruktur (Compat-Wrapper)
- `RollsportManager/Extensions/LocalizationExtension.swift` — `L(key, default)`-Lokalisierungsmuster
- `RollsportManager/Views/Admin/AdminView.swift` (3.591 Z.), `Views/Kuer/KuerDetailView.swift` (3.510 Z.), `Views/Dashboard/DashboardView.swift` (2.258 Z., 44 `@State`) — Monolith-Beispiele
- `RollsportManager/Views/Components/ChartComponents.swift` — Swift-Charts-Nutzung inkl. iOS-16-PieSlice-Fallback
- `RollsportManager/Models/AppCustomization.swift`, `Views/Settings/AnpassungenView.swift` — Personalisierungs-System (Stärke)
- `REPARATUR_PLAN.md` — dokumentierte Typ-Duplikat-Altlast
- `FUNKTIONEN.md` — Funktionsumfang v1.4 (Build 111)
- `RollsportManager Watch App/ContentView.swift`, `RollsportManagerWidget/RollsportManagerWidget.swift` — Ökosystem-Targets
