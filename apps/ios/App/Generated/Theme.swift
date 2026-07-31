// ============================================================
// GENERIERT aus design/tokens.json — NICHT von Hand editieren.
// Neu bauen:  npm run gen:swift   (in packages/tokens)
// Design-System „Heimspiel“ · 1.0.0 · Stand 2026-07-18
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
        /// App-Hintergrund — warmes Papier
        public static let bgCanvas = rsmDynamic(UIColor(red: 0.9843, green: 0.9569, blue: 0.9255, alpha: 1), UIColor(red: 0.1412, green: 0.1020, blue: 0.0784, alpha: 1))
        /// Karten, Topbar, Sidebar; Pflicht-Fläche in der Seriositätszone (Finanzen)
        public static let bgSurface = rsmDynamic(UIColor(red: 1.0, green: 1.0, blue: 1.0, alpha: 1), UIColor(red: 0.1725, green: 0.1294, blue: 0.1020, alpha: 1))
        /// Mulden: Suchfeld, Segmente, Zitat-Blasen
        public static let bgSunken = rsmDynamic(UIColor(red: 0.9569, green: 0.9137, blue: 0.8667, alpha: 1), UIColor(red: 0.1098, green: 0.0745, blue: 0.0549, alpha: 1))
        /// Text, Espresso statt Schwarz — ~13:1 auf Surface
        public static let inkPrimary = rsmDynamic(UIColor(red: 0.2078, green: 0.1451, blue: 0.1098, alpha: 1), UIColor(red: 0.9608, green: 0.9176, blue: 0.8784, alpha: 1))
        /// Sekundärtext — ~6,6:1
        public static let inkSoft = rsmDynamic(UIColor(red: 0.4196, green: 0.3373, blue: 0.2824, alpha: 1), UIColor(red: 0.7882, green: 0.7020, blue: 0.6431, alpha: 1))
        /// Tertiär/Captions — ~4,8:1, nie unter 12,5 px einsetzen
        public static let inkFaint = rsmDynamic(UIColor(red: 0.5412, green: 0.4510, blue: 0.3961, alpha: 1), UIColor(red: 0.6314, green: 0.5490, blue: 0.4902, alpha: 1))
        public static let line = rsmDynamic(UIColor(red: 0.9216, green: 0.8627, blue: 0.8078, alpha: 1), UIColor(red: 0.2431, green: 0.1922, blue: 0.1608, alpha: 1))
        public static let lineStrong = rsmDynamic(UIColor(red: 0.8627, green: 0.7882, blue: 0.7216, alpha: 1), UIColor(red: 0.3059, green: 0.2431, blue: 0.20, alpha: 1))
        /// Beere — genau eine Primäraktion pro Sichtbereich
        private static let brandDefault = rsmDynamic(UIColor(red: 0.6980, green: 0.2275, blue: 0.3608, alpha: 1), UIColor(red: 0.8784, green: 0.4118, blue: 0.5412, alpha: 1))
        public static var brand: Color { BrandRuntime.shared.color(forToken: "brand") ?? brandDefault }
        /// Hover/Pressed
        private static let brandStrongDefault = rsmDynamic(UIColor(red: 0.6118, green: 0.1843, blue: 0.3059, alpha: 1), UIColor(red: 0.9216, green: 0.4980, blue: 0.6157, alpha: 1))
        public static var brandStrong: Color { BrandRuntime.shared.color(forToken: "brandStrong") ?? brandStrongDefault }
        private static let brandSoftDefault = rsmDynamic(UIColor(red: 0.9686, green: 0.8902, blue: 0.9137, alpha: 1), UIColor(red: 0.2745, green: 0.1373, blue: 0.1804, alpha: 1))
        public static var brandSoft: Color { BrandRuntime.shared.color(forToken: "brandSoft") ?? brandSoftDefault }
        /// Text auf brand.soft
        private static let brandInkDefault = rsmDynamic(UIColor(red: 0.5569, green: 0.1608, blue: 0.2745, alpha: 1), UIColor(red: 0.9490, green: 0.6627, blue: 0.7412, alpha: 1))
        public static var brandInk: Color { BrandRuntime.shared.color(forToken: "brandInk") ?? brandInkDefault }
        /// Text auf brand — ~5,8:1
        private static let brandContrastDefault = rsmDynamic(UIColor(red: 1.0, green: 1.0, blue: 1.0, alpha: 1), UIColor(red: 0.1686, green: 0.0549, blue: 0.0902, alpha: 1))
        public static var brandContrast: Color { BrandRuntime.shared.color(forToken: "brandContrast") ?? brandContrastDefault }
        /// EXKLUSIV Musik/Küren: Waveform (gespielt), Loop, Zeitmarken, Kür-Chips. Nie im Mahnwesen.
        public static let honey = rsmDynamic(UIColor(red: 0.9098, green: 0.6627, blue: 0.2902, alpha: 1), UIColor(red: 0.9098, green: 0.6627, blue: 0.2902, alpha: 1))
        /// Honig als Text/Icon — ~5,7:1
        public static let honeyDeep = rsmDynamic(UIColor(red: 0.5922, green: 0.3412, blue: 0.0549, alpha: 1), UIColor(red: 0.9373, green: 0.7098, blue: 0.3686, alpha: 1))
        public static let honeySoft = rsmDynamic(UIColor(red: 0.9765, green: 0.9294, blue: 0.8471, alpha: 1), UIColor(red: 0.2392, green: 0.1725, blue: 0.0824, alpha: 1))
        /// NEU (Jury-Fix): Stufe „Erinnerung“ im Mahnwesen + neutrale Hinweise — ersetzt den Honig-Regelbruch
        public static let info = rsmDynamic(UIColor(red: 0.1843, green: 0.4196, blue: 0.4471, alpha: 1), UIColor(red: 0.4980, green: 0.7490, blue: 0.7765, alpha: 1))
        public static let infoSoft = rsmDynamic(UIColor(red: 0.8863, green: 0.9373, blue: 0.9373, alpha: 1), UIColor(red: 0.1176, green: 0.2078, blue: 0.2196, alpha: 1))
        /// Zusagen, bezahlt, im Limit — ~4,9:1
        public static let success = rsmDynamic(UIColor(red: 0.2471, green: 0.4902, blue: 0.3059, alpha: 1), UIColor(red: 0.5216, green: 0.7686, blue: 0.5725, alpha: 1))
        public static let successSoft = rsmDynamic(UIColor(red: 0.8941, green: 0.9412, blue: 0.8902, alpha: 1), UIColor(red: 0.1412, green: 0.2196, blue: 0.1647, alpha: 1))
        /// Fristen, 1. Mahnung
        public static let warn = rsmDynamic(UIColor(red: 0.5922, green: 0.3412, blue: 0.0549, alpha: 1), UIColor(red: 0.9373, green: 0.7098, blue: 0.3686, alpha: 1))
        public static let warnSoft = rsmDynamic(UIColor(red: 0.9765, green: 0.9294, blue: 0.8471, alpha: 1), UIColor(red: 0.2392, green: 0.1725, blue: 0.0824, alpha: 1))
        /// Absagen, überfällig, 2. Mahnung — ~5,5:1
        public static let danger = rsmDynamic(UIColor(red: 0.7373, green: 0.2392, blue: 0.1882, alpha: 1), UIColor(red: 0.9098, green: 0.5137, blue: 0.4549, alpha: 1))
        public static let dangerSoft = rsmDynamic(UIColor(red: 0.9765, green: 0.8941, blue: 0.8784, alpha: 1), UIColor(red: 0.2627, green: 0.1294, blue: 0.1059, alpha: 1))
        public static let avatarBerry = rsmDynamic(UIColor(red: 0.6980, green: 0.2275, blue: 0.3608, alpha: 1), UIColor(red: 0.7569, green: 0.3176, blue: 0.4353, alpha: 1))
        public static let avatarCoral = rsmDynamic(UIColor(red: 0.7608, green: 0.3569, blue: 0.2471, alpha: 1), UIColor(red: 0.7882, green: 0.4157, blue: 0.3059, alpha: 1))
        /// Initialen hier in ink.onAvatarDark (Jury-Fix: Weiß unterschritt AA)
        public static let avatarHoney = rsmDynamic(UIColor(red: 0.7059, green: 0.4549, blue: 0.1098, alpha: 1), UIColor(red: 0.7333, green: 0.5020, blue: 0.1569, alpha: 1))
        /// Initialen hier in ink.onAvatarDark (Jury-Fix)
        public static let avatarMoss = rsmDynamic(UIColor(red: 0.2980, green: 0.5216, blue: 0.3333, alpha: 1), UIColor(red: 0.3608, green: 0.5804, blue: 0.3961, alpha: 1))
        public static let avatarPlum = rsmDynamic(UIColor(red: 0.5412, green: 0.3059, blue: 0.6118, alpha: 1), UIColor(red: 0.6039, green: 0.3804, blue: 0.6745, alpha: 1))
        public static let avatarPetrol = rsmDynamic(UIColor(red: 0.2431, green: 0.4902, blue: 0.5137, alpha: 1), UIColor(red: 0.3059, green: 0.5529, blue: 0.5765, alpha: 1))
        /// Initialen auf berry/coral/plum/petrol
        public static let avatarOnDefault = rsmDynamic(UIColor(red: 1.0, green: 1.0, blue: 1.0, alpha: 1), UIColor(red: 0.1020, green: 0.0510, blue: 0.0314, alpha: 0.92))
        /// Initialen auf honey/moss (Light) und auf ALLEN Tönen im Dark Mode
        public static let avatarOnAvatarDark = rsmDynamic(UIColor(red: 0.1020, green: 0.0510, blue: 0.0314, alpha: 0.92), UIColor(red: 0.1020, green: 0.0510, blue: 0.0314, alpha: 0.92))
        /// ungespielter Teil der Waveform
        public static let waveOff = rsmDynamic(UIColor(red: 0.9137, green: 0.8392, blue: 0.7608, alpha: 1), UIColor(red: 0.2902, green: 0.2196, blue: 0.1725, alpha: 1))
        /// 3-px-Fokusring, Offset 2 px
        public static let focus = rsmDynamic(UIColor(red: 0.6980, green: 0.2275, blue: 0.3608, alpha: 1), UIColor(red: 0.8784, green: 0.4118, blue: 0.5412, alpha: 1))
    }

    // MARK: - Spacing (4-pt-Basis, pt = px)

    public enum Spacing {
        public static let s1: CGFloat = 4
        public static let s2: CGFloat = 8
        public static let s3: CGFloat = 12
        public static let s4: CGFloat = 16
        public static let s5: CGFloat = 20
        public static let s6: CGFloat = 24
        public static let s7: CGFloat = 32
        public static let s8: CGFloat = 40
        public static let s9: CGFloat = 48
        public static let s10: CGFloat = 64
        public static let cardGap: CGFloat = 22
    }

    // MARK: - Radius

    public enum Radius {
        public static let s: CGFloat = 8 // Checkboxen, kbd, kleine Tags
        public static let m: CGFloat = 12 // Inputs, Nav-Items, Zitat-Blasen
        public static let l: CGFloat = 16 // Kacheln, KPI-Karten, Banner
        public static let xl: CGFloat = 20 // Karten (Standard)
        public static let full: CGFloat = 999 // Buttons, Chips, Suchfeld, Segmente, Personen-Avatare
        public static let org: CGFloat = 9 // Icon-Kacheln für Organisationen/Sammelbuchungen (KEINE Pseudo-Monogramme, Jury-Fix)
    }

    // MARK: - Größen

    public enum Size {
        public static let touchTarget: CGFloat = 44 // Minimum, auch am Desktop
        public static let listRow: CGFloat = 56 // Minimum Listenzeilen
        public static let playButton: CGFloat = 68 // großes Play im Kür-Player
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
    // und wachsen deshalb mit den Systemeinstellungen mit. `Font.system(size:)` tut das
    // NICHT — es friert die Größe ein. Darum wird `size:` hier nur noch in den Helfern
    // benutzt, und deren Aufrufer müssen die Größe selbst über @ScaledMetric skalieren.

    public enum Fonts {
        /// 28 pt bei Standardgröße (.title) · Gewicht 800
        public static let display = Font.system(.title, design: .rounded, weight: .heavy)
        /// Laufweite für `display` in pt (-0.02em) — per .tracking() anwenden.
        public static let displayTracking: CGFloat = -0.56
        /// 20 pt bei Standardgröße (.title3) · Gewicht 800
        public static let h2 = Font.system(.title3, design: .rounded, weight: .heavy)
        /// 17 pt bei Standardgröße (.headline) · Gewicht 800
        public static let h3 = Font.system(.headline, design: .rounded, weight: .heavy)
        /// 17 pt bei Standardgröße (.headline) · Gewicht 800 — Zeilentitel in Listen (Mitglieder, Küren, Termine) — optisch wie h3, eigene Rolle für spätere Feinsteuerung
        public static let listTitle = Font.system(.headline, design: .rounded, weight: .heavy)
        /// 17 pt bei Standardgröße (.body) · Gewicht 700
        public static let bodyStrong = Font.system(.body, design: .default, weight: .bold)
        /// 17 pt bei Standardgröße (.body) · Gewicht 400
        public static let body = Font.system(.body, design: .default, weight: .regular)
        /// 13 pt bei Standardgröße (.footnote) · Gewicht 400
        public static let caption = Font.system(.footnote, design: .default, weight: .regular)
        /// 11 pt bei Standardgröße (.caption2) · Gewicht 800 · VERSALIEN (im View per .textCase(.uppercase))
        public static let eyebrow = Font.system(.caption2, design: .default, weight: .heavy)
        /// Laufweite für `eyebrow` in pt (+0.09em) — per .tracking() anwenden.
        public static let eyebrowTracking: CGFloat = 0.99
        /// 16 pt bei Standardgröße (.callout) · Gewicht 600 — Beträge/Rechnungsnummern in Tabellen (JetBrains Mono, tabular)
        public static let monoTable = Font.system(.callout, design: .monospaced, weight: .semibold)
        /// 13 pt bei Standardgröße (.footnote) · Gewicht 500 — Kleine Mono-Angaben: Zeitmarken, Kürzeiten im Chip, Codes, Restlaufzeiten
        public static let monoCaption = Font.system(.footnote, design: .monospaced, weight: .medium)
        /// 22 pt bei Standardgröße (.title2) · Gewicht 700 — Große Mono-Zahl: Rechnungssumme im Detail, Medaillenspiegel, Score-Pad
        public static let monoHero = Font.system(.title2, design: .monospaced, weight: .bold)

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
        /// Größte Ebene von shadow.card — radius ≈ CSS-Blur / 2.
        public static let card = RSMShadow(
            color: rsmDynamic(UIColor(red: 0.3294, green: 0.1922, blue: 0.1137, alpha: 0.07), UIColor(red: 0.0, green: 0.0, blue: 0.0, alpha: 0.28)),
            radius: 15, x: 0, y: 10
        )
        /// Größte Ebene von shadow.pop — radius ≈ CSS-Blur / 2.
        public static let pop = RSMShadow(
            color: rsmDynamic(UIColor(red: 0.2353, green: 0.1255, blue: 0.0627, alpha: 0.16), UIColor(red: 0.0, green: 0.0, blue: 0.0, alpha: 0.5)),
            radius: 25, x: 0, y: 18
        )
    }

    // MARK: - Motion (Sekunden; prefers-reduced-motion respektieren!)

    public enum Motion {
        public static let fast: Double = 0.15
        public static let standard: Double = 0.25
        /// Button-Druck: scale(0.98)
        public static let pressScale: CGFloat = 0.98
    }
}
