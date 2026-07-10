#!/usr/bin/env node
/**
 * Token-Pipeline „Heimspiel“ — Kotlin/Compose-Ziel (Android)
 *
 * Liest design/tokens.json (Quelle der Wahrheit) und generiert
 * apps/android/app/src/main/java/de/rollsportmanager/v2/ui/theme/Theme.kt:
 *   - class RsmColors + RsmColorsLight/RsmColorsDark (Compose-Color-Objekte)
 *   - object RsmSpacing / RsmRadius / RsmSize → Dp-Konstanten (dp = px, 1:1)
 *   - object RsmTypography → TextStyles (Display = Default-FontFamily/Roboto
 *     extrabold mit gerundeter Anmutung, Mono = FontFamily.Monospace für
 *     Beträge/Kürzeiten, tabular-nums via fontFeatureSettings "tnum")
 *   - Material3-ColorScheme-Mapping (primary=brand, background/surface aus
 *     den bg-Tokens, error=danger, Material You AUS)
 *   - RsmTheme-Composable (isSystemInDarkTheme) + object RsmTheme.colors
 *   - object RsmMotion → Dauern in ms + pressScale
 *
 * Namensschema wie das Swift-Ziel (gen-swift.mjs), camelCase:
 *   bg.canvas → bgCanvas · brand.default → brand · avatar.plum → avatarPlum
 *
 * Aufruf:  npm run gen:kotlin-theme   (in packages/tokens)
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const tokens = JSON.parse(readFileSync(join(root, "design", "tokens.json"), "utf8"));
const outFile = join(
  root,
  "apps", "android", "app", "src", "main", "java",
  "de", "rollsportmanager", "v2", "ui", "theme", "Theme.kt",
);

const val = (t) => (t && typeof t === "object" && "value" in t ? t.value : t);

// ---------------------------------------------------------------------------
// Farben
// ---------------------------------------------------------------------------

/** '#B23A5C' | 'rgba(26,13,8,0.92)' → 'Color(0xFFB23A5C)' (ARGB). */
function composeColor(cssValue) {
  let r, g, b, a;
  const hex = /^#([0-9a-f]{6})$/i.exec(cssValue.trim());
  const rgba = /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/i.exec(
    cssValue.trim(),
  );
  if (hex) {
    const n = parseInt(hex[1], 16);
    [r, g, b, a] = [(n >> 16) & 255, (n >> 8) & 255, n & 255, 255];
  } else if (rgba) {
    [r, g, b] = [Number(rgba[1]), Number(rgba[2]), Number(rgba[3])];
    a = Math.round((rgba[4] === undefined ? 1 : Number(rgba[4])) * 255);
  } else {
    throw new Error(`Nicht unterstützter Farbwert: ${cssValue}`);
  }
  const hex2 = (n) => n.toString(16).toUpperCase().padStart(2, "0");
  return `Color(0x${hex2(a)}${hex2(r)}${hex2(g)}${hex2(b)})`;
}

/** Token-Pfad → Kotlin-Name: bg.canvas → bgCanvas · brand.default → brand. */
function kotlinName(path) {
  const parts = path.filter((p) => p !== "default");
  return parts.map((p, i) => (i === 0 ? p : p[0].toUpperCase() + p.slice(1))).join("");
}

function flattenColors(node, path = []) {
  if (node && typeof node === "object" && "value" in node) {
    return [{ path, value: node.value, comment: node.comment }];
  }
  return Object.entries(node).flatMap(([k, v]) => flattenColors(v, [...path, k]));
}

const lightEntries = flattenColors(tokens.color.light);
const darkMap = new Map(flattenColors(tokens.color.dark).map((e) => [e.path.join("."), e.value]));
for (const { path } of lightEntries) {
  if (!darkMap.has(path.join("."))) {
    throw new Error(`Dark-Wert fehlt für color.${path.join(".")} — tokens.json prüfen`);
  }
}

function colorClassProps() {
  return lightEntries
    .map(({ path, comment }) => {
      const doc = comment ? `    /** ${comment} */\n` : "";
      return `${doc}    val ${kotlinName(path)}: Color,`;
    })
    .join("\n");
}

function colorInstance(name, source) {
  const values = new Map(flattenColors(source).map((e) => [e.path.join("."), e.value]));
  const args = lightEntries
    .map(({ path }) => `    ${kotlinName(path)} = ${composeColor(values.get(path.join(".")))},`)
    .join("\n");
  return `val ${name} = RsmColors(\n${args}\n)`;
}

// ---------------------------------------------------------------------------
// Skalare (Spacing / Radius / Size) → Dp
// ---------------------------------------------------------------------------

function dpLines(group, { numericPrefix = "" } = {}) {
  const lines = [];
  for (const [k, v] of Object.entries(group)) {
    const value = val(v);
    if (typeof value !== "number") continue; // z. B. space.cardPadding "20–24"
    const name = /^\d/.test(k) ? `${numericPrefix}${k}` : k;
    const comment = v && typeof v === "object" && v.comment ? ` // ${v.comment}` : "";
    lines.push(`    val ${name} = ${value}.dp${comment}`);
  }
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Typografie
// ---------------------------------------------------------------------------

const WEIGHTS = {
  400: "FontWeight.Normal",
  500: "FontWeight.Medium",
  600: "FontWeight.SemiBold",
  700: "FontWeight.Bold",
  800: "FontWeight.ExtraBold",
};
// Display-Rollen: Default-FontFamily (Roboto) extrabold — gerundete Anmutung;
// monoTable: FontFamily.Monospace für Beträge/Rechnungsnummern.
const FONT_FAMILY = {
  display: "FontFamily.Default",
  h2: "FontFamily.Default",
  h3: "FontFamily.Default",
  monoTable: "FontFamily.Monospace",
};

function textStyles() {
  const lines = [];
  for (const [name, def] of Object.entries(tokens.font.size)) {
    const weight = WEIGHTS[def.weight];
    if (!weight) throw new Error(`Unbekanntes Gewicht ${def.weight} für font.size.${name}`);
    const family = FONT_FAMILY[name] ?? "FontFamily.Default";
    const meta = [`${def.value}/${def.lineHeight}`, `Gewicht ${def.weight}`];
    if (def.transform === "uppercase") meta.push("VERSALIEN (im Composable per uppercase())");
    lines.push(`    /** ${meta.join(" · ")}${def.comment ? ` — ${def.comment}` : ""} */`);
    lines.push(`    val ${name} = TextStyle(`);
    lines.push(`        fontFamily = ${family},`);
    lines.push(`        fontSize = ${def.value}.sp,`);
    lines.push(`        lineHeight = ${def.lineHeight}.sp,`);
    lines.push(`        fontWeight = ${weight},`);
    if (def.letterSpacing) {
      const em = Number(def.letterSpacing.replace(/em$/, "").replace(/^\+/, ""));
      lines.push(`        letterSpacing = ${em}.em,`);
    }
    if (name === "monoTable") {
      lines.push(`        fontFeatureSettings = TABULAR_NUMS,`);
    }
    lines.push(`    )`);
  }
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Motion
// ---------------------------------------------------------------------------

function motionMs(css) {
  const m = /(\d+)\s*ms/.exec(css);
  if (!m) throw new Error(`Motion-Dauer nicht parsebar: ${css}`);
  return Number(m[1]);
}

// ---------------------------------------------------------------------------
// Datei zusammensetzen
// ---------------------------------------------------------------------------

const kt = `// ============================================================
// GENERIERT aus design/tokens.json — NICHT von Hand editieren.
// Neu bauen:  npm run gen:kotlin-theme   (in packages/tokens)
// Design-System „Heimspiel“ · ${tokens.meta.version} · Stand ${tokens.meta.stand}
// ============================================================
@file:Suppress("MagicNumber", "unused")

package de.rollsportmanager.v2.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.ColorScheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Typography
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.ReadOnlyComposable
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.em
import androidx.compose.ui.unit.sp

/**
 * Alle Farb-Tokens einer Erscheinung (Light „Vormittag in der Halle“ /
 * Dark „Vereinsheim am Abend“). Zwei statische Instanzen, Material You AUS.
 */
@Immutable
class RsmColors(
${colorClassProps()}
)

${colorInstance("RsmColorsLight", tokens.color.light)}

${colorInstance("RsmColorsDark", tokens.color.dark)}

/** Spacing (4-dp-Basis, dp = px 1:1). */
object RsmSpacing {
${dpLines(tokens.space, { numericPrefix: "s" })}
}

/** Radius. */
object RsmRadius {
${dpLines(tokens.radius)}
}

/** Größen. */
object RsmSize {
${dpLines(tokens.size)}
}

/** OpenType-Feature für Tabellenziffern — Pflicht für Beträge/Quoten/Zeiten. */
const val TABULAR_NUMS = "tnum"

/**
 * Typografie „Heimspiel“:
 *  - Display/h2/h3 = Default-FontFamily (Roboto) extrabold — nur Begrüßung,
 *    Karten-/Kür-Titel, große Kennzahlen; nie Fließtext.
 *  - body/bodyStrong/caption/eyebrow = Default-FontFamily.
 *  - monoTable = FontFamily.Monospace — ALLE Geldbeträge, Rechnungsnummern,
 *    Kürzeiten (Seriositätszone), tabular-nums eingebaut.
 */
object RsmTypography {
${textStyles()}
}

/** Motion-Tokens (ms). prefers-reduced-motion respektieren! */
object RsmMotion {
    const val fastMs = ${motionMs(val(tokens.motion.fast))}
    const val standardMs = ${motionMs(val(tokens.motion.standard))}
    /** Button-Druck: scale(0.98) */
    const val pressScale = 0.98f
}

/**
 * Material3-Mapping: primary=brand, background/surface aus den bg-Tokens,
 * error=danger. surfaceTint transparent → keine M3-Elevation-Tönung
 * (der Heimspiel-Look nutzt Hairlines + warme Schatten statt Tonal-Tint).
 */
private fun rsmColorScheme(c: RsmColors, dark: Boolean): ColorScheme {
    val base = if (dark) darkColorScheme() else lightColorScheme()
    return base.copy(
        primary = c.brand,
        onPrimary = c.brandContrast,
        primaryContainer = c.brandSoft,
        onPrimaryContainer = c.brandInk,
        secondary = c.info,
        onSecondary = if (dark) c.bgSunken else c.bgSurface,
        secondaryContainer = c.infoSoft,
        onSecondaryContainer = c.info,
        tertiary = c.honeyDeep,
        onTertiary = if (dark) c.bgSunken else c.bgSurface,
        tertiaryContainer = c.honeySoft,
        onTertiaryContainer = c.honeyDeep,
        background = c.bgCanvas,
        onBackground = c.inkPrimary,
        surface = c.bgSurface,
        onSurface = c.inkPrimary,
        surfaceVariant = c.bgSunken,
        onSurfaceVariant = c.inkSoft,
        surfaceContainerLowest = c.bgSurface,
        surfaceContainerLow = c.bgSurface,
        surfaceContainer = c.bgSurface,
        surfaceContainerHigh = c.bgSurface,
        surfaceContainerHighest = c.bgSunken,
        surfaceTint = Color.Transparent,
        error = c.danger,
        onError = if (dark) c.bgSunken else c.bgSurface,
        errorContainer = c.dangerSoft,
        onErrorContainer = c.danger,
        outline = c.lineStrong,
        outlineVariant = c.line,
    )
}

/** Material-Rollen aus den Heimspiel-TextStyles (für M3-Komponenten-Defaults). */
private val rsmMaterialTypography = Typography(
    headlineMedium = RsmTypography.display,
    titleLarge = RsmTypography.h2,
    titleMedium = RsmTypography.h3,
    bodyLarge = RsmTypography.body,
    bodyMedium = RsmTypography.body,
    bodySmall = RsmTypography.caption,
    labelLarge = RsmTypography.bodyStrong,
    labelMedium = RsmTypography.caption,
    labelSmall = RsmTypography.eyebrow,
)

val LocalRsmColors = staticCompositionLocalOf { RsmColorsLight }

/**
 * Heimspiel-Theme: stellt MaterialTheme (M3-Mapping) UND die rohen Tokens
 * (RsmTheme.colors) bereit. Dark Mode folgt dem System.
 */
@Composable
fun RsmTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit,
) {
    val colors = if (darkTheme) RsmColorsDark else RsmColorsLight
    CompositionLocalProvider(LocalRsmColors provides colors) {
        MaterialTheme(
            colorScheme = rsmColorScheme(colors, darkTheme),
            typography = rsmMaterialTypography,
            content = content,
        )
    }
}

/** Token-Zugriff im Composable-Baum: \`RsmTheme.colors.bgCanvas\`. */
object RsmTheme {
    val colors: RsmColors
        @Composable @ReadOnlyComposable get() = LocalRsmColors.current
}
`;

mkdirSync(dirname(outFile), { recursive: true });
writeFileSync(outFile, kt);
console.log(
  `Theme.kt geschrieben: ${outFile} (${kt.length} Bytes, ${lightEntries.length} Farb-Tokens je Theme)`,
);
