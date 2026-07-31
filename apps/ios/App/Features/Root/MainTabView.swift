import SwiftUI

/// Tab-Shell der App: Dashboard · Termine · Mitglieder · Küren · Mehr.
/// Jeder Tab ist ein eigenes Feature-Modul (Ordner unter Features/) —
/// jede Root-View bekommt hier ihren eigenen NavigationStack und erwartet
/// den SessionStore als EnvironmentObject (kommt von RollsportManagerApp).
///
/// WICHTIG (iOS-Grenze): Ein `TabView` zeigt maximal 5 Tabs; ein 6. Tab
/// klappt iOS automatisch in die System-„Mehr“-Liste (mit Navigation-Stack
/// + Zurück-Pfeil) und versteckt den überzähligen Tab. Deshalb sind es genau
/// FÜNF Tabs: Der native Finanzen-Tab weicht dem neuen „Mehr“-Hub — Finanzen
/// bleibt voll erreichbar als Kachel im Hub (`MehrHubView`), zusammen mit den
/// vier neuen Modulen News/Chat/Medaillen/Trainingsplan und allen weiteren
/// Bereichen. Soll Finanzen ein eigener Tab bleiben, bräuchte es eine
/// Custom-Tab-Bar statt des Stock-`TabView` (Team-Entscheidung).
struct MainTabView: View {
    enum Tab: String {
        case dashboard, events, members, routines, finance, mehr
    }

    /// Deep-Link-Ziele im „Mehr“-Hub (nur DEBUG-Smoke-Automation).
    enum MehrDeepLink: String, Hashable {
        case news, chat, medals, trainingplan
        case exercises, family, hours, chart
        case wettkampf, belegung, ausruestung, checkin
        case notes, events, departments, anniversaries, sparten, teams
        case lockers, waitlists, budget, profile
        case gallery, documents
        case kassenbuch, rechnungen, mahnungen
        case verwaltung
        case verwMitglieder = "verw-mitglieder"
        case verwRollen = "verw-rollen"
        case verwTeams = "verw-teams"
        case verwVerein = "verw-verein"
        case verwModule = "verw-module"
        // Betreiber-Ebene (nur mit Token-Claim; als Vereinsrolle erwartet man
        // hier den Sperr-Screen — genau das macht ihn beweisbar).
        case platform
        case platClubs = "plat-clubs"
        case platUsers = "plat-users"
        case platLicenses = "plat-licenses"
        case platSupport = "plat-support"
        case platRoutines = "plat-routines"
        case platSystem = "plat-system"
    }

    @EnvironmentObject private var session: SessionStore
    /// Beobachtet den Marken-Runtime: aendert der Verein seine Akzentfarbe
    /// (bzw. beim Betreten eines anderen Vereins), rendert die Shell neu und
    /// liest die generierten `Theme.Colors`-`static var` frisch — die App
    /// faerbt sich live um (0084).
    @ObservedObject private var brand = BrandRuntime.shared
    @State private var selection: Tab
    @State private var mehrPath: [MehrDeepLink] = []
    /// Der Operator-Start-Redirect (siehe `body`) darf nur EINMAL feuern —
    /// sonst käme der Betreiber nie aus der Konsole heraus, wenn er einen
    /// Verein betreten will.
    @State private var didRouteOperator = false

    init() {
        var initial = Tab.dashboard
        var initialMehr: [MehrDeepLink] = []
#if DEBUG
        // Dev-Automation für Smoke-Tests: Launch-Argument
        // `-devTab <dashboard|events|members|routines|finance>` wählt den
        // Start-Tab (nur DEBUG-Builds).
        if let raw = UserDefaults.standard.string(forKey: "devTab"),
           let tab = Tab(rawValue: raw) {
            initial = tab
        }
        // `-devMehrOpen <news|chat|medals|trainingplan|exercises|family|
        // hours|chart|wettkampf|belegung|ausruestung|checkin|notes|events|
        // departments|anniversaries|lockers|waitlists|budget|profile>` pusht
        // direkt das Modul im „Mehr“-Stack (nur DEBUG-Smoke).
        if let raw = UserDefaults.standard.string(forKey: "devMehrOpen"),
           let link = MehrDeepLink(rawValue: raw) {
            initial = .mehr
            initialMehr = [link]
        }
#endif
        _selection = State(initialValue: initial)
        _mehrPath = State(initialValue: initialMehr)
    }

    var body: some View {
        TabView(selection: $selection) {
            // `.id(session.clubId)` baut die Vereins-Daten-Views bei einem
            // Vereinswechsel (Betreiber: A verlassen → B betreten) NEU auf, damit
            // kein zwischengespeicherter Stand von Verein A unter dem Band von
            // Verein B stehen bleibt. Für ein protokollpflichtiges Feature ist
            // die richtige Zuordnung Pflicht.
            NavigationStack { DashboardView().id(session.clubId) }
                .tabItem { Label("tab.dashboard", systemImage: "house.fill") }
                .tag(Tab.dashboard)

            NavigationStack { EventsRootView().id(session.clubId) }
                .tabItem { Label("tab.events", systemImage: "calendar") }
                .tag(Tab.events)

            NavigationStack { MembersListView().id(session.clubId) }
                .tabItem { Label("tab.members", systemImage: "person.2.fill") }
                .tag(Tab.members)

            NavigationStack { RoutinesRootView().id(session.clubId) }
                .tabItem { Label("tab.routines", systemImage: "music.note" ) }
                .tag(Tab.routines)

            // Finanzen ist KEIN eigener Tab mehr (5-Tab-Grenze, s. o.) — es
            // lebt als Kachel im „Mehr“-Hub.
            NavigationStack(path: $mehrPath) {
                MehrHubView()
                    .navigationDestination(for: MehrDeepLink.self) { link in
                        switch link {
                        case .news: NewsRootView()
                        case .chat: ChatRootView()
                        case .medals: MedalsRootView()
                        case .trainingplan: TrainingPlanRootView()
                        case .exercises: ExercisesRootView()
                        case .family: FamilyRootView()
                        case .hours: DutyHoursRootView()
                        case .chart: ReportsRootView()
                        case .wettkampf: CompetitionRootView()
                        case .belegung: FacilityRootView()
                        case .ausruestung: EquipmentRootView()
                        case .checkin: CheckinRootView()
                        case .notes: NotesRootView()
                        case .events: RegionalEventsRootView()
                        case .departments: DepartmentsRootView()
                        case .sparten: SpartenRootView()
                        case .teams: TeamsRootView()
                        case .anniversaries: AnniversariesRootView()
                        case .lockers: LockersRootView()
                        case .waitlists: WaitlistsRootView()
                        case .budget: BudgetRootView()
                        case .profile: ProfileRootView()
                        case .gallery: GalleryRootView()
                        case .documents: DocumentsRootView()
                        // Finanz-Tiefe A (Deeplinks für DEBUG-Smoke; als
                        // `member` erwartet man den Sperr-Screen).
                        case .kassenbuch: KassenbuchRootView()
                        case .rechnungen: RechnungenRootView()
                        case .mahnungen: MahnwesenRootView()
                        case .verwaltung: VerwaltungHubView()
                        case .verwMitglieder: MembersAdminRootView()
                        case .verwRollen: RolesRootView()
                        case .verwTeams: TeamsAdminRootView()
                        case .verwVerein: ClubSettingsRootView()
                        case .verwModule: ModuleAdminView()
                        case .platform: PlatformConsoleView()
                        case .platClubs: PlatformClubsView()
                        case .platUsers: PlatformUsersView()
                        case .platLicenses: PlatformLicensesView()
                        case .platSupport: PlatformSupportView()
                        case .platRoutines: PlatformRoutinesView()
                        case .platSystem: PlatformSystemView()
                        }
                    }
            }
                .tabItem { Label("tab.mehr", systemImage: "ellipsis") }
                .tag(Tab.mehr)
        }
        // Tab-Bar-Akzent (Auswahl-Färbung) an die Vereinsfarbe binden. Das
        // App-weite `.tint` in RollsportManagerApp gilt für den Login-Screen
        // (noch kein Verein) und wird EINMAL gesetzt; hier — wo `brand`
        // beobachtet wird — zieht die Tab-Leiste bei einer Farbänderung nach.
        .tint(Theme.Colors.brand)
        // DAS BETREIBER-BAND über ALLEN Tabs (Spiegel des sticky top-0 im Web).
        // Bewusst hier als safeAreaInset auf der TabView — nicht in einer einzelnen
        // NavigationStack-View, sonst verschwände es beim Tab-Wechsel. Von hier aus
        // steuert es zugleich die Navigation (selection/mehrPath), was es in der
        // App-Hülle nicht könnte.
        .safeAreaInset(edge: .top, spacing: 0) {
            OperatorBannerView(
                onConsole: {
                    // In die Konsole schauen, OHNE die Einsicht zu beenden.
                    mehrPath = [.platform]
                    selection = .mehr
                },
                onEnd: { session.leaveOperatorClub() }
            )
        }
        // Betreten/Verlassen → Navigation. Der Einmal-Redirect oben (didRouteOperator)
        // bleibt unangetastet; dieser Handler wirkt danach frei.
        .onChange(of: session.operatorClub) { _, club in
            if club != nil {
                // Betreten: raus aus der Konsole, hinein in den Verein. Ziel .members
                // spiegelt ViewClubButton (target='/mitglieder').
                mehrPath = []
                selection = .members
            } else {
                // Verlassen: zurück in die Betreiber-Konsole (Spiegel endAccess → /super).
                mehrPath = [.platform]
                selection = .mehr
            }
        }
        .task {
            // Plattform-Admin (Betreiber) startet in der Betreiber-Konsole,
            // NICHT in einem Verein: er will die Vereine überblicken und bei
            // Problemen hineingehen. Genau EINMAL — danach navigiert er frei
            // (didRouteOperator verhindert, dass der Redirect zurückzieht).
            guard !didRouteOperator, session.isPlatformAdmin else { return }
            didRouteOperator = true
            selection = .mehr
            mehrPath = [.platform]
        }
        // Marken-/Akzentfarbe des aktiven Vereins laden und anwenden (0084).
        // `id: session.clubId` feuert beim ersten Erscheinen UND bei jedem
        // Vereinswechsel (Betreiber A verlassen → B betreten) — dann traegt die
        // Shell die Farbe von B. Netzfehler schluckt loadAndApply (Standard bleibt).
        .task(id: session.clubId) {
            await BrandRuntime.shared.loadAndApply(clubId: session.clubId, api: session.api)
        }
    }
}
