import SwiftUI

/// Dekoratives Medaillen-Symbol mit Trophäen-Optik: Band + metallische Scheibe
/// mit Stern. Gold/Silber/Bronze bekommen eigene Metall-Verläufe (bewusst
/// gesättigt, funktioniert in Light + Dark — 1:1 aus der Web-Referenz
/// `MedalIcon.tsx`); `nil` = Teilnahme ohne Medaille → gedämpfte Scheibe aus
/// Theme-Tokens.
///
/// Rein visuell (`accessibilityHidden`) — die Bedeutung steht immer als Wort
/// daneben (Pill/Label), nie allein über die Farbe (DESIGN-SYSTEM §3.6).
struct MedalIconView: View {

    enum Size {
        case sm, md, lg
        /// Breite in pt (Höhe = Breite · 52/44, wie die Web-viewBox 44×52).
        var width: CGFloat {
            switch self {
            case .sm: 26
            case .md: 34
            case .lg: 44
            }
        }
    }

    let medal: Medal?
    var size: Size = .md

    var body: some View {
        let w = size.width
        let h = w * (52.0 / 44.0)
        return Canvas { context, canvasSize in
            draw(in: context, size: canvasSize)
        }
        .frame(width: w, height: h)
        .accessibilityHidden(true)
    }

    // MARK: - Zeichnung (viewBox 44×52 → gleichmäßig skaliert)

    private func draw(in context: GraphicsContext, size canvasSize: CGSize) {
        let s = canvasSize.width / 44.0
        func p(_ x: CGFloat, _ y: CGFloat) -> CGPoint { CGPoint(x: x * s, y: y * s) }

        let metal = medal.map(Self.metal(for:))
        let ring = metal?.ring ?? Theme.Colors.lineStrong
        let star = metal?.star ?? Theme.Colors.inkFaint
        let ribbon = metal?.via ?? Theme.Colors.lineStrong

        // Band — zwei Streifen zur Scheibe.
        var left = Path()
        left.move(to: p(13, 3)); left.addLine(to: p(22, 22))
        left.addLine(to: p(18, 24)); left.addLine(to: p(9, 5)); left.closeSubpath()
        context.fill(left, with: .color(ribbon.opacity(0.9)))

        var right = Path()
        right.move(to: p(31, 3)); right.addLine(to: p(22, 22))
        right.addLine(to: p(26, 24)); right.addLine(to: p(35, 5)); right.closeSubpath()
        context.fill(right, with: .color(ribbon.opacity(0.7)))

        // Scheibe (Ø 30 um Mittelpunkt 22,34).
        let discRect = CGRect(x: 7 * s, y: 19 * s, width: 30 * s, height: 30 * s)
        let disc = Path(ellipseIn: discRect)
        if let metal {
            // Radialverlauf relativ zur Scheiben-Bounding-Box (cx38% cy30% r80%).
            context.fill(
                disc,
                with: .radialGradient(
                    Gradient(stops: [
                        .init(color: metal.from, location: 0),
                        .init(color: metal.via, location: 0.55),
                        .init(color: metal.to, location: 1),
                    ]),
                    center: p(18.4, 28.0),
                    startRadius: 0,
                    endRadius: 24 * s
                )
            )
        } else {
            context.fill(disc, with: .color(Theme.Colors.bgSunken))
        }
        context.stroke(disc, with: .color(ring), lineWidth: 1.5 * s)

        let innerRect = CGRect(x: 11.5 * s, y: 23.5 * s, width: 21 * s, height: 21 * s)
        context.stroke(Path(ellipseIn: innerRect), with: .color(ring.opacity(0.55)), lineWidth: 1 * s)

        // Stern (5-zackig), Rohpunkte skaliert 0.82 und auf (22,34) verschoben.
        var starPath = Path()
        for (index, raw) in Self.starPoints.enumerated() {
            let point = p(raw.x * 0.82 + 22, raw.y * 0.82 + 34)
            if index == 0 { starPath.move(to: point) } else { starPath.addLine(to: point) }
        }
        starPath.closeSubpath()
        context.fill(starPath, with: .color(star.opacity(0.92)))
    }

    // MARK: - Metall-Paletten (1:1 aus MedalIcon.tsx)

    private struct Metal {
        let from: Color
        let via: Color
        let to: Color
        let ring: Color
        let star: Color
    }

    private static func metal(for medal: Medal) -> Metal {
        switch medal {
        case .gold:
            Metal(from: hex(0xFCE9A6), via: hex(0xF1C24C), to: hex(0xB9821B),
                  ring: hex(0x8F6415), star: hex(0x7A5410))
        case .silver:
            Metal(from: hex(0xF3F5F9), via: hex(0xC7CED9), to: hex(0x8A94A3),
                  ring: hex(0x6E7889), star: hex(0x59616F))
        case .bronze:
            Metal(from: hex(0xF2D3B4), via: hex(0xD69A63), to: hex(0x9C5E2E),
                  ring: hex(0x7C4922), star: hex(0x5E3717))
        }
    }

    /// 5-zackiger Stern, zentriert um (0,0) — wie STAR in MedalIcon.tsx.
    private static let starPoints: [CGPoint] = [
        CGPoint(x: 0, y: -10), CGPoint(x: 2.35, y: -3.24), CGPoint(x: 9.51, y: -3.09),
        CGPoint(x: 3.8, y: 1.24), CGPoint(x: 5.88, y: 8.09), CGPoint(x: 0, y: 4),
        CGPoint(x: -5.88, y: 8.09), CGPoint(x: -3.8, y: 1.24), CGPoint(x: -9.51, y: -3.09),
        CGPoint(x: -2.35, y: -3.24),
    ]

    private static func hex(_ value: UInt32) -> Color {
        Color(
            red: Double((value >> 16) & 0xFF) / 255.0,
            green: Double((value >> 8) & 0xFF) / 255.0,
            blue: Double(value & 0xFF) / 255.0
        )
    }
}
