# packages/contracts — Der Shared Contract (ADR-E1)

Das Herzstück gegen die v1-Drift: **Typen werden generiert, nie von Hand
dupliziert.** Quelle der Wahrheit ist die OpenAPI-Spec der API-Schicht;
daraus entstehen TypeScript-, Swift- und Kotlin-Typen über eine eigene,
Template-basierte Pipeline **ohne schwere Dependencies** (nur Node ≥ 20).

*(Der versionierte `widget-contract/` für iOS-/Android-/Watch-Widgets folgt
mit der Widget-Phase.)*

## Dateien

| Pfad | Inhalt |
|---|---|
| `openapi.json` | Quelle der API-Wahrheit. Wird AUSSCHLIESSLICH per `npm run openapi` in `services/api` erzeugt (aus den Zod-Route-Definitionen) — nie von Hand editieren. |
| `sync-spec.md` | Verbindlicher Offline-/Sync-Vertrag (Tiering, Konfliktregel LWW + `updated_at`, Outbox-Semantik) für iOS/Android/Web — Blueprint ADR-E5. |
| `codegen/lib/spec.mjs` | Gemeinsames Laden + Normalisieren der Spec (IR), Casing-Helfer, Operationsnamen. |
| `codegen/gen-ts.mjs` | → `apps/web/lib/api/generated/{types,client,index}.ts` — Typen + typisierter Fetch-Client (`ApiClient`, `ApiError` nach RFC 7807). |
| `codegen/gen-swift.mjs` | → `generated/swift/RSMContracts.swift` — Codable-Structs/-Enums, explizite `CodingKeys` (Wire bleibt snake_case). |
| `codegen/gen-kotlin.mjs` | → `generated/kotlin/RsmContracts.kt` — `@Serializable` data classes/Enums mit `@SerialName` (braucht `kotlinx-serialization-json` in der App). |
| `codegen/check.mjs` | CI-Gate: Spec-Frische + Schema-Sanity + Diff generierte Dateien vs. Generator-Output. |

Jede generierte Datei beginnt mit `GENERIERT — NICHT VON HAND AENDERN`.

## Befehle (in `packages/contracts`)

```bash
npm run openapi    # Spec neu aus services/api erzeugen (delegiert dorthin)
npm run generate   # alle drei Generatoren laufen lassen (TS, Swift, Kotlin)
npm run check      # das CI-Gate lokal ausführen
```

Der Workflow bei API-Änderungen ist immer derselbe:

1. Route/Schema in `services/api` ändern (Zod ist die Quelle).
2. `npm run openapi` → `openapi.json` aktualisiert sich.
3. `npm run generate` → alle Clients ziehen nach.
4. Alles zusammen committen. `check.mjs` in CI failt bei jedem vergessenen Schritt.

## Was `check.mjs` genau prüft

1. **Spec-Frische:** `npm run openapi` erzeugt exakt die eingecheckte
   `openapi.json` (übersprungen, wenn `services/api/node_modules` fehlt;
   in CI per `--require-spec-regen` erzwungen).
2. **Schema-Sanity:** jede Operation hat ein 2xx-JSON-Response-Schema, jede
   Mutation einen `requestBody` (dokumentierte Ausnahme: `POST
   /invoices/{invoiceId}/send-reminder`), alle `$ref`s lösen auf, alle
   Parameter haben Schemas, jede nicht-öffentliche Route trägt `bearerAuth`
   (öffentlich nur `GET /health`).
3. **Codegen-Drift:** die fünf generierten Dateien entsprechen byte-genau dem,
   was die Generatoren aus der aktuellen Spec erzeugen.

## Übersetzungsregeln (verbindlich)

- **Wire-Format bleibt snake_case** (ADR-E7). TS behält die snake_case-Keys
  1:1; Swift/Kotlin bekommen camelCase-Properties über explizite
  `CodingKeys`/`@SerialName` — nie über Decoder-Strategien.
- **Enums** werden echte Typen (TS-Union + `…Values`-Konstante, Swift/Kotlin
  `enum`); Inline-Enums (z. B. `Entitlement.subject_type`) werden für
  Swift/Kotlin zu eigenen Typen gehoben (`EntitlementSubjectType`).
- **Nullability:** `nullable`-Felder → `T | null` / `T?`; nicht-required
  Felder → optional. Beides zusammen bleibt optional.
- **Zahlen:** `integer` → Swift `Int` / Kotlin `Long` (Cents/Millisekunden
  dürfen nie überlaufen), `number` → `Double`.
- **Timestamps/UUIDs bleiben Strings** im Contract — Konvertierung passiert
  am Rand der App, nie im generierten Typ.
- Freiform-JSON (`settings`) → TS `Record<string, unknown>`, Swift
  `[String: JSONValue]` (Helfer wird mitgeneriert), Kotlin `JsonObject`.

## Konsumenten

- **Web:** `apps/web/lib/api/generated/` liegt bereit, ist aber noch NICHT
  verdrahtet — das Portal läuft bewusst weiter auf Mocks, bis die
  Portal-Phase beginnt.
- **iOS:** `generated/swift/RSMContracts.swift` ins Xcode-Target ziehen.
  ⚠️ **Nicht dependency-frei** (der Satz stand hier und ist nachweislich falsch):
  das Generat allein kompiliert **nicht**. `swiftc -typecheck` auf die Datei
  liefert `cannot find type 'Weekday' in scope` — die Spec enthält mit `Weekday`
  einen **benannten Skalar** (`{"type":"integer"}`), und `gen-swift.mjs:198-210`
  emittiert nur string-Enums und Objekte; benannte Skalare fallen **stumm** raus.
  Der Build lebt nur wegen `apps/ios/App/Networking/ContractCodegenShim.swift`
  (`public typealias Weekday = Int`). Prüfen daher immer MIT Shim:
  ```bash
  swiftc -typecheck generated/swift/RSMContracts.swift \
                    ../../apps/ios/App/Networking/ContractCodegenShim.swift
  ```
  Wird der Generator repariert, muss der Shim im **selben Commit** weg (sonst
  `invalid redeclaration`).
- **Android:** `generated/kotlin/RsmContracts.kt` ins Modul kopieren;
  benötigt das kotlinx-serialization-Gradle-Plugin + `kotlinx-serialization-json`.
  ⚠️ **Der Android-Build ist aktuell kaputt** (dieselbe `Weekday`-Ursache):
  `RsmContracts.kt:1433/1447/1459` referenziert `Weekday`, einen Kotlin-Typ
  dieses Namens gibt es auf dem Compile-Pfad nirgends — und anders als iOS hat
  Android keinen Shim. „Contracts sind grün" ist für Android **nicht**
  behauptbar, solange das offen ist. Eigener Fix, eigener Commit (nicht in einen
  RBAC-Commit mischen).

## ⚠️ Was `check.mjs` NICHT sehen kann — und die Namensregel, die daraus folgt

`check.mjs` vergleicht **Bytes**: es kompiliert nichts. Beleg: `[contracts-check]
all green`, während `swiftc -typecheck` auf das Generat allein fehlschlägt.
Hinter der Namenswahl gibt es also **kein Netz** — genau so kam `Theme`
unbemerkt über mehrere Commits durch.

Zwei harte Regeln:

1. **Kein Schema-Name darf gleich `<AnderesSchema><PropInPascalCase>` sein.**
   `hoistedTypes` (`codegen/lib/spec.mjs:167-189`) hebt jede **inline** definierte
   Enum-/Objekt-Property als `<Schema><Prop>` heraus. Ein Schema `Capability` mit
   inline-Property `level` erzeugt also ein zweites `CapabilityLevel` → Swift und
   Kotlin deklarieren doppelt, `check.mjs` bleibt **grün**. Ein per `.openapi('X')`
   benanntes Zod-Schema wird zum `$ref` und hoistet nie — das ist der Ausweg.
2. **Keine benannten Skalare.** Siehe `Weekday` oben. Ein `rank` gehört inline als
   `z.number().int()`, niemals `.openapi('CapRank')`.

Kollisionen entstehen auch gegen **Handschrift**: `apps/ios/project.yml:26-30`
zieht `App/` und `generated/swift` in **dasselbe Target** — es gibt keinen
Namensraum. Ein Schema `Permissions` kollidiert hart mit
`apps/ios/App/Auth/Permissions.swift:35`. `Role` kollidiert weich mit
`androidx.compose.ui.semantics.Role` (in 5 Kotlin-Dateien importiert).
Vor jedem neuen Schema-Namen also gegen Spec, iOS und Kotlin gegenprüfen.

## CI

`.github/workflows/ci.yml` fährt `tokens-build`, `web-build`, `api-test` und
`contracts-check` als Pflicht-Jobs; `db-test` (Docker-Smoke gegen eine
Wegwerf-Postgres) läuft optional (`continue-on-error`).
