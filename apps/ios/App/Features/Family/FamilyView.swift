import SwiftUI

/// Öffentliche Root-View des Familie-Features (Web-Referenz: /(portal)/familie).
///
/// Zeigt die Familienbeziehungen der eingeloggten Person: „Meine Kinder“ und
/// „Eltern & Bezugspersonen“, je mit Avatar, Name, Team und Beziehung. „Meine
/// Kinder“ ist Selfservice: Kind anlegen, ein bestehendes Mitglied als Kind
/// verknüpfen und Verknüpfung entfernen — die Regeln erzwingt der Server
/// (403 ⇒ Klartext-Alert). „Eltern & Bezugspersonen“ bleibt rein lesend.
/// Wird im NavigationStack des „Mehr“-Tabs gepusht.
struct FamilyView: View {
    @EnvironmentObject private var session: SessionStore
    @StateObject private var viewModel = FamilyViewModel()

    /// Eigene Member-ID zum Auflösen der Beziehungen (aus der Dev-Session).
    private var meId: String { session.session?.profile.memberId ?? "" }

    // Schreib-Aktionen (Selfservice): Kind anlegen/verknüpfen + Verknüpfung
    // entfernen. Kein Client-Rechte-Gate — der Server erzwingt die Regeln.
    @State private var showCreate = false
    @State private var showLink = false
    @State private var removeTarget: FamilyViewModel.FamilyMember?
    @State private var actionError: String?

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
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Menu {
                    Button { showCreate = true } label: {
                        Label { Text(verbatim: "Kind anlegen") } icon: { Image(systemName: "person.badge.plus") }
                    }
                    Button { showLink = true } label: {
                        Label { Text(verbatim: "Kind verknüpfen") } icon: { Image(systemName: "link") }
                    }
                } label: {
                    Image(systemName: "plus")
                }
                .accessibilityLabel(Text(verbatim: "Familie verwalten"))
            }
        }
        .sheet(isPresented: $showCreate) {
            FamilyCreateChildSheet(api: session.api, clubId: session.clubId) { created in
                viewModel.addCreatedChild(created)
            }
        }
        .sheet(isPresented: $showLink) {
            FamilyLinkChildSheet(
                api: session.api, clubId: session.clubId, candidates: viewModel.linkCandidates
            ) { guardianship, member in
                viewModel.addLinkedChild(guardianship, member: member)
            }
        }
        .confirmationDialog(
            Text(verbatim: "Verknüpfung entfernen?"),
            isPresented: Binding(get: { removeTarget != nil }, set: { if !$0 { removeTarget = nil } }),
            presenting: removeTarget
        ) { target in
            Button(role: .destructive) {
                removeGuardianship(target)
            } label: {
                Text(verbatim: "Verknüpfung entfernen")
            }
            Button(role: .cancel) { } label: { Text(verbatim: "Abbrechen") }
        } message: { target in
            Text(verbatim: "Die Familien-Verknüpfung zu \(target.member.familyFullName) wird entfernt. Das Mitglied selbst bleibt im Verein bestehen — nur die Zuordnung zu dir wird aufgehoben.")
        }
        .alert(
            Text(verbatim: "Aktion fehlgeschlagen"),
            isPresented: Binding(get: { actionError != nil }, set: { if !$0 { actionError = nil } })
        ) {
            Button { actionError = nil } label: { Text(verbatim: "OK") }
        } message: {
            Text(verbatim: actionError ?? "")
        }
        .task { await viewModel.loadIfNeeded(api: session.api, clubId: session.clubId, meId: meId) }
    }

    /// Verknüpfung entfernen (Server + lokale Zeile) — Fehler als Klartext-Alert.
    private func removeGuardianship(_ target: FamilyViewModel.FamilyMember) {
        _Concurrency.Task {
            do {
                try await viewModel.deleteGuardianship(id: target.id, api: session.api, clubId: session.clubId)
            } catch {
                actionError = (error as? APIError)?.errorDescription ?? error.localizedDescription
            }
        }
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
                        FamilySectionCard(
                            title: "familie.children.title",
                            entries: viewModel.children,
                            onSelect: { removeTarget = $0 }
                        )
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

    /// Keine Beziehungen — freundlicher Leerzustand mit Selfservice-CTAs
    /// (Kind anlegen als Primäraktion, Kind verknüpfen als Zweitaktion).
    private var emptyState: some View {
        VStack(spacing: Theme.Spacing.s4) {
            RSMEmptyState(
                systemImage: "figure.2.and.child.holdinghands",
                title: "familie.empty.title",
                message: "familie.empty.message",
                actionTitle: "Kind anlegen",
                action: { showCreate = true }
            )
            RSMSecondaryButton(title: "Kind verknüpfen") { showLink = true }
                .fixedSize()
        }
    }
}
