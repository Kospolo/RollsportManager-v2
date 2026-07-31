import SwiftUI
#if canImport(UIKit)
import UIKit
#endif

// ============================================================================
// BrandRuntime — die zur Laufzeit einstellbare Marken-/Akzentfarbe des Vereins.
//
// GEGENSTUECK ZUM WEB (apps/web/lib/brand): dieselbe Idee, nativ. Der Verein
// waehlt in den Vereins-Einstellungen einen von SIEBEN kuratierten Presets ODER
// eine freie Hex-Farbe (0084, serverseitig persistiert an app.clubs). Aus dieser
// ROHEN Auswahl wird ein vollstaendiges Fuenferpaket (brand, brandStrong,
// brandSoft, brandInk, brandContrast) fuer Hell UND Dunkel abgeleitet und hier
// als Laufzeit-Override hinterlegt. `Theme.Colors.brand` & Co. (generierte
// `static var`) fragen zuerst hier an und fallen sonst auf die Design-Vorgabe
// zurueck — so aendert sich KEINE Aufrufstelle.
//
// WARUM DIE ABLEITUNG HIER DOPPELT ZUM TS-CODE STEHT: Der Generator (Web) rechnet
// in TypeScript (lib/brand/derive.ts). Die native App kann diese Funktion nicht
// aufrufen, also ist sie hier 1:1 nachgebaut. Die SIEBEN Presets sind statische
// Tabellen (hand-abgestimmt, aus presets.ts kopiert) — sie driften praktisch
// nie. Die freie-Farbe-Ableitung (deriveLight/Dark) folgt exakt derselben Logik
// inkl. des DREIFACH-AA-Gates (Weiss-auf-Brand + Brand-auf-Canvas + Brand-auf-
// Soft). Aendert sich derive.ts, muss diese Datei nachgezogen werden.
// (Sauberere Zukunft: der Server liefert das aufgeloeste Paket — dann faellt
// jede native Kopie weg. Bis dahin: eine Kopie je Plattform, bewusst notiert.)
// ============================================================================

// MARK: - Farb-Mathematik (Port von lib/brand/color.ts)

private struct BR_RGB { var r: Double; var g: Double; var b: Double } // 0..255
private struct BR_HSL { var h: Double; var s: Double; var l: Double } // h 0..360, s/l 0..100

private func brClamp(_ n: Double, _ lo: Double, _ hi: Double) -> Double { min(hi, max(lo, n)) }

private func brIsHex(_ s: String?) -> Bool {
    guard let s else { return false }
    guard s.count == 7, s.hasPrefix("#") else { return false }
    return s.dropFirst().allSatisfy { $0.isHexDigit }
}

private func brHexToRgb(_ hex: String) -> BR_RGB {
    let h = hex.hasPrefix("#") ? String(hex.dropFirst()) : hex
    let n = UInt32(h, radix: 16) ?? 0
    return BR_RGB(r: Double((n >> 16) & 255), g: Double((n >> 8) & 255), b: Double(n & 255))
}

private func brRgbToHex(_ c: BR_RGB) -> String {
    func to(_ x: Double) -> String { String(format: "%02X", Int(brClamp(x.rounded(), 0, 255))) }
    return "#\(to(c.r))\(to(c.g))\(to(c.b))"
}

private func brRgbToHsl(_ c: BR_RGB) -> BR_HSL {
    let rn = c.r / 255, gn = c.g / 255, bn = c.b / 255
    let mx = max(rn, gn, bn), mn = min(rn, gn, bn), d = mx - mn
    var h = 0.0
    if d != 0 {
        if mx == rn { h = ((gn - bn) / d).truncatingRemainder(dividingBy: 6) }
        else if mx == gn { h = (bn - rn) / d + 2 }
        else { h = (rn - gn) / d + 4 }
        h *= 60
        if h < 0 { h += 360 }
    }
    let l = (mx + mn) / 2
    let s = d == 0 ? 0 : d / (1 - abs(2 * l - 1))
    return BR_HSL(h: h, s: s * 100, l: l * 100)
}

private func brHslToRgb(_ hsl: BR_HSL) -> BR_RGB {
    let sn = brClamp(hsl.s, 0, 100) / 100
    let ln = brClamp(hsl.l, 0, 100) / 100
    let c = (1 - abs(2 * ln - 1)) * sn
    let hp = (hsl.h.truncatingRemainder(dividingBy: 360) + 360).truncatingRemainder(dividingBy: 360) / 60
    let x = c * (1 - abs(hp.truncatingRemainder(dividingBy: 2) - 1))
    var r = 0.0, g = 0.0, b = 0.0
    if hp < 1 { (r, g, b) = (c, x, 0) }
    else if hp < 2 { (r, g, b) = (x, c, 0) }
    else if hp < 3 { (r, g, b) = (0, c, x) }
    else if hp < 4 { (r, g, b) = (0, x, c) }
    else if hp < 5 { (r, g, b) = (x, 0, c) }
    else { (r, g, b) = (c, 0, x) }
    let m = ln - c / 2
    return BR_RGB(r: (r + m) * 255, g: (g + m) * 255, b: (b + m) * 255)
}

private func brHslHex(_ h: Double, _ s: Double, _ l: Double) -> String {
    brRgbToHex(brHslToRgb(BR_HSL(h: h, s: s, l: l)))
}

private func brRelLuminance(_ c: BR_RGB) -> Double {
    func lin(_ c8: Double) -> Double {
        let c = c8 / 255
        return c <= 0.03928 ? c / 12.92 : pow((c + 0.055) / 1.055, 2.4)
    }
    return 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b)
}

private func brContrastHex(_ a: String, _ b: String) -> Double {
    let la = brRelLuminance(brHexToRgb(a)), lb = brRelLuminance(brHexToRgb(b))
    let hi = max(la, lb), lo = min(la, lb)
    return (hi + 0.05) / (lo + 0.05)
}

// MARK: - Das Fuenferpaket

struct BrandTokenSet {
    let brand: String
    let brandStrong: String
    let brandSoft: String
    let brandInk: String
    let brandContrast: String
    var asDict: [String: String] {
        ["brand": brand, "brandStrong": brandStrong, "brandSoft": brandSoft,
         "brandInk": brandInk, "brandContrast": brandContrast]
    }
}

struct BrandTheme {
    let light: BrandTokenSet
    let dark: BrandTokenSet
}

// MARK: - Ableitung freier Farben (Port von lib/brand/derive.ts, inkl. AA-Fix)

private enum BrandDerive {
    static let AA = 4.5
    static let WHITE = "#FFFFFF"
    static let LIGHT_CANVAS = "#FBF4EC"   // bgCanvas hell — Grund fuer text-brand
    static let DARK_SURFACE = "#2C211A"
    static let DARK_CANVAS = "#241A14"

    /// LIGHT: Seed C = Brand. --brand muss DREIFACH AA erreichen (Weiss darauf,
    /// Brand-auf-Canvas, Brand-auf-Soft); Ink gegen Soft UND Weiss.
    static func deriveLight(_ h: Double, _ s: Double, _ seedL: Double) -> BrandTokenSet? {
        let brandSoft = brHslHex(h, brClamp(s * 0.5, 22, 55), 93)

        var bl = seedL
        var brand = brHslHex(h, s, bl)
        func brandOk(_ c: String) -> Bool {
            brContrastHex(WHITE, c) >= AA
                && brContrastHex(c, LIGHT_CANVAS) >= AA
                && brContrastHex(c, brandSoft) >= AA
        }
        var i = 0
        while i < 24 && !brandOk(brand) { bl = max(12, bl - 3); brand = brHslHex(h, s, bl); i += 1 }
        if !brandOk(brand) { return nil }

        let brandStrong = brHslHex(h, min(100, s + 4), max(20, bl - 8))

        var il = bl
        var ink = brHslHex(h, s, il)
        i = 0
        while i < 40 && (brContrastHex(ink, brandSoft) < AA || brContrastHex(ink, WHITE) < AA) {
            il = max(0, il - 2); ink = brHslHex(h, s, il); i += 1
        }
        if brContrastHex(ink, brandSoft) < AA || brContrastHex(ink, WHITE) < AA { return nil }

        let darkInk = brHslHex(h, min(s, 60), 13)
        let brandContrast = brContrastHex(WHITE, brand) >= brContrastHex(darkInk, brand) ? WHITE : darkInk
        return BrandTokenSet(brand: brand, brandStrong: brandStrong, brandSoft: brandSoft,
                             brandInk: ink, brandContrast: brandContrast)
    }

    /// DARK: Brand HELL, Contrast DUNKEL (Signatur).
    static func deriveDark(_ h: Double, _ s: Double) -> BrandTokenSet? {
        let ds = brClamp(s, 48, 72)
        var dl = 64.0
        var brand = brHslHex(h, ds, dl)
        var i = 0
        while i < 10 && brContrastHex(brand, DARK_SURFACE) < AA { dl = min(80, dl + 3); brand = brHslHex(h, ds, dl); i += 1 }
        if brContrastHex(brand, DARK_SURFACE) < AA { return nil }

        let brandStrong = brHslHex(h, ds, min(80, dl + 7))
        let brandSoft = brHslHex(h, brClamp(s * 0.7, 38, 60), 21)

        let inkS = brClamp(s, 45, 70)
        var il = 80.0
        var ink = brHslHex(h, inkS, il)
        i = 0
        while i < 12 && (brContrastHex(ink, brandSoft) < AA || brContrastHex(ink, DARK_CANVAS) < AA) {
            il = min(95, il + 2); ink = brHslHex(h, inkS, il); i += 1
        }
        if brContrastHex(ink, brandSoft) < AA || brContrastHex(ink, DARK_CANVAS) < AA { return nil }

        let conS = brClamp(s, 45, 70)
        var cl = 12.0
        var contrast = brHslHex(h, conS, cl)
        i = 0
        while i < 12 && brContrastHex(brand, contrast) < AA { cl = max(0, cl - 2); contrast = brHslHex(h, conS, cl); i += 1 }
        if brContrastHex(brand, contrast) < AA { return nil }

        return BrandTokenSet(brand: brand, brandStrong: brandStrong, brandSoft: brandSoft,
                             brandInk: ink, brandContrast: contrast)
    }

    static func theme(fromHex hex: String) -> BrandTheme? {
        guard brIsHex(hex) else { return nil }
        let hsl = brRgbToHsl(brHexToRgb(hex))
        guard let light = deriveLight(hsl.h, hsl.s, hsl.l), let dark = deriveDark(hsl.h, hsl.s) else { return nil }
        return BrandTheme(light: light, dark: dark)
    }
}

// MARK: - Kuratierte Presets (Port von lib/brand/presets.ts — hand-abgestimmt)

private enum BrandPresets {
    static let byKey: [String: BrandTheme] = [
        "beere": BrandTheme(
            light: BrandTokenSet(brand: "#B23A5C", brandStrong: "#9C2F4E", brandSoft: "#F7E3E9", brandInk: "#8E2946", brandContrast: "#FFFFFF"),
            dark: BrandTokenSet(brand: "#E0698A", brandStrong: "#EB7F9D", brandSoft: "#46232E", brandInk: "#F2A9BD", brandContrast: "#2B0E17")),
        "petrol": BrandTheme(
            light: BrandTokenSet(brand: "#2F6B72", brandStrong: "#215258", brandSoft: "#E9F0F1", brandInk: "#2F6B72", brandContrast: "#FFFFFF"),
            dark: BrandTokenSet(brand: "#77C6CF", brandStrong: "#91D1D8", brandSoft: "#21464A", brandInk: "#B5DEE3", brandContrast: "#11292C")),
        "indigo": BrandTheme(
            light: BrandTokenSet(brand: "#4C56C0", brandStrong: "#3741AD", brandSoft: "#E9EAF1", brandInk: "#4C56C0", brandContrast: "#FFFFFF"),
            dark: BrandTokenSet(brand: "#8289D3", brandStrong: "#9CA2DC", brandSoft: "#21254A", brandInk: "#B4B8E4", brandContrast: "#10122D")),
        "wald": BrandTheme(
            light: BrandTokenSet(brand: "#3F7D4E", brandStrong: "#2E653C", brandSoft: "#E9F1EB", brandInk: "#3C764A", brandContrast: "#FFFFFF"),
            dark: BrandTokenSet(brand: "#77CF8C", brandStrong: "#91D8A2", brandSoft: "#214A2B", brandInk: "#B5E3C0", brandContrast: "#112C17")),
        "terra": BrandTheme(
            light: BrandTokenSet(brand: "#AE5335", brandStrong: "#924228", brandSoft: "#F2EBE8", brandInk: "#A64F33", brandContrast: "#FFFFFF"),
            dark: BrandTokenSet(brand: "#D48A72", brandStrong: "#DCA18D", brandSoft: "#4A2B21", brandInk: "#E7BEB1", brandContrast: "#2F160E")),
        "pflaume": BrandTheme(
            light: BrandTokenSet(brand: "#8A4E9C", brandStrong: "#743D85", brandSoft: "#EFE9F1", brandInk: "#8A4E9C", brandContrast: "#FFFFFF"),
            dark: BrandTokenSet(brand: "#BB77CF", brandStrong: "#C891D8", brandSoft: "#41214A", brandInk: "#D8B5E3", brandContrast: "#26112C")),
        "ozean": BrandTheme(
            light: BrandTokenSet(brand: "#2E6FB0", brandStrong: "#225B93", brandSoft: "#E8EDF2", brandInk: "#2C6AA8", brandContrast: "#FFFFFF"),
            dark: BrandTokenSet(brand: "#6DA3D9", brandStrong: "#89B5E0", brandSoft: "#20364C", brandInk: "#AECCEA", brandContrast: "#0D1F31")),
    ]
}

// MARK: - Der Runtime-Store

final class BrandRuntime: ObservableObject {
    static let shared = BrandRuntime()
    private init() {}

    /// Bump je Anwendung — Views, die BrandRuntime beobachten (MainTabView),
    /// rendern neu und lesen dadurch die generierten `Theme.Colors`-`static var`
    /// frisch. So faerbt sich eine bereits sichtbare Oberflaeche live um.
    @Published private(set) var generation = 0

    /// Nonisolated lesbar (die generierten `static var` fragen aus SwiftUI-
    /// Bodies an, die auf dem MainActor laufen; Schreiben ebenfalls nur dort).
    /// Muster wie SessionStore.currentToken.
    private nonisolated(unsafe) var overrides: [String: (light: BRPlatformColor, dark: BRPlatformColor)] = [:]

    /// Letzte angewandte Auswahl (Verein+Roh), um redundantes Neusetzen zu sparen.
    private nonisolated(unsafe) var appliedSignature: String?

    nonisolated func color(forToken token: String) -> Color? {
        guard let pair = overrides[token] else { return nil }
        return Self.dynamic(pair.light, pair.dark)
    }

    // MARK: Anwenden

    @MainActor func apply(_ theme: BrandTheme) {
        let l = theme.light.asDict, d = theme.dark.asDict
        var next: [String: (light: BRPlatformColor, dark: BRPlatformColor)] = [:]
        for key in l.keys {
            guard let lh = l[key], let dh = d[key],
                  let lc = Self.platformColor(lh), let dc = Self.platformColor(dh) else { continue }
            next[key] = (light: lc, dark: dc)
        }
        overrides = next
        generation &+= 1
    }

    @MainActor func clear() {
        guard !overrides.isEmpty else { return }
        overrides = [:]
        appliedSignature = nil
        generation &+= 1
    }

    /// Aufloesung wie resolveBrandTheme (Web): bekannter Preset gewinnt, sonst
    /// freier Hex, sonst nil (Standard).
    static func resolve(color: String?, preset: String?) -> BrandTheme? {
        if let preset, let hit = BrandPresets.byKey[preset] { return hit }
        if let color, brIsHex(color) { return BrandDerive.theme(fromHex: color) }
        return nil
    }

    /// Laedt den Verein und wendet seine Marke an (bzw. setzt auf Standard
    /// zurueck). Netzfehler werden geschluckt — die App behaelt die Vorgabe,
    /// niemals ein Absturz wegen einer Farbe.
    @MainActor func loadAndApply(clubId: String, api: APIClient) async {
        let signature = clubId
        do {
            let club = try await api.getClub(clubId: clubId)
            let sig = "\(clubId)|\(club.brandPreset ?? "")|\(club.brandColor ?? "")"
            if sig == appliedSignature { return }
            if let theme = Self.resolve(color: club.brandColor, preset: club.brandPreset) {
                apply(theme)
            } else {
                clear()
            }
            appliedSignature = sig
        } catch {
            // Verein nicht ladbar (offline, 404 direkt nach Anlage): Standard
            // behalten. appliedSignature bleibt, damit ein spaeterer Erfolg greift.
            _ = signature
        }
    }

    // MARK: Plattform-Farbe (UIColor/NSColor) + dynamisch (Hell/Dunkel)

#if canImport(UIKit)
    typealias BRPlatformColor = UIColor
#else
    typealias BRPlatformColor = NSColor
#endif

    private static func platformColor(_ hex: String) -> BRPlatformColor? {
        guard brIsHex(hex) else { return nil }
        let c = brHexToRgb(hex)
        return BRPlatformColor(red: c.r / 255, green: c.g / 255, blue: c.b / 255, alpha: 1)
    }

    /// Spiegel von `rsmDynamic` in Theme.swift (dort private).
    private static func dynamic(_ light: BRPlatformColor, _ dark: BRPlatformColor) -> Color {
#if canImport(UIKit)
        return Color(UIColor { traits in traits.userInterfaceStyle == .dark ? dark : light })
#else
        return Color(NSColor(name: nil) { appearance in
            appearance.bestMatch(from: [.aqua, .darkAqua]) == .darkAqua ? dark : light
        })
#endif
    }
}
