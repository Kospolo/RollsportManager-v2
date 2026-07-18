import SwiftUI

/// Root-View des Features „Mitglieder“ — durchsuchbare Vereinsliste mit
/// Rollen-Filter-Chips. Von der Integration in den NavigationStack des
/// Tabs „Mitglieder“ hängen (ersetzt `MembersPlaceholderView`).
struct MembersListView: View {
    @EnvironmentObject private var session: SessionStore
    @StateObject private var viewModel = MembersViewModel()

    var body: some View {
        Group {
            switch viewModel.state {
            case .idle, .loading:
                loadingView
            case .failed(let message):
                errorView(message)
            case .loaded:
                memberList
            }
        }
        .background(Theme.Colors.bgCanvas.ignoresSafeArea())
        .navigationTitle(Text("tab.members"))
        .navigationBarTitleDisplayMode(.large)
        .task { await viewModel.loadIfNeeded(api: session.api, clubId: session.clubId) }
    }

    // MARK: - Zustände

    private var loadingView: some View {
        VStack(spacing: Theme.Spacing.s4) {
            ProgressView()
                .tint(Theme.Colors.brand)
            Text("members.loading")
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
                        Text("members.error.title")
                            .font(Theme.Fonts.h3)
                            .foregroundStyle(Theme.Colors.inkPrimary)
                            .multilineTextAlignment(.center)
                        Text(verbatim: message)
                            .font(Theme.Fonts.caption)
                            .foregroundStyle(Theme.Colors.inkSoft)
                            .multilineTextAlignment(.center)
                    }
                    RSMPrimaryButton(title: "members.error.retry") {
                        // `Task` ist im Modul der Contracts-Struct — daher
                        // voll qualifiziert `_Concurrency.Task`.
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

    // MARK: - Liste

    private var memberList: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Theme.Spacing.cardGap) {
                roleFilterChips
                if viewModel.filteredMembers.isEmpty {
                    RSMCard { emptyState }
                } else {
                    RSMCard {
                        VStack(alignment: .leading, spacing: Theme.Spacing.s4) {
                            RSMSectionHeader(
                                eyebrow: "members.list.eyebrow",
                                title: "members.list.count \(viewModel.filteredMembers.count)"
                            )
                            memberRows
                        }
                    }
                }
            }
            .padding(Theme.Spacing.s5)
        }
        .searchable(
            text: $viewModel.searchText,
            placement: .navigationBarDrawer(displayMode: .always),
            prompt: Text("members.search.prompt")
        )
        .refreshable {
            await viewModel.load(api: session.api, clubId: session.clubId)
        }
    }

    private var memberRows: some View {
        VStack(spacing: 0) {
            ForEach(viewModel.filteredMembers, id: \.id) { member in
                NavigationLink {
                    MemberDetailView(memberId: member.id, viewModel: viewModel)
                } label: {
                    // Ohne Beitragsampel — siehe MemberRowView (Würde-Befund).
                    MemberRowView(
                        member: member,
                        teamNames: viewModel.teamNames(for: member)
                    )
                }
                .buttonStyle(.plain)
                .accessibilityLabel(Text("members.row.a11y \(member.membersFullName)"))
                if member.id != viewModel.filteredMembers.last?.id {
                    Divider().overlay(Theme.Colors.line)
                }
            }
        }
    }

    /// Kein Treffer für Suche/Filter — nie ein leerer Screen ohne Weg.
    private var emptyState: some View {
        RSMEmptyState(
            systemImage: "magnifyingglass",
            title: "members.empty.title",
            message: "members.empty.message",
            actionTitle: viewModel.hasActiveFilter ? "members.empty.reset" : nil,
            action: viewModel.hasActiveFilter ? { viewModel.resetFilters() } : nil
        )
    }

    // MARK: - Rollen-Filter

    private var roleFilterChips: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: Theme.Spacing.s2) {
                MembersFilterChip(
                    title: "members.filter.all",
                    isSelected: viewModel.roleFilter == nil
                ) {
                    viewModel.roleFilter = nil
                }
                ForEach(ClubRole.allCases, id: \.rawValue) { role in
                    MembersFilterChip(
                        title: MembersL10n.roleKey(role),
                        isSelected: viewModel.roleFilter == role
                    ) {
                        // Zweiter Tap auf den aktiven Chip hebt den Filter auf.
                        viewModel.roleFilter = viewModel.roleFilter == role ? nil : role
                    }
                }
            }
            .padding(.horizontal, Theme.Spacing.s5)
        }
        .padding(.horizontal, -Theme.Spacing.s5) // Chips laufen bis an den Rand
    }
}
