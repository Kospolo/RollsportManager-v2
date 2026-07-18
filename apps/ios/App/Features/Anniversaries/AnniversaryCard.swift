import SwiftUI

/// Eine Zeile der Jubiläums-Liste: festliches Art-Glyph, Personen-Avatar, Name,
/// Art-Pille + Meilenstein und rechts Datum samt Countdown-Pille. Rein lesend.
/// Web-Referenz: `_components/AnniversaryCard.tsx`.
struct AnniversaryCard: View {
    let item: Anniversary

    var body: some View {
        let style = JubilaeenFormat.style(for: item.kind)
        let count = JubilaeenFormat.countdown(daysUntil: item.daysUntil)

        HStack(spacing: Theme.Spacing.s3) {
            glyph(style)

            RSMAvatarView(name: item.memberName, personId: item.memberId, size: 40)

            VStack(alignment: .leading, spacing: 3) {
                Text(verbatim: item.memberName)
                    .font(Theme.Fonts.h3)
                    .foregroundStyle(Theme.Colors.inkPrimary)
                    .lineLimit(1)
                HStack(spacing: Theme.Spacing.s2) {
                    RSMStatusPill(text: JubilaeenFormat.kindLabel(item.kind), kind: style.pill)
                    // years == nil = Geburtstag ohne bekanntes Geburtsjahr (kein Alter).
                    // Web-Referenz blendet das Meilenstein-Label dann aus (Chip bleibt).
                    if let years = item.years {
                        Text(JubilaeenFormat.milestone(item.kind, years: years))
                            .font(Theme.Fonts.caption.weight(.semibold))
                            .foregroundStyle(Theme.Colors.inkSoft)
                            .lineLimit(2)
                    }
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)

            VStack(alignment: .trailing, spacing: Theme.Spacing.s1) {
                Text(verbatim: JubilaeenFormat.dayText(item.date))
                    .font(Theme.Fonts.monoCaption.weight(.medium))
                    .monospacedDigit()
                    .foregroundStyle(Theme.Colors.inkFaint)
                    .lineLimit(1)
                RSMStatusPill(text: count.label, kind: count.kind)
            }
            .layoutPriority(1)
        }
        .padding(.vertical, Theme.Spacing.s3)
        .padding(.horizontal, Theme.Spacing.s4)
        .background(Theme.Colors.bgSurface)
        .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.l, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: Theme.Radius.l, style: .continuous)
                .stroke(Theme.Colors.line, lineWidth: 1)
        )
        .shadow(
            color: Theme.Shadows.card.color, radius: Theme.Shadows.card.radius,
            x: Theme.Shadows.card.x, y: Theme.Shadows.card.y
        )
        .accessibilityElement(children: .combine)
    }

    private func glyph(_ style: JubilaeenFormat.KindStyle) -> some View {
        ZStack {
            Circle().fill(style.glyphBackground)
            Image(systemName: style.symbol)
                .font(.system(size: 18, weight: .semibold))
                .foregroundStyle(style.glyphForeground)
        }
        .frame(width: 40, height: 40)
        .accessibilityHidden(true)
    }
}
