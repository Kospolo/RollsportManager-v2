import SwiftUI

/// ÖFFENTLICHE ROOT-VIEW des Termine-Features.
///
/// Integration: in MainTabView `EventsPlaceholderView()` durch
/// `EventsRootView()` ersetzen — erwartet `SessionStore` im Environment
/// und einen umgebenden `NavigationStack` (liefert die Tab-Shell).
struct EventsRootView: View {
    @EnvironmentObject private var session: SessionStore
    @StateObject private var model = EventsViewModel()
    @State private var selection: EventSelection?
    @State private var isCreatingEvent = false

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
        .navigationTitle(Text("events.title"))
        .navigationBarTitleDisplayMode(.large)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    isCreatingEvent = true
                } label: {
                    Image(systemName: "plus")
                }
                .tint(Theme.Colors.brand)
                .accessibilityLabel(Text("newEvent.a11y.open"))
            }
        }
        .task {
            await model.loadIfNeeded(api: session.api, clubId: session.clubId)
#if DEBUG
            applyEventsDevHooks()
#endif
        }
        .sheet(isPresented: $isCreatingEvent) {
            NewEventSheet(
                api: session.api,
                clubId: session.clubId,
                teams: model.teams,
                onCreated: { model.insert(createdEvent: $0) }
            )
        }
        .sheet(item: $selection) { selected in
            EventDetailSheet(
                event: latestEvent(for: selected),
                api: session.api,
                clubId: session.clubId,
                myMemberId: session.session?.profile.memberId ?? "",
                clubRole: session.session?.profile.clubRole,
                teamsById: model.teamsById,
                membersById: model.membersById,
                onEventUpdated: { model.apply(updatedEvent: $0) }
            )
        }
        .alert("events.error.title", isPresented: refreshErrorBinding) {
            Button("events.error.ok", role: .cancel) {}
        } message: {
            Text(verbatim: model.refreshErrorMessage ?? "")
        }
    }

#if DEBUG
    /// NUR DEBUG/Smoke-Test: setzt nach dem Laden optional den Filter
    /// (`-devEventFilter competition`) und öffnet das „Neuer Termin“-Sheet
    /// (`-devOpenNewEvent YES`). Ohne die Flags passiert nichts.
    private func applyEventsDevHooks() {
        let defaults = UserDefaults.standard
        if let rawFilter = defaults.string(forKey: "devEventFilter"),
           let parsed = EventsFilter(rawValue: rawFilter) {
            model.filter = parsed
        }
        if defaults.bool(forKey: "devOpenNewEvent") {
            isCreatingEvent = true
        }
    }
#endif

    // MARK: - Zustände

    private var loadingView: some View {
        VStack(spacing: Theme.Spacing.s4) {
            ProgressView()
                .tint(Theme.Colors.brand)
            Text("events.loading")
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
                    Text("events.error.title")
                        .font(Theme.Fonts.h3)
                        .foregroundStyle(Theme.Colors.inkPrimary)
                    Text(verbatim: message)
                        .font(Theme.Fonts.body)
                        .foregroundStyle(Theme.Colors.inkSoft)
                        .multilineTextAlignment(.center)
                    // Die eine Beere dieses Sichtbereichs: erneut laden.
                    RSMPrimaryButton(title: "events.error.retry") {
                        _Concurrency.Task { await model.retry() }
                    }
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
                EventsFilterBar(selection: $model.filter)
                if model.sections.isEmpty {
                    RSMCard {
                        RSMEmptyState(
                            systemImage: "calendar.badge.exclamationmark",
                            title: "events.empty.title",
                            message: model.filter == .all
                                ? "events.empty.message"
                                : "events.empty.filtered.message"
                        )
                    }
                } else {
                    ForEach(model.sections) { section in
                        daySection(section)
                    }
                }
            }
            .padding(Theme.Spacing.s5)
            .animation(.easeOut(duration: Theme.Motion.standard), value: model.filter)
        }
        .refreshable { await model.refresh() }
    }

    private func daySection(_ section: EventsDaySection) -> some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.s3) {
            dayHeader(section.day)
            RSMCard(padding: 0) {
                VStack(spacing: 0) {
                    ForEach(section.events, id: \.id) { event in
                        EventRowView(
                            event: event,
                            counts: EventsLogic.counts(
                                event: event,
                                teamsById: model.teamsById,
                                membersById: model.membersById
                            ),
                            teams: event.teamIds.compactMap { model.teamsById[$0] }
                        ) {
                            selection = EventSelection(event: event)
                        }
                        if event.id != section.events.last?.id {
                            Divider().overlay(Theme.Colors.line)
                        }
                    }
                }
            }
        }
    }

    private func dayHeader(_ day: Date) -> some View {
        dayHeaderText(day)
            .font(Theme.Fonts.eyebrow)
            .tracking(Theme.Fonts.eyebrowTracking)
            .textCase(.uppercase)
            .foregroundStyle(Theme.Colors.inkFaint)
            .padding(.leading, Theme.Spacing.s1)
    }

    private func dayHeaderText(_ day: Date) -> Text {
        let dateText = Text(day.formatted(.dateTime.weekday(.wide).day().month(.wide)))
        if Calendar.current.isDateInToday(day) {
            return Text("events.section.today") + Text(verbatim: " · ") + dateText
        }
        if Calendar.current.isDateInTomorrow(day) {
            return Text("events.section.tomorrow") + Text(verbatim: " · ") + dateText
        }
        return dateText
    }

    // MARK: - Helfer

    /// Fürs Sheet immer den aktuellsten Stand aus der Liste nehmen
    /// (die Auswahl ist nur ein Schnappschuss).
    private func latestEvent(for selection: EventSelection) -> Event {
        model.events.first { $0.id == selection.event.id } ?? selection.event
    }

    private var refreshErrorBinding: Binding<Bool> {
        Binding(
            get: { model.refreshErrorMessage != nil },
            set: { if !$0 { model.refreshErrorMessage = nil } }
        )
    }
}

// MARK: - Segmented-Filter (Mulden-Pill laut Design-System)

/// Segmente Alle · Training · Wettkampf · Sonstiges in einer Sunken-Pille;
/// das aktive Segment liegt als Surface-Pille obenauf.
struct EventsFilterBar: View {
    @Binding var selection: EventsFilter

    var body: some View {
        HStack(spacing: Theme.Spacing.s1) {
            ForEach(EventsFilter.allCases) { filter in
                segment(filter)
            }
        }
        .padding(Theme.Spacing.s1)
        .background(Theme.Colors.bgSunken)
        .clipShape(Capsule())
        .accessibilityElement(children: .contain)
        .accessibilityLabel(Text("events.filter.a11y"))
    }

    private func segment(_ filter: EventsFilter) -> some View {
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
