import SwiftUI

/// ÖFFENTLICHE ROOT-VIEW des Trainingsplan-Features.
///
/// Wochenübersicht Mo–So (nach Wochentag gruppiert, „Heute“ hervorgehoben) —
/// eine mobil-native, vertikale Fassung des Web-Wochenrasters + der Liste
/// (apps/web/app/(portal)/trainingsplan). Rein lesend in diesem Batch.
///
/// Integration: `TrainingPlanRootView` (das Ziel im „Mehr“-Hub) rendert diese
/// View. Erwartet `SessionStore` im Environment und läuft im NavigationStack
/// des Mehr-Tabs.
struct TrainingPlanView: View {
    @EnvironmentObject private var session: SessionStore
    @StateObject private var model = TrainingPlanViewModel()

    var body: some View {
        Group {
            switch model.state {
            case .loading:
                loadingView
            case .error(let message):
                errorView(message)
            case .loaded:
                weekView
            }
        }
        .background(Theme.Colors.bgCanvas.ignoresSafeArea())
        .navigationTitle(Text("trainingsplan.title"))
        .navigationBarTitleDisplayMode(.large)
        .task {
            await model.loadIfNeeded(api: session.api, clubId: session.clubId)
        }
        .alert("trainingsplan.error.title", isPresented: refreshErrorBinding) {
            Button("trainingsplan.error.ok", role: .cancel) {}
        } message: {
            Text(verbatim: model.refreshErrorMessage ?? "")
        }
    }

    // MARK: - Zustände

    private var loadingView: some View {
        VStack(spacing: Theme.Spacing.s4) {
            ProgressView()
                .tint(Theme.Colors.brand)
            Text("trainingsplan.loading")
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
                    Text("trainingsplan.error.title")
                        .font(Theme.Fonts.h3)
                        .foregroundStyle(Theme.Colors.inkPrimary)
                    Text(verbatim: message)
                        .font(Theme.Fonts.body)
                        .foregroundStyle(Theme.Colors.inkSoft)
                        .multilineTextAlignment(.center)
                    // Die eine Beere dieses Sichtbereichs: erneut laden.
                    RSMPrimaryButton(title: "trainingsplan.error.retry") {
                        _Concurrency.Task { await model.retry() }
                    }
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, Theme.Spacing.s4)
            }
            .padding(Theme.Spacing.s5)
        }
    }

    // MARK: - Woche

    @ViewBuilder
    private var weekView: some View {
        if model.slots.isEmpty {
            ScrollView {
                RSMCard {
                    RSMEmptyState(
                        systemImage: "calendar.badge.clock",
                        title: "trainingsplan.empty.title",
                        message: "trainingsplan.empty.message"
                    )
                }
                .padding(Theme.Spacing.s5)
            }
            .refreshable { await model.refresh() }
        } else {
            ScrollView {
                VStack(alignment: .leading, spacing: Theme.Spacing.cardGap) {
                    Text("trainingsplan.subtitle")
                        .font(Theme.Fonts.body)
                        .foregroundStyle(Theme.Colors.inkSoft)
                    ForEach(model.weekGroups) { group in
                        weekdaySection(group)
                    }
                }
                .padding(Theme.Spacing.s5)
            }
            .refreshable { await model.refresh() }
        }
    }

    private func weekdaySection(_ group: TrainingWeekdayGroup) -> some View {
        let isToday = group.weekday == TrainingPlanGrouping.todayWeekday()
        return VStack(alignment: .leading, spacing: Theme.Spacing.s3) {
            weekdayHeader(group, isToday: isToday)
            if group.slots.isEmpty {
                emptyDayRow
            } else {
                ForEach(group.slots, id: \.id) { slot in
                    TrainingSlotCard(
                        slot: slot,
                        teamName: model.teamName(for: slot.teamId),
                        coachName: model.coachName(for: slot.coachMemberId)
                    )
                }
            }
        }
    }

    private func weekdayHeader(_ group: TrainingWeekdayGroup, isToday: Bool) -> some View {
        HStack(spacing: Theme.Spacing.s2) {
            Text(TrainingPlanGrouping.weekdayLabelKey(group.weekday))
                .font(Theme.Fonts.h3)
                .foregroundStyle(isToday ? Theme.Colors.brandInk : Theme.Colors.inkPrimary)
            if isToday {
                RSMStatusPill(text: "trainingsplan.today", kind: .brand)
            }
            Spacer(minLength: Theme.Spacing.s2)
            Text(verbatim: "\(group.slots.count)")
                .font(Theme.Fonts.caption.weight(.heavy))
                .monospacedDigit()
                .foregroundStyle(Theme.Colors.inkFaint)
                .accessibilityLabel(Text("trainingsplan.slotCount \(group.slots.count)"))
        }
        .padding(.horizontal, Theme.Spacing.s3)
        .padding(.vertical, Theme.Spacing.s2)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(isToday ? Theme.Colors.brandSoft : Theme.Colors.bgSunken)
        .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.m, style: .continuous))
    }

    private var emptyDayRow: some View {
        Text("trainingsplan.emptyDay")
            .font(Theme.Fonts.caption)
            .foregroundStyle(Theme.Colors.inkFaint)
            .frame(maxWidth: .infinity, alignment: .center)
            .padding(.vertical, Theme.Spacing.s4)
            .overlay(
                RoundedRectangle(cornerRadius: Theme.Radius.l, style: .continuous)
                    .strokeBorder(Theme.Colors.line, style: StrokeStyle(lineWidth: 1, dash: [5, 4]))
            )
    }

    // MARK: - Helfer

    private var refreshErrorBinding: Binding<Bool> {
        Binding(
            get: { model.refreshErrorMessage != nil },
            set: { if !$0 { model.refreshErrorMessage = nil } }
        )
    }
}
