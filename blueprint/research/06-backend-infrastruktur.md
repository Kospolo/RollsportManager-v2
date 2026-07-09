# 06 — Backend & Infrastruktur (Ist-Analyse RollsportManager)

**Rolle:** Backend/DevOps-Ingenieur
**Datum:** 2026-07-09
**Analysierte Codebase:** `/Users/marcelgoldfuss/Apps/RollsportManager/rollsportmanager-backend` (nur Lesezugriff)
**Produktions-URL:** https://rollsportmanager.de (lokaler Docker auf dem Mac Studio, TLS via Nginx Proxy Manager)

---

## 1. Überblick

Das Backend ist ein **self-hosted Supabase-Stack** (13 Container via `docker-compose.yml`), der auf dem privaten Mac Studio des Entwicklers läuft und über Nginx Proxy Manager (NPM) unter `rollsportmanager.de` ins Internet exponiert wird. Darauf setzen auf:

- **PostgreSQL 15.8** (supabase/postgres:15.8.1.085) mit ~62 Tabellen, 141 RLS-Policies, ~100 SQL-Funktionen, 32 Triggern (gezählt über `migrations/*.sql`)
- **PostgREST** als einzige "API-Schicht" — es gibt **keinen eigenen Applikationsserver**; sämtliche Business-Logik lebt in SQL-Funktionen (RPC, SECURITY DEFINER), RLS-Policies, DB-Triggern und Client-Code
- **6 Deno Edge Functions** (`functions/`): Stripe-/PayPal-Webhooks, E-Mail-Versand, Push-Notifications
- **1 Node-Worker auf dem Host** (`workers/push-worker.js`): arbeitet die `push_queue`-Tabelle ab und sendet APNs-Pushes
- **Statische Website + Web-Portal + Admin-Panel** (`www/`, 129 HTML-Dateien, Vanilla JS) in einem Nginx-Container, der gleichzeitig als Reverse-Proxy vor Kong hängt

Es gibt **keine CI/CD, kein Staging, keine Infrastruktur-Automatisierung, kein Monitoring/Alerting** und für das Backend-Repo **kein Git-Remote** (nur lokale Historie). Migrations werden manuell per SQL-Editor/psql eingespielt; Hotfixes liegen teils als `FIX-*.sql` im iOS-Repo. Die Sicherheitslage ist kritisch (öffentlich bekannter Demo-JWT-Secret in Produktion, Secrets im Git, offene Edge Functions) — siehe Security-Audit vom 13.06.2026.

**Fazit vorab:** Der Stack funktioniert als Ein-Personen-Betrieb erstaunlich vollständig, ist aber in fast jeder Betriebsdimension (Sicherheit, Deploy, Migrationen, Backup, Verfügbarkeit) ein Prototyp, der als Produktion betrieben wird. Für v2 sollte die Supabase-Idee (Postgres + RLS + Realtime) beibehalten, aber auf ein sauber verwaltetes Fundament gestellt werden — plus eine echte API-Schicht für Business-Logik.

---

## 2. Ist-Zustand im Detail

### 2.1 Hosting-Topologie

| Ebene | Realisierung | Beleg |
|---|---|---|
| Hardware | Mac Studio (privates Heimnetz, 192.168.1.220), gleicher Host wie KetoTracker-Prod, Ollama, NPM u. a. | Memory/Netzwerk-Doku |
| TLS/Ingress | Nginx Proxy Manager (Docker-Netz `npm_proxy`), Website-Container joint das Netz | `www/docker-compose.yml` (networks: `npm_proxy` external) |
| Web | Nginx-Container `rollsportmanager-website` (Port 8080→80), statische Dateien werden **beim Build in das Image kopiert** | `www/Dockerfile`, `www/nginx.conf` |
| API | Kong 2.8.1 (Ports 8000/8443), dahinter GoTrue, PostgREST, Storage, Realtime, Edge-Runtime | `docker-compose.yml` Zeilen 63–91 |
| DB | supabase-db (Postgres 15.8), Daten als Bind-Mount `./volumes/db/data` (aktuell ~1,3 GB) | `docker-compose.yml` Zeile 408 ff. |
| Pooler | Supavisor, **publisht Port 5432 auf dem Host** (Transaction-Mode 6543 ebenfalls) | `docker-compose.yml` Zeilen 500–502 |
| Autostart | Docker-Watchdog-LaunchAgent (`com.claude.docker-watchdog.plist`) + `restart: unless-stopped`; die in der Doku genannten LaunchAgents `com.rollsportmanager.*` existieren nicht mehr | `~/Library/LaunchAgents/`, vgl. `SERVER_ADMIN_GUIDE.md` Zeilen 18–42 (veraltet) |

Der Nginx-Website-Container proxied zusätzlich `/rest/v1/`, `/auth/v1/`, `/storage/v1/`, `/functions/v1/` und ein generisches `/api/` auf Kong (`www/nginx.conf`). D. h. die öffentliche Domain bedient Website **und** komplette Supabase-API über denselben Vhost — mit `Access-Control-Allow-Origin: *` auf allen API-Locations.

### 2.2 Supabase-Self-Hosting-Setup

- `docker-compose.yml` (Repo-Root, 549 Zeilen) ist das offizielle Supabase-Self-Hosting-Compose, leicht angepasst:
  - Kong-Puffer massiv erhöht für **Base64-Media-Uploads**: `KONG_NGINX_PROXY_PROXY_BUFFER_SIZE: 512k`, `CLIENT_MAX_BODY_SIZE: 100m` (Zeilen 82–86) — Symptom der Entscheidung, Medien Base64-kodiert in Postgres statt in Storage zu halten (`CLAUDE.md`: "kuer_media | Kür-Medien (Base64)"; `volumes/storage` ist **0 Byte groß**, die DB 1,3 GB).
  - Storage-Container mit `STORAGE_FILE_XATTR_ENABLED: "false"` und Bind-Mount als macOS-Workaround (Zeilen 243–284).
  - Edge-Runtime bekommt APNs- und Stripe-Secrets als Env (Zeilen 344–352).
- Daneben existiert `docker-compose-simple.yml` (abgespeckte Variante) sowie ein **komplett paralleler Supabase-CLI-Baum** `supabase/` (eigenes `config.toml`, eigene `functions/`, eigene `migrations/`) — Reste des lokalen CLI-Setups (`supabase start`, Ports 54321 ff., siehe `SUPABASE-INFO.md`). Prod läuft aber über das Root-Compose. Zwei Wahrheiten für dieselbe Konfiguration.
- `config.toml` (Root + Kopie in `supabase/`) ist die CLI-Dev-Konfiguration und widerspricht Prod in Punkten wie `major_version = 17` (Prod: Postgres 15) und `jwt_expiry = 3600` (Prod-`.env`: `JWT_EXPIRY=604800` = 7 Tage!). Zusätzlich steht in `config.toml` Zeile 214–221 der **Strato-SMTP-Zugang inklusive Klartext-Passwort** — und die Datei ist git-getrackt.

### 2.3 API-Gateway (Kong)

`volumes/api/kong.yml` ist die deklarative Standard-Konfiguration mit einem gravierenden Befund: Die Routen mappen die neuen `sb_publishable_…`/`sb_secret_…`-API-Keys per Lua-Inline-Expression **hart auf die öffentlich bekannten supabase-demo-JWTs** (`iss: supabase-demo`, dieselben Beispiel-Keys aus der Supabase-Doku). Kombiniert mit dem Demo-`JWT_SECRET` in `.env` heißt das: **Jeder, der die Supabase-Doku kennt, kann sich einen gültigen `service_role`-Token signieren und sämtliche RLS umgehen** (Befund K1 des Audits vom 13.06.2026, weiterhin offen). Dashboard-Zugang via `DASHBOARD_USERNAME/PASSWORD` (basic-auth) ist konfiguriert.

### 2.4 Auth / GoTrue

- E-Mail-Signup mit Bestätigung (`ENABLE_EMAIL_AUTOCONFIRM=false`), SMTP über Strato (`.env`: `SMTP_HOST=smtp.strato.de`, Port 587).
- `JWT_EXPIRY=604800` (7 Tage Access-Token) — sehr lang für eine App mit Zahlungsdaten.
- Redirects: `SITE_URL=https://rollsportmanager.de`, App-Deep-Links `rollsportmanager://auth` (`config.toml` Zeile 150).
- Registrierung läuft über eine eigene RPC `register_user` (SECURITY DEFINER, `migrations/20260216_register_user_rpc.sql`), weil PostgREST-INSERT an RLS scheiterte; inkl. Nachbesserung `20260219_fix_register_rpc_no_session.sql` — typisches Muster: Auth-Sonderfälle werden in DB-Funktionen gepatcht.
- MFA, Captcha, OAuth-Provider (Apple/Google): alles deaktiviert.

### 2.5 Edge Functions (`functions/`, gespiegelt in `volumes/functions/` und `supabase/functions/`)

| Function | Zeilen | Zweck | Bewertung |
|---|---|---|---|
| `stripe-webhook` | 346 | Zahlungseingang → `payments`-Insert, `invoices` auf `bezahlt`, Push | Signaturprüfung selbst implementiert (HMAC ok, aber kein konstanter Zeitvergleich); laut Audit nur Test-Modus, `STRIPE_WEBHOOK_SECRET=whsec_PLACEHOLDER` |
| `paypal-webhook` | 451 | wie oben für PayPal; Credentials **pro Verein** aus Tabelle `verein_payment_config` | Verifikation über PayPal-API vorhanden; Vereins-Secrets liegen im Klartext in der DB (`ZAHLUNGSSYSTEM_STATUS.md`) |
| `send-push-notification` | 469 | APNs (JWT/HTTP2) + FCM (Legacy-Server-Key!) direkt | `APNS_PRODUCTION=false` in Prod-`.env` → iOS-Pushes gehen an die **Sandbox**; FCM-Legacy-API ist abgekündigt |
| `send-beta-welcome` / `send-parent-invitation` | 224/222 | Mails via denomailer/SMTP | Templates inline im Code |
| `send-test-email` | 91 | nimmt **SMTP-Host, User, Passwort und Empfänger aus dem Request-Body** | zusammen mit `FUNCTIONS_VERIFY_JWT=false` (`.env`) de facto ein offener Mail-Proxy |

Alle Functions setzen `Access-Control-Allow-Origin: *`. Der Router `volumes/functions/main/index.ts` reicht `Deno.env` komplett an jede Function durch. **`FUNCTIONS_VERIFY_JWT=false` bedeutet: alle sechs Endpunkte sind ohne Authentifizierung aufrufbar** (für Webhooks nötig, für Mail/Push nicht — es fehlt eine Per-Function-Konfiguration).

### 2.6 Workers

`workers/push-worker.js` (319 Zeilen, Node 20 vom Homebrew-Pfad):
- Pollt alle 30 s `push_queue` + Realtime-Subscription auf INSERT; verarbeitet Team-/Verein-/User-Targets, filtert nach `notification_settings`, deaktiviert ungültige Tokens. Solides Muster (Outbox in der DB, `migrations/20260109_push_triggers.sql` befüllt die Queue per Trigger).
- **Aber:** Es existiert kein LaunchAgent/Supervisor für den Worker — er muss manuell über `workers/start-push-worker.sh` gestartet werden, und dieses Script enthält **hartkodiert den SERVICE_ROLE_KEY und den Base64-kodierten APNs-Private-Key** (git-getrackt). `APNS_PRODUCTION="false"` auch hier. Android-Pushes verarbeitet der Worker gar nicht (nur `platform === 'ios'`, Zeile 206) — FCM existiert nur in der Edge Function.
- Funktionale Dopplung: Push-Versand ist zweimal implementiert (Edge Function `send-push-notification` **und** Host-Worker).

### 2.7 Migrations-Hygiene — der größte Altlast-Komplex

Vier konkurrierende Orte für Schema-Änderungen, **kein Runner, keine Versionstabelle, keine Down-Migrationen**:

1. `migrations/` (34 Dateien, `20251230_initial_schema.sql` … `20260225_super_admin_role.sql` + unversioniertes `add_language_column.sql`)
2. `supabase/migrations/` — Kopie, aber **zwei Dateien weniger** (es fehlen `20260225_super_admin_role.sql` und `add_language_column.sql`) → die Bäume sind bereits divergiert
3. `sql/` — 5 Ad-hoc-Skripte (`create_ubungen_table.sql`, `create_gallery_tables.sql`, …), die es nie in `migrations/` geschafft haben
4. **Im iOS-Repo** (`rollsportmanager-ios-macos/`): `FIX-ALL.sql`, `COMPLETE-FIX.sql`, `FIX-ENUM.sql`, `FIX-ROLE-SIMPLE.sql`, `FIX-TEAM-TRAINERS.sql`, `FIX-USER-ROLE.sql`, `SUPABASE-FIX-PERMISSIONS.sql`, `SUPABASE-SYNC-SETUP.sql`, `supabase_storage_setup.sql` + Ordner `SQL/` (4 weitere) — zusammen ~1.400 Zeilen "im Supabase SQL Editor ausführen"-Hotfixes.

Inhaltlich brisant: `FIX-ALL.sql` legt z. B. `admin_update_user_role()` als SECURITY DEFINER **"ohne Berechtigungsprüfung (TEMPORÄR)"** an und granted EXECUTE an `authenticated` — wenn das je auf Prod lief und nie zurückgebaut wurde, kann jeder eingeloggte User jede Rolle setzen. Ob solche Fixes aktiv sind, ist aus dem Repo **nicht rekonstruierbar** — genau das ist das Problem: Der tatsächliche Prod-Schemazustand ist nur in `volumes/db/data` bekannt, nicht im Code.

Weitere Muster: Fix-Migrationen auf Migrationen (`20260213_fix_pflichtstunden_function.sql`, `20260215_admin_delete_user_fix.sql`, `20260216_fix_user_registration.sql`, `20260219_fix_register_rpc_no_session.sql`) und deutsch/englisch gemischte Bezeichner (`schliessfach_vermietung` neben `finance_tables`).

### 2.8 E-Mail & Templates

- Transaktionale Auth-Mails: GoTrue über Strato-SMTP (Konfiguration doppelt: `.env` für Prod, `config.toml` für CLI — letztere mit Klartext-Passwort im Git).
- Anwendungs-Mails: Edge Functions mit **inline-HTML** (`send-beta-welcome`, `send-parent-invitation`); statische Marketing-Templates unter `www/email-templates/` (3 Beta-Einladungen); ein einzelnes GoTrue-Template `templates/confirmation.html`. Es gibt kein einheitliches Template-System, keine Layout-Wiederverwendung, i18n der Mails nur DE.
- Pro-Verein-SMTP ist als Feature angelegt (`migrations/20260127_verein_email_settings.sql`), die Test-Funktion dafür ist der o. g. offene Mail-Proxy.

### 2.9 Deploy-Prozess

- **Website/Portal:** `docker compose build --no-cache && docker compose up -d` in `www/` — Dateien werden ins Image kopiert, ein Restart reicht nicht (`CLAUDE.md` Zeilen 78–85). Cache-Busting manuell über `?v=N`-Query-Strings an jedem `<script>`-Tag; zusätzlich liegt ein Service Worker (`www/sw.js`) im Spiel — dieselbe Stale-Bundle-Falle wie bei GOMESSMO.
- **Backend:** `docker compose down && up -d`; Schema-Änderungen manuell via Studio/psql.
- **Kein** Git-Remote fürs Backend-Repo, uncommitted Changes im Working Tree (u. a. `docker-compose.yml`, `www/assets/js/portal.js`), gelöschte `www/backups/`-Assets noch im Index — Repo-Zustand und Prod-Zustand sind nicht deckungsgleich.
- Admin-Panel-Seiten `www/admin/server.html`/`server-settings.html` suggerieren Server-Fernsteuerung, referenzieren aber einen **nicht existenten Endpunkt** (`fetch('/api/server/status')`) und einen toten absoluten Pfad (`/Users/marcelgoldfuss/Desktop/claude-code/...`, Zeile 368) — es gibt keinen Host-Agenten, der `scripts/server-manager.sh` für das Panel ausführt. Die Seiten sind Attrappen; Konfiguration landet im Browser-localStorage (inkl. Service-Role-Key-Feld, `server-settings.html` Zeile 551/651).
- `scripts/server-manager.sh` und `SERVER_ADMIN_GUIDE.md` verweisen durchgehend auf die alten `Desktop/claude-code/`-Pfade — nach dem Umzug nach `/Apps/RollsportManager/` sind Script und Guide funktionslos bzw. irreführend.
- `server-installer/install.sh` (Ubuntu-Installer, generiert Secrets, 16 KB) existiert als Ansatz für "Server woanders aufsetzen", ist aber nie zu Ende gedacht (installiert den Stand des Repos, keine Updates, kein Bezug zum Mac-Setup).

### 2.10 Backup-Strategie

Aktueller Stand (LaunchAgents `com.claude.rollsport.backup-*`, Scripts in `/Users/marcelgoldfuss/Apps/_claude/scripts/`):
- **Täglich 03:15:** `pg_dump | gzip` → `/Users/marcelgoldfuss/Apps/_claude/backups/`, Rotation 14 Stück (`backup-db.sh`)
- **Wöchentlich So 03:30:** Tar des Storage-Ordners, Rotation 8 (`backup-storage.sh`) — läuft praktisch leer, da Storage ungenutzt ist (Medien liegen in der DB, sind also im pg_dump enthalten)

Bewertung: Es gibt immerhin automatisierte, rotierte Dumps — aber **alles liegt auf derselben Maschine und derselben Platte wie die Produktion**. Kein Offsite-/Zweitgerät-Sync (im Gegensatz z. B. zum ZimaOS→QNAP-rsync anderer Projekte), keine Restore-Tests, kein Backup von `.env`/Kong/Compose im neuen Schema, keine Verschlüsselung. Die ältere Backup-Doku in `CLAUDE.md`/`SERVER_ADMIN_GUIDE.md` (Backups nach `Desktop/claude-code/backups/`) ist obsolet.

### 2.11 Betriebsrisiken (Prod = privater Mac)

1. **Single Point of Failure total:** Strom, Internet (Vodafone-Kabel mit bekanntem täglichen WAN-Drop), macOS-Updates, Docker-Desktop-Zustand (containerd-Korruption bei voller Platte bereits vorgekommen), Mensch. Backups liegen auf demselben Gerät.
2. **Security-K1 offen:** Demo-JWT-Secret + Demo-Keys ⇒ vollständige RLS-Umgehung von außen möglich (`.env`, `volumes/api/kong.yml`, dokumentiert in `CLAUDE.md` Zeilen 152–155). Solange das offen ist, ist jede weitere Sicherheitsdiskussion akademisch.
3. **Secrets im Repo:** SERVICE_ROLE_KEY + APNs-Private-Key in `workers/start-push-worker.sh`; SMTP-Passwort in `config.toml`; `signing_keys.json` getrackt; Service-Keys in `CLAUDE.md`. Passwort-Stamm `ch4ngeM3` wird projektübergreifend wiederverwendet.
4. **DB-Port 5432 auf dem Host publisht** (Supavisor) — im LAN erreichbar; jede zusätzliche Portweiterleitung/VPN-Fehlkonfiguration exponiert die DB direkt.
5. **Kein Monitoring/Alerting:** Logflare/Vector sammeln zwar Logs (Analytics-Port 4000 offen), aber niemand wird bei Ausfall, Fehlerrate oder Disk-Füllstand benachrichtigt.
6. **Pushes laufen gegen APNs-Sandbox** (`APNS_PRODUCTION=false` in `.env` und Worker-Script) — Produktions-Geräte erhalten so keine Pushes; der Worker hat zudem keinen Autostart.
7. Mischbetrieb mit anderen Prod-Diensten (KetoTracker, Ollama, NPM) auf demselben Host: Ressourcen- und Blast-Radius-Kopplung.

---

## 3. Stärken (was v2 übernehmen sollte)

- **Postgres-zentrisches Modell mit RLS** ist grundsätzlich richtig für Multi-Tenant-Vereinsdaten; 141 Policies zeigen, dass Tenant-Isolation ernst genommen wurde (`migrations/20251230_initial_schema.sql` mit `get_current_user_id()`/`get_current_verein_id()`).
- **Outbox-Pattern für Push** (`push_queue`-Tabelle + Trigger + Worker) ist ein sauberes, entkoppeltes Muster — nur die Ausführung (Autostart, Secrets, Sandbox) ist mangelhaft.
- **Webhook-Signaturverifikation** ist bei Stripe und PayPal implementiert (nicht selbstverständlich bei Hobby-Projekten); Idempotenz über "Rechnung bereits bezahlt"-Check vorhanden (`functions/stripe-webhook/index.ts`).
- **Per-Verein-Zahlungskonfiguration** (`verein_payment_config`) ist fachlich das richtige Modell für Vereins-SaaS (jeder Verein kassiert auf eigene Konten).
- **Timestamped-Migrations-Konvention** existiert im Kern und die Migrationsdateien sind gut kommentiert (Problem/Lösung-Header, z. B. `20260216_register_user_rpc.sql`).
- **Modul-Dokumentation** `docs/modules/01-AUTH.md` … `11-CHECKIN.md` plus `ZAHLUNGSSYSTEM_STATUS.md`/`HARMONISIERUNGSPLAN.md` — die fachliche Domäne ist überdurchschnittlich gut beschrieben und für v2 direkt als Anforderungsquelle nutzbar.
- Automatisierte, rotierte DB-Dumps existieren bereits (LaunchAgents + `_claude/scripts/backup-db.sh`).
- Der Ubuntu-`server-installer/install.sh` zeigt, dass die Portabilität weg vom Mac bereits angedacht war.

## 4. Schwächen / Altlasten (kondensiert)

1. **Kritische Kryptografie-Altlast:** Demo-JWT-Secret/-Keys in Prod (`.env`, `volumes/api/kong.yml`) → RLS wertlos; 7-Tage-Access-Tokens.
2. **Secrets-Hygiene:** Klartext-Secrets in getrackten Dateien (`workers/start-push-worker.sh`, `config.toml`, `CLAUDE.md`, `signing_keys.json`); Vereins-PayPal/Stripe-Secrets unverschlüsselt in DB-Spalten.
3. **Migrations-Chaos:** 4 Quellen (`migrations/`, `supabase/migrations/` divergiert, `sql/`, `FIX-*.sql` im iOS-Repo), kein Runner, keine Versionstabelle, tatsächlicher Prod-Schema-Stand nur in der laufenden DB rekonstruierbar; gefährliche "TEMPORÄR"-Hotfixes (`FIX-ALL.sql`: Rollen-Update ohne Berechtigungsprüfung).
4. **Keine API-Schicht:** Business-Logik verteilt auf ~100 SQL-Funktionen, DB-Trigger, 6 Edge Functions und dupliziert in 4 Clients (iOS/Android/Portal/Admin); Paywall-/Rollenlogik dadurch schwer konsistent zu halten.
5. **Offene Edge Functions:** `FUNCTIONS_VERIFY_JWT=false` global; `send-test-email` = Mail-Relay mit Fremd-Credentials aus dem Request; CORS `*` überall (auch `www/nginx.conf`).
6. **Medien als Base64 in Postgres** statt Storage (Storage-Volume 0 B, DB 1,3 GB; Kong/Nginx-Puffer auf 100 MB aufgebohrt) — Backup-Größe, RAM und Query-Performance skalieren so nicht.
7. **Push-Betrieb defekt:** APNs-Sandbox in Prod, Worker ohne Autostart/Supervision, Android (FCM) im Worker gar nicht, in der Edge Function nur über abgekündigte Legacy-API.
8. **Deploy = Handarbeit ohne Netz:** kein Git-Remote (Backend!), kein CI, kein Staging, Image-Rebuild für jede HTML-Änderung, manuelles `?v=`-Cache-Busting + Service-Worker-Falle.
9. **Dokumentations-Drift:** `SERVER_ADMIN_GUIDE.md`, `CLAUDE.md`, `scripts/server-manager.sh`, `www/admin/server*.html` referenzieren gelöschte Pfade/nicht existente Endpunkte; Admin-"Server-Management" ist eine Attrappe.
10. **Betrieb auf Privat-Mac:** SPOF, Backups nur lokal, DB-Port im LAN exponiert, kein Monitoring/Alerting, Ressourcenteilung mit anderen Prod-Apps.
11. **Compose-/Config-Duplikate:** `docker-compose.yml` vs. `docker-compose-simple.yml`, Root- vs. `supabase/`-Baum, `config.toml` widerspricht `.env` (Postgres 17 vs. 15, JWT 1 h vs. 7 Tage).

---

## 5. Empfehlungen für den Neuaufbau (v2)

### 5.1 Grundsatzentscheidung Plattform

- **Empfehlung: Managed Supabase (Cloud, Region EU/Frankfurt) oder alternativ Supabase auf einem gemieteten Linux-Server (Hetzner) mit dem offiziellen Stack — nicht mehr auf dem privaten Mac.** Der Mac kann Dev/Staging bleiben. Managed löst auf einen Schlag: Key-Management, Backups (PITR), Updates, Monitoring, TLS, Skalierung. Bei Datenschutz-Bedenken (Vereins-/Kinderdaten): Hetzner + offizielles Supabase-Self-Host mit sauberem Secret-Bootstrap (der vorhandene `server-installer/install.sh`-Gedanke, richtig zu Ende gebaut) — dann aber zwingend mit Offsite-Backup und Uptime-Monitoring.
- Falls Self-Host: **Postgres-Major-Version fixieren (16/17)**, Compose aus einem einzigen, versionierten Verzeichnis, Renovate/Watchtower-Strategie für Container-Updates definieren.

### 5.2 API-Architektur

- **Eine dünne, typisierte API-Schicht einziehen** (z. B. Next.js/Hono/Fastify mit TypeScript oder — passend zur bestehenden Deno-Erfahrung — Supabase Edge Functions v2 mit Per-Function-JWT), die alle schreibenden Business-Operationen kapselt: Registrierung, Rollenwechsel, Rechnungs-/Mahnlauf, Zahlungsauslösung, Push-Fanout. PostgREST-Direktzugriff nur noch für unkritische Reads.
- RLS beibehalten als zweite Verteidigungslinie, aber Business-Regeln (Rollen, Limits, Paywall) **serverseitig an einer Stelle** statt in 4 Clients + 100 SQL-Funktionen.
- OpenAPI-Spez + generierte Clients für iOS/Android/Web, damit die "Plattform-Synchronisations-Checkliste" aus `CLAUDE.md` (Zeilen 89–110) entfällt.

### 5.3 Secrets & Auth

- Beim v2-Bootstrap **alle Keys frisch generieren** (JWT-Secret, anon/service, DB-Passwörter, APNs-Key neu ausstellen, SMTP-Passwort ändern — der `ch4ngeM3`-Stamm ist verbrannt). Secrets ausschließlich in `.env`/Secret-Store, nie in Doku, Scripts oder `config.toml`; Git-Hygiene ab Tag 1 (`.gitignore` + Pre-Commit-Secret-Scan, z. B. gitleaks).
- Access-Token-Laufzeit auf ≤ 1 h, Refresh-Rotation an (ist in `config.toml` schon vorgesehen); Sign in with Apple/Google ergänzen (Store-Anforderung bei Account-Apps ohnehin absehbar).
- Vereins-Payment-Secrets (PayPal/Stripe pro Verein) verschlüsselt speichern (Supabase Vault/pgsodium statt Klartext-Spalten in `verein_payment_config`); besser: **Stripe Connect** statt Roh-Credentials der Vereine einzusammeln.

### 5.4 Migrationen & Datenbank

- **Ein einziges Migrations-Verzeichnis mit Tooling** (Supabase CLI `db push`/`migration new` gegen alle Umgebungen, oder Atlas/sqitch). Regel: Kein SQL erreicht Prod außer über eine committete Migration; "FIX-Dateien in App-Repos" sind verboten.
- Vor dem v2-Start: **Prod-Schema einmalig dumpen (`pg_dump --schema-only`) und als Baseline-Migration einfrieren** — das ist die einzige verlässliche Quelle des Ist-Schemas, nicht die Migrationsdateien.
- Schema-Konventionen festlegen (einheitlich Englisch oder einheitlich Deutsch, konsistente Spaltennamen — Altlast `start_datetime`/`ort`/`nachricht` dokumentieren und per View/Mapping migrieren).
- **Medien in Storage/S3 statt Base64 in Tabellen**; Migrationstool für Bestandsdaten (Base64 → Bucket + URL-Spalte). Damit schrumpfen DB (~1,3 GB), Dump-Zeiten und die Kong-Sonderkonfiguration entfällt.

### 5.5 Hintergrundjobs & Push

- Push-Fanout als **einen** Dienst: entweder pg_cron/pgmq + Edge Function mit Cron-Trigger oder ein containerisierter Worker (im Compose, mit `restart: unless-stopped`, Healthcheck, Env aus `.env`) — nicht als loses Host-Script. `push_queue`-Outbox-Modell übernehmen.
- APNs **Production** + Token-Auth; Android über **FCM HTTP v1** (Service-Account) statt Legacy-Key; Web-Push fürs Portal erwägen.
- Weitere Jobs, die v2 ohnehin braucht (Mahnläufe, Abo-Verlängerung, Termin-Erinnerungen), von Anfang an als Cron-/Queue-Jobs designen statt als DB-Trigger-Kaskaden.

### 5.6 E-Mail

- Ein Template-System (MJML/React Email) mit Layout, DE/EN-Pflicht (Bilingual-Default), zentralem Versand über einen transaktionalen Provider (Strato-SMTP ist ok für den Start, aber Bounce-/Complaint-Handling fehlt; Resend/Postmark/SES erwägen). GoTrue-Templates aus demselben System generieren.
- `send-test-email` in v2 nur authentifiziert (Admin-Rolle) und nur gegen die **gespeicherte** Vereins-SMTP-Konfiguration, niemals gegen beliebige Hosts aus dem Request.

### 5.7 Deploy, Umgebungen, Qualität

- **Git-Remote für alles** (das Backend-Repo hat heute keins!), Monorepo oder klar getrennte Repos mit CI (GitHub Actions): Lint, Migrations-Dry-Run gegen Shadow-DB, Deploy per Tag.
- Drei Umgebungen: lokal (Supabase CLI — die vorhandene `supabase/`-Struktur wird dann sinnvoll), Staging, Prod. Website/Portal als gebautes Frontend (Vite/Next) mit Content-Hash-Dateinamen statt `?v=`-Handarbeit; Service-Worker-Update-Strategie explizit (Lehre aus GOMESSMO-Stale-SW).
- Nginx-CORS auf konkrete Origins statt `*`; das generische `/api/`-Proxy-Doppel zu `/rest/v1/` etc. entfernen.

### 5.8 Backup & Monitoring (falls Self-Host)

- 3-2-1-Backup: täglicher `pg_dump` **plus** WAL/PITR (wal-g/pgBackRest), Kopie auf Zweitgerät (QNAP/ZimaOS existieren bereits im Haus) **und** Offsite (S3/B2, verschlüsselt). Restore vierteljährlich testen und das Verfahren in einem aktuellen Runbook halten (das heutige `SERVER_ADMIN_GUIDE.md` als Vorlage nehmen, aber generiert/verlinkt statt handgepflegt).
- Uptime-Monitoring extern (Healthchecks.io/UptimeRobot auf `/auth/v1/health` u. a.), Alerting auf Disk/Backup-Erfolg; Logflare-Stack nur behalten, wenn ihn jemand anschaut — sonst durch schlankes Loki/Grafana oder Hosted-Lösung ersetzen.
- Keine Datenbank-Ports auf dem Host publishen; Zugriff nur via Docker-Netz bzw. SSH-Tunnel/VPN.

### 5.9 Migration Bestandsdaten

- v2 sollte mit einem **einmaligen ETL** aus der v1-DB starten (Schema-Baseline + Daten-Transformation: Base64-Medien → Storage, deutsche Enums → stabile Codes, `parent_id`-Familienmodell übernehmen). Der 1,3-GB-Dump ist klein genug für eine Big-Bang-Migration mit kurzem Wartungsfenster.

---

## Anhang: Wichtigste Datei-Referenzen

| Thema | Pfad |
|---|---|
| Compose (Prod) | `rollsportmanager-backend/docker-compose.yml` |
| Kong-Routing + Demo-Key-Mapping | `rollsportmanager-backend/volumes/api/kong.yml` |
| Env (Prod, Secrets) | `rollsportmanager-backend/.env` |
| CLI-Config (widersprüchlich, SMTP-Klartext) | `rollsportmanager-backend/config.toml` (Kopie: `supabase/config.toml`) |
| Edge Functions | `rollsportmanager-backend/functions/*/index.ts` (Laufzeit-Mount: `volumes/functions/`) |
| Push-Worker | `rollsportmanager-backend/workers/push-worker.js`, `workers/start-push-worker.sh` |
| Migrationen | `rollsportmanager-backend/migrations/`, `supabase/migrations/` (divergiert), `sql/` |
| Hotfix-SQL im iOS-Repo | `rollsportmanager-ios-macos/FIX-*.sql`, `COMPLETE-FIX.sql`, `SQL/` |
| Web/Nginx | `rollsportmanager-backend/www/nginx.conf`, `www/Dockerfile`, `www/docker-compose.yml` |
| Admin-"Serververwaltung" (Attrappe) | `www/admin/server.html`, `www/admin/server-settings.html`, `scripts/server-manager.sh` |
| Ops-Doku (veraltet) | `SERVER_ADMIN_GUIDE.md`, `CLAUDE.md`, `SUPABASE-INFO.md`, `SUPABASE-CONFIG.md` |
| Zahlungssystem-Doku | `ZAHLUNGSSYSTEM_STATUS.md` |
| Backup-Automation (aktuell) | `~/Library/LaunchAgents/com.claude.rollsport.backup-{db,storage}.plist` → `/Users/marcelgoldfuss/Apps/_claude/scripts/backup-{db,storage}.sh` |
| Linux-Installer (Ansatz) | `rollsportmanager-backend/server-installer/install.sh` |
