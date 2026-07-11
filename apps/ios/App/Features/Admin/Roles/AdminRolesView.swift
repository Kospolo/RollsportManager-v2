import SwiftUI

/// Root-View „Rollen & Rechte“ (Verwaltung). Zeigt die vollständige
/// Rechte-Matrix (7 Rollen × Fähigkeiten) als lesbare Tabelle und darunter die
/// Rollen-Schnellzuweisung mit Hierarchie-Gating. Ein deutlicher Hinweis stellt
/// klar, dass die Rechte serverseitig durchgesetzt werden.
///
/// Stabiler Aufrufpunkt für den Verwaltungs-Hub / Deeplink `verw-rollen`
/// (ersetzt den `ModuleScaffoldView`-Platzhalter in `RolesRootView`). Erwartet
/// den `SessionStore` im Environment und einen umgebenden `NavigationStack`.
/// Web-Referenz: apps/web/app/(portal)/verwaltung/rollen.
struct AdminRolesView: View {
    @EnvironmentObject private var session: SessionStore
    @StateObject private var viewModel = RolesViewModel()

    var body: some View {
        Group {
            switch viewModel.state {
            case .idle, .loading:
                loadingView
            case .failed(let message):
                errorView(message)
            case .loaded:
                content
            }
        }
        .background(Theme.Colors.bgCanvas.ignoresSafeArea())
        .navigationTitle(Text("verwaltung.tile.roles.title"))
        .navigationBarTitleDisplayMode(.large)
        .task { await viewModel.loadIfNeeded(api: session.api, clubId: session.clubId) }
        .alert(
            "rollen.change.failed.title",
            isPresented: failureBinding,
            presenting: viewModel.roleChangeFailure
        ) { _ in
            Button("rollen.alert.ok", role: .cancel) { viewModel.roleChangeFailure = nil }
        } message: { failure in
            switch failure {
            case .forbidden: Text("rollen.change.forbidden")
            case .other(let message): Text(verbatim: message)
            }
        }
    }

    // MARK: - Inhalt

    private var content: some View {
        ScrollView {
            VStack(spacing: Theme.Spacing.cardGap) {
                RolesMatrixView()
                RolesAssignmentSection(
                    members: viewModel.members,
                    perms: session.permissions,
                    selfMemberId: session.session?.profile.memberId,
                    isChanging: viewModel.isChangingRole,
                    onChange: { member, role in
                        _Concurrency.Task {
                            await viewModel.changeRole(
                                of: member,
                                to: role,
                                api: session.api,
                                clubId: session.clubId
                            )
                        }
                    }
                )
                serverNoteCard
            }
            .padding(Theme.Spacing.s5)
        }
        .refreshable { await viewModel.load(api: session.api, clubId: session.clubId) }
    }

    /// „Rechte gelten serverseitig“ — macht die Anzeige-Natur der Matrix ehrlich.
    private var serverNoteCard: some View {
        RSMCard {
            HStack(alignment: .top, spacing: Theme.Spacing.s3) {
                Image(systemName: "checkmark.shield.fill")
                    .font(.system(size: 22, weight: .semibold))
                    .foregroundStyle(Theme.Colors.success)
                    .accessibilityHidden(true)
                VStack(alignment: .leading, spacing: Theme.Spacing.s1) {
                    Text("rollen.server.eyebrow")
                        .font(Theme.Fonts.eyebrow)
                        .tracking(Theme.Fonts.eyebrowTracking)
                        .textCase(.uppercase)
                        .foregroundStyle(Theme.Colors.inkFaint)
                    Text("rollen.server.title")
                        .font(Theme.Fonts.h3)
                        .foregroundStyle(Theme.Colors.inkPrimary)
                    Text("rollen.server.body")
                        .font(Theme.Fonts.caption)
                        .foregroundStyle(Theme.Colors.inkSoft)
                }
            }
        }
    }

    // MARK: - Zustände

    private var loadingView: some View {
        VStack(spacing: Theme.Spacing.s4) {
            ProgressView().tint(Theme.Colors.brand)
            Text("rollen.loading")
                .font(Theme.Fonts.body)
                .foregroundStyle(Theme.Colors.inkSoft)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    /// Fehlerkarte mit Klartext (APIError.errorDescription) + Retry.
    private func errorView(_ message: String) -> some View {
        ScrollView {
            RSMCard {
                VStack(spacing: Theme.Spacing.s4) {
                    Image(systemName: "wifi.exclamationmark")
                        .font(.system(size: 40, weight: .medium))
                        .foregroundStyle(Theme.Colors.danger)
                        .accessibilityHidden(true)
                    VStack(spacing: Theme.Spacing.s2) {
                        Text("rollen.error.title")
                            .font(Theme.Fonts.h3)
                            .foregroundStyle(Theme.Colors.inkPrimary)
                            .multilineTextAlignment(.center)
                        Text(verbatim: message)
                            .font(Theme.Fonts.caption)
                            .foregroundStyle(Theme.Colors.inkSoft)
                            .multilineTextAlignment(.center)
                    }
                    RSMPrimaryButton(title: "rollen.error.retry") {
                        _Concurrency.Task {
                            await viewModel.load(api: session.api, clubId: session.clubId)
                        }
                    }
                    .fixedSize()
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, Theme.Spacing.s4)
            }
            .padding(Theme.Spacing.s5)
        }
    }

    private var failureBinding: Binding<Bool> {
        Binding(
            get: { viewModel.roleChangeFailure != nil },
            set: { if !$0 { viewModel.roleChangeFailure = nil } }
        )
    }
}
