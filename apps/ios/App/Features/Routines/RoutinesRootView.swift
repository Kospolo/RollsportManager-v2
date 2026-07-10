import SwiftUI

/// ÖFFENTLICHE Root-View des Küren-Moduls (Tab „Küren“).
///
/// Integration: in MainTabView als `NavigationStack { RoutinesRootView() }`
/// verdrahten — die Detail-Navigation läuft hier drin über NavigationLink.
/// Erwartet `SessionStore` als EnvironmentObject.
struct RoutinesRootView: View {
    @EnvironmentObject private var session: SessionStore
    @StateObject private var viewModel = RoutinesViewModel()

#if DEBUG
    // Dev-Automation für Smoke-Tests: Launch-Argument `-devOpenFirstRoutine YES`
    // springt nach dem Laden direkt in das Detail der ersten Kür (nur DEBUG).
    @State private var devDetailItem: RoutineListItem?
    @State private var devDetailPresented = false
#endif

    var body: some View {
        Group {
            switch viewModel.state {
            case .loading:
                loadingView
            case .error(let message):
                errorView(message)
            case .loaded(let items):
                listView(items)
#if DEBUG
                    .onAppear {
                        guard UserDefaults.standard.bool(forKey: "devOpenFirstRoutine"),
                              devDetailItem == nil,
                              let first = items.first else { return }
                        devDetailItem = first
                        devDetailPresented = true
                    }
#endif
            }
        }
        .background(Theme.Colors.bgCanvas.ignoresSafeArea())
        .navigationTitle(Text("routines.list.title"))
        .navigationBarTitleDisplayMode(.large)
        .task { await viewModel.loadIfNeeded(api: session.api, clubId: session.clubId) }
#if DEBUG
        .navigationDestination(isPresented: $devDetailPresented) {
            if let item = devDetailItem {
                RoutineDetailView(item: item)
            }
        }
#endif
    }

    // MARK: - Zustände

    private var loadingView: some View {
        ProgressView()
            .tint(Theme.Colors.brand)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private func errorView(_ message: String) -> some View {
        ScrollView {
            RSMCard {
                VStack(alignment: .leading, spacing: Theme.Spacing.s4) {
                    HStack(alignment: .top, spacing: Theme.Spacing.s3) {
                        Image(systemName: "exclamationmark.triangle.fill")
                            .foregroundStyle(Theme.Colors.danger)
                            .accessibilityHidden(true)
                        VStack(alignment: .leading, spacing: Theme.Spacing.s1) {
                            Text("routines.list.error.title")
                                .font(Theme.Fonts.bodyStrong)
                                .foregroundStyle(Theme.Colors.danger)
                            Text(verbatim: message)
                                .font(Theme.Fonts.caption)
                                .foregroundStyle(Theme.Colors.inkSoft)
                        }
                    }
                    // Die eine Beere dieses Sichtbereichs: der Weg zurück.
                    RSMPrimaryButton(title: "routines.common.retry") {
                        _Concurrency.Task {
                            await viewModel.load(api: session.api, clubId: session.clubId)
                        }
                    }
                }
            }
            .padding(Theme.Spacing.s5)
        }
    }

    private func listView(_ items: [RoutineListItem]) -> some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: Theme.Spacing.cardGap) {
                Text("routines.list.subtitle")
                    .font(Theme.Fonts.body)
                    .foregroundStyle(Theme.Colors.inkSoft)

                if items.isEmpty {
                    RSMCard {
                        RSMEmptyState(
                            systemImage: "music.note.list",
                            title: "routines.list.empty.title",
                            message: "routines.list.empty.message"
                        )
                    }
                } else {
                    ForEach(items) { item in
                        NavigationLink {
                            RoutineDetailView(item: item)
                        } label: {
                            RoutineCardView(item: item)
                        }
                        .buttonStyle(RSMPressableButtonStyle())
                        .accessibilityLabel(
                            Text("routines.list.a11y.card \(item.routine.title) \(item.skaterNames)")
                        )
                    }
                }
            }
            .padding(Theme.Spacing.s5)
        }
        .refreshable { await viewModel.load(api: session.api, clubId: session.clubId) }
    }
}

// MARK: - Karte

/// Kür-Karte der Liste: Läufer:in zuerst (Signatur „Menschen zuerst“),
/// dann Titel, Disziplin, Musik, Dauer und die letzte RollArt-Wertung mit Delta.
private struct RoutineCardView: View {
    let item: RoutineListItem

    private var routine: Routine { item.routine }

    var body: some View {
        RSMCard {
            VStack(alignment: .leading, spacing: Theme.Spacing.s3) {
                HStack(spacing: Theme.Spacing.s2) {
                    avatarStack
                    Text(verbatim: item.skaterNames)
                        .font(Theme.Fonts.bodyStrong)
                        .foregroundStyle(Theme.Colors.inkPrimary)
                        .lineLimit(1)
                    Spacer(minLength: Theme.Spacing.s2)
                    RSMStatusPill(text: routine.status.labelKey, kind: routine.status.pillKind)
                }

                VStack(alignment: .leading, spacing: Theme.Spacing.s1) {
                    Text(verbatim: routine.title)
                        .font(Theme.Fonts.h3)
                        .foregroundStyle(Theme.Colors.inkPrimary)
                    categoryLine
                }

                if let musicTitle = routine.musicTitle {
                    HStack(spacing: Theme.Spacing.s2) {
                        Image(systemName: "music.note")
                            .font(.system(size: 12, weight: .semibold))
                            .foregroundStyle(Theme.Colors.honeyDeep)
                            .accessibilityHidden(true)
                        Text(verbatim: [musicTitle, routine.musicArtist].compactMap { $0 }.joined(separator: " · "))
                            .font(Theme.Fonts.caption)
                            .foregroundStyle(Theme.Colors.inkSoft)
                            .lineLimit(1)
                    }
                }

                Divider().overlay(Theme.Colors.line)

                bottomRow
            }
        }
    }

    /// Bis zu zwei überlappende Avatare (Paarlauf) — deterministische Töne.
    private var avatarStack: some View {
        HStack(spacing: -Theme.Spacing.s2) {
            ForEach(item.skaters, id: \.id) { member in
                RSMAvatarView(
                    name: "\(member.firstName) \(member.lastName)",
                    personId: member.id,
                    size: 32
                )
                .overlay(Circle().stroke(Theme.Colors.bgSurface, lineWidth: 2))
            }
        }
        .accessibilityHidden(true)
    }

    private var categoryLine: some View {
        HStack(spacing: Theme.Spacing.s1) {
            if let category = routine.category {
                Text(verbatim: category)
                Text(verbatim: "·")
            }
            Text(routineDisciplineKey(skaterCount: routine.skaterMemberIds.count))
        }
        .font(Theme.Fonts.caption)
        .foregroundStyle(Theme.Colors.inkSoft)
    }

    private var bottomRow: some View {
        HStack(spacing: Theme.Spacing.s2) {
            if let durationMs = routine.musicDurationMs {
                Image(systemName: "clock")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(Theme.Colors.inkFaint)
                    .accessibilityHidden(true)
                Text(verbatim: RoutineFormat.mmss(Double(durationMs)))
                    .font(Theme.Fonts.monoTable)
                    .monospacedDigit()
                    .foregroundStyle(Theme.Colors.inkSoft)
            }
            Spacer(minLength: Theme.Spacing.s2)
            if let lastTotal = item.lastTotal {
                Text("routines.list.lastScore")
                    .font(Theme.Fonts.caption)
                    .foregroundStyle(Theme.Colors.inkFaint)
                Text(verbatim: RoutineFormat.points(lastTotal))
                    .font(Theme.Fonts.monoTable)
                    .monospacedDigit()
                    .foregroundStyle(Theme.Colors.inkPrimary)
                if let delta = item.delta {
                    RoutineDeltaChip(delta: delta)
                }
            } else {
                Text("routines.list.noScore")
                    .font(Theme.Fonts.caption)
                    .foregroundStyle(Theme.Colors.inkFaint)
            }
        }
    }
}
