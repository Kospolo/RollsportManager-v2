import SwiftUI

/// App-Einstieg: Ohne gültige Dev-Session → Persona-Login,
/// sonst die Tab-Shell. Kein weiterer Zustand hier — alles Fachliche
/// lebt in den Feature-Modulen.
@main
struct RollsportManagerApp: App {
    @StateObject private var session = SessionStore()

    var body: some Scene {
        WindowGroup {
            Group {
                if session.isAuthenticated {
                    MainTabView()
                } else {
                    LoginView()
                }
            }
            .environmentObject(session)
            .tint(Theme.Colors.brand)
#if DEBUG
            .task { await session.autoLoginFromLaunchArgumentsIfNeeded() }
#endif
        }
    }
}
