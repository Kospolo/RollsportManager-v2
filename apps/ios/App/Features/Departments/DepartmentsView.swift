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
    @State private var route: DepartmentSheetRoute?

    /// Vereins-Admins legen Abteilungen an, bearbeiten/löschen sie und pflegen
    /// die Mitglieder — die verbindliche Prüfung bleibt serverseitig (403 →
    /// Alert). Für alle anderen bleibt die Ansicht rein lesend.
    private var canManage: Bool { session.permissions.isClubAdmin }

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
        .toolbar {
            if canManage, viewModel.state == .loaded {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        route = .create
                    } label: {
                        Image(systemName: "plus")
                    }
                    .tint(Theme.Colors.brand)
                    .accessibilityLabel(Text(verbatim: "Abteilung anlegen"))
                }
            }
        }
        .sheet(item: $route) { route in
            sheet(for: route)
        }
        .alert(Text(verbatim: "Aktion fehlgeschlagen"), isPresented: actionErrorBinding) {
            Button(role: .cancel) { } label: { Text(verbatim: "OK") }
        } message: {
            Text(verbatim: viewModel.actionError ?? "")
        }
        .task { await viewModel.loadIfNeeded(api: session.api, clubId: session.clubId) }
    }

    // MARK: - Sheets

    @ViewBuilder
    private func sheet(for route: DepartmentSheetRoute) -> some View {
        switch route {
        case .create:
            DepartmentFormSheet(
                mode: .create,
                members: viewModel.allMembers,
                api: session.api,
                clubId: session.clubId,
                onSaved: { viewModel.upsert($0) }
            )
        case .edit(let department):
            DepartmentFormSheet(
                mode: .edit(department),
                members: viewModel.allMembers,
                api: session.api,
                clubId: session.clubId,
                onSaved: { viewModel.upsert($0) }
            )
        case .members(let department):
            DepartmentMembersSheet(
                department: department,
                members: viewModel.allMembers,
                api: session.api,
                onSaved: { viewModel.upsert($0) }
            )
        }
    }

    private var actionErrorBinding: Binding<Bool> {
        Binding(
            get: { viewModel.actionError != nil },
            set: { if !$0 { viewModel.actionError = nil } }
        )
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
                        message: "abteilungen.empty.message",
                        actionTitle: canManage ? "Abteilung anlegen" : nil,
                        action: canManage ? { route = .create } : nil
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

/// Sheet-Routen der Abteilungs-Verwaltung (ohne Identifiable-Konformanz auf dem
/// Contracts-Typ `Department`, um Kollisionen zwischen Feature-Modulen zu
/// vermeiden). Wird von der Liste und dem Detail geteilt.
enum DepartmentSheetRoute: Identifiable {
    case create
    case edit(Department)
    case members(Department)

    var id: String {
        switch self {
        case .create: "create"
        case .edit(let department): "edit-\(department.id)"
        case .members(let department): "members-\(department.id)"
        }
    }
}
