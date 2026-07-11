import SwiftUI

/// ÖFFENTLICHE ROOT-VIEW der Auswertung (Statistiken & Berichte).
///
/// Integration: hängt im „Mehr“-Hub als NavigationLink-Ziel und läuft damit im
/// NavigationStack des Mehr-Tabs (kein eigener Stack hier). `ReportsRootView`
/// (Registry-Einhängepunkt, `MehrCatalog` → `ReportsRootView()`) rendert diese
/// View, sodass die READ-ONLY-Registry unverändert bleibt.
///
/// Aufbau wie die Web-Referenz `(portal)/auswertung`: KPI-Reihe (Mitglieder,
/// Anwesenheitsquote, offene Posten, kommende Termine), Verteilungen
/// (Mitglieder je Rolle/Team als Balken), Medaillenspiegel und Terminliste.
/// Nur Trainerstab/Vereinsleitung — alle anderen sehen einen freundlichen
/// Kein-Zugriff-Hinweis (Durchsetzung bleibt serverseitig). Rein lesend.
struct ReportsView: View {
    @EnvironmentObject private var session: SessionStore
    @StateObject private var model = ReportsViewModel()

    var body: some View {
        Group {
            switch model.state {
            case .loading:
                loadingView
            case .noAccess:
                noAccessView
            case .error(let message):
                errorView(message)
            case .loaded(let summary):
                content(summary)
            }
        }
        .background(Theme.Colors.bgCanvas.ignoresSafeArea())
        .navigationTitle(Text("auswertung.title"))
        .navigationBarTitleDisplayMode(.large)
        .task {
            await model.loadIfNeeded(
                api: session.api,
                clubId: session.clubId,
                role: session.session?.profile.clubRole
            )
        }
        .alert("auswertung.loadError.title", isPresented: refreshErrorBinding) {
            Button("auswertung.error.ok", role: .cancel) {}
        } message: {
            Text(verbatim: model.refreshErrorMessage ?? "")
        }
    }

    // MARK: - Zustände

    private var loadingView: some View {
        VStack(spacing: Theme.Spacing.s4) {
            ProgressView()
                .tint(Theme.Colors.brand)
            Text("auswertung.loading")
                .font(Theme.Fonts.body)
                .foregroundStyle(Theme.Colors.inkSoft)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private var noAccessView: some View {
        ScrollView {
            RSMCard {
                RSMEmptyState(
                    systemImage: "lock.fill",
                    title: "auswertung.noAccess.title",
                    message: "auswertung.noAccess.body"
                )
            }
            .padding(Theme.Spacing.s5)
        }
    }

    private func errorView(_ message: String) -> some View {
        ScrollView {
            RSMCard {
                VStack(spacing: Theme.Spacing.s4) {
                    Image(systemName: "wifi.exclamationmark")
                        .font(.system(size: 40, weight: .medium))
                        .foregroundStyle(Theme.Colors.danger)
                        .accessibilityHidden(true)
                    Text("auswertung.loadError.title")
                        .font(Theme.Fonts.h3)
                        .foregroundStyle(Theme.Colors.inkPrimary)
                    Text(verbatim: message)
                        .font(Theme.Fonts.body)
                        .foregroundStyle(Theme.Colors.inkSoft)
                        .multilineTextAlignment(.center)
                    RSMPrimaryButton(title: "auswertung.retry") {
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

    private func content(_ summary: ReportSummary) -> some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Theme.Spacing.cardGap) {
                Text("auswertung.subtitle")
                    .font(Theme.Fonts.body)
                    .foregroundStyle(Theme.Colors.inkSoft)

                ReportsKpiSection(summary: summary)

                ReportsBarList(
                    eyebrow: "auswertung.roles.eyebrow",
                    title: "auswertung.roles.title",
                    data: ReportsDistribution.roles(summary),
                    tone: Theme.Colors.brand,
                    unitText: String(localized: "auswertung.roles.unit")
                )

                ReportsBarList(
                    eyebrow: "auswertung.teams.eyebrow",
                    title: "auswertung.teams.title",
                    data: ReportsDistribution.teams(summary),
                    tone: Theme.Colors.info,
                    unitText: String(localized: "auswertung.teams.unit")
                )

                ReportsMedalTally(medals: summary.medals)

                ReportsUpcomingEventsCard(
                    events: summary.upcomingEvents,
                    total: summary.upcomingEventsCount ?? summary.upcomingEvents.count
                )
            }
            .padding(Theme.Spacing.s5)
        }
        .refreshable { await model.refresh() }
    }

    // MARK: - Bindings

    private var refreshErrorBinding: Binding<Bool> {
        Binding(
            get: { model.refreshErrorMessage != nil },
            set: { if !$0 { model.refreshErrorMessage = nil } }
        )
    }
}
