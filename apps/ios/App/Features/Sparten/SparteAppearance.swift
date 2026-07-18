import SwiftUI

// ============================================================================
// Aussehen einer Sparte: Icon-Angebot (als STRING-Schlüssel, damit die Daten
// mit der Web-App deckungsgleich bleiben) und feste Farbpalette (Hex).
//
// Die gespeicherten Werte (`sparte.icon`, `sparte.farbe`) sind exakt dieselben
// wie im Web (apps/web/app/(portal)/sparten/_components/options.ts) — eine
// Sparte trägt in App und Web dasselbe Symbol und dieselbe Akzentfarbe. iOS
// bildet die Web-`IconName`-Strings nur auf SF-Symbole ab (reines Rendering).
// ============================================================================

/// Kuratiertes Icon-Angebot — der Schlüssel (`key`) wird gespeichert (identisch
/// zu den Web-`IconName`s), `symbol` ist das SF-Symbol fürs Rendering.
enum SparteIconCatalog {

    /// (gespeicherter Schlüssel, SF-Symbol) — Reihenfolge wie im Web-Angebot.
    static let options: [(key: String, symbol: String)] = [
        ("routines", "music.note"),
        ("competition", "trophy.fill"),
        ("teams", "person.3.fill"),
        ("events", "calendar"),
        ("sparkle", "sparkles"),
        ("zap", "bolt.fill"),
        ("globe", "globe"),
        ("play", "play.circle.fill"),
        ("shield", "shield.fill"),
        ("members", "person.2.fill"),
        ("clock", "clock.fill"),
        ("dashboard", "square.grid.2x2.fill"),
    ]

    /// Standard-Icon-Schlüssel, wenn (noch) keiner gewählt/gespeichert ist.
    static let defaultKey = "sparkle"

    private static let symbolByKey: [String: String] = {
        var map: [String: String] = [:]
        for option in options { map[option.key] = option.symbol }
        return map
    }()

    /// SF-Symbol zu einem gespeicherten Icon-Schlüssel — unbekannte oder leere
    /// Werte fallen sicher auf das Standard-Symbol zurück (nie ein Render-Crash
    /// bei Alt-/Fremddaten).
    static func symbol(for key: String?) -> String {
        guard let key, let symbol = symbolByKey[key] else {
            return symbolByKey[defaultKey] ?? "sparkles"
        }
        return symbol
    }
}

/// Feste Farbpalette (Hex) — funktioniert in Light + Dark gleich. Deckungsgleich
/// zur Web-Palette (aus den Marken-/Avatar-Tokens abgeleitet).
enum SparteColorCatalog {

    static let hexColors: [String] = [
        "#B23A5C", // Berry (Marke)
        "#C25B3F", // Koralle
        "#B4741C", // Honig
        "#4C8555", // Moos
        "#3E7D83", // Petrol
        "#8A4E9C", // Pflaume
        "#2F6B72", // Info-Tiefe
        "#BC3D30", // Rot
    ]

    /// Standard-Farbe, wenn (noch) keine gewählt/gespeichert ist.
    static let defaultHex = "#B23A5C"

    /// Akzentfarbe einer Sparte — parst den gespeicherten Hex-String, fällt bei
    /// Unbekanntem sicher auf die Standard-Farbe zurück.
    static func color(for hex: String?) -> Color {
        Color(hex: hex) ?? Color(hex: defaultHex) ?? Theme.Colors.brand
    }
}

extension Color {
    /// #RRGGBB (optional führendes '#') → Color. Ungültige Eingaben ⇒ nil.
    init?(hex: String?) {
        guard let hex else { return nil }
        var trimmed = hex.trimmingCharacters(in: .whitespacesAndNewlines)
        if trimmed.hasPrefix("#") { trimmed.removeFirst() }
        guard trimmed.count == 6, let value = UInt32(trimmed, radix: 16) else { return nil }
        self.init(
            .sRGB,
            red: Double((value >> 16) & 0xFF) / 255,
            green: Double((value >> 8) & 0xFF) / 255,
            blue: Double(value & 0xFF) / 255,
            opacity: 1
        )
    }
}
