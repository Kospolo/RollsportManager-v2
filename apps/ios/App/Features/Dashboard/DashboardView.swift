import SwiftUI

/// Root-View des Dashboard-Features („Heute im Verein“).
///
/// INTEGRATION: Diese View im Dashboard-Tab von MainTabView einhängen
/// (in einem NavigationStack) — sie ersetzt DashboardPlaceholderView.
struct DashboardView: View {
    @EnvironmentObject private var session: SessionStore
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @StateObject private var viewModel = DashboardViewModel()

    var body: some View {
        VStack(spacing: 0) {
            clubBar
            scrollBody
        }
        .background(Theme.Colors.bgCanvas.ignoresSafeArea())
        // Die System-Navigationsleiste ist hier ERSATZLOS weg: sie trug nur das
        // Wort „Uebersicht" und kostete eine volle Leistenhoehe. Der Vereinskopf
        // darueber ist die Leiste — und er sagt, WESSEN Verein das ist.
        // Gilt nur fuer diese Wurzelansicht; jede geschobene Detailseite bringt
        // ihre eigene Leiste samt Zurueck-Pfeil mit.
#if os(iOS)
        .toolbar(.hidden, for: .navigationBar)
#endif
        .task { await viewModel.loadIfNeeded(api: session.api, clubId: session.clubId) }
    }

    /// Schlanke Kopfzeile: links der VEREIN (Logo + Name), rechts das
    /// Profil-Menue. Steht AUSSERHALB des ScrollView — sie scrollt nicht weg.
    ///
    /// Warum nicht als Toolbar-Item: `.principal` blieb im Simulator komplett
    /// leer, `.topBarLeading` renderte eine leere Glas-Kapsel. Beides gemessen,
    /// nicht vermutet. Eine eigene Zeile ist hier auch ehrlicher — wir
    /// kontrollieren Hoehe und Abstand selbst, und genau darum ging es.
    private var clubBar: some View {
        HStack(spacing: Theme.Spacing.s3) {
            RSMClubHeader(clubId: session.clubId)
            Spacer(minLength: Theme.Spacing.s2)
            profileMenuButton
        }
        .padding(.horizontal, Theme.Spacing.s4)
        .padding(.vertical, Theme.Spacing.s2)
    }

    private var scrollBody: some View {
        ScrollView {
            // s4 statt s5 rundum und cardGap nur ZWISCHEN den Karten: der
            // Gruss klebt jetzt am Kopf, statt in der Mitte einer Leerzone zu
            // schweben.
            VStack(alignment: .leading, spacing: Theme.Spacing.cardGap) {
                heroGreeting
                if let banner = viewModel.trialBanner {
                    trialBannerView(banner)
                }
                if let refreshError = viewModel.refreshError {
                    refreshErrorBanner(refreshError)
                }
                content
            }
            .padding(.horizontal, Theme.Spacing.s4)
            .padding(.bottom, Theme.Spacing.s5)
            // OBEN GAR KEIN Abstand mehr: den bringt die Vereins-Kopfzeile mit
            // (ihr `.padding(.vertical, s2)`). Vorher standen hier s5 rundum
            // PLUS s2 am Gruss — zwei Abstaende fuer eine Kante, unter einer
            // Leiste, die selbst schon Luft mitbrachte.
        }
        .refreshable { await viewModel.refresh(api: session.api, clubId: session.clubId) }
    }

    // MARK: - Trial-/Lizenz-Banner (rein informativ — Kauf läuft im Web)

    @ViewBuilder
    private func trialBannerView(_ banner: TrialBanner) -> some View {
        let expired: Bool = { if case .expired = banner.kind { return true } else { return false } }()
        RSMCard {
            HStack(alignment: .top, spacing: Theme.Spacing.s3) {
                Image(systemName: expired ? "lock.circle.fill" : "clock.badge.checkmark")
                    .font(.system(size: 22, weight: .semibold))
                    .foregroundStyle(expired ? Theme.Colors.danger : Theme.Colors.brandInk)
                    .accessibilityHidden(true)
                VStack(alignment: .leading, spacing: 2) {
                    switch banner.kind {
                    case .trial(let daysLeft):
                        Text(verbatim: daysLeft <= 0
                            ? "Testphase endet heute"
                            : (daysLeft == 1 ? "Testphase: noch 1 Tag" : "Testphase: noch \(daysLeft) Tage"))
                            .font(Theme.Fonts.listTitle)
                            .foregroundStyle(Theme.Colors.inkPrimary)
                        Text(verbatim: "Danach die Vereinslizenz im Web-Portal aktivieren (rollsportmanager.de).")
                            .font(Theme.Fonts.caption)
                            .foregroundStyle(Theme.Colors.inkSoft)
                    case .expired:
                        Text(verbatim: "Testphase abgelaufen")
                            .font(Theme.Fonts.listTitle)
                            .foregroundStyle(Theme.Colors.inkPrimary)
                        Text(verbatim: "Einige Funktionen sind gesperrt. Vereinslizenz im Web-Portal aktivieren (rollsportmanager.de).")
                            .font(Theme.Fonts.caption)
                            .foregroundStyle(Theme.Colors.inkSoft)
                    }
                }
                Spacer(minLength: 0)
            }
        }
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

    /// Gruss KOMPAKT: Datum und Anrede stehen ruhig nebeneinander statt in der
    /// groessten Schrift der App untereinander. Der Gruss ist eine Hoeflichkeit,
    /// kein Inhalt — er darf nicht ein Fuenftel des Bildschirms kosten. Die
    /// Display-Schrift bleibt den KPI-Zahlen und Kartentiteln vorbehalten.
    /// Warmer Hero-Gruß im Design „Bewegung & Wärme": Verlaufs-Karte mit der
    /// Wellenform-Signatur — derselbe erste-Eindruck-Ton wie beim Login, statt
    /// grauer Text auf leerer Fläche.
    private var heroGreeting: some View {
        ZStack(alignment: .bottomLeading) {
            WarmPalette.heroGradient
            WaveformStrip(color: .white.opacity(0.5), reduceMotion: reduceMotion)
                .frame(height: 54)
                .frame(maxWidth: .infinity, alignment: .bottom)
                .allowsHitTesting(false)
            VStack(alignment: .leading, spacing: Theme.Spacing.s1) {
                Text(DashboardFormat.eyebrowDateText(Date()))
                    .font(Theme.Fonts.eyebrow)
                    .tracking(Theme.Fonts.eyebrowTracking)
                    .textCase(.uppercase)
                    .foregroundStyle(.white.opacity(0.85))
                greetingTitle
                    .font(.system(size: 27, weight: .heavy, design: .rounded))
                    .foregroundStyle(.white)
                    .padding(.bottom, Theme.Spacing.s5)
            }
            .padding(Theme.Spacing.s4)
        }
        .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
        .shadow(color: WarmPalette.coral.opacity(0.26), radius: 16, x: 0, y: 8)
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

    // MARK: - Profil/Abmelden (rechts in der Vereins-Kopfzeile)

    private var profileMenuButton: some View {
        Menu {
            NavigationLink {
                ProfileRootView()
            } label: {
                Label("module.profile.title", systemImage: "person.crop.circle")
            }
            Button(role: .destructive) {
                session.logout()
            } label: {
                Label("common.logout", systemImage: "rectangle.portrait.and.arrow.right")
            }
        } label: {
            RSMAvatarView(
                name: session.session?.profile.displayName ?? "?",
                personId: session.session?.profile.memberId,
                size: 32
            )
            // Der Avatar ist 32 pt gross, die TREFFERFLAECHE bleibt 44 pt —
            // ausserhalb der Systemleiste muessen wir das selbst sicherstellen.
            .frame(width: Theme.Size.touchTarget, height: Theme.Size.touchTarget)
            .contentShape(Rectangle())
        }
        .accessibilityLabel(Text("dashboard.a11y.profileMenu"))
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
