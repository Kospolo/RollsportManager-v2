import SwiftUI

/// LESENDER Team-Bereich für MITGLIEDER (Web-Referenz: /(portal)/teams).
/// Karten-Liste aller Teams des Vereins — eigene Teams zuerst —, Tippen führt
/// auf das Team-Detail mit dem ganzen Kader.
///
/// Bewusst OHNE Verwaltungs-Aktionen: Anlegen/Umbenennen/Kader-Pflege bleiben
/// in der Verwaltung (`AdminTeamsView`, is_club_admin). Hier ist nichts
/// rollen-gegated, weil der Server bereits staffelt, was in den Roster-Zeilen
/// steht. Läuft im NavigationStack des „Mehr"-Tabs.
struct TeamsView: View {
    @EnvironmentObject private var session: SessionStore
    @StateObject private var model = TeamsViewModel()
    /// Die bestehende Mitglieder-Detailseite bringt ihr eigenes ViewModel mit
    /// (Familie, Beitragsampel, Rollenwechsel). Es wird hier mitgeladen, damit
    /// der Sprung aus dem Kader ohne Zwischenladen aufgeht.
    @StateObject private var membersModel = MembersViewModel()
#if DEBUG
    /// Ziel der DEBUG-Smoke-Automation (`-devTeamsOpenFirst`).
    @State private var devRoute: DevTeamRoute?
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
        .navigationTitle(Text("teamsMember.title"))
        .navigationBarTitleDisplayMode(.large)
        .task {
            await model.loadIfNeeded(
                api: session.api,
                clubId: session.clubId,
                myMemberId: session.session?.profile.memberId
            )
            await membersModel.loadIfNeeded(api: session.api, clubId: session.clubId)
#if DEBUG
            applyDevHooks()
#endif
        }
#if DEBUG
        .navigationDestination(item: $devRoute) { route in
            TeamDetailView(teamId: route.id, model: model, membersModel: membersModel)
        }
#endif
        .alert("teamsMember.error.title", isPresented: alertBinding) {
            Button("teamsMember.error.ok", role: .cancel) {}
        } message: {
            Text(verbatim: model.alertMessage ?? "")
        }
    }

    // MARK: - Liste

    private var listView: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Theme.Spacing.cardGap) {
                if model.teams.isEmpty {
                    emptyState
                } else {
                    Text("teamsMember.subtitle")
                        .font(Theme.Fonts.caption)
                        .foregroundStyle(Theme.Colors.inkSoft)
                        .padding(.horizontal, Theme.Spacing.s1)

                    LazyVStack(spacing: Theme.Spacing.cardGap) {
                        ForEach(model.sortedTeams, id: \.id) { team in
                            NavigationLink {
                                TeamDetailView(
                                    teamId: team.id,
                                    model: model,
                                    membersModel: membersModel
                                )
                            } label: {
                                MemberTeamCardView(
                                    team: team,
                                    roster: model.roster(of: team),
                                    sparte: model.sparte(of: team),
                                    isMine: model.isMine(team)
                                )
                            }
                            .buttonStyle(RSMPressableButtonStyle())
                            .accessibilityLabel(Text("teamsMember.card.open.a11y \(team.name)"))
                        }
                    }
                }
            }
            .padding(Theme.Spacing.s5)
        }
        .refreshable { await model.refresh() }
    }

    private var emptyState: some View {
        RSMCard {
            RSMEmptyState(
                systemImage: "person.3",
                title: "teamsMember.empty.title",
                message: "teamsMember.empty.message"
            )
        }
    }

    // MARK: - Zustände

    private var loadingView: some View {
        VStack(spacing: Theme.Spacing.s4) {
            ProgressView().tint(Theme.Colors.brand)
            Text("teamsMember.loading")
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
                    Text("teamsMember.error.load.title")
                        .font(Theme.Fonts.h3)
                        .foregroundStyle(Theme.Colors.inkPrimary)
                    Text(verbatim: message)
                        .font(Theme.Fonts.body)
                        .foregroundStyle(Theme.Colors.inkSoft)
                        .multilineTextAlignment(.center)
                    RSMPrimaryButton(title: "teamsMember.error.retry") {
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

    private var alertBinding: Binding<Bool> {
        Binding(
            get: { model.alertMessage != nil },
            set: { if !$0 { model.alertMessage = nil } }
        )
    }

#if DEBUG
    /// NUR DEBUG/Smoke-Test: `-devTeamsOpenFirst YES` öffnet nach dem Laden das
    /// erste Team (für Screenshots). Ohne Flag passiert nichts.
    private func applyDevHooks() {
        guard UserDefaults.standard.bool(forKey: "devTeamsOpenFirst"),
              let first = model.sortedTeams.first
        else { return }
        devRoute = DevTeamRoute(id: first.id)
    }
#endif
}

#if DEBUG
/// Deep-Link-Ziel der DEBUG-Smoke-Automation (ein Team im lesenden Bereich).
struct DevTeamRoute: Identifiable, Hashable {
    let id: String
}
#endif
