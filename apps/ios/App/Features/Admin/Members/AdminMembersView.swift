import SwiftUI

/// Root-View der Mitglieder-Verwaltung (Web-Referenz: verwaltung/mitglieder).
/// Durchsuchbare Liste mit Rollen- und Status-Filter; Zeilentipp öffnet das
/// Bearbeiten-Sheet (nur mit `can_manage_members`). Erwartet einen umgebenden
/// `NavigationStack` (vom „Mehr"-Tab) und den `SessionStore` im Environment.
///
/// Verdrahtung: `MembersAdminRootView` (in VerwaltungRootViews.swift) rendert
/// diese View — der Platzhalter-Body dort muss auf `AdminMembersView()` zeigen.
struct AdminMembersView: View {
    @EnvironmentObject private var session: SessionStore
    @StateObject private var viewModel = AdminMembersViewModel()
    @State private var editing: AdminEditContext?
#if DEBUG
    @State private var didAutoOpenEdit = false
#endif

    /// Sheet-Ziel — hält den Mitglieder-Snapshot beim Öffnen (kein retroaktives
    /// `Identifiable` auf dem generierten `ClubMember`, um Team-Kollisionen zu
    /// vermeiden).
    private struct AdminEditContext: Identifiable {
        let member: ClubMember
        var id: String { member.id }
    }

    private var canManageMembers: Bool { session.permissions.canManageMembers }

    var body: some View {
        Group {
            switch viewModel.state {
            case .idle, .loading:
                loadingView
            case .failed(let message):
                errorView(message)
            case .loaded:
                loadedView
            }
        }
        .background(Theme.Colors.bgCanvas.ignoresSafeArea())
        .navigationTitle(Text("mitglieder.title"))
        .navigationBarTitleDisplayMode(.large)
        .task { await viewModel.loadIfNeeded(api: session.api, clubId: session.clubId) }
        .sheet(item: $editing) { context in
            AdminMemberEditSheet(
                member: context.member,
                api: session.api,
                clubId: session.clubId,
                permissions: session.permissions,
                currentUserId: session.session?.profile.memberId,
                onUpdated: { viewModel.apply(updated: $0) }
            )
        }
    }

    // MARK: - Zustände

    private var loadingView: some View {
        VStack(spacing: Theme.Spacing.s4) {
            ProgressView().tint(Theme.Colors.brand)
            Text("mitglieder.loading")
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
                    VStack(spacing: Theme.Spacing.s2) {
                        Text("mitglieder.error.title")
                            .font(Theme.Fonts.h3)
                            .foregroundStyle(Theme.Colors.inkPrimary)
                            .multilineTextAlignment(.center)
                        Text(verbatim: message)
                            .font(Theme.Fonts.caption)
                            .foregroundStyle(Theme.Colors.inkSoft)
                            .multilineTextAlignment(.center)
                    }
                    RSMPrimaryButton(title: "mitglieder.error.retry") {
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

    // MARK: - Geladen

    private var loadedView: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Theme.Spacing.cardGap) {
                if !canManageMembers { readOnlyBanner }
                filters
                listCard
            }
            .padding(Theme.Spacing.s5)
        }
        .searchable(
            text: $viewModel.searchText,
            placement: .navigationBarDrawer(displayMode: .always),
            prompt: Text("mitglieder.search.prompt")
        )
        .refreshable {
            await viewModel.load(api: session.api, clubId: session.clubId)
        }
#if DEBUG
        // NUR DEBUG/Smoke-Test: `-devMembersOpenFirstEdit YES` öffnet nach dem
        // Laden das Bearbeiten-Sheet des ersten Mitglieds (Rolle-ändern-Screenshot).
        // Optional `-devMembersOpenEditRole <role>` wählt stattdessen das erste
        // Mitglied mit dieser Rolle (z. B. `admin` fürs Moderator-Gating).
        .onAppear {
            guard
                !didAutoOpenEdit,
                canManageMembers,
                UserDefaults.standard.bool(forKey: "devMembersOpenFirstEdit")
            else { return }
            let wantRole = UserDefaults.standard.string(forKey: "devMembersOpenEditRole")
            let target: ClubMember? = {
                if let wantRole, let m = viewModel.filteredMembers.first(where: { $0.role.rawValue == wantRole }) {
                    return m
                }
                return viewModel.filteredMembers.first
            }()
            guard let target else { return }
            didAutoOpenEdit = true
            editing = AdminEditContext(member: target)
        }
#endif
    }

    private var readOnlyBanner: some View {
        RSMCard {
            HStack(alignment: .top, spacing: Theme.Spacing.s3) {
                Image(systemName: "lock.fill")
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(Theme.Colors.inkSoft)
                    .accessibilityHidden(true)
                Text("mitglieder.readOnly.note")
                    .font(Theme.Fonts.caption)
                    .foregroundStyle(Theme.Colors.inkSoft)
            }
        }
    }

    private var filters: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.s3) {
            chipRow(label: "mitglieder.filter.role.label") {
                ForEach(AdminMembersRoleFilter.allCases) { filter in
                    AdminMembersFilterChip(
                        title: filter.labelKey,
                        count: viewModel.roleCount(filter),
                        isSelected: viewModel.roleFilter == filter
                    ) {
                        viewModel.roleFilter = viewModel.roleFilter == filter ? .all : filter
                    }
                }
            }
            chipRow(label: "mitglieder.filter.status.label") {
                ForEach(AdminMembersStatusFilter.allCases) { filter in
                    AdminMembersFilterChip(
                        title: filter.labelKey,
                        count: viewModel.statusCount(filter),
                        isSelected: viewModel.statusFilter == filter
                    ) {
                        viewModel.statusFilter = viewModel.statusFilter == filter ? .all : filter
                    }
                }
            }
        }
    }

    private func chipRow(
        label: LocalizedStringKey,
        @ViewBuilder chips: () -> some View
    ) -> some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.s2) {
            Text(label)
                .font(Theme.Fonts.eyebrow)
                .tracking(Theme.Fonts.eyebrowTracking)
                .textCase(.uppercase)
                .foregroundStyle(Theme.Colors.inkFaint)
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: Theme.Spacing.s2) {
                    chips()
                }
                .padding(.horizontal, Theme.Spacing.s5)
            }
            .padding(.horizontal, -Theme.Spacing.s5)
        }
    }

    private var listCard: some View {
        Group {
            if viewModel.filteredMembers.isEmpty {
                RSMCard { emptyState }
            } else {
                RSMCard {
                    VStack(alignment: .leading, spacing: Theme.Spacing.s4) {
                        RSMSectionHeader(
                            eyebrow: "mitglieder.list.eyebrow",
                            title: "mitglieder.list.count \(viewModel.filteredMembers.count)"
                        )
                        rows
                    }
                }
            }
        }
    }

    private var rows: some View {
        VStack(spacing: 0) {
            ForEach(viewModel.filteredMembers, id: \.id) { member in
                rowButton(for: member)
                if member.id != viewModel.filteredMembers.last?.id {
                    Divider().overlay(Theme.Colors.line)
                }
            }
        }
    }

    @ViewBuilder
    private func rowButton(for member: ClubMember) -> some View {
        let row = AdminMembersRow(
            member: member,
            teamNames: viewModel.teamNames(for: member),
            feeStatus: viewModel.feeStatus(for: member),
            isEditable: canManageMembers
        )
        if canManageMembers {
            Button {
                editing = AdminEditContext(member: member)
            } label: {
                row
            }
            .buttonStyle(.plain)
            .accessibilityLabel(Text("mitglieder.row.a11y \(member.adminMembersDisplayName)"))
        } else {
            row
        }
    }

    private var emptyState: some View {
        RSMEmptyState(
            systemImage: "person.crop.circle.badge.questionmark",
            title: "mitglieder.empty.title",
            message: "mitglieder.empty.message",
            actionTitle: viewModel.hasActiveFilter ? "mitglieder.empty.reset" : nil,
            action: viewModel.hasActiveFilter ? { viewModel.resetFilters() } : nil
        )
    }
}
