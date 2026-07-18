import SwiftUI

/// ÖFFENTLICHE ROOT-VIEW der Jubiläen (Geburtstage & Vereinsjubiläen).
///
/// Integration: hängt im „Mehr“-Hub als NavigationLink-Ziel und läuft damit im
/// NavigationStack des Mehr-Tabs (kein eigener Stack hier). `AnniversariesRootView`
/// (Registry-Einhängepunkt, `MehrCatalog` → `AnniversariesRootView()`) rendert
/// diese View, sodass die READ-ONLY-Registry unverändert bleibt.
///
/// Aufbau wie die Web-Referenz `(portal)/jubilaeen`: festlicher „Als Nächstes“-
/// Hero für das nächstgelegene Jubiläum, Filter-Pillen nach Art und die
/// chronologisch nach Monaten gruppierte Liste. Für alle Mitglieder sichtbar,
/// das Scoping bleibt serverseitig. Rein lesend.
struct AnniversariesView: View {
    @EnvironmentObject private var session: SessionStore
    @StateObject private var model = AnniversariesViewModel()
    @State private var filter: JubilaeenFilter = .all

    var body: some View {
        Group {
            switch model.state {
            case .loading:
                loadingView
            case .error(let message):
                errorView(message)
            case .loaded(let items):
                content(items)
            }
        }
        .background(Theme.Colors.bgCanvas.ignoresSafeArea())
        .navigationTitle(Text("module.anniversaries.title"))
        .navigationBarTitleDisplayMode(.large)
        .task { await model.loadIfNeeded(api: session.api, clubId: session.clubId) }
        .alert("jubilaeen.loadError.title", isPresented: refreshErrorBinding) {
            Button("jubilaeen.error.ok", role: .cancel) {}
        } message: {
            Text(verbatim: model.refreshErrorMessage ?? "")
        }
    }

    // MARK: - Zustände

    private var loadingView: some View {
        VStack(spacing: Theme.Spacing.s4) {
            ProgressView()
                .tint(Theme.Colors.brand)
            Text("jubilaeen.loading")
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
                    Text("jubilaeen.loadError.title")
                        .font(Theme.Fonts.h3)
                        .foregroundStyle(Theme.Colors.inkPrimary)
                    Text(verbatim: message)
                        .font(Theme.Fonts.body)
                        .foregroundStyle(Theme.Colors.inkSoft)
                        .multilineTextAlignment(.center)
                    RSMPrimaryButton(title: "jubilaeen.retry") {
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

    // MARK: - Inhalt

    private func content(_ items: [Anniversary]) -> some View {
        let filtered = items.filter { filter.matches($0.kind) }
        return ScrollView {
            VStack(alignment: .leading, spacing: Theme.Spacing.cardGap) {
                Text("jubilaeen.subtitle")
                    .font(Theme.Fonts.body)
                    .foregroundStyle(Theme.Colors.inkSoft)

                if items.isEmpty {
                    RSMEmptyState(
                        systemImage: "gift.fill",
                        title: "jubilaeen.empty.title",
                        message: "jubilaeen.empty.body"
                    )
                } else {
                    if let next = filtered.first {
                        AnniversariesNextUpBanner(item: next)
                    }

                    JubilaeenFilterChips(counts: counts(items), selection: $filter)

                    if filtered.isEmpty {
                        filterEmptyNote
                    } else {
                        ForEach(JubilaeenFormat.groupByMonth(filtered)) { group in
                            monthSection(group)
                        }
                    }
                }
            }
            .padding(Theme.Spacing.s5)
        }
        .refreshable { await model.refresh() }
    }

    private func monthSection(_ group: JubilaeenFormat.MonthGroup) -> some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.s2) {
            Text(verbatim: group.title)
                .font(Theme.Fonts.eyebrow)
                .tracking(Theme.Fonts.eyebrowTracking)
                .textCase(.uppercase)
                .foregroundStyle(Theme.Colors.inkFaint)
                .padding(.horizontal, Theme.Spacing.s1)
            VStack(spacing: Theme.Spacing.s2) {
                ForEach(group.items, id: \.rowKey) { item in
                    AnniversaryCard(item: item)
                }
            }
        }
    }

    private var filterEmptyNote: some View {
        Text("jubilaeen.filterEmpty")
            .font(Theme.Fonts.caption)
            .foregroundStyle(Theme.Colors.inkSoft)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(Theme.Spacing.s4)
            .background(Theme.Colors.bgSunken)
            .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.m, style: .continuous))
    }

    // MARK: - Helfer

    private func counts(_ items: [Anniversary]) -> [JubilaeenFilter: Int] {
        [
            .all: items.count,
            .membership: items.filter { $0.kind == .membership }.count,
            .birthday: items.filter { $0.kind == .birthday }.count,
        ]
    }

    private var refreshErrorBinding: Binding<Bool> {
        Binding(
            get: { model.refreshErrorMessage != nil },
            set: { if !$0 { model.refreshErrorMessage = nil } }
        )
    }
}
