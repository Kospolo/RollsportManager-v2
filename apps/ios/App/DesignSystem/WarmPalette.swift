import SwiftUI

// ============================================================================
// WarmPalette + WaveformStrip — das Design „Bewegung & Wärme" (abgenommen
// 2026-08-02). Lokale, geteilte Bausteine, bis das Token-System (packages/tokens)
// nachgezogen ist. EIN Ort für die warme Palette und die Wellenform-Signatur,
// damit Login, Dashboard & Co. dieselbe Sprache sprechen.
// ============================================================================

enum WarmPalette {
    static let coral = Color(hexValue: 0xE8567A)      // Marke
    static let peach = Color(hexValue: 0xF49A6E)      // Verlauf-Hell
    static let coralDeep = Color(hexValue: 0xB23A57)  // Verlauf-Tief / Text auf hell
    static let coralSoft = Color(hexValue: 0xFBE1E8)
    static let gold = Color(hexValue: 0xF4A93C)       // Championship / Erfolg
    static let goldDeep = Color(hexValue: 0xC67F17)
    static let goldSoft = Color(hexValue: 0xFBEBD3)
    static let goldInk = Color(hexValue: 0x3A2606)
    static let mint = Color(hexValue: 0x0E7A6E)       // Akzent
    static let mintSoft = Color(hexValue: 0xD5F3EE)

    /// Warmer Marken-Verlauf (Hero, primäre CTA).
    static var heroGradient: LinearGradient {
        LinearGradient(colors: [peach, coral, coralDeep], startPoint: .topLeading, endPoint: .bottomTrailing)
    }
    /// Championship-Verlauf (Wettkampf, Medaillen).
    static var goldGradient: LinearGradient {
        LinearGradient(colors: [gold, goldDeep], startPoint: .topLeading, endPoint: .bottomTrailing)
    }
}

/// Animierte Wellenform — die Signatur der App (aus dem Kür-Player). Respektiert
/// „Bewegung reduzieren" (dann still). Rein dekorativ, für VoiceOver versteckt.
struct WaveformStrip: View {
    var color: Color
    var reduceMotion: Bool = false

    var body: some View {
        TimelineView(.animation(minimumInterval: 1.0 / 30.0, paused: reduceMotion)) { timeline in
            Canvas { ctx, size in
                let t = timeline.date.timeIntervalSinceReferenceDate
                let barW: CGFloat = 4, gap: CGFloat = 2
                let count = max(1, Int(size.width / (barW + gap)))
                for i in 0..<count {
                    let base = sin(Double(i) * 0.35 + t * 3) * 0.5 + sin(Double(i) * 0.13 - t * 5) * 0.5
                    let h = (0.28 + abs(base) * 0.7) * size.height
                    let x = CGFloat(i) * (barW + gap)
                    var path = Path()
                    path.addRoundedRect(in: CGRect(x: x, y: size.height - h, width: barW, height: h),
                                        cornerSize: CGSize(width: 2, height: 2))
                    ctx.fill(path, with: .color(color))
                }
            }
        }
        .accessibilityHidden(true)
    }
}

extension Color {
    /// 0xRRGGBB → Color. Für die warme Welcome-Palette (Mockup-Werte).
    init(hexValue: UInt32) {
        self.init(
            red: Double((hexValue >> 16) & 0xFF) / 255.0,
            green: Double((hexValue >> 8) & 0xFF) / 255.0,
            blue: Double(hexValue & 0xFF) / 255.0
        )
    }
}
