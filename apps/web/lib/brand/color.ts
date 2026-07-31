/**
 * Farb-Mathematik für die einstellbare Markenfarbe — reines Vanilla-TS,
 * KEINE Fremd-Bibliothek. Alles, was die AA-abgesicherte Ableitung
 * (derive.ts) und die Kontrast-Ampel (UI) brauchen.
 *
 * WCAG-2.1-Kontrast:
 *   lin(c) = c/12.92                      wenn c ≤ 0.03928
 *          = ((c + 0.055) / 1.055) ^ 2.4  sonst
 *   L      = 0.2126·R + 0.7152·G + 0.0722·B  (relative Luminanz)
 *   Ratio  = (max(L₁,L₂) + 0.05) / (min(L₁,L₂) + 0.05)
 */

export type RGB = { r: number; g: number; b: number }; // je 0..255
export type HSL = { h: number; s: number; l: number }; // h 0..360, s/l 0..100

/** #RRGGBB (Groß/klein egal). Bewusst identisch zur Sparten-Regel (0062). */
export const HEX_RE = /^#[0-9A-Fa-f]{6}$/;

export function isHex(value: string | null | undefined): value is string {
  return typeof value === "string" && HEX_RE.test(value);
}

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

export function hexToRgb(hex: string): RGB {
  const h = hex.replace("#", "");
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

export function rgbToHex({ r, g, b }: RGB): string {
  const to = (n: number) => clamp(Math.round(n), 0, 255).toString(16).padStart(2, "0");
  return `#${to(r)}${to(g)}${to(b)}`.toUpperCase();
}

export function rgbToHsl({ r, g, b }: RGB): HSL {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === rn) h = ((gn - bn) / d) % 6;
    else if (max === gn) h = (bn - rn) / d + 2;
    else h = (rn - gn) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  const l = (max + min) / 2;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  return { h, s: s * 100, l: l * 100 };
}

export function hslToRgb({ h, s, l }: HSL): RGB {
  const sn = clamp(s, 0, 100) / 100;
  const ln = clamp(l, 0, 100) / 100;
  const c = (1 - Math.abs(2 * ln - 1)) * sn;
  const hp = (((h % 360) + 360) % 360) / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let r = 0;
  let g = 0;
  let b = 0;
  if (hp < 1) [r, g, b] = [c, x, 0];
  else if (hp < 2) [r, g, b] = [x, c, 0];
  else if (hp < 3) [r, g, b] = [0, c, x];
  else if (hp < 4) [r, g, b] = [0, x, c];
  else if (hp < 5) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const m = ln - c / 2;
  return { r: (r + m) * 255, g: (g + m) * 255, b: (b + m) * 255 };
}

/** HSL → #RRGGBB (mit Clamping von s/l auf 0..100). */
export function hslHex(h: number, s: number, l: number): string {
  return rgbToHex(hslToRgb({ h, s, l }));
}

function relLuminance({ r, g, b }: RGB): number {
  const lin = (c8: number) => {
    const c = c8 / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** WCAG-Kontrastverhältnis zweier RGB-Farben (1..21). */
export function contrast(a: RGB, b: RGB): number {
  const la = relLuminance(a);
  const lb = relLuminance(b);
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/** Kontrastverhältnis zweier Hex-Farben. */
export function contrastHex(a: string, b: string): number {
  return contrast(hexToRgb(a), hexToRgb(b));
}
