import SwiftUI

/// ÖFFENTLICHE ROOT-VIEW der Vereins-Einstellungen (Verwaltung → Verein).
/// Lädt den Verein, entscheidet die Sichtbarkeit und rendert für owner/admin
/// das editierbare Formular (`AdminClubSettingsForm`), für alle anderen die
/// Nur-Ansicht. Läuft im NavigationStack des „Mehr"-Tabs; `SessionStore` kommt
/// aus dem Environment. Web-Referenz-UX: verwaltung/verein.
///
/// Stabiler Aufrufpunkt bleibt `ClubSettingsRootView` (Shared/Root, read-only):
/// dessen Body wird bei der Einhängung durch `AdminClubSettingsView()` ersetzt.
struct AdminClubSettingsView: View {
    @EnvironmentObject private var session: SessionStore
    @StateObject private var model = AdminClubSettingsViewModel()

    /// owner/admin dürfen editieren (Web `canEdit`); der Server bleibt Autorität.
    private var canEdit: Bool { session.permissions.canManageClubSettings }

    var body: some View {
        Group {
            switch model.state {
            case .loading:
                loadingView
            case .error(let message):
                errorView(message)
            case .loaded:
                if canEdit {
                    AdminClubSettingsForm(model: model) {
                        _Concurrency.Task { await model.save(api: session.api) }
                    }
                } else if let club = model.club {
                    AdminClubReadOnlyView(club: club)
                }
            }
        }
        .background(Theme.Colors.bgCanvas.ignoresSafeArea())
        .navigationTitle(Text("verein.title"))
        .navigationBarTitleDisplayMode(.large)
        .task {
            await model.loadIfNeeded(api: session.api, clubId: session.clubId)
        }
        .alert("verein.saved.title", isPresented: $model.showSavedAlert) {
            Button("verein.alert.ok", role: .cancel) {}
        } message: {
            Text("verein.saved.message")
        }
        .alert("verein.error.title", isPresented: saveErrorBinding) {
            Button("verein.alert.ok", role: .cancel) {}
        } message: {
            Text(verbatim: model.saveError ?? "")
        }
    }

    // MARK: - Zustände

    private var loadingView: some View {
        VStack(spacing: Theme.Spacing.s4) {
            ProgressView()
                .tint(Theme.Colors.brand)
            Text("verein.loading")
                .font(Theme.Fonts.body)
                .foregroundStyle(Theme.Colors.inkSoft)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private func errorView(_ message: String) -> some View {
        ScrollView {
            RSMCard {
                VStack(spacing: Theme.Spacing.s4) {
                    Image(systemName: "wifi.exclamationmark")
                        .font(.system(size: 40, weight: .medium))
                        .foregroundStyle(Theme.Colors.danger)
                        .accessibilityHidden(true)
                    Text("verein.load.errorTitle")
                        .font(Theme.Fonts.h3)
                        .foregroundStyle(Theme.Colors.inkPrimary)
                    Text(verbatim: message)
                        .font(Theme.Fonts.body)
                        .foregroundStyle(Theme.Colors.inkSoft)
                        .multilineTextAlignment(.center)
                    RSMPrimaryButton(title: "verein.retry") {
                        _Concurrency.Task { await model.retry() }
                    }
                    .fixedSize()
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, Theme.Spacing.s4)
            }
            .padding(Theme.Spacing.s5)
        }
    }

    // MARK: - Helfer

    private var saveErrorBinding: Binding<Bool> {
        Binding(
            get: { model.saveError != nil },
            set: { if !$0 { model.saveError = nil } }
        )
    }
}
