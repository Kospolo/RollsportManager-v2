# RollsportManager v2 — Restfunktionen (was noch fehlt)

Abgleich v1 (~75 Portal-Seiten + 21 Admin-Seiten) gegen v2. Das Top-Level-„Mehr"-Raster ist
gebaut, aber viele **Tiefen-Funktionen und ganze Unterbereiche** fehlen noch. Diese Liste wird
abgearbeitet und aktuell gehalten. `[ ]` = offen, `[~]` = teilweise da, `[x]` = fertig.

## 1. Finanz-Tiefe (GRÖSSTER Block — v1-Stärke)
- [x] Rechnungen: Liste + Detail-Sheet (Empfänger, Positionen, EPC-QR, Verlauf) + Erstellen + Stornieren + Als-bezahlt-markieren (Finanz-Tiefe A, gegen Dev-API verifiziert)
- [x] Kassenbuch: vollwertiges Kassenbuch — Buchen (Einnahme/Ausgabe), Kategorien, laufender Saldo, Storno/Gegenbuchung, Filter, GoBD-Hinweis (Finanz-Tiefe A)
- [~] Mahnwesen: Freigabe-Workflow komplett — Ampel-Stufen 0–3, Mahnlauf-Vorschau (Dry-Run), Stufe-2+-Einzelfreigabe (Default gesperrt), Apply + unveränderliches Mahnprotokoll, E-Mail-Vorschau; realer Mahn-Mailversand noch offen
- [ ] Jahresabschluss
- [ ] Bankabgleich (echt, mit Zuordnung) — bisher Demo
- [ ] Finance-Export / DATEV / Berichte-Export
- [x] Beitragsverwaltung: Beitragskategorien (Tarife/Perioden, Anlegen/Bearbeiten/Löschen) + Mitgliedsbeiträge (Zuordnen/Ändern/Entfernen, effektiver Betrag, SEPA-Status, Jahresvolumen 1.176,00 €) + Familien-/Geschwisterrabatte (Stammdaten) — Finanz-Tiefe B, gegen Dev-API als Kassenwart verifiziert, RLS-gegatete Mitglied-Sicht (nur eigene Zuordnung, Management-Seiten 403 für Mitglied); member-facing „Meine Mitgliedschaft"-Selfview + automatische Rabatt-Anwendung auf Rechnungen noch offen
- [~] Zahlungen: SEPA-Lastschrift/Mandate — erfassen + widerrufen (Bestätigungs-Dialog), nur iban_last4 + Mandatsreferenz gespeichert (keine volle IBAN im Klartext), Finanz-Tiefe B verifiziert; payments, payment-methods, payment-detail, ratenzahlung, CAMT/XML-Lastschrift-Export noch offen
- [ ] Spendenbescheinigungen (spenden), Budget, Ausgaben

## 2. Organisation
- [~] Teams: eigener Verwaltungs-Bereich da, aber kein Mitglieder-Team-Screen „Meine Teams" wie v1
- [ ] Abteilungen (abteilungen)
- [ ] Schließfächer (schliessfaecher)
- [ ] Wartelisten (warteliste) — Tabelle existiert, kein UI
- [ ] Jubiläen (jubilaeen)
- [ ] Mehrvereins-Onboarding: verein-create, verein-join, Verein-Wechsler „Verwaltest: X"

## 3. Wettkampf-Tiefe
- [~] Wettkampf: Übersicht + Live-Vorschau da, aber wettkampf-live/wettkampf-modus (echtes Live-Scoring) fehlt
- [ ] Verbandsmeldung (verbandsmeldung)
- [ ] Kür teilen (kuer-share), training-hub, trainingsplanung

## 4. App-Shell & UX (fällt beim Klicken sofort auf)
- [ ] Profil-Seite (profile) — eigenes Profil ansehen/bearbeiten, Foto
- [ ] Einstellungen (settings) inkl. notification-settings, email-settings, dashboard-settings, backup
- [ ] Benachrichtigungen (Glocke oben rechts ist Deko — kein Feed)
- [ ] Suche (Suchleiste oben ist Deko — keine Funktion)
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
