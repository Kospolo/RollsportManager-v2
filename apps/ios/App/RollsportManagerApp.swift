import SwiftUI

/// App-Einstieg: Ohne gültige Dev-Session → Persona-Login,
/// sonst die Shell der Plattform. Kein weiterer Zustand hier — alles Fachliche
/// lebt in den Feature-Modulen.
///
/// iOS zeigt die Tab-Shell (`MainTabView`), macOS die Seitenleiste
/// (`MacRootView`, in AppMac/). Das ist die EINZIGE Plattform-Weiche im
/// Einstieg; alles darunter ist geteilter Code.
@main
struct RollsportManagerApp: App {
    @StateObject private var session = SessionStore()

    var body: some Scene {
        WindowGroup {
            Group {
                if session.isAuthenticated {
#if os(macOS)
                    MacRootView()
#else
                    MainTabView()
#endif
                } else {
#if os(macOS)
                    // Die Persona-Auswahl ist eine schmale Spalte — in einem
                    // 1240-pt-Fenster stünde sie verloren. Also bekommt sie ihr
                    // eigenes Maß, bis jemand angemeldet ist.
                    LoginView()
                        .frame(minWidth: 460, idealWidth: 520, minHeight: 620, idealHeight: 760)
#else
                    LoginView()
#endif
                }
            }
            .environmentObject(session)
            .tint(Theme.Colors.brand)
#if DEBUG
            .task { await session.autoLoginFromLaunchArgumentsIfNeeded() }
#endif
        }
#if os(macOS)
        // Mac-Fenster: groß genug für Seitenleiste + Inhalt; das Minimum setzt
        // `MacRootView` selbst, damit die Seitenleiste nie zerquetscht wird.
        .defaultSize(width: 1240, height: 820)
        .windowResizability(.contentMinSize)
        .commands { MacCommands(session: session) }
#endif
    }
}
