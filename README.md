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
packages/contracts/  OpenAPI, Sync-Spec, Widget-Contract, Codegen
services/api/        Hono-API (Writes, Geld-Ops, Entitlements)
services/media/      Upload, Waveform-Peaks, signierte URLs
supabase/            Migrationen, Schemas, pgTAP-Tests, Seeds
sync/                PowerSync Sync Rules
etl/                 v1→v2-Migration (idempotent, verifiziert)
infra/               Hetzner-Prod, Proxmox-Staging, Runbooks
```

## Portal starten

```bash
cd apps/web
npm install
npm run tokens   # generiert app/tokens.css aus design/tokens.json
npm run dev      # http://localhost:3021
```

## Eiserne Regeln dieser Phase

- Das Portal läuft zu **100 % auf Mock-Daten** (`apps/web/lib/mock/`) — keine Verbindung zu rollsportmanager.de, Supabase oder irgendeiner echten API.
- UI immer **Deutsch und Englisch**, deutsche Strings mit echten Umlauten (ä/ö/ü/ß).
- Light **und** Dark Mode überall (CSS-Variablen aus `tokens.css`, `data-theme` am `<html>`).
- Max. ~400 Zeilen pro Datei, keine God-Components.
- Das Alt-Projekt `/Users/marcelgoldfuss/Apps/RollsportManager` wird nicht angefasst.
