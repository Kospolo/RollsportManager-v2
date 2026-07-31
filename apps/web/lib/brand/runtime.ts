/**
 * Laufzeit-Anwendung der Markenfarbe.
 *
 * WICHTIG (theme-korrekt): KEIN inline-style auf documentElement — das würde
 * Hell/Dunkel/Auto brechen. Stattdessen ein generiertes <style
 * id="rsm-brand-override"> im <head>, das exakt die drei tokens.css-Selektoren
 * spiegelt und per Quell-Reihenfolge (nach globals.css/tokens.css) gewinnt. So
 * bleiben data-theme="dark" und der System-Auto-Zweig unverändert wirksam.
 *
 * Persistenz-Spiegel: die Auswahl liegt zusätzlich in localStorage 'rsm.brand'
 * (JSON: {color, preset, css}). Ein Inline-Boot-Script (brandInitScript) setzt
 * das <style> vor dem ersten Paint → kein Flash. Im Mock-Modus ist dieser
 * Spiegel die dauerhafte Persistenz (der In-Memory-Store lebt nur pro Sitzung).
 */

import { resolveBrandTheme } from "./derive";
import type { BrandTheme, BrandTokenSet } from "./presets";

export const BRAND_STORAGE_KEY = "rsm.brand";
export const BRAND_STYLE_ID = "rsm-brand-override";

/** Gespeicherte Auswahl (Spiegel für UI-Hydration + No-Flash-Boot). */
export type BrandSelection = {
  /** Hex der Marke (Preset-Hex oder freie Farbe); null = Standard. */
  color: string | null;
  /** Preset-Schlüssel; null = freie Farbe oder Standard. */
  preset: string | null;
  /** Fertiges Override-CSS (das Boot-Script braucht nur dieses). */
  css: string;
};

function vars(t: BrandTokenSet): string {
  return (
    `--brand:${t.brand};` +
    `--brand-strong:${t.brandStrong};` +
    `--brand-soft:${t.brandSoft};` +
    `--brand-ink:${t.brandInk};` +
    `--brand-contrast:${t.brandContrast};` +
    `--focus:${t.brand}`
  );
}

/**
 * CSS-Text, der die drei tokens.css-Selektoren spiegelt (Light / explizit Dark
 * / System-Auto-Dark). null = kein Override (Standard-Beere aus tokens.css).
 */
export function renderBrandCss(theme: BrandTheme | null): string | null {
  if (!theme) return null;
  const light = vars(theme.light);
  const dark = vars(theme.dark);
  return (
    `:root{${light}}` +
    `html[data-theme="dark"]{${dark}}` +
    `@media (prefers-color-scheme:dark){html[data-theme="auto"],html:not([data-theme]){${dark}}}`
  );
}

/** Setzt/entfernt das <style>-Element im <head> (rein visuell, ohne Speichern). */
export function applyBrandCss(css: string | null): void {
  if (typeof document === "undefined") return;
  const existing = document.getElementById(BRAND_STYLE_ID) as HTMLStyleElement | null;
  if (css == null) {
    existing?.remove();
    return;
  }
  const el = existing ?? document.createElement("style");
  if (!existing) {
    el.id = BRAND_STYLE_ID;
    document.head.appendChild(el);
  }
  if (el.textContent !== css) el.textContent = css;
}

/** Schreibt/entfernt den localStorage-Spiegel (dauerhaft, für No-Flash-Boot). */
export function storeBrandSelection(selection: BrandSelection | null): void {
  try {
    if (selection == null) window.localStorage.removeItem(BRAND_STORAGE_KEY);
    else window.localStorage.setItem(BRAND_STORAGE_KEY, JSON.stringify(selection));
  } catch {
    /* localStorage nicht verfügbar (Private Mode o. Ä.) — best effort. */
  }
}

/** Liest den localStorage-Spiegel (nur color/preset für die UI-Hydration). */
export function readBrandSelection(): { color: string | null; preset: string | null } | null {
  try {
    const raw = window.localStorage.getItem(BRAND_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<BrandSelection>;
    return {
      color: typeof parsed.color === "string" ? parsed.color : null,
      preset: typeof parsed.preset === "string" ? parsed.preset : null,
    };
  } catch {
    return null;
  }
}

/**
 * Persistiert + wendet eine Auswahl an (Save-Pfad): Style + localStorage-Spiegel
 * in einem Rutsch. `preset === "beere"` und die leere Auswahl gelten als
 * STANDARD → Override wird entfernt (tokens.css-Beere bleibt die Quelle).
 */
export function commitBrand(color: string | null, preset: string | null): void {
  const theme = isDefaultBrand(color, preset)
    ? null
    : resolveBrandTheme(color, preset);
  const css = renderBrandCss(theme);
  applyBrandCss(css);
  storeBrandSelection(css == null ? null : { color, preset, css });
}

/** Standard = nichts gewählt oder ausdrücklich „Beere" (== tokens.css). */
export function isDefaultBrand(color: string | null | undefined, preset: string | null | undefined): boolean {
  if (preset === "beere") return true;
  if (!preset && !color) return true;
  return false;
}

/**
 * Inline-Boot-Script gegen den Marken-Flash: läuft synchron im <head>, hängt
 * das Override-<style> aus localStorage an, bevor der Browser das erste Mal
 * malt. Bewusst ES5, ohne Abhängigkeiten. Fehler werden verschluckt (Standard
 * bleibt tokens.css).
 */
export const brandInitScript = `(function(){try{var r=localStorage.getItem("rsm.brand");if(!r)return;var d=JSON.parse(r);if(d&&d.css){var s=document.createElement("style");s.id="rsm-brand-override";s.textContent=d.css;document.head.appendChild(s)}}catch(e){}})();`;
