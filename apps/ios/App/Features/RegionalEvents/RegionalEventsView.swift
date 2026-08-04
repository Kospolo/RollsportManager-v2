import SwiftUI

/// ÖFFENTLICHE ROOT-VIEW des Events-Features (überregionale Veranstaltungen):
/// Wettkämpfe/Lehrgänge/Termine als Karten — kommende oben (frühester zuerst),
/// vergangene gedämpft darunter. Rein lesend: Tippen öffnet die Detail-Ansicht,
/// ein Anmelde-Link führt in den Browser. Läuft im NavigationStack des
/// „Mehr“-Tabs; `SessionStore` kommt aus dem Environment.
/// Web-Referenz-UX: apps/web/app/(portal)/events.
struct RegionalEventsView: View {
    @EnvironmentObject private var session: SessionStore
    @StateObject private var model = RegionalEventsViewModel()
    @State private var selection: RegionalEventSelection?
    @State private var editSelection: RegionalEventSelection?
    @State private var showCreate = false

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
        .navigationTitle(Text("events.regional.title"))
        .toolbar {
            if session.permissions.isClubAdmin {
                ToolbarItem(placement: .primaryAction) {
                    Button { showCreate = true } label: { Image(systemName: "plus") }
                        .accessibilityLabel(Text(verbatim: "Neuer überregionaler Termin"))
                }
            }
        }
        .sheet(isPresented: $showCreate) {
            RegionalEventCreateSheet(api: session.api, clubId: session.clubId) {
                _Concurrency.Task { await model.refresh() }
            }
        }
        .navigationBarTitleDisplayMode(.large)
        .task {
            await model.loadIfNeeded(api: session.api, clubId: session.clubId)
        }
        .sheet(item: $selection) { selected in
            RegionalEventDetailSheet(
                event: selected.event,
                isPast: RegionalEventDate.isPast(selected.event)
            )
        }
        .sheet(item: $editSelection) { selected in
            RegionalEventEditSheet(
                api: session.api,
                event: selected.event,
                onSaved: { _Concurrency.Task { await model.refresh() } },
                onDeleted: { _Concurrency.Task { await model.refresh() } }
            )
        }
        .alert("events.regional.error.title", isPresented: refreshErrorBinding) {
            Button("events.regional.error.ok", role: .cancel) {}
        } message: {
            Text(verbatim: model.refreshErrorMessage ?? "")
        }
    }

    // MARK: - Zustände

    private var loadingView: some View {
        VStack(spacing: Theme.Spacing.s4) {
            ProgressView()
                .tint(Theme.Colors.brand)
            Text("events.regional.loading")
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
                    Text("events.regional.error.title")
                        .font(Theme.Fonts.h3)
                        .foregroundStyle(Theme.Colors.inkPrimary)
                    Text(verbatim: message)
                        .font(Theme.Fonts.body)
                        .foregroundStyle(Theme.Colors.inkSoft)
                        .multilineTextAlignment(.center)
                    RSMPrimaryButton(title: "events.regional.error.retry") {
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
                if !model.hasAnyEvents {
                    emptyState
                } else {
                    Text("events.regional.sub")
                        .font(Theme.Fonts.body)
                        .foregroundStyle(Theme.Colors.inkSoft)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.horizontal, Theme.Spacing.s1)

                    upcomingSection
                    if !model.past.isEmpty {
                        pastSection
                    }
                }
            }
            .padding(Theme.Spacing.s5)
        }
        .refreshable { await model.refresh() }
    }

    private var upcomingSection: some View {
        section(
            titleKey: "events.regional.upcoming.title",
            subKey: "events.regional.upcoming.sub"
        ) {
            if model.upcoming.isEmpty {
                RSMCard {
                    RSMEmptyState(
                        systemImage: "calendar",
                        title: "events.regional.upcoming.empty.title",
                        message: "events.regional.upcoming.empty.message"
                    )
                }
            } else {
                cards(model.upcoming)
            }
        }
    }

    private var pastSection: some View {
        section(
            titleKey: "events.regional.past.title",
            subKey: "events.regional.past.sub"
        ) {
            cards(model.past)
        }
    }

    @ViewBuilder
    private func section<Content: View>(
        titleKey: LocalizedStringKey,
        subKey: LocalizedStringKey,
        @ViewBuilder content: () -> Content
    ) -> some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.s3) {
            VStack(alignment: .leading, spacing: 2) {
                Text(titleKey)
                    .font(Theme.Fonts.h3)
                    .foregroundStyle(Theme.Colors.inkPrimary)
                Text(subKey)
                    .font(Theme.Fonts.caption)
                    .foregroundStyle(Theme.Colors.inkSoft)
            }
            .padding(.leading, Theme.Spacing.s1)
            content()
        }
    }

    @ViewBuilder
    private func cards(_ list: [RegionalEvent]) -> some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.s3) {
            ForEach(list, id: \.id) { event in
                RSMCard(padding: 0) {
                    RegionalEventCardView(
                        event: event,
                        isPast: RegionalEventDate.isPast(event)
                    ) {
                        // Vereinsleitung tippt zum Bearbeiten/Löschen, alle
                        // anderen öffnen die rein lesende Detail-Ansicht.
                        if session.permissions.isClubAdmin {
                            editSelection = RegionalEventSelection(event: event)
                        } else {
                            selection = RegionalEventSelection(event: event)
                        }
                    }
                }
            }
        }
    }

    private var emptyState: some View {
        RSMCard {
            RSMEmptyState(
                systemImage: "flag.2.crossed.fill",
                title: "events.regional.empty.title",
                message: "events.regional.empty.message"
            )
        }
    }

    // MARK: - Helfer

    private var refreshErrorBinding: Binding<Bool> {
        Binding(
            get: { model.refreshErrorMessage != nil },
            set: { if !$0 { model.refreshErrorMessage = nil } }
        )
    }
}

/// Sheet-Auswahl ohne `Identifiable`-Konformanz auf dem Contracts-Typ
/// (Konformanz-Kollisionen zwischen den parallelen Feature-Teams vermeiden).
struct RegionalEventSelection: Identifiable {
    let event: RegionalEvent
    var id: String { event.id }
}
