import SwiftUI

/// Öffentliche Root-View des Familie-Features (Web-Referenz: /(portal)/familie).
///
/// Zeigt rein lesend die Familienbeziehungen der eingeloggten Person:
/// „Meine Kinder“ und „Eltern & Bezugspersonen“, je mit Avatar, Name, Team und
/// Beziehung. Die Verwaltung (Kind anlegen/verknüpfen/entfernen) bleibt diesem
/// Batch bewusst außen vor. Wird im NavigationStack des „Mehr“-Tabs gepusht.
struct FamilyView: View {
    @EnvironmentObject private var session: SessionStore
    @StateObject private var viewModel = FamilyViewModel()

    /// Eigene Member-ID zum Auflösen der Beziehungen (aus der Dev-Session).
    private var meId: String { session.session?.profile.memberId ?? "" }

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
        .navigationTitle(Text("familie.title"))
        .navigationBarTitleDisplayMode(.large)
        .task { await viewModel.loadIfNeeded(api: session.api, clubId: session.clubId, meId: meId) }
    }

    // MARK: - Zustände

    private var loadingView: some View {
        VStack(spacing: Theme.Spacing.s4) {
            ProgressView()
                .tint(Theme.Colors.brand)
            Text("familie.loading")
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
                        Text("familie.error.title")
                            .font(Theme.Fonts.h3)
                            .foregroundStyle(Theme.Colors.inkPrimary)
                            .multilineTextAlignment(.center)
                        Text(verbatim: message)
                            .font(Theme.Fonts.caption)
                            .foregroundStyle(Theme.Colors.inkSoft)
                            .multilineTextAlignment(.center)
                    }
                    RSMPrimaryButton(title: "familie.error.retry") {
                        // `Task` ist im Modul der Contracts-Struct — daher
                        // voll qualifiziert `_Concurrency.Task`.
                        _Concurrency.Task {
                            await viewModel.load(api: session.api, clubId: session.clubId, meId: meId)
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

    // MARK: - Inhalt

    @ViewBuilder
    private var content: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Theme.Spacing.cardGap) {
                Text("familie.subtitle")
                    .font(Theme.Fonts.body)
                    .foregroundStyle(Theme.Colors.inkSoft)

                if viewModel.isEmpty {
                    RSMCard { emptyState }
                } else {
                    if !viewModel.children.isEmpty {
                        FamilySectionCard(title: "familie.children.title", entries: viewModel.children)
                    }
                    if !viewModel.guardians.isEmpty {
                        FamilySectionCard(title: "familie.guardians.title", entries: viewModel.guardians)
                    }
                    Text("familie.selfserviceHint")
                        .font(Theme.Fonts.caption)
                        .foregroundStyle(Theme.Colors.inkSoft)
                }
            }
            .padding(Theme.Spacing.s5)
        }
        .refreshable {
            await viewModel.load(api: session.api, clubId: session.clubId, meId: meId)
        }
    }

    /// Keine Beziehungen — freundlicher Leerzustand (ohne CTA im lesenden Batch).
    private var emptyState: some View {
        RSMEmptyState(
            systemImage: "figure.2.and.child.holdinghands",
            title: "familie.empty.title",
            message: "familie.empty.message"
        )
    }
}
