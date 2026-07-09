# 11 — Plattform-Extras: Watch App, Widgets, Hintergrund-Audio, Push, Deep Links

**Rolle:** Plattform-Extras-Ingenieur
**Datum:** 2026-07-09
**Untersuchte Codebases:**
- iOS/macOS/Watch: `/Users/marcelgoldfuss/Apps/RollsportManager/rollsportmanager-ios-macos`
- Android: `/Users/marcelgoldfuss/Apps/RollsportManager/rollsportmanager-android`
- Backend/Portal: `/Users/marcelgoldfuss/Apps/RollsportManager/rollsportmanager-backend`

---

## 1. Überblick

RollsportManager hat einen ungewöhnlich breiten Bestand an "Plattform-Extras": eine watchOS-Companion-App, ein aggregiertes iOS/macOS-Widget (Home + Sperrbildschirm), ein Android-Home-Widget, einen Media3-Foreground-Service für unterbrechungsfreie Kürmusik, eine komplette Push-Pipeline (APNs-Worker + Edge Function + DB-Trigger + interaktive Termin-Antworten), Siri App Shortcuts, Kalender-Sync (EventKit), lokale Trainings-Erinnerungen und Badge-Verwaltung.

Der Befund ist zweigeteilt:

1. **Zwei Extras sind echte, durchdachte Alleinstellungsmerkmale**, die in v2 zwingend erhalten und ausgebaut werden müssen:
   - Die **Android-Kürmusik-Hintergrundwiedergabe** (Media3-Foreground-Service, der Audio-Focus bewusst *nicht* abgibt — Musik läuft bei Anruf/Benachrichtigung/Sperre weiter; exakt der Turnier-/Vorführungs-Use-Case des Rollkunstlaufs).
   - Das **iOS-Aggregat-Widget** "Meine Termine" (Termine + offene Rechnungen + ungelesene Chats, Home + Lock Screen, in-App konfigurierbare Sichtbarkeit) — frisch (04.07.2026) und sauber gebaut.

2. **Mehrere Extras sind Fassaden ohne funktionierendes Fundament** ("Potemkin-Features"):
   - Die **Watch-App ist funktional tot**: Die iPhone-Gegenstelle (`WatchConnectivityManager.swift`) ist in **keinem Build-Target** enthalten und wird nirgendwo instanziiert — die Watch bekommt nie Daten, Check-ins verpuffen.
   - **Android-Push ist Ende-zu-Ende kaputt**: App schreibt Token in `users.fcm_token`, der Server liest nur `device_tokens`; der Push-Worker versendet ohnehin nur iOS; die FCM-Legacy-API in der Edge Function ist seit Mitte 2024 von Google abgeschaltet.
   - Das **Android-Widget wird nie befüllt** (`saveWidgetData()` hat keinen einzigen Aufrufer) und zeigt dauerhaft "Kein Termin".
   - **Deep Links existieren praktisch nur für Passwort-Reset (iOS)**; Android hat gar keine, Universal/App Links fehlen komplett, und die von FCM gesetzten Navigations-Extras werden in `MainActivity` nie ausgelesen.

Für v2 heißt das: Die Extras nicht 1:1 portieren, sondern **das Fundament (Push-Pipeline, Deep-Link-Routing, geteilter Widget-Daten-Contract) einmal richtig bauen** und die zwei echten USPs (Auftritts-Musik-Modus, Aggregat-Widget) darauf als Premium-Erlebnis neu aufsetzen.

---

## 2. Ist-Zustand im Detail

### 2.1 watchOS-App "RollsportManager Watch App"

**Ort:** `rollsportmanager-ios-macos/RollsportManager Watch App/` (~1.630 Zeilen Swift, watchOS 10.0, `WKCompanionAppBundleIdentifier = de.rollsportmanager.ios`)

**Was die Watch-App (laut Code) können soll:**

| Feature | Datei | Details |
|---|---|---|
| Dashboard | `ContentView.swift` (445 Z.) | Vereins-Header mit Logo/Initialen-Platzhalter, "Nächster Termin"-Karte, Schnellzugriff, Termin-Liste, Unread-Badge für Chat |
| Quick-Check-In | `Views/QuickCheckInView.swift` | Liste offener Termine (`hasCheckedIn == false`), Check-in per Tap, Ergebnis-Sheet mit Erfolg/Fehler |
| Trainings-Timer | `Views/TimerView.swift` | Presets 1/3/5/10 min, Kreis-Progress, Start/Pause/Stop/Reset, Haptik bei Ablauf (`WKInterfaceDevice.current().play(.notification)`) — 3 min ≈ Kür-Länge |
| Chat (read-only) | `Views/ChatListView.swift` + Teil von ContentView | Letzte Nachrichten mit Sender-Initialen, Team-Name, Ungelesen-Punkt; kein Antworten |
| News (read-only) | `Views/NewsListView.swift` | Kategorien mit Icons/Farben (wichtig/event/training/wettkampf), Detail-Ansicht |
| Termin-Detail | `Views/TerminDetailView.swift` | Typ, Zeit, Ort, Team |
| Lokale Notifications | `Services/WatchConnectivityService.swift` (Z. 168–199) | Vom iPhone weitergeleitete Pushes werden als lokale `UNNotificationRequest` mit Kategorie (CHAT/NEWS/TERMIN) angezeigt |

**Architektur:** Reines Phone-Relay. `Services/WatchConnectivityService.swift` (232 Z.) aktiviert `WCSession`, sendet `requestUpdate`/`checkIn`/`timerStart`/`timerStop` und dekodiert `updateTermine`/`updateUser`/`updateVerein`/`updateMessages`/`updateNews`/`checkInResult`/`pushNotification` (Message-Typen in `Models/WatchModels.swift`, Z. 209–221). Die Watch hat **keinen eigenen Netzwerkzugriff** auf das Backend.

**Kritischer Befund — die Gegenstelle fehlt im Build:**
- Das iPhone-Pendant `RollsportManager/Services/WatchConnectivityManager.swift` (319 Z., vollständig implementiert: sendTermine/sendUserInfo/sendCheckInResult/sendVerein/sendMessages/sendNews/sendPushNotificationToWatch, Observer für `.forwardPushToWatch`) ist **in `RollsportManager.xcodeproj/project.pbxproj` nicht enthalten** (0 Treffer; zum Vergleich: `PushNotificationManager.swift` 6 Treffer, das Projekt nutzt klassische Datei-Referenzen, objectVersion 63).
- `WatchConnectivityManager.shared` wird **nirgendwo im App-Code referenziert**; niemand beobachtet `.watchRequestedUpdate` oder `.watchRequestedCheckIn` (projektweiter Grep: nur Treffer in der Datei selbst).
- Konsequenz: Die iPhone-Seite aktiviert nie eine `WCSession` → die Watch erhält **niemals** Termine/Chats/News, Check-ins von der Watch verhallen, die Push-Weiterleitung (`PushNotificationManager.forwardToWatch`, Z. 394–440) postet in einen Observer, der nie registriert wird. Die Watch-App zeigt in Produktion dauerhaft ihre Empty-States.
- `FUNKTIONEN.md` Z. 149 bewirbt dennoch: "Apple Watch | Check-In, Termine, Erinnerungen".

**Weitere Watch-Altlasten:**
- Watch-Entitlements enthalten nur `aps-environment = development` (`RollsportManager Watch App.entitlements`) — kein App-Group-Zugriff, kein Production-Push-Environment.
- Keine Complications / Smart-Stack-Widgets, keine `WKExtendedRuntimeSession` (der Timer läuft nur bei aktiver View über `Timer.scheduledTimer`, `TimerView.swift` Z. 155).
- Das Watch-Target wurde **per Ruby-Skript in die pbxproj gehackt** statt deklarativ verwaltet: `add_watch_target.rb`, `fix_watch_target.rb`, `fix_watch_target2.rb`, `fix_watch_signing.rb`, `remove_watch_dependency.rb` liegen im Repo-Root. `project.yml` (xcodegen) kennt **nur** `RollsportManager-iOS` und `RollsportManager-macOS` — ein `xcodegen generate` würde Watch- und Widget-Target vernichten.

### 2.2 iOS/macOS-Widgets (Home- + Sperrbildschirm)

**Ort:** `rollsportmanager-ios-macos/RollsportManagerWidget/RollsportManagerWidget.swift` (665 Z., neu gestaltet 04.07.2026), App-Seite: `RollsportManager/Services/WidgetDataManager.swift` (156 Z.), Einstellungen: `RollsportManager/Views/Settings/WidgetSettingsView.swift`.

**Funktionsumfang (der Lichtblick unter den Extras):**
- **Ein aggregiertes Widget "Meine Termine"** mit sechs Familien: `systemSmall/Medium/Large` (iOS + macOS) und `accessoryRectangular/Circular/Inline` (Sperrbildschirm, nur iOS, per `#if os(iOS)` geguardet — Z. 479–542, 619–626).
- Inhalt: bis zu 3 kommende Termine (Datums-Badge in Typ-Farbe, relative Zeit "Heute 18:00"), offene Rechnungen (Anzahl + €-Summe), ungelesene Chat-Nachrichten, optional Vereinsname; "dann Sa 18:00"-Vorschau des Folgetermins im Medium-Widget (Z. 411–417).
- **Datenweg:** App schreibt `widget_data.json` (ISO8601) in die App Group `group.de.rollsportmanager.ios`; Aufruf in `DashboardView.loadDashboardFromServer` (Z. ~2069). Widget liest per `TimelineProvider` (`RSMProvider.loadData()`, Z. 185–194). Refresh-Policy: `min(nächster Terminstart, +30 min)` — vergangene Termine verschwinden pünktlich (Z. 176–182).
- **In-App-Konfiguration:** `WidgetVisibilityConfig` mit 4 Toggles (Termine/Rechnungen/Chats/Vereinsname), rollen-/modulabhängig gegatet; `WidgetDataManager.updateVisibility` merged nur die Flags roh in die bestehende JSON (Z. 94–115), damit ältere Payloads nicht brechen; Legacy-Feld `nextTermin` wird tolerant dekodiert (Widget-Seite Z. 96–116).
- **Datenschutz:** `clearWidgetData()` beim Logout, damit nach Nutzerwechsel keine fremden Beträge/Termine sichtbar bleiben (Z. 119–129).
- iOS-17-`containerBackground`-Pflicht mit Fallback korrekt gelöst (`RSMContainerBackground`, Z. 583–611).

**Schwächen:**
- **Kein `widgetURL`/Deep-Link** — Tap öffnet die App nur generisch, nicht den angezeigten Termin/die Rechnung/den Chat.
- `StaticConfiguration` statt `AppIntentConfiguration`: Konfiguration gilt global (App-Einstellung), nicht pro Widget-Instanz.
- **Aktualisierung nur beim Dashboard-Load**: kein `BGAppRefreshTask`, kein Silent-Push-getriggertes `WidgetCenter.reloadTimelines` — wer die App tagelang nicht öffnet, sieht veraltete Daten.
- Timeline enthält immer nur **einen** Entry statt vorausberechneter Folge-Entries.
- Die Target-Einbindung war fehleranfällig (per `xcodeproj`-Gem repariert): Widget-Extension war zunächst nicht ins App-Target embedded, kompilierte fälschlich App-Dateien mit; App Group fehlte anfangs im App-Entitlement (inzwischen in `RollsportManager/RollsportManager.entitlements` vorhanden). Auch das Widget-Target existiert nur via `add_widget_target.rb`, nicht in `project.yml`.

### 2.3 Android-Widget

**Ort:** `rollsportmanager-android/app/src/main/java/de/rollsportmanager/app/widget/NextTrainingWidget.kt` (195 Z.), Manifest-Receiver in `AndroidManifest.xml` Z. 115–124.

- Klassisches `AppWidgetProvider`/`RemoteViews`-Widget "Nächster Termin": Titel, Datum/Zeit, Ort, Typ-Icon/-Farbe, Vereinsname im Header, Klick öffnet `MainActivity`.
- Datenhaltung über `SharedPreferences` mit statischen Helpern `saveWidgetData()`/`clearWidgetData()`.
- **Kritischer Befund:** Projektweiter Grep findet **keinen einzigen Aufrufer** von `saveWidgetData()` — das Widget ist im Launcher hinzufügbar, zeigt aber für immer den Empty-State "Kein Termin". Es ist zudem funktional weit hinter iOS (nur 1 Termin, keine Rechnungen/Chats, kein Sperrbildschirm-Pendant, kein Glance/Compose).

### 2.4 Android Media3-Hintergrund-Audio (Kürmusik) — der echte USP

**Ort:** `rollsportmanager-android/app/src/main/java/de/rollsportmanager/app/audio/PlaybackService.kt` (73 Z.), Verkabelung in `ui/screen/kueren/KuerDetailScreen.kt` (Z. 648–710 Haupt-Player, Z. 1952–1985 Medien-Tab), Manifest Z. 39–41 + 78–86.

**Design (bewusst und dokumentiert auf den Wettkampf-Use-Case zugeschnitten):**
- `MediaSessionService` + ExoPlayer als **Foreground-Service** (`foregroundServiceType="mediaPlayback"`, Media-Notification) — das System killt die Wiedergabe im Hintergrund nicht.
- `setAudioAttributes(..., handleAudioFocus = false)`: Die App gibt den Audio-Focus **nicht** ab → **kein Auto-Pause bei Anruf oder Benachrichtigung** (Kommentar Z. 20–24: "Die Musik einer Vorführung muss zuverlässig durchlaufen").
- `setHandleAudioBecomingNoisy(false)`: kein Auto-Pause beim Trennen des Ausgabegeräts (Turnier-Anlage).
- `setWakeMode(C.WAKE_MODE_NETWORK)`: CPU bleibt bei gesperrtem Bildschirm wach.
- `onTaskRemoved`: Wird die App aus "Letzte Apps" gewischt, läuft laufende Musik weiter (Z. 58–63).
- UI verbindet sich via `MediaController`/`SessionToken` — Haupt-Player und Medien-Tab teilen **eine** Session; `onDispose` löst nur den Controller, released nicht den Player.
- Die Berechtigung `FOREGROUND_SERVICE_MEDIA_PLAYBACK` ist damit gegenüber Google Play legitimiert (war vorher deklariert, aber ungenutzt — Play-Console-Deklaration noch offen).

**Trainings-Features im Player (`KuerDetailScreen.kt`):** Tempo 0,5×–2,0×, A-B-Loop mit Canvas-Visualisierung im Slider (A/B-Marker), Countdown 0/3/5/8 s vor Start (Aufstellzeit!), animierte Waveform (24 Balken), klickbare Timestamps für Audio-Seeking.

**Altlast:** `audio/AudioProcessor.kt` (254 Z., eigener ExoPlayer mit Tempo/Loop/Countdown) + `ui/components/AudioControlsView.kt` + `di/AudioModule.kt` sind **Dead Code** — die reale Wiedergabe läuft über den `PlaybackService`, der Prozessor wird nirgends benutzt.

### 2.5 iOS-Hintergrund-Audio (zum Vergleich)

- `Info.plist` deklariert `UIBackgroundModes = [remote-notification, audio]` (Z. 252–256); der AppDelegate konfiguriert `AVAudioSession(.playback, options: [.duckOthers, .allowBluetooth, .allowAirPlay])` global beim Start (`App/RollsportManagerApp.swift` Z. 39–77) → Musik läuft grundsätzlich bei Sperre/Hintergrund weiter.
- **Aber:** Interruption- und Route-Change-Handler **loggen nur** ("Hier könnte die Wiedergabe fortgesetzt werden", Z. 96–99) — bei einem Anruf pausiert der `AVPlayer` und **setzt nicht automatisch fort**. Das Android-Verhalten (Focus nicht abgeben) hat auf iOS kein Pendant; kein `MPRemoteCommandCenter`/Now-Playing (keine Lock-Screen-Steuerung).
- Der reale Kür-Player ist ein schlichter `AVPlayer` in `Views/Kuer/KuerDetailView.swift` (Tempo/Loop/Countdown dort als View-State nachgebaut, Z. 41–49, 479 ff.). `Services/AudioProcessor.swift` (406 Z., AVAudioEngine + TimePitch) und `Views/Kuer/AudioControlsView.swift` sind — **spiegelbildlich zu Android — Dead Code** (einzige Referenz: die eigene Preview).

### 2.6 Push-Notifications

**iOS-Client** (`RollsportManager/Services/PushNotificationManager.swift`, 707 Z.):
- Authorization-Flow, Token-Registrierung via RPC `register_device_token` (Tabelle `device_tokens`, platform `ios`, Migration `20260109_push_notifications.sql`), Token-Deaktivierung bei Logout.
- **Interaktive Termin-Antworten**: Kategorie `TERMIN_RESPONSE_CATEGORY` mit 4 Actions (✅ Zusage / ❌ Absage / 🤔 Vielleicht / 🤒 Krank) → `saveTerminResponse` direkt aus der Notification, lokale Bestätigung + Haptik (Z. 109–149, 523–556). Starkes Feature.
- Navigation aus Push via `DeepLinkManager` (Termin/Team-Chat/DM), Badge-Verteilung via `BadgeManager` (306 Z., Badges pro Bereich Chat/News/Termine/Familie).
- **Einstellungen (14 Optionen inkl. Quiet Hours 22–7 Uhr)** werden **nur lokal in UserDefaults** gespeichert (Z. 256–320) — der Server filtert aber nach der Tabelle `notification_settings` (Worker Z. 163–182), die von der App nie geschrieben wird → Nutzereinstellungen und Ruhezeiten werden serverseitig **ignoriert**.

**Android-Client** (`notification/FCMService.kt`, 455 Z. + `NotificationHelper.kt` + `TerminResponseReceiver.kt`):
- Vollständig gebaut: 4 Notification-Channels, 7 Nachrichtentypen (chat_message, termin_reminder, termin_update, team_invite, verein_news, attendance_request, new_termin), Antwort-Actions über `TerminResponseReceiver` (BroadcastReceiver, speichert Response + Toast + Notification-Cancel). Anmerkung: Beim `new_termin`-Builder fehlt der "Krank"-Button (nur 3 `addAction`, Z. 351–353), obwohl der Receiver die Action kennt.
- **Kritischer Befund — Token-Senke passt nicht zur Quelle:** `AuthRepository.updateFCMToken` schreibt den Token in **`users.fcm_token`** (Z. 747–762). Kein Backend-Code liest `fcm_token` (projektweiter Grep: 0 Treffer in Backend-TS/JS/SQL). Die Sender lesen ausschließlich `device_tokens` — dort landet nie ein Android-Eintrag.

**Backend — zwei parallele, inkonsistente Sendepfade:**
1. **`workers/push-worker.js`** (318 Z., Node, dauerhaft laufend): arbeitet `push_queue` ab (Realtime-Subscription + 30-s-Polling), Empfänger-Auflösung (user_ids/team/verein, exclude sender), Settings-Filter, APNs via HTTP/2 mit wiederverwendeter Connection, Token-Invalidierung bei 410/400. **Sendet aber nur iOS** (`if (token.platform === 'ios')`, Z. 206), setzt **keine `category`** (Termin-Action-Buttons erscheinen bei Worker-Versand nicht) und hart `badge: 1`.
2. **`functions/send-push-notification/index.ts`** (Edge Function, Deno): eigener APNs-Sender (setzt bei `new_termin` korrekt `category: TERMIN_RESPONSE_CATEGORY`, Z. 148–152) **plus** FCM — allerdings über die **Legacy-HTTP-API `fcm.googleapis.com/fcm/send` mit `FCM_SERVER_KEY`** (Z. 230–236), die Google im Juni 2024 endgültig abgeschaltet hat. Android-Versand wäre also selbst mit korrekten Tokens tot.
- Befüllt wird die Queue über DB-Trigger (`migrations/20260109_push_triggers.sql`: neue Chat-Nachricht, neue News; `20260214_new_termin_push_trigger.sql`: neuer Termin) — ein sauberes, ereignisgetriebenes Muster.

**Web-Portal:** Kein Web-Push (kein Service-Worker-Push/VAPID); nur ein In-Page-Banner-System `PortalNotifications` in `www/assets/js/portal.js` (Z. 2742 ff.).

**Fazit Push:** iOS-Kette funktioniert (Trigger → Queue → Worker → APNs → interaktive Notification → Watch-Weiterleitung wäre da, ist aber tot, s. 2.1). Android-Kette ist an **drei** Stellen gerissen (Token-Tabelle, Worker-Filter, Legacy-API). Einstellungen/Ruhezeiten sind Client-Theater.

### 2.7 Deep Links

**iOS:**
- Custom-Scheme `rollsportmanager://` registriert (`Info.plist` Z. 19–29), Verarbeitung via `.onOpenURL` (`RollsportManagerApp.swift` Z. 194) → `Services/DeepLinkManager.swift` (147 Z.).
- `handleURL` verarbeitet **ausschließlich Passwort-Reset** (`?code=` bzw. Supabase-Recovery-Fragment `#access_token…type=recovery`). Keine inhaltlichen Routen (Termin/Kür/News/Rechnung per URL nicht adressierbar).
- Push-Navigation (Termin/Chat/DM) läuft als separater In-Prozess-Mechanismus über `@Published`-Flags + NotificationCenter (`navigateToTermin/Chat/DirectMessage`) — funktioniert, ist aber kein URL-Routing.
- **Keine Universal Links**: kein `.well-known/apple-app-site-association` im Web-Root (`www/`), keine Associated-Domains-Entitlements.

**Android:**
- **Keinerlei Deep Links**: `AndroidManifest.xml` hat keinen einzigen `VIEW`/`BROWSABLE`-Intent-Filter, kein `assetlinks.json` im Web-Root.
- `FCMService` packt `navigate_to`/`chat_id`/`termin_id` in die Notification-Intents (Z. 123–127 u. a.), aber **`MainActivity.kt` liest diese Extras nie aus** → Push-Tap öffnet nur die App, nie das Ziel. (Einzige Ausnahme: die Antwort-Actions über den BroadcastReceiver funktionieren ohne Navigation.)

**Siri / App Shortcuts (iOS, Bonus-Extra):**
- `Services/AppIntents/RollsportAppIntents.swift` (247 Z.): 4 App Shortcuts mit deutschen Phrasen — "Nächster Termin" (läuft **ohne App-Start**, liest `cachedTermine` aus UserDefaults und rendert eine SwiftUI-Snippet-View in Siri), "Meine Küren", "Wettkampf-Modus", "Mein Team" (öffnen die App via NotificationCenter-Deep-Link).

### 2.8 Verwandte Extras (Vollständigkeit)

- **Kalender-Sync:** `Services/KalenderSyncManager.swift` (472 Z., EventKit, Kalender-Auswahl, Sync-Tracking in UserDefaults) — nur iOS.
- **Lokale Trainings-Erinnerungen:** `Services/TrainingsErinnerungManager.swift` (281 Z., `UNUserNotificationCenter`-Scheduling X Minuten vor Termin).
- **Portal:** iCal-Export im Kalender (`www/portal/calendar.html`), aber kein Widget-/Push-Pendant.
- **Nicht vorhanden (Marktstandard 2026):** Live Activities/Dynamic Island (z. B. Wettkampf-Countdown, laufende Kür), Watch-Complications, Android Glance-Widgets, Web-Push, App-Shortcuts (Android `<shortcuts>`), Spotlight-Indexierung, Handoff.

---

## 3. Stärken (erhalten!)

1. **Auftritts-taugliche Kürmusik auf Android** — `PlaybackService.kt` ist klein, korrekt und exakt auf den Sport zugeschnitten (kein Auto-Pause bei Anruf/Noisy, Foreground-Service, geteilte MediaSession). Kein Wettbewerber im Vereins-Management-Umfeld denkt an "Musik darf beim Turnier unter keinen Umständen stoppen". **Das ist das wertvollste Extra der App.**
2. **Trainings-Player-Funktionen auf beiden Plattformen**: Tempo 0,5–2×, A-B-Loop (mit Visualisierung), Start-Countdown (3/5/8 s = Aufstellzeit), Waveform, klickbare Timestamps — direkt aus der Trainingspraxis von Rollkunstlauf-Küren.
3. **iOS-Aggregat-Widget** mit durchdachtem Datenmodell: App-Group-JSON-Contract, Legacy-tolerantes Decoding, Logout-Löschung, Sichtbarkeits-Merge ohne Datenneuladen, Termin-genaue Refresh-Policy, Lock-Screen-Familien.
4. **Interaktive Termin-Antworten aus der Push-Notification** (iOS-Kategorien + Android-BroadcastReceiver): Zusage/Absage ohne App-Öffnen ist für Eltern/Sportler ein echter Alltagsgewinn.
5. **Ereignisgetriebene Push-Erzeugung im Backend** (DB-Trigger → `push_queue` → Worker mit Realtime + Polling-Fallback, Token-Hygiene bei 410) — das Grundmuster ist richtig.
6. **Siri App Shortcuts** mit Offline-Snippet ("Nächster Termin" ohne App-Start) — kleiner, feiner Vorsprung.
7. Die **Watch-App-Konzeption** (Check-in, Kür-Timer mit Haptik, Glanceable-Termine) trifft die richtigen Use-Cases — nur die Umsetzung ist unvollendet.

---

## 4. Schwächen / Altlasten

1. **Watch-App ist ein toter Zwilling:** `WatchConnectivityManager.swift` in keinem Target (pbxproj: 0 Referenzen), nie instanziiert, keine Observer für `watchRequestedUpdate`/`watchRequestedCheckIn` → Watch erhält nie Daten; beworben in `FUNKTIONEN.md` Z. 149.
2. **Android-Push dreifach gerissen:** (a) Token landet in `users.fcm_token` statt `device_tokens` (`AuthRepository.kt` Z. 747), (b) `push-worker.js` sendet nur `platform === 'ios'` (Z. 206), (c) Edge Function nutzt die 2024 abgeschaltete FCM-Legacy-API (`index.ts` Z. 230).
3. **Zwei parallele Push-Sender** (Worker + Edge Function) mit divergentem Verhalten: nur die Edge Function setzt die APNs-`category` für Termin-Actions; der produktive Worker nicht → Action-Buttons fehlen im Realbetrieb; `badge: 1` hardcoded.
4. **Notification-Einstellungen/Quiet-Hours nur clientseitig** (UserDefaults); Server filtert nach `notification_settings`, die nie befüllt wird → Nutzerpräferenzen wirkungslos.
5. **Android-Widget nie befüllt** (`NextTrainingWidget.saveWidgetData()` ohne Aufrufer) und technologisch veraltet (RemoteViews statt Glance).
6. **Deep-Link-Ödnis:** iOS nur Passwort-Reset über Custom-Scheme; keine Universal/App Links (kein AASA/assetlinks im `www/`); Android null Deep Links; FCM-Navigations-Extras werden in `MainActivity` nicht konsumiert → Push-Tap ohne Zielnavigation.
7. **Dead Code in Stereo:** `AudioProcessor` + `AudioControlsView` existieren auf iOS **und** Android als jeweils ungenutzte Parallel-Implementierung des Players.
8. **iOS-Auftritts-Modus unvollständig:** Interruption-Handler nur mit `print`, kein Auto-Resume nach Anruf, kein Now-Playing/RemoteCommand — das Android-USP-Verhalten fehlt auf iOS.
9. **Projekt-Infrastruktur fragil:** Watch/Widget-Targets per Ruby-Skripte in die pbxproj gepatcht; `project.yml` kennt sie nicht; App-Group-/Embedding-Fehler mussten manuell per `xcodeproj`-Gem nachgezogen werden — jede Regenerierung ist ein Minenfeld.
10. **Widget-Aktualität hängt am App-Start** (nur Dashboard-Load schreibt `widget_data.json`); kein Background-Refresh, kein Push-Trigger.
11. Kleinigkeiten: Watch-Entitlement `aps-environment=development`; `has_checked_in` wird beim Senden an die Watch hart auf `false` gesetzt (TODO in `WatchConnectivityManager.swift` Z. 59); Android `new_termin`-Notification ohne "Krank"-Button; kein Web-Push im Portal.

---

## 5. Empfehlungen für v2

### 5.1 Fundament zuerst (Voraussetzung für alle Extras)

1. **Eine Push-Pipeline, ein Sender:** Ein einziger Versand-Service (Queue-Worker im neuen Backend) mit **APNs HTTP/2 + FCM v1 (OAuth2-Service-Account)** und **Web-Push (VAPID)** fürs Portal. Einheitliche `device_tokens`-Tabelle für *alle* Plattformen (iOS/Android/Web) mit demselben Registrierungs-RPC; Token-Hygiene (410/UNREGISTERED) zentral. Kategorien/Actions (inkl. "Krank"), `collapse_id`/`thread-id` pro Chat/Termin, echte Badge-Zählung statt `badge: 1`.
2. **Notification-Präferenzen serverseitig als Single Source of Truth:** `notification_settings` (inkl. Quiet Hours mit Zeitzone) wird vom Client geschrieben und vom Sender ausgewertet; Client cached nur.
3. **Deep-Link-Routing als Contract:** Universal Links/App Links über `https://rollsportmanager.de/…` (AASA + assetlinks.json ausliefern), eine plattformübergreifende Routen-Tabelle (`/termin/:id`, `/kuer/:id`, `/chat/team/:id`, `/rechnung/:id`, `/news/:id`). Push-Payloads, Widget-Taps (`widgetURL`), Siri-Intents, QR-Codes und Portal-Links nutzen **dieselben** URLs. Passwort-Reset ebenfalls über UL statt Custom-Scheme (Scheme nur als Fallback).
4. **Deklarative Projektdefinition:** Alle Apple-Targets (App, Widget, Watch, ggf. Live-Activity-Extension) in xcodegen/Tuist inklusive Entitlements/App-Groups — nie wieder Ruby-Patches auf pbxproj. CI-Check: jede Swift-Datei gehört zu einem Target.

### 5.2 "Auftritts-Modus" als produktisierten USP ausbauen

5. **Kür-Playback als geteiltes Feature-Modul** mit identischem Verhalten: Android-`PlaybackService` (Media3) als Vorbild übernehmen; auf iOS nachziehen: `AVAudioSession`-Interruption-Policy mit Auto-Resume, Now-Playing-Info + `MPRemoteCommandCenter` (Lock-Screen-/AirPods-Steuerung), optional expliziter **"Auftritts-Modus"-Schalter** (UI-Lock, Nicht-stören-Hinweis, Bildschirm-wach, großer Not-Stopp). Tempo/Loop/Countdown/Waveform in eine gemeinsame Player-Komponente; die doppelten `AudioProcessor`/`AudioControlsView`-Leichen **nicht** mitnehmen.
6. **Apple Watch als Kür-Fernbedienung:** Start/Stopp/Countdown der Kürmusik vom Handgelenk (Trainer steht an der Bande, das Phone hängt an der Anlage) — via MediaSession/WatchConnectivity. Das wäre ein sichtbares Alleinstellungsmerkmal, das aus zwei vorhandenen Bausteinen (Watch + PlaybackService) entsteht.

### 5.3 Widgets & Glanceables

7. **Widget-Payload als plattformneutraler Contract** (ein JSON-Schema, versioniert): iOS App Group, Android DataStore, Watch-Complications — alle lesen dieselbe Struktur (Termine, Rechnungen, Unread, Sichtbarkeits-Flags). iOS-Design des Aggregat-Widgets übernehmen.
8. **iOS-Widget modernisieren:** `AppIntentConfiguration` (Per-Instanz-Konfiguration statt globaler Toggles), `widgetURL`-Deep-Links auf die Routen aus 5.1(3), mehrere Timeline-Entries (Terminwechsel ohne Reload), Aktualisierung per Silent-Push/`BGAppRefreshTask` statt nur beim Dashboard-Load.
9. **Android-Widget neu mit Glance (Compose)**, funktionsgleich zum iOS-Widget, und diesmal **verkabelt** (Repository schreibt bei jedem Sync + WorkManager-Refresh).
10. **Live Activities / Dynamic Island** für Wettkampf-Tag (Countdown bis Startzeit, "Jetzt läuft: Kür X") und laufende Trainings-Timer — der moderne Ersatz für vieles, was die alte Watch-App wollte.

### 5.4 Watch-Strategie ehrlich entscheiden

11. **Entweder richtig oder gar nicht.** Richtig heißt: eigenständige watchOS-App mit direktem API-Zugriff (URLSession + Token-Sync via WatchConnectivity nur als Bootstrap), Complications/Smart Stack ("Nächster Termin"), Check-in, Kür-Timer mit `WKExtendedRuntimeSession` + Haptik, Musik-Remote (s. 6). Nie wieder eine Companion-App ausliefern, deren Phone-Gegenstelle nicht im Build ist — v1 hat gezeigt, wie leicht das unbemerkt bleibt (Test: E2E-Smoke "Watch erhält Termine" in CI/TestFlight-Checkliste).

### 5.5 Push- und Intent-Erlebnis

12. **Push-Tap-Navigation auf Android** über die neuen App Links implementieren (Intent-Extras abschaffen); Antwort-Actions beibehalten und um "Krank" ergänzen; Channels beibehalten.
13. **App Intents ausbauen:** Check-in, "Kür-Musik starten", "Wettkampf-Modus" als Intents → Shortcuts, Action Button, ggf. Apple-Intelligence-Auffindbarkeit; Android-Pendant über statische `<shortcuts>` + Assistant-Deep-Links.
14. **Web-Push im Portal** (VAPID über die einheitliche Pipeline) — Eltern ohne App bleiben erreichbar.

---

## 6. Prioritäten-Matrix für v2

| Extra | v1-Zustand | v2-Priorität | Begründung |
|---|---|---|---|
| Push-Pipeline (alle Plattformen) | iOS ok, Android tot, doppelte Sender | **P0** | Fundament für alles; Android-Nutzer sind aktuell unerreichbar |
| Deep-Link-Routing (UL/App Links) | fast inexistent | **P0** | Voraussetzung für Push-Tap, Widgets, Siri, QR, Portal-Verzahnung |
| Kürmusik-/Auftritts-Modus | Android stark, iOS halbfertig | **P1 (USP)** | Alleinstellungsmerkmal, geringe Kosten für iOS-Angleich |
| Aggregat-Widget iOS | gut | **P1** | Erhalt + `widgetURL` + Push-Refresh |
| Android-Widget (Glance) | tot | **P1** | Parität mit geringem Aufwand über gemeinsamen Contract |
| Live Activities | fehlt | **P2** | Sichtbarer Modernitäts-Sprung (Wettkampf-Countdown) |
| Watch-App | tot | **P2** | Neu als Musik-Remote + Complications, sonst streichen |
| Siri/App Intents | solide Basis | **P2** | Ausbau auf Aktionen (Check-in, Musik) |
| Web-Push Portal | fehlt | **P3** | Nach Pipeline-Vereinheitlichung günstig |

---

## 7. Referenzierte Schlüsseldateien

- Watch: `rollsportmanager-ios-macos/RollsportManager Watch App/{ContentView,Views/QuickCheckInView,Views/TimerView,Services/WatchConnectivityService,Models/WatchModels}.swift`
- Phone-Gegenstelle (orphaned): `rollsportmanager-ios-macos/RollsportManager/Services/WatchConnectivityManager.swift`
- iOS-Widget: `rollsportmanager-ios-macos/RollsportManagerWidget/RollsportManagerWidget.swift`, `RollsportManager/Services/WidgetDataManager.swift`, `RollsportManager/Views/Settings/WidgetSettingsView.swift`
- Android-Widget: `rollsportmanager-android/app/src/main/java/de/rollsportmanager/app/widget/NextTrainingWidget.kt`
- Audio: `rollsportmanager-android/.../audio/PlaybackService.kt`, `.../ui/screen/kueren/KuerDetailScreen.kt`; iOS: `RollsportManager/App/RollsportManagerApp.swift` (AudioSession), `RollsportManager/Views/Kuer/KuerDetailView.swift`; Dead Code: `audio/AudioProcessor.kt`, `Services/AudioProcessor.swift`, beide `AudioControlsView`
- Push: `RollsportManager/Services/{PushNotificationManager,DeepLinkManager,BadgeManager,TrainingsErinnerungManager}.swift`; `rollsportmanager-android/.../notification/{FCMService,TerminResponseReceiver}.kt`, `.../data/repository/AuthRepository.kt` (Z. 747 ff.); Backend: `rollsportmanager-backend/workers/push-worker.js`, `functions/send-push-notification/index.ts`, `migrations/{20260109_push_notifications,20260109_push_triggers,20260214_new_termin_push_trigger}.sql`
- Siri: `RollsportManager/Services/AppIntents/RollsportAppIntents.swift`
- Projekt-Fragilität: `rollsportmanager-ios-macos/{project.yml,add_watch_target.rb,add_widget_target.rb,fix_watch_target.rb,fix_watch_target2.rb,fix_watch_signing.rb,remove_watch_dependency.rb}`
