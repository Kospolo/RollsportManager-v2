import SwiftUI

/// Gestapelter Antwort-Balken (6 pt): Zusagen (success) · Absagen (danger) ·
/// offen (line-strong). REIN visuell — der Balken ist `accessibilityHidden`,
/// die Information trägt IMMER die Klartext-Zeile daneben
/// („9 Zusagen · 1 Absage · 4 offen“).
struct RSMResponseBar: View {
    let going: Int
    let declined: Int
    let open: Int

    private var total: Int { max(going + declined + open, 1) }

    var body: some View {
        GeometryReader { geo in
            HStack(spacing: 2) {
                segment(count: going, color: Theme.Colors.success, width: geo.size.width)
                segment(count: declined, color: Theme.Colors.danger, width: geo.size.width)
                segment(count: open, color: Theme.Colors.lineStrong, width: geo.size.width)
            }
        }
        .frame(height: 6)
        .clipShape(Capsule())
        .accessibilityHidden(true)
    }

    @ViewBuilder
    private func segment(count: Int, color: Color, width: CGFloat) -> some View {
        if count > 0 {
            color.frame(width: max(width * CGFloat(count) / CGFloat(total) - 2, 3))
        }
    }
}
