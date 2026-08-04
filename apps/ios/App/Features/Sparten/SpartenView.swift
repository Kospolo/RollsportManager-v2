import SwiftUI

/// Sparten-Verwaltung: Karten-Liste der fachlichen Großbereiche des Vereins
/// (z. B. Rollkunstlauf, Eiskunstlauf). Lesen darf jedes Mitglied; Anlegen/
/// Bearbeiten/(De-)Aktivieren/Löschen nur für Berechtigte (`canManage` =
/// can_manage_sparten). Die Verwaltungs-Aktionen werden für Unberechtigte
/// AUSGEBLENDET — die verbindliche Durchsetzung bleibt serverseitig (403 →
/// Alert). Läuft im NavigationStack des „Mehr"-Tabs.
/// Web-Referenz-UX: apps/web/app/(portal)/sparten.
struct SpartenView: View {
    @EnvironmentObject private var session: SessionStore
    @StateObject private var model = SpartenViewModel()
    @State private var route: SpartenSheetRoute?
    @State private var sparteToDelete: Sparte?

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
        .navigationTitle(Text("sparten.title"))
        .navigationBarTitleDisplayMode(.large)
        .toolbar {
            if model.canManage, model.state == .loaded {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        route = .create
                    } label: {
                        Image(systemName: "plus")
                    }
                    .tint(Theme.Colors.brand)
                    .accessibilityLabel(Text("sparten.new.a11y"))
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
            Text("sparten.delete.title"),
            isPresented: deleteConfirmBinding,
            titleVisibility: .visible,
            presenting: sparteToDelete
        ) { sparte in
            Button(role: .destructive) {
                _Concurrency.Task { _ = await model.delete(sparte) }
            } label: {
                Text("sparten.delete.confirm")
            }
            Button("sparten.delete.cancel", role: .cancel) {}
        } message: { sparte in
            Text("sparten.delete.message \(sparte.name)")
        }
        .alert("sparten.error.title", isPresented: alertBinding) {
            Button("sparten.error.ok", role: .cancel) {}
        } message: {
            Text(verbatim: model.alertMessage ?? "")
        }
    }

    // MARK: - Sheets

    @ViewBuilder
    private func sheet(for route: SpartenSheetRoute) -> some View {
        switch route {
        case .create:
            SparteFormSheet(
                mode: .create,
                api: session.api,
                clubId: session.clubId,
                onSaved: { model.upsert($0) }
            )
        case .edit(let sparte):
            SparteFormSheet(
                mode: .edit(sparte),
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
            Text("sparten.loading")
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
                    Text("sparten.error.load.title")
                        .font(Theme.Fonts.h3)
                        .foregroundStyle(Theme.Colors.inkPrimary)
                    Text(verbatim: message)
                        .font(Theme.Fonts.body)
                        .foregroundStyle(Theme.Colors.inkSoft)
                        .multilineTextAlignment(.center)
                    RSMPrimaryButton(title: "sparten.error.retry") {
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
                if model.sparten.isEmpty {
                    emptyState
                } else {
                    Text("sparten.subtitle")
                        .font(Theme.Fonts.caption)
                        .foregroundStyle(Theme.Colors.inkSoft)
                        .padding(.horizontal, Theme.Spacing.s1)
                    LazyVStack(spacing: Theme.Spacing.cardGap) {
                        ForEach(model.sparten, id: \.id) { sparte in
                            SparteCardView(
                                sparte: sparte,
                                memberCount: sparte.memberIds.count,
                                teamCount: model.teamCount(for: sparte),
                                canManage: model.canManage,
                                isBusy: model.busyId == sparte.id,
                                onEdit: { route = .edit(sparte) },
                                onToggleActive: {
                                    _Concurrency.Task { await model.toggleActive(sparte) }
                                },
                                onDelete: { sparteToDelete = sparte }
                            )
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
                systemImage: model.canManage ? "sparkles" : "lock",
                title: "sparten.empty.title",
                message: model.canManage ? "sparten.empty.message" : "sparten.empty.readonly",
                actionTitle: model.canManage ? "sparten.empty.cta" : nil,
                action: model.canManage ? { route = .create } : nil
            )
        }
    }

    // MARK: - Bindings

    private var deleteConfirmBinding: Binding<Bool> {
        Binding(
            get: { sparteToDelete != nil },
            set: { if !$0 { sparteToDelete = nil } }
        )
    }

    private var alertBinding: Binding<Bool> {
        Binding(
            get: { model.alertMessage != nil },
            set: { if !$0 { model.alertMessage = nil } }
        )
    }

#if DEBUG
    /// NUR DEBUG/Smoke-Test: `-devSpartenOpenCreate YES` öffnet nach dem Laden
    /// das „Sparte anlegen"-Sheet (für Screenshots). Ohne Flag passiert nichts.
    private func applyDevHooks() {
        if UserDefaults.standard.bool(forKey: "devSpartenOpenCreate"), model.canManage {
            route = .create
        }
    }
#endif
}

/// Sheet-Routen der Sparten-Verwaltung (ohne Identifiable-Konformanz auf dem
/// Contracts-Typ `Sparte`, um Kollisionen zwischen Feature-Modulen zu vermeiden).
enum SpartenSheetRoute: Identifiable {
    case create
    case edit(Sparte)

    var id: String {
        switch self {
        case .create: "create"
        case .edit(let sparte): "edit-\(sparte.id)"
        }
    }
}
