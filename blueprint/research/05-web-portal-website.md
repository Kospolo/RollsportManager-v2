# 05 – Web-Portal & öffentliche Website (Ist-Analyse & v2-Empfehlung)

> Fachreport im Rahmen der v2-Neubau-Vorstudie
> Rolle des Autors: Senior Web-Ingenieur
> Analysierte Codebasis (nur gelesen, nicht verändert): `/Users/marcelgoldfuss/Apps/RollsportManager/rollsportmanager-backend/www`
> Stand: 2026-07-09

---

## 1. Überblick

Das Web-Frontend von RollsportManager besteht aus **drei** logisch getrennten, physisch aber in einem Nginx-Container gebündelten Bereichen:

| Bereich | Pfad | Zweck | Umfang |
|---|---|---|---|
| **Öffentliche Website** | `www/*.html` | Marketing, Recht, SEO, Kontakt, Beta | ~18 HTML-Seiten, ca. 11.700 Zeilen |
| **Mitglieder-Portal** | `www/portal/*.html` | Voll funktionsfähige Vereins-Web-App | ~88 HTML-Seiten, ca. 54.000 Zeilen |
| **Betreiber-Admin** | `www/admin/*.html` | Super-Admin-Backoffice (Vereine, Zahlungen, Beta, Lizenzen) | ~23 HTML-Seiten, ca. 11.700 Zeilen |

Technisch handelt es sich um eine **rein statisch ausgelieferte Multi-Page-Application (MPA)** ohne Build-Schritt: handgeschriebenes HTML + Vanilla-JS + der Supabase-JS-Client, der direkt aus dem Browser gegen das self-hosted Supabase/Kong-Gateway spricht. Es gibt **kein Framework, kein Bundling, kein npm, kein TypeScript**. Ausgeliefert wird über `nginx:alpine`, das die Dateien beim Docker-Build hineinkopiert (`www/Dockerfile`) und zusätzlich als Reverse-Proxy die Supabase-Endpunkte (`/rest/v1/`, `/auth/v1/`, `/storage/v1/`, `/functions/v1/`) durchreicht (`www/nginx.conf`).

Das Portal ist funktional **erstaunlich vollständig** – es bildet praktisch den kompletten Funktionsumfang der nativen Apps im Browser ab (Mitglieder, Teams, Termine, Küren mit Media, Chat + Direktnachrichten, Finanzen/Rechnungen/Mahnwesen/SEPA, Wettkampf-Live-Modus, Check-in per QR, Übungsbibliothek, Galerie, Dokumente, PWA-Offline). Gleichzeitig ist es der Bereich mit der **höchsten technischen Verschuldung** der gesamten Produktfamilie: massive Code-Duplikation, mehrere parallele i18n-Systeme, monströse Einzeldateien (bis 113 KB pro HTML-Seite), hartkodierte Schlüssel und – kritisch – **hartkodierte Admin-Zugangsdaten im öffentlichen Web-Root**.

**Kernbewertung vorab:** Die öffentliche Website ist als klassische Marketing-MPA in Ordnung und mit moderatem Aufwand modernisierbar. Das Portal dagegen ist in seiner heutigen Form **nicht sinnvoll weiterpflegbar** und sollte für v2 als **kompletter Neubau (Next.js/React + TypeScript)** geplant werden – die Fachlogik/UX ist wertvoll und dient als Spezifikation, der Code selbst nicht.

---

## 2. Ist-Zustand im Detail

### 2.1 Technologie-Stack

- **Auslieferung:** `nginx:alpine`, Dateien per `COPY` in den Container gebrannt (`www/Dockerfile`). Kein Volume-Mount → jede Änderung erfordert `docker compose build --no-cache` (siehe `CLAUDE.md` Zeile 80–85). Für Entwicklung träge und fehleranfällig.
- **API-Zugriff:** Supabase-JS-Client (`www/assets/js/supabase-client.min.js`, lokal gebundelt, nicht per CDN) plus eigener Wrapper `www/assets/js/supabase.js` (710 Zeilen). Der Wrapper implementiert Umgebungsumschaltung remote/local über `localStorage` und einen „Demo-Modus"-Fallback.
- **Direkte DB-Zugriffe aus dem Browser:** Seiten sprechen teils direkt Tabellen an (`client.from('users').select(...)`), teils RPC-Funktionen (z. B. `www/portal/wettkampf-live.html` nutzt `supabaseClient.rpc('get_wettkampf_for_termin', …)`, `create_wettkampf`, `set_starter_score`). Sicherheit hängt damit **vollständig an Supabase-RLS-Policies** – das Frontend ist kein Vertrauensanker.
- **Icons:** Lucide via **CDN `unpkg.com`** in 74 Dateien eingebunden (`<script src="https://unpkg.com/lucide@latest/…">`). `@latest` = unversionierte, unkontrollierte Fremdabhängigkeit auf jeder Portalseite → Ausfall- und Supply-Chain-Risiko, blockierendes Third-Party-Script.
- **Fonts:** Google Fonts (`fonts.googleapis.com`) per `<link>` in 84 Portalseiten. Externer Request, DSGVO-relevant (US-Transfer), FOUT.
- **Kein Build/Transpile/Minify/Treeshaking.** JS wird als Quelltext ausgeliefert; Cache-Busting manuell über `?v=NN` in jedem `<script>`/`<link>` (siehe `sw.js`: `portal.js?v=46`, `portal.css?v=30`, `style.css?v=36` …).

### 2.2 Seiteninventar (Auszug)

**Öffentliche Website (`www/`):** `index.html` (288 KB!), `features.html` (90 KB), `faq.html` (109 KB), `pricing.html`, `download.html`, `blog.html`, `kontakt.html`, `impressum.html`, `datenschutz.html`, `agb.html` (49 KB), `beta.html`, `beta_rollsport.html`, `404.html`, `test.html` (Debug-Leftover).

**Portal (`www/portal/`, ~88 Seiten):** Kernnavigation `index.html` (Dashboard), `mitglieder.html` (93 KB), `teams.html` (93 KB), `profile.html` (**113 KB**), `kuer-detail.html` (74 KB), `calendar.html`, `termine.html`, `attendance.html`/`trainer-attendance.html`, `chat.html`/`direktnachrichten.html`, `wettkampf.html`/`wettkampf-live.html`/`wettkampf-modus.html`, sowie ein sehr breiter Finanzbereich: `finance.html`, `invoices.html`, `invoice-detail.html`, `invoice-admin.html`, `mahnungen.html`, `sepa.html`, `ratenzahlung.html`, `kassenbuch.html`, `budget.html`, `ausgaben.html`, `bankabgleich.html`, `jahresabschluss.html`, `finance-export.html`, `spenden.html`, `familien-rabatte.html`, `membership*.html`, `payments*.html`, `payment-methods.html`, `premium.html`, `monetization.html`. Plus Betrieb: `equipment.html`, `facilities.html`, `bookings.html`, `schliessfaecher.html`, `checkin.html`, `warteliste.html`, `verbandsmeldung.html`, `pflichtstunden.html`, `guest-trainers.html`, `ubungen.html`, `gallery.html`, `documents.html`, `achievements.html`, `jubilaeen.html`, `berichte.html`, `stats.html`.
Öffentliche Portal-Unterseiten (kein Login): `login.html`, `register.html`, `forgot-password.html`, `accept-invitation.html`, `accept-guest-invite.html`, `verein-join.html`, `verein-create.html`, `kuer-share.html`.
**Leftovers im Portal-Ordner:** `debug.html`, `database-migration.sql`, `testdaten.sql`, `update-sidebars.sh`, `my-qrcode.html` (441 Byte Stub).

**Betreiber-Admin (`www/admin/`):** `index.html`, `login.html`, `users.html`, `vereine.html`, `zahlungen.html`, `invoice-management.html`, `monetization.html`, `premium.html`, `lizenzen.html`, `beta.html`, `chat.html`, `email.html`, `seo.html`, `content.html`, `legal.html`, `statistiken.html`, `server.html`, `server-settings.html`, `settings.html`, `system.html`, `demo-data.html`.

### 2.3 Shared Assets (`www/assets/`)

- **JS (`assets/js/`):** `portal.js` (**3.349 Zeilen** – der zentrale God-Client), `translations.js` (**13.026 Zeilen**), `i18n.js` (**7.715 Zeilen**), `portal-kueren.js` (1.297), `portal-chat.js` (989), `portal-family.js` (796), `portal-pflichtstunden.js` (494), `admin.js` (483), `ads.js` (524), `ad-banner.js` (141), `auth.js` (319), `main.js` (332), plus `supabase.js`. Dazu Roh-Artefakte im ausgelieferten Ordner: `fix_translations.py`, `insert_translations.py`, `new-translations.js`, `i18n-additions.js`, mehrere `translations_*.json`.
- **CSS (`assets/css/`):** `style.css` (3.044 Zeilen, öffentliche Website), `portal.css` (3.582 Zeilen), `portal-chat.css` (1.226), `portal-kueren.css` (760). **Kein `prefers-color-scheme`/Dark-Mode** in beiden Haupt-Stylesheets (0 Treffer), obwohl die Seiten `theme-color`-Meta-Tags für Dark setzen – d. h. die Statusleiste wird dunkel, der Inhalt nicht.

### 2.4 i18n – zwei Systeme parallel

Es existieren **zwei komplett getrennte Übersetzungsmechanismen**:
1. Öffentliche Website: `assets/js/translations.js` (Objekt `translations` mit Punkt-Keys wie `'nav.start'`), eingebunden nur in ~3 Root-Seiten.
2. Portal: `assets/js/i18n.js` (IIFE `I18n` mit Unterstrich-Keys wie `tab_dashboard`), eingebunden in 84 Portalseiten. Die Übersetzungen sind **inline im JS** hinterlegt (nicht aus den daneben liegenden `translations_portal_*.json` geladen – `i18n.js` enthält kein `fetch`).

Beide decken 5 Sprachen (DE/EN/FR/RU/TR) ab, aber mit **doppelter Pflege, divergierenden Key-Konventionen** und toten JSON-Dateien. Zusätzlich existiert das Wartungsskript `portal/update-sidebars.sh`, das per `sed` `data-i18n`-Attribute in jede Portalseite einpatcht – ein klares Symptom fehlender Komponentisierung (die Sidebar existiert physisch dupliziert in jeder Datei).

### 2.5 Navigation / Sidebar – dualer, inkonsistenter Zustand

Die Portal-Sidebar wird **zweigleisig** gehandhabt und ist inkonsistent:
- `portal.js` hat ab Zeile 1204 eine `initSidebar()`/`renderSidebar()`-Routine, die die komplette Sidebar zur Laufzeit generieren *soll* („IMMER zentral generieren für Konsistenz").
- Gleichzeitig ist die Sidebar in vielen Seiten **statisch ausgeschrieben** (z. B. `teams.html` ab Zeile 32 mit voll ausgeschriebenen `<aside class="portal-sidebar">` … 13 `portal-nav-group-label`-Blöcke). Nur 8 der ~88 Seiten enthalten die Gruppen-Labels statisch, andere verlassen sich auf das JS-Rendering.

Ergebnis: dieselbe Navigation existiert in mehreren, teils voneinander abweichenden Repräsentationen – jede Menüänderung muss an mehreren Stellen und im `update-sidebars.sh` nachgezogen werden.

### 2.6 Rendering-Muster & DOM

Durchgängiges Muster: Daten laden → HTML-String per Template-Literal bauen → `element.innerHTML = ...`. Allein in den Portal-HTML-Dateien **338 `innerHTML`-Zuweisungen**, in `portal.js` 33, `portal-kueren.js` 20, `portal-chat.js` 9. Es gibt eine `escapeHtml()`-Hilfsfunktion, die in `portal-chat.js`/`mitglieder.html` teilweise genutzt wird, aber **inkonsistent**: In `portal.js` werden Nutzerfelder (`termin.team.name`, `item.title`, `verein.vereinsname`) direkt ohne Escaping interpoliert (z. B. Zeilen 1927 f., 2451 ff., 2574, 2683). Das ist ein systematisches **Stored-XSS-Risiko** über vom Nutzer/Verein befüllte Felder.

### 2.7 PWA / Offline

Solide umgesetzt: `manifest.json` (Standalone, Icons, Shortcuts) und `sw.js` (`CACHE_NAME = 'rsm-v9'`, Network-First für Navigation mit Offline-Fallback `portal/offline.html`, Cache-First/Stale-While-Revalidate für Assets, Fremd-Hosts explizit ausgenommen). Das ist der qualitativ beste Teil des Frontends. Nachteil: Der Precache listet feste `?v=`-URLs, die bei jedem Asset-Bump manuell mitgezogen werden müssen.

---

## 3. Stärken

1. **Funktionaler Reifegrad:** Das Portal ist keine Alibi-Web-Ansicht, sondern eine vollwertige Vereins-Web-App mit Finanzwesen, Live-Wettkampf, Chat und Media. Als **fachliche Spezifikation für v2** ist das Gold wert.
2. **Klare Serverabhängigkeit über RLS:** Da alle Zugriffe über den Supabase-Client/Kong laufen, liegt die Autorisierung serverseitig (RLS) – der Neubau kann dasselbe Backend weiterverwenden, ohne die Sicherheitslogik neu zu erfinden (sofern RLS sauber ist; separat zu prüfen).
3. **PWA/Offline-Konzept** ist durchdacht und funktioniert (Service Worker, Manifest, Offline-Seite, Install-Banner).
4. **Mehrsprachigkeit** (5 Sprachen) ist inhaltlich vorhanden – die Übersetzungstexte selbst sind wiederverwendbar, auch wenn der Mechanismus zu ersetzen ist.
5. **Reverse-Proxy-Setup** (`nginx.conf`) kapselt Supabase sauber unter same-origin `/rest`, `/auth`, `/storage`, `/functions` – gutes Muster, das man in v2 beibehalten kann.
6. **Konsistente Design-Sprache** (Inter-Font, Indigo `#6366f1`, Lucide-Icons) – als visuelle Referenz brauchbar.

---

## 4. Schwächen / Altlasten

### 4.1 Sicherheit (kritisch)

- **KRITISCH – hartkodierte Admin-Zugangsdaten im öffentlichen Web-Root:** `www/portal/debug.html` (Zeile ~19) enthält im Klartext einen Auto-Login:
  `client.auth.signInWithPassword({ email: 'admin@rollsportmanager.de', password: 'admin123' })`.
  Diese Datei wird mit ausgeliefert (kein Ausschluss, kein `.dockerignore`). Jeder, der die URL kennt, erhält Admin-Kontext bzw. lernt gültige Betreiber-Credentials. **Sofort entfernen + Passwort rotieren.**
- **Service-Role-Key im Frontend:** `www/admin/server-settings.html` (Zeilen 337/348/551/564–565) rendert `anonKey` **und `serviceRoleKey`** als HTML-`value` bzw. JS-Objektfeld. Der Service-Role-Key umgeht RLS vollständig. Er darf **nie** an einen Browser ausgeliefert werden – auch nicht auf einer Admin-Seite (Admin-Seiten sind nur clientseitig geschützt, s. u.).
- **Anon-Key in 14 Dateien hartkodiert** (`supabase.js`, `test.html`, `debug.html`, `beta*.html`, mehrere `admin/*.html`). Der Anon-Key ist zwar per Design öffentlich, aber die Streuung macht Rotation praktisch unmöglich und zeigt das fehlende Konfigurationskonzept.
- **Admin-Gate rein clientseitig:** `assets/js/auth.js` (`checkAdminAccess()`, Zeile 34 ff.) und `admin.js` prüfen die Rolle im Browser und leiten per `window.location.href` um. Das ist **kein Zugriffsschutz** – die HTML/JS-Dateien unter `/admin/` sind statisch abrufbar; der einzige echte Schutz sind (hoffentlich vorhandene) RLS-Policies auf den Daten. Die Redirects sind reine UX.
- **CORS `Access-Control-Allow-Origin *`** auf allen proxied Supabase-Locations (`nginx.conf`, u. a. Zeilen 50, 77, 118, 140) – für einen öffentlichen API-Layer mit Auth-Header zu offen.
- **XSS über `innerHTML`** ohne durchgängiges Escaping (siehe 2.6).
- **Debug-/Test-Leftovers im Prod-Image:** `www/test.html`, `www/portal/debug.html`, `www/portal/testdaten.sql`, `www/portal/database-migration.sql`, `www/portal/update-sidebars.sh`, `assets/js/fix_translations.py`/`insert_translations.py` werden alle mit ins Container-Image kopiert.

### 4.2 Wartbarkeit / Architektur

- **Extreme Datei-Monolithen:** `profile.html` 113 KB / ~1.938 Zeilen, `teams.html` & `mitglieder.html` je ~93 KB, `kuer-detail.html` 74 KB. Jede Seite mischt Markup, seitenlokales `<style>` (57 Portalseiten haben inline `<style>`-Blöcke) und mehrere `<script>`-Blöcke (profile.html: 10 Script-Tags). `index.html` der Website ist **288 KB** – überwiegend 146 inline-SVGs (~32 KB) und inline-Skripte.
- **God-Object `portal.js` (3.349 Zeilen):** globaler `Portal`-Namespace + `PortalState`, der Auth, Sidebar-Rendering, Demo-Modus, Admin-Override, Dashboard, Filter, PWA-Banner etc. vereint. Zustands­haltung über `localStorage`-Streuung (`portal_demo_mode`, `admin_override_active`, `admin_selected_verein`, `portal_abteilung_filter` …). Keine Modultrennung, kein Import/Export.
- **Massive Duplikation:** Head-Block (Meta/Fonts/Lucide/i18n) in 84 Seiten kopiert; Sidebar dupliziert (s. 2.5); jedes CSS teils redundant inline. Ein Farb-/Nav-/Layoutwechsel ist ein projektweites Such-Ersetzen.
- **Manuelles Cache-Busting** (`?v=NN`) über hunderte Stellen, plus Precache-Liste im SW – hoch fehleranfällig (bekanntes „Stale-Bundle"-Problem, vgl. Memory-Notizen zu GOMESSMO).
- **Doppeltes i18n-System** (4.4 KB+13 KB+7,7 KB JS) mit toten JSON-Dateien und `sed`-Patch-Skript.
- **Kein Build/Test/Lint/Typisierung:** keine Typsicherheit, keine automatisierten Tests, keine Bundlegröße-Kontrolle. Fehler zeigen sich erst zur Laufzeit in der Konsole (vgl. „Seite lädt unendlich" in `CLAUDE.md`). Die jüngsten Git-Commits drehen sich genau darum: „SyntaxError in Admin-Seiten behoben: Doppelte Deklarationen entfernt".
- **Deploy-Reibung:** Image-COPY statt Mount → `--no-cache`-Rebuild bei jeder Änderung.

### 4.3 Responsive / UX / A11y

- Nur wenige Breakpoints (`portal.css`: je 1–5 Regeln bei 1024/768/640 px). Für 88 funktionsreiche Seiten (Finanztabellen, Wettkampf-Live) ist das dünn; Datentabellen sind auf Mobil kaum getestet.
- **Kein echter Dark-Mode** trotz Dark-`theme-color`.
- A11y-Lücken: viele klickbare `<div>`/`<a>` mit `onclick`, Icon-only-Buttons, keine erkennbare ARIA-Strategie, Fokus-Management bei Modals (via `innerHTML`) unklar.
- Blockierende Third-Party-Requests (Lucide `@latest`, Google Fonts) auf jeder Seite → LCP/Ladezeit leidet, besonders mobil.

### 4.4 SEO (nur öffentliche Website relevant)

- Basis vorhanden: `robots.txt`, `sitemap.xml`, Open-Graph auf `index.html`, `meta description/keywords`.
- **Aber:** `sitemap.xml` ist veraltet (nur 7 URLs, `lastmod` 2026-01-04; `features`/`pricing`/`faq`/`kontakt`/`blog` teils gar nicht gelistet). **Kein `hreflang`** trotz 5 Sprachen (0 Treffer) → Mehrsprachigkeit ist für Suchmaschinen unsichtbar, i18n passiert rein clientseitig per JS. **Kein `application/ld+json`/Structured Data** (0 Treffer) → keine Rich Results. Kein Canonical-Konzept. Der clientseitige Sprach-Switch ohne server-side Rendering bedeutet, dass Crawler nur die DE-Defaults sehen.

---

## 5. Bewertung: rettbar oder Neubau?

**Öffentliche Website (`www/`):** *Teilweise rettbar, aber Neubau empfohlen.* Inhaltlich klein; der Aufwand, sie in ein modernes, SEO-fähiges Framework mit SSR/SSG zu überführen, ist gering und zahlt sich sofort aus (hreflang, Structured Data, echte Mehrsprach-URLs, Performance). Die Texte/Assets werden übernommen.

**Portal (`www/portal/`):** **Kompletter Neubau.** Begründung: ~54.000 Zeilen dupliziertes, ungetestetes, un-typisiertes Vanilla-HTML/JS mit God-Object, ohne Komponentisierung, mit systemischen XSS-Stellen und rein clientseitigem Auth-Schein. Eine Migration „in place" würde bedeuten, den gesamten Code zu re-architektieren und dabei alle Duplikate synchron zu halten – teurer und riskanter als ein Neubau. Der **fachliche Wert liegt in der Feature- und UX-Spezifikation**, nicht im Code. Das **Backend (Supabase/Kong/RLS/Edge-Functions) bleibt** und wird der stabile Anker.

**Betreiber-Admin (`www/admin/`):** **Neubau**, mit sofortigem Sicherheits-Cleanup (Service-Role-Key raus, Auth serverseitig).

---

## 6. Empfehlungen für v2 (Web)

### 6.1 Sofortmaßnahmen am Bestand (noch vor v2, Sicherheits-Hotfixes)
1. `www/portal/debug.html` und `www/test.html` löschen; Passwort `admin@rollsportmanager.de` **rotieren**.
2. Service-Role-Key aus `www/admin/server-settings.html` entfernen; nie an Clients ausliefern.
3. `.dockerignore`/Build so anpassen, dass `*.sql`, `*.sh`, `*.py`, `debug*`, `test*` nicht ins Prod-Image gelangen.
4. RLS-Policies für alle Portal-/Admin-Tabellen verifizieren (Frontend ist ungeschützt – Sicherheit muss zu 100 % serverseitig sitzen).

### 6.2 Ziel-Architektur v2
- **Framework:** **Next.js (App Router) + React + TypeScript**. Begründung: SSR/SSG für die öffentliche Website (SEO, hreflang, Structured Data, i18n-Routing), React-Client-Komponenten für das datenintensive Portal, ein Repo/ein Design-System für beide.
- **Ein Monorepo** (z. B. Turborepo): `apps/website` (SSG), `apps/portal` (authentifizierte App), `apps/admin` (Betreiber), `packages/ui` (Design-System), `packages/api` (typisierter Supabase-Client), `packages/i18n`.
- **Supabase weiterverwenden** über `@supabase/supabase-js` + **generierte Typen** (`supabase gen types typescript`) → Ende der stringly-typed `.from('users')`-Aufrufe. **Auth-Session serverseitig** über Next.js Middleware/Server Components (`@supabase/ssr`); geschützte Routen sind echt geschützt, nicht per Redirect.
- **Rendering:** Server Components + typisierte Data-Loader statt `innerHTML`-String-Building → strukturelles Ende des XSS-Musters; React escaped standardmäßig.
- **State:** TanStack Query für Server-State (Caching, Invalidation) statt `localStorage`-Streuung; Realtime (Wettkampf-Live, Chat) über Supabase Realtime-Channels in dedizierten Hooks.

### 6.3 Design-System & UI
- **Ein** Komponenten-Set (Sidebar, Tabelle, Modal, Formularfeld, Card) in `packages/ui` – die heute in 88 Dateien duplizierte Sidebar wird **eine** Komponente. `update-sidebars.sh` entfällt ersatzlos.
- **Design-Tokens** (Farben, Spacing, Typo) zentral; **echter Dark-Mode** über `prefers-color-scheme` + Token-Umschaltung.
- **Tailwind CSS** (oder CSS-Modules) statt 8.600+ Zeilen handgepflegtem CSS mit Inline-`<style>`.
- **Icons lokal bündeln** (`lucide-react`) – Schluss mit `unpkg.com/@latest`. **Fonts self-hosted** (next/font) – DSGVO + Performance.
- Mobile-First mit durchdachten Breakpoints; Finanztabellen als responsive/scrollbare Komponenten; Wettkampf-Live als eigenständige, für Tablet optimierte Ansicht.

### 6.4 i18n
- **Ein** System (z. B. `next-intl`) mit **JSON-Message-Catalogs pro Sprache**, geteilt zwischen Website und Portal. Öffentliche Seiten mit **lokalisierten Routen** (`/de`, `/en`, …) + `hreflang` + lokalisierten Sitemaps → echte Mehrsprach-SEO. Bestehende Übersetzungstexte aus `translations.js`/`i18n.js`/`translations_portal_*.json` werden migriert und dedupliziert. **Umlaute strikt** (ä/ö/ü/ß), DE+EN als Pflicht-Default für jede neue Zeichenkette.

### 6.5 SEO (Website)
- SSG/SSR-Metadaten pro Seite, Canonical, `hreflang`, Open-Graph/Twitter-Cards, **JSON-LD** (`SoftwareApplication`, `Organization`, `FAQPage` für die FAQ, `Offer` für Pricing). Automatisch generierte, immer aktuelle `sitemap.xml` inkl. aller Sprachvarianten.

### 6.6 Sicherheit
- Nur **Anon-Key** im Client, aus `NEXT_PUBLIC_*`-Env; Service-Role ausschließlich in serverseitigen Route-Handlern/Edge-Functions. Content-Security-Policy-Header (keine `unpkg`/inline-Skripte mehr nötig). CORS eng auf die eigene Origin. Auth-Guards in Middleware. Automatisiertes Dependency-Scanning.

### 6.7 Betrieb / DX
- **Build-Pipeline** (Vite/Next-Build, Bundle-Splitting, automatisches Hashing statt `?v=NN`), **CI mit Lint + Typecheck + Tests** (Vitest/Playwright für kritische Flows: Login, Zahlung, Wettkampf-Live). Deploy als optimiertes statisches/SSR-Artefakt hinter dem bestehenden Nginx/Kong-Reverse-Proxy (das Proxy-Muster aus `nginx.conf` bleibt gültig). PWA-Funktionalität über `next-pwa` o. ä. mit automatischem Precache-Manifest (Ende der handgepflegten SW-Liste).

### 6.8 Migrationsstrategie
- **Backend einfrieren, Frontend neu.** Öffentliche Website zuerst (klein, schnelle SEO-Gewinne, Risiko niedrig). Dann Portal modulweise entlang der bestehenden Feature-Domänen (Auth → Dashboard → Mitglieder/Teams → Termine/Anwesenheit → Finanzen → Wettkampf/Chat). Alte statische Seiten pro Modul abschalten, sobald die React-Route live ist. Der heutige Code dient als **lebende Spezifikation**, nicht als Migrationsbasis.

---

## 7. Referenzierte Dateien (Auswahl)

- Auslieferung: `www/Dockerfile`, `www/nginx.conf`, `www/docker-compose.yml`
- Kern-JS: `www/assets/js/portal.js` (3.349 Z.), `www/assets/js/supabase.js`, `www/assets/js/auth.js`, `www/assets/js/i18n.js` (7.715 Z.), `www/assets/js/translations.js` (13.026 Z.), `www/assets/js/ads.js`
- Kern-CSS: `www/assets/css/portal.css` (3.582 Z., kein Dark-Mode), `www/assets/css/style.css` (3.044 Z.)
- Duplikations-Symptom: `www/portal/update-sidebars.sh`, statische Sidebar in `www/portal/teams.html`
- Sicherheitsbefunde: `www/portal/debug.html` (Klartext-Admin-Login `admin123`), `www/admin/server-settings.html` (Service-Role-Key im DOM), `www/test.html`
- SEO: `www/robots.txt`, `www/sitemap.xml` (veraltet, 7 URLs), `www/index.html` (288 KB, kein hreflang/JSON-LD)
- PWA: `www/manifest.json`, `www/sw.js` (`rsm-v9`)
- Monolithe: `www/portal/profile.html` (113 KB), `www/portal/mitglieder.html` (93 KB), `www/portal/teams.html` (93 KB), `www/portal/kuer-detail.html` (74 KB)
- Realtime-Beispiel: `www/portal/wettkampf-live.html` (RPC-Aufrufe)
