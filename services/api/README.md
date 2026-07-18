# services/api — RollsportManager v2 API-Schicht

Dünner, typisierter Node/TypeScript-Service (**Hono** + `@hono/zod-openapi`) gemäß Blueprint ADR-E2: **alle schreibenden Business-Operationen und alle Geld-Operationen** laufen über diese Schicht. Die OpenAPI-Spec dieses Services ist die Codegen-Quelle für Swift/Kotlin/TS (`packages/contracts/openapi.json`).

## Start

```bash
cd services/api
npm install
cp .env.example .env      # Werte anpassen (nur Fallback — Ziel ist das Admin-UI)
npm run dev               # tsx watch, Port 3022 (3021 = Web-Portal!)
```

| Script | Zweck |
|---|---|
| `npm run dev` | Dev-Server auf `127.0.0.1:3022` |
| `npm run typecheck` | `tsc --noEmit` (strict) |
| `npm test` | Vitest-Unit-Tests (ohne Netz/DB) |
| `npm run openapi` | schreibt die Spec nach `packages/contracts/openapi.json` |
| `npm run build` | kompiliert nach `dist/` |
| `npm run db:test` | End-to-End-Smoke gegen Wegwerf-Postgres (`scripts/api-db-test.sh`) |

**Konfiguration:** `.env` ist ausdrücklich nur der Fallback. Alle Werte laufen über `src/config.ts`, damit sie später aus einer Admin-UI-Settings-Tabelle kommen können (Nutzer-Präferenz „Einstellungen immer ins Admin").

## Auth-Modell (ADR-E3)

* **dev:** HS256 mit Shared Secret (`AUTH_MODE=dev`, `AUTH_JWT_SECRET`).
* **prod:** ES256 über die GoTrue-JWKS-URL (`AUTH_MODE=prod`, `AUTH_JWKS_URL`) — der private Schlüssel verlässt nie den Auth-Container; `jose` cached/rotiert die JWKS automatisch.
* Claims-Vertrag (vom GoTrue Custom-Access-Token-Hook geschrieben):
  `sub` (uuid) · `role = authenticated` · `club_roles = { "<club_id>": "owner|admin|treasurer|coach|member|guest_coach" }`.
  Tokens mit anderem `role` (z. B. `service_role`) oder unbekannten Rollenwerten werden abgelehnt — die API selbst **ist** der Service.

## RLS-Impersonation statt RLS-Umgehung (`src/db.ts`)

Die API ist **kein** RLS-Bypass. Pro Request wird eine Transaktion geöffnet und darin

1. `SET LOCAL request.jwt.claims = '<verifizierte Claims>'`
2. `SET LOCAL ROLE authenticated`

gesetzt — exakt das, was PostgREST tun würde. Damit gelten **alle** RLS-Policies und Schutz-Trigger (`protect_club_membership`, Ledger-Immutability, Gast-Ablauf-Prüfung) auch für API-Statements. RLS bleibt zweite Verteidigungslinie, die Guards in `src/lib/guards.ts` sind die erste.

**Service-Modus** (`withServiceRole(reason, fn)`) existiert nur für explizit markierte System-Ops — aktuell einzig die Rechnungserstellung, weil `app.next_invoice_number()` EXECUTE-only für `service_role` ist. Jede Service-Modus-Stelle autorisiert selbst und prüft finanzielle Rollen **zusätzlich gegen die DB** (`club_members`), nicht nur gegen Claims (Blueprint-Risiko #16, Claim-Staleness ≤ 15 min).

**Verbindungsrolle:** Die API verbindet sich mit einer dedizierten Rolle, die Mitglied von `authenticated` **und** `service_role` ist (im lokalen Harness: der `postgres`-Superuser). In Prod: `CREATE ROLE rsm2_api LOGIN; GRANT authenticated, service_role TO rsm2_api;` — nie den Superuser.

## Routen (Phase 1)

Alle Routen (außer `/health`, `/openapi.json`) verlangen einen Bearer-JWT. Fehler kommen durchgängig als **RFC 7807 `application/problem+json`** mit `request_id` (Header `x-request-id` wird übernommen oder generiert).

| Methode + Pfad | Rollen | Bemerkung |
|---|---|---|
| `GET /health` | öffentlich | Liveness, ohne DB |
| `GET /openapi.json` | öffentlich | Spec (identisch mit `npm run openapi`) |
| `GET /clubs` | Mitglied | RLS-scoped: nur eigene Vereine |
| `GET /clubs/{clubId}` | Mitglied | |
| `PATCH /clubs/{clubId}` | owner/admin | |
| `GET /clubs/{clubId}/members` | Mitglied | Roster |
| `POST /clubs/{clubId}/members` | owner/admin | `owner` nie zuweisbar; `guest_coach` braucht `valid_until` |
| `POST /clubs/{clubId}/members/invite` | owner/admin | Stub: validiert + loggt, 202 |
| `PATCH /clubs/{clubId}/members/{memberId}/role` | owner/admin | nie eigene Rolle; Owner-Zeilen nur durch Owner; **letzter Owner nie demotebar (409)** |
| `GET /events?club_id=` | Mitglied | optional `from`/`to` |
| `POST /events` | owner/admin/coach | inkl. `team_ids` (n:m) |
| `PUT /events/{eventId}/rsvp` | selbst/Eltern/Coach+ | Upsert; Eltern-Modus via `guardianships` (RLS `can_act_for_member`) |
| `PUT /events/{eventId}/attendance` | coach+ inkl. guest_coach | Gast-Ablauf serverseitig via RLS |
| `GET /routines?club_id=` | Mitglied | |
| `POST /routines` | coach+ inkl. guest_coach | inkl. `skater_member_ids` (Paarlauf n:m) |
| `GET /routines/{routineId}` | Mitglied | |
| `GET/POST /routines/{routineId}/markers` | lesen: Mitglied · schreiben: coach+ | A-B-Loop-Anker, RollArt-Element-Codes |
| `GET/POST /routines/{routineId}/scores` | lesen: Mitglied · schreiben: coach+ | RollArt technical/components/total |
| `GET /invoices?club_id=` | RLS | Finanzrollen alles, Mitglieder eigene/Kinder |
| `POST /invoices` | owner/admin/treasurer | **Service-Modus**: Nummer via `app.next_invoice_number()`, Rolle gegen DB verifiziert |
| `POST /invoices/{invoiceId}/send-reminder` | owner/admin/treasurer | Stub: `dunning_level` +1 (max 3) + Log |
| `GET /entitlements/{clubId}` | Mitglied | **read-only** — geschrieben wird nur vom Webhook-Service |
| `GET /products` | Mitglied | Produktkatalog (Single Source of Truth für Preise, ADR-E7) |
| `POST /clubs/{clubId}/dunning/run` | owner/admin/treasurer | Mahnlauf, `dry_run` **default true**; Stufe ≥ 2 nie automatisch |
| `POST /webhooks/stripe` | — (HMAC-Signatur) | Webhook-Service; **nicht** in der OpenAPI-Spec (kein Client-Vertrag) |
| `POST /webhooks/revenuecat` | — (Authorization-Header) | Webhook-Service; **nicht** in der OpenAPI-Spec |

## Payments & Billing (ADR-E6)

* **`entitlements` ist die einzige Lizenz-Wahrheit** und wird ausschließlich über `applyEntitlementChange()` (`src/modules/billing/entitlements.ts`) geschrieben — immer im Service-Modus, immer mit Audit-Eintrag (`metadata.audit`, gedeckelt auf 20 Einträge, plus strukturierte Log-Zeile). Das v1-Leck (`activate_premium` für alle) ist damit strukturell unmöglich.
* **Zustandsautomat:** `trial → active → past_due → active|canceled`, `canceled → active` (Re-Subscribe); Tier `basic|pro|premium`. Illegale Übergänge werfen `EntitlementTransitionError`; Alt-/Manual-Zeilen ohne `metadata.status` (Seed-Grandfather) gelten als `active`.
* **EIN Webhook-Service** (`src/modules/billing/webhooks.ts`): Stripe mit **verpflichtender** HMAC-Signaturprüfung (`stripe-signature`, Toleranzfenster, timing-safe — ohne gültige Signatur keinerlei Verarbeitung, 400), RevenueCat mit statischem Authorization-Header (timing-safe, 401). Idempotenz über `internal.webhook_events unique(provider, event_id)`: Replays antworten 200 mit `outcome=replay` ohne Doppelverarbeitung. Claim + Entitlement-Write laufen in EINER Service-Transaktion; Infrastrukturfehler ⇒ Rollback + 500 (Provider-Retry), Domänenfehler (illegaler Übergang, unbekannter Produktcode) ⇒ `status=failed` + 200 (kein Retry-Sturm).
* **Mapping:** Stripe-Subscription (Checkout setzt `metadata.club_id` + `product_code`) → Club-Entitlement `club_license`; RevenueCat (`app_user_id` = `profiles.id`) → `personal_pro`-Stub. `CANCELLATION` bei RevenueCat schaltet nur Auto-Renew ab — erst `EXPIRATION` cancelt.
* **Mahnlauf** (`src/modules/dunning/engine.ts`, pure Funktion): Zeitleiste **+7/+21/+35/+49 Tage** nach `due_on` = Stufe 1–4. Nur Stufe 1 (Zahlungserinnerung) darf bei `dry_run=false` automatisch gesetzt werden; alles ≥ 2 kommt als `pending_approval` zurück (Anwendung heute via `send-reminder`). Stufe 4 = Eskalations-Vorschlag (`escalation: true`, `dunning_level` bleibt DB-gedeckelt bei 3).
* **EPC-QR/GiroCode** (`src/lib/epc-qr.ts`): EPC069-12-Payload für den Banküberweisungs-Fallback — IBAN-MOD-97, ISO-11649-Referenz, Integer-Cents, 331-Byte-Limit. QR-Rendering ist Client-/Portal-Sache.
* **Konfiguration:** `STRIPE_WEBHOOK_SECRET`, `REVENUECAT_WEBHOOK_AUTH`, `STRIPE_SIGNATURE_TOLERANCE_SECONDS` (`src/config.ts`, Admin-UI später, `.env` nur Fallback). In `AUTH_MODE=prod` antworten die Webhooks mit **503**, solange Platzhalter konfiguriert sind.

## Tests

* **Unit (`npm test`, ohne Netz/DB):** Auth-Middleware (gültig/abgelaufen/falsche Signatur/service_role-Token/kaputte Claims), Rollen-Guards inkl. `checkRoleChange`-Matrix (Selbst-Änderung, Owner-Schutz, letzter Owner), Zod-Schemas (Integer-Cents, guest_coach-Ablauf, Enum-Grenzen), Entitlement-Zustandsautomat + Single-Writer (Audit-Trail, Tier-Wechsel, Legacy-Rows), Webhook-Signaturen (gültig/ungültig/stale/Key-Rotation) inkl. voller HTTP-Pipeline mit Replay-Dedupe gegen In-Memory-Store, Mahnlauf-Engine mit Zeitreisen-Fixtures, EPC-QR (IBAN-MOD-97, RF-Referenzen, Byte-Limit).
* **End-to-End (`npm run db:test`):** startet über die gemeinsame Harness-Lib `supabase/scripts/lib/pg-harness.sh` (auch von `db-test.sh` und `tests/run-tests.sh` genutzt) den Wegwerf-Container `rsm2-pg-test` (postgres:16-alpine, `127.0.0.1:55436`, `--rm` + trap-Cleanup), spielt Shim + alle Migrations + Seed ein, startet die API auf Port 3123 und fährt `scripts/smoke.mjs`: Mandanten-Isolation, Eltern-RSVP (positiv + fremdes Kind negativ), Gasttrainer-Anwesenheit, Rollenwechsel-Negativfälle, Rechnungsnummer `R-JJJJ-0091`, gefälschte Treasurer-Claims (DB-Verifikation greift). Kein Prod-Container wird berührt.

## Für Folge-Teams

* **Contracts/Codegen:** `npm run openapi` ist die einzige Quelle von `packages/contracts/openapi.json`. Response-Schemas werden zur Laufzeit geparst (`schema.parse(row)`) — Drift zwischen DB und Spec fliegt sofort auf.
* **Payments/Webhooks:** Webhook-Service (Stripe/RevenueCat) gehört in diese Codebasis, schreibt `entitlements` ausschließlich über `withServiceRole` und dedupliziert über `internal.webhook_events (provider, event_id)`. Signaturprüfung verpflichtend.
* **Nie** `next_invoice_number` umgehen oder Rechnungsnummern client-seitig bauen.
