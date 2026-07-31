/**
 * Öffentliche Fassade des Marken-/Akzentfarben-Moduls. Ein Import für Screens
 * und Layout: Presets, Ableitung, Laufzeit-Anwendung, Boot.
 */

export type { BrandPreset, BrandTheme, BrandTokenSet } from "./presets";
export { BRAND_PRESETS, DEFAULT_PRESET_KEY, findPreset } from "./presets";
export { deriveBrandTheme, isBrandReadable, resolveBrandTheme } from "./derive";
export { isHex } from "./color";
export {
  BRAND_STORAGE_KEY,
  BRAND_STYLE_ID,
  applyBrandCss,
  brandInitScript,
  commitBrand,
  isDefaultBrand,
  readBrandSelection,
  renderBrandCss,
  storeBrandSelection,
  type BrandSelection,
} from "./runtime";
export { BrandBoot } from "./BrandBoot";
