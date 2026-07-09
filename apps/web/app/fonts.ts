import { Bricolage_Grotesque, Plus_Jakarta_Sans, JetBrains_Mono } from "next/font/google";

/**
 * Schriften gemäß DESIGN-SYSTEM.md §2.4 / tokens.json font.family.*
 * — gebundelt via next/font (kein CDN zur Laufzeit).
 *
 * Display: Bricolage Grotesque (600/800) — Begrüßung, Karten-/Kür-Titel, KPI-Zahlen
 * UI/Body: Plus Jakarta Sans (400/600/700)
 * Mono:    JetBrains Mono (500/700) — Beträge, Rechnungsnummern, Kürzeiten
 *
 * Die CSS-Variablen werden in tokens.css als erste Stufe der
 * --font-display/--font-body/--font-mono-Stacks referenziert.
 */
export const bricolage = Bricolage_Grotesque({
  subsets: ["latin", "latin-ext"],
  weight: ["600", "800"],
  variable: "--font-bricolage",
  display: "swap",
});

export const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "600", "700", "800"],
  variable: "--font-jakarta",
  display: "swap",
});

export const jetbrains = JetBrains_Mono({
  subsets: ["latin", "latin-ext"],
  weight: ["500", "600", "700"],
  variable: "--font-jetbrains",
  display: "swap",
});

export const fontVariables = `${bricolage.variable} ${jakarta.variable} ${jetbrains.variable}`;
