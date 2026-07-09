# packages/tokens

Token-Pipeline für das Design-System „Heimspiel".

- Quelle der Wahrheit: `design/tokens.json`
- `build.mjs` generiert daraus `apps/web/app/tokens.css` (CSS-Custom-Properties, Variablennamen identisch zum Referenz-Mockup: `--bg-canvas`, `--ink`, `--brand`, …)
- Aufruf: `node packages/tokens/build.mjs` oder `npm run tokens` in `apps/web`

Später kommen hier die Swift-/Kotlin-Ziele dazu (Style-Dictionary-Build in alle drei Plattformen, siehe DESIGN-SYSTEM.md Abschnitt 5).

Regel: `tokens.css` nie von Hand editieren — Änderungen immer in `design/tokens.json`, dann neu bauen.
