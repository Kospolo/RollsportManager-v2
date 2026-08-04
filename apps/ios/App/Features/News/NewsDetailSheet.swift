import SwiftUI

/// Detail-Ansicht einer Neuigkeit als Sheet: Chips, Autor mit Avatar,
/// Datum + relative Angabe, vollständiger Text (Zeilenumbrüche erhalten).
/// Für den Trainerstab (`model.canWrite`) trägt der Fuß zusätzlich
/// „Bearbeiten“ (öffnet `EditNewsSheet`) und „Löschen“ (Bestätigungsdialog) —
/// die Durchsetzung bleibt am Server (403 → Alert). Web-Referenz:
/// news/_components/NewsDetailSheet.tsx.
struct NewsDetailSheet: View {
    let news: News
    /// Aufgelöster Autorenname; `nil` → „Unbekannt“.
    let authorName: String?
    let api: APIClient
    @ObservedObject var model: NewsViewModel
    @Environment(\.dismiss) private var dismiss

    @State private var isEditing = false
    @State private var showDeleteConfirm = false
    @State private var isDeleting = false
    @State private var actionError: String?

    /// Immer den aktuellsten Stand aus der Liste zeigen — nach dem Bearbeiten
    /// spiegelt sich die Änderung so sofort in diesem Sheet (der Übergabewert
    /// ist nur ein Schnappschuss). Fällt die Nachricht aus der Liste (gelöscht),
    /// bleibt der Schnappschuss stehen, bis das Sheet schließt.
    private var current: News {
        model.items.first { $0.id == news.id } ?? news
    }

    private var authorDisplay: String {
        authorName ?? String(localized: "news.author.unknown")
    }

    private var displayIso: String { current.publishedAt ?? current.createdAt }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: Theme.Spacing.cardGap) {
                    RSMCard {
                        VStack(alignment: .leading, spacing: Theme.Spacing.s4) {
                            header
                            if current.isPinned || current.publishedAt == nil {
                                NewsBadges(news: current)
                            }
                            authorRow
                            Divider().overlay(Theme.Colors.line)
                            Text(verbatim: current.body)
                                .font(Theme.Fonts.body)
                                .foregroundStyle(Theme.Colors.inkPrimary)
                                .frame(maxWidth: .infinity, alignment: .leading)
                        }
                    }
                    if model.canWrite {
                        managementActions
                    }
                }
                .padding(Theme.Spacing.s5)
            }
            .background(Theme.Colors.bgCanvas.ignoresSafeArea())
            .navigationTitle(Text("news.detail.title"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("news.detail.close") { dismiss() }
                        .tint(Theme.Colors.inkSoft)
                }
            }
            .sheet(isPresented: $isEditing) {
                EditNewsSheet(
                    api: api,
                    news: current,
                    onSaved: { model.replace(updated: $0) }
                )
            }
            .confirmationDialog(
                Text(verbatim: "Diese Nachricht wirklich löschen?"),
                isPresented: $showDeleteConfirm,
                titleVisibility: .visible
            ) {
                Button(role: .destructive) { performDelete() } label: {
                    Text(verbatim: "Löschen")
                }
                Button(role: .cancel) {} label: { Text(verbatim: "Abbrechen") }
            } message: {
                Text(verbatim: "Sie wird für alle Mitglieder vom Schwarzen Brett entfernt. Das lässt sich nicht rückgängig machen.")
            }
            .alert("news.error.title", isPresented: actionErrorBinding) {
                Button("news.error.ok", role: .cancel) {}
            } message: {
                Text(verbatim: actionError ?? "")
            }
        }
        .presentationDragIndicator(.visible)
    }

    // MARK: - Trainer-Aktionen (Bearbeiten · Löschen)

    private var managementActions: some View {
        VStack(spacing: Theme.Spacing.s3) {
            RSMSecondaryButton(title: "Bearbeiten") { isEditing = true }
                .disabled(isDeleting)
            Button(role: .destructive) { showDeleteConfirm = true } label: {
                HStack(spacing: Theme.Spacing.s2) {
                    if isDeleting { ProgressView().tint(Theme.Colors.danger) }
                    Text(verbatim: "Löschen")
                        .font(Theme.Fonts.bodyStrong)
                }
                .frame(maxWidth: .infinity, minHeight: Theme.Size.touchTarget)
                .foregroundStyle(Theme.Colors.danger)
            }
            .buttonStyle(RSMPressableButtonStyle())
            .disabled(isDeleting)
        }
    }

    private func performDelete() {
        guard !isDeleting else { return }
        isDeleting = true
        _Concurrency.Task {
            do {
                try await model.delete(newsId: current.id)
                dismiss()
            } catch {
                actionError = error.isForbiddenAPIError
                    ? NSLocalizedString("news.form.error.forbidden", comment: "403 beim Löschen")
                    : ((error as? APIError)?.errorDescription ?? error.localizedDescription)
            }
            isDeleting = false
        }
    }

    private var actionErrorBinding: Binding<Bool> {
        Binding(
            get: { actionError != nil },
            set: { if !$0 { actionError = nil } }
        )
    }

    // MARK: - Kopf & Autor

    private var header: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.s1) {
            Text("news.detail.eyebrow")
                .font(Theme.Fonts.eyebrow)
                .tracking(Theme.Fonts.eyebrowTracking)
                .textCase(.uppercase)
                .foregroundStyle(Theme.Colors.inkFaint)
            Text(verbatim: current.title)
                .font(Theme.Fonts.h3)
                .foregroundStyle(Theme.Colors.inkPrimary)
        }
        .accessibilityElement(children: .combine)
    }

    private var authorRow: some View {
        HStack(spacing: Theme.Spacing.s3) {
            RSMAvatarView(name: authorDisplay, personId: current.authorMemberId, size: 36)
            VStack(alignment: .leading, spacing: 2) {
                Text(verbatim: authorDisplay)
                    .font(Theme.Fonts.bodyStrong)
                    .foregroundStyle(Theme.Colors.inkPrimary)
                Text(verbatim: "\(NewsDate.absolute(displayIso)) · \(NewsDate.relativeText(displayIso))")
                    .font(Theme.Fonts.caption)
                    .foregroundStyle(Theme.Colors.inkSoft)
            }
            Spacer(minLength: 0)
        }
    }
}
