import SwiftUI

/// Primär-Button „Beere = Handlung“: Pill-Form, min. 44 pt Touch-Ziel,
/// Text in `brandContrast` (Light: Weiß, Dark: dunkles Espresso — Signatur).
/// Regel: genau EINE Beere-Primäraktion pro Sichtbereich.
struct RSMPrimaryButton: View {
    let title: LocalizedStringKey
    var isLoading = false
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: Theme.Spacing.s2) {
                if isLoading {
                    ProgressView()
                        .tint(Theme.Colors.brandContrast)
                }
                Text(title)
                    .font(Theme.Fonts.bodyStrong)
            }
            .frame(maxWidth: .infinity, minHeight: Theme.Size.touchTarget)
            .foregroundStyle(Theme.Colors.brandContrast)
            .background(Theme.Colors.brand)
            .clipShape(Capsule())
        }
        .buttonStyle(RSMPressableButtonStyle())
        .disabled(isLoading)
    }
}

/// Sekundär-Button: brand-soft-Tint mit brand-ink-Text (naheliegende Zweitaktion).
struct RSMSecondaryButton: View {
    let title: LocalizedStringKey
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(title)
                .font(Theme.Fonts.bodyStrong)
                .frame(maxWidth: .infinity, minHeight: Theme.Size.touchTarget)
                .foregroundStyle(Theme.Colors.brandInk)
                .background(Theme.Colors.brandSoft)
                .clipShape(Capsule())
        }
        .buttonStyle(RSMPressableButtonStyle())
    }
}

/// Druck-Feedback: scale 0.98 (Token `motion.press`), respektiert Reduce Motion.
struct RSMPressableButtonStyle: ButtonStyle {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed && !reduceMotion ? Theme.Motion.pressScale : 1)
            .animation(
                reduceMotion ? nil : .easeOut(duration: Theme.Motion.fast),
                value: configuration.isPressed
            )
            .opacity(configuration.isPressed ? 0.9 : 1)
    }
}
