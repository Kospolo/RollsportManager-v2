# RollsportManager v2

Moderner Neuaufbau der Vereins-Management-App für Rollkunstlauf — Monorepo für Web-Portal, iOS, Android, API-Services und Infrastruktur.

## Quellen der Wahrheit

| Thema | Datei |
|---|---|
| Gesamt-Blueprint (Architektur, ADRs, Roadmap) | `blueprint/01-BLUEPRINT-V2.md` |
| Studien-Synthese | `blueprint/00-STUDIE-SYNTHESE.md` |
| Design-System „Heimspiel" | `design/DESIGN-SYSTEM.md` |
| Design-Tokens (maschinenlesbar) | `design/tokens.json` |
| Visuelle Referenz | `design/final/mockup-final.html` |

## Struktur (Blueprint Abschnitt 7)

```
blueprint/      Studie, Blueprint, ADRs (neue Entscheidungen nur als ADR)
apps/web/       Next.js-Portal (App Router, DE/EN, Port 3021)
apps/ios/       später: SwiftUI (xcodegen)
apps/android/   später: Compose
packages/tokens/     Token-Pipeline (tokens.json → CSS/Swift/Kotlin)
packages/contracts/  OpenAPI (Quelle: services/api), Codegen TS/Swift/Kotlin, Sync-Spec
services/api/        Hono-API, Port 3022 (Writes, Geld-Ops, Entitlements, Billing/Webhooks)
services/media/      später: Upload, Waveform-Peaks, signierte URLs
supabase/            Migrationen 0001–0006, Schema-Doku, Seed, SQL-Sicherheitstests
sync/                später: PowerSync Sync Rules (Spec: packages/contracts/sync-spec.md)
etl/                 später: v1→v2-Migration (idempotent, verifiziert)
infra/               später: Hetzner-Prod, Proxmox-Staging, Runbooks
```

## Portal starten

```bash
cd apps/web
npm install
npm run tokens   # generiert app/tokens.css aus design/tokens.json
npm run dev      # http://localhost:3021
```

## Backend prüfen (alle lokal, Wegwerf-Postgres `rsm2-pg-test`)

**Alle fünf sind Pflicht-Gates. Keines ersetzt ein anderes.**

```bash
supabase/scripts/db-test.sh              # Schema + Seed + RLS-Grundchecks
supabase/tests/run-tests.sh              # SQL-Sicherheitstests (RLS/Mandanten/GoBD), aktuell 852
cd services/api && npm test              # Unit-Tests (ohne Netz/DB), aktuell 199
cd services/api && npm run db:test       # PFLICHT: API-End-to-End-Smoke über HTTP (scripts/smoke.mjs)
cd packages/contracts && npm run check   # Contract-Gate (Spec-Frische + Codegen-Drift)
```

### Warum `npm run db:test` (smoke.mjs) kein „nice to have“ ist

Die SQL-Suite kann `services/api/src` **strukturell nicht sehen**: `run-tests.sh`
startet einen Container und schiebt `tests/sql/*.sql` per `psql` hinein — es wird
nie eine Zeile TypeScript geladen. Alles, was zwischen HTTP-Anfrage und SQL liegt
(Guards, Service-Mode-Aufrufe, Redigierung von Spalten, Routen-Verdrahtung),
liegt damit in ihrem toten Winkel.

Das ist keine Theorie: mit **sabotiertem `routines.ts`** blieb die SQL-Suite
**grün** — rot wurde ausschließlich der Smoke. Genau diese Lücke hat dazu
geführt, dass „Kür anlegen“ tagelang für *jede* Rolle kaputt war, ohne dass ein
Gate es gemerkt hat.

Faustregel: **wer `services/api/src` anfasst, muss `npm run db:test` laufen
lassen.** Ein grünes SQL-Gate sagt darüber nichts aus.

> `scripts/api-db-test.sh` ist nur auf einem frischen `dev-stack.sh reset`
> aussagekräftig — er ist nicht idempotent.

Alle drei Shell-Harnesse teilen sich `supabase/scripts/lib/pg-harness.sh`
(Container `rsm2-pg-test`, `postgres:16-alpine`, `127.0.0.1:55432`, `--rm`) —
sie dürfen nicht gleichzeitig laufen und fassen nie Produktions-Container an.

## Eiserne Regeln dieser Phase

- Das Portal läuft zu **100 % auf Mock-Daten** (`apps/web/lib/mock/`) — keine Verbindung zu rollsportmanager.de, Supabase oder irgendeiner echten API.
- UI immer **Deutsch und Englisch**, deutsche Strings mit echten Umlauten (ä/ö/ü/ß).
- Light **und** Dark Mode überall (CSS-Variablen aus `tokens.css`, `data-theme` am `<html>`).
- Max. ~400 Zeilen pro Datei, keine God-Components.
- Das Alt-Projekt `/Users/marcelgoldfuss/Apps/RollsportManager` wird nicht angefasst.
