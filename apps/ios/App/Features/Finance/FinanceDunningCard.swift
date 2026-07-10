import SwiftUI

/// Mahn-Automatik-Karte (Design-System §3.7): Regel-Zeitleiste als vier
/// Kacheln (+7 / +21 / +35 / +49 Tage) mit 4-pt-Farbkante links, darunter
/// die Kontroll-Mikrocopy („Stufe 2+ wird nie automatisch versendet …“)
/// und die einzige Beere des Screens: „Mahnlauf (Vorschau)“.
///
/// Der Lauf ist IMMER dry_run — scharfe Läufe gibt es hier bewusst nicht.
struct FinanceDunningCard: View {
    let state: FinanceViewModel.DunningState
    let onPreview: () -> Void

    private struct Stage: Identifiable {
        let id: Int
        let day: LocalizedStringKey
        let title: LocalizedStringKey
        let mode: LocalizedStringKey
        let color: Color
    }

    /// Eskalationstreppe: Erinnerung (Info/Petrol, NIE Honig) →
    /// 1. Mahnung (warn) → 2. Mahnung/Übergabe (danger).
    private var stages: [Stage] {
        [
            Stage(
                id: 1,
                day: "finance.dunning.stage1.day",
                title: "finance.dunning.stage1.title",
                mode: "finance.dunning.stage1.mode",
                color: Theme.Colors.info
            ),
            Stage(
                id: 2,
                day: "finance.dunning.stage2.day",
                title: "finance.dunning.stage2.title",
                mode: "finance.dunning.stage2.mode",
                color: Theme.Colors.warn
            ),
            Stage(
                id: 3,
                day: "finance.dunning.stage3.day",
                title: "finance.dunning.stage3.title",
                mode: "finance.dunning.stage3.mode",
                color: Theme.Colors.danger
            ),
            Stage(
                id: 4,
                day: "finance.dunning.stage4.day",
                title: "finance.dunning.stage4.title",
                mode: "finance.dunning.stage4.mode",
                color: Theme.Colors.danger
            ),
        ]
    }

    var body: some View {
        RSMCard {
            VStack(alignment: .leading, spacing: Theme.Spacing.s4) {
                RSMSectionHeader(
                    eyebrow: "finance.dunning.eyebrow",
                    title: "finance.dunning.title"
                )
                VStack(spacing: Theme.Spacing.s2) {
                    ForEach(stages) { stage in
                        stageTile(stage)
                    }
                }
                note
                if case .forbidden = state {
                    hintBox(
                        icon: "lock.fill",
                        tint: Theme.Colors.info,
                        background: Theme.Colors.infoSoft,
                        title: "finance.dunning.forbidden.title",
                        message: "finance.dunning.forbidden.message"
                    )
                }
                if case .error(let message) = state {
                    errorBox(message)
                }
                RSMPrimaryButton(
                    title: "finance.dunning.preview",
                    isLoading: state == .running,
                    action: onPreview
                )
                .accessibilityLabel(Text("finance.a11y.dunningRun"))
            }
        }
    }

    // MARK: - Zeitleisten-Kachel

    private func stageTile(_ stage: Stage) -> some View {
        HStack(spacing: Theme.Spacing.s3) {
            RoundedRectangle(cornerRadius: 2, style: .continuous)
                .fill(stage.color)
                .frame(width: 4)
                .frame(maxHeight: .infinity)
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 2) {
                Text(stage.day)
                    .font(Theme.Fonts.mono(size: 12, weight: .semibold))
                    .monospacedDigit()
                    .foregroundStyle(Theme.Colors.inkFaint)
                Text(stage.title)
                    .font(Theme.Fonts.bodyStrong)
                    .foregroundStyle(Theme.Colors.inkPrimary)
                Text(stage.mode)
                    .font(Theme.Fonts.caption)
                    .foregroundStyle(Theme.Colors.inkSoft)
            }
            Spacer(minLength: 0)
        }
        .padding(Theme.Spacing.s3)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Colors.bgCanvas)
        .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.l, style: .continuous))
        .accessibilityElement(children: .combine)
    }

    // MARK: - Mikrocopy & Hinweise

    private var note: some View {
        HStack(alignment: .top, spacing: Theme.Spacing.s2) {
            Image(systemName: "hand.raised.fill")
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(Theme.Colors.info)
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: Theme.Spacing.s1) {
                Text("finance.dunning.note1")
                    .font(Theme.Fonts.caption)
                    .foregroundStyle(Theme.Colors.inkSoft)
                Text("finance.dunning.note2")
                    .font(Theme.Fonts.caption)
                    .foregroundStyle(Theme.Colors.inkFaint)
            }
        }
        .accessibilityElement(children: .combine)
    }

    private func hintBox(
        icon: String,
        tint: Color,
        background: Color,
        title: LocalizedStringKey,
        message: LocalizedStringKey
    ) -> some View {
        HStack(alignment: .top, spacing: Theme.Spacing.s3) {
            Image(systemName: icon)
                .foregroundStyle(tint)
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: Theme.Spacing.s1) {
                Text(title)
                    .font(Theme.Fonts.bodyStrong)
                    .foregroundStyle(tint)
                Text(message)
                    .font(Theme.Fonts.caption)
                    .foregroundStyle(Theme.Colors.inkSoft)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(Theme.Spacing.s4)
        .background(background)
        .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.l, style: .continuous))
        .accessibilityElement(children: .combine)
    }

    private func errorBox(_ message: String) -> some View {
        HStack(alignment: .top, spacing: Theme.Spacing.s3) {
            Image(systemName: "exclamationmark.triangle.fill")
                .foregroundStyle(Theme.Colors.danger)
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: Theme.Spacing.s1) {
                Text("finance.dunning.error.title")
                    .font(Theme.Fonts.bodyStrong)
                    .foregroundStyle(Theme.Colors.danger)
                Text(verbatim: message)
                    .font(Theme.Fonts.caption)
                    .foregroundStyle(Theme.Colors.inkSoft)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(Theme.Spacing.s4)
        .background(Theme.Colors.dangerSoft)
        .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.l, style: .continuous))
        .accessibilityElement(children: .combine)
    }
}
