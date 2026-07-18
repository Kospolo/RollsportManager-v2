import SwiftUI

/// Festlicher „Als Nächstes“-Hero für das nächstgelegene Jubiläum: warmer
/// Verlauf (Beere → Papier → Honig), dezentes Konfetti-Glyph, große Person und
/// Countdown. Setzt den festlichen Ton der Seite (Heimspiel-Look) und bleibt
/// rein lesend. Web-Referenz: `_components/NextUpBanner.tsx`.
struct AnniversariesNextUpBanner: View {
    let item: Anniversary

    var body: some View {
        let style = JubilaeenFormat.style(for: item.kind)
        let count = JubilaeenFormat.countdown(daysUntil: item.daysUntil)

        ZStack(alignment: .topTrailing) {
            Image(systemName: "party.popper.fill")
                .font(.system(size: 84, weight: .regular))
                .foregroundStyle(Theme.Colors.brand.opacity(0.12))
                .rotationEffect(.degrees(8))
                .offset(x: 20, y: -12)
                .accessibilityHidden(true)

            VStack(alignment: .leading, spacing: Theme.Spacing.s3) {
                Text("jubilaeen.nextUp")
                    .font(Theme.Fonts.eyebrow)
                    .tracking(Theme.Fonts.eyebrowTracking)
                    .textCase(.uppercase)
                    .foregroundStyle(Theme.Colors.brandInk)

                HStack(spacing: Theme.Spacing.s3) {
                    RSMAvatarView(name: item.memberName, personId: item.memberId, size: 52)
                    VStack(alignment: .leading, spacing: 3) {
                        Text(verbatim: item.memberName)
                            .font(Theme.Fonts.h3)
                            .foregroundStyle(Theme.Colors.inkPrimary)
                            .lineLimit(1)
                        HStack(spacing: Theme.Spacing.s2) {
                            Image(systemName: style.symbol)
                                .font(.system(size: 13, weight: .semibold))
                                .foregroundStyle(style.glyphForeground)
                                .accessibilityHidden(true)
                            // years == nil = Geburtstag ohne bekanntes Geburtsjahr
                            // (kein Alter); das Meilenstein-Label entfaellt dann,
                            // das Art-Symbol bleibt (Web-Referenz NextUpBanner.tsx).
                            if let years = item.years {
                                Text(JubilaeenFormat.milestone(item.kind, years: years))
                                    .font(Theme.Fonts.bodyStrong)
                                    .foregroundStyle(Theme.Colors.inkSoft)
                                    .lineLimit(2)
                            }
                        }
                    }
                    Spacer(minLength: 0)
                }

                HStack(spacing: Theme.Spacing.s2) {
                    RSMStatusPill(text: count.label, kind: count.kind)
                    Text(verbatim: JubilaeenFormat.dayText(item.date))
                        .font(Theme.Fonts.monoCaption.weight(.medium))
                        .monospacedDigit()
                        .foregroundStyle(Theme.Colors.inkFaint)
                    Spacer(minLength: 0)
                }
            }
            .padding(Theme.Spacing.s5)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            LinearGradient(
                colors: [Theme.Colors.brandSoft, Theme.Colors.bgSurface, Theme.Colors.warnSoft],
                startPoint: .topLeading, endPoint: .bottomTrailing
            )
        )
        .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.xl, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: Theme.Radius.xl, style: .continuous)
                .stroke(Theme.Colors.line, lineWidth: 1)
        )
        .shadow(
            color: Theme.Shadows.card.color, radius: Theme.Shadows.card.radius,
            x: Theme.Shadows.card.x, y: Theme.Shadows.card.y
        )
        .accessibilityElement(children: .combine)
    }
}
