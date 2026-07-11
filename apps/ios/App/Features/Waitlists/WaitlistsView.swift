import SwiftUI

/// Root-View des Features „Wartelisten“ (Web-Referenz: /(portal)/wartelisten).
/// Exponierter, stabiler Feature-Einstieg — `WaitlistsRootView` (Registry +
/// DEBUG-Deeplink) rendert diese View.
///
/// Zwei Sichten aus EINER (RLS-gescopten) Response: „Meine Einträge“
/// (Selbst-Eintrag/-Austrag, für alle) und die „Vereins-Warteschlange“
/// (Trainer+, Einträge entfernen). Läuft im NavigationStack des „Mehr“-Hubs.
struct WaitlistsView: View {
    @EnvironmentObject private var session: SessionStore
    @StateObject private var viewModel = WaitlistsViewModel()

    /// Eintragen-Dialog offen.
    @State private var showJoin = false
    /// Ausstehende Austragen/Entfernen-Bestätigung (nie auto-bestätigt).
    @State private var leaveRequest: WaitlistLeaveRequest?

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
        .navigationTitle(Text("module.waitlists.title"))
        .navigationBarTitleDisplayMode(.large)
        .toolbar {
            if viewModel.state == .loaded {
                ToolbarItem(placement: .primaryAction) {
                    Button {
                        showJoin = true
                    } label: {
                        Label("wartelisten.join.cta", systemImage: "plus")
                    }
                }
            }
        }
        .task { await viewModel.loadIfNeeded(session: session) }
        .sheet(isPresented: $showJoin) {
            WaitlistJoinSheet(viewModel: viewModel)
        }
        .alert(
            "wartelisten.action.errorTitle",
            isPresented: Binding(
                get: { viewModel.actionError != nil },
                set: { if !$0 { viewModel.actionError = nil } }
            ),
            presenting: viewModel.actionError
        ) { _ in
            Button("wartelisten.ok", role: .cancel) { viewModel.actionError = nil }
        } message: { message in
            Text(verbatim: message)
        }
    }

    // MARK: - Zustände

    private var loadingView: some View {
        VStack(spacing: Theme.Spacing.s4) {
            ProgressView().tint(Theme.Colors.brand)
            Text("wartelisten.loading")
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
                        Text("wartelisten.error.title")
                            .font(Theme.Fonts.h3)
                            .foregroundStyle(Theme.Colors.inkPrimary)
                            .multilineTextAlignment(.center)
                        Text(verbatim: message)
                            .font(Theme.Fonts.caption)
                            .foregroundStyle(Theme.Colors.inkSoft)
                            .multilineTextAlignment(.center)
                    }
                    RSMPrimaryButton(title: "wartelisten.error.retry") {
                        _Concurrency.Task { await viewModel.reload() }
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

    private var content: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Theme.Spacing.s7) {
                mineSection
                if viewModel.canManageQueue {
                    queueSection
                }
            }
            .padding(Theme.Spacing.s5)
        }
        .refreshable { await viewModel.reload() }
        .alert(
            leaveTitleKey,
            isPresented: Binding(
                get: { leaveRequest != nil },
                set: { if !$0 { leaveRequest = nil } }
            ),
            presenting: leaveRequest
        ) { request in
            Button(
                request.isTrainer ? "wartelisten.remove.confirm" : "wartelisten.leave.confirm",
                role: .destructive
            ) {
                _Concurrency.Task {
                    await viewModel.leave(request.entry)
                    leaveRequest = nil
                }
            }
            Button("wartelisten.cancel", role: .cancel) { leaveRequest = nil }
        } message: { request in
            if request.isTrainer {
                Text("wartelisten.leave.messageTrainer \(request.memberName)")
            } else {
                Text("wartelisten.leave.message")
            }
        }
    }

    // MARK: „Meine Einträge"

    @ViewBuilder
    private var mineSection: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.cardGap) {
            HStack(alignment: .firstTextBaseline, spacing: Theme.Spacing.s2) {
                Text("wartelisten.mine.title")
                    .font(Theme.Fonts.h2)
                    .foregroundStyle(Theme.Colors.inkPrimary)
                if !viewModel.myEntries.isEmpty {
                    Text("wartelisten.mine.count \(viewModel.myEntries.count)")
                        .font(Theme.Fonts.caption)
                        .foregroundStyle(Theme.Colors.inkFaint)
                }
            }

            if viewModel.myEntries.isEmpty {
                RSMCard {
                    RSMEmptyState(
                        systemImage: "clock.badge.questionmark",
                        title: "wartelisten.mine.empty.title",
                        message: "wartelisten.mine.empty.message",
                        actionTitle: "wartelisten.join.cta",
                        action: { showJoin = true }
                    )
                }
            } else {
                ForEach(viewModel.myEntries, id: \.id) { entry in
                    WaitlistMineCard(
                        entry: entry,
                        target: viewModel.targetSources.resolve(entry),
                        isDisabled: viewModel.isMutating,
                        onLeave: { leaveRequest = .init(entry: entry, isTrainer: false, memberName: "") }
                    )
                }
            }
        }
    }

    // MARK: Vereins-Warteschlange (Trainer+)

    @ViewBuilder
    private var queueSection: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.cardGap) {
            VStack(alignment: .leading, spacing: Theme.Spacing.s1) {
                Text("wartelisten.queue.title")
                    .font(Theme.Fonts.h2)
                    .foregroundStyle(Theme.Colors.inkPrimary)
                Text("wartelisten.queue.sub")
                    .font(Theme.Fonts.caption)
                    .foregroundStyle(Theme.Colors.inkSoft)
            }

            if viewModel.entries.isEmpty {
                RSMCard {
                    RSMEmptyState(
                        systemImage: "person.badge.clock",
                        title: "wartelisten.queue.empty.title",
                        message: "wartelisten.queue.empty.message"
                    )
                }
            } else {
                WaitlistFilterChips(
                    selection: $viewModel.queueFilter,
                    total: viewModel.entries.count,
                    counts: viewModel.kindCounts
                )
                queueList
            }
        }
    }

    @ViewBuilder
    private var queueList: some View {
        let visible = viewModel.visibleQueue
        if visible.isEmpty {
            RSMCard {
                RSMEmptyState(
                    systemImage: "line.3.horizontal.decrease.circle",
                    title: "wartelisten.filter.empty.title",
                    message: "wartelisten.filter.empty.message",
                    actionTitle: "wartelisten.filter.reset",
                    action: { viewModel.queueFilter = nil }
                )
            }
        } else {
            ForEach(visible, id: \.id) { entry in
                WaitlistQueueRow(
                    entry: entry,
                    member: viewModel.member(for: entry),
                    target: viewModel.targetSources.resolve(entry),
                    isDisabled: viewModel.isMutating,
                    onRemove: {
                        let member = viewModel.member(for: entry)
                        let name = member.map { "\($0.firstName) \($0.lastName)" } ?? ""
                        leaveRequest = .init(entry: entry, isTrainer: true, memberName: name)
                    }
                )
            }
        }
    }

    private var leaveTitleKey: LocalizedStringKey {
        (leaveRequest?.isTrainer ?? false)
            ? "wartelisten.leave.titleTrainer"
            : "wartelisten.leave.title"
    }
}

/// Ziel einer ausstehenden Austragen/Entfernen-Bestätigung.
/// `isTrainer` unterscheidet Selbst-Austrag von Trainer-Entfernen (Texte).
struct WaitlistLeaveRequest: Identifiable {
    let entry: Waitlist
    let isTrainer: Bool
    let memberName: String
    var id: String { entry.id }
}
