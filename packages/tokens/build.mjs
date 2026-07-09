#!/usr/bin/env node
/**
 * Token-Pipeline „Heimspiel“
 *
 * Liest design/tokens.json (Quelle der Wahrheit) und generiert
 * apps/web/app/tokens.css mit CSS-Custom-Properties:
 *   :root                      → Light-Werte
 *   html[data-theme="dark"]    → Dark-Werte
 *   @media (prefers-color-scheme: dark) für html[data-theme="auto"]
 *
 * Die Variablennamen entsprechen exakt dem Referenz-Mockup
 * (design/final/mockup-final.html): --bg-canvas, --ink, --brand, …
 *
 * Aufruf:  node packages/tokens/build.mjs   (oder: npm run tokens in apps/web)
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const tokens = JSON.parse(readFileSync(join(root, "design", "tokens.json"), "utf8"));
const outFile = join(root, "apps", "web", "app", "tokens.css");

const val = (t) => (t && typeof t === "object" && "value" in t ? t.value : t);
const px = (n) => (typeof n === "number" ? `${n}px` : n);

/** Farb-Gruppe (light|dark) → Map CSS-Variable → Wert (Mockup-Namensschema) */
function colorVars(mode) {
  const c = tokens.color[mode];
  const m = new Map();
  m.set("--bg-canvas", val(c.bg.canvas));
  m.set("--bg-surface", val(c.bg.surface));
  m.set("--bg-sunken", val(c.bg.sunken));
  m.set("--ink", val(c.ink.primary));
  m.set("--ink-soft", val(c.ink.soft));
  m.set("--ink-faint", val(c.ink.faint));
  m.set("--line", val(c.line.default));
  m.set("--line-strong", val(c.line.strong));
  for (const g of ["brand", "honey", "info", "success", "warn", "danger"]) {
    for (const [k, v] of Object.entries(c[g])) {
      m.set(k === "default" ? `--${g}` : `--${g}-${k}`, val(v));
    }
  }
  for (const [k, v] of Object.entries(c.avatar)) {
    if (k === "onDefault") m.set("--on-avatar", val(v));
    else if (k === "onAvatarDark") m.set("--on-avatar-dark", val(v));
    else m.set(`--av-${k}`, val(v));
  }
  m.set("--wave-off", val(c.wave.off));
  m.set("--focus", val(c.focus));
  m.set("--shadow-card", val(tokens.shadow.card[mode]));
  m.set("--shadow-pop", val(tokens.shadow.pop[mode]));
  return m;
}

/** Nicht-thematische Tokens (Radius, Spacing, Größen, Motion, Fonts, Typo-Skala) */
function staticVars() {
  const m = new Map();

  // Fonts: next/font stellt --font-bricolage/--font-jakarta/--font-jetbrains
  // am <html> bereit; der Web-Stack aus tokens.json bleibt Fallback.
  const nextFontVar = { display: "--font-bricolage", body: "--font-jakarta", mono: "--font-jetbrains" };
  for (const [role, def] of Object.entries(tokens.font.family)) {
    const stack = def.web.split(",").map((s) => s.trim());
    m.set(`--font-${role}`, `var(${nextFontVar[role]}, ${stack[0]}), ${stack.slice(1).join(", ")}`);
  }

  // Typo-Skala
  for (const [name, def] of Object.entries(tokens.font.size)) {
    const kebab = name.replace(/[A-Z]/g, (ch) => `-${ch.toLowerCase()}`);
    m.set(`--fs-${kebab}`, px(def.value));
    m.set(`--lh-${kebab}`, px(def.lineHeight));
    m.set(`--fw-${kebab}`, String(def.weight));
    if (def.letterSpacing) m.set(`--ls-${kebab}`, def.letterSpacing.replace(/^\+/, ""));
  }

  // Spacing (nur numerische Stufen 1–10)
  for (const [k, v] of Object.entries(tokens.space)) {
    if (/^\d+$/.test(k)) m.set(`--space-${k}`, px(val(v)));
  }
  m.set("--space-card-gap", px(val(tokens.space.cardGap)));

  // Radius
  for (const [k, v] of Object.entries(tokens.radius)) m.set(`--radius-${k}`, px(val(v)));

  // Größen
  m.set("--size-touch-target", px(val(tokens.size.touchTarget)));
  m.set("--size-list-row", px(val(tokens.size.listRow)));
  m.set("--size-play-button", px(val(tokens.size.playButton)));

  // Motion
  m.set("--motion-fast", val(tokens.motion.fast));
  m.set("--motion-standard", val(tokens.motion.standard));
  m.set("--ease-rsm", "cubic-bezier(0.2, 0.8, 0.3, 1)");
  return m;
}

const block = (vars, indent = "  ") =>
  [...vars.entries()].map(([k, v]) => `${indent}${k}: ${v};`).join("\n");

const light = colorVars("light");
const dark = colorVars("dark");

const css = `/* ============================================================
   GENERIERT aus design/tokens.json — NICHT von Hand editieren.
   Neu bauen:  npm run tokens  (in apps/web)
   Design-System „Heimspiel“ · ${tokens.meta.version} · Stand ${tokens.meta.stand}
   ============================================================ */

/* ---------- Light („Vormittag in der Halle“) + statische Tokens ---------- */
:root {
  color-scheme: light;
${block(light)}

${block(staticVars())}
}

/* ---------- Dark („Vereinsheim am Abend“) — explizit gewählt ---------- */
html[data-theme="dark"] {
  color-scheme: dark;
${block(dark)}
}

/* ---------- Dark via System, wenn Theme „Auto“ (oder ungesetzt) ---------- */
@media (prefers-color-scheme: dark) {
  html[data-theme="auto"],
  html:not([data-theme]) {
    color-scheme: dark;
${block(dark, "    ")}
  }
}
`;

mkdirSync(dirname(outFile), { recursive: true });
writeFileSync(outFile, css);
console.log(`tokens.css geschrieben: ${outFile} (${css.length} Bytes, ${light.size} Farb-Tokens je Theme)`);
