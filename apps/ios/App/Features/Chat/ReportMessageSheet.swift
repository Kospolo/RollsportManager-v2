import SwiftUI

/// „Nachricht melden" als Sheet: meldet eine FREMDE Nachricht als Verstoss an
/// den Vereinsvorstand (und den Betreiber). Melder, IP und ein Snapshot des
/// Textes werden SERVERSEITIG festgehalten (POST /chat/reports) — die UI reicht
/// nur die Nachricht-ID und den Grund weiter. Wird BEWUSST nie automatisch
/// bestätigt; gemeldet wird ausschliesslich über den expliziten „Melden"-Button.
/// Erfolg schliesst das Sheet (die Liste zeigt eine Bestätigung); ein Fehler
/// (inkl. 403/404) bleibt als Klartext stehen und lässt das Sheet offen.
/// Web-Referenz: chat/ReportMessageDialog.tsx.
struct ReportMessageSheet: View {
    let message: ChatMessage
    @ObservedObject var model: ChatThreadViewModel
    let senderName: String

    @Environment(\.dismiss) private var dismiss
    @State private var reason = ""
    @State private var touched = false
    @State private var isSubmitting = false
    @State private var errorText: String?

    private var trimmedReason: String {
        reason.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private var reasonMissing: Bool { touched && trimmedReason.isEmpty }

    /// Textauszug der gemeldeten Nachricht — bei Bild-Nachrichten (kein Text)
    /// ein Platzhalter, damit der Auszug nie leer bleibt.
    private var previewBody: String {
        let text = message.body ?? ""
        return text.isEmpty ? "(Bild ohne Text)" : text
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: Theme.Spacing.cardGap) {
                    RSMCard {
                        VStack(alignment: .leading, spacing: Theme.Spacing.s4) {
                            VStack(alignment: .leading, spacing: Theme.Spacing.s1) {
                                Text(verbatim: "Verstoss melden")
                                    .font(Theme.Fonts.eyebrow)
                                    .tracking(Theme.Fonts.eyebrowTracking)
                                    .textCase(.uppercase)
                                    .foregroundStyle(Theme.Colors.inkFaint)
                                Text(verbatim: "Nachricht melden")
                                    .font(Theme.Fonts.h3)
                                    .foregroundStyle(Theme.Colors.inkPrimary)
                            }
                            Text(verbatim: "Die Meldung geht an den Vereinsvorstand und den Betreiber. Ein Auszug der Nachricht wird dabei gespeichert.")
                                .font(Theme.Fonts.body)
                                .foregroundStyle(Theme.Colors.inkSoft)
                                .fixedSize(horizontal: false, vertical: true)
                            messagePreview
                            reasonField
                        }
                    }
                    submitButton
                }
                .padding(Theme.Spacing.s5)
            }
            .background(Theme.Colors.bgCanvas.ignoresSafeArea())
            .navigationTitle(Text(verbatim: "Nachricht melden"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button {
                        dismiss()
                    } label: {
                        Text(verbatim: "Abbrechen")
                    }
                    .tint(Theme.Colors.inkSoft)
                    .disabled(isSubmitting)
                }
            }
        }
        .presentationDragIndicator(.visible)
    }

    // MARK: - Auszug der gemeldeten Nachricht

    private var messagePreview: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.s1) {
            Text(verbatim: senderName)
                .font(Theme.Fonts.caption.weight(.semibold))
                .foregroundStyle(Theme.Colors.inkSoft)
            Text(verbatim: previewBody)
                .font(Theme.Fonts.body)
                .foregroundStyle(Theme.Colors.inkPrimary)
                .fixedSize(horizontal: false, vertical: true)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(Theme.Spacing.s3)
        .background(Theme.Colors.bgSunken)
        .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.m, style: .continuous))
        .accessibilityElement(children: .combine)
    }

    // MARK: - Grund

    private var reasonField: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.s2) {
            Text(verbatim: "Grund der Meldung")
                .font(Theme.Fonts.bodyStrong)
                .foregroundStyle(Theme.Colors.inkPrimary)
            TextField(text: $reason, axis: .vertical) {
                Text(verbatim: "Was ist an dieser Nachricht ein Verstoss?")
            }
            .textInputAutocapitalization(.sentences)
            .lineLimit(4...6)
            .font(Theme.Fonts.body)
            .foregroundStyle(Theme.Colors.inkPrimary)
            .padding(Theme.Spacing.s3)
            .frame(maxWidth: .infinity, minHeight: Theme.Size.touchTarget, alignment: .topLeading)
            .background(Theme.Colors.bgSunken)
            .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.m, style: .continuous))
            .onChange(of: reason) { errorText = nil }
            .accessibilityLabel(Text(verbatim: "Grund der Meldung"))
            if reasonMissing {
                Text(verbatim: "Bitte gib einen Grund an.")
                    .font(Theme.Fonts.caption.weight(.semibold))
                    .foregroundStyle(Theme.Colors.danger)
            }
            if let errorText {
                Text(verbatim: errorText)
                    .font(Theme.Fonts.caption.weight(.semibold))
                    .foregroundStyle(Theme.Colors.danger)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    // MARK: - Absenden

    private var submitButton: some View {
        Button(action: submit) {
            HStack(spacing: Theme.Spacing.s2) {
                if isSubmitting {
                    ProgressView().tint(.white)
                }
                Text(verbatim: "Melden")
                    .font(Theme.Fonts.bodyStrong)
            }
            .frame(maxWidth: .infinity, minHeight: Theme.Size.touchTarget)
            .foregroundStyle(.white)
            .background(Theme.Colors.danger)
            .clipShape(Capsule())
        }
        .buttonStyle(RSMPressableButtonStyle())
        .disabled(isSubmitting)
        .accessibilityLabel(Text(verbatim: "Nachricht melden"))
    }

    private func submit() {
        touched = true
        guard !trimmedReason.isEmpty, !isSubmitting else { return }
        isSubmitting = true
        _Concurrency.Task {
            defer { isSubmitting = false }
            do {
                try await model.report(message: message, reason: reason)
                dismiss()
            } catch {
                errorText = error.isForbiddenAPIError
                    ? "Du darfst diese Nachricht nicht melden."
                    : ChatThreadViewModel.friendlyMessage(error)
            }
        }
    }
}
