# RollsportManager v2 — Restfunktionen (was noch fehlt)

Abgleich v1 (~75 Portal-Seiten + 21 Admin-Seiten) gegen v2. Das Top-Level-„Mehr"-Raster ist
gebaut, aber viele **Tiefen-Funktionen und ganze Unterbereiche** fehlen noch. Diese Liste wird
abgearbeitet und aktuell gehalten. `[ ]` = offen, `[~]` = teilweise da, `[x]` = fertig.

## 1. Finanz-Tiefe (GRÖSSTER Block — v1-Stärke)
- [x] Rechnungen: Liste + Detail-Sheet (Empfänger, Positionen, EPC-QR, Verlauf) + Erstellen + Stornieren + Als-bezahlt-markieren (Finanz-Tiefe A, gegen Dev-API verifiziert)
- [x] Kassenbuch: vollwertiges Kassenbuch — Buchen (Einnahme/Ausgabe), Kategorien, laufender Saldo, Storno/Gegenbuchung, Filter, GoBD-Hinweis (Finanz-Tiefe A)
- [~] Mahnwesen: Freigabe-Workflow komplett — Ampel-Stufen 0–3, Mahnlauf-Vorschau (Dry-Run), Stufe-2+-Einzelfreigabe (Default gesperrt), Apply + unveränderliches Mahnprotokoll, E-Mail-Vorschau; realer Mahn-Mailversand noch offen
- [x] Jahresabschluss: Geschäftsjahr-Auswahl, Netto-Ergebnis, KPIs (Einnahmen/Ausgaben/Spenden/offene Posten), Einnahmen-/Ausgaben-Aufschlüsselung nach Kategorie, Vorjahresvergleich, CSV-/DATEV-Export-Buttons — Finanz-Tiefe C, gegen Dev-API als Kassenwart verifiziert (Screenshot), Mitglied 403/„Kein Zugriff"
- [x] Bankabgleich (echt, mit Zuordnung): Umsatz-Liste (Datum/Betrag ±/Zweck/Gegenpartei/Status), Fortschritt + Status-Filter, Zuordnen-Sheet (Rechnungs-Vorschlag + „bezahlt buchen & Kassenbuch-Einnahme" + Kategorie), Ignorieren, manuelles Erfassen, CSV-Import — Finanz-Tiefe C, über die Facade (mock+api), als Kassenwart verifiziert (Screenshot), Mitglied 403/„Kein Zugriff"
- [x] Finance-Export / DATEV / Berichte-Export: `GET /export/ledger.csv` (GoBD-Kassenbuch) + `GET /export/datev` (DATEV-nahe Buchungen), text/csv mit Content-Disposition + UTF-8-BOM, can_manage_finance-gated (Mitglied 403); echter Bearer-Blob-Download aus Jahresabschluss verifiziert (curl: Content-Type text/csv + Inhalt)
- [x] Beitragsverwaltung: Beitragskategorien (Tarife/Perioden, Anlegen/Bearbeiten/Löschen) + Mitgliedsbeiträge (Zuordnen/Ändern/Entfernen, effektiver Betrag, SEPA-Status, Jahresvolumen 1.176,00 €) + Familien-/Geschwisterrabatte (Stammdaten) — Finanz-Tiefe B, gegen Dev-API als Kassenwart verifiziert, RLS-gegatete Mitglied-Sicht (nur eigene Zuordnung, Management-Seiten 403 für Mitglied); member-facing „Meine Mitgliedschaft"-Selfview + automatische Rabatt-Anwendung auf Rechnungen noch offen
- [~] Zahlungen: SEPA-Lastschrift/Mandate — erfassen + widerrufen (Bestätigungs-Dialog), nur iban_last4 + Mandatsreferenz gespeichert (keine volle IBAN im Klartext), Finanz-Tiefe B verifiziert; payments, payment-methods, payment-detail, ratenzahlung, CAMT/XML-Lastschrift-Export noch offen
- [x] Spendenbescheinigungen (spenden): Zuwendungs-Liste + KPIs (Spendensumme/ausgestellt/Entwürfe), Spende erfassen, §10b-Zuwendungsbescheinigung anzeigen/drucken/ausstellen (nach Ausstellen GoBD-eingefroren, race-freie Bescheinigungsnummer) — Finanz-Tiefe C, als Kassenwart verifiziert (Screenshot), Mitglied 403/„Kein Zugriff"; Budget + Ausgaben noch offen
- [x] Finanz-Hub-Gating: Hub zeigt Nicht-Finanz-Rollen NUR die schlanke „Meine Rechnungen"-Sicht (eigene Rechnungen via memberId, Entwürfe ausgeblendet, Offen-Summe) — alle Verwaltungs-Karten (Bankabgleich/Jahresabschluss/Spenden/…) für sie ausgeblendet; Hub-Kacheln + Routen only can_manage_finance, Durchsetzung serverseitig (RLS/403). Als Mitglied verifiziert (Screenshots). Offen bleibt nur die beitragsspezifische „Meine Mitgliedschaft"-Selfview + automatische Rabatt-Anwendung (siehe Beitragsverwaltung)

## 2. Organisation
- [x] Teams-Mitgliedersicht (teams): lesende „Meine Teams"-/„Alle Teams im Verein"-Ansicht wie v1 — Trainerstab + Mitglieder-Avatare + Kaderzahl je Team, Nur-Lese-Hinweis (Anlegen/Kader = Vereinsleitung unter „Verwaltung"), über die Facade (getTeams/getMembers/getCurrentUser), is_club_member lesend. Gegen Dev-API verifiziert (Screenshot), Mehr-Hub-Kachel „Neu". (Der bestehende Verwaltungs-Bereich /verwaltung/teams bleibt für Anlegen/Kader.)
- [x] Abteilungen (abteilungen): Liste + Anlegen/Bearbeiten/Löschen (is_club_admin) + Mitglieder-Zuordnung per Sheet mit Suche/Auswahl (is_club_trainer), Leitung/Beschreibung/Sortierung, über die Facade (mock+api). Migration 0017, Routen /departments (+/members), RLS + protect-Trigger. Gegen Dev-API als Vorstand (owner) verifiziert (Screenshot Liste + Mitglieder-Sheet); Mitglied liest, Verwaltungs-/Zuordnungs-Aktionen serverseitig 403 (curl belegt: member/coach POST→403, admin→201, coach PUT members→200).
- [x] Schließfächer (schliessfaecher): Liste mit Status-Filter (Alle/Frei/Belegt/Defekt) + Stammdaten Anlegen/Bearbeiten/Löschen + Defekt-/Repariert-Meldung (is_club_admin) + Zuordnen/Umbuchen/Freigeben per Sheet mit Mitglieder-Suche (is_club_trainer), über die Facade (mock+api). Migration 0017, Routen /lockers (+/assign,/release), RLS + protect_locker-Trigger. Gegen Dev-API als owner verifiziert (Screenshot Liste + Zuordnen-Sheet); Mitglied liest nur (0 Verwaltungs-Buttons), Schreibpfade serverseitig 403 (curl: assign coach→200/member→403).
- [ ] Wartelisten (warteliste) — Tabelle existiert, kein UI
- [x] Jubiläen (jubilaeen): chronologische „Jubiläen & Meilensteine"-Ansicht der nächsten 12 Monate — Vereinsjubiläen (runde Mitgliedsjahre) + runde Geburtstage, „Als nächstes"-Banner, Filter (Alle/Vereinsjubiläen/Geburtstage), Monatsgruppierung + Countdown, rein lesend über die Facade (getAnniversaries → GET /reports/anniversaries), is_club_member. Gegen Dev-API verifiziert (Screenshot), Mehr-Hub-Kachel „Neu".
- [ ] Mehrvereins-Onboarding: verein-create, verein-join, Verein-Wechsler „Verwaltest: X"

## 3. Wettkampf-Tiefe
- [~] Wettkampf: Übersicht + Live-Vorschau da, aber wettkampf-live/wettkampf-modus (echtes Live-Scoring) fehlt
- [ ] Verbandsmeldung (verbandsmeldung)
- [ ] Kür teilen (kuer-share), training-hub, trainingsplanung

## 4. App-Shell & UX (fällt beim Klicken sofort auf)
- [x] Profil-Seite (profil) — eigenes Profil ansehen/bearbeiten (Vorname/Nachname/E-Mail/Geburtsdatum) über die Facade (`data.updateMyProfile` → `PATCH /me`), self-scoped serverseitig (WHERE profile_id = auth.uid(), Rolle/Status nicht änderbar). Konto-Karte (Anmelde-E-Mail, Passwort-Hinweis). Verlinkt im Topbar-Benutzermenü. Gegen Dev-API als coach + member verifiziert (Screenshots), member kann NUR eigenes Profil ändern (Role-Escalation vom Update-Schema verworfen → 400), fremdes nicht. Foto-Upload noch offen.
- [x] Einstellungen (einstellungen) — Sprache (DE/EN), Erscheinungsbild (Hell/Auto/Dunkel), Benachrichtigungs-Schalter (Termine/Rechnungen/Neuigkeiten/Chat) über die Facade (`getMyPreferences`/`updateMyPreferences` → `GET/PATCH /me/preferences`, user_preferences nur eigener Nutzer). Gegen Dev-API verifiziert (Screenshot). email-settings/dashboard-settings/backup noch offen; App-Boot-Hydration der Server-Präferenz (localStorage-first) offen.
- [x] Benachrichtigungen (Glocke oben rechts) — funktionaler Feed mit Ungelesen-Zähler + „Alle gelesen", rollen-gescopt über die Facade-Reads (`deriveNotifications`), Leerzustand/Skeletons, DE+EN. Gelesen-Zustand clientseitig (localStorage). Gegen Dev-API als coach + member verifiziert (Screenshots, unterschiedliche Feeds). Live-Push/Polling + Chat-Quelle noch offen.
- [x] Suche (Suchleiste oben / ⌘K) — funktionale Befehls-/Suchpalette (Overlay), live-gruppierte Treffer (Mitglieder/Termine/Küren/Neuigkeiten) über `searchAll()`, Tastatur-Navigation (Pfeile/Enter/Esc), respektiert RLS über die Facade-Reads. Gegen Dev-API als coach + member verifiziert (Screenshot „Grün" → Mitglieder; member sieht RLS-gescopt nur eigene Familie).
- [ ] Favoriten (favoriten)
- [ ] Registrierung/Onboarding (aktuell nur Dev-Login-Personas)

## 5. Plattform-Admin-Konsole (voll)
- [~] /super hat Vereine/Nutzer/Stats — es fehlen: Lizenzen, Zahlungen, invoice-management, Monetarisierung/Premium, E-Mail-Versand, Content/SEO/Legal, System/Server-Settings, Beta, Demo-Data

## 6. Sub-Features in bereits gebauten Modulen (aus den Bau-„offene Punkte")
- [ ] Belegungsplan: Buchung bearbeiten, mehrtägige Buchungen, stornierte ausblenden
- [ ] Ausrüstung: serverseitige Bestandsverrechnung, Reservierungs-Konflikte
- [ ] Chat: Live-Aktualisierung (Realtime/Polling), Bild-Upload, Voice-to-Text (v1-Feature)
- [ ] Check-in: echter QR-Scan (Kamera), Check-out
- [ ] Familie: Kind verknüpfen/anlegen (bisher nur lesend)
- [ ] Notizen: Inline-Bearbeiten; Galerie: Video-Poster-Upload
- [ ] Mitglied-Self-Service (eigenes Profil bearbeiten für Nicht-Trainer)

## 7. Plattform-Parität (ERST NACH kompletter Web-Fertigstellung!)
Reihenfolge strikt: **Web 100 % → iPhone/iPad → Android → Watch/Widgets.** Kein paralleles Springen.
- [~] iOS: Batch 1 fertig (Mehr-Hub + News/Chat/Medaillen/Trainingsplan) — Rest PAUSIERT bis Web komplett
- [ ] Android: unfertig + Emulator-Image blockiert — später
- [ ] Watch/Widgets — später

## 8. Nicht-Feature, aber wichtig
- [ ] Echte Zahlungen (Stripe-Checkout/RevenueCat) statt Gerüst
- [ ] Deployment/Prod-Cutover + Daten-ETL aus v1
- [ ] Phase-0-Sicherheit der laufenden v1-Produktion

---
**VERBINDLICHE REIHENFOLGE (auf Marcels Ansage, kein Durcheinander):**
Zuerst WEB komplett fertig — Cluster 1→6 der Reihe nach: 1 Finanz-Tiefe (A läuft, dann B) → 4 App-Shell →
2 Organisation → 3 Wettkampf-Tiefe → 5 Admin-Konsole → 6 Sub-Features in gebauten Modulen.
**Erst wenn WEB zu 100 % steht:** 7 Plattformen der Reihe nach (iPhone/iPad → Android → Watch).
Danach 8 (echte Zahlungen, Deployment, v1-Security). Jeder Cluster gebaut + von mir selbst geprüft.
