import SwiftUI

/// Root-View des Features „Abteilungen“ (Web-Referenz: /(portal)/abteilungen).
/// Karten-Liste der Vereinsabteilungen mit Name, Beschreibung, Leitung und
/// Mitgliederzahl; Tap auf eine Karte öffnet die Mitglieder-Sicht. Rein lesend.
///
/// Läuft im NavigationStack des „Mehr“-Hubs (kein eigener Stack) — angehängt
/// über `DepartmentsRootView` (`MehrCatalog` + DEBUG-Deeplink).
struct DepartmentsView: View {
    @EnvironmentObject private var session: SessionStore
    @StateObject private var viewModel = DepartmentsViewModel()

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
        .navigationTitle(Text("module.departments.title"))
        .navigationBarTitleDisplayMode(.large)
        .task { await viewModel.loadIfNeeded(api: session.api, clubId: session.clubId) }
    }

    // MARK: - Zustände

    private var loadingView: some View {
        VStack(spacing: Theme.Spacing.s4) {
            ProgressView()
                .tint(Theme.Colors.brand)
            Text("abteilungen.loading")
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
                        Text("abteilungen.error.title")
                            .font(Theme.Fonts.h3)
                            .foregroundStyle(Theme.Colors.inkPrimary)
                            .multilineTextAlignment(.center)
                        Text(verbatim: message)
                            .font(Theme.Fonts.caption)
                            .foregroundStyle(Theme.Colors.inkSoft)
                            .multilineTextAlignment(.center)
                    }
                    RSMPrimaryButton(title: "abteilungen.error.retry") {
                        // `Task` kollidiert mit dem Contract-Typ gleichen Namens
                        // — daher voll qualifiziert `_Concurrency.Task`.
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

    // MARK: - Inhalt

    @ViewBuilder
    private var content: some View {
        if viewModel.departments.isEmpty {
            ScrollView {
                RSMCard {
                    RSMEmptyState(
                        systemImage: "square.grid.2x2",
                        title: "abteilungen.empty.title",
                        message: "abteilungen.empty.message"
                    )
                }
                .padding(Theme.Spacing.s5)
            }
            .refreshable { await viewModel.load(api: session.api, clubId: session.clubId) }
        } else {
            ScrollView {
                LazyVStack(spacing: Theme.Spacing.cardGap) {
                    ForEach(viewModel.departments, id: \.id) { department in
                        NavigationLink {
                            DepartmentDetailView(departmentId: department.id, viewModel: viewModel)
                        } label: {
                            DepartmentCardView(
                                department: department,
                                lead: viewModel.lead(for: department),
                                roster: viewModel.roster(for: department)
                            )
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel(Text("abteilungen.row.a11y \(department.name)"))
                    }
                }
                .padding(Theme.Spacing.s5)
            }
            .refreshable { await viewModel.load(api: session.api, clubId: session.clubId) }
        }
    }
}
