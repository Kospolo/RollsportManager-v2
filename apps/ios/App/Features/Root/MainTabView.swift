import SwiftUI

/// Tab-Shell der App: Dashboard · Termine · Mitglieder · Küren · Finanzen.
/// Jeder Tab ist ein eigenes Feature-Modul (Ordner unter Features/) —
/// jede Root-View bekommt hier ihren eigenen NavigationStack und erwartet
/// den SessionStore als EnvironmentObject (kommt von RollsportManagerApp).
struct MainTabView: View {
    enum Tab: String {
        case dashboard, events, members, routines, finance
    }

    @State private var selection: Tab

    init() {
        var initial = Tab.dashboard
#if DEBUG
        // Dev-Automation für Smoke-Tests: Launch-Argument
        // `-devTab <dashboard|events|members|routines|finance>` wählt den
        // Start-Tab (nur DEBUG-Builds).
        if let raw = UserDefaults.standard.string(forKey: "devTab"),
           let tab = Tab(rawValue: raw) {
            initial = tab
        }
#endif
        _selection = State(initialValue: initial)
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

            NavigationStack { FinanceView() }
                .tabItem { Label("tab.finance", systemImage: "eurosign.circle.fill") }
                .tag(Tab.finance)
        }
    }
}
