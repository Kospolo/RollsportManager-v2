import SwiftUI

/// ÖFFENTLICHE ROOT-VIEW der Teams-Verwaltung (Verwaltung › Teams): alle Teams
/// als Karten mit Anlegen, Umbenennen, Kader-Zuordnung und (bestätigtem)
/// Löschen. Schreibaktionen nur für is_club_admin (moderator/admin/owner) —
/// die Durchsetzung bleibt serverseitig (403 → Alert). Läuft im
/// NavigationStack des „Mehr“-Tabs; `SessionStore` kommt aus dem Environment.
/// Web-Referenz-UX: apps/web/app/(portal)/verwaltung/teams.
struct AdminTeamsView: View {
    @EnvironmentObject private var session: SessionStore
    @StateObject private var model = AdminTeamsViewModel()
    @State private var route: TeamsSheetRoute?
    @State private var teamToDelete: Team?

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
        .navigationTitle(Text("teams.title"))
        .navigationBarTitleDisplayMode(.large)
        .toolbar {
            if model.canManage {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        route = .create
                    } label: {
                        Image(systemName: "plus")
                    }
                    .tint(Theme.Colors.brand)
                    .accessibilityLabel(Text("teams.new.a11y"))
                }
            }
        }
        .task {
            await model.loadIfNeeded(
                api: session.api,
                clubId: session.clubId,
                clubRole: session.session?.profile.clubRole
            )
#if DEBUG
            applyDevHooks()
#endif
        }
        .sheet(item: $route) { route in
            sheet(for: route)
        }
        .confirmationDialog(
            Text("teams.delete.title"),
            isPresented: deleteConfirmBinding,
            titleVisibility: .visible,
            presenting: teamToDelete
        ) { team in
            Button(role: .destructive) {
                _Concurrency.Task { _ = await model.delete(team) }
            } label: {
                Text("teams.delete.confirm")
            }
            Button("teams.delete.cancel", role: .cancel) {}
        } message: { team in
            Text("teams.delete.message \(team.name)")
        }
        .alert("teams.error.title", isPresented: alertBinding) {
            Button("teams.error.ok", role: .cancel) {}
        } message: {
            Text(verbatim: model.alertMessage ?? "")
        }
    }

    // MARK: - Sheets

    @ViewBuilder
    private func sheet(for route: TeamsSheetRoute) -> some View {
        switch route {
        case .create:
            TeamFormSheet(
                mode: .create,
                api: session.api,
                clubId: session.clubId,
                sparten: model.canManageSparten ? model.sparten : [],
                onSaved: { model.upsert($0) }
            )
        case .edit(let team):
            TeamFormSheet(
                mode: .edit(team),
                api: session.api,
                clubId: session.clubId,
                sparten: model.canManageSparten ? model.sparten : [],
                onSaved: { model.upsert($0) }
            )
        case .roster(let team):
            TeamRosterSheet(
                team: team,
                members: model.members,
                initialRoles: model.initialRoles(of: team),
                api: session.api,
                clubId: session.clubId,
                onSaved: { model.upsert($0) }
            )
        }
    }

    // MARK: - Zustände

    private var loadingView: some View {
        VStack(spacing: Theme.Spacing.s4) {
            ProgressView().tint(Theme.Colors.brand)
            Text("teams.loading")
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
                    Text("teams.error.title")
                        .font(Theme.Fonts.h3)
                        .foregroundStyle(Theme.Colors.inkPrimary)
                    Text(verbatim: message)
                        .font(Theme.Fonts.body)
                        .foregroundStyle(Theme.Colors.inkSoft)
                        .multilineTextAlignment(.center)
                    RSMPrimaryButton(title: "teams.error.retry") {
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

    // MARK: - Liste

    private var listView: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Theme.Spacing.cardGap) {
                if model.teams.isEmpty {
                    emptyState
                } else {
                    Text("teams.count \(model.teams.count)")
                        .font(Theme.Fonts.eyebrow)
                        .tracking(Theme.Fonts.eyebrowTracking)
                        .textCase(.uppercase)
                        .foregroundStyle(Theme.Colors.inkFaint)
                        .padding(.leading, Theme.Spacing.s1)
                    ForEach(model.teams, id: \.id) { team in
                        TeamCardView(
                            team: team,
                            roster: model.roster(of: team),
                            sparte: model.sparte(of: team),
                            canManage: model.canManage,
                            onRoster: { route = .roster(team) },
                            onEdit: { route = .edit(team) },
                            onDelete: { teamToDelete = team }
                        )
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
                systemImage: model.canManage ? "person.3" : "lock",
                title: "teams.empty.title",
                message: model.canManage ? "teams.empty.message" : "teams.empty.readonly",
                actionTitle: model.canManage ? "teams.empty.cta" : nil,
                action: model.canManage ? { route = .create } : nil
            )
        }
    }

    // MARK: - Bindings

    private var deleteConfirmBinding: Binding<Bool> {
        Binding(
            get: { teamToDelete != nil },
            set: { if !$0 { teamToDelete = nil } }
        )
    }

    private var alertBinding: Binding<Bool> {
        Binding(
            get: { model.alertMessage != nil },
            set: { if !$0 { model.alertMessage = nil } }
        )
    }

#if DEBUG
    /// NUR DEBUG/Smoke-Test: `-devTeamsOpenCreate YES` öffnet nach dem Laden das
    /// „Team anlegen“-Sheet (für Screenshots). Ohne das Flag passiert nichts.
    private func applyDevHooks() {
        if UserDefaults.standard.bool(forKey: "devTeamsOpenCreate"), model.canManage {
            route = .create
        }
    }
#endif
}

/// Sheet-Routen der Teams-Verwaltung (ohne Identifiable-Konformanz auf dem
/// Contracts-Typ `Team`, um Kollisionen zwischen parallelen Feature-Teams zu
/// vermeiden).
enum TeamsSheetRoute: Identifiable {
    case create
    case edit(Team)
    case roster(Team)

    var id: String {
        switch self {
        case .create: "create"
        case .edit(let team): "edit-\(team.id)"
        case .roster(let team): "roster-\(team.id)"
        }
    }
}
