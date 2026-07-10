import SwiftUI

/// Root-View des Dashboard-Features („Heute im Verein“).
///
/// INTEGRATION: Diese View im Dashboard-Tab von MainTabView einhängen
/// (in einem NavigationStack) — sie ersetzt DashboardPlaceholderView.
struct DashboardView: View {
    @EnvironmentObject private var session: SessionStore
    @StateObject private var viewModel = DashboardViewModel()

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Theme.Spacing.cardGap) {
                greeting
                if let refreshError = viewModel.refreshError {
                    refreshErrorBanner(refreshError)
                }
                content
            }
            .padding(Theme.Spacing.s5)
        }
        .background(Theme.Colors.bgCanvas.ignoresSafeArea())
        .navigationTitle(Text("tab.dashboard"))
        .navigationBarTitleDisplayMode(.inline)
        .toolbar { profileMenu }
        .task { await viewModel.loadIfNeeded(api: session.api, clubId: session.clubId) }
        .refreshable { await viewModel.refresh(api: session.api, clubId: session.clubId) }
    }

    // MARK: - Inhalt nach Ladezustand

    @ViewBuilder
    private var content: some View {
        switch viewModel.state {
        case .loading:
            loadingCard
        case .error(let message):
            errorCard(message)
        case .loaded(let data):
            DashboardKpiRow(data: data)
            if let competition = data.nextCompetition {
                DashboardCountdownCard(
                    competition: competition,
                    days: data.countdownDays,
                    entrants: data.competitionEntrants
                )
            }
            DashboardEventsCard(data: data)
            DashboardTasksCard(
                tasks: data.tasks,
                pendingTaskIds: viewModel.pendingTaskIds,
                errorMessage: viewModel.taskError
            ) { task in
                await viewModel.toggleTask(task, api: session.api)
            }
        }
    }

    // MARK: - Begrüßung

    private var greeting: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.s1) {
            Text(DashboardFormat.eyebrowDateText(Date()))
                .font(Theme.Fonts.eyebrow)
                .tracking(Theme.Fonts.eyebrowTracking)
                .textCase(.uppercase)
                .foregroundStyle(Theme.Colors.inkFaint)
            greetingTitle
                .font(Theme.Fonts.display)
                .tracking(Theme.Fonts.displayTracking)
                .foregroundStyle(Theme.Colors.inkPrimary)
        }
        .padding(.top, Theme.Spacing.s2)
        .accessibilityElement(children: .combine)
    }

    /// Tageszeit-Gruß mit Vornamen der angemeldeten Persona.
    private var greetingTitle: Text {
        let name = firstName
        switch Calendar.current.component(.hour, from: Date()) {
        case ..<11: return Text("dashboard.greeting.morning \(name)")
        case ..<18: return Text("dashboard.greeting.day \(name)")
        default: return Text("dashboard.greeting.evening \(name)")
        }
    }

    private var firstName: String {
        let displayName = session.session?.profile.displayName ?? ""
        return displayName.split(separator: " ").first.map(String.init) ?? displayName
    }

    // MARK: - Toolbar (Profil/Abmelden)

    private var profileMenu: some ToolbarContent {
        ToolbarItem(placement: .topBarTrailing) {
            Menu {
                Button(role: .destructive) {
                    session.logout()
                } label: {
                    Label("common.logout", systemImage: "rectangle.portrait.and.arrow.right")
                }
            } label: {
                RSMAvatarView(
                    name: session.session?.profile.displayName ?? "?",
                    personId: session.session?.profile.memberId,
                    size: 30
                )
            }
            .accessibilityLabel(Text("dashboard.a11y.profileMenu"))
        }
    }

    // MARK: - Lade-/Fehlerzustände

    private var loadingCard: some View {
        RSMCard {
            HStack(spacing: Theme.Spacing.s3) {
                ProgressView()
                    .tint(Theme.Colors.brand)
                Text("dashboard.loading")
                    .font(Theme.Fonts.body)
                    .foregroundStyle(Theme.Colors.inkSoft)
            }
            .frame(maxWidth: .infinity, minHeight: 120)
        }
    }

    private func errorCard(_ message: String) -> some View {
        RSMCard {
            VStack(alignment: .leading, spacing: Theme.Spacing.s3) {
                HStack(spacing: Theme.Spacing.s2) {
                    Image(systemName: "exclamationmark.triangle.fill")
                        .foregroundStyle(Theme.Colors.danger)
                        .accessibilityHidden(true)
                    Text("dashboard.error.title")
                        .font(Theme.Fonts.h3)
                        .foregroundStyle(Theme.Colors.inkPrimary)
                }
                Text(message)
                    .font(Theme.Fonts.body)
                    .foregroundStyle(Theme.Colors.inkSoft)
                // Die einzige Beere in diesem Sichtbereich: der Weg zurück.
                RSMPrimaryButton(title: "dashboard.error.retry") {
                    _Concurrency.Task {
                        await viewModel.retry(api: session.api, clubId: session.clubId)
                    }
                }
            }
        }
    }

    private func refreshErrorBanner(_ message: String) -> some View {
        HStack(alignment: .top, spacing: Theme.Spacing.s3) {
            Image(systemName: "arrow.clockwise")
                .foregroundStyle(Theme.Colors.warn)
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: Theme.Spacing.s1) {
                Text("dashboard.error.refresh")
                    .font(Theme.Fonts.bodyStrong)
                    .foregroundStyle(Theme.Colors.warn)
                Text(message)
                    .font(Theme.Fonts.caption)
                    .foregroundStyle(Theme.Colors.inkSoft)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(Theme.Spacing.s4)
        .background(Theme.Colors.warnSoft)
        .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.l, style: .continuous))
        .accessibilityElement(children: .combine)
    }
}
