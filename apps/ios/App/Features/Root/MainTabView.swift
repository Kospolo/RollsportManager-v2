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
        case notes, events, departments, anniversaries
        case lockers, waitlists, budget, profile
        case gallery, documents
        case verwaltung
        case verwMitglieder = "verw-mitglieder"
        case verwRollen = "verw-rollen"
        case verwTeams = "verw-teams"
        case verwVerein = "verw-verein"
    }

    @State private var selection: Tab
    @State private var mehrPath: [MehrDeepLink] = []

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
            NavigationStack { DashboardView() }
                .tabItem { Label("tab.dashboard", systemImage: "house.fill") }
                .tag(Tab.dashboard)

            NavigationStack { EventsRootView() }
                .tabItem { Label("tab.events", systemImage: "calendar") }
                .tag(Tab.events)

            NavigationStack { MembersListView() }
                .tabItem { Label("tab.members", systemImage: "person.2.fill") }
                .tag(Tab.members)

            NavigationStack { RoutinesRootView() }
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
                        case .anniversaries: AnniversariesRootView()
                        case .lockers: LockersRootView()
                        case .waitlists: WaitlistsRootView()
                        case .budget: BudgetRootView()
                        case .profile: ProfileRootView()
                        case .gallery: GalleryRootView()
                        case .documents: DocumentsRootView()
                        case .verwaltung: VerwaltungHubView()
                        case .verwMitglieder: MembersAdminRootView()
                        case .verwRollen: RolesRootView()
                        case .verwTeams: TeamsAdminRootView()
                        case .verwVerein: ClubSettingsRootView()
                        }
                    }
            }
                .tabItem { Label("tab.mehr", systemImage: "ellipsis") }
                .tag(Tab.mehr)
        }
    }
}
