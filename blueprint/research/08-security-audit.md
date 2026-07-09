# 08 – Security-Audit RollsportManager (Ist-Zustand & v2-Empfehlungen)

**Rolle:** Security-Auditor im v2-Neuaufbau-Team
**Datum:** 2026-07-09
**Scope:** Reine statische Code-/Doku-Analyse. Es wurde nichts ausgenutzt, gestartet, gestoppt oder geändert.
**Codebases (read-only):**
- Backend (self-hosted Supabase, Docker, Kong, Postgres, Web-Portal, Website): `/Users/marcelgoldfuss/Apps/RollsportManager/rollsportmanager-backend`
- iOS/macOS/Watch (SwiftUI): `/Users/marcelgoldfuss/Apps/RollsportManager/rollsportmanager-ios-macos`
- Android (Kotlin/Compose): `/Users/marcelgoldfuss/Apps/RollsportManager/rollsportmanager-android`

---

## 1. Überblick

Das Backend ist eine **self-hosted Supabase-Instanz** (Docker-Compose), die per Kong-API-Gateway (Ports 8000/8443) exponiert wird und produktiv unter `https://rollsportmanager.de` (lokaler Docker auf diesem Mac) läuft. Clients sind drei native Apps plus ein statisches HTML/JS-Web-Portal (`www/portal/`). Authentifizierung erfolgt über Supabase GoTrue (E-Mail/Passwort, Telefon), Autorisierung über Postgres **Row Level Security (RLS)** plus `SECURITY DEFINER`-RPCs.

Die RLS-Abdeckung ist **breit** (ca. 62 Tabellen mit `ENABLE ROW LEVEL SECURITY`), die Registrierungs-RPC vergibt korrekt nur die Rolle `mitglied`, und Secrets sind größtenteils per `.gitignore` ausgeschlossen. Das ist die gute Nachricht.

Die schlechte Nachricht: Das **Fundament der gesamten Vertrauenskette ist gebrochen**. Der JWT-Signaturschlüssel ist der weltweit bekannte Supabase-Demo-Default (bestätigter Befund **K1**). Damit ist jede RLS-Policy, jede Rollenprüfung und jede „Admin"-Absicherung wirkungslos, weil beliebige `service_role`-Tokens gefälscht werden können. Zusätzlich existiert eine **zweite, unabhängige** kritische Lücke: eine RLS-Update-Policy erlaubt jedem angemeldeten Mitglied, sich selbst zum Admin/Super-Admin zu befördern. Für einen v2-Neuaufbau ist die Kernbotschaft: **Auth/Autorisierung von Grund auf neu denken, Secret-Management härten, defense-in-depth statt „RLS reicht schon".**

Priorisierte Findings (Details in Abschnitt 4):

| ID | Schweregrad | Kurzbeschreibung |
|----|-------------|------------------|
| **F1 (=K1)** | **KRITISCH** | JWT_SECRET = Supabase-Demo-Default → beliebige `service_role`-Tokens fälschbar |
| **F2** | **KRITISCH** | RLS-Rechteausweitung: Mitglied kann eigene `role` auf `admin`/`super_admin` setzen |
| **F3** | **HOCH** | `signing_keys.json` (Demo-Secret) ist in Git eingecheckt |
| **F4** | **HOCH** | Schwache/Default-Betriebssecrets in `.env` (Dashboard-PW, SMTP-PW, Stripe-Webhook-Placeholder) |
| **F5** | **HOCH** | Android-Release-Keystore-Passwort `ch4ngeM3` |
| **F6** | **MITTEL** | Unauthentifizierte Kong-Route `rest-admin-v1` (`# TODO: validate apikey`) |
| **F7** | **MITTEL** | `FUNCTIONS_VERIFY_JWT=false` – Edge Functions ohne Plattform-JWT-Prüfung |
| **F8** | **MITTEL** | JWT (Access + Refresh) im `localStorage` des Web-Portals; 7-Tage-Expiry; Admin-Gate nur clientseitig |
| **F9** | **MITTEL** | CORS `Access-Control-Allow-Origin: *` auf allen Kong-Routen |
| **F10** | **MITTEL/NIEDRIG** | Postgres-Pooler auf `0.0.0.0:5432/6543` an den Host gebunden |
| **F11** | **NIEDRIG** | Offene Registrierung + `ENABLE_PHONE_AUTOCONFIRM=true`; RPC `delete_auth_user` referenziert, aber nicht in Migrationen definiert |
| **F12** | **NIEDRIG/INFO** | Klartext-Secrets in `CLAUDE.md` dokumentiert |

---

## 2. Ist-Zustand im Detail

### 2.1 Auth-Architektur
- **GoTrue** (`supabase-auth`) macht E-Mail/Passwort- und Telefon-Login. Konfiguration in `rollsportmanager-backend/.env`:
  - `JWT_EXPIRY=604800` (7 Tage Access-Token-Lebensdauer)
  - `DISABLE_SIGNUP=false`, `ENABLE_EMAIL_SIGNUP=true`, `ENABLE_EMAIL_AUTOCONFIRM=false`
  - `ENABLE_PHONE_SIGNUP=true`, `ENABLE_PHONE_AUTOCONFIRM=true`
  - `SITE_URL=https://rollsportmanager.de`, `ADDITIONAL_REDIRECT_URLS=` (leer)
- **Autorisierung** komplett über Postgres RLS + `SECURITY DEFINER`-Funktionen. Rollenmodell in `users.role`: `mitglied, trainer, moderator, kassenwart, admin, super_admin`. Die Rollenprüfungen lesen direkt aus `users.role`:
  - `is_current_user_admin()` → `role = 'admin'` (`migrations/20260215_hide_admin_from_moderators.sql:9`) bzw. `role = 'super_admin'` (`migrations/20260225_super_admin_role.sql:32`)
  - `is_super_admin()`, `is_admin_or_higher()`, `is_moderator_or_higher()` (`migrations/20260225_super_admin_role.sql`)
- **Registrierung** läuft über RPC `register_user` (`migrations/20260219_fix_register_rpc_no_session.sql`), `SECURITY DEFINER`, `GRANT EXECUTE ... TO anon`. Die Funktion **hardcodiert `role='mitglied'`** beim Insert (Zeilen ~68–92) – korrekt, keine Rollen-Injektion über Metadaten möglich. Sie prüft `auth.uid()` gegen `p_auth_id` bzw. Existenz in `auth.users`.
- **Web-Portal-Auth** (`www/assets/js/supabase.js`): Standard-`supabase-js`-Client via `createClient(SUPABASE_URL, SUPABASE_ANON_KEY)` (Zeile 54), Login über `signInWithPassword` (Zeile 121). Kein Custom-Storage → Session (Access- + Refresh-Token) landet per Default im `localStorage`.

### 2.2 Secrets & Schlüssel
- **`.env`** (`rollsportmanager-backend/.env`, korrekt via `.gitignore` ausgeschlossen, aber im Arbeitsbaum vorhanden):
  - `JWT_SECRET=super-secret-jwt-token-with-at-least-32-characters-long` (Zeile 7) ← **Demo-Default**
  - `ANON_KEY` / `SERVICE_ROLE_KEY` = Demo-Tokens (`iss: supabase-demo`, Ablauf 2032 bzw. 2030)
  - `POSTGRES_PASSWORD=t1j28xBwMkipJrd1lPU9KCjDNpyi5PwJ` (zufällig, stark)
  - `DASHBOARD_PASSWORD=RollsportAdmin2025` (schwach)
  - `SMTP_PASS=ch4ngeM3mncs` (echtes Strato-Postfach `noreply@rollsportmanager.de`)
  - `STRIPE_SECRET_KEY=sk_test_...`, `STRIPE_WEBHOOK_SECRET=whsec_PLACEHOLDER` (Zeilen 148–150)
  - `APNS_KEY_BASE64=...` (privater APNs-Schlüssel im Klartext, Zeile 141)
  - `LOGFLARE_*=your-super-secret-and-long-logflare-key-...` (Platzhalter)
  - `POOLER_TENANT_ID=your-tenant-id` (Default)
- **`signing_keys.json`** (Repo-Root und `supabase/signing_keys.json`): enthält `{"signing_key": "super-secret-jwt-token-with-at-least-32-characters-long"}` und ist **trotz `.gitignore` in Git eingecheckt** (per `git cat-file -e HEAD:signing_keys.json` bestätigt – die Datei wurde vor Aufnahme in `.gitignore` committet, daher greift der Ignore nicht mehr).
- **`volumes/db/jwt.sql`** setzt `app.settings.jwt_secret` in Postgres aus `$JWT_SECRET` – der Demo-Default propagiert also bis in die DB-GUC, die von `auth.jwt()`/`auth.uid()` genutzt wird.
- **Android**: `keystore.properties` (`storePassword=ch4ngeM3`, `keyPassword=ch4ngeM3`) ist korrekt gitignored und **nicht** eingecheckt; die eigentliche Keystore-Datei `rollsportmanager-release.keystore` liegt (gitignored) im Arbeitsbaum. `local.properties` (nur `sdk.dir`) ist git-tracked (harmlos, aber unsauber).

### 2.3 API-Exposition über Kong (`volumes/api/kong.yml`)
- Kong ist mit `KONG_DATABASE: "off"` deklarativ konfiguriert; Plugins verfügbar: `request-transformer, cors, key-auth, acl, basic-auth, request-termination, ip-restriction, post-function`.
- **Auffällig:** Die neueren API-Key-Formate `sb_secret_N7UND0UgjKTVK-Uodkm0Hg_xSvEMPvz` und `sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH` werden per `request-transformer` auf die **Demo-JWTs** gemappt (in fast jeder Route dupliziert). Selbst wenn diese sb_-Keys „neu" wirken: Da `JWT_SECRET` der Demo-Default ist, sind sie für einen Angreifer irrelevant – er kann das `service_role`-JWT direkt selbst signieren.
- Route `rest-admin-v1` → `http://rest:3001/` trägt den Kommentar `# TODO: validate apikey` und hat **weder `key-auth` noch `request-transformer`** (`kong.yml:70–80`).
- **CORS**: `- name: cors` ohne Konfiguration auf jeder Route → Kong-Default `Access-Control-Allow-Origin: *`.
- Weitere exponierte Routen: `/rest/v1/`, `/auth/v1/`, `/graphql/v1`, `/storage/v1/`, `/realtime/v1/`, `/functions/v1/`, `/pg/` (pg-meta), `/analytics/v1/`, `/mcp` (Studio-MCP), `/pooler/v2/`.

### 2.4 Netzwerk-/Container-Exposition (`docker-compose.yml`)
- Kong: `${KONG_HTTP_PORT}:8000`, `${KONG_HTTPS_PORT}:8443` (beabsichtigtes Gateway).
- **Pooler (Supavisor)**: `ports: ${POSTGRES_PORT}:5432` und `${POOLER_PROXY_PORT_TRANSACTION}:6543` → an alle Host-Interfaces gebunden (`0.0.0.0`), damit im LAN erreichbar (Postgres-Zugang mit `POSTGRES_PASSWORD`).
- `analytics`: `4000:4000` exponiert.
- `studio` (Dashboard) hat **kein** Host-Port-Mapping → nur intern erreichbar (gut); `DASHBOARD_USERNAME/PASSWORD` werden an Kong durchgereicht, im aktuellen `kong.yml` ist jedoch **keine** `basic-auth`-Absicherung auf einer Route aktiv.
- `FUNCTIONS_VERIFY_JWT=false` (`.env:112`) – gilt global für alle Edge Functions.

### 2.5 RLS-Abdeckung (`migrations/`, `sql/`)
- Breite Abdeckung: ~62 Tabellen mit `ENABLE ROW LEVEL SECURITY` (u. a. `users, vereine, teams, termine, messages, payments, invoices, kueren, documents, gallery_*, achievements, trainingsplan*`).
- Positiv: `messages`-Policies binden `sender_id/recipient_id/team_id` an `get_current_user_id()`; `admin_delete_user()` prüft `is_current_user_admin()` und schützt „Boss"-User ID 1 (`migrations/20260215_admin_delete_user_fix.sql`).
- Permissive `USING (true)`-Policies auf öffentlichen Read-Tabellen (`website_content`, `website_images`, License-/Monetization-Read) – für reine Public-Reads vertretbar, Schreibpfade sollten separat geprüft werden.
- **Schwachstelle** in `migrations/20251230_initial_schema.sql:335-336` (Details unter F2).

### 2.6 Mobile Clients
- iOS und Android verwenden ausschließlich den **anon key** (in `rollsportmanager-ios-macos/.../SupabaseManager.swift` bzw. `rollsportmanager-android/app/build.gradle.kts`). **Kein** `service_role`-Key oder JWT-Secret in den Mobile-Codebases gefunden (Grep negativ) – gut. Der anon key ist per Design öffentlich; problematisch ist nur, dass er wegen F1 fälschbar ist.

---

## 3. Stärken

1. **Breite RLS-Abdeckung** – nahezu alle Fachtabellen haben RLS aktiviert; Autorisierung ist nicht nur clientseitig gedacht.
2. **Saubere Registrierungs-RPC** – `register_user` erzwingt `role='mitglied'`, prüft Session/`auth.uid()` und verhindert Rollen-Injektion über Metadaten.
3. **Kein Service-Role-Key in den Clients** – Mobile Apps nutzen nur den anon key; keine hochprivilegierten Secrets im App-Binary.
4. **Grundsätzlich vorhandenes Secret-Hygiene-Bewusstsein** – `.gitignore` listet `.env`, `signing_keys.json`, Keystores; `.env` und `keystore.properties` sind tatsächlich nicht eingecheckt.
5. **Starkes DB-Passwort** – `POSTGRES_PASSWORD` ist zufällig generiert (32 Zeichen).
6. **Admin-Destruktiv-RPCs mit Rollen-Check** – z. B. `admin_delete_user()` prüft Admin-Status und schützt System-User.

---

## 4. Schwächen / Altlasten (priorisierte Findings)

### F1 (=K1) – KRITISCH: JWT_SECRET ist der Supabase-Demo-Default
`JWT_SECRET=super-secret-jwt-token-with-at-least-32-characters-long` (`.env:7`, `signing_keys.json`, `supabase/signing_keys.json`, propagiert via `volumes/db/jwt.sql`).
**Impact:** Der Wert ist öffentlich bekannt (Standard-Beispiel aus der Supabase-Doku). Da GoTrue/PostgREST HS256 mit genau diesem Secret verifizieren, kann **jeder** ein gültiges JWT mit `"role":"service_role"` selbst signieren und damit über das öffentlich erreichbare Kong-Gateway (`https://rollsportmanager.de/rest/v1/...`) **die komplette Datenbank unter Umgehung sämtlicher RLS** lesen und schreiben. Damit sind alle personenbezogenen Daten (Mitglieder inkl. Minderjähriger, Zahlungen, SEPA-Mandate, Nachrichten, Dokumente) exponiert – ein meldepflichtiger DSGVO-Vorfall wäre die Folge. Dies entwertet **alle** übrigen Autorisierungsmaßnahmen.
**Belege:** `.env:7`, `volumes/api/kong.yml` (Demo-JWTs überall), `volumes/db/jwt.sql`.

### F2 – KRITISCH: RLS-Rechteausweitung über `users`-Update
```sql
CREATE POLICY "Users: Eigenes Profil bearbeiten" ON users
    FOR UPDATE USING (id = get_current_user_id());
```
(`migrations/20251230_initial_schema.sql:335-336`)
**Impact:** Die Policy hat **kein `WITH CHECK`** und **keine Spaltenbeschränkung**; RLS kann Spalten nicht einschränken, und es existiert **kein Trigger**, der Änderungen an `users.role` verhindert (Grep negativ). Ein angemeldetes normales Mitglied kann seine eigene Zeile per PostgREST `PATCH /rest/v1/users?id=eq.<self>` mit `{"role":"super_admin"}` aktualisieren. Da `is_current_user_admin()`/`is_super_admin()` genau aus `users.role` lesen, erhält der Angreifer sofort volle Admin-Rechte inkl. `admin_delete_user()`. **Dieser Weg funktioniert auch dann, wenn F1 behoben wäre** – es ist eine unabhängige zweite Kette.
**Belege:** `migrations/20251230_initial_schema.sql:332-336`, `migrations/20260225_super_admin_role.sql:32-39`.

### F3 – HOCH: Demo-Secret in Git eingecheckt
`signing_keys.json` und `supabase/signing_keys.json` sind trotz `.gitignore`-Eintrag in `HEAD` eingecheckt (per `git cat-file -e HEAD:signing_keys.json` bestätigt). Der Eintrag in `.gitignore` wurde erst nach dem ersten Commit hinzugefügt und ist damit wirkungslos.
**Impact:** Das JWT-Signing-Secret liegt dauerhaft in der Git-Historie. Selbst nach einer `.env`-Rotation bleibt es rückholbar, solange die Historie nicht bereinigt wird. `git-tracked` ist außerdem `local.properties` (Android) – hier nur `sdk.dir`, geringes Risiko, aber unsauber.

### F4 – HOCH: Schwache/Default-Betriebssecrets in `.env`
- `DASHBOARD_PASSWORD=RollsportAdmin2025` (ratbar; Studio/Kong-Basic-Auth).
- `SMTP_PASS=ch4ngeM3mncs` – echtes Strato-Postfach; Kompromittierung ⇒ Mail-Versand im Namen der Domain (Phishing/Spam, Reputationsschaden).
- `STRIPE_WEBHOOK_SECRET=whsec_PLACEHOLDER` – Webhook-Signaturen werden nicht validierbar; **gefälschte Zahlungs-Events** (z. B. „Abo bezahlt") könnten akzeptiert werden, falls der Handler ohne gültiges Secret durchwinkt.
- `LOGFLARE_*=your-super-secret-...` und `POOLER_TENANT_ID=your-tenant-id` sind unveränderte Defaults.
- APNs-Privatkey liegt Base64 im Klartext in `.env`.
**Belege:** `.env:11,82,122-123,137-150`.

### F5 – HOCH: Android-Release-Keystore-Passwort trivial
`keystore.properties`: `storePassword=ch4ngeM3`, `keyPassword=ch4ngeM3`. Datei ist zwar gitignored, aber wer den (im Arbeitsbaum liegenden) `rollsportmanager-release.keystore` erlangt, kann mit diesem Passwort **signierte Malware-Updates** der App erzeugen.
**Belege:** `rollsportmanager-android/keystore.properties`, `rollsportmanager-android/rollsportmanager-release.keystore`.

### F6 – MITTEL: Unauthentifizierte Admin-REST-Route in Kong
`rest-admin-v1` (`/rest-admin/v1/` → `http://rest:3001/`) mit `# TODO: validate apikey`, ohne `key-auth`/`request-transformer` (`volumes/api/kong.yml:70-80`). Latente Fehlkonfiguration: Sollte auf 3001 je ein PostgREST-Admin-Listener aktiv sein, wäre er ohne Authentifizierung über das Gateway erreichbar.

### F7 – MITTEL: `FUNCTIONS_VERIFY_JWT=false`
Global (`​.env:112`) deaktiviert die Plattform-JWT-Prüfung für **alle** Edge Functions. Jede Function muss Auth selbst erzwingen, sonst ist ihr Endpunkt offen. Ohne Per-Function-Verifikation ist das fehleranfällig.

### F8 – MITTEL: JWT im `localStorage` + clientseitiges Admin-Gate
`www/assets/js/supabase.js` nutzt den Standard-`supabase-js`-Client ohne Custom-Storage ⇒ Access-/Refresh-Token liegen im `localStorage` (`sb-<ref>-auth-token`) und sind bei jeder XSS-Lücke im Portal exfiltrierbar. Der lange `JWT_EXPIRY` (7 Tage) vergrößert das Zeitfenster. Das Admin-Panel gated nur **clientseitig** über `data-min-role`/`currentAdminRole === 'super_admin'` (`www/assets/js/admin.js:440-479`) – die echte Durchsetzung hängt allein an RLS, die durch F2 aushebelbar ist.

### F9 – MITTEL: CORS `*` auf allen Routen
Alle Kong-Routen nutzen das `cors`-Plugin ohne Konfiguration ⇒ `Access-Control-Allow-Origin: *`. Für anon-key-basierte Zugriffe üblich, in Kombination mit öffentlichen/fälschbaren Tokens jedoch unnötig weit.

### F10 – MITTEL/NIEDRIG: Postgres-Pooler an den Host gebunden
`docker-compose.yml` bindet den Supavisor-Pooler auf `0.0.0.0:5432` und `:6543`. Im LAN direkt erreichbar; kritisch, falls der Host-Port je nach außen weitergeleitet wird. Passwort ist stark, aber die Angriffsfläche ist vermeidbar.

### F11 – NIEDRIG: Offene Registrierung / Phone-Autoconfirm / fehlende RPC
`DISABLE_SIGNUP=false` + `ENABLE_PHONE_AUTOCONFIRM=true` erlauben unbegrenzte Account-Anlage (Missbrauch/Spam). Das Portal ruft im Fehlerpfad `supabaseClient.rpc('delete_auth_user', {user_email})` auf (`www/assets/js/supabase.js:206,221`), doch **eine Definition dieser Funktion findet sich nicht in `migrations/` oder `sql/`**. Falls sie ad-hoc in der DB angelegt und an `anon` gegrantet wurde, könnte sie das Löschen beliebiger Auth-User per E-Mail ermöglichen – **verifizieren**.

### F12 – NIEDRIG/INFO: Klartext-Secrets in Doku
`rollsportmanager-backend/CLAUDE.md` und die Mobile-`CLAUDE.md` enthalten ANON_KEY, SERVICE_ROLE_KEY und Passwörter im Klartext. Doku-Leakage; verlängert die Halbwertszeit kompromittierter Werte.

---

## 5. Empfehlungen für den Neuaufbau „v2"

### 5.1 Sofort (auch für den Ist-Stand, unabhängig von v2)
1. **JWT-Secret rotieren** (F1): kryptografisch zufälliges Secret erzeugen, GoTrue/PostgREST/DB-GUC neu setzen, `signing_keys.json` und alle anon/service-Tokens neu generieren. Danach alle Sessions invalidieren.
2. **Rollen-Escalation schließen** (F2): `users`-Update-Policy mit `WITH CHECK` versehen **und** einen `BEFORE UPDATE`-Trigger ergänzen, der `NEW.role` bei fehlender Admin-Berechtigung auf `OLD.role` erzwingt (privilegierte Spalten `role, verein_id, is_active` gegen Selbst-Update sperren).
3. **Git-Historie bereinigen** (F3): `signing_keys.json` per `git filter-repo`/BFG entfernen, Repo neu pushen, betroffene Secrets als kompromittiert behandeln und rotieren.
4. **Alle Default-/schwachen Secrets rotieren** (F4/F5): Dashboard-PW, SMTP-PW, Logflare-Keys, Pooler-Tenant, **Android-Keystore-Passwörter**; echten `STRIPE_WEBHOOK_SECRET` setzen und Webhook-Signatur serverseitig verifizieren.

### 5.2 Architektur & Auth (v2-Kern)
5. **Managed Auth statt Demo-Supabase.** Zwei tragfähige Wege:
   - **(A) Supabase Cloud / korrekt provisioniertes Self-Hosting** mit rotierten Keys, oder
   - **(B) Eigener Auth-Layer** (z. B. dediziertes API-Backend, Node/Fastify o. ä.) mit **kurzlebigen Access-Tokens (5–15 min) + rotierenden Refresh-Tokens**. Empfohlen: `RS256/ES256` (asymmetrisch) statt HS256 – der private Signaturschlüssel verlässt dann nie den Auth-Server, Clients/Gateways verifizieren nur mit dem Public Key. Ein geteiltes HS256-Secret wie heute ist die eigentliche Ursache von K1.
6. **Autorisierung nicht allein an eine editierbare `users.role`-Spalte hängen.** In v2:
   - Rollen/Claims in das (server-signierte) Token einbetten und serverseitig setzen, nie clientseitig überschreibbar.
   - RLS als **zweite** Verteidigungslinie behalten, aber Rollenherkunft aus verifizierten JWT-Claims (`auth.jwt() ->> 'role'`) statt aus einer per PATCH änderbaren Tabellenspalte ziehen; privilegierte Änderungen ausschließlich über dedizierte, rollengeprüfte RPCs.
7. **Defense in depth:** Jede Mutation muss durch (a) Gateway-Auth, (b) serverseitige Rollenprüfung **und** (c) RLS gehen. Kein „RLS reicht schon".

### 5.3 Secret- & Key-Management
8. **Secrets aus dem Repo verbannen:** kein `.env`, keine `signing_keys.json`, keine Keys in `CLAUDE.md`. Stattdessen ein **Secret-Manager** (1Password/Doppler/Vault) bzw. Docker-Secrets; Secrets zur Laufzeit injizieren. In v2 CI-Check (z. B. `gitleaks`/`trufflehog`) als Pre-Commit- und Pipeline-Gate.
9. **Android/iOS Signing-Secrets** ausschließlich in einem Secret-Store/CI-Keychain; App-Signing über verwaltete Signing-Services statt lokaler Keystore-Datei mit trivialem Passwort. Getrennte Debug-/Release-Keystores.
10. **Konsequente Key-Trennung** pro Umgebung (dev/stage/prod), automatisierte Rotation, kein „für alle Umgebungen gleicher Key" wie heute (`SUPABASE_ANON_KEY` „für beide Umgebungen gleich", `supabase.js:20`).

### 5.4 Gateway, Netzwerk & Functions
11. **Kong härten:** `rest-admin`-Route entfernen oder mit `key-auth`/`acl` absichern (F6); CORS auf konkrete Origins (`rollsportmanager.de`, App-Redirects) statt `*` (F9); `ip-restriction` für Management-Routen (`/pg/`, `/analytics/v1/`, `/mcp`).
12. **Keine DB-Ports an den Host** (F10): Pooler nur im internen Docker-Netz; falls externer DB-Zugriff nötig, ausschließlich über VPN/SSH-Tunnel, gebunden an `127.0.0.1`.
13. **Edge Functions:** `FUNCTIONS_VERIFY_JWT=true` bzw. per-Function-Verifikation (F7); jede Function erzwingt Auth + Input-Validierung.
14. **TLS-Terminierung & Security-Header** am Reverse-Proxy zentralisieren (HSTS, CSP, `X-Content-Type-Options`, `Referrer-Policy`).

### 5.5 Web-Portal & Clients
15. **Token nicht im `localStorage`.** v2-Web: Refresh-Token als `HttpOnly`, `Secure`, `SameSite`-Cookie; Access-Token nur im Speicher (in-memory). Damit ist XSS-Token-Diebstahl deutlich erschwert (F8). Kürzere Token-Lebensdauer (F8: heute 7 Tage → Minuten).
16. **Strenge CSP** im Portal gegen XSS; Eingaben serverseitig validieren/escapen; Admin-Funktionen niemals nur clientseitig gaten – jede Admin-Aktion serverseitig autorisieren.
17. **Mobile Token-Storage** in v2 explizit über iOS **Keychain** bzw. Android **EncryptedSharedPreferences/Keystore** absichern (heute nutzt iOS teils `UserDefaults` für Umgebungs-Flags – Session-Persistenz gezielt auf sicheren Storage legen).

### 5.6 Missbrauch, Datenschutz, Betrieb
18. **Registrierung härten** (F11): E-Mail-Verifikation verpflichtend vor Datenzugriff, **kein** Phone-Autoconfirm ohne echten SMS-Provider + Rate-Limit; Captcha/Turnstile gegen Massen-Signups. RPC `delete_auth_user` prüfen/entfernen bzw. auf `service_role` beschränken.
19. **DSGVO/Datenminimierung:** Da Minderjährigendaten, Zahlungen und SEPA-Mandate verarbeitet werden – Verschlüsselung sensibler Felder at rest, Audit-Log (bereits als `audit_log` vorhanden – ausbauen), dokumentierte Löschkonzepte, DPIA für v2.
20. **Security-Testing als Prozess:** RLS-Policy-Tests (positiv/negativ) automatisiert, SAST/Dependency-Scanning, jährlicher Pentest, Secret-Scanning-Gate. „Break-glass"-Admin getrennt vom normalen Rollenmodell.

---

## 6. Fazit

Der Ist-Zustand kombiniert eine **inhaltlich solide RLS-Basis** mit einem **fundamental gebrochenen Vertrauensanker**: Das JWT-Signing-Secret ist der öffentlich bekannte Supabase-Demo-Default (F1/K1), und selbst bei dessen Behebung bleibt eine **eigenständige Privilege-Escalation** über die `users`-Update-Policy (F2). Beide sind für sich genommen „Game over" für die Vertraulichkeit sämtlicher personenbezogener Daten. Hinzu kommen schwache Betriebssecrets, ein in Git eingechecktes Secret und ein triviales Android-Keystore-Passwort.

Für v2 ist die Richtung klar: **asymmetrische, server-kontrollierte Auth mit kurzlebigen Tokens**, **Rollenherkunft aus verifizierten Claims statt editierbarer Tabellenspalte**, **RLS als zweite (nicht einzige) Verteidigungslinie**, **striktes Secret-Management außerhalb des Repos** und ein **gehärtetes Gateway** mit engem CORS, ohne offene Admin-/DB-Ports. Damit wird aus der heutigen „RLS-only, Demo-Keys"-Architektur ein belastbares, prüfbares Sicherheitsfundament.
