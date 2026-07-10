import SwiftUI

/// Leerer Zustand mit Handlung: Icon + ein Satz + optionaler CTA
/// („Noch keine Kür — Musik hochladen“). Nie ein leerer Screen ohne Weg.
struct RSMEmptyState: View {
    let systemImage: String
    let title: LocalizedStringKey
    let message: LocalizedStringKey
    var actionTitle: LocalizedStringKey?
    var action: (() -> Void)?

    var body: some View {
        VStack(spacing: Theme.Spacing.s4) {
            Image(systemName: systemImage)
                .font(.system(size: 40, weight: .medium))
                .foregroundStyle(Theme.Colors.inkFaint)
                .accessibilityHidden(true)
            VStack(spacing: Theme.Spacing.s2) {
                Text(title)
                    .font(Theme.Fonts.h3)
                    .foregroundStyle(Theme.Colors.inkPrimary)
                Text(message)
                    .font(Theme.Fonts.body)
                    .foregroundStyle(Theme.Colors.inkSoft)
                    .multilineTextAlignment(.center)
            }
            if let actionTitle, let action {
                RSMPrimaryButton(title: actionTitle, action: action)
                    .fixedSize()
            }
        }
        .padding(Theme.Spacing.s7)
        .frame(maxWidth: .infinity)
    }
}
