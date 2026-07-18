import SwiftUI

/// ÖFFENTLICHE ROOT-VIEW des Medaillen-Features („Meine Medaillen“).
///
/// Integration: wird im „Mehr“-Hub als NavigationLink-Ziel eingehängt und
/// läuft damit im NavigationStack des Mehr-Tabs (kein eigener Stack hier).
/// `MedalsRootView` rendert diese View, sodass die bestehende Registry
/// (`MehrCatalog` → `MedalsRootView()`) unverändert funktioniert.
///
/// Aufbau wie die Web-Referenz (portal)/medaillen: oben prominent „Meine
/// Medaillen“ (Erfolge des eingeloggten Mitglieds) mit Gold-/Silber-/Bronze-
/// Zusammenfassung, darunter „Alle Erfolge im Verein“ mit Medaillen-Filter.
/// Trainer+ sehen „Erfolg vergeben“ (Sichtbarkeit kosmetisch, Durchsetzung
/// serverseitig via RLS; 403 kommt im Sheet als Klartext).
struct AchievementsView: View {
    @EnvironmentObject private var session: SessionStore
    @StateObject private var model = AchievementsViewModel()
    @State private var isAwarding = false

    var body: some View {
        Group {
            switch model.state {
            case .loading:
                loadingView
            case .error(let message):
                errorView(message)
            case .loaded:
                contentView
            }
        }
        .background(Theme.Colors.bgCanvas.ignoresSafeArea())
        .navigationTitle(Text("medaillen.title"))
        .navigationBarTitleDisplayMode(.large)
        .toolbar {
            if model.canManage {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        isAwarding = true
                    } label: {
                        Image(systemName: "plus")
                    }
                    .tint(Theme.Colors.brand)
                    .accessibilityLabel(Text("medaillen.award.a11y"))
                }
            }
        }
        .task {
            await model.loadIfNeeded(
                api: session.api,
                clubId: session.clubId,
                currentMemberId: session.session?.profile.memberId,
                role: session.session?.profile.clubRole
            )
        }
        .sheet(isPresented: $isAwarding) {
            AwardAchievementSheet(
                api: session.api,
                clubId: session.clubId,
                members: model.sortedMembers,
                onCreated: { model.insert(created: $0) }
            )
        }
        .alert("medaillen.error.title", isPresented: refreshErrorBinding) {
            Button("medaillen.error.ok", role: .cancel) {}
        } message: {
            Text(verbatim: model.refreshErrorMessage ?? "")
        }
    }

    // MARK: - Zustände

    private var loadingView: some View {
        VStack(spacing: Theme.Spacing.s4) {
            ProgressView()
                .tint(Theme.Colors.brand)
            Text("medaillen.loading")
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
                    Text("medaillen.loadError.title")
                        .font(Theme.Fonts.h3)
                        .foregroundStyle(Theme.Colors.inkPrimary)
                    Text(verbatim: message)
                        .font(Theme.Fonts.body)
                        .foregroundStyle(Theme.Colors.inkSoft)
                        .multilineTextAlignment(.center)
                    RSMPrimaryButton(title: "medaillen.retry") {
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

    private var contentView: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Theme.Spacing.cardGap) {
                Text("medaillen.subtitle")
                    .font(Theme.Fonts.body)
                    .foregroundStyle(Theme.Colors.inkSoft)

                if model.achievements.isEmpty {
                    emptyAllState
                } else {
                    mineSection
                    clubSection
                }
            }
            .padding(Theme.Spacing.s5)
            .animation(.easeOut(duration: Theme.Motion.standard), value: model.filter)
        }
        .refreshable { await model.refresh() }
    }

    private var emptyAllState: some View {
        RSMCard {
            RSMEmptyState(
                systemImage: "sparkles",
                title: "medaillen.empty.title",
                message: model.canManage ? "medaillen.empty.trainer" : "medaillen.empty.member",
                actionTitle: model.canManage ? "medaillen.empty.cta" : nil,
                action: model.canManage ? { isAwarding = true } : nil
            )
        }
    }

    private var mineSection: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.s3) {
            sectionHeader(title: "medaillen.mine.title", sub: "medaillen.mine.subtitle")
            if model.mine.isEmpty {
                RSMCard {
                    RSMEmptyState(
                        systemImage: "sparkles",
                        title: "medaillen.mine.empty.title",
                        message: "medaillen.mine.empty.message"
                    )
                }
            } else {
                MineSummaryView(achievements: model.mine)
                ForEach(model.mine) { achievement in
                    AchievementCardView(
                        achievement: achievement,
                        member: model.member(for: achievement),
                        showMember: false
                    )
                }
            }
        }
    }

    private var clubSection: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.s3) {
            sectionHeader(title: "medaillen.club.title", sub: "medaillen.club.subtitle")
            MedaillenFilterBar(selection: $model.filter)
            if model.visibleClubAchievements.isEmpty {
                RSMCard {
                    RSMEmptyState(
                        systemImage: "magnifyingglass",
                        title: "medaillen.filter.empty.title",
                        message: "medaillen.filter.empty.message",
                        actionTitle: "medaillen.filter.empty.reset",
                        action: { model.filter = .all }
                    )
                }
            } else {
                ForEach(model.visibleClubAchievements) { achievement in
                    AchievementCardView(
                        achievement: achievement,
                        member: model.member(for: achievement),
                        showMember: true
                    )
                }
            }
        }
    }

    // MARK: - Bausteine

    private func sectionHeader(title: LocalizedStringKey, sub: LocalizedStringKey) -> some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.s1) {
            Text(title)
                .font(Theme.Fonts.h3)
                .foregroundStyle(Theme.Colors.inkPrimary)
            Text(sub)
                .font(Theme.Fonts.caption)
                .foregroundStyle(Theme.Colors.inkSoft)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityElement(children: .combine)
    }

    private var refreshErrorBinding: Binding<Bool> {
        Binding(
            get: { model.refreshErrorMessage != nil },
            set: { if !$0 { model.refreshErrorMessage = nil } }
        )
    }
}

// MARK: - Segmented-Filter (Mulden-Pill laut Design-System)

/// Segmente Alle · Gold · Silber · Bronze · Teilnahme in einer Sunken-Pille;
/// das aktive Segment liegt als Surface-Pille obenauf (wie `EventsFilterBar`).
struct MedaillenFilterBar: View {
    @Binding var selection: MedalFilter

    var body: some View {
        HStack(spacing: Theme.Spacing.s1) {
            ForEach(MedalFilter.allCases) { filter in
                segment(filter)
            }
        }
        .padding(Theme.Spacing.s1)
        .background(Theme.Colors.bgSunken)
        .clipShape(Capsule())
        .accessibilityElement(children: .contain)
        .accessibilityLabel(Text("medaillen.filter.a11y"))
    }

    private func segment(_ filter: MedalFilter) -> some View {
        let isSelected = selection == filter
        return Button {
            withAnimation(.easeOut(duration: Theme.Motion.fast)) {
                selection = filter
            }
        } label: {
            Text(filter.labelKey)
                .font(Theme.Fonts.caption.weight(.semibold))
                .lineLimit(2)
                .multilineTextAlignment(.center)
                .minimumScaleFactor(0.9)
                .foregroundStyle(isSelected ? Theme.Colors.inkPrimary : Theme.Colors.inkSoft)
                .frame(maxWidth: .infinity, minHeight: 36)
                .background(isSelected ? Theme.Colors.bgSurface : .clear)
                .clipShape(Capsule())
        }
        .buttonStyle(RSMPressableButtonStyle())
        .accessibilityLabel(Text(filter.labelKey))
        .accessibilityAddTraits(isSelected ? [.isSelected] : [])
    }
}
