# packages/tokens

Token-Pipeline für das Design-System „Heimspiel".

- Quelle der Wahrheit: `design/tokens.json`
- `build.mjs` generiert daraus `apps/web/app/tokens.css` (CSS-Custom-Properties, Variablennamen identisch zum Referenz-Mockup: `--bg-canvas`, `--ink`, `--brand`, …)
- `gen-swift.mjs` generiert daraus `apps/ios/App/Generated/Theme.swift` (enum `Theme`: dynamische Light/Dark-Farben via UIColor-Trait-Initializer, Spacing/Radius/Size-Konstanten, Font-Helper Display=SF Rounded / Body=System / Mono=SF Mono, Schatten, Motion)
- Aufruf: `npm run build` bzw. `npm run gen:swift` (hier) oder `npm run tokens` in `apps/web`

Später kommt hier das Kotlin-Ziel dazu (siehe DESIGN-SYSTEM.md Abschnitt 5).

Regel: `tokens.css` und `Theme.swift` nie von Hand editieren — Änderungen immer in `design/tokens.json`, dann neu bauen.
