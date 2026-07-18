# ORIGINAL-VOLLREFERENZ — was die v1 wirklich kann

**Zweck:** Damit niemand das Original noch einmal erklären muss. Diese Datei ist die
dauerhafte Nachschlage-Quelle für alles, was die alte App (v1) konnte — besonders für
alles, was **Geld kostet, begrenzt ist oder zugebucht werden kann**. Wer in v2 etwas baut,
schlägt hier nach, statt zu raten.

**Stand:** 2026-07-18. Erstellt aus einer vollständigen Durchsicht der v1 durch sieben
Leser (iOS-Funktionen, iOS-Geld/Limits, DB-Schema, DB-Regeln, Web-Portal, Android, Doku).

**Quellen (v1, strikt nur gelesen — nichts geändert, nichts gestartet):**

- `/Users/marcelgoldfuss/Apps/RollsportManager/rollsportmanager-ios-macos` — SwiftUI iOS + macOS + Watch + Widget (reichste Quelle, laut Chef-Doku die Referenz)
- `/Users/marcelgoldfuss/Apps/RollsportManager/rollsportmanager-android` — Kotlin/Compose
- `/Users/marcelgoldfuss/Apps/RollsportManager/rollsportmanager-backend` — Supabase-Migrationen/SQL + `www/` (öffentliche Website, Portal, Betreiber-Admin)

**Vergleichsstand v2:** Migrationen bis `0068_zubuchbare_module.sql`.

**Lesehinweis:** Jede Aussage hat eine Fundstelle `datei:zeile`. Wo die v1 sich selbst
widerspricht (das kommt öfter vor, als man denkt), steht das ausdrücklich da — dann muss
der Chef entscheiden, nicht der Entwickler raten.

---

## 1. Das Geschäftsmodell der v1 in einfachen Worten

Die v1 hat **zwei völlig getrennte Geldkreisläufe**. Wer die verwechselt, baut v2 falsch.

### Kreislauf A — der App-Entwickler verdient (Plattform-Umsatz)

Drei Erlösquellen nebeneinander:

1. **Werbung.** Kostenlose Nutzer sehen Werbung: unten ein Dauer-Banner und nach dem
   Abspielen einer Kür eine Vollbild-Werbung. Auf iOS ist das echtes Google AdMob im
   Produktivbetrieb (`Services/AdsManager.swift:20,37`), im Web-Portal Google AdSense
   (`www/assets/js/ads.js:9-17`), auf Android nur ein Eigenwerbe-Banner (kein AdMob,
   `ui/components/AdBanner.kt:25-73`). Wörtlich in der App: „Einnahmen aus Werbung gehen
   an den App-Entwickler." (`Views/Admin/MonetizationSettingsView.swift:95`)
2. **Persönliche Abos** der Mitglieder (In-App-Kauf über Apple, oder per Stripe/PayPal im
   Web-Portal). Stufen: *Premium* (nur werbefrei) und *Unbegrenzt* (werbefrei + keine
   Limits). Wörtlich: „Einnahmen gehen an den App-Entwickler (abzüglich 30 % Apple-Anteil)."
   (`MonetizationSettingsView.swift:199`)
3. **Vereins-Lizenzen.** Der Verein kauft ein Paket, gestaffelt nach Mitgliederzahl —
   dann werden **alle seine Mitglieder automatisch Premium** und die Werbung ist weg
   (`migrations/20260215_trainer_limits.sql:83-84,122`).

**Testphase:** Jeder neue Verein bekommt automatisch **14 Tage** kostenlos und werbefrei
(`Services/SupabaseManager.swift:1058-1059`, `Models/Verein.swift:132`). Danach erscheint
1 Sekunde nach App-Start ein Zwangsdialog zur Paketwahl — nur für Moderator und höher,
nie für den Super-Admin (`Views/MainView.swift:150-178`).

**Besonderheit, die man leicht übersieht:** Die Zahlungs-Gebühren werden **offen auf den
Preis aufgeschlagen**, und die App empfiehlt aktiv den Weg an Apple vorbei: „Apple erhebt
30 % Gebühren für In-App-Käufe. Diese werden transparent weitergegeben. Mit anderen
Zahlungsmethoden sparst du diese Gebühren." (`Views/Premium/LicenseSelectionView.swift:489`);
die günstigste Methode wird als „Beste Option" markiert (`:434`). Das ist eine bewusste
Entscheidung — und zugleich ein App-Store-Review-Risiko, das v2 kennen muss.

### Kreislauf B — der Verein verdient an seinen Mitgliedern (Vereinsfinanzen)

Mitgliedsbeiträge mit Kategorien und Intervallen, Rabatte, Rechnungen mit MwSt,
Zahlungen, dreistufiges Mahnwesen, Ratenzahlung, SEPA, Spendenbescheinigungen,
Kassenbuch, Budget, Jahresabschluss, DATEV-Export — **und zwei Posten, die man vergisst,
weil sie nicht nach „Preis" aussehen:**

- **Schließfach-Miete** (siehe Abschnitt 3.1)
- **Pflichtstunden-Ablöse**: nicht geleistete Stunden werden in Euro abgerechnet
  (`migrations/20260213_fix_pflichtstunden_function.sql:38-41`)

Dieses Geld fließt an den Verein, nicht an den Entwickler.

### Wo die Limits herkommen

Die geltenden Limits liefert zur Laufzeit **eine Datenbank-Funktion**, nicht der App-Code:
`get_user_limits()` (`migrations/20260109_monetization.sql:176-270`, überschrieben und
damit gültig in `migrations/20260215_trainer_limits.sql:42-146`). Die Werte selbst stehen
in `monetization_settings` — **pro Verein einstellbar**, nicht global. Der Vereins-Admin
darf seine Free-Limits selbst hoch- oder runterdrehen und die Werbung für seine Mitglieder
abschalten (`Views/Admin/MonetizationSettingsView.swift:81,100-163`).

**Rangfolge:** Vereinslizenz → Premium unbegrenzt → Premium basic → Free; danach
überschreibend Moderator/Admin = unbegrenzt (`20260215_trainer_limits.sql:86-110`).
„Unbegrenzt" ist technisch die Zahl **999999**.

---

## 2. Preis- und Limit-Tabelle (alles, was Geld kostet oder begrenzt ist)

### 2.1 Persönliche Abos (Endnutzer → Entwickler)

| Produkt | Preis | Produkt-ID | Fundstelle |
|---|---|---|---|
| Premium monatlich (nur werbefrei) | **1,99 €** | `de.rollsportmanager.premium.monthly` | `Models/PricingConfig.swift:19-21`, Android `config/PricingConfig.kt:18-20` |
| Premium jährlich („Spare 2 Monate") | **19,99 €** | `…premium.yearly` | `PricingConfig.swift:24-26` |
| Unbegrenzt monatlich | **4,99 €** | `…unlimited.monthly` | `PricingConfig.swift:29-31` |
| Unbegrenzt jährlich | **49,99 €** | `…unlimited.yearly` | `PricingConfig.swift:34-36` |

⚠️ **Widerspruch:** Die öffentliche Website nennt **2 €** und **5 €**
(`www/pricing.html:179,207`), ebenso die Betreiber-MRR-Rechnung
(`www/admin/monetization.html:219,225,327`). Die StoreKit-Testdatei kennt sogar eine
Produkt-ID `de.rollsportmanager.adfree.monthly`, die es im Code nicht gibt
(`RollsportManager/Configuration.storekit`). **Was bei Apple real angelegt ist: unklar.**

### 2.2 Vereins-Lizenzen (Verein → Entwickler) — **vier verschiedene Preisstände**

| Quelle | Basis / Starter | Pro / Standard | Premium / Enterprise |
|---|---|---|---|
| **Datenbank-Seed** (maßgeblich für den Kauf-Flow) | 29 € / Mon., 290 € / Jahr, bis **50** | 49 € / 490 €, bis **200** | 79 € / 790 €, bis **9999** |
| App-Code (Konstanten) | 19,99 € / 199,90 €, bis 50 | 39,99 € / 399,90 €, bis 200 | 79,99 € / 799,90 €, bis **500** |
| Website + Doku | 9 € / 89 €, bis 50 | 29 € / 290 €, bis 200 | 59 € / 590 €, **unbegrenzt** |

Fundstellen: DB-Seed `migrations/20260122_license_payment_config.sql:84-89` ·
Code `Models/PricingConfig.swift:47-71` und Android `config/PricingConfig.kt:42-69` ·
Website `www/pricing.html:258-262,299-303,343-347` · Doku `backend/CLAUDE.md:46-59`.

**Was zur Laufzeit gilt:** die **DB-Tabelle `license_packages`** (Preise in Cent), nicht die
Code-Konstanten — die Kaufmaske lädt aus der DB (`Views/Premium/LicenseSelectionView.swift:194-196`).
Die Code-Konstanten sind nur noch Anzeigetext im Admin.

⚠️ Zusätzlich **Namens-Drift zwischen den Plattformen:** iOS nennt die Stufen
`basis/pro/premium`, Android `starter/standard/enterprise` — das sind **zwei verschiedene
Sätze Produkt-IDs für dieselbe Stufe**. v2 muss sich für eine Benennung entscheiden.

### 2.3 Zahlungsmethoden — Gebühren, die auf den Preis aufgeschlagen werden

Konfigurierbar in der DB-Tabelle `payment_method_config`
(`migrations/20260122_license_payment_config.sql:31-58`). Seed-Werte (`:74-81`):

| Methode | Prozent | Fix | 
|---|---|---|
| Apple Pay | **30,00 %** | 0 |
| Kreditkarte (Stripe) | 2,90 % | 0 |
| SEPA-Lastschrift | 0 % | 35 ct |
| PayPal | 2,90 % | 35 ct |
| Überweisung | 0 % | 0 |

Formel: `Endpreis = Basis + round(Basis × Prozent/100) + Fixbetrag`
(`…20260122…:145-174`, `calculate_price_with_fees`). `get_license_package_prices()` liefert
**für jede Zahlart einen eigenen Endpreis** (`:180-216`).

⚠️ Es gibt in der v1 **drei abweichende Gebührentabellen** für dieselben Methoden:
DB-Seed (oben) · Betreiber-Admin-Defaults SEPA 0,8 % + 25 ct, Stripe 2,9 % + 30 ct
(`www/admin/zahlungen.html:388-461`) · Portal-Übersicht mit eigenen „Aufschlägen"
Stripe 3 %, PayPal 3 %, SEPA 0,50 €, Apple 30 % (`www/portal/monetization.html:315-341`) ·
Android hart im Screen: PayPal 3,49 % + 0,39 € (`ui/screen/premium/LicenseSelectionScreen.kt:164-171`).
**v2 braucht genau eine Quelle.**

### 2.4 Limits pro Nutzer (Free / Premium / Unbegrenzt)

Defaults in `monetization_settings` (`migrations/20260109_monetization.sql:85-110`),
pro Verein änderbar:

| Limit | Free | Premium | Unbegrenzt | Admin-Spanne |
|---|---|---|---|---|
| Küren gesamt | **1** | 10 | 999999 | 1–10 |
| Musik pro Kür | **1** | 5 | 999999 | 1–10 |
| Bilder pro Kür | **2** | 20 | 999999 | 1–20 |
| Notizen gesamt | **3** | 5 | 999999 | 0–20 |
| Bilder pro Notiz | **0** | 1 | 999999 | 0–10 |
| Werbung | **ja** | nein | nein | an/aus |

Admin-Spannen: `Views/Admin/MonetizationSettingsView.swift:99-167`, Android
`ui/screen/admin/MonetizationSettingsScreen.kt:252-312`.

⚠️ Der Code widerspricht sich, ob **Premium** überhaupt Limits anhebt:
`PricingConfig.swift:18` sagt „Premium = nur werbefrei, weiterhin 1 Kür / 3 Notizen",
`Models/UserLimits.swift:188-203` sagt 10/5/20/5/1. **Entscheidend ist die DB-Funktion.**
Und im Web-Portal existiert eine **zweite, unabhängige Limit-Logik** über ein Feld
`users.subscription_tier` mit 3/5/999 Notizen (`www/portal/notes.html:350-366`).

### 2.5 Trainer-Sonderregel (Kurskorrektur vom 15.02.2026 — leicht zu übersehen)

> „### WICHTIG: Trainer haben KEINE unbegrenzten Limits mehr!" — `ios-macos/CLAUDE.md:243-256`

- Trainer **ohne** Premium: nur **1 Kür pro Mitglied**, nur 2 Bilder pro Kür, **sehen Werbung**,
  Vollbild-Werbung nach **jeder 5.** Kür (statt jeder).
- Durchgesetzt per DB-Funktion `can_trainer_create_kuer_for_member()`
  (`migrations/20260215_trainer_limits.sql:150-233`, Limit `v_limit := 1` in `:209`).
- Nur **Moderator und Admin** sind unbegrenzt (`:104-110`).

Das ist ein eigener Limit-Typ, den die Limit-Tabelle oben **nicht** abbildet.

### 2.6 Zubuchbare Einmalkäufe (Kontingente)

`migrations/20260109_monetization.sql:57-72,273-328`: `user_purchases` mit den Typen
`kueren_5` (+5), `kueren_10` (+10), `musik_10`, `musik_25`, `bilder_50`, `bilder_100`.
Werden auf `users.extra_kueren_count / extra_musik_count / extra_bilder_count` addiert und
**oben auf das Limit draufgerechnet**. Doppelbuchungsschutz über `store_transaction_id`.

⚠️ **Die Verkaufspreise dieser Pakete stehen nirgends** — weder im Code, in der DB noch im
Portal. `price_cents` wird nur mitgeschrieben, kommt vom Client und wird nie geprüft
(`:277,310`). Eine Kaufmaske dafür existiert in keiner App. **Unklar / nie ausgeliefert.**

### 2.7 Werbung — konkret

| Punkt | Wert | Fundstelle |
|---|---|---|
| iOS: Anbieter | Google AdMob, **Produktivmodus** (`useTestAds = false`) | `Services/AdsManager.swift:12,37` |
| App-ID / Banner / Interstitial | `ca-app-pub-9789047727118436~3739599643` / `…/4300698810` / `…/4249669874` | `AdsManager.swift:20,23,26` |
| Takt Free-Nutzer | Vollbild nach **jeder** Kür-Wiedergabe | `AdsManager.swift:111` |
| Takt Trainer | nach **jeder 5.** | `AdsManager.swift:114` |
| Bannerformat | iPhone 320×50, iPad 728×90 | `AdsManager.swift:472-479` |
| macOS | keine echte Werbung, Vollbild-Premium-Hinweis mit 5 s Zwangswartezeit | `AdsManager.swift:675-754` |
| Werbefrei ohne Kauf | Admin, Super-Admin, Moderator — **Trainer nicht** | `AdsManager.swift:372-382`, `www/assets/js/ads.js:84-88` |
| Web-Portal | Google AdSense, Publisher `pub-9789047727118436`, **Ad-Slots noch Platzhalter `XXXXXXX`** | `www/assets/js/ads.js:9-17` |
| Android | **kein AdMob**, nur Eigenwerbe-Banner | `ui/components/AdBanner.kt:25-73` |

### 2.8 Vereins-Grenzen und Beta-Stufen

| Was | Wert | Fundstelle |
|---|---|---|
| `vereine.max_mitglieder` | Default **50** | `migrations/20260216_verein_beta_tester.sql:10` |
| `vereine.lizenz_typ` | `free, beta_50, beta_100, beta_250, beta_unlimited, paid` | `…:11` |
| Beta freischalten | Default 250 Mitglieder, setzt zugleich `verein_license_active = true` → unbegrenzt + werbefrei | `…:20-64` |
| Beta abschalten | zurück auf 50 + `free` | `…:67-99` |
| Testphase | 14 Tage, werbefrei, vom Super-Admin verlängerbar | `SupabaseManager.swift:1058-1059,3518-3536` |
| Termin-Teilnehmerlimit | `termine.max_teilnehmer`, `anmeldung_erforderlich` | `20260118_sync_ios_android_models.sql:26-27` |
| Offline-Speicher | **2 GB** Obergrenze, min. 500 MB frei | `Services/OfflineSyncService.swift:45`, Android `data/local/OfflineSyncService.kt:41,44` |
| Upload-Grenzen (Android) | Bild 10 MB, Video 100 MB, Audio 50 MB, Dokument 20 MB | `data/storage/StorageManager.kt:36-39` |

⚠️ **`max_mitglieder` wird nirgends durchgesetzt** — nur angezeigt (Auslastungsbalken,
`www/admin/vereine.html:585-588`). Keine Registrierung und kein Trigger blockt bei
Überschreitung. Für v2 eine bewusste Entscheidung nötig.

---

## 3. Die Dinge, die im Verein Geld kosten

### 3.1 SCHLIESSFÄCHER — kostenpflichtig, mit verschiedenen Preisen ⭐

**Das ist der Punkt, den v2 verloren hat.** Schließfächer sind in der v1 **nicht gratis**.
Sie haben **zwei Preisebenen**:

**Ebene 1 — Listenpreis am Fach.** Tabelle `schliessfaecher`
(`migrations/20260119_schliessfach_vermietung.sql:11-22`):

| Feld | Bedeutung |
|---|---|
| `nummer` | Fachnummer, z. B. „A1" |
| `standort` | z. B. „Umkleide Herren" — Fächer werden danach gruppiert und gefiltert |
| `groesse` | **klein / mittel / gross** (Default `mittel`) |
| **`preis_pro_monat DECIMAL(10,2)`** | **Monatsmiete dieses Fachs** |
| `status` | **verfügbar / vermietet / reserviert / defekt / gesperrt** |
| `notizen` | frei |
| `verein_id` (+ optional Abteilung) | Zuordnung |

**Ebene 2 — vereinbarter Preis in der Vermietung.** Tabelle `schliessfach_vermietungen`
(`…20260119…:26-38`): eigenes **`preis_pro_monat`**, das beim Vermieten aus dem Fachpreis
vorgeschlagen, aber **überschrieben** werden kann (`Views/Schliessfach/SchliessfachVermietungSheet.swift:45-46,126`).
Dazu `start_datum`, `ende_datum` (leer = unbegrenzt), Dauer in Monaten,
Status **aktiv / beendet / gekündigt**.

Weitere Details:

- „Kostenlos" ist der **Sonderfall** — nur wenn der Preis leer oder 0 ist
  (`Models/Schliessfach.swift:95-103`); in der Vermietung heißt leer sogar
  „Nicht festgelegt" (`Models/SchliessfachVermietung.swift:67-75`).
- Preisfeld in der Eingabemaske mit „/ Monat" und Live-Hinweis „Kostenlos" bei 0
  (`Views/Schliessfach/SchliessfachFormView.swift:74-90`).
- Warnung beim Statuswechsel: „Achtung: Eine aktive Vermietung wird nicht automatisch
  beendet!" (`SchliessfachFormView.swift:106-114`).
- Die Miete fließt in die **monatliche Kostenübersicht des Mitglieds**
  (`www/portal/membership.html:369`, `www/portal/payments.html:380-410`).
- Rechte: anlegen/ändern/löschen nur Admin/Moderator; das Mitglied sieht **nur die eigene
  Vermietung** (`…20260119…:88-96`).
- Eigener PDF-Bericht (`Views/Settings/SchliessfaecherBerichtView.swift`), Modul pro
  Verein abschaltbar (`Models/Verein.swift:92`).
- Zuweisung direkt aus der Mitgliederliste heraus möglich.
- Realdatenstand v1: **24 Fächer** an 4 Standorten, 14 frei, 8 vermietet, 1 defekt,
  1 reserviert (`backend/info.md:45-57`).
- Auf allen drei Plattformen gebaut: iOS `Views/Schliessfach/*` (4 Screens, ~1088 Zeilen),
  Android `ui/screen/schliessfach/*` (`data/model/Schliessfach.kt:36-51,69-70,99-100`),
  Web `www/portal/schliessfaecher.html`.

Bekannte Fehler der v1, die man **nicht** mitnehmen sollte:

- `www/portal/payments.html:274` liest eine Spalte `monatliche_miete`, die es nicht gibt
  (richtig: `preis_pro_monat`) → Schließfachkosten werden dort vermutlich als 0 angezeigt.
- Der Schließfach-Bericht wertet **keine Einnahmen** aus (kein Betragsfeld im ganzen Report).
- **Kaution gibt es nicht** — weder in der App noch in der DB.

### 3.2 Mitgliedsbeiträge und Rabatte

| Was | Ausprägung | Fundstelle |
|---|---|---|
| Beitragskategorie | `base_price` + Intervall **monatlich / vierteljährlich / halbjährlich / jährlich / einmalig** | `Models/MembershipCategory.swift:12-17,58-59` |
| Altersabhängig | `min_age` / `max_age` je Kategorie | `MembershipCategory.swift:61-62` |
| Rabatt-Typ | **prozentual / fester Betrag / freie Monate** | `Models/MembershipDiscount.swift:11-14` |
| Rabatt-Zielgruppe | alle / Kategorie / **Familie / Neumitglieder / Schüler-Studenten / Senioren / Frühbucher** | `MembershipDiscount.swift:27-33`, `www/portal/database-migration.sql:204-216` |
| Familienrabatt-Schwelle | `min_members` (Default 2) | `MembershipDiscount.swift:57` |
| Mitgliedschaft | Status aktiv/inaktiv/pausiert/gekündigt, `auto_renew`, Stripe-/PayPal-Abo-IDs | `Models/Membership.swift` |

⚠️ **Familienrabatt ist in der v1 dreifach und widersprüchlich gepflegt:**
hart in der DB-Funktion `calculate_family_discount()` — ab 3 Familienmitgliedern **30 %**,
ab 2 **20 %** (`www/portal/database-migration.sql:569-589`) · konfigurierbar in
`membership_discounts` · und im Portal/Android als Regelwerk **2. Kind −50 %, 3. Kind
−100 % (kostenlos)**, das aber nur im **localStorage** bzw. im UI-Zustand liegt
(`www/portal/familien-rabatte.html:255,266,303-304`, `ui/screen/finance/FamilienRabatteScreen.kt:38-45`).
**Welche Regel gilt: unklar — Chef-Entscheidung.**

### 3.3 Pflichtstunden-Ablöse

- `vereine.pflichtstunden_pro_kind` — Default **10 Stunden**
- `vereine.pflichtstunden_kosten_pro_stunde` — Default **10,00 €**
- Rechnung: `soll = Kinderzahl × Stunden_pro_Kind`; `fehlend = max(0, soll − ist)`;
  **`kosten = fehlend × kosten_pro_stunde`**
- Zeitraum Jahr oder Saison mit Saisonstart/-ende; Fälligkeit im Portal „31.12."

Fundstellen: `migrations/20260213_fix_pflichtstunden_function.sql:21-41`,
`Models/Verein.swift:67-73`, `Views/Pflichtstunden/PflichtstundenView.swift:102-103`,
`www/assets/js/portal-pflichtstunden.js:129-163`.

⚠️ Die Tabelle `pflichtstunden` und die beiden `vereine`-Spalten sind **nirgends im Repo
per CREATE/ALTER angelegt** — sie wurden direkt auf der Live-DB erzeugt. v2 muss das
Schema neu definieren.

### 3.4 Rechnungen, Zahlungen, Mahnwesen

| Was | Details | Fundstelle |
|---|---|---|
| Rechnung | `betrag`, **`mwst_satz`**, **`mwst_betrag`**, `gesamt_betrag`, Fälligkeit, PDF | `migrations/20260111_payment_system.sql:47-80` |
| Rechnungsstatus | offen / bezahlt / überfällig / storniert / **teilbezahlt** | `…:61` |
| **Rechnungspositionen** | `beschreibung, menge, einzelpreis, gesamt` | `…:83-94` |
| Nummernkreis | `RE-JJJJ-MM-NNNNN` (per COUNT+1 — nicht kollisionssicher) | `…:284-306` |
| Zahlungsmethoden | paypal, stripe, sepa, ueberweisung, **bar**, apple_pay, google_pay | `…:96-118` |
| Zahlungsstatus | ausstehend / erfolgreich / fehlgeschlagen / **erstattet** / storniert | `…:96-118` |
| Überfällig-Lauf | Cron setzt `offen` + fällig < heute → `ueberfaellig` | `…:327-341` |
| **Mahnungen** | `mahnstufe 1–3`, `ursprungsbetrag`, **`mahngebuehr`**, **`verzugszinsen`**, `gesamtbetrag`, PDF | `migrations/20260215_finance_tables.sql:132-151` |
| SEPA-Mandate | Mandatsreferenz, IBAN, Unterschriftsdatum, Status | `20260111_payment_system.sql:121-140` |

**Mahngebühren-Staffel** — hier widersprechen sich die Plattformen, weil die DB keine
Beträge vorgibt (sie werden von Hand eingetragen; **es gibt keinen automatischen Mahnlauf**):

| Quelle | Stufen |
|---|---|
| iOS `Services/Finance/DunningService.swift:60-89` | Erinnerung 0 € (ab 3 Tagen, Frist 7) · 1. Mahnung **5 €** (14 / 14) · 2. Mahnung **10 €** (28 / 10) · 3. Mahnung **15 €** (42 / 7) · Inkasso **25 €** (56 / 5) |
| Android `ui/screen/dunning/DunningScreen.kt:911-941` | 1. Mahnung 0 € / 14 Tage · 2. Mahnung **5 €** / 10 Tage · letzte **10 €** / 7 Tage |
| Web `www/portal/mahnungen.html:171-186` | 3 Stufen, Mahngebühr frei, **Default 5,00 €** |

**Weitere Finanzmodule:** Budget (Soll/Ist je Jahr/Monat), Kassenbuch (Saldo per Trigger
fortgeschrieben, Kostenstelle, Belege), Spendenbescheinigungen (`SB-JJJJ-NNNN`, Geld-/
Sachzuwendung, PDF, Stornierung), Ratenzahlung, Bankabgleich, Jahresabschluss mit
Vorjahresvergleich, **DATEV-/CSV-/PDF-Export**
(`migrations/20260215_finance_tables.sql`, `Services/Finance/FinanceExportService.swift`).

⚠️ **Ratenpläne liegen in der v1 in `UserDefaults` bzw. `localStorage`**, nicht in der
Datenbank (`Views/Finance/RatenzahlungView.swift:114`, `www/portal/ratenzahlung.html:283,293-298`).
Gerätelokal, nicht synchronisiert, beim Löschen weg. In v2 gehört das in die DB.

### 3.5 Was in der v1 ausdrücklich NICHTS kostet

- **Hallen/Anlagen und Buchungen** in den Apps: kein Preisfeld (`Models/Facility.swift`,
  `Models/FacilityBooking.swift`). **Aber im Web-Portal-Schema gibt es
  `facilities.hourly_rate DECIMAL(10,2) DEFAULT 0`** (`www/portal/database-migration.sql:308`)
  und **externe Gastbuchungsanfragen mit `price_quote`** (`:476-495`). Ob das je genutzt
  wurde: unklar.
- **Ausrüstung/Ausleihe**: kein Preis, keine Kaution (`Models/Equipment.swift`,
  `Models/EquipmentReservation.swift`).
- **Überregionale Events** haben zwar eine **`teilnahmegebuehr DECIMAL(10,2)`**
  (`migrations/20260201_ueberregionale_events.sql:26`), aber sie wird **nirgends geprüft
  oder abgerechnet** — reines Anzeigefeld. Ebenso `max_teilnehmer` und `anmeldeschluss`.
- **Achievements/Medaillen**: reine Gamification.

---

## 4. Funktions-Inventar je Plattform

### 4.1 iOS / macOS / watchOS / Widget — die reichste Quelle

Rund 260 eigene Swift-Dateien. `Views/MainView.swift` (1579 Zeilen) erzeugt drei Layouts
aus einer Quelle: iPhone (5 Tabs), iPad und macOS (jeweils Sidebar). `enum NavigationTab`
hat **48 Ziele** (`MainView.swift:1470-1521`).

**44 Module:**
Dashboard (konfigurierbare Kacheln + 20 Quick-Actions) · Kalender · Termine (5 Typen,
Zu-/Absage inkl. „Krank" direkt aus der Push-Nachricht, „Helfer gesucht") · Teams · Chat
(+ Melde-System mit 5 Gründen und Moderation) · News · Notizen (limitiert) · Favoriten ·
globale Suche · Profil · **Küren** (Bewertung in 4 Kriterien, Video-Zeitstempel-Notizen,
Teilen mit 3 Rechtestufen, Offline mit 2-GB-Cap) · Trainingsplan · Trainingsplanung mit
Übungsbibliothek und Vorlagen · **Wettkampf-Live-Modus** · Wettkampf-Checklisten ·
**Überregionale Events** (vereinsübergreifend, Vereine einladen) · Medaillen ·
Belegungsplan/Sportanlagen (Serientermine) · Ausrüstung (tage-/stundenweise,
Überfälligkeit) · **Schließfächer** · Abteilungen (mit eigenen Abteilungsrollen) ·
Check-in/QR (mit GPS) · Anwesenheit · **Wartelisten** (4 Typen) · Galerie (Pro) ·
Dokumente (Pro) · **Gast-Trainer mit 6 Einzelrechten und Ablaufdatum** ·
**Familie** (Kinder anlegen, Kind-Account upgraden, **2. Elternteil per Token einladen**) ·
Pflichtstunden · 13 Finanz-Bildschirme · Statistiken · Berichte (5 PDF-Berichte) ·
**Verbandsmeldung** (anonymisiert zum Stichtag, CSV/PDF/Text) · Jubiläen/Ehrungen ·
Vereinsverwaltung · **Branding-Feintuning** (Banner-Transparenz, Blur, Gradient,
Logoposition, Header-Höhe) · frei sortierbares „Mehr"-Menü (26 Punkte) · 17 Modul-Schalter ·
**Demo-Daten** (10 Kategorien, Präfix `[DEMO]`, wieder löschbar) ·
**Backup auf 5 Ziele** (Lokal, iCloud, Google Drive, OneDrive, Dropbox) ·
Super-Admin-Plattformebene · Premium/Lizenzen/Werbung.

**Watch-App:** nächster Termin, Terminliste, **Ein-Klick-Check-in**, Chat-Ungelesen,
News, Trainings-/Kür-Timer (`RollsportManager Watch App/`).

**Widget:** „Meine Termine" — small/medium/large **plus Lock-Screen-Widgets**
(rectangular/circular/inline), Sichtbarkeit konfigurierbar.

**Siri:** 4 Sprachbefehle („Nächsten Termin anzeigen", „Küren anzeigen",
„Wettkampf-Modus öffnen", „Team anzeigen") mit eigenem Offline-Cache.

**5 Sprachen:** de, en, fr, ru, tr.

### 4.2 Android (Kotlin/Compose) — breit, aber nicht durchgängig fertig

307 Kotlin-Dateien, 139 Screens, 26 Repositories, 48 ViewModels, ~130 Navigationsziele.
Version 1.7 (versionCode 116). Funktional deckt es iOS weitgehend ab.

**Android-eigen (fehlt auf iOS):** Room-Offline-Datenbank, Home-Screen-Widget
„Nächstes Training", Zu-/Absage direkt aus der Benachrichtigung
(`notification/TerminResponseReceiver.kt`), `MemberDetailScreen`,
Kürmusik-Hintergrundwiedergabe über Media3.

**Fehlt auf Android:** Apple Watch, Modul-Einstellungs-Screen, Widget-Einstellungen,
„Anpassungen", Übungsbibliothek als eigener Screen, Spendenbescheinigungen-View.

⚠️ **Zwei harte Befunde — nicht von Android abschreiben:**

1. **Es gibt keinen funktionierenden Kauf.** Kein Play Billing im Projekt; der
   Kaufbutton setzt nur einen Spinner, der nie endet
   (`ui/screen/premium/PremiumUpgradeScreen.kt:77-92`); der Lizenzkauf ist ein
   `delay(1000)` ohne Server-Aufruf (`LicenseSelectionScreen.kt:475-478`). Premium wird
   faktisch nur manuell vom Admin gesetzt (`ui/viewmodel/AdminPremiumViewModel.kt:118-158`).
2. **Die Limits werden nicht durchgesetzt.** `LimitReachedScreen` existiert vollständig,
   aber **keine Stelle navigiert dorthin**; ebenso unerreichbar `LicenseSelection` und
   `MonetizationSettings`. Ein Free-Nutzer kann auf Android heute unbegrenzt Küren anlegen.

Außerdem laufen 12 Screens auf Mock-Daten (u. a. Mahnwesen, Zahlungsliste,
Check-in-Historie, Notizen, Trainingsplan) und 32 Screens haben gar keine
Backend-Anbindung. Genau **ein** Unit-Test im ganzen Projekt.

### 4.3 Web-Portal (`rollsportmanager-backend/www`) — drei Ebenen

| Ebene | Umfang | Zweck |
|---|---|---|
| Öffentliche Website | 20 Seiten | Marketing, Preise, FAQ, AGB, Datenschutz, Beta-Anmeldung, PWA |
| Mitglieder-/Vereinsportal | **89 Seiten** | die eigentliche Anwendung, rollenbasiert |
| Betreiber-Admin | 19 Seiten | Vereine, Lizenzen, Preise, Gebühren, Beta, SEO/CMS, SMTP, Server |

Technik: statisches HTML + `assets/js/portal.js` (3349 Zeilen) gegen Supabase, nginx-Container.
Sidebar in 8 rollenabhängigen Gruppen (`portal.js:1228-1640`).

**Nur im Web, nicht in den Apps:** die komplette Betreiber-Ebene — Lizenzpakete pflegen
(`admin/lizenzen.html`), Zahlungsmethoden und Gebühren global (`admin/zahlungen.html`),
Premium manuell setzen (`admin/premium.html`), Beta-Tester mit CSV-Export
(`admin/beta.html`), Umsatz/MRR/Conversion (`admin/monetization.html`), SMTP
(`admin/email.html`), SEO (`admin/seo.html`), Rechtstexte und Website-Inhalte
(`admin/legal.html`, `admin/content.html`), Chat-Moderation, Systemstatistiken.

**Öffentliche Zusagen aus FAQ/AGB, die v2 einlösen muss** (`www/faq.html:1142-1249`,
`www/pricing.html`): Basis kostenlos bis 50 Mitglieder · ab 9 €/Monat kostenpflichtig ·
Upgrade sofort mit anteiligen Kosten, Downgrade zum Periodenende, keine Mindestlaufzeit ·
Jahresabo = 2 Monate gratis · **14 Tage Testphase ohne Kreditkarte** · Sonderkonditionen
für Verbände und Gemeinnützige, **Neugründung 50 % im ersten Jahr** · Daten bleiben
**30 Tage** nach Ablauf erhalten · Datenexport bei Kündigung.

⚠️ Der Jahresrabatt wird an vier Stellen unterschiedlich beziffert: „2 Monate gratis" ·
„20 %" · „~17 %" · „Spare 37 %" (`www/assets/js/ads.js:271`).

**Bekannte Defekte des Portals:** toter Link `mahnwesen.html` (Datei heißt `mahnungen.html`,
`finance.html:459`) · 8 fertige Finanzseiten tragen ein irreführendes „Bald"-Abzeichen ·
Werbe-Schalter im Admin speichern nichts (`admin/monetization.html:281-304`) ·
AdSense-Slots sind Platzhalter · **Supabase-Anon-Key im Klartext**
(`admin/monetization.html:313`).

---

## 5. Datenmodell-Kern der v1

💰 = geldrelevant.

### 5.1 Kern (`migrations/20251230_initial_schema.sql`)

`vereine` (Mandant, Branding, Einladungscode) · `users` (Rolle, Verein, Eltern-Verknüpfung) ·
`teams` · `team_members` · `team_trainer` · `termine` · `termin_responses`
(zusage/absage/vielleicht/krank) · `attendance` · `messages` (Chat + DM) · `kueren` ·
`kuer_ratings` · `kuer_notizen` · `kuer_video_timestamps` · `kuer_media` (Base64 in der DB!) ·
`verein_news` · `invitations` · `trainingsplaene` · `documents`.

### 5.2 Geld und Limits

| Tabelle | Zweck |
|---|---|
| 💰 `monetization_settings` | **Werbung an/aus + alle Free-/Premium-Limits — pro Verein** |
| 💰 `user_subscriptions` | persönliche Abos (Store-Transaktion, Stripe-Abo, Ablauf, auto_renew) |
| 💰 `user_purchases` | **Einmalkäufe/Kontingente** mit `price_cents` |
| 💰 `license_packages` | **Vereins-Lizenzstufen**: `max_members`, Monats-/Jahrespreis in Cent, StoreKit-IDs |
| 💰 `payment_method_config` | **Gebühr je Zahlart** (`fee_percent`, `fee_fixed_cents`) + API-Schlüssel |
| 💰 `verein_payment_config` | PayPal-/Stripe-/SEPA-/Überweisungs-Zugangsdaten **je Verein** |
| 💰 `invoices` + `invoice_items` | Rechnungen **mit MwSt** und Positionen |
| 💰 `payments` | Zahlungen inkl. `bar`, Provider-Antwort, Status `erstattet` |
| 💰 `sepa_mandate` | SEPA-Mandate |
| 💰 `mahnungen` | Mahnstufe 1–3, **Mahngebühr, Verzugszinsen**, PDF |
| 💰 `budget_positionen`, `kassenbuchungen`, `spendenbescheinigungen` | Budget, Kassenbuch (Saldo per Trigger), Spendenquittungen |
| 💰 `schliessfaecher` + `schliessfach_vermietungen` | **Fächer mit Preis/Größe/Status + Mietverträge mit eigenem Preis** |
| 💰 `membership_categories`, `membership_discounts`, `memberships` | Beiträge, Rabatte, Mitgliedschaften |
| 💰 `facilities.hourly_rate`, `guest_booking_requests.price_quote` | Hallen-Stundensatz und externe Vermietung (nur Portal-Schema) |
| 💰 `ueberregionale_events.teilnahmegebuehr` | Startgeld (nie abgerechnet) |

### 5.3 Weitere Module

`message_reports` (Chat-Meldungen + Moderationsstatus) · `device_tokens`,
`notification_settings`, `notification_log`, `push_queue` (Push-Infrastruktur) ·
`achievements` (Katalog mit Schwellwert) + `user_achievements` · `guest_trainer_access`
(Token, Ablauf, 6 Einzelrechte) · `uebungen` + `trainingsplan_vorlagen`,
`trainingsplan_uebungen`, `trainingsplan_zuweisung`, `trainingsplan_fortschritt` ·
`ueberregionale_events` + `event_vereine` + `event_teilnehmer` · `wettkampf_details` +
`wettkampf_starter` · `gallery_albums`/`gallery_photos` · `waitlist` · `member_qrcodes` ·
`checkins` · `equipment_categories`/`equipment_items`/`equipment_reservations` ·
`audit_log`, `archived_data`, `verein_backups`, `verein_backup_settings`,
`compliance_reports` (10-Jahres-Aufbewahrung, Steuerreport) · `website_content`/`website_images` (CMS).

⚠️ **Wichtige Warnung zur Quellenlage:** Es gibt **zwei parallele, teils widersprüchliche
Schemata** — die deutschen App-Migrationen unter `migrations/` und ein eigenes,
**englisches** Portal-Schema in `www/portal/database-migration.sql` (mit eigenen
`invoices`, `payments`, `memberships`, `facilities`, `equipment_*`, `waitlist`, `checkins`).
Welches davon live ist: **unklar, ohne DB-Zugriff nicht feststellbar.**

⚠️ Diese Tabellen werden vom Code **benutzt, aber nirgends im Repo angelegt** (existieren
nur auf der Live-DB): `pflichtstunden`, `ratenplaene`, `raten`, `abteilungen`,
`user_abteilungen`, `favoriten`, `user_notes`, `note_images`, `parent_invitations`,
`verein_join_requests`, `beta_testers`, `email_settings`.

### 5.4 Rollen

6 Rollen mit Hierarchie (`Models/User.swift:13-72`):
`mitglied` (0) · `trainer` (1) · `kassenwart` (2, darf Finanzen) · `moderator` (3) ·
`admin` (4, Vereins-Chef) · `super_admin` (5, Plattform-Boss).

Dazu **zwei weitere Rechte-Ebenen**, die man leicht übersieht:

- **Abteilungsrollen** unabhängig von der Vereinsrolle: mitglied / trainer / **leiter** / admin
  (`Models/Abteilung.swift:58-69`)
- **Eltern-/Kind-Accounts**: `isParentAccount`, `parentId`, **`parent2Id` (zwei Elternteile)**,
  Kontotyp `child` (<16, kein Login) / `teen` (16–17, darf selbst buchen) / `adult` (18+, darf
  Zahlungen verwalten), mit **automatischem Alters-Upgrade per Cron**
  (`Models/User.swift:92-124`, `www/portal/database-migration.sql:609-630`)

**Super-Admin-Override:** Der Super-Admin kann einen fremden Verein „betreten" und wird
dann wie ein Admin behandelt, mit sichtbarem Warnbanner (`Views/MainView.swift:39-42,209-212`).
Für normale Mitglieder ist er **unsichtbar** (`migrations/20260225_super_admin_role.sql:92-111`).

⚠️ **Falle:** `is_current_user_admin()` wurde am 25.02.2026 auf **`super_admin`**
umdefiniert (`20260225…:32-39`). Alle älteren Finanz-Policies, die diese Funktion nutzen,
bedeuten seitdem „Plattform-Boss", nicht „Vereins-Admin".

---

## 6. Festgelegte Regeln des Chefs (Zitate aus der v1-Doku)

**R1 — alle Plattformen gleichzeitig.**
> „Bei UI-Änderungen IMMER auf ALLEN Plattformen implementieren" — `ios-macos/CLAUDE.md:12-22`;
> als „KRITISCH - PLATTFORM-SYNCHRONISATION!" mit Checkliste `backend/CLAUDE.md:89-111`.

**R2 — iOS ist die Referenz.**
> „**NICHT ÄNDERN!** - iOS ist die Referenz/Vorlage" — `android/CLAUDE.md:466-467`.

**R3 — nach jeder Änderung bauen und auf echten Geräten testen**
(iPhone, iPad, Android-Gerät namentlich benannt) — `ios-macos/CLAUDE.md:24-47`.

**R4 — Enums und Spalten sind DEUTSCH.**
> „**NIEMALS die Enum-Werte auf Englisch ändern!**" — `ios-macos/CLAUDE.md:117`.
> Kanon: `bild/video/audio/dokument` · `in_arbeit/bereit/wettkampf/archiviert` ·
> `training/wettkampf/event` · `zusage/absage/vielleicht/krank` ·
> `angefragt/bestaetigt/storniert/abgeschlossen` — `backend/CLAUDE.md:251-257`,
> `HARMONISIERUNGSPLAN.md:162-171`. Spaltenfallen: `start_datetime`, `ort`, `nachricht`.

**R5 — kein automatisches snake_case-Mapping.**
> „**NIEMALS `keyDecodingStrategy = .convertFromSnakeCase` hinzufügen!**" — `ios-macos/CLAUDE.md:119-134`.

**R6 — Umgebung immer produktiv.**
> „Die App verwendet IMMER `.remote` (https://rollsportmanager.de)! - NIEMALS auf `.local` umstellen!" — `ios-macos/CLAUDE.md:5-10`.

**R7 — Preise nur an einer Stelle ändern.**
> „WICHTIG: Preise hier ändern, nicht in den Views!" — `Models/PricingConfig.swift:6`,
> `config/PricingConfig.kt:8`. *(In der v1 faktisch gebrochen — siehe die vier Preisstände.)*

**R8 — Trainer sind nicht privilegiert** (Kurskorrektur 15.02.2026).
> „### WICHTIG: Trainer haben KEINE unbegrenzten Limits mehr!" — `ios-macos/CLAUDE.md:243-256`.

**R9 — Nachrichten nur 5 Minuten editierbar** — `docs/modules/05-CHAT.md:269-276`.

**R10 — ein Nutzer, ein Verein.**
> „Jeder User gehört zu maximal einem Verein" — `docs/modules/02-VEREIN.md:124-128`.
> Beitritt per **6-stelligem Einladungscode** (A–Z0–9, einmalig je Verein) oder E-Mail-Einladung.

**R11 — Datenschutz-Versprechen an den Vorstand.**
> „Alle Daten … ausschließlich auf unserem eigenen Server (rollsportmanager.de) … nicht an
> Dritte weitergegeben … DSGVO" — `Beta-Test-Einladung.md:220-222`.
> ⚠️ Steht in Spannung zu AdMob und Firebase-Push in derselben v1.

**R12 — Plattform-Zusage:** iPhone, iPad, Mac, **Apple Watch**, Android, Web;
Mindestversionen iOS 16+ / macOS 13+ / watchOS 9+ / Android 8+ — `Beta-Test-Einladung.md:140-149`.

**R13 — 5 Sprachen:** de, en, fr, ru, tr — `backend/CLAUDE.md:61-70`.

---

## 7. LÜCKEN v1 → v2 (Stand: Migrationen bis 0068)

Priorisiert. „Groß" heißt: eigenes Datenmodell + UI auf mehreren Plattformen.

### Stufe 1 — Geld, das v2 heute nicht einsammeln kann

| # | Lücke | Größe | Belege |
|---|---|---|---|
| 1 | **Schließfächer sind in v2 gratis.** `app.lockers` hat nur `label, location, status, assigned_member_id, note` — **kein Preis, keine Größe** (`v2 supabase/migrations/0017_organisation.sql:87-98`). Es fehlt die ganze zweite Tabelle `schliessfach_vermietungen` (Mietzeitraum, eigener vereinbarter Preis, Status aktiv/beendet/gekündigt). v2 kennt nur „Fach X gehört Mitglied Y". | mittel | v1 `20260119_schliessfach_vermietung.sql:11-38` |
| 2 | **Keine Zahlungstabelle.** v2 hat `ledger_entries` und `bank_transactions`, aber kein `payments` — damit fehlen Zahlungsart `bar`, Provider-Antwort und die Status `fehlgeschlagen`/`erstattet`. | groß | v1 `20260111_payment_system.sql:96-118` |
| 3 | **Keine MwSt und keine Rechnungspositionen.** `app.invoices` hat einen `amount_cents` und einen `title` — keine `invoice_items` (Menge × Einzelpreis), keinen Steuersatz, keinen Steuerbetrag, keinen Status `teilbezahlt`. | mittel | v2 `0013_finance_a.sql`; v1 `20260111…:47-94` |
| 4 | **Mahnwesen ohne Geld.** v2 `app.dunning_log` protokolliert nur Stufenwechsel (`from_stage/to_stage/action`) — **keine Mahngebühr, keine Verzugszinsen, kein Gesamtbetrag, kein Mahnungs-PDF**. | mittel | v2 `0013_finance_a.sql`; v1 `20260215_finance_tables.sql:132-151` |
| 5 | **Pflichtstunden ohne Ablöse.** v2 `app.duty_requirements` kennt `required_hours`, aber **keinen Kostensatz pro fehlender Stunde** und keine Abrechnung. Das ist bares Geld, das der Verein heute einnimmt. | klein | v2 `0015_finance_c.sql`; v1 `20260213_fix_pflichtstunden_function.sql:24-41` |
| 6 | **Ratenzahlung fehlt komplett** (in v1 zwar nur in UserDefaults/localStorage — aber fachlich vorhanden und im Portal bedient). | mittel | v1 `www/portal/ratenzahlung.html` |
| 7 | **Familienrabatt ist ärmer.** v2 `app.family_discounts` kann nur „ab dem n-ten Kind, Prozent oder Fixbetrag". v1 kannte zusätzlich die Zielgruppen **Geschwister, Frühbucher, Schüler/Studenten, Senioren** und „freie Monate" als Rabattart. | klein | v2 `0015_finance_c.sql`; v1 `MembershipDiscount.swift:11-33` |
| 8 | **Hallen-Stundensatz und externe Vermietung.** v2 `app.facilities` hat keinen `hourly_rate`; es fehlen `guest_booking_requests` mit `price_quote` und Rechnungsverknüpfung — also die Möglichkeit, die Halle an Dritte zu vermieten. | mittel | v2 `0017_organisation.sql`; v1 `www/portal/database-migration.sql:308,476-495` |
| 9 | **Startgeld für überregionale Events.** v2 `app.regional_events` ist ein reiner Link-Eintrag (Titel, Ort, Datum, `registration_url`) — keine `teilnahmegebuehr`, kein `max_teilnehmer`, kein Anmeldeschluss, keine eingeladenen Vereine, keine Teilnehmermeldung mit Startnummer/Platzierung. | groß | v2 `0011_modules_batch4.sql`; v1 `20260201_ueberregionale_events.sql` |

### Stufe 2 — Abo, Werbung, Limits (der ganze Plattform-Umsatz)

| # | Lücke | Größe | Belege |
|---|---|---|---|
| 10 | **Keine Limits, keine Werbung, keine `monetization_settings`.** In v2 gibt es keine Free-/Premium-Limits (Küren 1/10, Musik 1/5, Bilder 2/20, Notizen 3/5), keinen Werbeschalter und keine vereinsweite Konfigurierbarkeit. Der komplette Free-Tier-Hebel fehlt. | groß | v2: kein Treffer für `ads_enabled`/`free_*_limit` in `supabase/migrations/`; v1 `20260109_monetization.sql:85-110` |
| 11 | **Keine persönlichen Abos und keine Kontingent-Käufe.** v2 hat `app.entitlements` + `app.products` (gute Basis), aber keine Entsprechung zu `user_subscriptions` (Store-Transaktion, auto_renew, Kündigungsdatum) und **kein `user_purchases`** — die zubuchbaren Pakete `kueren_5 … bilder_100` samt `users.extra_*_count`-Töpfen fehlen ganz. | groß | v2 `0006_platform.sql`; v1 `20260109_monetization.sql:10-15,57-72` |
| 12 | **Keine Preise hinterlegt.** `app.products` ist strukturell richtig (`price_cents`, `billing_interval`, `max_members`), aber es gibt **keinen einzigen Produkt-Seed** — v2 kennt heute keine Preise. | klein (Daten) | v2 `0006_platform.sql`, kein `insert into app.products` in den Migrationen |
| 13 | **Keine Gebühren je Zahlart.** Kein `payment_method_config`, keine `calculate_price_with_fees()`-Logik — v2 kann den Apple-Aufschlag nicht abbilden und keine „günstigste Methode" ausweisen. | mittel | v1 `20260122_license_payment_config.sql:31-58,145-216` |
| 14 | **Keine Zahlungsanbieter-Daten je Verein.** Kein `verein_payment_config` (eigene Stripe-/PayPal-Schlüssel, SEPA-Gläubiger-ID, Überweisungsdaten, Apple/Google Pay). Ohne das kann kein Verein selbst kassieren. | mittel | v1 `20260111_payment_system.sql:7-44` |
| 15 | **Keine Mitglieder-Obergrenze als Verkaufshebel.** `vereine.max_mitglieder` und `lizenz_typ` (free / beta_50 / beta_100 / beta_250 / beta_unlimited / paid) fehlen — inklusive der Beta-Freischaltung, mit der der Chef Testvereinen unbegrenzt + werbefrei schenkt. *(Fairerweise: in v1 wurde die Grenze nie durchgesetzt.)* | klein | v1 `20260216_verein_beta_tester.sql:9-99` |
| 16 | **Trainer-Sonderregel „1 Kür pro Mitglied"** — eigener Limit-Typ, in v2 nicht vorhanden. | klein | v1 `20260215_trainer_limits.sql:150-233` |
| 17 | **14-Tage-Testphase mit Zwangsdialog** nach Ablauf. v2 kennt `metadata.status = 'trial'` an den Entitlements (`0012_modules_batch5.sql:35-37`), aber keine Trial-Automatik beim Vereinsanlegen und keinen Ablauf-Dialog. *(Die neue Vereins-Selbstanlage nennt 30 Tage — Abweichung bewusst klären.)* | klein | v1 `SupabaseManager.swift:1058-1059` |

### Stufe 3 — Module, die v2 ganz fehlen (kein Geld, aber Funktionsverlust)

| # | Lücke | Größe |
|---|---|---|
| 18 | **Chat-Meldungen und Moderation** (`message_reports`: 5 Gründe, Bearbeitungsstatus, Admin-Notiz). Das ist auch eine **App-Store-Anforderung** für nutzergenerierte Inhalte. | mittel |
| 19 | **Push-Infrastruktur** (`device_tokens`, `notification_log`, `push_queue`) inkl. **Zu-/Absage direkt aus der Mitteilung**. | groß |
| 20 | **Gast-Trainer** als eigene Entität mit Einladungstoken, 30-Tage-Ablauf und 6 Einzelrechten. | mittel |
| 21 | **Trainingsplanung**: Vorlagen über mehrere Wochen, Zuweisung an Mitglieder, Fortschrittsverfolgung (4 Tabellen). v2 hat nur `app.exercises`. | groß |
| 22 | **Medaillen/Achievements als Katalog mit Schwellwerten** + freigeschaltete Auszeichnungen je Nutzer. v2 `app.achievements` ist etwas anderes. | klein |
| 23 | **Backup, Archiv, Compliance**: `verein_backups`, `verein_backup_settings` (10-Jahre-Aufbewahrung), `archived_data`, `compliance_reports` (Steuerreport), fachliches `audit_log` je Tabelle. **Vereinsrecht/GoBD-relevant.** | groß |
| 24 | **Backup der Nutzerdaten auf 5 Cloud-Ziele** (Lokal, iCloud, Google Drive, OneDrive, Dropbox, mit OAuth). | mittel |
| 25 | **Mitglieds-QR-Codes** (`member_qrcodes`) als persönlicher Ausweis; v2 hat Check-ins, aber keinen Ausweis. | klein |
| 26 | **Demo-Daten-System** (10 Kategorien, `[DEMO]`-Präfix, kategorieweise löschbar) — starkes Vertriebswerkzeug. | mittel |
| 27 | **Verbandsmeldung** (anonymisierte Statistik zum Stichtag, CSV/PDF/Text) und **Jubiläen/Ehrungen** mit einstellbarem Intervall. Jährliche Pflicht der Vereine. | mittel |
| 28 | **Spendenbescheinigungen mit PDF und eigenem Nummernkreis**, **Bankabgleich**, **DATEV-Export**. | groß |
| 29 | **Wartelisten** über 4 Typen (Team, Termin, Einrichtung, Mitgliedschaft) mit Position und Ablauf. v2 hat `app.waitlists` — Umfang gegenüber v1 **nicht geprüft**. | unklar |
| 30 | **Branding-Feintuning** (Banner-Transparenz, Blur, Gradient mit zwei Farben, Logoposition, Header-Höhe 100–300, Namensstil) und das **frei sortierbare „Mehr"-Menü** mit 26 Punkten. | mittel |
| 31 | **Watch-App, Lock-Screen-Widgets, Siri-Kurzbefehle.** | groß |
| 32 | **5 Sprachen** (de/en/fr/ru/tr). v2 arbeitet zweisprachig. | mittel |
| 33 | **Ausrüstungs-Kategorien** als eigene Tabelle, `size` und `purchase_date` am Gegenstand; v2 hat nur ein Textfeld `category`. | klein |
| 34 | **Website-CMS** (`website_content`, `website_images`) und die SEO-Pflege im Betreiber-Admin. | mittel |

### Was v2 aus der v1 ausdrücklich NICHT übernehmen soll

- **Android als Vorlage für Kauf und Limits** — beides ist dort Attrappe.
- **Ratenpläne und Familienrabatte in localStorage/UserDefaults** — gehört in die DB.
- **`activate_premium()` und `process_purchase()` ohne Beleg-Prüfung** — jeder
  angemeldete Client kann sich per RPC Premium geben (`20260109_monetization.sql:427-431`).
  **Umsatzleck; in v2 zwingend serverseitig verifizieren.**
- **Gast-Zugangs-Policy `USING (true)`** — jeder Angemeldete kann alle Gast-Tokens lesen
  (`20260201_guest_trainer_access.sql:65-67`).
- **Geheimnisse im Klartext** (Anon-Key im Web-Admin, SMTP-Passwort in der DB,
  Keystore-Passwort in `android/info.md`) — nicht übernehmen, rotieren.
- **Nummernkreise per `COUNT(*)+1`** — nicht kollisionssicher bei Parallelität.
- **Medien als Base64 in der Datenbank** (+33 % Größe) — v2 macht das mit `storage_key`
  bereits richtig.

### Die sechs Entscheidungen, die nur der Chef treffen kann

1. **Welche Preisliste gilt?** Vier Stände für die Vereinslizenzen (9/29/59 · 19,99/39,99/79,99 · 29/49/79), zwei für die persönlichen Abos (1,99/4,99 vs. 2/5).
2. **Wie heißen die Stufen?** `basis/pro/premium` (iOS) oder `starter/standard/enterprise` (Android)?
3. **Wie groß ist die Top-Stufe?** 500 Mitglieder (Code), 9999 (DB) oder „unbegrenzt" (Website)?
4. **Welche Gebührensätze gelten?** Drei widersprüchliche Tabellen.
5. **Was kosten die Zubuch-Pakete** (`kueren_5` … `bilder_100`)? Steht nirgends.
6. **Welche Familienrabatt-Regel gewinnt?** 20/30 % (DB-Funktion) oder 50 %/100 % ab dem 2./3. Kind (Portal/Android)?

Zusätzlich rechtlich bindend, weil öffentlich versprochen: 14-Tage-Test ohne Kreditkarte,
Jahresrabatt („2 Monate gratis"), 50 % Neugründer-Rabatt im ersten Jahr, 30 Tage
Datenaufbewahrung nach Ablauf, Datenexport bei Kündigung.

---

## 8. Was v2 heute schon besser macht

Diese Referenz ist kein Plädoyer für einen Rückschritt. Die v2 hat Dinge gelöst, an denen
die v1 strukturell krankte:

- **Ein Schema statt drei.** Die v1 hat zwei parallele, widersprüchliche Datenmodelle
  (deutsche App-Migrationen vs. englisches Portal-Schema) plus Tabellen, die nur auf der
  Live-DB existieren. v2 hat eine durchnummerierte, getestete Migrationskette (1573 SQL-Tests).
- **Rechte in der Datenbank statt im Client.** v2 hat ein echtes RBAC-Modell
  (`app.roles`, `app.capabilities`, `app.role_permissions`, ab `0022_rbac_core.sql`) statt
  verstreuter Rollen-Abfragen in Views und JavaScript. In der v1 hing die Bedeutung von
  `is_current_user_admin()` an einer nachträglichen Umdefinition.
- **Mehrsparten-Vereine richtig modelliert.** Verein → Sparten → Teams → Mitglieder mit
  n:m-Zuordnung (`0062_sparten.sql`), statt der flachen „Abteilungen" der v1.
- **Modul-Zubuchung als Mechanik.** `app.club_modules` + `app.module_enabled` +
  `app.is_club_pro` bilden die UND-Kette „gekauft UND eingeschaltet UND erlaubt"
  (`0044`, `0068_zubuchbare_module.sql`) — in der v1 waren Modul-Schalter und Pro-Gate
  zwei unverbundene Welten.
- **Medien liegen außerhalb der DB** (`storage_key` + Signed URLs) statt als Base64-Blob.
- **Einladungen sicher gebaut**: nur `token_hash` (SHA-256), 14 Tage Ablauf,
  enumerationssichere Antworten (`0065_einladungen.sql`) — die v1 legte Gast-Tokens für
  jeden lesbar aus.
- **Einwilligung und Löschbarkeit von Anfang an** (`0039_einwilligung.sql`,
  `policy_acknowledgements`, Soft-Delete-Konvention).
- **Neue Funktionen, die die v1 nicht hatte:** Fahrgemeinschaften
  (`0066`/`0067`), Support-Tickets (`0052`), Betreiber-Konsole mit Audit-Log (`0051`),
  Trainer-Beurteilung (`0055`), Foto-Markierung (`0056`).

**Die Aufgabe ist also nicht „zurück zur v1", sondern: die belegten Geld- und
Limit-Mechaniken der v1 auf das saubere Fundament der v2 heben** — angefangen bei den
Schließfächern.
