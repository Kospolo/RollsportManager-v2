/**
 * Kuratierte Marken-Presets — je ein hand-abgestimmtes Fünferpaket für Hell UND
 * Dunkel, das die Kontrast-Disziplin des „Heimspiel"-Designs respektiert
 * (DESIGN-SYSTEM §6). Signatur-Technik: im Dark Mode ist --brand-contrast
 * DUNKEL (nicht Weiß) — Weiß auf Dark-Beere ist ein ausdrückliches Don't.
 *
 * Alle sieben sind per Skript gegen die WCAG-Relativluminanz geprüft: jedes
 * kritische Textpaar erreicht in beiden Themes ≥ 4.5:1. „Beere" ist der
 * unveränderte Standard (exakt tokens.css).
 */

export type BrandTokenSet = {
  /** --brand */
  brand: string;
  /** --brand-strong */
  brandStrong: string;
  /** --brand-soft */
  brandSoft: string;
  /** --brand-ink */
  brandInk: string;
  /** --brand-contrast (im Dark Mode DUNKEL — Signatur) */
  brandContrast: string;
};

export type BrandTheme = { light: BrandTokenSet; dark: BrandTokenSet };

export type BrandPreset = {
  /** stabiler Schlüssel (wird persistiert) */
  key: string;
  /** Seed-/Anzeigefarbe (Light-Brand) für Swatch + type=color */
  hex: string;
  /** i18n-Schlüssel des Wort-Labels (Status nie nur über Farbe) */
  labelKey:
    | "pBeere"
    | "pPetrol"
    | "pIndigo"
    | "pWald"
    | "pTerra"
    | "pPflaume"
    | "pOzean";
  theme: BrandTheme;
};

/** Standard-Preset — „Beere". Wird als Vorgabe hervorgehoben. */
export const DEFAULT_PRESET_KEY = "beere";

export const BRAND_PRESETS: BrandPreset[] = [
  {
    key: "beere",
    hex: "#B23A5C",
    labelKey: "pBeere",
    theme: {
      light: { brand: "#B23A5C", brandStrong: "#9C2F4E", brandSoft: "#F7E3E9", brandInk: "#8E2946", brandContrast: "#FFFFFF" },
      dark: { brand: "#E0698A", brandStrong: "#EB7F9D", brandSoft: "#46232E", brandInk: "#F2A9BD", brandContrast: "#2B0E17" },
    },
  },
  {
    key: "petrol",
    hex: "#2F6B72",
    labelKey: "pPetrol",
    theme: {
      light: { brand: "#2F6B72", brandStrong: "#215258", brandSoft: "#E9F0F1", brandInk: "#2F6B72", brandContrast: "#FFFFFF" },
      dark: { brand: "#77C6CF", brandStrong: "#91D1D8", brandSoft: "#21464A", brandInk: "#B5DEE3", brandContrast: "#11292C" },
    },
  },
  {
    key: "indigo",
    hex: "#4C56C0",
    labelKey: "pIndigo",
    theme: {
      light: { brand: "#4C56C0", brandStrong: "#3741AD", brandSoft: "#E9EAF1", brandInk: "#4C56C0", brandContrast: "#FFFFFF" },
      dark: { brand: "#8289D3", brandStrong: "#9CA2DC", brandSoft: "#21254A", brandInk: "#B4B8E4", brandContrast: "#10122D" },
    },
  },
  {
    key: "wald",
    hex: "#3F7D4E",
    labelKey: "pWald",
    theme: {
      light: { brand: "#3F7D4E", brandStrong: "#2E653C", brandSoft: "#E9F1EB", brandInk: "#3C764A", brandContrast: "#FFFFFF" },
      dark: { brand: "#77CF8C", brandStrong: "#91D8A2", brandSoft: "#214A2B", brandInk: "#B5E3C0", brandContrast: "#112C17" },
    },
  },
  {
    key: "terra",
    hex: "#AE5335",
    labelKey: "pTerra",
    theme: {
      light: { brand: "#AE5335", brandStrong: "#924228", brandSoft: "#F2EBE8", brandInk: "#A64F33", brandContrast: "#FFFFFF" },
      dark: { brand: "#D48A72", brandStrong: "#DCA18D", brandSoft: "#4A2B21", brandInk: "#E7BEB1", brandContrast: "#2F160E" },
    },
  },
  {
    key: "pflaume",
    hex: "#8A4E9C",
    labelKey: "pPflaume",
    theme: {
      light: { brand: "#8A4E9C", brandStrong: "#743D85", brandSoft: "#EFE9F1", brandInk: "#8A4E9C", brandContrast: "#FFFFFF" },
      dark: { brand: "#BB77CF", brandStrong: "#C891D8", brandSoft: "#41214A", brandInk: "#D8B5E3", brandContrast: "#26112C" },
    },
  },
  {
    key: "ozean",
    hex: "#2E6FB0",
    labelKey: "pOzean",
    theme: {
      light: { brand: "#2E6FB0", brandStrong: "#225B93", brandSoft: "#E8EDF2", brandInk: "#2C6AA8", brandContrast: "#FFFFFF" },
      dark: { brand: "#6DA3D9", brandStrong: "#89B5E0", brandSoft: "#20364C", brandInk: "#AECCEA", brandContrast: "#0D1F31" },
    },
  },
];

export function findPreset(key: string | null | undefined): BrandPreset | undefined {
  if (!key) return undefined;
  return BRAND_PRESETS.find((p) => p.key === key);
}
