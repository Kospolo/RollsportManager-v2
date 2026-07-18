import SwiftUI

/// Trophäen-Zusammenfassung der eigenen Vitrine: je eine Kachel für Gold,
/// Silber und Bronze mit Medaillen-Symbol und Anzahl. Rein informativ; die
/// Detailkarten stehen darunter. Web-Referenz: `MineSummary.tsx`.
struct MineSummaryView: View {
    /// Die eigenen Erfolge (bereits auf das Mitglied gefiltert).
    let achievements: [MedalAchievement]

    private static let order: [Medal] = [.gold, .silver, .bronze]

    private func count(_ medal: Medal) -> Int {
        achievements.filter { $0.medal == medal }.count
    }

    var body: some View {
        HStack(spacing: Theme.Spacing.s3) {
            ForEach(Self.order, id: \.self) { medal in
                tile(medal)
            }
        }
    }

    private func tile(_ medal: Medal) -> some View {
        HStack(spacing: Theme.Spacing.s3) {
            MedalIconView(medal: medal, size: .md)
            VStack(alignment: .leading, spacing: 0) {
                Text("\(count(medal))")
                    .font(Theme.Fonts.h2)
                    .monospacedDigit()
                    .foregroundStyle(Theme.Colors.inkPrimary)
                Text(MedaillenL10n.medalLabelKey(medal))
                    .font(Theme.Fonts.eyebrow)
                    .tracking(Theme.Fonts.eyebrowTracking)
                    .textCase(.uppercase)
                    .foregroundStyle(Theme.Colors.inkFaint)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(.horizontal, Theme.Spacing.s4)
        .padding(.vertical, Theme.Spacing.s3)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Colors.bgSurface)
        .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.l, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: Theme.Radius.l, style: .continuous)
                .stroke(Theme.Colors.line, lineWidth: 1)
        )
        .shadow(
            color: Theme.Shadows.card.color,
            radius: Theme.Shadows.card.radius,
            x: Theme.Shadows.card.x,
            y: Theme.Shadows.card.y
        )
        .accessibilityElement(children: .combine)
    }
}
