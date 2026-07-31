/**
 * AA-abgesicherte Ableitung einer freien Nutzerfarbe zu einem vollständigen
 * Fünferpaket (Hell + Dunkel). Kein Farb-Lib — HSL + hartes WCAG-Gate.
 *
 * Kern-Idee (aus der Design-Spec): Aus dem Seed C (= Light-Brand) werden alle
 * abgeleiteten Token schrittweise in Richtung „genug Kontrast" verschoben.
 * Scheitert ein Pflicht-Textpaar nach N Schritten, wird die Farbe ABGELEHNT
 * (Rückgabe null) — so kann KEINE Nutzerfarbe Text unlesbar machen. Der Dark
 * Mode dreht die Signatur um: --brand hell, --brand-contrast DUNKEL.
 *
 * Caveat: HSL-Lightness ist nicht perzeptuell; das Gate kompensiert das. Später
 * 1:1 auf OKLCH hebbar, ohne die Aufrufer zu ändern.
 */

import { contrastHex, hslHex, isHex, rgbToHsl, hexToRgb } from "./color";
import { findPreset, type BrandTheme, type BrandTokenSet } from "./presets";

const AA = 4.5;

/* Anker (exakt aus tokens.css). */
const WHITE = "#FFFFFF";
const LIGHT_CANVAS = "#FBF4EC"; // bgCanvas hell — Grund für text-brand-Links/Eyebrows
const DARK_SURFACE = "#2C211A";
const DARK_CANVAS = "#241A14";

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/** LIGHT: Seed C = Brand. Weiß-Kontrast erzwingen, Ink gegen Soft UND Weiß. */
function deriveLight(h: number, s: number, seedL: number): BrandTokenSet | null {
  // --brand-soft hängt nur an h,s (nicht an der Brand-Lightness) → zuerst,
  // damit die Brand-Ableitung dagegen prüfen kann.
  const brandSoft = hslHex(h, clamp(s * 0.5, 22, 55), 93);

  // (1) --brand muss DREIFACH lesbar sein: (a) Weiß darauf (Button-Füllung),
  //     (b) --brand SELBST als Text auf dem hellen Canvas, (c) --brand als Text
  //     auf --brand-soft (text-brand-Links/Eyebrows + bg-brand-soft-Avatare).
  //     Solange eines < AA → Lightness senken; sonst ablehnen. So kann KEINE
  //     freie Farbe Links/Beschriftungen im Hellmodus unlesbar machen.
  let bl = seedL;
  let brand = hslHex(h, s, bl);
  const brandOk = (c: string): boolean =>
    contrastHex(WHITE, c) >= AA &&
    contrastHex(c, LIGHT_CANVAS) >= AA &&
    contrastHex(c, brandSoft) >= AA;
  for (let i = 0; i < 24 && !brandOk(brand); i++) {
    bl = Math.max(12, bl - 3);
    brand = hslHex(h, s, bl);
  }
  if (!brandOk(brand)) return null;

  // (2) --brand-strong
  const brandStrong = hslHex(h, Math.min(100, s + 4), Math.max(20, bl - 8));

  // (4) --brand-ink: dunkel genug für Soft UND Weiß.
  let il = bl;
  let ink = hslHex(h, s, il);
  for (let i = 0; i < 40 && (contrastHex(ink, brandSoft) < AA || contrastHex(ink, WHITE) < AA); i++) {
    il = Math.max(0, il - 2);
    ink = hslHex(h, s, il);
  }
  if (contrastHex(ink, brandSoft) < AA || contrastHex(ink, WHITE) < AA) return null;

  // (5) --brand-contrast: Weiß, außer eine dunkle Tinte hat höheres Ratio auf Brand.
  const darkInk = hslHex(h, Math.min(s, 60), 13);
  const brandContrast = contrastHex(WHITE, brand) >= contrastHex(darkInk, brand) ? WHITE : darkInk;

  return { brand, brandStrong, brandSoft, brandInk: ink, brandContrast };
}

/** DARK: Brand HELL, Contrast DUNKEL (Signatur). */
function deriveDark(h: number, s: number): BrandTokenSet | null {
  const ds = clamp(s, 48, 72);
  // (1) --brand: hell; solange Brand-auf-Dark-Surface < AA → Lightness heben (max 80).
  let dl = 64;
  let brand = hslHex(h, ds, dl);
  for (let i = 0; i < 10 && contrastHex(brand, DARK_SURFACE) < AA; i++) {
    dl = Math.min(80, dl + 3);
    brand = hslHex(h, ds, dl);
  }
  if (contrastHex(brand, DARK_SURFACE) < AA) return null;

  // (2) --brand-strong
  const brandStrong = hslHex(h, ds, Math.min(80, dl + 7));

  // (3) --brand-soft (dunkle Tönung)
  const brandSoft = hslHex(h, clamp(s * 0.7, 38, 60), 21);

  // (4) --brand-ink: hell; gegen Soft UND Dark-Canvas.
  const inkS = clamp(s, 45, 70);
  let il = 80;
  let ink = hslHex(h, inkS, il);
  for (let i = 0; i < 12 && (contrastHex(ink, brandSoft) < AA || contrastHex(ink, DARK_CANVAS) < AA); i++) {
    il = Math.min(95, il + 2);
    ink = hslHex(h, inkS, il);
  }
  if (contrastHex(ink, brandSoft) < AA || contrastHex(ink, DARK_CANVAS) < AA) return null;

  // (5) --brand-contrast: DUNKEL (nie Weiß); gegen Brand.
  const conS = clamp(s, 45, 70);
  let cl = 12;
  let contrast = hslHex(h, conS, cl);
  for (let i = 0; i < 12 && contrastHex(brand, contrast) < AA; i++) {
    cl = Math.max(0, cl - 2);
    contrast = hslHex(h, conS, cl);
  }
  if (contrastHex(brand, contrast) < AA) return null;

  return { brand, brandStrong, brandSoft, brandInk: ink, brandContrast: contrast };
}

/**
 * Freie Hex-Farbe → vollständiges Theme (Hell + Dunkel) oder null, wenn das
 * WCAG-Gate scheitert. Aufrufer behandeln null als „Farbe ablehnen".
 */
export function deriveBrandTheme(hex: string): BrandTheme | null {
  if (!isHex(hex)) return null;
  const { h, s, l } = rgbToHsl(hexToRgb(hex));
  const light = deriveLight(h, s, l);
  const dark = deriveDark(h, s);
  if (!light || !dark) return null;
  return { light, dark };
}

/**
 * Auflösung einer gespeicherten Auswahl → Theme:
 *   1. bekannter Preset-Schlüssel → hand-abgestimmtes Paket,
 *   2. sonst freier, ableitbarer Hex → berechnetes Paket,
 *   3. sonst null (Standard/kein Override).
 */
export function resolveBrandTheme(
  color: string | null | undefined,
  preset: string | null | undefined,
): BrandTheme | null {
  const p = findPreset(preset);
  if (p) return p.theme;
  if (isHex(color)) return deriveBrandTheme(color);
  return null;
}

/** Ampel für die UI: erreicht die freie Farbe den AA-Standard? */
export function isBrandReadable(hex: string): boolean {
  return deriveBrandTheme(hex) != null;
}
