#!/usr/bin/env node
/**
 * Token-Pipeline „Heimspiel“ — Swift-Ziel (iOS)
 *
 * Liest design/tokens.json (Quelle der Wahrheit) und generiert
 * apps/ios/App/Generated/Theme.swift:
 *   - enum Theme.Colors  → dynamische Light/Dark-Farben (UIColor-Trait-Initializer)
 *   - enum Theme.Spacing / Radius / Size → CGFloat-Konstanten (pt, 1:1 zu px)
 *   - enum Theme.Fonts   → Display = SF Rounded (design: .rounded, bold/heavy),
 *                          Body = System (SF Pro Text), Mono = SF Mono (.monospaced)
 *   - enum Theme.Shadows / Motion → Karten-Schatten + Animationsdauern
 *
 * Namensschema wie das Web-Ziel (build.mjs), nur camelCase:
 *   --bg-canvas → Theme.Colors.bgCanvas · --brand → .brand · --av-plum → .avatarPlum
 *
 * Aufruf:  npm run gen:swift   (in packages/tokens)  oder  node gen-swift.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const tokens = JSON.parse(readFileSync(join(root, "design", "tokens.json"), "utf8"));
const outFile = join(root, "apps", "ios", "App", "Generated", "Theme.swift");

const val = (t) => (t && typeof t === "object" && "value" in t ? t.value : t);

// ---------------------------------------------------------------------------
// Farben
// ---------------------------------------------------------------------------

/** '#B23A5C' | 'rgba(26,13,8,0.92)' → 'UIColor(red: …, green: …, blue: …, alpha: …)' */
function uiColor(cssValue) {
  let r, g, b, a;
  const hex = /^#([0-9a-f]{6})$/i.exec(cssValue.trim());
  const rgba = /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/i.exec(
    cssValue.trim(),
  );
  if (hex) {
    const n = parseInt(hex[1], 16);
    [r, g, b, a] = [(n >> 16) & 255, (n >> 8) & 255, n & 255, 1];
  } else if (rgba) {
    [r, g, b] = [Number(rgba[1]), Number(rgba[2]), Number(rgba[3])];
    a = rgba[4] === undefined ? 1 : Number(rgba[4]);
  } else {
    throw new Error(`Nicht unterstützter Farbwert: ${cssValue}`);
  }
  const f = (n) => (n / 255).toFixed(4).replace(/0+$/, "0");
  return `UIColor(red: ${f(r)}, green: ${f(g)}, blue: ${f(b)}, alpha: ${a})`;
}

/** Token-Pfad → Swift-Name: bg.canvas → bgCanvas · brand.default → brand · avatar.plum → avatarPlum */
function swiftName(path) {
  const parts = path.filter((p) => p !== "default");
  return parts
    .map((p, i) => (i === 0 ? p : p[0].toUpperCase() + p.slice(1)))
    .join("");
}

/** Farb-Baum flach machen: [{ path, value, comment }] — Reihenfolge = JSON-Reihenfolge. */
function flattenColors(node, path = []) {
  if (node && typeof node === "object" && "value" in node) {
    return [{ path, value: node.value, comment: node.comment }];
  }
  return Object.entries(node).flatMap(([k, v]) => flattenColors(v, [...path, k]));
}

function colorLines() {
  const light = flattenColors(tokens.color.light);
  const dark = new Map(flattenColors(tokens.color.dark).map((e) => [e.path.join("."), e.value]));
  const lines = [];
  for (const { path, value, comment } of light) {
    const key = path.join(".");
    const darkValue = dark.get(key);
    if (darkValue === undefined) {
      throw new Error(`Dark-Wert fehlt für color.${key} — tokens.json prüfen`);
    }
    const name = swiftName(path);
    if (comment) lines.push(`        /// ${comment}`);
    // Die FUENF Marken-Token (Pfad-Praefix "brand": brand, brandStrong,
    // brandSoft, brandInk, brandContrast) sind zur LAUFZEIT uebersteuerbar —
    // der Verein waehlt seine Akzentfarbe (0084). Sie werden deshalb `static
    // var`, die zuerst BrandRuntime befragen und sonst auf den generierten
    // Standard (`…Default`) zurueckfallen. So aendert sich KEINE Aufrufstelle
    // (`Theme.Colors.brand` bleibt gleich), und ohne Vereinsauswahl gilt exakt
    // die Design-Vorgabe. Alle uebrigen Farben bleiben feste `static let`.
    if (path[0] === "brand") {
      lines.push(
        `        private static let ${name}Default = rsmDynamic(${uiColor(value)}, ${uiColor(darkValue)})`,
      );
      lines.push(
        `        public static var ${name}: Color { BrandRuntime.shared.color(forToken: "${name}") ?? ${name}Default }`,
      );
    } else {
      lines.push(
        `        public static let ${name} = rsmDynamic(${uiColor(value)}, ${uiColor(darkValue)})`,
      );
    }
  }
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Skalare (Spacing / Radius / Size)
// ---------------------------------------------------------------------------

function cgFloatLines(group, { numericPrefix = "" } = {}) {
  const lines = [];
  for (const [k, v] of Object.entries(group)) {
    const value = val(v);
    if (typeof value !== "number") continue; // z. B. space.cardPadding "20–24" → bewusst übersprungen
    const name = /^\d/.test(k) ? `${numericPrefix}${k}` : k;
    const comment = v && typeof v === "object" && v.comment ? ` // ${v.comment}` : "";
    lines.push(`        public static let ${name}: CGFloat = ${value}${comment}`);
  }
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Typografie
// ---------------------------------------------------------------------------

const WEIGHTS = { 400: ".regular", 500: ".medium", 600: ".semibold", 700: ".bold", 800: ".heavy" };
// Display-Rollen laufen in SF Rounded, monoTable in SF Mono, Rest im System-Font.
const FONT_DESIGN = {
  display: "rounded",
  h2: "rounded",
  h3: "rounded",
  listTitle: "rounded",
  monoTable: "monospaced",
  monoCaption: "monospaced",
  monoHero: "monospaced",
};

function fontLines() {
  const lines = [];
  for (const [name, def] of Object.entries(tokens.font.size)) {
    const design = FONT_DESIGN[name] ?? "default";
    const weight = WEIGHTS[def.weight];
    if (!weight) throw new Error(`Unbekanntes Gewicht ${def.weight} für font.size.${name}`);
    if (!def.ios || !def.ios.textStyle) {
      throw new Error(
        `font.size.${name} hat keinen iOS-Anker (ios.textStyle) — ohne ihn skaliert die Rolle nicht mit Dynamic Type.`,
      );
    }
    const { textStyle, ptDefault } = def.ios;
    const meta = [`${ptDefault} pt bei Standardgröße (.${textStyle})`, `Gewicht ${def.weight}`];
    if (def.transform === "uppercase") meta.push("VERSALIEN (im View per .textCase(.uppercase))");
    lines.push(`        /// ${meta.join(" · ")}${def.comment ? ` — ${def.comment}` : ""}`);
    lines.push(
      `        public static let ${name} = Font.system(.${textStyle}, design: .${design}, weight: ${weight})`,
    );
    if (def.letterSpacing) {
      const em = Number(def.letterSpacing.replace(/em$/, "").replace(/^\+/, ""));
      const pt = (em * ptDefault).toFixed(2);
      lines.push(
        `        /// Laufweite für \`${name}\` in pt (${def.letterSpacing}) — per .tracking() anwenden.`,
      );
      lines.push(`        public static let ${name}Tracking: CGFloat = ${pt}`);
    }
  }
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Schatten & Motion
// ---------------------------------------------------------------------------

/** Nimmt die größte (letzte) Ebene eines CSS-Mehrfach-Schattens: '0 10px 30px rgba(…)'. */
function parseShadowLayer(css) {
  const layers = css.split(/,(?![^(]*\))/).map((s) => s.trim());
  const last = layers[layers.length - 1];
  const m = /^(-?[\d.]+)(?:px)?\s+(-?[\d.]+)(?:px)?\s+(-?[\d.]+)(?:px)?\s+(rgba?\([^)]*\))$/.exec(last);
  if (!m) throw new Error(`Schatten nicht parsebar: ${css}`);
  return { x: Number(m[1]), y: Number(m[2]), blur: Number(m[3]), color: m[4] };
}

function shadowLines() {
  const lines = [];
  for (const name of ["card", "pop"]) {
    const l = parseShadowLayer(val(tokens.shadow[name].light));
    const d = parseShadowLayer(val(tokens.shadow[name].dark));
    lines.push(`        /// Größte Ebene von shadow.${name} — radius ≈ CSS-Blur / 2.`);
    lines.push(`        public static let ${name} = RSMShadow(`);
    lines.push(`            color: rsmDynamic(${uiColor(l.color)}, ${uiColor(d.color)}),`);
    lines.push(`            radius: ${l.blur / 2}, x: ${l.x}, y: ${l.y}`);
    lines.push(`        )`);
  }
  return lines.join("\n");
}

function motionSeconds(css) {
  const m = /(\d+)\s*ms/.exec(css);
  if (!m) throw new Error(`Motion-Dauer nicht parsebar: ${css}`);
  return Number(m[1]) / 1000;
}

// ---------------------------------------------------------------------------
// Datei zusammensetzen
// ---------------------------------------------------------------------------

const swift = `// ============================================================
// GENERIERT aus design/tokens.json — NICHT von Hand editieren.
// Neu bauen:  npm run gen:swift   (in packages/tokens)
// Design-System „Heimspiel“ · ${tokens.meta.version} · Stand ${tokens.meta.stand}
// ============================================================

import SwiftUI
#if canImport(UIKit)
import UIKit
#else
import AppKit
// macOS kennt kein UIKit. Damit die generierten Farbliterale UNVERÄNDERT
// bleiben (und dieser Generator eine einzige Quelle behält), heißt der
// Plattform-Farbtyp hier ebenfalls UIColor — NSColor trägt denselben
// Initializer init(red:green:blue:alpha:) (sRGB).
typealias UIColor = NSColor
#endif

/// Dynamische Farbe über den Trait- bzw. Appearance-Initializer:
/// Light („Vormittag in der Halle“) / Dark („Vereinsheim am Abend“).
private func rsmDynamic(_ light: UIColor, _ dark: UIColor) -> Color {
#if canImport(UIKit)
    return Color(UIColor { traits in
        traits.userInterfaceStyle == .dark ? dark : light
    })
#else
    return Color(NSColor(name: nil) { appearance in
        appearance.bestMatch(from: [.aqua, .darkAqua]) == .darkAqua ? dark : light
    })
#endif
}

/// Schatten-Token (größte Ebene des CSS-Mehrfach-Schattens).
public struct RSMShadow {
    public let color: Color
    public let radius: CGFloat
    public let x: CGFloat
    public let y: CGFloat
}

public enum Theme {

    // MARK: - Farben (Light/Dark dynamisch)

    public enum Colors {
${colorLines()}
    }

    // MARK: - Spacing (4-pt-Basis, pt = px)

    public enum Spacing {
${cgFloatLines(tokens.space, { numericPrefix: "s" })}
    }

    // MARK: - Radius

    public enum Radius {
${cgFloatLines(tokens.radius)}
    }

    // MARK: - Größen

    public enum Size {
${cgFloatLines(tokens.size)}
    }

    // MARK: - Typografie
    //
    // Display = SF Rounded (design: .rounded) — nur Begrüßung, Karten-/Kür-Titel, KPI-Zahlen.
    // Body    = System (SF Pro Text) — alles andere.
    // Mono    = SF Mono (design: .monospaced) — Kürzeiten, ALLE Beträge + Rechnungsnummern.
    // Beträge/Zeiten immer zusätzlich .monospacedDigit() (tabular-nums).
    //
    // DYNAMIC TYPE — die wichtigste Regel dieser Datei:
    // Alle benannten Rollen hängen an einem TextStyle-Anker (Font.system(.body) usw.)
    // und wachsen deshalb mit den Systemeinstellungen mit. \`Font.system(size:)\` tut das
    // NICHT — es friert die Größe ein. Darum wird \`size:\` hier nur noch in den Helfern
    // benutzt, und deren Aufrufer müssen die Größe selbst über @ScaledMetric skalieren.

    public enum Fonts {
${fontLines()}

        // -- Helfer für Sonderfälle (Hero-Zahlen, Avatare) ------------------
        //
        // ACHTUNG: Diese drei Helfer liefern eine FESTE Größe — sie skalieren
        // nicht von allein mit Dynamic Type. Wer sie mit einem festen pt-Wert
        // aufruft, muss die Größe über @ScaledMetric hereinreichen:
        //
        //     @ScaledMetric(relativeTo: .largeTitle) private var heroSize: CGFloat = 44
        //     Text(zahl).font(Theme.Fonts.display(size: heroSize))
        //
        // Ohne @ScaledMetric bleibt der Text bei jeder Systemgröße gleich groß.
        // Das ist NUR dort richtig, wo die Größe aus einer Geometrie stammt
        // (z. B. Initialen in einem Avatar-Kreis fester Größe).

        /// Display-Helfer: SF Rounded, standardmäßig extrabold (Token-Gewicht 800).
        public static func display(size: CGFloat, weight: Font.Weight = .heavy) -> Font {
            Font.system(size: size, weight: weight, design: .rounded)
        }

        /// Body-Helfer: System-Font (SF Pro Text).
        public static func body(size: CGFloat, weight: Font.Weight = .regular) -> Font {
            Font.system(size: size, weight: weight, design: .default)
        }

        /// Mono-Helfer: SF Mono — Beträge, Rechnungsnummern, Kürzeiten.
        public static func mono(size: CGFloat, weight: Font.Weight = .semibold) -> Font {
            Font.system(size: size, weight: weight, design: .monospaced)
        }
    }

    // MARK: - Schatten

    public enum Shadows {
${shadowLines()}
    }

    // MARK: - Motion (Sekunden; prefers-reduced-motion respektieren!)

    public enum Motion {
        public static let fast: Double = ${motionSeconds(val(tokens.motion.fast))}
        public static let standard: Double = ${motionSeconds(val(tokens.motion.standard))}
        /// Button-Druck: scale(0.98)
        public static let pressScale: CGFloat = 0.98
    }
}
`;

mkdirSync(dirname(outFile), { recursive: true });
writeFileSync(outFile, swift);
const colorCount = flattenColors(tokens.color.light).length;
console.log(`Theme.swift geschrieben: ${outFile} (${swift.length} Bytes, ${colorCount} Farb-Tokens je Theme)`);
