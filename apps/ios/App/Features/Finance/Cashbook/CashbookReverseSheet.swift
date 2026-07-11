import SwiftUI

/// Storno-Bestätigung (GoBD): kein Löschen/Bearbeiten — `reverseLedgerEntry`
/// erzeugt eine Gegenbuchung mit umgekehrtem Vorzeichen; die Originalbuchung
/// bleibt sichtbar. Doppel-/Reversal-Storno beantwortet der Server mit 409 —
/// das wird als ruhiger Klartext gezeigt, NIE als Auto-Bestätigung. Erfolg →
/// schließen. Die eigentliche Aktion ist bewusst diese explizite Bestätigung.
struct CashbookReverseSheet: View {
    let entry: LedgerEntry
    var currency: String = "EUR"
    /// Bucht das Storno (reloadet die Liste); wirft bei Fehlern.
    let submit: (String?) async throws -> Void

    @Environment(\.dismiss) private var dismiss

    @State private var description = ""
    @State private var errorText: String?
    @State private var submitting = false

    private var amountText: String {
        FinanceFormat.amount(cents: entry.amountCents, currency: currency)
    }

    private var dateText: String {
        FinanceFormat.date(entry.entryOn) ?? entry.entryOn
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: Theme.Spacing.s5) {
                    Text("kassenbuch.reverse.intro")
                        .font(Theme.Fonts.body)
                        .foregroundStyle(Theme.Colors.inkSoft)

                    originalCard

                    VStack(alignment: .leading, spacing: Theme.Spacing.s2) {
                        Text("kassenbuch.reverse.descLabel")
                            .font(Theme.Fonts.bodyStrong)
                            .foregroundStyle(Theme.Colors.inkPrimary)
                        TextField("kassenbuch.reverse.descPlaceholder", text: $description, axis: .vertical)
                            .lineLimit(2...4)
                            .font(Theme.Fonts.body)
                            .padding(.horizontal, Theme.Spacing.s3)
                            .padding(.vertical, Theme.Spacing.s2)
                            .frame(minHeight: Theme.Size.touchTarget, alignment: .topLeading)
                            .background(Theme.Colors.bgSunken)
                            .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.m, style: .continuous))
                            .overlay(
                                RoundedRectangle(cornerRadius: Theme.Radius.m, style: .continuous)
                                    .stroke(Theme.Colors.line, lineWidth: 1)
                            )
                        Text("kassenbuch.reverse.descHint")
                            .font(Theme.Fonts.caption)
                            .foregroundStyle(Theme.Colors.inkFaint)
                    }

                    if let errorText {
                        HStack(alignment: .top, spacing: Theme.Spacing.s2) {
                            Image(systemName: "exclamationmark.triangle.fill")
                                .foregroundStyle(Theme.Colors.danger)
                                .accessibilityHidden(true)
                            Text(verbatim: errorText)
                                .font(Theme.Fonts.caption)
                                .foregroundStyle(Theme.Colors.danger)
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(Theme.Spacing.s3)
                        .background(Theme.Colors.dangerSoft)
                        .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.m, style: .continuous))
                    }
                }
                .padding(Theme.Spacing.s5)
            }
            .background(Theme.Colors.bgCanvas.ignoresSafeArea())
            .navigationTitle(Text("kassenbuch.reverse.title"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("kassenbuch.cancel") { dismiss() }
                        .disabled(submitting)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("kassenbuch.reverse.confirm") { confirm() }
                        .disabled(submitting)
                        .fontWeight(.bold)
                        .tint(Theme.Colors.danger)
                }
            }
        }
    }

    private var originalCard: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.s1) {
            Text("kassenbuch.reverse.original")
                .font(Theme.Fonts.eyebrow)
                .tracking(Theme.Fonts.eyebrowTracking)
                .textCase(.uppercase)
                .foregroundStyle(Theme.Colors.inkFaint)
            HStack(alignment: .firstTextBaseline, spacing: Theme.Spacing.s3) {
                Text(verbatim: entry.description)
                    .font(Theme.Fonts.bodyStrong)
                    .foregroundStyle(Theme.Colors.inkPrimary)
                    .lineLimit(2)
                Spacer(minLength: Theme.Spacing.s2)
                Text(verbatim: amountText)
                    .font(Theme.Fonts.monoTable)
                    .monospacedDigit()
                    .foregroundStyle(Theme.Colors.inkPrimary)
            }
            Text(verbatim: dateText)
                .font(Theme.Fonts.caption)
                .monospacedDigit()
                .foregroundStyle(Theme.Colors.inkFaint)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(Theme.Spacing.s4)
        .background(Theme.Colors.bgSunken)
        .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.m, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: Theme.Radius.m, style: .continuous)
                .stroke(Theme.Colors.line, lineWidth: 1)
        )
    }

    // MARK: - Bestätigen

    private func confirm() {
        guard !submitting else { return }
        errorText = nil
        let trimmed = description.trimmingCharacters(in: .whitespacesAndNewlines)
        submitting = true
        _Concurrency.Task {
            do {
                try await submit(trimmed.isEmpty ? nil : trimmed)
                submitting = false
                dismiss()
            } catch {
                submitting = false
                errorText = message(for: error)
            }
        }
    }

    private func message(for error: Error) -> String {
        if case APIError.problem(let problem) = error {
            if problem.status == 403 {
                return String(localized: "kassenbuch.reverse.forbidden")
            }
            if problem.status == 409 {
                let detail = problem.detail ?? ""
                return detail.contains("cannot_reverse_reversal")
                    ? String(localized: "kassenbuch.reverse.cannotReverseReversal")
                    : String(localized: "kassenbuch.reverse.alreadyReversed")
            }
        }
        return (error as? APIError)?.errorDescription ?? error.localizedDescription
    }
}
