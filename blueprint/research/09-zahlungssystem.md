# 09 – Zahlungssystem (Payment-Ingenieur-Report)

**Analysedatum:** 09.07.2026
**Analysierte Codebases:**
- iOS/macOS: `/Users/marcelgoldfuss/Apps/RollsportManager/rollsportmanager-ios-macos`
- Android: `/Users/marcelgoldfuss/Apps/RollsportManager/rollsportmanager-android`
- Backend/Web: `/Users/marcelgoldfuss/Apps/RollsportManager/rollsportmanager-backend`

---

## 1. Überblick

Das Zahlungssystem von RollsportManager besteht aus **drei getrennten Monetarisierungs-Ebenen**, die historisch nacheinander entstanden sind und nur lose integriert wurden:

1. **Benutzer-Abos (B2C, In-App-Purchase):** „Werbefrei/Premium" und „Unbegrenzt" — entfernen Werbung bzw. heben Küren-/Medien-Limits auf.
2. **Vereins-Lizenzen (B2B, Abo):** Pakete „Basis / Pro / Premium" nach Mitgliederzahl gestaffelt, mit 14-tägiger Testphase pro Verein.
3. **Beitragsverwaltung des Vereins (Payment-Facilitation):** Der Verein rechnet Mitgliedsbeiträge über die App ab — Rechnungen, Zahlungen, Ratenzahlung, SEPA-Export, Mahnwesen, Kassenbuch, Budget, Spendenbescheinigungen.

**Kernbefund:** Die fachliche Bandbreite ist beachtlich (Mahnwesen mit 5 Stufen, PAIN.008-SEPA-Export, DATEV-Export, Kassenwart-Rolle, Ratenpläne). Die **Geld-Pipeline selbst ist jedoch an fast jeder Stelle unfertig oder unsicher**: Es gibt keine serverseitige Kaufvalidierung, das Feature-Gating ist client- bzw. RLS-seitig umgehbar, die Kauf-zu-Freischaltung-Kette ist unterbrochen, drei widersprüchliche Preisquellen existieren parallel, und die Stripe-/PayPal-Checkouts sind auf allen Plattformen Stubs. Das Umsatzleck-Muster aus KetoTracker (Paywall nur im Client) existiert hier in **verschärfter Form**, weil zusätzlich die Datenbank-Policies die Selbst-Freischaltung erlauben.

---

## 2. Ist-Zustand im Detail

### 2.1 Preisstruktur — drei widersprüchliche Quellen

Es gibt **keine Single Source of Truth für Preise**. Drei Quellen nennen unterschiedliche Beträge:

| Quelle | User „Werbefrei" | User „Unbegrenzt" | Verein Basis | Verein Pro | Verein Premium |
|---|---|---|---|---|---|
| Website `www/pricing.html` (Z. 136–347) | 2 €/M | 5 €/M | 9 €/M bzw. 89 €/J | 29 €/M bzw. 290 €/J | 59 €/M bzw. 590 €/J |
| iOS `Models/PricingConfig.swift` | 1,99 €/M / 19,99 €/J | 4,99 €/M / 49,99 €/J | 19,99 €/M / 199,90 €/J | 39,99 €/M / 399,90 €/J | 79,99 €/M / 799,90 €/J |
| DB-Seed `migrations/20260122_license_payment_config.sql` (Z. 84–89) | – | – | 29 €/M / 290 €/J | 49 €/M / 490 €/J | 79 €/M / 790 €/J |

Der iOS-Client rendert Vereinspreise dynamisch aus der DB-Tabelle `license_packages` (gut), aber `PricingConfig.swift` enthält trotzdem hartkodierte, abweichende Preise („WICHTIG: Preise hier ändern, nicht in den Views!"), und die Website ist komplett entkoppelt. Kein Kunde kann verlässlich wissen, was das Produkt kostet.

Zusätzlich existiert eine **Gebühren-Weitergabe-Logik**: `payment_method_config` speichert pro Zahlungsmethode `fee_percent`/`fee_fixed_cents` (Apple 30 %, Stripe 2,9 %, SEPA 0,35 €, PayPal 2,9 % + 0,35 €), und `calculate_price_with_fees()` schlägt die Gebühren auf den Basispreis auf (`20260122_license_payment_config.sql`, Z. 145–174). Der Endpreis variiert also je Zahlweg — im iOS-Kaufsheet wird die günstigste Nicht-Apple-Methode mit „Beste Option" markiert (dazu 4.5).

### 2.2 iOS/macOS: StoreKit 2 (In-App-Purchases)

**Dateien:**
- `RollsportManager/Services/StoreKitManager.swift` — StoreKit-2-Manager, Produkt-IDs, Kauf, Restore, Transaction-Listener
- `RollsportManager/Models/PricingConfig.swift` — hartkodierte Preise/Produkt-IDs
- `RollsportManager/Views/Premium/PremiumUpgradeView.swift` — User-Abo-Paywall
- `RollsportManager/Views/Premium/LicenseSelectionView.swift` — Vereins-Lizenz-Auswahl nach Trial-Ablauf
- `RollsportManager/Configuration.storekit` — lokale StoreKit-Testkonfiguration

**Produkt-IDs:** `de.rollsportmanager.premium.monthly|yearly`, `de.rollsportmanager.unlimited.monthly|yearly` (User) und `de.rollsportmanager.verein.{basis|pro|premium}.{monthly|yearly}` (Verein).

**Befunde:**
- Der Kauf-Flow (`PremiumUpgradeView.purchaseProduct`, Z. 380–428) ruft nur `store.purchase(product)` auf. **Die vorhandenen Backend-Sync-Funktionen `activatePremium()` und `processPurchase()` (`SupabaseManager.swift` Z. 5866–5909) werden nirgends aufgerufen** (grep über das gesamte Projekt: null Aufrufer). Der Server erfährt vom Kauf nichts.
- Die Werbe-Abschaltung läuft aber serverseitig: `AdsManager.checkShouldShowAds()` (Z. 363–415) fragt `get_user_limits()` per RPC ab, das `users.is_premium` liest. Folge: **Ein zahlender „Werbefrei"-Kunde sieht weiterhin Werbung**, bis ein Super-Admin `is_premium` manuell setzt (dafür existieren Admin-Screens auf allen Plattformen, z. B. `AdminPremiumViewModel.kt`).
- Gleichzeitig prüft `MainView.hasUnlimitedAccess` (Z. 44–48) lokal `storeKitManager.hasUnlimited` — das Gating ist also **gemischt lokal/serverseitig und inkonsistent**.
- **Bug in `StoreKitManager.hasUnlimited` (Z. 277–285):** prüft nur `unlimitedMonthly`; Käufer des **Jahres-Abos** (`unlimitedYearly`) werden nicht als Unlimited erkannt. `isAdFree` hat denselben Fehler (nur `premiumMonthly`/`unlimitedMonthly`).
- **Vereins-Lizenz-Kauf via Apple** (`StoreKitManager.purchaseVereinLicense`, Z. 195–250): berechnet das Ablaufdatum **clientseitig** (`Calendar.date(byAdding:)`) und ruft dann `SupabaseManager.assignVereinLicense()` auf. Diese Funktion hat aber einen **Client-Guard `isSuperAdmin`** (`SupabaseManager.swift` Z. 3492–3495) — ein normaler Vereins-Admin, der die Zielgruppe des Kaufs ist, läuft in `notAuthenticated`. Der Fehler wird **gefangen und ignoriert**, die Apple-Transaktion trotzdem abgeschlossen („Transaktion trotzdem abschließen", Z. 230–233): **Der Kunde bezahlt, die Lizenz wird nie aktiviert.**
- Es gibt **keine App Store Server Notifications** und keinen Receipt-/JWS-Check im Backend. Renewals, Refunds, Grace Periods, Billing Retry: alles unbehandelt.

### 2.3 Android: keine Kaufmöglichkeit

- **Google Play Billing ist nicht integriert** (kein `BillingClient`, keine `billing`-Dependency in `app/build.gradle*`).
- `ui/components/AdBanner.kt` ist ein hauskodierter „Upgrade auf Premium"-Hinweisbanner (kein AdMob), Sichtbarkeit gesteuert über `currentUser?.isPremium != true` (`MainNavigation.kt` Z. 614) — reines Client-Flag aus der DB.
- Premium kann auf Android **nur durch Super-Admins manuell** vergeben werden (`AdminPremiumViewModel.kt` Z. 118–158 schreibt `is_premium`/`premium_type` direkt in `users`/`vereine`).
- Die Finanz-/Beitrags-UI ist dagegen weitgehend portiert: `ui/screen/dunning/DunningScreen.kt` (943 Zeilen), `ui/screen/payment/*` (InvoiceSettings, InvoiceDetail), `ui/screen/finance/FinanzenHubScreen.kt`, `FinanceExportScreen.kt`, `PaymentRepository.kt`.

### 2.4 Vereins-Lizenzen und Testphase

**Datenmodell (doppelt!):**
1. `vereine.trial_ends_at`, `vereine.license_package_id`, `vereine.license_expires_at`, `vereine.license_billing_cycle` — von `assignVereinLicense()` und der iOS-`Verein.hasActiveLicense`-Logik genutzt (`Models/Verein.swift` Z. 108–137).
2. `monetization_settings.verein_license_active|type|expires_at` (`migrations/20260109_monetization.sql` Z. 102–105) — **nur diese** wird von der serverseitigen Limit-Funktion `get_user_limits()` ausgewertet (Z. 216–221) und vom Beta-Tester-Flow (`20260216_verein_beta_tester.sql`) gesetzt.

Ein Apple-Lizenzkauf schreibt (wenn er denn durchginge, s. 2.2) in Modell 1 — **die Limits/Werbelogik liest aber Modell 2**. Die beiden Systeme sind nicht synchronisiert.

**Trial-Enforcement:** `MainView.checkTrialStatus()` (Z. 149–178) zeigt nach Trial-Ablauf einmal pro Session ein Sheet (`LicenseSelectionView`) — mit **„Später"-Button** frei wegklickbar. Es gibt **keinerlei serverseitige Sperre** nach Trial-Ablauf: RLS-Policies prüfen nirgends Lizenz- oder Trial-Status, `max_members` der Pakete wird nirgendwo erzwungen. Ein Verein kann nach der Testphase unbegrenzt gratis weiterarbeiten; einzige Konsequenz ist Werbung.

**Lizenz-Kaufsheet (iOS, `LicenseSelectionView.swift`):** bietet Apple Pay, Kreditkarte/Stripe, SEPA, PayPal, Überweisung an. Real funktioniert **nur Apple IAP** und „Überweisung" (= öffnet `mailto:support@rollsportmanager.de`, Z. 566–578). Stripe/SEPA/PayPal zeigen „bald verfügbar"-Fehlermeldungen (Z. 556–564).

### 2.5 Beitragsverwaltung (Vereinsfinanzen)

**Backend-Tabellen:**
- `verein_payment_config` (`migrations/20260111_payment_system.sql`): pro Verein PayPal-Client-ID/Secret, Stripe-Keys inkl. `stripe_secret_key` und `stripe_webhook_secret`, SEPA-Gläubiger-Daten, Überweisungs-Bankdaten — **Klartext in der DB**, lesbar für Admin+Moderator des Vereins (RLS-Policy in `ZAHLUNGSSYSTEM_STATUS.md` Z. 167–185).
- `invoices`, `payments`: deutsche Spaltennamen/Status (`betrag`, `status='offen'|'bezahlt'|'überfällig'`), während `docs/modules/10-PAYMENTS.md` ein englisches Schema (`amount`, `status='pending'`) dokumentiert — **Doku und Live-Schema divergieren**.
- `memberships`, `membership_categories` (Beitragskategorien mit Preis/Intervall/Altersgrenzen): in `docs/modules/10-PAYMENTS.md` dokumentiert, aber **in keiner Migration enthalten** — ad-hoc per psql angelegt (Schema-Drift).
- `ratenplaene` (Ratenzahlung): vom Portal (`www/portal/ratenzahlung.html` Z. 283) genutzt, **ebenfalls ohne Migration**.
- `budget_positionen`, `kassenbuchungen`, `mahnungen`, `spendenbescheinigungen` (`migrations/20260215_finance_tables.sql`) mit Kassenwart-Rolle (`20260122_add_kassenwart_role.sql`) — sauber mit RLS versehen.
- `license_packages`, `payment_method_config` (`20260122_license_payment_config.sql`).

**Zahlweg der Mitglieder heute:** Praktisch nur **Banküberweisung** (Bankdaten anzeigen + in Zwischenablage kopieren, `www/portal/payments.html` Z. 640–750). `payWithPayPal()`/`payWithStripe()` sind Alert-Stubs („wird vorbereitet", Z. 752–762). Der Verein/Kassenwart markiert Zahlungseingänge manuell als bezahlt (iOS `markInvoicePaid()` laut `ZAHLUNGSSYSTEM_STATUS.md` Z. 116).

**SEPA:** PAIN.008.001.02-XML wird **clientseitig generiert** — dupliziert in iOS (`Views/Finance/SEPAExportView.swift`, eigener `SEPAXMLGenerator`, Z. 433 ff.) und Web (`www/portal/sepa.html` Z. 374 ff.). Mandatsreferenzen werden als `MNDT-${user.id}` **erfunden** (sepa.html Z. 420); eine `sepa_mandate`-Tabelle mit echten Mandaten (Unterschrift, Datum, FRST/RCUR-Sequenz) existiert nicht (in `ZAHLUNGSSYSTEM_STATUS.md` Z. 223–229 als „nicht begonnen" gelistet).

**Rechnungsstellung:** `invoice_settings` pro Verein (Prefix, Jahr im Rechnungsnummernkreis, iOS `Models/InvoiceSettings.swift`, Android `InvoiceSettingsScreen.kt`) — auch diese Tabelle ohne Migration. Automatische, wiederkehrende Beitrags-Rechnungsläufe gibt es nicht; Rechnungen werden manuell erstellt.

### 2.6 Mahnwesen (Dunning)

- **iOS:** `Services/Finance/DunningService.swift` (431 Z.) — 5 Stufen (Zahlungserinnerung, 1.–3. Mahnung, Inkasso-Ankündigung) mit Default-Gebühren 0/5/10/15/25 € und Fristen-Logik (Z. 61–92); Eskalationsvorschlag nach Tagen überfällig (Z. 200–230). `DunningPDFGenerator.swift` erzeugt Mahn-PDFs lokal. UI: `Views/Finance/DunningView.swift` (1035 Z.).
- **Android:** `ui/screen/dunning/DunningScreen.kt` (943 Z.) — Parallelimplementierung.
- **Web:** `www/portal/mahnungen.html` (733 Z.) — schreibt Mahnungen direkt per Supabase-Client in die `mahnungen`-Tabelle (Z. 597 ff.).
- **Backend:** Tabelle `mahnungen` mit `mahnstufe` 1–3 (!), Gebühr, Verzugszinsen, Status (`20260215_finance_tables.sql` Z. 130–195). Achtung: DB erlaubt nur Stufen 1–3, die Clients kennen 5 Stufen (0–4) — Mapping-Konflikt.
- **Kein automatischer Mahnlauf:** Alles manuell vom Kassenwart angestoßen; die gesamte Stufen-/Gebühren-/Fristenberechnung liegt dreifach dupliziert in den Clients. Es gibt keinen Cron/Worker (in `workers/` liegt nur der Push-Worker) und keinen serverseitigen E-Mail-Versand der Mahnungen.

### 2.7 Zahlungsanbieter-Integration (Stripe/PayPal-Webhooks)

- `functions/stripe-webhook/index.ts` (346 Z.): verarbeitet `payment_intent.succeeded`, `checkout.session.completed`, `payment_intent.payment_failed`; markiert Rechnungen als bezahlt und legt `payments`-Einträge an, sendet Push. **Signaturprüfung ist optional**: Sie erfolgt nur, wenn das (vom Angreifer kontrollierte) Event-Metadata-Feld `verein_id` gesetzt ist UND der Verein ein `stripe_webhook_secret` hinterlegt hat (Z. 242–263). Ohne diese Bedingungen wird das Event **ungeprüft verarbeitet**.
- `functions/paypal-webhook/index.ts` (451 Z.): verifiziert via PayPal-Verify-API, **fährt aber bei fehlgeschlagener Verifikation ausdrücklich fort** („Wir fahren trotzdem fort – manche Events kommen ohne vollständige Headers", Z. 325–330).
- Beide Handler prüfen **nicht, ob der gezahlte Betrag dem Rechnungsbetrag entspricht** — eine 1-Cent-Zahlung (oder ein gefälschtes Event) setzt die Rechnung auf `bezahlt`.
- Keine Idempotenz über Event-IDs (nur `invoice.status === 'bezahlt'`-Check, race-anfällig), kein Event-Log.
- `PaymentManager.swift` (iOS, 572 Z.) ist ein SDK-Gerüst mit Platzhalter-Keys (`pk_test_XXXXX`, „Demo-Modus") gegen Endpunkte `/api/payments/create-payment-intent` etc., die **nur als README-Dokumentation existieren** (`SW/api/payments/README.md` — der Ordner enthält ausschließlich die README). Enthält sogar eine eigene Kreditkartenformular-Validierung (Luhn-Check) — für einen Flow, den es nicht gibt und der so nie PCI-konform wäre.

### 2.8 Feature-Gating: Client vs. Server (Umsatzleck-Analyse)

Serverseitig existiert eine gute Grundlage: `get_user_limits()` (SECURITY DEFINER, `20260109_monetization.sql` Z. 176–270, verfeinert in `20260215_trainer_limits.sql`) berechnet Limits/Werbestatus zentral, und `can_trainer_create_kuer_for_member()` wird vor Kür-Erstellung geprüft. **Aber die Entitlement-Daten, auf denen sie basiert, sind clientseitig beschreibbar:**

1. **`activate_premium()`-RPC ohne Kaufnachweis** (`20260109_monetization.sql` Z. 331–383, `GRANT EXECUTE ... TO authenticated`): Jeder eingeloggte User kann `activate_premium('premium_unlimited','ios','fake-tx', NULL, NULL)` aufrufen → `users.is_premium=true, premium_type='unlimited', premium_until=NULL` (= nie ablaufend). `process_purchase()` (Extra-Küren etc.) identisch — die Transaction-ID wird nur auf Duplikate geprüft, nie gegen Apple/Stripe validiert.
2. **RLS „Vereine: Eigene bearbeiten"** (`20251230_initial_schema.sql` Z. 328–329): Der Vereinsinhaber darf die gesamte `vereine`-Zeile updaten — inklusive `license_package_id`, `license_expires_at`, `trial_ends_at`, `is_premium`, `max_members`. **Selbst-Lizenzierung per einfachem PATCH-Request.**
3. **RLS „Monetization: Admins schreiben"** (`20260109_monetization.sql` Z. 147–156): Vereins-Admins/Moderatoren dürfen `monetization_settings` komplett schreiben — inklusive `verein_license_active=true`, `ads_enabled=false` und aller Limits. Damit hebeln sie exakt die Werte aus, die `get_user_limits()` als Wahrheit nimmt.
4. **Client-Kurzschlüsse:** `SupabaseManager.getUserLimits()` gibt für Moderator+ lokal `.unlimitedDefaults` zurück, ohne den Server zu fragen (Z. 5840–5846); `MainView.hasUnlimitedAccess` vertraut lokalem StoreKit-Status.
5. **Trial-/Lizenz-Ablauf** wird ausschließlich im Client geprüft (dismissbares Sheet, s. 2.4).

**Fazit:** Das Umsatzleck ist größer als bei KetoTracker: Dort war die Paywall „nur" im Client — hier kann sich der Kunde zusätzlich per API dauerhaft selbst freischalten, und der einzige real funktionierende Kaufweg (Apple IAP für Vereinslizenzen) aktiviert die Lizenz wegen des Super-Admin-Guards nicht einmal für zahlende Kunden.

### 2.9 Sicherheit der Zahlungsgeheimnisse

- `payment_method_config` enthält globale `api_key_secret` und `webhook_secret` (Stripe/PayPal). Die SELECT-Policy lautet `USING (get_current_user_id() IS NOT NULL)` (`20260122_license_payment_config.sql` Z. 113–115) — **jeder eingeloggte Benutzer kann die globalen Stripe-Secret-Keys über die REST-API auslesen** (der iOS-Client ruft `select()` ohne Spaltenfilter auf, `SupabaseManager.fetchPaymentMethodConfigs()` Z. 3542–3550).
- `verein_payment_config` liefert `stripe_secret_key`/`paypal_client_secret` an Admin- und Moderator-Clients aus (per Design, wird im Formular angezeigt: `www/admin/zahlungen.html` mit `togglePassword()`-Feldern, `Views/Verein/PaymentSettingsView.swift`).
- Secret-Keys gehören grundsätzlich nicht in client-lesbare Tabellen und nicht in Client-Apps.

### 2.10 Admin-Werkzeuge

- **Web-Admin** (`www/admin/`): `zahlungen.html` (globale Zahlungsmethoden + Gebührenrechner), Lizenz- und Premium-Verwaltung (Admin-Panel-Sektionen „Premium, Lizenzen, Zahlungen", nur für Admins laut Backend-`CLAUDE.md`).
- **iOS:** `Views/Admin/MonetizationSettingsView.swift`, `Views/Admin/PaymentMethodConfigView.swift`, `Views/Premium/…`; Super-Admin kann Pakete CRUDen (`SupabaseManager` Z. 3446–3537) und Trials setzen.
- **Android:** `AdminPremiumScreen.kt`, `MonetizationSettingsScreen.kt` — manuelle Premium-Vergabe.
- Beta-Vereine erhalten Gratis-Lizenzen über RPC (`20260216_verein_beta_tester.sql`).

---

## 3. Stärken

1. **Fachlich vollständiges Vereinsfinanz-Domänenmodell:** Rechnungen, Zahlungen, Beitragskategorien, Ratenpläne, Mahnwesen, Kassenbuch mit Saldo-Trigger, Budget-Soll/Ist, Spendenbescheinigungen mit Nummernkreis, Kassenwart-Rolle — das deckt reale deutsche Vereinsbedürfnisse ab und ist als Anforderungskatalog für v2 Gold wert (`20260215_finance_tables.sql`, `20260122_add_kassenwart_role.sql`).
2. **Serverseitige Limit-Funktion als Ansatz:** `get_user_limits()` bündelt Free/Premium/Vereinslizenz-Logik an einer Stelle und wird von iOS-Werbelogik und Kür-Limits konsumiert — die Architekturidee (zentrale Entitlement-RPC) ist richtig, nur die Datenbasis ist ungeschützt.
3. **StoreKit 2 korrekt im Kern:** Transaction-Listener, `currentEntitlements`, `checkVerified`, Restore (`StoreKitManager.swift`) — moderner API-Einsatz, brauchbare Basis.
4. **Dynamische Lizenzpakete aus der DB:** `license_packages` mit StoreKit-Produkt-ID-Mapping und Super-Admin-CRUD ist flexibler als hartkodierte Pakete.
5. **Transparente Gebührenlogik:** Die Idee, Zahlartgebühren offen auszuweisen und den Endpreis je Methode zu berechnen (`calculate_price_with_fees`), ist kundenfreundlich gedacht.
6. **Mahnwesen-UX auf allen Plattformen:** 5-stufige Eskalation mit Vorschlagslogik, PDF-Erzeugung, Statistiken — auf iOS, Android und Web vorhanden.
7. **Webhook-Grundgerüste existieren** (Stripe + PayPal Edge Functions mit Push-Benachrichtigung bei Zahlungseingang) und die PayPal-Verify-API-Anbindung ist prinzipiell richtig gewählt.
8. **SEPA-PAIN.008-Generierung** funktioniert formal (iOS + Web) — als Feature-Beweis, wenn auch am falschen Ort.

---

## 4. Schwächen / Altlasten

### Kritisch (Umsatz & Sicherheit)

1. **Selbst-Freischaltung per RPC:** `activate_premium`/`process_purchase` sind für alle `authenticated` ausführbar, ohne jegliche Receipt-Validierung (`20260109_monetization.sql` Z. 331–383, 427–430). Jeder User kann sich dauerhaft `premium_unlimited` geben.
2. **Selbst-Lizenzierung per RLS:** Vereinsinhaber dürfen `vereine` (inkl. `license_package_id`, `trial_ends_at`, `is_premium`) updaten (`20251230_initial_schema.sql` Z. 328–329); Vereins-Admins/Moderatoren dürfen `monetization_settings` (inkl. `verein_license_active`, `ads_enabled`) schreiben (`20260109_monetization.sql` Z. 147–156).
3. **Zahlende Kunden erhalten nichts:** (a) User-Abo-Kauf synchronisiert nie zum Server (kein Aufrufer von `activatePremium()`), Werbung bleibt an; (b) Vereinslizenz-Kauf via Apple scheitert am Super-Admin-Guard in `assignVereinLicense()` (`SupabaseManager.swift` Z. 3492–3495), Transaktion wird trotzdem finalisiert (`StoreKitManager.swift` Z. 222–235). Beides sind Support-/Refund-/Review-Zeitbomben.
4. **Webhooks fälschbar:** Stripe-Signaturprüfung optional (nur bei `metadata.verein_id` + hinterlegtem Secret, `stripe-webhook/index.ts` Z. 242–263), PayPal verarbeitet auch bei fehlgeschlagener Verifikation weiter (`paypal-webhook/index.ts` Z. 325–330). Kein Betragsabgleich, keine Idempotenz per Event-ID → unauthentifiziertes „Rechnung als bezahlt markieren" ist möglich.
5. **Secret-Leak:** Globale Stripe/PayPal-Secret- und Webhook-Keys sind für jeden eingeloggten User via `payment_method_config`-SELECT lesbar (`20260122_license_payment_config.sql` Z. 113–115); Vereins-Secrets liegen im Klartext und werden an Moderator-Clients ausgeliefert.
6. **App-Review-Risiko (Guideline 3.1.1 / Anti-Steering):** Das iOS-Kaufsheet bewirbt neben Apple IAP explizit günstigere externe Zahlwege inkl. „Apple erhebt 30 % Gebühren … Mit anderen Zahlungsmethoden sparst du diese Gebühren" und „Beste Option"-Badge (`LicenseSelectionView.swift` Z. 433–441, 480–497). Nach den KetoTracker-Erfahrungen mit Apple-Rejects ist das ein absehbarer Ablehnungs- bzw. Takedown-Grund.

### Strukturell

7. **Doppeltes Lizenz-Datenmodell:** `vereine.license_*` vs. `monetization_settings.verein_license_*` — Kauf schreibt in das eine, Limits lesen das andere (s. 2.4).
8. **Drei divergierende Preisquellen** (Website vs. iOS-Hardcode vs. DB-Seed, s. 2.1) plus Legacy-Reste (`premium_type 'basic'`, `verein_license_type 'small'/'large'`, `user_subscriptions.type 'verein_small'`).
9. **StoreKit-Entitlement-Bug:** Jahresabos werden von `hasUnlimited`/`isAdFree` nicht erkannt (`StoreKitManager.swift` Z. 277–285).
10. **Kein Abo-Lifecycle:** keine App Store Server Notifications, kein Play-Billing (Android kann gar nicht kaufen), keine Renewal-/Refund-/Grace-Period-Behandlung; `expires_at` wird clientseitig gerechnet.
11. **Checkout-Stubs überall:** Stripe/PayPal/SEPA im iOS-Sheet (Z. 556–564), im Portal (`payments.html` Z. 752–762) und `PaymentManager.swift` (Demo-Modus, nicht existente `/api/payments/*`-Endpunkte). Realer Zahlweg für Beiträge: nur manuelle Überweisung.
12. **Mahnwesen ohne Backend-Automatik:** Logik dreifach in Clients dupliziert (iOS/Android/Web), keine Cron-Eskalation, kein serverseitiger Versand; DB-Constraint (`mahnstufe` 1–3) passt nicht zu den 5 Client-Stufen.
13. **Schema-Drift:** `memberships`, `membership_categories`, `ratenplaene`, `invoice_settings` existieren ohne Migration; `invoices`/`payments` wurden per Ad-hoc-ALTERs geflickt (`ZAHLUNGSSYSTEM_STATUS.md` Z. 136–165); Doku (`docs/modules/10-PAYMENTS.md`) beschreibt ein anderes (englisches) Schema als die Live-DB (deutsch).
14. **SEPA ohne Mandate:** PAIN.008 wird clientseitig mit erfundenen Mandatsreferenzen erzeugt (`sepa.html` Z. 420); keine `sepa_mandate`-Tabelle, keine FRST/RCUR-Sequenzen, keine Pre-Notification — rechtlich so nicht einsetzbar.
15. **Gemischte Sprachen/Status-Enums** (`offen/bezahlt/überfällig` vs. `pending/paid/overdue`) und Umlaut-Spaltennamen (`sepa_gläubiger_id`) erschweren jede Integration.

---

## 5. Empfehlungen für v2

### 5.1 Grundarchitektur: Entitlements strikt serverseitig

- **Eine einzige Entitlement-Quelle:** Tabelle `entitlements` (user- und vereinsbezogen: `subject_type`, `subject_id`, `entitlement`, `source` [apple|google|stripe|manual|trial], `valid_until`, `provider_ref`), **nur durch `service_role`/Backend-Jobs beschreibbar**. Clients haben ausschließlich SELECT auf eigene Zeilen. Keine Premium-/Lizenz-Flags in `users`/`vereine`/`monetization_settings` mehr.
- **Gating in der API-Schicht erzwingen:** Limits (Mitgliederzahl je Lizenz, Küren, Speicher) in RPCs/Policies prüfen, nicht in SwiftUI/Compose. Client-Checks nur als UX-Vorstufe. Trial-Ablauf ⇒ serverseitiger Read-only-Modus (z. B. INSERT/UPDATE-Policies prüfen `has_active_license(verein_id)`), nicht nur ein wegklickbares Sheet.
- **Ein Preis-Katalog:** `products`-Tabelle als Single Source of Truth; Website, Apps und Store-Konfiguration (StoreKit-Konfig, Play-Produkte, Stripe Prices) werden daraus generiert/abgeglichen. Hartkodierte Preise wie `PricingConfig.swift` abschaffen.

### 5.2 Kaufabwicklung: RevenueCat für Mobile, Stripe für Web

- **RevenueCat** für iOS + Android User-Abos: löst mit einem Schlag Receipt-Validierung, Renewals/Refunds/Grace-Periods, Cross-Platform-Entitlements und liefert Webhooks, die der Backend-Job in die `entitlements`-Tabelle spiegelt. Für einen Solo-Entwickler mit 4 Plattformen deutlich robuster als Eigenbau; kostenlos bis 2.500 $ MTR. (Eigenbau-Alternative: App Store Server API v2 + Notifications v2 und Play Developer API + RTDN — realistisch nur, wenn RevenueCat-Abhängigkeit unerwünscht ist.)
- **Vereins-Lizenzen (B2B) über Stripe Billing im Web-Portal, nicht über Apple IAP:** Vereinslizenzen sind Organisations-Abos; Verkauf über die Website (Stripe Checkout + Customer Portal für Zahlungsmittel, Rechnungen, Kündigung) spart 30 % Apple-Provision, umgeht Guideline-3.1.1-Konflikte und ermöglicht Rechnungen mit USt. In den Apps: Lizenzstatus nur anzeigen; Kaufhinweise Apple-konform gestalten (kein Preisvergleich, keine „Spare die Apple-Gebühren"-Texte im IAP-Kontext — Lehre aus KetoTracker-Rejects).
- Die „Gebühren-Aufschlag je Zahlart"-Logik ersatzlos streichen — ein Preis pro Paket, Zahlartkosten sind Kalkulationssache.

### 5.3 Mitgliedsbeiträge: Stripe Connect statt eigener Key-Verwaltung

- **Stripe Connect (Standard/Express) pro Verein:** Der Verein onboardet sich selbst (KYC durch Stripe), Beiträge fließen direkt aufs Vereinskonto, optional App-Plattformgebühr pro Transaktion (neue Einnahmequelle statt Lizenz-only). Damit entfallen: Klartext-Secrets pro Verein in der DB, Moderator-Zugriff auf Keys, eigene PayPal-Webhook-Pflege.
- **SEPA-Lastschrift über Stripe SEPA Direct Debit oder GoCardless** — inklusive echtem Mandats-Management (Speicherung, Sequenzen, Pre-Notification). Falls Vereine weiterhin „Bank-eigene" Einzüge wollen: `sepa_mandate`-Tabelle + serverseitige PAIN.008-Generierung als Zusatz-Export, nie clientseitig mit erfundenen Mandats-IDs.
- Banküberweisung als Fallback behalten, aber mit **EPC-QR-Code (GiroCode)** und Referenz-Abgleich (CAMT-Import oder manuelles Matching-UI) aufwerten.

### 5.4 Webhooks & Zahlungs-Pipeline härten

- Ein zentraler Webhook-Service mit: **verpflichtender Signaturprüfung** (Stripe-Signatur aus Server-Env, nie aus DB/Metadata; PayPal-Verify hart fehlschlagen lassen), **Idempotenz über Event-ID-Tabelle**, **Betragsabgleich gegen Rechnung**, Event-Log für Audit, und Status-Maschine `open → processing → paid/failed/refunded` (Teilzahlungen berücksichtigen).
- Keine `Access-Control-Allow-Origin: *`-CORS auf Webhook-Endpunkten; Webhooks sind Server-zu-Server.

### 5.5 Beitragsverwaltung & Mahnwesen serverseitig automatisieren

- **Beitragsläufe als Backend-Job:** Beitragsordnung (Kategorien, Familienrabatte, anteilige Beiträge bei Eintritt, Stichtage) ⇒ automatischer Rechnungslauf (monatlich/jährlich) mit Nummernkreis pro Verein, PDF-Erzeugung serverseitig, Zustellung per E-Mail/Push.
- **Mahnwesen als Cron (pg_cron/Edge-Scheduler):** konfigurierbare Eskalationsmatrix pro Verein (Stufen, Fristen, Gebühren, Verzugszinsen), automatischer Versand, Gebühr als Rechnungsposition verbucht; einheitliches Stufen-Enum in DB und Clients (heute 1–3 vs. 0–4). Clients zeigen nur noch an.
- Ratenpläne, Spendenbescheinigungen, Kassenbuch und DATEV-/SEPA-Exporte aus v1 fachlich übernehmen — aber mit Migrationen versioniert, englischem konsistentem Schema und serverseitiger Generierung.

### 5.6 Aufräumarbeiten / Nicht mitnehmen

- `PaymentManager.swift` (Demo-Stripe-SDK mit eigener Kartenformular-Validierung) komplett verwerfen — Kartendaten gehören ausschließlich in Stripe-Elements/Payment-Sheet (PCI).
- Doppeltes Lizenzmodell, `payment_method_config`-Secrets, `activate_premium`/`process_purchase`-RPCs, Gebührenaufschlags-Funktionen: nicht migrieren.
- Status-/Spaltennamen vereinheitlichen (englisch, ASCII), UI-Strings lokalisiert DE/EN (mit korrekten Umlauten).
- Preise beim Launch v2 einmalig festlegen (Empfehlung: die kommunizierten Website-Preise 9/29/59 € als Anker, User-Abos 1,99/4,99 € via Store) und überall aus dem Katalog rendern.

### 5.7 Priorisierung für v2

| Prio | Maßnahme |
|---|---|
| P0 (sofort, auch für v1-Bestand) | RPC-Grants für `activate_premium`/`process_purchase` entziehen; RLS auf `vereine`/`monetization_settings` spaltenrestriktiv machen; `payment_method_config`-SELECT auf Nicht-Secret-Spalten begrenzen; Webhook-Signaturen erzwingen |
| P1 | Entitlement-Service + RevenueCat (User-Abos iOS/Android) + Stripe Billing (Vereinslizenzen Web) |
| P2 | Stripe Connect für Mitgliedsbeiträge, Rechnungs-/Mahnläufe serverseitig |
| P3 | SEPA-Mandate/GoCardless, DATEV-Export serverseitig, EPC-QR, Teilzahlungs-/Raten-Engine |

---

## 6. Datei-Index (wichtigste Referenzen)

| Bereich | Pfad |
|---|---|
| Status-Doku | `rollsportmanager-backend/ZAHLUNGSSYSTEM_STATUS.md` |
| Modul-Doku | `rollsportmanager-backend/docs/modules/10-PAYMENTS.md` |
| Monetarisierung/RPCs | `rollsportmanager-backend/migrations/20260109_monetization.sql` |
| Vereins-Zahlungskonfig, invoices/payments | `rollsportmanager-backend/migrations/20260111_payment_system.sql` |
| Lizenzpakete + Zahlartgebühren | `rollsportmanager-backend/migrations/20260122_license_payment_config.sql` |
| Finanz-Tabellen (Mahnungen, Kassenbuch, Spenden, Budget) | `rollsportmanager-backend/migrations/20260215_finance_tables.sql` |
| Trainer-Limits | `rollsportmanager-backend/migrations/20260215_trainer_limits.sql` |
| Stripe-Webhook | `rollsportmanager-backend/functions/stripe-webhook/index.ts` |
| PayPal-Webhook | `rollsportmanager-backend/functions/paypal-webhook/index.ts` |
| Portal: Zahlungen/Mahnungen/Raten/SEPA | `rollsportmanager-backend/www/portal/{payments,mahnungen,ratenzahlung,sepa,payment-methods,invoice-detail,finance-export}.html` |
| Admin: Zahlungsmethoden | `rollsportmanager-backend/www/admin/zahlungen.html` |
| Website-Preise | `rollsportmanager-backend/www/pricing.html` |
| iOS StoreKit | `rollsportmanager-ios-macos/RollsportManager/Services/StoreKitManager.swift` |
| iOS Preise (hartkodiert) | `rollsportmanager-ios-macos/RollsportManager/Models/PricingConfig.swift` |
| iOS Paywalls | `rollsportmanager-ios-macos/RollsportManager/Views/Premium/{PremiumUpgradeView,LicenseSelectionView}.swift` |
| iOS Lizenz-/Payment-API | `rollsportmanager-ios-macos/RollsportManager/Services/SupabaseManager.swift` (Z. 3440–3600, 5840–5950) |
| iOS Mahnwesen | `rollsportmanager-ios-macos/RollsportManager/Services/Finance/{DunningService,DunningPDFGenerator}.swift`, `Views/Finance/DunningView.swift` |
| iOS SEPA | `rollsportmanager-ios-macos/RollsportManager/Views/Finance/SEPAExportView.swift` |
| iOS Stripe/PayPal-Stub | `rollsportmanager-ios-macos/RollsportManager/Services/PaymentManager.swift`, `SW/api/payments/README.md` |
| iOS Werbung | `rollsportmanager-ios-macos/RollsportManager/Services/AdsManager.swift` |
| Android Finanzen | `rollsportmanager-android/app/src/main/java/de/rollsportmanager/app/ui/screen/{dunning/DunningScreen.kt,payment/,finance/}` |
| Android Premium-Admin | `rollsportmanager-android/.../ui/viewmodel/AdminPremiumViewModel.kt`, `ui/components/AdBanner.kt` |
