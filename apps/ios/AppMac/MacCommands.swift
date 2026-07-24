#if os(macOS)
import SwiftUI

/// Menüleiste der Mac-App.
///
/// Auf dem Mac ist die Menüleiste der vollständige Index dessen, was eine App
/// kann — jede Funktion soll dort auffindbar sein, auch wenn sie in der
/// Seitenleiste steht. Deshalb steht hier JEDER Bereich als Menübefehl, nicht
/// nur die fünf mit Zifferntaste.
///
/// Die Befehle greifen über `@FocusedValue` auf das Navigationsmodell des
/// VORDERSTEN Fensters zu. Ohne das würde ⌘2 in einem zweiten Fenster das
/// erste umschalten.
struct MacCommands: Commands {
    @ObservedObject var session: SessionStore
    @FocusedValue(\.macNavigation) private var nav: MacNavigationModel?

    private var sections: [MacSidebarSection] {
        MacSidebarCatalog.sections(
            isClubAdmin: session.permissions.isClubAdmin,
            isPlatformAdmin: session.permissions.isPlatformAdmin
        )
    }

    var body: some Commands {
        // „Ablage › Neues Fenster" (⌘N) steht hier BEWUSST NICHT: das liefert
        // die `WindowGroup` von selbst. Ein eigener Eintrag müsste über einen
        // privaten AppKit-Selector gehen und würde den echten nur verdecken.

        CommandMenu(Text("mac.menu.areas")) {
            ForEach(sections) { section in
                Section {
                    ForEach(section.items) { item in
                        Button(item.titleKey) {
                            nav?.select(item.id, in: sections)
                        }
                        .keyboardShortcut(shortcut(for: item.id))
                        .disabled(nav == nil)
                    }
                } header: {
                    Text(section.titleKey)
                }
            }
        }

        CommandGroup(after: .appInfo) {
            Divider()
            // Ohne Tastenkürzel: ⇧⌘Q gehört systemweit dem Abmelden des
            // MACS. Diese Funktion so zu belegen, wäre eine Falle.
            Button("mac.menu.signOut") {
                session.logout()
            }
            .disabled(!session.isAuthenticated)
        }
    }

    private func shortcut(for id: String) -> KeyboardShortcut? {
        guard let index = MacSidebarCatalog.shortcutIDs.firstIndex(of: id), index < 9 else {
            return nil
        }
        return KeyboardShortcut(KeyEquivalent(Character("\(index + 1)")), modifiers: .command)
    }
}
#endif
