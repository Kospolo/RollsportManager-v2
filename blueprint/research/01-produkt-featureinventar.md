# RollsportManager – Produkt- und Feature-Inventar (Research 01)

**Rolle:** Produktmanager | **Stand der Analyse:** 09.07.2026
**Analysierte Codebases:**
- iOS/macOS/watchOS: `/Users/marcelgoldfuss/Apps/RollsportManager/rollsportmanager-ios-macos`
- Android: `/Users/marcelgoldfuss/Apps/RollsportManager/rollsportmanager-android`
- Backend + Web-Portal + Website: `/Users/marcelgoldfuss/Apps/RollsportManager/rollsportmanager-backend`
- Wissensgraph: `/Users/marcelgoldfuss/Apps/RollsportManager/graphify-out/GRAPH_REPORT.md` (12.668 Knoten, 26.850 Kanten)

---

## 1. Überblick

RollsportManager ist eine **Vereins-Management-Plattform für Rollkunstlauf** mit außergewöhnlich großer funktionaler Breite („200+ Funktionen" laut `FUNKTIONEN.md`, Version 1.4 Build 111). Die App deckt den kompletten Vereinsalltag ab: Mitglieder- und Teamverwaltung, Termine/Anwesenheit, das Kernfeature **Küren** (Choreografien mit Musik/Video/Bewertung), Wettkampf-Live-Scoring, ein komplettes Finanzmodul inkl. Mahnwesen und SEPA, Kommunikation (Chat/DM/News), Gamification, Equipment/Hallen/Schließfächer, Pflichtstunden und ein mehrstufiges Admin-System.

**Plattform-Landschaft (5 unabhängige Frontends, 1 Backend):**

| Plattform | Technologie | Umfang |
|---|---|---|
| iOS/iPadOS/macOS | SwiftUI, GRDB (offline), StoreKit | 277 Swift-Dateien, ~135 Views in 38 Ordnern |
| watchOS | SwiftUI | 5 Views (`RollsportManager Watch App/Views/`) |
| iOS-Widgets | WidgetKit | `RollsportManagerWidget/` (Home + Lock Screen) |
| Android | Kotlin, Jetpack Compose, Hilt, MVVM | 306 Kotlin-Dateien, ~130 Screens |
| Web-Portal | Statisches HTML + Vanilla JS | **87 HTML-Seiten** in `www/portal/` |
| Öffentl. Website | Statisches HTML | 14 Seiten in `www/` |
| Admin-Panel (Web) | Statisches HTML | 21 Seiten in `www/admin/` |
| Backend | Self-hosted Supabase (Docker, Kong, Postgres, Realtime, Storage), 6 Edge Functions, Push-Worker | 34 Migrationen + 5 Ad-hoc-SQL-Skripte |

Produktion läuft unter `https://rollsportmanager.de` — als **Docker-Stack auf einem lokalen Mac** (`rollsportmanager-backend/CLAUDE.md`, Abschnitt „Infrastruktur").

**Zentrale produktstrategische Erkenntnis:** Jedes Feature ist bis zu **4× unabhängig implementiert** (iOS, Android, Web-Portal, teils Watch). Die Synchronisation der Plattformen ist ein manueller, dokumentationsgetriebener Prozess (`HARMONISIERUNGSPLAN.md`, Checklisten in allen drei `CLAUDE.md`), der nachweislich immer wieder zu Drift-Bugs geführt hat (z. B. Android-Feld `content` vs. DB-Feld `nachricht`, `rollsportmanager-android/CLAUDE.md` Punkt 27).

---

## 2. Ist-Zustand im Detail

### 2.1 Rollenmodell

Definiert in `rollsportmanager-ios-macos/RollsportManager/Models/User.swift` (Zeilen 13–73), Hierarchie-Level 0–5:

| Rolle | Level | Rechte (belegt im Code) |
|---|---|---|
| **mitglied** | 0 | Eigenes Profil, eigene Küren/Termine/Rechnungen, Team-Chat, Zu-/Absagen, eigener QR-Code |
| **trainer** | 1 | + Anwesenheit erfassen (`AttendanceView`), Küren für Mitglieder anlegen (limitiert ohne Premium: 1 Kür/Mitglied, 2 Bilder/Kür, Werbung — `ios-macos/CLAUDE.md` „Trainer-Limits", Migration `20260215_trainer_limits.sql`), Trainingspläne, Wettkampf-Modus |
| **kassenwart** | 2 | + Finanzen: Rechnungen, Zahlungen, Mahnwesen (`UserRole.canManageFinances`, Migration `20260122_add_kassenwart_role.sql`) |
| **moderator** | 3 | + Vereinsverwaltung (Co-Manager), Zahlungskonfiguration (`ZAHLUNGSSYSTEM_STATUS.md`, RLS-Policy `payment_config_all`), Admin-Panel eingeschränkt (kein Premium/Lizenzen/Zahlungen — `backend/CLAUDE.md` „Moderator-Einschränkung", Migration `20260215_hide_admin_from_moderators.sql`) |
| **admin** | 4 | Vereins-Vollzugriff: Mitglieder, Teams, Bankdaten, E-Mail-Einstellungen, Demo-Daten, Backup, Verbandsmeldung |
| **super_admin** | 5 | Plattform-Betreiber: ALLE Vereine, Beta-Tester, Premium-/Lizenzpakete, Monetarisierung, Server (`Views/Admin/SuperAdminHubView.swift`, Migration `20260225_super_admin_role.sql`) |

**Gast-Trainer** (keine Rolle, sondern Token-basierter Zeitzugang): Tabelle `guest_trainer_access` mit **granularen Einzelrechten** `can_view_members`, `can_view_kueren`, `can_edit_kueren`, `can_mark_attendance`, `can_view_termine`, `can_create_termine`, `expires_at`, Status pending/active/expired/revoked (Migration `20260201_guest_trainer_access.sql`). UI: `Views/Team/GuestTrainerView.swift`, `android .../teams/GuestTrainerScreen.kt`, `www/portal/guest-trainers.html` + `accept-guest-invite.html`.

**Konten-Typen:** `adult` / `teen` / `child` mit `parent_id` + `parent2_id` (zwei Elternteile), Account-Upgrade ab 16 (`docs/modules/01-AUTH.md`, `Views/Family/UpgradeChildAccountView.swift`, `InviteSecondParentView.swift`).

### 2.2 Feature-Inventar nach Domänen (mit Datei-Referenzen)

#### A) Verein & Organisation
- Verein erstellen/beitreten per 6-stelligem Join-Code, Setup-Assistent, Branding (Logo/Banner/Farben) — `Views/Verein/` (7 Views), `www/portal/verein-create.html`, `verein-join.html`, `verein-settings.html`; Schema in `docs/modules/02-VEREIN.md`
- Abteilungen — `Views/Abteilung/` (3 Views), `portal/abteilungen.html`
- Einladungssystem — `Views/Verein/InvitationView.swift`, `portal/invitation.html`, `accept-invitation.html`
- Demo-Daten, Cloud-Backup (inkl. eigener OAuth-Cloud-Provider!) — `Services/Backup/{BackupManager,CloudProviders,OAuthManager}.swift`, `portal/backup.html`, `backup-settings.html`, Migration `20260215_backup_archivierung.sql`

#### B) Mitglieder, Teams, Familie
- Teams mit Kategorie/Farbe, Mitglieder- und Trainer-Zuordnung (`teams`, `team_members`, `team_trainers` — `docs/modules/03-TEAMS.md`)
- Mitgliederverwaltung mit Suche/Filter — `Views/Mitglieder/MitgliederListView.swift`, `Views/Admin/MemberManagementView.swift`, `portal/mitglieder.html`
- Familien-Management: Kinder anlegen/verknüpfen, Familien-Termine, zweites Elternteil, Upgrade ab 16 — `Views/Family/` (8 Views), `android .../family/` (7 Screens), `portal/family.html`, `docs/modules/07-FAMILIE.md`
- Warteliste — `Views/Waitlist/WaitlistView.swift`, `portal/warteliste.html`

#### C) Küren & Training (Alleinstellungsmerkmal!)
- Küren-CRUD mit Status-Workflow `in_arbeit → bereit → wettkampf → archiviert`, Medien (bild/video/audio/dokument — deutsche Enums!), Bewertungen (Technik/Ausdruck/Synchron), Notizen, Video-Zeitstempel — `Views/Kuer/` (6 Views), `android .../kueren/` (6 Screens), `portal/kueren.html` + `kuer-detail.html` (1.347 Zeilen) + `portal-kueren.js` (1.297 Zeilen)
- **Trainings-Audio-Player**: Tempo 0.5x–2.0x, A-B-Loop mit Slider-Visualisierung, Countdown 0/3/5/8 s, animierte Waveform, klickbare Timestamps — `Views/Kuer/AudioControlsView.swift`, `android .../kueren/KuerDetailScreen.kt` (Punkte 8, 14, 15 in `android/CLAUDE.md`); Android-Hintergrund-Audio via Media3 Foreground-Service
- Kür-Sharing (öffentlicher Link) — `Views/Kuer/KuerShareView.swift`, `portal/kuer-share.html`
- Übungsbibliothek (Kategorien aufwaermen/dehnung/kraft/sprung/pirouette/schritt/kombination, Schwierigkeit 1–5, Video-Anleitung) — Tabelle `ubungen` (`backend/CLAUDE.md` 10.02.2026), `Views/Training/UebungenView.swift`, `portal/ubungen.html`
- Trainingsplanung mit Plänen/Vorlagen — `Views/Training/` (4 Views), Migration `20260201_trainingsplanung.sql`, `portal/trainingsplanung.html`, `trainingsplan.html`, `training-hub.html`

#### D) Termine, Kalender, Anwesenheit, Check-in
- Termine (training/wettkampf/event), wiederkehrend, Zu-/Absagen mit 4 Status (zusage/absage/vielleicht/**krank**), Abwesenheitsgründe — `docs/modules/04-TERMINE.md`, `Views/Termin/` (4 Views), `portal/termine.html` (873 Zeilen)
- Kalender Woche/Monat + iCal-Export — `Views/Calendar/CalendarView.swift`, `Services/KalenderSyncManager.swift`, `portal/calendar.html`
- Überregionale Events (vereinsübergreifend, mit Einladungen) — Migration `20260201_ueberregionale_events.sql`, `Views/Events/UeberregionaleEventsView.swift`, `portal/ueberregionale-events.html`
- Anwesenheit (anwesend/abwesend/entschuldigt, „Alle anwesend"-Button) — `Views/Termin/AttendanceView.swift`, `portal/attendance.html` + `trainer-attendance.html` (702 Zeilen)
- QR-Check-in: Scanner, persönlicher QR-Code, Historie, Quoten — `Views/Checkin/` (6 Views), `portal/checkin.html`, `my-qrcode.html`, `checkin-history.html`; Watch: `QuickCheckInView.swift`

#### E) Wettkampf
- Wettkampf-Modus mit Live-Scoring, Echtzeit-Ergebnistabellen, Checklisten, Teilnehmerverwaltung, Aufwärm-/Lauf-Timer — Migration `20260201_wettkampf_modus.sql`, `Views/Wettkampf/` (3 Views), `android .../wettkampf/WettkampfLiveScreen.kt` (Timer, Punkt 12 in `android/CLAUDE.md`), `portal/wettkampf.html`, `wettkampf-live.html`, `wettkampf-modus.html`
- Verbandsmeldung — `Views/Admin/VerbandsmeldungView.swift`, `portal/verbandsmeldung.html`

#### F) Kommunikation
- Team-Chat + Direktnachrichten in Echtzeit (Supabase Realtime), Bilder, Voice-to-Text auf **allen drei Plattformen** — `Views/Chat/` (4 Views inkl. `ReportMessageSheet.swift` für Meldungen, Migration `20260110_message_reports.sql`), `portal/chat.html` + `direktnachrichten.html` + `portal-chat.js` (989 Zeilen), `docs/modules/05-CHAT.md`
- Vereins-News mit Prioritäten/Kategorien — `Views/News/NewsListView.swift`, `portal/news.html`; Watch: `NewsListView.swift`
- Persönliche Notizen (mit Bildern) — `Views/Notizen/` (3 Views), `portal/notes.html`
- Push: APNS (iOS), FCM (Android), Web — Migrationen `20260109_push_notifications.sql`, `20260109_push_triggers.sql`, `20260214_new_termin_push_trigger.sql`; Worker `workers/push-worker.js`; Edge Function `functions/send-push-notification`

#### G) Finanzen (überraschend tief für eine Vereins-App)
- Beitragskategorien, Mitgliedschaften, automatische Rechnungen mit PDF (`Services/Finance/InvoicePDFGenerator.swift`), Zahlungen — `docs/modules/10-PAYMENTS.md`, `ZAHLUNGSSYSTEM_STATUS.md`
- Zahlungsmethoden pro Verein konfigurierbar: Überweisung ✅, PayPal/Stripe (UI fertig, Flow unvollständig; Webhooks vorhanden: `functions/paypal-webhook`, `functions/stripe-webhook`), SEPA-Lastschrift ❌ (`ZAHLUNGSSYSTEM_STATUS.md`, Status-Tabelle)
- Mahnwesen mit Mahnstufen + PDF — `Views/Finance/DunningView.swift`, `Services/Finance/{DunningService,DunningPDFGenerator}.swift`, `portal/mahnungen.html`
- Vereins-Buchhaltung: Kassenbuch, Ausgaben, Budgetplanung, Bankabgleich, Jahresabschluss, Ratenzahlung, Familienrabatte, SEPA-Export, Spendenbescheinigungen, Finanzamt-/ELSTER-Export — `Views/Finance/` (13 Views), Migration `20260215_finance_tables.sql`, Portal-Pendants `kassenbuch.html`, `ausgaben.html`, `budget.html`, `bankabgleich.html`, `jahresabschluss.html`, `ratenzahlung.html`, `familien-rabatte.html`, `sepa.html`, `spenden.html`, `finance-export.html`
- Pflichtstunden (Kontingent, Befreiungen, Familienberichte, Überschuss) — `Views/Pflichtstunden/PflichtstundenView.swift`, `portal/pflichtstunden.html` + `portal-pflichtstunden.js`

#### H) Ressourcen
- Equipment-Katalog + Reservierungen — `Views/Equipment/` (5 Views), `docs/modules/09-EQUIPMENT.md`
- Hallen/Facilities + Buchungskalender + Belegungsplan — `Views/Facility/` (7 Views), `docs/modules/08-FACILITIES.md`, `portal/facilities.html`, `bookings.html`
- Schließfach-Vermietung (Status, Preise, Mieter-Zuordnung) — `Views/Schliessfach/` (4 Views), Migration `20260119_schliessfach_vermietung.sql`, `portal/schliessfaecher.html`

#### I) Auswertung & Gamification
- Statistiken mit 4 Tabs + CSV-Export — `Views/Stats/` (3 Views), `android .../stats/StatsScreen.kt`, `portal/stats.html`
- Berichte (Mitgliedsbeiträge, Pflichtstunden, Schließfächer) — `Views/Settings/*BerichtView.swift`, `android .../reports/` (5 Screens), `portal/berichte.html`
- Achievements/Medaillen (Bronze/Silber/Gold, Ranglisten) — Migration `20260201_achievements.sql`, `Views/Profile/AchievementsView.swift`, `portal/achievements.html`
- Jubiläen & Geburtstage — `Views/Jubilaeum/` (2 Views), `portal/jubilaeen.html`
- Dokumente + Fotogalerie — Migration `20260215_gallery_documents.sql`, `Views/Dokumente/`, `Views/Galerie/`, `portal/documents.html`, `gallery.html`
- Favoriten, globale Suche, konfigurierbares Dashboard — `Views/Favoriten/`, `Views/Search/GlobalSearchView.swift`, `Views/Dashboard/DashboardSettingsView.swift`, `portal/favoriten.html`, `search.html`, `dashboard-settings.html`

#### J) Monetarisierung & Plattform-Administration
- **Nutzer-Abos** (IAP): Basis 0 € (Werbung, 50 Mitglieder) / Werbefrei 2 €/Monat / Unbegrenzt 5 €/Monat; **Vereinslizenzen**: 9/29/59 €/Monat (`backend/CLAUDE.md` „Preisstruktur", `Services/StoreKitManager.swift`, `Configuration.storekit`)
- Werbung (Footer + Interstitials, Trainer-Sonderregeln) — `Services/AdsManager.swift`, `www/assets/js/ads.js`, `ad-banner.js`, Migration `20260109_monetization.sql`
- Limits + Upgrade-Flows — `Views/Premium/{LimitReachedView,PremiumUpgradeView,LicenseSelectionView}.swift`
- Super-Admin-Bereich in App UND Web: Benutzer, Vereine, Beta-Tester, Premium-/Lizenzpakete, Zahlungen, Chat-Moderation, Statistiken, E-Mail (SMTP), System/Server — `Views/Admin/` (17 Views), `android .../admin/` (15 Screens), `www/admin/` (21 Seiten), `portal/admin.html`
- Beta-Programm — `functions/send-beta-welcome`, Migration `20260216_verein_beta_tester.sql`, `www/beta.html`

#### K) Plattform-Spezialitäten
- **iOS:** Offline-Modus mit lokaler GRDB-SQLite (`Services/DatabaseManager.swift`, `OfflineSyncService.swift`, `NetworkMonitor.swift`), Siri/App Intents (`Services/AppIntents/`), Widgets (Home + Lock Screen, `RollsportManagerWidget/`), Watch-Connectivity, Face ID, Trainings-Erinnerungen (`TrainingsErinnerungManager.swift`)
- **watchOS:** Check-in, Termin-Detail, Chat-Liste, News, Timer (`RollsportManager Watch App/Views/`)
- **Android:** Realtime-Manager mit Auto-Reconnect, FCM-Kanäle, Media3-Hintergrund-Audio; **kein Offline-Modus** (Room-DB in `ENTWICKLUNGSPLAN.md` Phase 6 als „⏳ Optional" nie umgesetzt)
- **Web:** PWA-Ansätze (`www/sw.js`, `manifest.json`, `portal/offline.html`), 5-sprachige i18n (`assets/js/translations.js`)
- **Sprachen:** DE, EN, FR, RU, TR auf allen drei Plattformen (iOS `*.lproj`, Android `values-{en,fr,ru,tr}`, Web `translations.js`)

### 2.3 Backend

- Self-hosted Supabase: Postgres + Kong (Port 8000/8443) + GoTrue + Realtime + Storage, Website-Nginx (Port 8080) — `docker-compose.yml`, `www/docker-compose.yml`
- 34 Migrationen (`migrations/`, 30.12.2025–25.02.2026) + 5 Ad-hoc-Skripte (`sql/`) + **7 weitere FIX-SQL-Dateien im iOS-Repo-Root** (`FIX-ALL.sql`, `COMPLETE-FIX.sql`, `FIX-ENUM.sql` …)
- Autorisierung fast vollständig über **RLS-Policies** direkt auf den Tabellen (Beispiele in `backend/CLAUDE.md` „RLS-POLICIES")
- Edge Functions: `paypal-webhook`, `stripe-webhook`, `send-beta-welcome`, `send-parent-invitation`, `send-push-notification`, `send-test-email`
- Schema-Konventionen: **deutsche Spaltennamen und Enums** (`nachricht`, `ort`, `start_datetime`; MediaTyp `bild/video/audio/dokument`; KuerStatus `in_arbeit/bereit/wettkampf/archiviert` — `backend/CLAUDE.md` „DATENBANK-SCHEMA")

---

## 3. Feature-Matrix: Feature × Plattform

Legende: ✅ vollständig · ⚠️ teilweise/eingeschränkt · ❌ fehlt · — nicht sinnvoll

| Feature | iOS/iPadOS | macOS | Android | Web-Portal | Watch |
|---|---|---|---|---|---|
| Auth (Login/Registrierung/Reset) | ✅ | ✅ | ✅ | ✅ | — |
| Verein erstellen/beitreten/Settings | ✅ | ✅ | ✅ | ✅ | — |
| Abteilungen | ✅ | ✅ | ✅ | ✅ | — |
| Teams + Trainer-Zuweisung | ✅ | ✅ | ✅ | ✅ | — |
| Mitgliederverwaltung | ✅ | ✅ | ✅ | ✅ | — |
| Gast-Trainer (Token-Zugang) | ✅ | ✅ | ✅ | ✅ | — |
| Familie (Kinder, 2. Elternteil, Upgrade 16+) | ✅ | ✅ | ✅ | ✅ | — |
| Termine + Zu-/Absagen (4 Status) | ✅ | ✅ | ✅ | ✅ | ⚠️ (Detail-Ansicht) |
| Kalender + iCal-Export | ✅ | ✅ | ✅ | ✅ | — |
| Überregionale Events | ✅ | ✅ | ✅ | ✅ | — |
| Anwesenheit (Trainer) | ✅ | ✅ | ✅ | ✅ | — |
| QR-Check-in + Historie | ✅ | ⚠️ (kein Scanner) | ✅ | ✅ | ✅ (Quick-Check-in) |
| Küren CRUD + Medien + Bewertung | ✅ | ✅ | ✅ | ✅ | — |
| Audio-Player (Tempo, A-B-Loop, Countdown, Waveform) | ✅ | ✅ | ✅ | ⚠️ (einfacher Player) | — |
| Kür-Sharing (Link) | ✅ | ✅ | ✅ | ✅ | — |
| Übungsbibliothek | ✅ | ✅ | ✅ | ✅ | — |
| Trainingsplanung/-pläne | ✅ | ✅ | ✅ | ✅ | — |
| Team-Chat + DM + Bilder + Voice-to-Text | ✅ | ✅ | ✅ | ✅ | ⚠️ (nur Liste/Lesen) |
| News | ✅ | ✅ | ✅ | ✅ | ✅ |
| Notizen | ✅ | ✅ | ✅ | ✅ | — |
| Rechnungen/Zahlungen (Mitglied) | ✅ | ✅ | ✅ | ✅ | — |
| Zahlungs-Flows PayPal/Stripe | ⚠️ UI fertig, Flow offen | ⚠️ | ⚠️ | ⚠️ | — |
| SEPA-Lastschrift (Mandate) | ❌ | ❌ | ❌ | ❌ | — |
| Mahnwesen | ✅ | ✅ | ✅ | ✅ | — |
| Finanz-Suite (Kassenbuch, Budget, Jahresabschluss …) | ✅ | ✅ | ✅ | ✅ | — |
| Pflichtstunden | ✅ | ✅ | ✅ | ✅ | — |
| Equipment + Reservierung | ✅ | ✅ | ✅ | ✅ | — |
| Hallen + Buchungskalender | ✅ | ✅ | ✅ | ✅ | — |
| Schließfächer | ✅ | ✅ | ✅ | ✅ | — |
| Warteliste | ✅ | ✅ | ✅ | ✅ | — |
| Wettkampf-Modus + Live-Scoring | ✅ | ✅ | ✅ | ✅ | ⚠️ (Timer) |
| Verbandsmeldung | ✅ | ✅ | ✅ | ✅ | — |
| Statistiken + CSV/Berichte | ✅ | ✅ | ✅ | ✅ | — |
| Achievements/Gamification | ✅ | ✅ | ✅ | ✅ | — |
| Jubiläen/Geburtstage | ✅ | ✅ | ✅ | ✅ | — |
| Dokumente + Galerie | ✅ | ✅ | ✅ | ✅ | — |
| Favoriten / globale Suche / Dashboard-Konfig | ✅ | ✅ | ✅ | ✅ | — |
| Premium/Lizenzen/Werbung | ✅ (StoreKit) | ✅ | ✅ | ⚠️ (Anzeige `premium.html`) | — |
| Admin-/Super-Admin-Bereich | ✅ | ✅ | ✅ | ✅ (Portal + `www/admin/`) | — |
| **Offline-Modus + Sync** | ✅ (GRDB) | ✅ | ❌ (Room nie umgesetzt) | ⚠️ (nur SW-Platzhalter) | — |
| Push-Benachrichtigungen | ✅ APNS | ⚠️ | ✅ FCM | ⚠️ | ⚠️ (Spiegelung) |
| Widgets | ✅ Home+Lock | — | ❌ | — | — |
| Siri/App Intents | ✅ | ⚠️ | ❌ (kein Assistant-Pendant) | — | — |
| Cloud-Backup (OAuth-Provider) | ✅ | ✅ | ✅ | ✅ | — |
| 5 Sprachen (DE/EN/FR/RU/TR) | ✅ | ✅ | ✅ | ✅ | ⚠️ |

**Wichtigste Paritätslücken:**
1. **Android ohne Offline-Modus** — größte funktionale Lücke (iOS hat vollständige GRDB-Offline-Schicht inkl. Sync-Queue).
2. **Android ohne Widgets**, kein Wear-OS-Pendant zur Watch-App.
3. **Zahlungs-Flows unvollständig auf allen Plattformen** (PayPal/Stripe-Checkout nicht fertig, SEPA-Mandate fehlen komplett — `ZAHLUNGSSYSTEM_STATUS.md`).
4. Web-Portal-Audio-Player einfacher als die nativen Player (kein Tempo/A-B-Loop-Feature-Set).
5. Watch-App sehr schmal (5 Views) im Verhältnis zur Produktbreite.

---

## 4. Stärken

1. **Enorme funktionale Tiefe mit echtem Domänen-Fit**: Küren mit Musik-Trainings-Tools (Tempo, A-B-Loop, Countdown), Wettkampf-Live-Scoring, Pflichtstunden, Verbandsmeldung — das kann keine generische Vereinssoftware. Das ist der Produkt-Moat.
2. **Echte Multi-Plattform-Abdeckung, überall nativ**: iPhone/iPad/Mac/Watch/Widgets/Android/Web — inkl. konsistenter Kern-Features (Matrix oben zeigt hohe Parität bei den Fach-Features).
3. **Differenziertes Rollen-/Rechte-Modell**: 6 Rollen inkl. Kassenwart, plus granularer Gast-Trainer-Zugang mit Ablaufdatum — praxisnah für Vereine (`User.swift`, `20260201_guest_trainer_access.sql`).
4. **Familien-Modell durchdacht**: Kind-Konten ohne E-Mail, zwei Elternteile, Upgrade mit 16, Familienrabatte, Familien-Pflichtstunden.
5. **Monetarisierung fertig gedacht**: zweigleisig (Nutzer-IAP + Vereinslizenzen), Limits, Werbung, Admin-Verwaltung der Pakete.
6. **Datenhoheit**: Self-hosted Supabase, DSGVO-argumentierbar; Backups/Restore dokumentiert.
7. **Gute Modul-Dokumentation** (`backend/docs/modules/01–11`) und ein priorisiertes Ideen-Backlog (`docs/FEATURE-VORSCHLAEGE.md`) — wertvolle Grundlage für v2-Scoping.
8. **Offline-Architektur auf iOS vorhanden** (GRDB + Sync-Service + Netzwerk-Monitor) — als Blaupause für v2 nutzbar.
9. **5-sprachig** auf allen Plattformen.

---

## 5. Schwächen & Altlasten

1. **4× redundante Implementierung ohne geteilten Code**: Jede Änderung erfordert 4 Implementierungen + manuelles Testen auf 4+ Geräten (Checklisten in allen `CLAUDE.md`). Belegte Drift-Bugs: Android `content` vs. DB `nachricht`, veraltetes `VereinNews`-Modell (`android/CLAUDE.md` Punkt 27); Portal-Lücken mussten nachträglich aufgeholt werden (`HARMONISIERUNGSPLAN.md` §2 „Kritische Lücken").
2. **God-Object-Architektur auf iOS**: `Services/SupabaseManager.swift` hat **8.520 Zeilen** und ist mit 412 Kanten der zweitgrößte Knoten im gesamten Wissensgraph (`graphify-out/GRAPH_REPORT.md`, „God Nodes"). Dazu **doppelte Typ-Definitionen** (GRDB-Modelle vs. Supabase-Typen), die per RSM-Prefix-Workaround nur teilweise repariert wurden (`REPARATUR_PLAN.md` — 8 Enums offen).
3. **Web-Portal als 87 statische HTML-Seiten**: Sidebar per Shell-Skript in alle Seiten kopiert (`www/portal/update-sidebars.sh`), Cache-Busting manuell per `?v=N` (`backend/CLAUDE.md` „JavaScript Versionen"), zwei redundante Übersetzungssysteme (`translations.js` 13.026 Zeilen + `i18n.js` 7.715 Zeilen), `portal.js` 3.349 Zeilen Vanilla JS. Nicht wartbar, nicht testbar.
4. **Medien als Base64 in Postgres**: `kuer_media.file_data TEXT` (Base64, +33 % Größe, kein Streaming; Player brauchen Temp-File-Umwege — `docs/modules/06-KUEREN.md` Zeilen 55, 164 ff., 340 ff.). DB-Bloat und Performance-Bremse; parallel existiert bereits Supabase Storage für Chat/Avatare — zwei Medien-Welten.
5. **Deutsches/englisches Misch-Schema**: `nachricht`, `ort`, deutsche Enums, dazu Serialisierungs-Fallen, die als „NIEMALS"-Regeln dokumentiert werden mussten (kein `keyDecodingStrategy`, CodingKeys-Pflicht — `ios-macos/CLAUDE.md`). Hohe Fehleranfälligkeit für jeden neuen Entwickler/Client.
6. **Sicherheits-Altlast: Supabase-Demo-JWT-Keys in Produktion** — ANON_KEY/SERVICE_ROLE_KEY mit Issuer `supabase-demo` sind in beiden `CLAUDE.md` im Klartext committet und laut Security-Audit (13.06.2026) als K1 offen. Ebenso `signing_keys.json` und `keystore.properties` im Repo.
7. **Produktion = Docker auf einem privaten Mac**: Single Point of Failure, Deploys via `docker compose build --no-cache`, kein Staging, keine CI/CD, kein Monitoring (`backend/CLAUDE.md` „Infrastruktur").
8. **Schema-Verwaltung fragmentiert**: 34 Migrationen + `sql/`-Skripte + 7 FIX-Dateien im iOS-Repo-Root (`FIX-ALL.sql`, `COMPLETE-FIX.sql`, `FIX-ROLE-SIMPLE.sql` …) + SQL-Snippets in Markdown-Doku. Kein verlässlicher Ist-Zustand des Schemas.
9. **Kaum Tests**: Android hat genau einen Unit-Test (`AuthRepositoryTest.kt`, `ENTWICKLUNGSPLAN.md` Phase 7); iOS-`RollsportManagerTests` minimal; Portal ungetestet.
10. **Feature-Sprawl ohne Modularisierung**: 40+ Feature-Bereiche für jeden Verein sichtbar (Schließfächer, Bankabgleich, Jahresabschluss …). Es existiert zwar `Views/Settings/ModuleSettingsView.swift`, aber das Produkt wirkt für kleine Vereine überladen; Onboarding-Komplexität hoch.
11. **Zahlungssystem unfertig** (Kern-Monetarisierung!): PayPal/Stripe-Checkout offen, SEPA fehlt — dabei ist Beitragseinzug DER Kaufgrund für Vereinssoftware.
12. **Repo-Hygiene**: `Podfile 2`, `RollsportManager 2.xcodeproj`, Ruby-Fix-Skripte (`fix_watch_target*.rb`), Build-Ordner und Screenshots im Repo-Root.

---

## 6. Empfehlungen für den Neuaufbau „v2"

### Produkt-Scope
1. **Kern vs. Module trennen**: Kern = Mitglieder/Teams/Familie, Termine/Anwesenheit, Küren/Training, Kommunikation, Beiträge/Zahlungen. Alles andere (Schließfächer, Equipment, Hallen, Pflichtstunden, Buchhaltung, Gamification, Wettkampf) als **pro Verein aktivierbare Module** mit eigenem Navigations-Slot — löst den Feature-Sprawl und schafft Upsell-Struktur (Module = Lizenz-Tiers).
2. **Differenzierer priorisieren, nicht neu erfinden**: Kür-Studio (Audio-Tools, Video-Timestamps, Bewertungen), Wettkampf-Live-Scoring und Pflichtstunden/Verbandsmeldung sind das Alleinstellungsmerkmal — in v2 als Leuchtturm-Features weiterentwickeln (z. B. Video-Analyse/Side-by-Side aus `docs/FEATURE-VORSCHLAEGE.md` §5).
3. **Zahlungen zuerst fertig bauen**: SEPA-Mandate + PAIN.008-Export, Stripe-Checkout serverseitig, Entitlements **serverseitig** prüfen (Paywall nie nur im Client — Lehre aus dem KetoTracker-Projekt).
4. **Rollenbasierte UX**: getrennte Home-Erlebnisse für Admin/Kassenwart, Trainer, Mitglied und Eltern (Eltern-Modus statt separater „Eltern-App Light" aus dem Backlog). Gast-Trainer-Rechtemodell (granulare Flags + Ablauf) als generisches Permission-System übernehmen.

### Architektur
5. **Eine Business-Logik, viele Oberflächen**: API-Schicht mit generierten, typisierten Clients (z. B. OpenAPI/tRPC über Postgres oder Supabase + Edge Functions) als Single Source of Truth; kein direkter Tabellen-Zugriff mehr aus 4 Frontends. Alternativ Kotlin Multiplatform/Flutter für Mobile, um die 2× native Mobile-Codebasis zu halbieren.
6. **Web-Portal als echte SPA/SSR-App** (Next.js/SvelteKit) mit Komponenten, Routing, i18n-Framework und Build-Pipeline — ersetzt 87 statische HTML-Seiten, `update-sidebars.sh` und manuelles `?v=N`.
7. **Schema v2 auf Englisch, konsistent camel-/snake_case, ein Migrationswerkzeug** (z. B. Prisma/Drizzle/Sqitch); deutsche Begriffe nur in der Präsentationsschicht. Keine Ad-hoc-FIX-SQL-Dateien mehr.
8. **Medien in Object Storage** (Supabase Storage/S3) mit signierten URLs, Streaming, Thumbnails, Transkodierung — Base64-Spalten migrieren.
9. **Offline-Strategie plattformübergreifend** statt iOS-only: Sync-Engine (z. B. PowerSync/ElectricSQL) oder klar definierter Offline-Kern (Termine, Check-in, Küren-Medien) für iOS UND Android.
10. **RLS beibehalten, aber generiert/getestet**: Policies aus einer Permission-Matrix generieren, mit pgTAP-Tests absichern.

### Betrieb & Qualität
11. **Sofort in v1 beheben, unabhängig von v2**: Produktions-JWT-Secret ersetzen (K1 aus Security-Audit), Secrets aus den Repos entfernen, `signing_keys.json`/Keystore aus der Versionskontrolle.
12. **Hosting professionalisieren**: v2 nicht auf dem privaten Mac betreiben — VPS/Cloud mit Staging-Umgebung, CI/CD, Sentry, Backups off-site.
13. **Test-Strategie von Tag 1**: Contract-Tests gegen die API, RLS-Tests, E2E für die 5 Kern-Flows (Registrierung→Verein→Termin→Check-in→Rechnung).
14. **Paritäts-Dashboard**: Feature-Flags zentral verwalten; die Matrix aus Abschnitt 3 als lebendes Dokument/Feature-Registry führen, damit Plattform-Drift messbar bleibt.

---

## 7. Quellen (wichtigste Dateien)

- `rollsportmanager-ios-macos/FUNKTIONEN.md` — offizielle Funktionsliste v1.4
- `rollsportmanager-ios-macos/CLAUDE.md`, `REPARATUR_PLAN.md` — iOS-Architektur-Altlasten, Trainer-Limits
- `rollsportmanager-android/ENTWICKLUNGSPLAN.md`, `CLAUDE.md` — Android-Stand, Harmonisierungshistorie
- `rollsportmanager-backend/CLAUDE.md`, `HARMONISIERUNGSPLAN.md`, `ZAHLUNGSSYSTEM_STATUS.md` — Portal-Struktur, Schema, Zahlungsstatus
- `rollsportmanager-backend/docs/modules/01–11` — Modul-Doku (Auth…Check-in)
- `rollsportmanager-backend/docs/FEATURE-VORSCHLAEGE.md` — priorisiertes Ideen-Backlog
- `rollsportmanager-backend/migrations/` (34 Dateien) — Feature-Chronologie 12/2025–02/2026
- `graphify-out/GRAPH_REPORT.md` — God Nodes, Community-Struktur
