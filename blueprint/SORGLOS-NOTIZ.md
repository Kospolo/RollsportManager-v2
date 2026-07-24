# RollsportManager v2 — Sorglos-Notiz (Stand & „mach weiter")

**Zweck:** Alles an einem Ort. Du sagst einfach **„mach weiter"**, dann arbeite ich die
Reihenfolge unten von oben ab. **Stand: 2026-07-18.** (Wird nach jedem Meilenstein aktualisiert —
du sollst dich nie wiederholen müssen.)

Projekt: `/Users/marcelgoldfuss/Apps/RollsportManager-v2` · alles committet auf Branch `main`
(kein Remote; `apps/android/` bewusst untracked).

---

## 0. AKTUELLER STAND — 2026-07-18 (zuerst lesen; überschreibt ältere Prozentangaben unten)

**Arbeitsweise (nie mehr sagen müssen):** RICHTIG LESEN, NICHT RATEN — erst echten Code lesen + im
Browser/curl verifizieren, dann handeln. Offenlegen ist keine Behebung. Team-Muster: Marcel = CIO,
Fach-Agenten + Angreifer-Gegenprüfung vor dem „fertig". Genutzte Skills: database-designer,
senior-backend/-frontend, api-design-reviewer, ui-ux-pro-max, frontend-design, gdpr-dsgvo-expert,
code-reviewer, web-design-guidelines (via `find-skills` / `~/.claude/skills/`).

**📘 Original nachschlagen statt neu erklären: [`blueprint/ORIGINAL-VOLLREFERENZ.md`](ORIGINAL-VOLLREFERENZ.md)** —
vollständige v1-Referenz mit Fundstellen: Geschäftsmodell, alle Preise/Limits (inkl. **Schließfach-Miete
pro Fach + abweichendem Preis pro Vermietung**), Funktions-Inventar je Plattform, Datenmodell, Chef-Regeln,
priorisierte Lücken v1→v2.

**🟢 SPARTEN — Mehrsparten-Vereine (z. B. REV Heilbronn = Eiskunstlauf + Rollkunstlauf + Hockey).**
Marcel 2026-07-18: „Abteilungen" waren falsch — eine Abteilung ist eine **Sparte** (Sportbereich), nicht
eine Mitglieder-Gruppe. Die v1-App konnte das schon; v2 hatte es verloren.
- Modell: **Verein → Sparten → Teams → Mitglieder.** Mitglied in MEHREREN Sparten (n:m); Team gehört zu EINER Sparte.
- Sparte-Felder: Name, Icon, Farbe, Aktiv, Sortierung, Schalter **„eigene Finanzen"** (aus = Vereinskasse).
- **Rechte (Marcel wörtlich):** Sparten anlegen/bearbeiten nur **Super-Admin + owner(=Vorstand) + admin +
  Kassenwart(treasurer)** — sonst keiner. NICHT coach/member/**moderator** (Küren-Moderation ≠ Vorstand).
- Die alte „Abteilung" (`departments`) bleibt, wird im UI zu **„Gruppen"** umbenannt (zweite Achse).
- **Etappe 1 FERTIG, angreifer-geprüft:** Migr. **0062** (sparten + sparte_members + teams.sparte_id) ·
  **0063** (Team-Zuordnung) · **0064** (Härtung: gleicher-Verein-Trigger + teams.club_id immutabel).
  Guard `app.can_manage_sparten`. API `services/api/src/routes/sparten.ts` (6 Endpunkte). 1560/1560 SQL-Tests, Contract grün.
- **Etappe 2 (Web-UI) FERTIG** (`b127c4e` + `c003bbe` + `8fb9712`): Verwaltungsseite (CRUD, rollen-gegated) ·
  Mitglied↔Sparten (n:m) auf mitglieder/[id] · Team→Sparte auf teams/[id] · Sparten-Filter in /mitglieder + /teams ·
  Betreiber-Konsole-Sicht · „Abteilung → Gruppen" (nur Labels). Browser-geprüft owner+member. Dabei ein echter
  Gate-Leck gefixt (Verwaltungs-Buttons zeigten sich im Mock JEDEM — `c003bbe`).
- **Feinschliff offen (kein Blocker):** Speichern-Spinner/Label statt nur opacity · Farb-Swatch 36→44px Touch ·
  aria-Labels der Farb/Icon-Auswahl (liest heute Hex/interne Namen) · Dark-Mode-Kontrast dunkler Swatches ·
  Shell-Header nicht reaktiv auf Mock-Viewer-Wechsel (nur Anzeige, Gating korrekt).
- OFFEN (DSGVO, kein Blocker): sparte_members-Roster vereinsweit sichtbar (Marcel: so lassen, später eng ziehbar);
  Lösch-Runbook Art. 17 muss sparte_members miträumen.

**🟡 REGISTRIERUNG (Marcel 2026-07-18: „Verein + Mitglied per Vereinscode ODER Einladungs-E-Mail fehlt"):**
- **Verein-Selbstanlage: ✅ gebaut** (POST /clubs, clubs.ts; Name+Ort+30-Tage-Test+CSPRNG-Code; läuft im Dev).
- **Mitglied per Vereinscode: ✅ fertig** (POST /clubs/join → pending → Vorstand /approve; Drossel, Rotation,
  Ablehn-Gedächtnis, Enumerationsschutz, Art. 8; registration.ts).
- **Mitglied per Einladungs-E-Mail: ✅ fertig** (`228e8f7`, Angreifer BESTANDEN) — Migr. 0065 app.invitations
  (nur token_hash SHA-256, 14-Tage-Ablauf, ein offener pending je club+email); POST .../members/invite
  (enumerationssicher 202, Empfänger-Drossel), GET /public/invitations/{token}, POST /invitations/{token}/accept
  (legt AKTIVE Mitgliedschaft an — Token IST die Freigabe; Kenntnisnahme terms+privacy). Annahme-Seite
  apps/web/app/(auth)/einladung/[token]. Kinder weiter über Familienpfad. 1573 SQL-Tests, Contract grün.
  ⚠️ Verschickt real erst, wenn SMTP im Admin hinterlegt (Dev loggt den Link); APP_BASE_URL in Prod setzen.
- **Echtes Login (GoTrue): auf Branch b44883d, NICHT gemergt** (Timing-Enumerations-Mangel). Für Prod-Scharfschaltung.
- Blocker zum Prod-Scharfschalten: (1) GoTrue mergen+fixen (kann ich), (2) **SMTP-Zugang im Betreiber-Admin** (Marcel
  trägt Creds/Absender ein), (3) **Rechtstexte AGB/Datenschutz** (Inhalt von Marcel/Anwalt → append-only legal_documents).

**🟢 Weitere Landungen 2026-07-17/18 (auf `main`):** 360-Profil-Teile (Kontaktdaten, Trainer-Beurteilung,
Galerie-Foto-Markierung, Küren-Bild) · Selbst-Profil komplett editierbar **und in /profil** (`a77c941`) ·
Motto-Phantom-Fix — „Über mich" schrieb ins Leere (`11ff5cb`) · Team-Detailseite mit ganzem Kader (`233bc19`) ·
Küren im Profil anklickbar/abspielbar · **Finanzen pro Verein abschaltbar** · **Vereinslogo**.

**🟡 NATIVE (Marcel 2026-07-18: „iOS/macOS/Android/Windows fehlen alle"):**
- **iOS** (`apps/ios`, SwiftUI, 1052 Swift-Dateien): auf heutigen Contract-Stand, **baut grün, läuft im Simulator**
  (`82fe557`) **UND auf Marcels iPhone 16 Pro** (2026-07-18 erstmals installiert+gestartet, Dev-Build gegen Mac-IP).
  Geräte-Signing-Prozedur siehe Memory `reference_rsm_ios_device_install` (ASC-Key + `API_HOST=0.0.0.0` + DevConfig→
  192.168.1.168; Commit `1c3de97`).
  **iOS-Aufholjagd 2026-07-18 (alle angreifer-/prüfer-geprüft):** **Sparten komplett** (`9847304`: Endpoints +
  Verwaltung + Team→Sparte + Mitglied→Sparten, Gate owner/admin/treasurer+platform, NICHT moderator) ·
  **Team-Detail für Mitglieder + Selbst-Profil + Vereinslogo** (`c80e8b9`). RESTLICHE Lücken: Betreiber/Super-Admin ·
  Galerie-Markierung · Modul-Toggle.
  ⚠️ **iOS-TEST-FALLE:** `-devPersona` wird IGNORIERT, wenn schon eine Session gespeichert ist
  (SessionStore.swift:86 `guard !isAuthenticated`) → vor jedem Persona-Beweis `simctl uninstall`, sonst zeigt die App
  die Daten der VORIGEN Rolle (sah einmal wie ein Datenleck aus, war keins).

**🎨 DESIGN-RICHTUNG iOS (2026-07-18, vom Design-Team erarbeitet — Marcel: „iOS zu langweilig, jung UND alt nutzen es,
Jungen ist Optik wichtig"):** Leitidee **„Mensch statt Tabelle"** — Fläche, Farbe, lauter Name; Monogramm-Kachel 68pt
statt 40pt-Kreis (KEINE Kinderfotos, s.u.). Kernsatz: *der Konflikt ist nicht jung-gegen-alt, sondern ordentlich-gebaut
gegen schnell-hübsch* — größere Typo/Karten/Farbe/Haptik helfen BEIDEN. Verwaltung raus aus dem Startbild (heute
startet JEDE Rolle in der Buchhaltung), dafür Musik/Motto/Medaille/Countdown nach vorn.
Reihenfolge: (1) **Typo-Fundament** (8 feste Größen → Dynamic Type, body 14,5→17, minimumScaleFactor<0,9 raus) +
(1b) **Kür-Musik** — *im Bau* · (2) Mitgliederansicht (Karte pro Mensch, Beitrags-Ampel RAUS = Würde) ·
(3) zentraler Reduce-Motion-Modifier, dann Haptik (App hat 0) · (4) Kontrast-Fixes · (5) Filter/Gruppierung.
⚠️ **KORREKTUR:** Die Kür-Musik ist NICHT am Backend blockiert — iOS dekodiert `audio_url` nicht und
RoutinePlaybackEngine.swift:7-8 **täuscht das Abspielen vor** (Simulation). Wird gerade behoben.
⚠️ **GESPERRT:** keine Kinderfotos über den Member-Pfad, solange members.ts keine Einwilligungs-Wache trägt (0
consent-Treffer, während photo-tags.ts sauber gated ist) → Identität über Farbe/Monogramm/Medaillen/Küren.
⚠️ **Verboten:** Punkte-/Streak-Gamification (Kinder unter Druck), Gesten-only-Navigation, Kacheln ohne Text.
**App-ICON: ✅ erledigt** (`83d239b`) — aus v1 übernommen (Figuren über Rollschuh-Rad), Single-Size hell/dunkel/getönt.

**🟢 KÜR-MUSIK spielt wirklich (2026-07-18):** Ursache war schlimmer als beide Theorien — Seed-Pfade verschachtelt
(Route kann nur flache Keys), Traversal-Schutz hätte sie ohnehin abgelehnt, UND **die Seed-MP3s waren 10–23-Byte-
Attrappen** (es gab nie Audio; die Route-Kommentare dokumentierten das Problem statt es zu lösen). Behoben: echte
Seed-MP3s + flache Keys + serverseitige Auslieferung. ⚠️ **Dabei ein Kinderdaten-Leck geschlossen:** die Audio-Route
hing nur an `is_club_member` → ein Mitglied konnte die Musik ALLER Küren ziehen, auch fremder Kinder; jetzt an
`can_read_routine` gebunden. Bewiesen per Decoder-Dauer/Tempo/Loop, Fehlerfall ohne Fake-Fortschritt.
**🟢 TYPO-FUNDAMENT:** Beweis dass es tot war = Screenshots Standard vs. AX3 pixelgleich. ⚠️ `Theme.swift` ist
GENERIERT aus design/tokens.json — Handedit wäre beim nächsten `gen:swift` weg; Fix sitzt im Token + Generator, und
der Generator **bricht ab**, wenn der `ios.textStyle`-Anker fehlt (Regression kann nicht still zurückkommen).
919 Verwendungen skalieren, 132 Zeilen Kontrast-Fix, 5 AX3-Brüche gefunden+gefixt.
**Offene iOS-Mängel (Prüfer MAENGEL):** Play-Knopf auf der Küren-KACHEL fehlt (Bau-Agent deutete das als „erfüllt" um —
Prüfer hat's erwischt) · AX3 schneidet auf Teams/Sparten noch ab · 5 eingefrorene Textgrößen (Chat/Galerie/Rollen-
Matrix) · **Kür-BILDER haben denselben Pfad-Bug wie die Musik hatte** · RLS-Suite lief nicht (Harness hardcodet
Port 55432, dort sitzt der FREMDE Container rapportmanager-postgres-1 → `HARNESS_HOST_PORT`-Override nötig).

**🟢 FAHRGEMEINSCHAFTEN fertig (2026-07-18, Angreifer BESTANDEN):** Migr. **0066** (app.event_rides ·
app.event_ride_contacts = NUR die Rufnummer, eigene Policy · app.event_ride_riders) + **0067** (Härtung).
Fahrt anbieten (Abfahrtsort/Zeit/Plätze/Rufnummer/Notiz), Mitfahren für sich ODER das eigene Kind, beidseitig
absagen, Überbuchung blockiert. Web-UI im Termin-Detail (RidesPanel/RideCard/OfferRideSheet).
**Der Kniff bei der Rufnummer:** RLS schützt ZEILEN, nicht Spalten — die Fahrt muss weit sichtbar sein, die Nummer
eng. Deshalb eigene Tabelle mit eigener Policy (`may_see_ride_contact`): Fahrer + AKTIV Zugesagte + deren Vormünder +
Verwaltung. Wer absagt, verliert die Nummer wieder. Redaktion in der DB, nicht in einer vergessbaren `redact()`.
⚠️ Erste Runde war DURCHGEFALLEN: Fahrer:in konnte eine vom Vormund ABGESAGTE Zusage eines FREMDEN Kindes
reaktivieren (201), und Rufnummer-Löschen meldete Erfolg ohne Wirkung. 0067 schließt beides (BEFORE-Trigger, weil nur
er OLD sieht → eine Wiederbelebung IST fachlich eine neue Zusage; + DELETE-Policy). 1623/1623 Tests grün.
Offen: `supabase/scripts/db-test.sh` schlägt seit ~60 Migrationen fehl (Assertion „23 Tabellen" nie nachgezogen).
- **macOS / Windows:** noch keine eigene App. macOS aus der iOS-SwiftUI-Basis holen; Windows braucht eine
  Grundsatz-Entscheidung (kein gemeinsamer Unterbau) — wird vorgelegt, wenn dran.
- **Android** (`apps/android`, ~64 Kotlin-Dateien): existiert dünn, volle Parität nachzubauen.

**➡️ Reihenfolge jetzt:** Web-Sparten fertig → **iOS-Sparten** → macOS → Android → Windows-Weg.

**🟢 Betreiber-Konsole gefixt (2026-07-18):** (a) „Zum Vereinsportal" führte als Plattform-Admin (kein eigener
Verein) stur auf `/dashboard` → „Daten konnten nicht geladen werden". Jetzt: Knopf → **Vereins-Auswahl** (/vereine)
wenn kein Verein aktiv, sonst ins Portal; neuer `OperatorPortalGate` fängt „Admin ohne Verein" ab (`ec5ba7b`,
Angreifer BESTANDEN, Audit-Weg via ViewClubButton bleibt). (b) In **Verwaltung → Rollen** ist die geschützte
**Inhaber:in-Rolle aus Rechte-Matrix + Rollen-Liste ausgeblendet** (`d7e5836`, nur Anzeige; im Personen-Reiter bleibt
sie). Rest-Kosmetik: Sidebar zeigt im Gate-Zustand noch „RSV Neckarsulm" (DEV_CLUB_ID-Fallback) — kein Leck.

**⚠️ RESUME-FALLE Dev-DB-Migrations-Drift (2026-07-18):** Die Dev-DB (`rsm2-pg-dev`) hing auf Migrations-Stand **0019**
(System-Seite zeigt „zuletzt angewandt: 0019_platform"), obwohl das Schema real bis 0065 reicht → Spalte
`clubs.logo_asset_id` (0060) fehlte → `/platform/clubs` warf **500** und riss die GANZE Betreiber-Konsole mit
(Küren/Tickets/… „konnten nicht geladen werden" = Kaskade). `dev-stack.sh up` merkt das NICHT (skippt bei
vorhandenem Schema). Non-destruktiver Fix: fehlende Migration per `docker exec -i rsm2-pg-dev psql … < 00XX.sql`
nachziehen (0060 war's). Sauberer Fix `dev-stack.sh reset` (wischt DB) — vom Sandbox-Classifier geblockt, muss Marcel
selbst laufen lassen. Bei „Daten konnten nicht geladen"/500 im Betreiber ZUERST Drift prüfen (Drift-Sweep-SQL).

**Betrieb:** Rechner ist am 2026-07-18 abgestürzt — Live-Prod (Docker: keto_*/supabase/…) kam sauber hoch,
nichts korrumpiert. Platte knapp (~55 GB frei, 94 %): vor Builds `df -h`, Build-Reste wegräumen (per `mv`, `rm -rf`
wird geblockt). Dev-Stack läuft: Web :3021 (eigener `next dev`, hängt an dieser Sitzung), API :3022 (`dev-stack.sh up`).

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
    **Seit 0074 zusätzlich zweckgebunden** (2026-07-24): der Betreiber ist owner-gleich nur noch in **9 von 33**
    Fähigkeiten (`app.operator_capabilities`, Allowlist, fail-closed). Trainer-Notizen über Kinder,
    Schließfach-Mieten und die gesamte Finanz-Fläche sind für ihn **zu** — siehe „ERLEDIGT (2026-07-24)" unten.
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

### 🔜 360°-ATHLET:INNEN-PROFIL (beauftragt 2026-07-17 — Marcel: „das ist mir zu wenig für was das System hergibt")
> **UMFANG = das VOLLE Profil, noch größer, ALLES AM STÜCK** (Marcel-Entscheidung, Mockup abgesegnet).
> **Erst bauen, wenn `wolyp23l7` (Karten-Politur) UND `wuvc7fi08` (Sichtbarkeit öffentlich/intern) committet sind** —
> sie sitzen in `members.ts`, `validation.ts`, Contracts, Seed, Detailseite (Migr. 0053 = `0053_selbstprofil_publikum`).
> Die Detailseite `[id]/` wird zum digitalen Vereinsausweis + Steckbrief. Sektionen (alle serverseitig rollen-gestaffelt):
> **Zusätzlich zu den 6 Punkten unten (noch größer, Marcel):** Notenverlauf als DIAGRAMM (routine_scores über Zeit),
> persönliche BESTLEISTUNGEN, Trainingsplan/Übungen-Fortschritt (training_slots/exercises), Check-in-Historie (checkins),
> Termine der Person kommend+Historie (event_rsvps, 28 Stück), Ausrüstung (equipment_reservations), VOLLE Finanz-Sektion
> nur Kasse/Vorstand (invoices/member_fees/sepa_mandates/donations/Mahnstatus), Rollen (member_roles), Abteilungen
> (departments), Konsent-Übersicht (was hat die Person eingewilligt), QR-Vereinsausweis (checkins nutzt schon QR).
1. **Kontaktdaten** E-Mail/Geburtstag/**Telefon (neu)**/**Postanschrift (neu)**: sichtbar für Vorstand/Admin/Moderator/Kasse
   (wie heute) **+ Trainer:in — aber NUR für Mitglieder IHRER eigenen Teams** (Marcel 2026-07-17). Der Trainer sieht
   die Adresse fremder Kinder aus nicht-betreuten Teams NICHT. Felder auch im Profil eintragbar.
   ⚠️ `member_contact/coach` ist heute bewusst `none` (0023:180) — das ist die kontrollierte Ausweitung, team-begrenzt.
2. **Küren** des Mitglieds auf dem Profil, **mit Bild wenn vorhanden** (Küren haben heute nur Audio, kein Bild-Feld → neu).
3. **Trainer-Beurteilung (NEU, ganze Tabelle):** schriftliche Einschätzung. Schreiben: Trainer:in des Teams.
   **Lesen: Staff (Trainer/Vorstand/Kasse/Moderator) + die Familie** (Person selbst + Erziehungsberechtigte,
   `can_act_for_member`) — Marcel 2026-07-17. Eltern-Auskunftsrecht.
4. **Medaillen** (`achievements`, existiert) auf dem Profil anzeigen.
5. **Pflichtstunden** (`duty_entries`, existiert): auf dem Profil **nur für Staff** (Trainer/Kasse/Moderator/Vorstand).
6. **Galerie-Markierung (NEU):** „diese Person ist auf dem Bild". **Markieren nur Staff.** Ein markiertes Foto
   erscheint auf dem Profil **nur bei vorliegender Foto-Einwilligung** (`consents`, Zweck `photos_internal`, existiert);
   Person/Eltern können Entfernung verlangen — Marcel 2026-07-17.
> Alle Sichtbarkeiten SERVERSEITIG (Projektion in `members.ts` + RLS), nicht nur im UI ausblenden. Kinder im System.


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

### ✅ ERLEDIGT (2026-07-18) — „Profil-Klickwege" komplett
1. **Selbst-Profil in /profil** eingehängt (SelfProfileCard: Motto/Disziplin/seit-wann + öffentlich/intern-Schalter),
   `a77c941`, angreifer-geprüft (intern → normale Mitglieder sehen es nicht, Vorstand/Trainer schon).
2. **Küren im 360-Profil anklickbar** → öffnet /kueren/{id} + Player (`4a2bceb`).
3. **Motto-Bug gefunden+behoben:** das alte AboutMeSheet schrieb auf ein Phantom-Feld `about_me` (422 im API-Modus);
   jetzt auf `profile_motto` via set_self_profile (`11ff5cb`).
4. **Team-Detailseite** mit ganzem Kader → Mitglied → Profil (`233bc19`).
Offener Folge-Nachzug: Mitglieder-**Detail**seite liest „Über mich" evtl. noch über einen eigenen about_me-Pfad
(gleiche Bug-Klasse) — bei Gelegenheit prüfen.

### ✅ ERLEDIGT (2026-07-24) — Betreiber-Zweckbindung (Befund B4 der Gesamtprüfung)
**Der Befund:** Der Plattform-Betreiber las **interne Trainer-Notizen über Kinder im Klartext** und
**alle Schließfach-Mietverträge** (welches Kind, welches Fach, welcher Preis) — dazu SEPA-Mandate und Rechnungen.
Ursache: `app.cap_rank` gab bei eingeschalteter Betreiber-Einsicht **pauschal Rang 5 für JEDE Fähigkeit** (0051),
und die Middleware schaltet die Einsicht bei **jedem** Plattform-Request ein.

**Der gewählte Weg — Migration `0074_betreiber_zweckbindung.sql`:** eine **Allowlist** (`app.operator_capabilities`),
kein Denylist-Flicken. Grund: eine Denylist ist fail-**open** — die nächste neue Fähigkeit läge sofort offen.
Die Allowlist ist fail-**closed**: eine neue Fähigkeit ist für den Betreiber automatisch gesperrt, bis jemand sie
mit Begründung einträgt (Art. 25 Abs. 2 DSGVO, „Datenschutz durch Voreinstellung").
- **Offen (9):** members · roles · club_settings · departments · teams · team_coaches · routines · routines_edit · anniversaries.
- **Zu (24):** u. a. coach_notes · lockers · finance · member_contact · attendance · checkins · chat · documents.
- `can_manage_finance` ist zusätzlich zweckgebunden (41 Aufrufstellen) → die ganze Finanz-Fläche in EINER Funktion zu.
- Die Allowlist ist **zur Laufzeit unveränderlich** (Trigger, auch gegen `service_role`) und für Vereine **lesbar**:
  zusammen mit `app.operator_audit_log` sieht der Verein, was der Auftragsverarbeiter DARF und was er GETAN hat.
- **Der protokollierte Weg bleibt unversehrt:** 19 von 19 Betreiber-Requests der Smoke-Suite hinterlassen eine
  Protokollzeile — auch die abgewiesenen. Neu gemessen statt behauptet: `api-db-test.sh` Schritt 4 und
  `services/api/test/operator-audit-fail-closed.test.ts` (Protokoll-Ausfall ⇒ 503, Nutzlast verlässt den Prozess nicht).

**Falsch beruhigende Tests korrigiert:** `99pB` Block E maß den Betreiber **ohne** die Sitzungsvariable, die die echte
API immer setzt (Ergebnis „0 Verträge" war Zufall — echt waren es 5). `99pA` maß den Betreiber gar nicht. Beide messen
jetzt den echten Betriebszustand, mit Gegenprobe. **Gegenprobe gefahren:** beide Regressionen künstlich wieder
eingebaut → 99e/99pA/99pB gehen rot, ebenso die Middleware-Mutation.

**Gates:** SQL 1863 ✅ (war 1809) · api tsc/vitest 273 ✅ · api-db-test ✅ · contracts ✅ · web tsc+build ✅ ·
iOS+macOS xcodebuild ✅ · Android assembleDebug ✅.

**⚠️ Bewusst NICHT geschlossen (offener Punkt, benannt statt versteckt):** `app.is_club_trainer` behält den pauschalen
Override — sie gated 30 Policies, davon 22 **schreibende** (news, exercises, training_slots, media …), die 0051 dem
Betreiber ausdrücklich gibt. Er erreicht dadurch weiterhin: **checkins** (wer wann in der Halle war), **Team-Chat**
(Direktnachrichten waren nie offen), waitlists, duty_entries, event_rsvps, documents, member_assessments
(die offizielle Beurteilung — die liest die Familie ohnehin, anders als die interne Notiz). Das zu schließen ist eine
**eigene Entscheidung** des Chefs, weil sie dem Betreiber in derselben Zeile Schreibrechte nimmt.
