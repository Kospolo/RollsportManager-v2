# Offline- & Sync-Architektur — Fachreport (Sync/Realtime-Spezialist)

Stand: 2026-07-09 · Analysierte Codebases: iOS/macOS (SwiftUI), Android (Kotlin/Compose), Backend (self-hosted Supabase) + Web-Portal

---

## 1. Überblick

RollsportManager hat **drei völlig unabhängige, unterschiedlich weit ausgebaute Offline-Implementierungen** — und keine davon ist eine echte Sync-Architektur:

| Plattform | Lokale Persistenz | Offline-Lesen | Offline-Schreiben | Realtime |
|---|---|---|---|---|
| **iOS/macOS** | GRDB/SQLite (19 Tabellen) **plus** JSON-Datei-Caches pro ViewModel | Küren/Medien, User, Verein, Teams; Termine/Teams nur als JSON-Cache | **Nein** (kein Outbox) | Vorhanden, aber **toter Code** (nie aufgerufen) |
| **Android** | Room (`rollsportmanager_offline_db`, nur 5 Entities) + Datei-Cache für Medien | Küren, Termine, Teams, User, Verein | **Nein** | Chat (Team + DM) aktiv genutzt |
| **Web-Portal** | keine (kein Service Worker, kein IndexedDB) | Nein | Nein | Chat aktiv; Wettkampf-Live **pollt** trotzdem alle 5 s |

Der "Sync" ist ausschließlich **Downstream** (Server → Client): ein periodischer Full-Download der Küren samt Medien. Es gibt **keine Upload-Queue, keine Konfliktlösung, keinen Delta-Sync und keine gemeinsame Sync-Spezifikation** über die Plattformen hinweg. `FUNKTIONEN.md` verspricht eine "Offline-Nachrichten-Queue", die im Code nicht existiert.

---

## 2. Ist-Zustand im Detail

### 2.1 iOS/macOS: GRDB-Datenmodell (Altlast der Local-First-Ära)

**`rollsportmanager-ios-macos/RollsportManager/Database/Schema.swift`** (655 Zeilen)
- Definiert **18 Tabellen**, die das komplette Server-Schema in SQLite duplizieren (users, vereine, teams, team_members, team_trainer, termine, termin_responses, attendance, kueren, kuer_media, kuer_ratings, kuer_notizen, kuer_video_timestamps, messages, verein_news, documents, invitations, trainingsplaene) — plus Tabelle 19 `offline_sync_status`.
- Die `users`-Tabelle enthält eine Spalte **`passwordHash`** (Zeile 23) — Relikt einer früheren rein lokalen Authentifizierung (`AuthViewModel.authMode = .local` existiert noch). Passwort-Hashing lokal via `hashPassword()` in `DatabaseManager.swift:1396`.
- **Migrationen sind handgestrickt**: statt GRDB `DatabaseMigrator` werden bei jedem Start dutzende `if !columns.contains("...") { alter table }`-Blöcke ausgeführt (Zeilen 61–618). Teilweise doppelt (bannerUrl/primaryColor werden zweimal geprüft, Zeilen 68–104 und 481–517).
- `kuer_media.fileData` ist eine **TEXT-Spalte mit Base64-Daten** (Zeile 199) — Medien liegen also als Base64 in SQLite **und** zusätzlich als Datei unter `Documents/OfflineMedia/kuer_<id>/` (doppelte Speicherung).

**`RollsportManager/Services/DatabaseManager.swift`** (2127 Zeilen)
- Singleton mit `DatabasePool`; bei korrupter DB wird die Datei **kommentarlos gelöscht und neu erstellt** (Zeilen 42–57) — Datenverlust als "Reparaturstrategie".
- Fehlt `fileData` in `kuer_media`, wird die Tabelle **gedroppt und neu angelegt** (Zeilen 64–89).
- Enthält eine komplette lokale CRUD-Schicht für alle 18 Tabellen (Erbe der Local-First-Zeit), von der im Supabase-Betrieb nur der Offline-Teil genutzt wird: `saveKuerForOffline` (Z. 1485, DELETE+INSERT per Roh-SQL "wegen CodingKeys-Konflikt"), `fetchOfflineKueren`/`fetchAllOfflineKueren` (Z. 1556/1574), `saveUserForOffline`/`saveVereinForOffline`/`saveTeamForOffline` (Z. 1849 ff.), `cleanupOfflineData`, `deleteAllOfflineData`.

**`RollsportManager/Services/OfflineSyncService.swift`** (398 Zeilen)
- `@MainActor`-Singleton, publiziert `syncProgress`, `isSyncing`, `lastSyncDate`, `offlineDataSize`.
- `syncAllTeamKueren()`: lädt alle Teams des Users, dann **alle Küren aller Teams samt aller Medien sequenziell** herunter (kein Delta, keine Parallelität, Base64 pro Medium einzeln via `fetchKuerMediaData`).
- Limits: 2 GB max (`maxOfflineSizeBytes`), 500 MB Mindest-Freispeicher, Schätzung "50 MB pro Kür".
- `syncIfNeeded()`: Drossel auf 1×/Stunde — aber **`lastSyncDate` wird nicht persistiert**, d. h. nach jedem App-Neustart läuft der Full-Sync erneut.
- Sync-Trigger: (a) `NotificationCenter`-Event `.networkStatusChanged` bei Netz-Wiederkehr, (b) App-Start, (c) manueller Button in `Components/OfflineStatusView.swift` (`OfflineSettingsView`, disabled wenn offline).

**`RollsportManager/Services/NetworkMonitor.swift`** (137 Zeilen)
- `NWPathMonitor`-Singleton, postet `.networkStatusChanged` mit `isOnline`/`connectionType`. Solide, aber pro Plattform neu erfunden.

**Zweiter, paralleler Cache-Mechanismus (JSON-Dateien):**
- `ViewModels/BaseViewModel.swift:176–227`: generisches `loadFromCache`/`saveToCache` als **JSON-Dateien direkt im Documents-Ordner** (unverschlüsselt).
- Genutzt von `TerminViewModel.swift` (`termine_<userId>.json`, `termin_responses_<userId>.json`) und `TeamViewModel.swift` (`teams_<vereinId>.json`) — d. h. Termine/Teams haben auf iOS einen **anderen** Offline-Pfad als Küren (SQLite). Zwei Wahrheiten, keine Invalidierung.

**Lese-Strategie:** `ViewModels/KuerViewModel.swift:134–203` (`loadKuerenSmartly`): Cache-First (SQLite anzeigen → online neu laden → UI ersetzen → im Hintergrund alle Küren erneut komplett offline speichern). Offline-Login: `ViewModels/AuthViewModel.swift:554–624` (`loadSavedUser`) fällt bei fehlender/kaputter Session auf `fetchOfflineUser()` zurück.

**Offline-UI:** `Components/OfflineStatusView.swift` (OfflineBanner, Sync-Progress, Offline-Einstellungen), `OfflineAvailableBadge` in `Views/Kuer/KuerListView.swift`, Einstieg über `Views/Settings/ProfileTabView.swift`. Entspricht der Graphify-Community 7 „Offline-Sync (iOS Views)" (77 Knoten).

### 2.2 Android: Room-basiertes Äquivalent (schmaler, aber sauberer)

**`rollsportmanager-android/app/src/main/java/de/rollsportmanager/app/data/local/AppDatabase.kt`**
- Room-DB `rollsportmanager_offline_db`, Version 2, **nur 5 Entities**: `OfflineUser`, `OfflineVerein`, `OfflineKuer`, `OfflineTeam`, `OfflineTermin` (+ je ein DAO). `fallbackToDestructiveMigration()` — Schemaänderung = Cache weg (bei reinem Cache akzeptabel).
- Entities sind **Kopien der API-Modelle mit `cachedAt`-Zeitstempel** und `toKuer()`/`fromKuer()`-Mappern — kein Sync-Metadatenmodell (kein dirty-Flag, keine Versionen).

**`data/local/OfflineSyncService.kt`** (348 Zeilen)
- Bewusste 1:1-Nachbildung des iOS-Service ("Analog zu iOS OfflineSyncService.swift"): gleiche 2-GB-/500-MB-/50-MB-Heuristiken, gleiche 1-h-Drossel, `_lastSyncDate` ebenfalls **nur im RAM**.
- `cleanupOldData()` (Z. 297–303) ist brutal: bei Überschreitung wird **der komplette Medien-Cache gelöscht** ("Einfache Implementierung: Alle löschen wenn zu voll").
- Sync-Trigger: Netz-Wiederkehr via `networkMonitor.isOnline.collect` (Flow statt NotificationCenter — idiomatischer als iOS).

**`data/local/OfflineMediaManager.kt`** (348 Zeilen): Datei-Cache für Audio/Video pro Kür (`getLocalAudioPath`, `saveMediaFromBase64`, `downloadAllKuerMedia`) — hier werden Medien **nur als Dateien** gehalten (kein Base64-in-DB wie auf iOS), aber weiterhin aus der Base64-Postgres-Spalte gespeist.

**Repositories mit Offline-Fallback (echtes Repository-Pattern, besser als iOS):**
- `data/repository/KuerRepository.kt:45–118`: `if (!networkMonitor.isOnline.value) → DAO, sonst Supabase + insertKueren(REPLACE)`.
- `data/repository/TerminRepository.kt:37–75`, `TeamRepository.kt:55/111`, `AuthRepository.kt:507–620` (Offline-Login über `getLastCachedUser()`).
- Konfliktstrategie durchgängig `OnConflictStrategy.REPLACE` (`data/local/dao/OfflineKuerDao.kt`) — Server gewinnt immer, lokale Änderungen gibt es nicht.

### 2.3 Supabase Realtime: vorhanden, aber inkonsistent genutzt

**Backend-Publikation** (`rollsportmanager-backend/migrations/`):
- `20251230_initial_schema.sql:374–376`: `messages`, `termin_responses`, `verein_news` in `supabase_realtime`.
- Später ergänzt: `push_queue` (20260109), `device_tokens`, `notification_settings`, `schliessfaecher` + `schliessfach_vermietungen` (20260119), `user_achievements`, `guest_trainer_access`, `wettkampf_details` + `wettkampf_starter` (20260201).
- Realtime-Container läuft (`docker-compose.yml:200 ff.`, supabase/realtime v2.68.0).

**Tatsächliche Nutzung pro Client:**
- **iOS**: `Services/SupabaseManager.swift:1813` (`subscribeToMessages`) ist die **einzige** Realtime-Funktion — und sie wird **nirgendwo aufgerufen** (toter Code). Der Team-Chat (`Views/Chat/ChatListView.swift:928`) lädt Nachrichten nur bei `.task`/onAppear und per manuellem Reload-Button. Kein Polling, kein Push-Refresh → neue Nachrichten erscheinen erst beim erneuten Öffnen.
- **Android**: `data/realtime/RealtimeManager.kt` (Chat + Termin-Responses als Flows) — `subscribeToTerminResponses` wird jedoch **nicht konsumiert**; aktiv genutzt wird nur der Chat-Pfad über `MessageRepository.kt` (`postgresChangeFlow`) + `ChatViewModel.kt:261–295`.
- **Web-Portal**: `www/assets/js/portal-chat.js:376–405` abonniert `INSERT` auf `messages` **ohne serverseitigen Filter** (Kanal `portal-messages`, Filterung rein clientseitig; Sichtbarkeitsschutz hängt allein an RLS/WALRUS). `www/portal/wettkampf-modus.html:724` **pollt alle 5 Sekunden** (`setInterval(loadWettkampf, 5000)`), obwohl `wettkampf_details`/`wettkampf_starter` in der Realtime-Publikation stehen. `www/assets/js/portal.js:2898`: Ungelesen-Badge via 30-s-Polling.
- **Server-Worker**: `workers/push-worker.js` ist der reifste Realtime-Konsument — Realtime-Subscription auf `push_queue`-INSERTs **plus** 30-s-Polling als Fallback (Z. 282–315). Gutes Muster (Belt & Suspenders), das die Clients nicht haben.

### 2.4 Konfliktlösung & Schreibpfad

- **Es gibt keine.** Alle Schreiboperationen gehen direkt an Supabase (z. B. `KuerViewModel.swift:102–126` `deleteKuer`/`updateStatus` → bei Offline schlicht `errorMessage`). Kein Outbox, kein Retry, keine Queue, keine Idempotenz.
- Downstream-Konflikte werden durch Überschreiben "gelöst": iOS `saveKuerForOffline` = `DELETE` + `INSERT` (DatabaseManager.swift:1498–1550), Android `OnConflictStrategy.REPLACE`.
- Keine Tombstones: serverseitig gelöschte Küren bleiben im lokalen Cache, bis der nächste Full-Sync sie zufällig nicht mehr enthält — `fetchAllOfflineKueren` liefert sie bis dahin weiter aus.
- Es gibt keine `updated_at`-Cursor-Logik, keine Versionsspalten, keine Change-Log-Tabelle im Backend.

### 2.5 Sonder-Sync-Pfade (Watch, Widgets, Kalender)

- **Watch**: `Services/WatchConnectivityManager.swift` schiebt Termine/User/Verein/Messages/News als `WCSession.sendMessage`-Snapshots zur Uhr — ad-hoc, ohne Persistenz-Garantien.
- **Widgets**: `Services/WidgetDataManager.swift` schreibt Snapshots in die App Group (bekannter Stolperstein: App-Group-Berechtigungen, vgl. RollsportManager-iOS-Widgets-Projektnotiz).
- **Kalender**: `Services/KalenderSyncManager.swift` (472 Zeilen) exportiert Termine nach EventKit — Einweg-Sync mit eigener Duplikaterkennung.
- Jeder dieser Pfade ist eine weitere handgeschriebene Mini-Sync-Engine.

### 2.6 Medien-Architektur als Sync-Bremse

`kuer_media.file_data` speichert Audio/Bilder als **Base64-TEXT in Postgres** (`SupabaseManager.swift:2398–2411` lädt es einzeln pro Medium, `createKuerMedia` Z. 2413 "speichert Base64 direkt in DB"). Konsequenzen für Sync/Realtime:
- Riesige Row-Payloads (Base64 = +33 % Overhead) über PostgREST statt CDN/Storage-Downloads mit Range-Requests/Resume.
- Realtime auf solchen Tabellen wäre praktisch unbenutzbar (WAL-Volumen).
- iOS speichert die Base64-Daten zusätzlich in SQLite **und** als dekodierte Datei — bis zu 3 Kopien desselben Mediums im System.

---

## 3. Stärken

1. **Der wichtigste Offline-Use-Case ist erkannt und funktioniert**: Kür-Musik/Videos in der Halle ohne Netz abspielen (Kern-Szenario Rollkunstlauf-Training). iOS und Android können das beide, inkl. Speicherlimits und Aufräumlogik.
2. **Offline-Login** auf beiden Plattformen (gecachter User + Verein) — App startet ohne Netz in einen nutzbaren Zustand (`AuthViewModel.swift:554 ff.`, `AuthRepository.kt:507 ff.`).
3. **Cache-First-UX** in `loadKuerenSmartly` (sofort lokale Daten zeigen, still aktualisieren) ist das richtige Pattern — nur eben nur für Küren.
4. **Android-Schicht ist sauber strukturiert**: Repository-Pattern mit Offline-Branch, Room-DAOs, Hilt-DI, NetworkMonitor als Flow — gute Vorlage für v2-Denke.
5. **Realtime-Infrastruktur steht**: Self-hosted Realtime-Container läuft, Publikationen sind migriert, der Push-Worker zeigt mit Realtime+Polling-Fallback das robusteste Muster im Projekt.
6. **Netzwerk-Status-Erkennung** konsistent auf iOS (NWPathMonitor) und Android vorhanden, mit automatischem Sync-Anstoß bei Netz-Wiederkehr.

---

## 4. Schwächen / Altlasten

1. **Offline ist read-only** — keine Outbox/Write-Queue. Anwesenheit erfassen, Termin-Zusage, Chat-Nachricht, Kür-Note: alles schlägt offline fehl oder geht verloren. Für eine Trainer-App, die in Hallen ohne Empfang benutzt wird, ist das die zentrale Lücke. (`KuerViewModel.swift:102`, kein einziges Queue-Konstrukt im Code; `FUNKTIONEN.md:127` behauptet fälschlich eine "Offline-Nachrichten-Queue".)
2. **Drei divergierende Implementierungen + vierter Schatten-Cache**: iOS GRDB, iOS JSON-Datei-Caches (BaseViewModel), Android Room, Portal nichts. Feature-Parität ist Zufall (iOS cached Termine nur als JSON, Android in Room; iOS hat Chat-Offline-Tabelle, nutzt sie nicht).
3. **iOS-GRDB-Schema ist eine Altlast**: 18 Server-Tabellen dupliziert, `passwordHash` lokal, tote CRUD-Schicht (~1400 Zeilen in DatabaseManager), handgestrickte if-exists-Migrationen, DB-Korruption ⇒ Löschung, Tabellen-Drop zur "Migration". Wartungsrisiko und Quelle von Schema-Drift zum Server (snake_case vs. camelCase nochmal anders als in Postgres).
4. **Full-Sync statt Delta**: jede Stunde (bzw. jeder App-Start, da `lastSyncDate` flüchtig) werden alle Küren aller Teams samt aller Medien sequenziell neu geladen — O(Vereinsgröße) Datenvolumen, `@MainActor`-gebunden auf iOS.
5. **Keine Konfliktlösung, keine Tombstones, keine Versionierung** — Server überschreibt lokal blind; lokal Gelöschtes taucht wieder auf, serverseitig Gelöschtes bleibt liegen.
6. **Realtime-Wildwuchs**: iOS-Chat hat gar kein Live-Update (toter `subscribeToMessages`-Code), Portal-Wettkampf pollt trotz Publikation, `subscribeToTerminResponses` (Android) ungenutzt, Publikation enthält 12+ Tabellen ohne Konsumenten. Portal-Kanal ohne serverseitigen Filter verlässt sich komplett auf RLS.
7. **Medien als Base64 in Postgres** (`kuer_media.file_data`) — größte strukturelle Altlast; verhindert effizienten Delta-/Media-Sync, bläht DB, Backups und jede Sync-Runde auf; bis zu 3 Kopien pro Medium auf iOS.
8. **Aggressive Cache-Eviction**: Android löscht bei 2-GB-Überschreitung **alles**; iOS `cleanupOfflineData` ist kaum schlauer. Kein LRU, keine Pins ("diese Kür für Wettkampf behalten").
9. **Kein Offline-Konzept für die halbe Domäne**: Zahlungen, Mitgliedschaften, Dokumente, Übungsbibliothek, Galerie haben auf keiner Plattform Offline-Verhalten; das Portal hat überhaupt keins (kein Service Worker — im Schwesterprojekt GOMESSMO war ein Stale-Service-Worker sogar Bug-Quelle, hier fehlt er ganz).
10. **Sicherheit**: lokale SQLite/Room-DBs und JSON-Caches unverschlüsselt (personenbezogene Daten von Kindern!), `passwordHash` lokal, kein SQLCipher (im Security-Audit des Projekts als offen markiert, vgl. `project_rollsportmanager_security_audit_2026_06_13`).

---

## 5. Empfehlungen für v2 (Offline-First, sauber)

### 5.1 Zielbild zuerst definieren — nicht "alles offline"

Offline-Tiering nach realen Szenarien (Halle ohne Empfang, Wettkampf-Wochenende):

- **Tier 1 – voll offline (lesen + schreiben)**: Anwesenheit/Check-in, Termin-Zu-/Absagen, Kür-Notizen/Bewertungen, Trainingsplan-Ansicht, Chat (Senden in Queue).
- **Tier 2 – offline lesbar, online schreibbar**: Mitgliederliste, Termine, Übungsbibliothek, News, Dokumente (ausgewählte Downloads).
- **Tier 3 – nur online, serverautoritativ**: Zahlungen/Abos/Mahnwesen, Rollen-/Rechteverwaltung, Verein-Onboarding. (Lehre aus KetoTracker: Geld-Logik niemals clientseitig entscheiden.)
- **Medien**: expliziter Download-Manager mit Pinning ("für Wettkampf offline halten"), LRU-Eviction, Fortschritt pro Kür — die heutige 2-GB-Heuristik durch nutzersichtbare Kontrolle ersetzen.

### 5.2 Eine Sync-Engine für alle Plattformen: **PowerSync** (Empfehlung)

Da v2 beim Supabase/Postgres-Backend bleiben soll, ist **PowerSync** der beste Fit:

- **Offizielle Supabase-Integration**, funktioniert mit self-hosted Supabase (benötigt nur logische Replikation auf Postgres); **Open Edition ist self-hostbar** per Docker — passt zur bestehenden rollsportmanager.de-Infrastruktur auf dem Mac.
- **SDKs für genau diesen Plattform-Mix**: Swift, Kotlin, Web/JS (und Flutter, falls v2 auf eine Codebasis konsolidiert) — eine Sync-Semantik statt drei Implementierungen; das Portal bekommt damit erstmals Offline-Fähigkeit.
- **Sync Rules serverseitig** (YAML): "User bekommt seine Teams, deren Küren, Termine seines Vereins" — ersetzt die heutige Rollen-If-Logik in `OfflineSyncService.kt:180 ff.` und respektiert Mandanten-/Vereinsgrenzen deklarativ. Partial Sync out of the box statt Full-Download.
- **Upload-Queue eingebaut**: lokale Writes landen in SQLite + Queue, `uploadData`-Connector schreibt via PostgREST/eigene API zurück → RLS bleibt die Autorität. Damit ist das Outbox-Problem gelöst, inklusive Retry und Reihenfolge.
- Client hält eine lokale SQLite — das vertraute Modell (GRDB/Room) bleibt konzeptionell erhalten, nur ohne Eigenbau.

**Alternativen, bewusst nachrangig:**
- **ElectricSQL (Electric-Next)**: elegantes Read-Path-Sync über HTTP (Shapes), aber Writes muss man selbst bauen (eigene API + Outbox) und die Client-Story außerhalb TypeScript ist dünn → für SwiftUI+Compose+Web schwächer als PowerSync. Interessant, falls v2 Web-first/TypeScript-first würde.
- **Eigene Lösung** (updated_at-Cursor + Soft-Deletes + Outbox-Tabelle + Push-Invalidierung): volle Kontrolle, kein neuer Infrastruktur-Baustein — aber genau die Art Eigenbau, die in v1 dreimal parallel entstanden und verrottet ist. Nur wählen, wenn der Offline-Scope bewusst klein bleibt (nur Tier-1-Entitäten); dann aber als **geteilte Spezifikation** (ein Markdown-Kontrakt: Cursor-Format, Tombstones, Konfliktregeln, Idempotenz-Keys) mit Contract-Tests pro Plattform.

### 5.3 Konfliktstrategie explizit machen

- Standard: **Last-Write-Wins auf Feldebene** mit server-`updated_at`; Client sendet Basis-Version mit (optimistic concurrency), Server lehnt bei Konflikt ab → Client merged/zeigt Hinweis.
- **Server-autoritativ** für Tier 3 und für Zähler/Limits (Premium-Küren-Limits nie lokal entscheiden).
- **Append-only-Modelle bevorzugen**, wo es fachlich passt (Anwesenheits-Events, Chat, Notizen) — Appends sind konfliktfrei mergebar, Idempotenz über Client-generierte UUIDs (v2 sollte ohnehin von Int64-Autoincrement auf UUIDs wechseln, sonst kollidieren offline erzeugte IDs).
- **Soft-Deletes + Tombstones** in allen syncbaren Tabellen (`deleted_at`), damit Löschungen zuverlässig propagieren.

### 5.4 Realtime konsequent und sparsam

- **Realtime = Live-UX, Sync-Engine = Daten**: Chat, Wettkampf-Live (Starter/Timer via Broadcast/Presence statt 5-s-Polling in `wettkampf-modus.html`), Anwesenheits-Live-Ansicht für Trainer. Datenkonsistenz kommt aus dem Sync-Stream, nicht aus Realtime-Events.
- Publikation aufräumen: nur Tabellen publizieren, die einen Konsumenten haben (heute 12+ publiziert, ~2 genutzt).
- Kanäle immer **serverseitig gefiltert** abonnieren (Lehre aus `portal-chat.js`: kein ungefilterter `messages`-Feed).
- Das Muster des Push-Workers (Realtime + Polling-Fallback, `workers/push-worker.js:282–315`) als Standard für alle Live-Konsumenten übernehmen.
- Push-Notifications als **Sync-Trigger** nutzen (silent push → Delta-Sync anstoßen), statt 1-h-Timer.

### 5.5 Medien-Pipeline neu bauen (Voraussetzung für alles andere)

- **Base64-in-Postgres abschaffen**: Medien nach Supabase Storage/S3, in der DB nur Metadaten + Storage-Pfad + Checksum + Größe. Migration per Einmal-Skript (Base64 → Storage-Objekt).
- Downloads über **URLSession-Background-Downloads** (iOS) bzw. **WorkManager** (Android) mit Resume, Checksum-Verifikation und Priorisierung; genau **eine** lokale Kopie pro Medium (Datei), nie in der DB.
- Offline-Verfügbarkeit pro Medium in einer kleinen Metadaten-Tabelle (Nachfolger von `offline_sync_status`), inkl. Pinning und LRU.

### 5.6 Hygiene & Sicherheit

- Lokale DB **verschlüsseln** (SQLCipher/SQLite Encryption; PowerSync unterstützt verschlüsselte lokale DBs), keine JSON-Caches im Documents-Ordner, kein `passwordHash` lokal — Offline-Login über Keychain/Keystore-Session + Biometrie.
- **Persistenten Sync-State** (lastSync-Cursor pro Entität) statt RAM-Variablen; Sync-Status-UX mit Outbox-Anzeige ("3 Änderungen warten auf Upload") und pro-Entität-Frische.
- Migrationsframework nutzen (GRDB `DatabaseMigrator`/Room-Migrations bzw. das der Sync-Engine) — nie wieder if-column-exists-Kaskaden; niemals Nutzdaten bei Korruption stillschweigend löschen.
- **Sync-Testsuite**: Konflikt-Szenarien, Airplane-Mode-Roundtrips, Kill-App-mid-sync, Uhr-Drift — als Teil der CI, plattformübergreifend gegen dieselbe Spezifikation.

### 5.7 Migrationspfad v1 → v2

1. Backend zuerst: UUIDs + `updated_at`-Trigger + Soft-Deletes + Storage-Migration der Medien (rückwärtskompatibel für v1-Clients).
2. PowerSync-Service neben Kong/Realtime deployen, Sync Rules für Tier-1/2-Entitäten definieren.
3. v2-Clients ausschließlich gegen die Sync-Engine bauen (keine direkten PostgREST-Reads für syncbare Entitäten); Tier-3 weiter direkt via API.
4. v1-Offline-Caches beim ersten v2-Start verwerfen (sie sind reine Caches, kein Datenverlust) — nur die Outbox-Semantik muss von Tag 1 an korrekt sein.

---

## 6. Datei-Referenzen (Schnellzugriff)

| Thema | Pfad |
|---|---|
| iOS GRDB-Schema (19 Tabellen, Altlasten) | `/Users/marcelgoldfuss/Apps/RollsportManager/rollsportmanager-ios-macos/RollsportManager/Database/Schema.swift` |
| iOS DB-Zugriff + Offline-CRUD | `.../RollsportManager/Services/DatabaseManager.swift` (Offline ab Z. 1482) |
| iOS Sync-Service (Downstream-only) | `.../RollsportManager/Services/OfflineSyncService.swift` |
| iOS Netzwerk-Monitor | `.../RollsportManager/Services/NetworkMonitor.swift` |
| iOS Cache-First-Laden | `.../RollsportManager/ViewModels/KuerViewModel.swift:134` |
| iOS Offline-Login | `.../RollsportManager/ViewModels/AuthViewModel.swift:554` |
| iOS JSON-Schatten-Cache | `.../RollsportManager/ViewModels/BaseViewModel.swift:176` |
| iOS toter Realtime-Code | `.../RollsportManager/Services/SupabaseManager.swift:1813` |
| iOS Offline-UI | `.../RollsportManager/Components/OfflineStatusView.swift` |
| Android Room-DB (5 Entities) | `/Users/marcelgoldfuss/Apps/RollsportManager/rollsportmanager-android/app/src/main/java/de/rollsportmanager/app/data/local/AppDatabase.kt` |
| Android Sync-Service | `.../data/local/OfflineSyncService.kt` |
| Android Medien-Cache | `.../data/local/OfflineMediaManager.kt` |
| Android Offline-Repository-Pattern | `.../data/repository/KuerRepository.kt:45`, `TerminRepository.kt:37` |
| Android Realtime | `.../data/realtime/RealtimeManager.kt`, `.../ui/viewmodel/ChatViewModel.kt:261` |
| Portal Realtime-Chat (ungefiltert) | `/Users/marcelgoldfuss/Apps/RollsportManager/rollsportmanager-backend/www/assets/js/portal-chat.js:376` |
| Portal Polling statt Realtime | `.../www/portal/wettkampf-modus.html:724`, `.../www/assets/js/portal.js:2898` |
| Realtime-Publikationen | `.../rollsportmanager-backend/migrations/20251230_initial_schema.sql:374` u. a. |
| Push-Worker (Realtime+Polling-Vorbild) | `.../rollsportmanager-backend/workers/push-worker.js` |
| Base64-Medien in Postgres | `.../rollsportmanager-ios-macos/RollsportManager/Services/SupabaseManager.swift:2398` |
