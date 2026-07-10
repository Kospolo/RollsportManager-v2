import SwiftUI

/// Standard-Karte im Heimspiel-Look: Surface-Fläche, Hairline-Rand,
/// Radius XL (20), warm getönter Karten-Schatten.
///
/// Struktur laut Design-System: Eyebrow → H3-Titel → Inhalt → max. EINE
/// Beere-Aktion. Eyebrow/Titel liefert `RSMSectionHeader`.
struct RSMCard<Content: View>: View {
    var padding: CGFloat = Theme.Spacing.s5
    @ViewBuilder var content: Content

    var body: some View {
        content
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(padding)
            .background(Theme.Colors.bgSurface)
            .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.xl, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: Theme.Radius.xl, style: .continuous)
                    .stroke(Theme.Colors.line, lineWidth: 1)
            )
            .shadow(
                color: Theme.Shadows.card.color,
                radius: Theme.Shadows.card.radius,
                x: Theme.Shadows.card.x,
                y: Theme.Shadows.card.y
            )
    }
}

/// Karten-/Sektionskopf: Eyebrow (11 pt, VERSALIEN, Laufweite) über
/// H3-Titel in Menschensprache („Wer noch offen ist“, nicht „Debitoren“).
struct RSMSectionHeader: View {
    let eyebrow: LocalizedStringKey
    let title: LocalizedStringKey

    var body: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.s1) {
            Text(eyebrow)
                .font(Theme.Fonts.eyebrow)
                .tracking(Theme.Fonts.eyebrowTracking)
                .textCase(.uppercase)
                .foregroundStyle(Theme.Colors.inkFaint)
            Text(title)
                .font(Theme.Fonts.h3)
                .foregroundStyle(Theme.Colors.inkPrimary)
        }
        .accessibilityElement(children: .combine)
    }
}
