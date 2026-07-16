# RollsportManager v2 — Sorglos-Notiz (Stand & „mach weiter")

**Zweck:** Alles an einem Ort. Du sagst einfach **„mach weiter"**, dann arbeite ich die
Reihenfolge unten von oben ab. Stand: 2026-07-16.

Projekt: `/Users/marcelgoldfuss/Apps/RollsportManager-v2` · alles committet auf Branch `main`
(kein Remote; `apps/android/` bewusst untracked).

---

## 1. Was FERTIG ist ✅
- **Analyse & Design:** v1 studiert (`blueprint/research/`, `00-STUDIE-SYNTHESE.md`), Design „Heimspiel"
  (`design/DESIGN-SYSTEM.md`, `tokens.json`, Mockups), Blueprint (`blueprint/01-BLUEPRINT-V2.md`),
  v1-Referenz (`ORIGINAL-APP-REFERENZ.md`), Rest-Checkliste (`RESTFUNKTIONEN.md`), RBAC-Spec (`RBAC-DESIGN.md`).
- **Backend:** komplett. `supabase/migrations/` 0001–0021, Hono-API (`services/api`), ~485 RLS-Sicherheitstests grün,
  Contracts-Codegen (`packages/contracts` → TS/Swift/Kotlin).
- **Web:** **komplett** (alle ~75 v1-Portalseiten + Verwaltung + Super-Admin). `apps/web` (Next.js, Port 3021).
- **iOS:** **~85 %.** `apps/ios` (SwiftUI, xcodegen). ~29 Module + Verwaltung (7 Rollen mit Hierarchie) + Finanz-Tiefe A
  (Kassenbuch/Rechnungen/Mahnwesen). Jeweils im Simulator geprüft.
- **Sicherheits-Härtung (2026-07-11):** Mitglieder-Sichtbarkeit verschärft (RLS+API): Mitglied sieht nur eigenes
  Schließfach, eigene Küren, Namensliste ohne Geburts-/E-Mail-/Zahldaten, darf nicht mehr buchen. Commits 38ebdd1 / bb5e48c.
- **RBAC Phase 1 (2026-07-16, Commit 41db579):** Kern-Backend steht. Migrationen 0022–0026, **667/667 SQL-Tests grün**
  (507 alte wörtlich unverändert — per `git diff --stat HEAD -- supabase/tests/` belegt). Tabellen `capabilities`/`roles`/
  `role_permissions`/`member_roles` + Eskalations-Trigger. **Der Kniff:** nicht 110 Policies umgeschrieben, sondern nur der
  Rumpf von `app.has_club_role` (Auflösung **JWT-Claim → Datenbank**) — alle Policies ziehen automatisch nach, sofortwirksam
  ohne Re-Login. Live bewiesen mit EINEM unveränderten Token: nur Matrix geändert → 1 → 6 → 0 → 1 Küren.

## 2. Was NOCH zu tun ist (Reihenfolge = „mach weiter")
> Web zuerst fertig war die Vorgabe — Web ist fertig. Reihenfolge jetzt:

1. **RBAC — konfigurierbares Rechte-System** (genehmigt, Spec: `RBAC-DESIGN.md` — **Korrektur-Block ganz oben zuerst lesen**,
   er überschreibt den Rest). 4 Durchläufe: ~~Kern-Backend/RLS~~ ✅ → **API+Contracts (Phase 2, läuft)** →
   Web-Admin-UI (editierbare Matrix, eigene Rollen, Mehrfachrollen, Trainer-Mehrfachteams) → Verifikation.
   - **Von Marcel entschieden (2026-07-16):** (a) Austritt/Soft-Delete entzieht Rechte **sofort**, für alle Rollen — freigegeben.
     (b) Küren-Split in `routines_read` + `routines_edit`, damit auch Bearbeiten konfigurierbar wird. (c) Phase 2 freigegeben.
   - **Noch offen:** `none` sperrt bisher nur SCHREIBEN, nicht LESEN → das UI darf `none` **nicht als „abgeschaltet" anzeigen**,
     solange die SELECT-Policies nicht umgestellt sind (0027+). Performance von `cap_rank` ungemessen (vor Prod `EXPLAIN ANALYZE`).
     Der GoTrue-Hook, der `club_roles` in den Token schreibt, ist im Repo **nicht auffindbar** — für Prod klären.
2. **Registrierung + DSGVO + Botschutz** (neu am 2026-07-16 von Marcel beauftragt, Recherche lief als `wcixbacpt`).
   Heute gibt es nur den Dev-Persona-Login — **es kann sich weder ein Verein noch ein Mitglied selbst anmelden.**
   - **Von Marcel vorgegeben:** Es geht um **Vereine und Mitglieder** (nicht Firma/Mitarbeiter — das war ein Versprecher).
     **Beitritt per VEREINSCODE**, wenn die Person einen hat. **Bewerbung ohne Code** ist nur eine *mögliche* Ergänzung
     und muss **standardmäßig AUS** sein — einschaltbar **im Super-Admin** (Betreiberkonsole `app/(super)/`).
   - **⚠️ Sicherheits-Konsequenz des Vereinscodes** (beim Bau beachten): ein Vereinscode ist ein *geteiltes* Geheimnis —
     er landet in WhatsApp-Gruppen. Wenn er direkten Zugang gibt, sieht jeder, der ihn hat, Mitglieder- und **Kinderdaten**.
     Deshalb: hohe Entropie, Versuchs-Limit, widerrufbar/rotierbar — und die Frage, ob der Code direkt hereinlässt oder
     nur eine **Beitrittsanfrage** erzeugt, die der Vorstand freigibt. Marcel entscheidet das, wenn der Bauplan steht.
   - Offene Kernkonflikte: **Kinder** (DSGVO Art. 8 — Einwilligung der Eltern), **Löschrecht vs. GoBD** (Rechnungen
     müssen 10 Jahre bleiben), **GoTrue-Hook fehlt im Repo** (ohne ihn kein brauchbarer Token nach echter Registrierung),
     **Mailversand** (ohne SMTP keine Verifikation/Einladung).
3. **iOS fertigstellen:** Finanz-Tiefe B (Beitragskategorien/Mitgliedsbeiträge/Familienrabatte, Jahresabschluss, Bankabgleich, Spenden) ·
   Super-Admin-Konsole · **Politur-Pass** (UI-Rechte-Gating an die neue RLS anpassen — Buttons ausblenden statt 403; Bearbeiten-Flows in Lese-Modulen;
   Toast-System; Layout-Nickel wie Chip-Umbruch in Jubiläen/Notizen).
4. **2. Datenschutz-Konsistenz-Durchgang** (nach RBAC evtl. obsolet): Jubiläen/Geburtstage, Ausrüstungs-Reservierungen, Anwesenheit — gleiche Logik.
5. **Android:** ~10 % (früher Anfang, unfertig). Volle Parität nachbauen (mehrere Bündel).
   BLOCKER: Emulator-System-Image fehlt (~2,6 GB nachladen) oder physisches Gerät nutzen.
6. **Watch / Widgets:** 0 %.
7. **iPhone-Geräte-Install (Zuhause-Test):** machbar & bereit — dein iPhone 16 Pro ist gekoppelt, Signierung da, Mac-IP 192.168.1.168.
   Nötig: Dev-API aufs WLAN öffnen (0.0.0.0:3022) + App-Build auf die Mac-IP zeigen + Development-Signierung + devicectl-Install.
   Funktioniert nur im Heim-WLAN, solange Mac+Backend laufen (dev-Build). Wartet auf dein „ja".
8. **Produktivbetrieb (v2-Start):** gehosteter Server (Blueprint: Hetzner) + Daten-Cutover/ETL aus v1 + TestFlight/Play.
   Echte Zahlungen (Stripe-Checkout/RevenueCat) sind noch Gerüst.
9. **Kleinkram „v2.1/später" (Web):** Mehrvereins-Umschalter/Onboarding, echter SMTP-Mahnversand, automatische Familienrabatt-Verrechnung,
   Betreiber-Rechnungsverwaltung/Beta/Demo-Daten, Chat-Voice-to-Text/Check-out/Favoriten.
   („echte Registrierung" stand hier — ist seit 2026-07-16 als **Punkt 2** eigenständig beauftragt.)
10. **Getrennt & dringend (NICHT v2):** Phase-0-Sicherheit der laufenden **v1-Produktion** (Demo-JWT, Selbst-Beförderung) —
   eigener Task-Chip vom Sessionbeginn. Braucht Abstimmung (Key-Rotation invalidiert App-Sessions).

## 3. Wie man testet / weitermacht (Resume-Fakten)
- **Dev-Backend starten:** `bash scripts/dev-stack.sh up` (nach neuer Migration: `reset`). Postgres `rsm2-pg-dev` :55433
  (Bind-Mount `.dev/pgdata`), API :3022 (`AUTH_MODE=dev`), `POST /dev/login {"persona":"…"}` (Feld `access_token`).
- **Web testen:** `apps/web/.env.local` = `NEXT_PUBLIC_DATA_SOURCE=api` → Web auf **http://localhost:3021** (Preview-Name `rsm-v2-web`).
- **iOS testen:** `cd apps/ios && xcodegen generate && xcodebuild -scheme RollsportManager -destination 'id=<sim>' -derivedDataPath build/dd build`,
  dann `simctl install/launch`. Booteter Sim: iPhone 16 Pro (UDID 8B12D95C-…). In-App Persona-Login.
- **Personas / Rollen:** owner=Jürgen Häberle · admin=Thomas Krüger · moderator=Petra Köhler · treasurer=Beate Schäfer ·
  coach=Sandra Vogel · member=Katrin Grünewald · guest=Milena Öztürk · platform=RSM Plattform-Admin. Demo-Verein: **RSV Neckarsulm**.
- **Gates vor jedem Commit:** `supabase/tests/run-tests.sh` · `services/api` typecheck+vitest · `packages/contracts` check.mjs · `apps/web` next build.
- **⚠️ Test-Harness braucht `HARNESS_HOST_PORT=55434`,** solange der fremde Container `rapportmanager-postgres-1` den Port 55432 hält.
  (`api-db-test.sh` liegt unter `services/api/scripts/`, nicht unter `scripts/`.)

## 4. Wichtige Regeln (nicht vergessen)
- Alt-Projekt `/Users/marcelgoldfuss/Apps/RollsportManager` (v1) NUR lesen. Nie zu rollsportmanager.de/Prod verbinden.
- Docker: nur `rsm2-pg-dev`/`rsm2-pg-test` anfassen; andere (Prod-)Container in Ruhe lassen.
- UI immer DE+EN mit echten Umlauten; Dark Mode; Beträge Mono/tabular. Löschen nie auto-bestätigen.
- **Budget:** Wochen-Limit war knapp — vor großen Läufen kurz abstimmen; kleine/gezielte Fixes ok.

## 5. Was „mach weiter" standardmäßig heißt
Ohne weitere Angabe arbeite ich **Abschnitt 2 von oben** ab — d. h. als Nächstes **RBAC (Punkt 1)**.
Willst du etwas anderes zuerst (z. B. „iPhone-Install", „iOS fertig", „Android", „v1 absichern"), sag es dazu.
