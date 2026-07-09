# UX-Journey-Analyse RollsportManager (Ist-Zustand) — Grundlage für v2

**Rolle:** UX-Designer/Researcher
**Datum:** 09.07.2026
**Untersuchte Artefakte:**
- iOS/macOS/Watch (SwiftUI): `/Users/marcelgoldfuss/Apps/RollsportManager/rollsportmanager-ios-macos` (151 View-Dateien)
- Android (Kotlin/Compose): `/Users/marcelgoldfuss/Apps/RollsportManager/rollsportmanager-android` (306 Kotlin-Dateien, `MainNavigation.kt` mit 1.953 Zeilen)
- Web-Portal (statisches HTML/JS): `/Users/marcelgoldfuss/Apps/RollsportManager/rollsportmanager-backend/www/portal` (≈90 HTML-Seiten, 54.085 Zeilen)
- Doku: `FUNKTIONEN.md`, `CLAUDE.md` (alle 3 Repos), `HARMONISIERUNGSPLAN.md`, `ZAHLUNGSSYSTEM_STATUS.md`, `REPARATUR_PLAN.md`

---

## 1. Überblick

RollsportManager ist funktional außergewöhnlich breit („200+ Funktionen", `FUNKTIONEN.md`): Vereins-, Team-, Mitglieder-, Termin-, Finanz-, Kür-, Wettkampf-, Equipment-, Familien- und Kommunikations-Features auf vier Plattformen (iPhone/iPad, macOS, Android, Web-Portal, plus Apple Watch und Widgets). Die UX-Realität dahinter ist jedoch die eines **Feature-Baukastens ohne Journey-Design**: Funktionen wurden einzeln „angebaut" und über Hubs, Sidebars und Menüs erreichbar gemacht, aber die tatsächlichen Arbeitsabläufe der Personas (Trainer plant eine Woche; Kassenwart zieht Beiträge ein; Eltern sagen zu und zahlen) laufen quer durch viele getrennte Bereiche, brechen an entscheidenden Stellen ab oder enden in Platzhaltern.

Die drei gravierendsten Befunde:

1. **Die Zahlungs-Journey ist ein Dead-End.** Mitglieder können weder in der iOS-App noch im Portal tatsächlich online bezahlen — die PayPal/Stripe/SEPA-Buttons sind Attrappen (Belege in Abschnitt 3.4). Das ist der wichtigste Moment der gesamten App (Geldfluss für den Verein) und er funktioniert nicht.
2. **Navigations-Überfrachtung.** Portal-Sidebar mit 40+ Links in 7 Gruppen, iOS-„Mehr"-Menü mit 26 Kacheln, Finanzbereich allein mit 11+ eigenständigen Seiten. Rollen- und Modul-Flags erzeugen dutzende Sichtbarkeits-Varianten derselben Navigation.
3. **Parität als Handarbeit.** Jede UI-Änderung muss laut `CLAUDE.md` viermal implementiert werden. Ergebnis: dokumentierte Drift (Android-Felder `content` vs. `nachricht`), Features, die auf Android nur in den Einstellungen versteckt sind, und zwei Sidebar-Generationen im Portal.

Für v2 gilt: **Nicht Features portieren, sondern Journeys bauen** — mit einer gemeinsamen Design-/Komponentenschicht, serverseitiger Logik (Rechnungsläufe, Erinnerungen, Mahn-Eskalation) und radikal verschlankter, rollenbasierter Navigation.

---

## 2. Informationsarchitektur & Navigation (Ist)

### 2.1 iOS/macOS
- iPhone: 5 Tabs (Home, Kalender, Teams, Chat, Mehr) — `Views/MainView.swift` (Z. 207–283). iPad/macOS: Sidebar mit 8+ Sektionen (Übersicht, Verein, Kommunikation, Auswertung, Verwaltung & Finanzen, Vereinsverwaltung, Super-Admin) — `MainView.swift` Z. 438–614.
- Der „Mehr"-Tab (`MoreMenuView`, `MainView.swift` ab Z. 909) rendert bis zu **26 Kachel-Ziele** (`Models/AppCustomization.swift`, `MoreMenuItemType` Z. 14–39: News, Küren, Teams, Trainingsplan, Training-Hub, Chat, Belegungsplan, Ausrüstung, Wettkampf, Finanzen, Auswertung, Berichte, Termine, Medaillen, Familie, Pflichtstunden, Events, Check-in, Notizen, Galerie, Dokumente, Mitglieder, Abteilungen, Einstellungen, Vereinsverwaltung, Super-Admin).
- Sichtbarkeit hängt von **Rolle × Modul-Flags** ab (`modulTrainingsplanEnabled`, `modulBelegungsplanEnabled`, `modulKuerenEnabled` …, `MainView.swift` Z. 445–520). Dieselbe Funktion ist oft mehrfach erreichbar (z. B. Gasttrainer: Sidebar-Sektion „Vereinsverwaltung" UND `Views/Training/TrainingHubView.swift` Z. 40–47) — das wirkt wie Redundanz statt Struktur.
- Werbung ist Teil der Navigation: `SmartAdBanner` liegt dauerhaft über der Tab-Leiste bzw. unter jeder Detailseite (iPhone `MainView.swift` Z. 274–281, iPad Z. 333–338, macOS Z. 420–425).
- Navigations-Zurücksetzen wird über UUID-Tricks erzwungen (`dashboardNavID = UUID()` etc., Z. 200–301, 649–661) — ein Workaround-Muster, das auf fehlende zentrale Navigationsarchitektur hindeutet.

### 2.2 Android
- 6 Haupt-Routen (Dashboard, Teams, Termine, Chat, Küren, Settings) + ~50 Detail-Routen in einer einzigen `MainNavigation.kt` (1.953 Zeilen).
- **Verwaltungs-Features sind in den Einstellungen versteckt**: Gast-Trainer, Wettkampf-Modus und Medaillen sind laut `rollsportmanager-android/CLAUDE.md` (Punkte 11, 13) nur über `SettingsScreen.kt` erreichbar — für einen Trainer am Wettkampftag eine absurde Auffindbarkeits-Hürde.

### 2.3 Web-Portal
- ≈90 einzelne HTML-Seiten mit je eigenem Inline-CSS/JS. Die Sidebar wird inzwischen per JS injiziert (`www/assets/js/portal.js`, `renderSidebar()` ab Z. 1229) und enthält für Admins **40+ Links in 7 Gruppen**; allein „Finanzen": Budget, Kassenbuch, SEPA, Mahnungen, Jahresabschluss, Spenden, Ratenzahlung, Berichte, Bankabgleich, Familien-Rabatte, Ausgaben (portal.js Z. ~1480–1570).
- **Zwei Sidebar-Generationen koexistieren**: ältere Seiten wie `portal/guest-trainers.html` (Z. 184–276) haben noch eine fest einkodierte Sidebar; die Synchronisation lief früher über ein sed-Skript (`portal/update-sidebars.sh`) — ein deutliches Altlast-Signal.
- Cache-Invalidierung manuell über `?v=`-Query-Strings (`style.css?v=36`, `portal.css?v=30`, dokumentiertes „Bekanntes Problem" in `rollsportmanager-backend/CLAUDE.md`).

---

## 3. Journey-Analysen

### 3.1 Persona A: Trainer plant Training + Wettkampf

**Journey A1 — Wöchentliches Training anlegen (iOS):**
1. Tab „Kalender" → Toolbar „+" → `Views/Termin/TerminCreateView.swift`.
2. Formular (1 Screen): Titel, Typ (Segmented, 5 Typen), Team (für Trainer vorausgewählt, Z. 424–427), Start/Ende, Sportanlage, Wiederholung, Beschreibung, „Helfer gesucht".
3. „Erstellen" → fertig.

**Positiv:** Live-Konfliktprüfung der Sportanlage mit Belegungsplan-Integration (Z. 450–483, inkl. „Trotzdem erstellen" nur für Mod/Admin), Serien-Vorschau der nächsten Termine (Z. 307–331), automatischer Geräte-Kalender-Sync (`CalendarService`, Z. 541–542). Das ist die am besten designte Einzel-Maske der App.

**Friktion:**
- **Wiederholungen sind keine Serie**: Es werden N Einzeltermine per Schleife angelegt (Z. 518–547). Es gibt kein Serien-Objekt → „Trainingszeit ändert sich ab März" bedeutet: jeden Termin einzeln bearbeiten/löschen. Für einen Verein mit 5 Gruppen × 2 Trainings/Woche ist das die häufigste Pflegeaufgabe überhaupt.
- Keine Termin-Vorlagen, kein Duplizieren, keine Ziel-Benachrichtigung („Team informieren?") beim Erstellen.
- **Bruch zwischen Termin und Trainingsinhalt**: Trainingsplanung (`Views/Training/TrainingsplanungView.swift`, 950 Zeilen: Pläne/Übungsbibliothek/Vorlagen, Zuweisung an Mitglieder) ist ein komplett getrenntes Feature in einem anderen Navigationsast (Training-Hub). Ein Trainingsplan lässt sich keinem Termin zuordnen; die Journey „Dienstag 17:00, Gruppe A, Sprungtraining nach Plan X" existiert im Produkt nicht als Einheit.
- Anwesenheit erfassen geht erst **nach** dem Termin (`TerminDetailView.swift` Z. 139–141: `termin.isPast && isTrainer`) — Check-in-Scanner ist wiederum ein separater Menüpunkt.

**Journey A2 — Wettkampf organisieren:**
1. Termin mit Typ „Wettkampf" anlegen (wie A1).
2. `TerminDetailView` zeigt Karte „Wettkampf-Modus" (Z. 105–108) → `Views/Wettkampf/WettkampfDetailView.swift`: Countdown, Checklisten (Standard-Checkliste wird auto-erstellt, Z. 255–265), Ergebnisse.
3. Alternativ: Sidebar „Wettkampf-Modus" → `WettkampfModusView.swift` (Liste aller Wettkampf-Termine) → `WettkampfLiveView.swift` (Starter verwalten, Live-Scoring mit Slidern Technik/Ausdruck/Schwierigkeit/Abzüge, RPC `set_starter_score`, Z. 811–830).

**Friktion:**
- **Kritischer Defekt: „Ergebnis eintragen" speichert nichts.** `WettkampfErgebnisView.saveErgebnis()` ist ein Stub: `// TODO: Ergebnis speichern` + `dismiss()` (`WettkampfDetailView.swift` Z. 442–445). Der Trainer tippt Platzierung, Punkte, Notizen ein, drückt „Speichern" — Datenverlust ohne jede Rückmeldung. Severity 4 (kritisch).
- Zwei konkurrierende Einstiege (Termin-Detail vs. Sidebar-Modul) mit unterschiedlichem Funktionsumfang (Checklisten/Countdown vs. Live-Scoring) — mentales Modell unklar.
- Android: Wettkampf-Modus nur über Einstellungen erreichbar (s. 2.2); am Wettkampftag in der Halle (schlechtes Netz) gibt es keinen erkennbaren Offline-Pfad für Scoring.
- `WettkampfModusView.swift` Empty-State „Es sind keine Wettkämpfe geplant." (Z. 24–26) ohne Aktions-Button „Wettkampf anlegen".

### 3.2 Persona B: Vereins-Admin verwaltet Mitglieder + Beiträge + Mahnungen

**Journey B1 — Mitglied aufnehmen:**
1. Mitglied registriert sich selbst (App/Portal, 2-Schritte-Formular `Views/Auth/RegisterView.swift` Z. 16–75) mit 6-stelligem Vereins-Code oder 8-stelligem Einladungs-Code (`Views/Verein/VereinJoinView.swift` Z. 25–33, 104–141) — solide Grundidee.
2. Verwaltung über `Views/Mitglieder/MitgliederListView.swift` (2.279 Zeilen — Monolith) bzw. `portal/mitglieder.html` (1.697 Zeilen).

**Journey B2 — Beiträge einziehen (der Kern-Workflow des Kassenwarts):**
1. Finanzen-Hub → „Mitgliedsbeiträge" (`Views/Finance/MitgliederBeitraegeView.swift`).
2. Pro Mitglied Beitragskategorie per Picker zuordnen (Z. 704–718). Familien-Logik vorhanden (Familienbeitrag deckt Kinder ab, Z. 75–99 — gut).
3. Button „Rechnungen für alle erstellen" → Bestätigungs-Alert → Batch-Erzeugung (Z. 246–252, 589–630).
4. Zahlungseingang manuell als „bezahlt" markieren (`markInvoicePaid`, s. `ZAHLUNGSSYSTEM_STATUS.md`); Abgleich über separate Seite `portal/bankabgleich.html`.

**Friktion:**
- **Keine Automatisierung**: Es existiert kein wiederkehrender Rechnungslauf. In `rollsportmanager-backend/workers/` liegt nur ein `push-worker.js`; `functions/` enthält Webhooks und Mail-Sender, aber keinen Invoice-/Dunning-Scheduler. Der Kassenwart muss jeden Abrechnungszeitraum daran denken, den Batch-Button zu drücken — und Zahlungseingänge von Hand pflegen, weil Online-Zahlung nicht funktioniert (s. 3.4).
- **Fragmentierung**: Der Finanz-Workflow ist auf 13 iOS-Views (`Views/Finance/`: Ausgaben, Bankabgleich, Budgetplanung, Dunning, FamilienRabatte, FinanceExport, FinanzenHub, Jahresabschluss, Kassenbuch, MitgliederBeitraege, Ratenzahlung, SEPAExport, Spendenbescheinigungen) und 11+ Portal-Seiten verteilt. Ein Vorgang „offener Posten → Erinnerung → Mahnung → Zahlungseingang → Verbuchung" springt durch 4–5 getrennte Bereiche.

**Journey B3 — Mahnwesen:**
1. Finanzen → Mahnwesen (`Views/Finance/DunningView.swift`, 1.035 Zeilen): Statistik-Karten (überfällig, offener Betrag, Ø Tage), Filter nach Mahnstufe, Liste überfälliger Rechnungen.
2. Rechnung antippen → `CreateDunningSheet` (Z. 771 ff.): Mahnstufe (Erinnerung/1./2./3./Inkasso), Gebühr (Standard/eigene), Zahlungsfrist, Textvorschau, Versand per E-Mail und/oder PDF.
3. Portal-Pendant `portal/mahnungen.html`: 3 Tabs (Überfällig/Mahnungen/Historie), Modal „Erstellen & Versenden", „Als bezahlt markieren".

**Positiv:** Fachlich reifste Strecke der App — Mahnstufen, Gebühren, Fristen, PDF, Historie sind durchdacht.

**Friktion:** Alles manuell pro Rechnung; keine Regel-Engine („nach 14 Tagen automatisch Erinnerung"), keine Sammel-Mahnläufe, kein Vorab-Blick auf die E-Mail pro Empfänger im Batch. Und die Mahnung fordert zu einer Zahlung auf, die das Mitglied online gar nicht leisten kann (s. 3.4) — die Journey beißt sich selbst.

### 3.3 Persona C: Mitglied/Eltern — Termine sehen, zu-/absagen, zahlen

**Journey C1 — Termin beantworten (iOS):**
1. Tab „Kalender" (`Views/Calendar/CalendarView.swift`: grafischer DatePicker + Tagesliste + Abteilungsfilter) → Termin antippen → `TerminDetailView` als Sheet.
2. „Deine Antwort": 4 Buttons Zusage/Absage/Vielleicht/Krank (Z. 497–521), bei „Helfer gesucht" zusätzlicher Toggle. 2 Taps bis zur Antwort — gut.

**Friktion:**
- **Kein Absagegrund/Kommentar** möglich, obwohl `FUNKTIONEN.md` „Abwesenheitsgründe erfassen" verspricht und `termin_responses` laut `HARMONISIERUNGSPLAN.md` (Z. 113) eine `kommentar`-Spalte hat. Trainer sehen nur nackte Zahlen.
- **Erinnerungen sind rein lokal** pro Gerät (`TrainingsErinnerungManager`, `TerminDetailView.swift` Z. 345–365) — wer die Erinnerung am iPhone setzt, hat sie nirgendwo sonst; es gibt keine serverseitigen Standard-Reminder („24 h vorher, wenn noch keine Antwort").
- Performance-Geruch: Responses laden die User einzeln nacheinander (`for userId in userIds { findUser(id:) }`, Z. 609–615) — bei 30 Zusagen 30 Requests, spürbare Ladezeit im Sheet.

**Journey C2 — Eltern antworten für Kinder:**
1. Sidebar/Mehr → „Familie" → `Views/Family/FamilyDashboardView.swift` (Kinder-Karten, Einladungen, Pflichtstunden) → „Alle Termine" (`AllChildrenTermineView.swift`).
2. Pro Termin und Kind Inline-Antwort-Buttons (`ChildResponseRow`, Z. 160–224).

**Positiv:** Das Familien-Modell (Eltern-Account, Kinder via `parent_id`, Upgrade ab 16, zweiter Elternteil einladbar) ist ein echtes Differenzierungsmerkmal.

**Friktion:** Eltern haben nur **3 Antwortoptionen** (Zusage/Absage/Vielleicht — „Krank" fehlt, Z. 179–201), inkonsistent zur 4-Option-Detailansicht. Familien-Termine sind ein separater Bereich statt in den Haupt-Kalender integriert (Eltern müssen zwei Orte prüfen: eigenen Kalender + Familienbereich).

**Journey C3 — Rechnung bezahlen (die kaputteste Journey der App):**
- **iOS:** Profil → „Rechnungen & Beiträge" (`Views/Settings/ProfileTabView.swift` Z. 75, 224) → Rechnung → Zahlungsdialog. Die drei Buttons „SEPA-Lastschrift", „Kreditkarte", „PayPal" rufen **nur `dismiss()`** auf (`Views/Payment/InvoiceDetailView.swift` Z. 504–532) — das Sheet schließt sich kommentarlos, nichts passiert, keine Fehlermeldung. Für das Mitglied sieht es aus wie ein Bug (ist es auch).
- **Portal:** `portal/payments.html` — Banküberweisung funktioniert (IBAN-Anzeige + „Bankdaten kopieren", Z. 642–660, 738–749); `payWithPayPal()`/`payWithStripe()` zeigen nur einen Info-Alert „PayPal wird vorbereitet…" (Z. 752–762, Übersetzungskeys `payments.paypal_preparing` in `assets/js/i18n.js`).
- `ZAHLUNGSSYSTEM_STATUS.md` bestätigt: PayPal/Stripe „UI fertig", Integration offen, SEPA „nicht begonnen" — seit 12.01.2026 unverändert.

**Konsequenz:** Der Verein kann Zahlungsmethoden konfigurieren, Rechnungen und sogar Mahnungen verschicken — aber der einzige echte Zahlungsweg ist die manuelle Überweisung mit manueller Verbuchung. Vertrauensschaden inklusive (tote Buttons im Geld-Kontext).

### 3.4 Persona D: Gasttrainer

**Journey D1 — Einladen (Admin/Moderator):**
1. iOS: Sidebar „Gast-Trainer" (nur Admin/Mod/Super-Admin-Sektionen, `MainView.swift` Z. 585–609) oder Training-Hub-Karte → `Views/Team/GuestTrainerView.swift`: Team wählen → „+" → E-Mail-Einladung (`InviteGuestTrainerView`).
2. Portal: `portal/guest-trainers.html` — Invite-Formular + generierter Einladungslink.

**Positiv:** Guter Empty-State mit Erklärtext (Z. 101–118), Trennung aktiv/ausstehend, Widerrufen mit Bestätigungsdialog, zeitlich begrenzter Zugang (`expires_at`).

**Journey D2 — Annahme (der Gast selbst):**
1. E-Mail mit Link → `portal/accept-guest-invite.html?token=…`.
2. Ohne Session: Zustand „Anmeldung erforderlich" mit Login-/Registrieren-Buttons (Z. 43–53) → Gast muss erst einen **vollen Account registrieren** (inkl. Vereins-Code-Schritt im Registrierungsformular, der für ihn gar nicht gilt), dann zurück zum Link, dann annehmen (`acceptInvitation()` via RPC, Z. 273 ff.).
3. Danach App installieren und sich zurechtfinden — ohne Gast-spezifische Oberfläche; die Rolle blendet lediglich Menüpunkte aus.

**Friktion:**
- **Medienbruch + Registrierungszwang**: Einladung wird in der App erstellt, kann aber nur im Web angenommen werden; die Annahme scheitert am Konto-Zwang, bevor der Gast irgendetwas gesehen hat. Kein Magic-Link-Login, kein „Als Gast fortfahren".
- Android versteckt die Gasttrainer-Verwaltung in den Einstellungen (`rollsportmanager-android/CLAUDE.md` Punkt 11).
- In der App gibt es keine sichtbare Kennzeichnung „Dein Zugang läuft am … ab" für den Gast selbst.

### 3.5 Querschnittsbefunde

**Onboarding:**
- Registrierung: sauberer 2-Schritte-Wizard mit Fortschrittsanzeige (`RegisterView.swift` Z. 121–139), Vereinsbeitritt per Code direkt integriert (Z. 365, 448) — gut.
- Ohne Verein: `Views/Verein/VereinSetupView.swift` bietet nur „Gründen" oder „Beitreten" (84 Zeilen) — kein Erklär-Screen, was die App kann.
- Neuer Verein: `DemoDataSelectionView` (`MainView.swift` Z. 137–145) bietet Demo-Daten an — sehr gute Idee.
- **Es fehlt komplett**: rollenbasierte Ersteinrichtung (Admin-Checkliste: Teams → Beitragskategorien → Zahlungswege → erster Termin → Mitglieder einladen), Feature-Touren, kontextuelle Hilfe. Bei 200+ Funktionen ist die Lernkurve ohne Führung steil; der Trial-Ablauf konfrontiert Admins stattdessen mit einem Lizenz-Kauf-Sheet (`checkTrialStatus()`, `MainView.swift` Z. 150–178).

**Suche:**
- iOS besitzt eine fertige globale Suche (`Views/Search/GlobalSearchView.swift`, 499 Zeilen) inkl. `GlobalSearchButton` — **aber der Button ist nirgends eingebunden** (keine Referenz außerhalb der Datei): totes Feature. Nutzer haben nur lokale `.searchable`-Felder in einzelnen Listen.
- Portal hat `search.html` in der Sidebar (portal.js Z. ~1246) — inkonsistent zur App.

**Leere Zustände & Feedback:**
- `EmptyStateView` existiert und wird verwendet (GuestTrainer, Trainingsplanung, Wettkampf, Kalender) — aber meist ohne Call-to-Action-Button. Fehlerbehandlung ist häufig nur `print("❌ …")` ohne Nutzer-Feedback (z. B. `TerminDetailView.swift` Z. 645–647, `TerminCreateView.swift` Z. 429–431) — stille Fehler.

**Monetarisierung im Weg:**
- Dauerbanner über der Tab-Leiste auf jeder Seite (s. 2.1); Trainer ohne Premium: nur 1 Kür pro Mitglied, 2 Bilder pro Kür, Interstitial nach jeder 5. Kür-Wiedergabe (`rollsportmanager-ios-macos/CLAUDE.md` „Trainer-Limits & Werbung"). Werbung/Limits schneiden direkt in die Kern-Arbeitsschleifen der wichtigsten Power-Persona (Trainer).

**Konsistenz & Altlasten:**
- Antwortoptionen 4 vs. 3 (s. 3.3); zwei Wettkampf-Einstiege; zwei Portal-Sidebar-Generationen; doppelte Typdefinitionen GRDB vs. Supabase mit RSM-Prefix-Workaround (`REPARATUR_PLAN.md`); deutsche Enum-Werte in der DB (`bild`, `dokument`) als ewige Stolperfalle (`rollsportmanager-ios-macos/CLAUDE.md`); i18n-Keys teils maschinell generiert und redundant (`L("termin_create_du_kannst_nur_fuer", …)`), 5 Sprachen über mehrere Riesen-Dateien (`i18n.js`, `translations*.json`) gepflegt.

---

## 4. Stärken (bewahren!)

1. **Fachliche Tiefe im Rollsport-Kontext**: Küren mit Audio-Player (Tempo, A-B-Loop, Countdown, Timestamps), Wettkampf-Live-Scoring mit Wertungs-Slidern, Pflichtstunden, Verbandsmeldung — echtes Domänenwissen, das kein generisches Vereinstool hat.
2. **Familien-Modell** (Eltern/Kinder, Account-Upgrade ab 16, Familienbeiträge mit automatischer Abdeckung in `MitgliederBeitraegeView`).
3. **Belegungsplan-Integration mit Live-Konfliktprüfung** beim Termin-Anlegen (`TerminCreateView.swift`).
4. **Mahnwesen fachlich komplett** (Stufen, Gebühren, Fristen, PDF, Historie, Statistiken).
5. **Join-Code/Einladungs-Code-Beitritt** und Demo-Daten für neue Vereine — niedrige Einstiegshürde.
6. **Modul-Schalter pro Verein** (richtige Idee: kleine Vereine sehen weniger) — nur die Umsetzung (if-Kaskaden in jeder View) ist Altlast.
7. Plattform-Abdeckung inkl. Watch (Check-in, Termine) und Widgets.

---

## 5. Schwächen / Altlasten (priorisiert)

| # | Befund | Severity | Beleg |
|---|--------|----------|-------|
| 1 | Online-Zahlung ist Attrappe auf allen Plattformen; iOS-Buttons machen `dismiss()` ohne Feedback | 4 – kritisch | `Views/Payment/InvoiceDetailView.swift` Z. 504–532; `portal/payments.html` Z. 752–762; `ZAHLUNGSSYSTEM_STATUS.md` |
| 2 | Wettkampf-Ergebnis „Speichern" verwirft Eingaben (TODO-Stub) | 4 – kritisch | `Views/Wettkampf/WettkampfDetailView.swift` Z. 442–445 |
| 3 | Keine Automatisierung für Rechnungsläufe/Mahn-Eskalation/Reminder (nur Push-Worker vorhanden) | 3 – hoch | `backend/workers/`, `backend/functions/`; `MitgliederBeitraegeView.swift` |
| 4 | Navigations-Überfrachtung: 26 „Mehr"-Kacheln, 40+ Portal-Links, 11+ Finanzseiten, Mehrfach-Einstiege | 3 – hoch | `Models/AppCustomization.swift` Z. 14–39; `portal.js` `renderSidebar()` Z. 1229 ff. |
| 5 | Termin-Wiederholung erzeugt N Einzeltermine ohne Serienverwaltung | 3 – hoch | `Views/Termin/TerminCreateView.swift` Z. 518–547 |
| 6 | Gasttrainer-Annahme erzwingt Registrierung + Web-Medienbruch | 3 – hoch | `portal/accept-guest-invite.html` Z. 43–53, 273 ff. |
| 7 | Globale Suche fertig gebaut, aber nicht eingebunden (toter Code) | 3 – hoch | `Views/Search/GlobalSearchView.swift` Z. 478–491 |
| 8 | Kein Absagegrund/Kommentar bei Zu-/Absagen; Eltern-Ansicht inkonsistent (3 statt 4 Optionen) | 2–3 | `TerminDetailView.swift` Z. 497–521; `AllChildrenTermineView.swift` Z. 179–201 |
| 9 | Kein rollenbasiertes Onboarding/Setup-Checkliste trotz 200+ Funktionen | 3 – hoch | `VereinSetupView.swift` (84 Z.); fehlende Onboarding-Views |
| 10 | Werbung/Limits in Kern-Loops der Trainer (Interstitials, Kür-Limits), Dauerbanner in Navigation | 2–3 | `MainView.swift` Z. 274–281; `ios CLAUDE.md` „Trainer-Limits" |
| 11 | 4-fache manuelle Plattform-Parität → dokumentierte Drift, versteckte Features auf Android | 3 – hoch (Ursache vieler UX-Bugs) | `backend/CLAUDE.md` „KRITISCH – PLATTFORM-SYNCHRONISATION"; `android/CLAUDE.md` Punkte 11, 26, 27 |
| 12 | Portal = 90 statische HTML-Seiten, Inline-Styles, sed-Sidebar-Sync, manuelle Cache-Buster | 3 – hoch | `www/portal/`, `update-sidebars.sh`, `backend/CLAUDE.md` |
| 13 | N+1-Ladeverhalten in Detail-Views (User einzeln laden), stille Fehler via `print` | 2 | `TerminDetailView.swift` Z. 609–615, 645–647 |
| 14 | Erinnerungen nur lokal pro Gerät | 2 | `TerminDetailView.swift` Z. 345–365 |
| 15 | Empty-States ohne Aktionen; Riesen-Monolithen (`DashboardView` 2.258 Z., `MitgliederListView` 2.279 Z.) | 2 | `WettkampfModusView.swift` Z. 24–26 |

---

## 6. Die 10 wichtigsten UX-Verbesserungen für v2

1. **Zahlungs-Journey end-to-end fertig bauen — vor allem anderen.** Stripe (Karte + SEPA-Lastschrift + evtl. PayPal via Stripe) mit echtem Checkout, Webhook-Verbuchung, Zahlungsstatus in Echtzeit auf Rechnung und Mahnliste, Zahlungsbestätigung per Push/Mail. Kein Zahlungs-Button existiert in v2, bevor er funktioniert. (Behebt Schwäche 1; macht Mahnwesen und Beitragsverwaltung erst rund.)
2. **Rollenbasierte Workspaces statt Feature-Sidebar.** Drei kuratierte Oberflächen: „Mein Verein" (Mitglied/Eltern: Termine, Antworten, Zahlungen, Familie), „Training" (Trainer: Heute-Ansicht, Gruppen, Anwesenheit, Küren, Wettkampf), „Verwaltung" (Vorstand/Kasse: Mitglieder, Finanzen-Workflow, Berichte). Max. 5 Top-Level-Ziele pro Rolle; Modul-Schalter konfigurieren Inhalte, nicht dutzende Menüpunkte.
3. **Universelle Suche + Schnellaktionen überall.** Die vorhandene GlobalSearch-Logik als omnipräsentes Suchfeld/⌘K-Palette (Mitglieder, Termine, Rechnungen, Küren, Seiten/Aktionen) auf allen Plattformen einbinden — das entschärft jede Navigationstiefe sofort.
4. **Geführtes Onboarding pro Persona.** Admin: Setup-Checkliste mit Fortschritt (Verein → Teams → Beitragskategorien → Zahlungsmethoden → erster Termin → Mitglieder einladen), Demo-Daten-Option beibehalten. Mitglied/Eltern: 3-Schritte-Start (Profil, Benachrichtigungen, erster Termin). Trainer: „Dein erstes Training in 2 Minuten".
5. **Termine als echte Serien + verknüpfter Trainingskontext.** RRULE-basierte Serien mit „nur dieser/alle zukünftigen"-Bearbeitung, Vorlagen und Duplizieren; Trainingsplan/Übungen direkt am Termin; Trainer-„Heute"-Screen: Teilnehmerstatus, Plan, 1-Tap-Anwesenheit/Check-in an einem Ort.
6. **Antwort-Flow vereinheitlichen und anreichern.** Überall dieselben Optionen (inkl. Krank) + optionaler Grund/Kommentar (Spalte existiert bereits), serverseitige Erinnerungen („24 h vorher, falls unbeantwortet") statt Geräte-Lokal, Eltern antworten für Kinder direkt im Haupt-Kalender (Kind-Avatare am Termin statt separatem Familienbereich).
7. **Finanz-Workflow statt Finanz-Seiten.** Ein durchgehender Bereich „Beiträge & Finanzen" mit Pipeline-Sicht (offen → erinnert → gemahnt → bezahlt), automatischen wiederkehrenden Rechnungsläufen (Scheduler), regelbasierter Mahn-Eskalation mit Sammel-Versand und integriertem Bankabgleich (CSV/FinTS-Matching-Vorschläge). Kassenbuch/Budget/Jahresabschluss als Unterpunkte, nicht als 11 Sidebar-Links.
8. **Gasttrainer ohne Hürden.** Magic-Link in der E-Mail → sofortige eingeschränkte Ansicht (Team, Termine, Anwesenheit) ohne Vorab-Registrierung; Konto-Anlage optional nach dem ersten Nutzen; Ablaufdatum sichtbar im UI; identischer Flow in App und Web (Universal Link).
9. **Wettkampf-Modul konsolidieren und verlässlich machen.** Ein Einstieg (vom Termin), ein Flow: Meldung/Teilnehmer → Checklisten → Live-Scoring → Ergebnisse (die wirklich gespeichert werden) → Ergebnis-Historie am Athleten-Profil; offline-first für die Wettkampfhalle mit Sync.
10. **Zustands- und Feedback-Design als System.** Verbindliche Patterns für Leere-Zustände (immer mit CTA), Lade-Skeletons, Fehler-Toasts statt stiller `print`-Fehler, Optimistic UI bei Antworten/Check-ins; dazu Performance-Grundhygiene (Batch-Loading statt N+1). Monetarisierung raus aus den Kern-Loops: keine Interstitials im Trainingsbetrieb, Banner nie über der Navigation, Limits nur an nicht-kritischen Stellen.

---

## 7. Ergänzende Empfehlungen für den Neuaufbau

- **Eine Web-Codebasis statt 90 HTML-Seiten**: SPA/SSR-Framework mit Komponentenbibliothek, zentraler i18n (DE + EN als Pflicht, weitere Sprachen als Ressourcen) und automatischem Asset-Hashing — eliminiert sed-Skripte, Sidebar-Drift und `?v=`-Cache-Buster strukturell.
- **Design-System zuerst** (Tokens, Komponenten, Interaktionsmuster) und geteilte API-/Modell-Verträge (z. B. generierte Typen aus dem Schema), damit Parität aus der Architektur kommt statt aus Checklisten in `CLAUDE.md`.
- **Berechtigungen als Matrix, nicht als if-Kaskade**: Die heutigen Rollen (mitglied, trainer, kassenwart, moderator, admin, super-admin) + Eltern-Flags + Modul-Flags erzeugen in v1 unkontrollierbare UI-Varianten. v2: deklaratives Permission-Modell, gegen das UI-Sichtbarkeit getestet werden kann.
- **Englische, konsistente DB-Bezeichner** (Abschied von `bild`/`dokument`/`nachricht`-Fallen) mit sauberer Migrationsstrategie — beseitigt eine ganze Klasse von Plattform-Bugs.
- **Watch/Widgets gezielt einsetzen**: Check-in und „nächster Termin + Antwort" sind die richtigen Glanzlicht-Features; nicht mehr.
- **Messbarkeit einbauen**: Ereignis-Tracking für die vier Kern-Journeys (Funnel: Termin gesehen → beantwortet; Rechnung gestellt → bezahlt), damit v2-UX-Entscheidungen erstmals datenbasiert validiert werden können (heute existiert dafür nichts).

---

## 8. Datei-Referenzen (Auswahl)

| Thema | Pfad |
|-------|------|
| iOS Navigation/Tabs/Sidebar/Ads | `/Users/marcelgoldfuss/Apps/RollsportManager/rollsportmanager-ios-macos/RollsportManager/Views/MainView.swift` |
| „Mehr"-Menü-Kacheln | `/Users/marcelgoldfuss/Apps/RollsportManager/rollsportmanager-ios-macos/RollsportManager/Models/AppCustomization.swift` |
| Termin anlegen (Konfliktprüfung, Pseudo-Serien) | `/Users/marcelgoldfuss/Apps/RollsportManager/rollsportmanager-ios-macos/RollsportManager/Views/Termin/TerminCreateView.swift` |
| Termin-Detail/Antworten/lokale Erinnerung/N+1 | `/Users/marcelgoldfuss/Apps/RollsportManager/rollsportmanager-ios-macos/RollsportManager/Views/Termin/TerminDetailView.swift` |
| Wettkampf-Ergebnis-Stub | `/Users/marcelgoldfuss/Apps/RollsportManager/rollsportmanager-ios-macos/RollsportManager/Views/Wettkampf/WettkampfDetailView.swift` (Z. 442–445) |
| Live-Scoring | `/Users/marcelgoldfuss/Apps/RollsportManager/rollsportmanager-ios-macos/RollsportManager/Views/Wettkampf/WettkampfLiveView.swift` |
| Mahnwesen iOS | `/Users/marcelgoldfuss/Apps/RollsportManager/rollsportmanager-ios-macos/RollsportManager/Views/Finance/DunningView.swift` |
| Beitrags-Zuordnung/Batch-Rechnungen | `/Users/marcelgoldfuss/Apps/RollsportManager/rollsportmanager-ios-macos/RollsportManager/Views/Finance/MitgliederBeitraegeView.swift` |
| Tote Zahlungs-Buttons iOS | `/Users/marcelgoldfuss/Apps/RollsportManager/rollsportmanager-ios-macos/RollsportManager/Views/Payment/InvoiceDetailView.swift` (Z. 504–532) |
| Zahlungs-Platzhalter Portal | `/Users/marcelgoldfuss/Apps/RollsportManager/rollsportmanager-backend/www/portal/payments.html` (Z. 752–762) |
| Zahlungssystem-Status | `/Users/marcelgoldfuss/Apps/RollsportManager/rollsportmanager-backend/ZAHLUNGSSYSTEM_STATUS.md` |
| Gasttrainer iOS / Annahme Web | `/Users/marcelgoldfuss/Apps/RollsportManager/rollsportmanager-ios-macos/RollsportManager/Views/Team/GuestTrainerView.swift`, `/Users/marcelgoldfuss/Apps/RollsportManager/rollsportmanager-backend/www/portal/accept-guest-invite.html` |
| Eltern-Antworten (3 Optionen) | `/Users/marcelgoldfuss/Apps/RollsportManager/rollsportmanager-ios-macos/RollsportManager/Views/Family/AllChildrenTermineView.swift` |
| Nicht eingebundene globale Suche | `/Users/marcelgoldfuss/Apps/RollsportManager/rollsportmanager-ios-macos/RollsportManager/Views/Search/GlobalSearchView.swift` |
| Portal-Sidebar-Renderer (40+ Links) | `/Users/marcelgoldfuss/Apps/RollsportManager/rollsportmanager-backend/www/assets/js/portal.js` (ab Z. 1229) |
| Sidebar-Altlast (sed-Sync) | `/Users/marcelgoldfuss/Apps/RollsportManager/rollsportmanager-backend/www/portal/update-sidebars.sh` |
| Android-Navigation (Feature-Versteck in Settings) | `/Users/marcelgoldfuss/Apps/RollsportManager/rollsportmanager-android/app/src/main/java/de/rollsportmanager/app/ui/navigation/MainNavigation.kt`, `…/ui/screen/settings/SettingsScreen.kt` |
| Onboarding/Registrierung | `/Users/marcelgoldfuss/Apps/RollsportManager/rollsportmanager-ios-macos/RollsportManager/Views/Auth/RegisterView.swift`, `…/Views/Verein/VereinSetupView.swift`, `…/Views/Verein/VereinJoinView.swift` |
