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
- **Großer Tag 2026-07-16/17 — gebaut, geprüft, committet auf `main` (bis ~1386 SQL-Tests):**
  - **RBAC Phase 2+3:** Mehrfachrollen wirken durch die API, Küren-Split, **einstellbare Rechte-Matrix** unter
    Verwaltung → Rollen&Rechte. Dabei zwei Lecks gefunden & geschlossen (Jubiläums-`joined_on`, `team_coaches`-View).
  - **Registrierung:** Verein legt sich selbst an, **Beitritt per Vereinscode = Antrag → Vorstand gibt frei**,
    Rotation mit Überlappung, Ablehnung mit Gedächtnis, 3-Achsen-Drossel, Einwilligung (Art. 8 erzwungen). Vereinscode
    nicht mehr in der Auslieferung (war an jedes Mitglied geleakt). **Art.-9-Leck** (Krankmeldungen von Kindern) zu.
  - **Chat:** Kinderschutz bei Direktnachrichten (Erwachsene↔fremde Kinder gesperrt). ⚠️ **Offen, deine Entscheidung:**
    Vorstand/Trainer lesen Team-Chats mit (seit 0011, ein Bestands-Test friert es ein) — Kinder schreiben dort.
  - **Modul-Schalter pro Verein** (serverseitig, ehrliche „wirkt-noch-nicht"-Etiketten).
  - **Termine:** Mitglied sieht nur seine Team-Termine + Vereinsveranstaltungen; das Vereinstermin-Häkchen nur Vorstand.
  - **Betreiberkonsole:** Plattform-Admin sieht/verwaltet alle Vereine — **jeder Zugriff protokolliert**
    (`app.operator_audit_log`, append-only, auch vom Betreiber nicht löschbar). Support-Tickets, Dashboard,
    Vereins-Umschalter, Küren-Moderation. **Zweite protokoll-freie Tür geschlossen** (members.ts, Commit heute).
  - **Mitglieder-Seite:** Redesign (Karten statt Tabelle) + **Selbst-Profil** + Trainingsbeteiligung nur noch
    read_own für Mitglieder (Lese-Policy umgestellt: `app.can_read_attendance` — schließt die Phase-1-„none sperrt nur
    Schreiben"-Lücke), `joined_on` jetzt auch für Coach.
  - **⚠️ Regel-Ausnahme dokumentiert:** 3 Bestands-Tests (93_rbac/93b/93j) wurden geändert (`M`), NICHT nur ergänzt —
    aber als **Verschärfung** (Wächter der Lücke → Wächter des Fixes), selbst nachgeprüft und abgezeichnet. Das ist
    die eine legitime Ausnahme von „nur A, kein M": wenn ein Bestands-Test eine behobene Schwäche zementierte.
- **⚠️ Betrieb: die Platte lief 2× voll und kippte die Live-Prod (ketotracker.de u.a.).** VOR parallelen Agenten-Läufen
  `df -h /System/Volumes/Data` prüfen (unter 20 GB: nicht parallelisieren). Test-Container/Worktrees nach jedem Lauf
  abräumen. Harness braucht `HARNESS_HOST_PORT` **und** `HARNESS_CONTAINER`. **KetoTracker-Backup war seit 12.07. tot**
  (`docker exec pg_dump` scheiterte an voller Platte) — hängt an genau einer Kopie, gehört über TCP :5544 gefixt.

## 2. Was NOCH zu tun ist (Reihenfolge = „mach weiter")
> Web zuerst fertig war die Vorgabe — Web ist fertig. Reihenfolge jetzt:

1. **RBAC — konfigurierbares Rechte-System** (genehmigt, Spec: `RBAC-DESIGN.md` — **BEIDE Korrektur-Blöcke oben zuerst
   lesen**, sie überschreiben den Rest). 4 Durchläufe: ~~Kern-Backend/RLS~~ ✅ → ~~API+Contracts (Phase 2)~~ ✅ →
   **Web-Admin-UI (Phase 3, läuft als `wofh0duoj`)**: editierbare Matrix, eigene Rollen, Mehrfachrollen,
   Trainer-Mehrfachteams → Verifikation.
   - **Phase 2 ✅ (Migr. 0027–0029, `routes/roles.ts`, `lib/capabilities.ts`, 711/711 SQL-Tests):** Mehrfachrollen wirken
     durch die API — live bewiesen mit **gleichem Token**: `403` → Zweitrolle → `200` → entzogen → `403`.
     Dabei geschlossen: `team_coaches` war ein mandantenübergreifender Lese- **und Lösch**-Bypass (View ohne
     `security_invoker`); `/reports/anniversaries` gab Kinder-Geburtsdaten heraus (`date − years` = exaktes Datum).
   - **Von Marcel entschieden (2026-07-16):** (a) Austritt/Soft-Delete entzieht Rechte **sofort**, für alle Rollen.
     (b) Küren-Split (Lesen/Bearbeiten getrennt einstellbar). (c) Jubiläen: **Tag+Monat ohne Jahre** statt 403.
     (d) Trainerin darf sich **nicht selbst** fremde Teams geben. (e) **Geschützte Fähigkeiten** (lockers/member_contact/
     finance) darf nur der Inhaber ändern — sonst hebelt ein Moderator die Schließfach-Privacy per Matrix selbst aus.
   - **Noch offen:** `none` sperrt bisher nur SCHREIBEN, nicht LESEN → das UI darf `none` **nicht als „abgeschaltet"
     anzeigen**, solange die SELECT-Policies nicht umgestellt sind. Performance von `cap_rank` ungemessen
     (vor Prod `EXPLAIN ANALYZE`). ~81 `requireClubRole` in 29 Dateien hängen noch am Claim — **fail-closed**
     (API strenger als die DB), aber dort wirken Mehrfachrollen noch nicht.
     ⚠️ Ein blinder Tausch auf `has_cap` **lockert** bei `teams.ts`/`events.ts` — die API ist dort strenger als ihre
     eigene Policy, und **kein Test prüft diese Strenge**.
2. **Registrierung + DSGVO + Botschutz** (neu am 2026-07-16 von Marcel beauftragt, Recherche lief als `wcixbacpt`).
   Heute gibt es nur den Dev-Persona-Login — **es kann sich weder ein Verein noch ein Mitglied selbst anmelden.**
   - **ALLE ENTSCHEIDUNGEN GETROFFEN (2026-07-16) — der Bauplan kann direkt los:**
     1. **Vereine und Mitglieder** (nicht Firma/Mitarbeiter — war ein Versprecher).
     2. **Vereinscode = ANTRAG, nicht Zutritt.** Code richtig → `status='pending'` → Vorstand gibt frei → `active`.
        Kostet fast nichts: seit 0025 heißt Mitgliedsein wörtlich `status='active'`; `pending` = leeres Rollen-Array
        = fällt durch **alle ~110 Policies auf 48 Tabellen**. Freigabe = ein `UPDATE`, wirkt sofort ohne Re-Login.
        Ist zugleich der beste Botschutz: ein Bot mit geratenem Code kommt bis `pending` und keinen Schritt weiter.
     3. **Verein legt sich selbst an + Testphase** (Spond-Muster), nur Vereinsname + Ort. Zahlung erst beim Upgrade.
        Erst freigeben, wenn das Rate-Limit steht.
     4. **GoTrue** stellt die Tokens aus, strikt hinter der Hono-API — nie aus dem Browser erreichbar.
     5. **Bewerbung ohne Code**: nur Option, **Default AUS**, einschaltbar im Super-Admin. Nicht jetzt bauen
        (das Datenmodell aus Schritt 1 lässt es später zu — derselbe `pending`-Pfad).
   - **⚠️ Vereinscode-Bau:** hohe Entropie (CSPRNG, **nie** `random()` wie v1), Versuchs-Limit auf **drei Achsen**
     (IP, Konto, **und pro Code global** — die dritte kann kein Proxy und kein CAPTCHA liefern), widerrufbar/rotierbar.
   - **KEIN GoTrue-Claims-Hook bauen** — der größte Streichposten. Er schriebe nur `club_roles` in den Token, und die DB
     liest das seit 0025 nicht mehr. Der Token braucht nur `sub`. Zwei Recherchen nannten ihn „Blocker Nr. 1" — falsch.
   - **KEIN CAPTCHA/Turnstile** in v2.0: beantwortet „ist das ein Mensch?", die Frage hier ist „gehört der in DIESEN
     Verein?" — die beantwortet der Vorstand. Turnstile schickte IPs von Eltern Minderjähriger an Cloudflare/USA.
   - Echte Blocker: **Mailversand** (`services/api/package.json` hat **keinen** Mail-Client; das SMTP-Formular ist gebaut
     und komplett folgenlos) · **Rechtstexte/AVV/DPIA** (Anwaltssache; DPIA wohl Pflicht: Kinder + `sick` + Mandanten-SaaS)
     · `internal.platform_settings` ist ein **id=1-Singleton per UPSERT** → nicht rekonstruierbar, welchem Text jemand
     zugestimmt hat → jeder Einwilligungsnachweis wertlos (braucht append-only `legal_documents` + `policy_version`).
   - **⚠️ Landing-FAQ behauptet Unwahres** (`_landing/i18n.ts:115`): „AVV liegt bei" + „Daten jederzeit exportieren" —
     beides gibt es nicht. Nicht live (v2 ist nirgends deployt), aber vor dem Start streichen oder einlösen.
   - **⚠️ Art.-9-Leck, unabhängig von der Registrierung:** `rsvp_status` kennt `'sick'` (0003:23) + Freitext-Kommentar,
     `event_rsvps_select` ist blank `is_club_member` (0003:231-233) → **jedes Mitglied liest, dass Kind X krank ist.**
     Gesundheitsdaten Minderjähriger. Braucht keinen Contract-Bruch. Gehört in den nächsten Lauf.
   - Kinder-Modell ist **schon richtig gebaut**: `club_members.profile_id` nullable („NULL = child without account",
     0002:72) + `guardianships`. Für Art. 8 heißt das: unter 16 kein Selbst-Signup, sondern Profil ohne Login,
     angelegt vom Elternteil. Lücken: `family.ts:105-106` setzt hart `'active'` statt `pending`; `birth_date` wird
     gespeichert, aber **nie ausgewertet** — es gibt keine Altersschwelle im Code.
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
10. **v1-Produktion — Marcel hat am 2026-07-16 entschieden: NICHTS TUN, v2 kommt.** Nicht mehr vorschlagen, außer er fragt.
   Der Befund ist trotzdem hier festgehalten, falls er es sich anders überlegt — **alle drei selbst nachgeprüft**:
   - `www/portal/register.html:380` prüft den Einladungscode **im Browser** gegen PostgREST (anon-Key), ungedrosselt,
     und gibt bei Treffer den Vereinsnamen zurück → login-freies Brute-Force-Orakel.
   - `supabase/migrations/20260118_sync_ios_android_models.sql:47`: Code = `UPPER(SUBSTRING(MD5(RANDOM()::TEXT)...))`
     → Postgres' `random()` ist **kein** Krypto-Zufall.
   - `20251230_initial_schema.sql:335`: `FOR UPDATE USING (id = get_current_user_id())` prüft **nur die id** →
     jede andere Spalte der eigenen Zeile ist frei schreibbar, **inklusive `verein_id` und `rolle`**.
     Jeder Eingeloggte kann sich per Browser in einen fremden Verein setzen.
   Das saubere Vorbild steht in v1 selbst: `20260201_guest_trainer_access.sql:112` nutzt `gen_random_bytes(32)`
   mit `expires_at`, serverseitig eingelöst.

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
