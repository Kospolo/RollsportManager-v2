import SwiftUI

/// ÖFFENTLICHE ROOT-VIEW des Wettkampf-Features: Liste kommender (und
/// vergangener) Wettkämpfe als Karten — Datum, Ort, Meldeschluss und gemeldete
/// Starter/Küren. Tippen öffnet das Detail mit Startliste je Kategorie und der
/// Live-Rangliste (`getCompetitionStandings`). Läuft im NavigationStack des
/// „Mehr“-Tabs; `SessionStore` kommt aus dem Environment.
/// Web-Referenz-UX: apps/web/app/(portal)/wettkampf.
struct CompetitionsView: View {
    @EnvironmentObject private var session: SessionStore
    @StateObject private var model = CompetitionsViewModel()
    @State private var showCreate = false
    @State private var manageTarget: CompetitionEditTarget?
#if DEBUG
    @State private var devDetail: CompetitionDetailTarget?
#endif

    var body: some View {
        Group {
            switch model.state {
            case .loading:
                loadingView
            case .error(let message):
                errorView(message)
            case .loaded:
                listView
            }
        }
        .background(Theme.Colors.bgCanvas.ignoresSafeArea())
        .navigationTitle(Text("wettkampf.title"))
        .navigationBarTitleDisplayMode(.large)
        .toolbar {
            if session.permissions.isClubAdmin {
                ToolbarItem(placement: .primaryAction) {
                    Button { showCreate = true } label: { Image(systemName: "plus") }
                        .accessibilityLabel(Text(verbatim: "Neuer Wettkampf"))
                }
            }
        }
        .sheet(isPresented: $showCreate) {
            CompetitionCreateSheet(api: session.api, clubId: session.clubId) {
                _Concurrency.Task { await model.refresh() }
            }
        }
        .sheet(item: $manageTarget) { target in
            CompetitionManageSheet(model: model, competition: target.competition)
        }
#if DEBUG
        .navigationDestination(item: $devDetail) { target in
            CompetitionDetailView(
                competition: target.competition,
                clubRole: session.session?.profile.clubRole
            )
        }
#endif
        .task {
            await model.loadIfNeeded(api: session.api, clubId: session.clubId)
#if DEBUG
            applyListDevHooks()
#endif
        }
        .alert("wettkampf.error.title", isPresented: refreshErrorBinding) {
            Button("wettkampf.error.ok", role: .cancel) {}
        } message: {
            Text(verbatim: model.refreshErrorMessage ?? "")
        }
    }

#if DEBUG
    /// NUR DEBUG/Smoke: `-devOpenCompetitionDetail YES` pusht nach dem Laden
    /// direkt das Detail des ersten abgeschlossenen (sonst kommenden) Wettkampfs
    /// — damit der Smoke die Live-Rangliste ohne Tap erreicht. Ohne Flag nichts.
    private func applyListDevHooks() {
        guard UserDefaults.standard.bool(forKey: "devOpenCompetitionDetail"),
              let target = model.past.first ?? model.upcoming.first
        else { return }
        devDetail = CompetitionDetailTarget(competition: target)
    }
#endif

    // MARK: - Zustände

    private var loadingView: some View {
        VStack(spacing: Theme.Spacing.s4) {
            ProgressView()
                .tint(Theme.Colors.brand)
            Text("wettkampf.loading")
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
                    Text("wettkampf.error.title")
                        .font(Theme.Fonts.h3)
                        .foregroundStyle(Theme.Colors.inkPrimary)
                    Text(verbatim: message)
                        .font(Theme.Fonts.body)
                        .foregroundStyle(Theme.Colors.inkSoft)
                        .multilineTextAlignment(.center)
                    // Die eine Beere dieses Sichtbereichs: erneut laden.
                    RSMPrimaryButton(title: "wettkampf.error.retry") {
                        _Concurrency.Task { await model.retry() }
                    }
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, Theme.Spacing.s4)
            }
            .padding(Theme.Spacing.s5)
        }
    }

    // MARK: - Liste

    private var listView: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Theme.Spacing.cardGap) {
                if model.isEmpty {
                    emptyState
                } else {
                    if !model.upcoming.isEmpty {
                        section(titleKey: "wettkampf.section.upcoming", competitions: model.upcoming)
                    }
                    if !model.past.isEmpty {
                        section(titleKey: "wettkampf.section.past", competitions: model.past)
                    }
                }
            }
            .padding(Theme.Spacing.s5)
        }
        .refreshable { await model.refresh() }
    }

    @ViewBuilder
    private func section(titleKey: LocalizedStringKey, competitions: [Competition]) -> some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.s3) {
            Text(titleKey)
                .font(Theme.Fonts.h3)
                .foregroundStyle(Theme.Colors.inkPrimary)
                .padding(.leading, Theme.Spacing.s1)
            ForEach(competitions, id: \.id) { competition in
                NavigationLink {
                    CompetitionDetailView(
                        competition: competition,
                        clubRole: session.session?.profile.clubRole
                    )
                } label: {
                    CompetitionListCard(competition: competition)
                }
                .buttonStyle(RSMPressableButtonStyle())
                .accessibilityHint(Text("wettkampf.card.a11y.open"))
                .contextMenu {
                    if session.permissions.isClubAdmin {
                        Button {
                            manageTarget = CompetitionEditTarget(competition: competition)
                        } label: {
                            Label { Text(verbatim: "Bearbeiten") } icon: { Image(systemName: "pencil") }
                        }
                    }
                }
            }
        }
    }

    private var emptyState: some View {
        RSMCard {
            RSMEmptyState(
                systemImage: "trophy",
                title: "wettkampf.empty.title",
                message: "wettkampf.empty.message"
            )
        }
    }

    private var refreshErrorBinding: Binding<Bool> {
        Binding(
            get: { model.refreshErrorMessage != nil },
            set: { if !$0 { model.refreshErrorMessage = nil } }
        )
    }
}

/// Identifiable-Wrapper um den zu bearbeitenden Wettkampf — `Competition` selbst
/// ist nicht `Identifiable`, `sheet(item:)` braucht das aber.
private struct CompetitionEditTarget: Identifiable {
    let competition: Competition
    var id: String { competition.id }
}

#if DEBUG
/// Nur für die DEBUG-Smoke-Auto-Navigation (siehe `applyListDevHooks`):
/// Identifiable-Wrapper um den zu öffnenden Wettkampf.
private struct CompetitionDetailTarget: Identifiable, Hashable {
    let competition: Competition
    var id: String { competition.id }

    static func == (lhs: CompetitionDetailTarget, rhs: CompetitionDetailTarget) -> Bool {
        lhs.id == rhs.id
    }
    func hash(into hasher: inout Hasher) { hasher.combine(id) }
}
#endif
