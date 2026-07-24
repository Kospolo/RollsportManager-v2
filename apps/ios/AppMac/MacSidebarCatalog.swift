#if os(macOS)
import SwiftUI

// ============================================================================
// Die Seitenleiste ist KEIN zweiter Funktionskatalog.
//
// Sie liest denselben `MehrCatalog`, aus dem die iOS-App ihr „Mehr“-Raster
// baut — inklusive der Ziel-Views. Ein neues Modul, das ein Feature-Team in
// `MehrCatalog.available` einträgt, taucht am Mac automatisch auf; hier steht
// nur, in WELCHE Gruppe es gehört. Fehlt die Zuordnung, landet es sichtbar
// unter „Weiteres“ — nie unsichtbar. Genau das ist der Unterschied zwischen
// einer Gruppierung und einer Doppelpflege.
// ============================================================================

/// Eine Gruppe in der Seitenleiste (Abschnitts-Überschrift + Einträge).
struct MacSidebarSection: Identifiable {
    let id: String
    let titleKey: LocalizedStringKey
    let items: [MacSidebarItem]
}

/// Ein Eintrag der Seitenleiste — die Anzeige-Daten stammen aus `MehrTile`.
struct MacSidebarItem: Identifiable {
    let id: String
    let titleKey: LocalizedStringKey
    let systemImage: String
    let tone: MehrTone
    let destination: AnyView

    init?(_ tile: MehrTile) {
        guard let destination = tile.destination else { return nil }
        self.id = tile.id
        self.titleKey = tile.titleKey
        self.systemImage = tile.systemImage
        self.tone = tile.tone
        self.destination = destination
    }
}

enum MacSidebarCatalog {

    /// Reihenfolge der Gruppen und ihre Modul-IDs. Die IDs sind die aus
    /// `MehrCatalog` — hier steht bewusst KEINE Titel-/Icon-Kopie.
    private static let grouping: [(id: String, titleKey: LocalizedStringKey, ids: [String])] = [
        ("start", "mac.sidebar.section.start",
         ["dashboard", "events", "members", "routines", "finance"]),
        ("sport", "mac.sidebar.section.sport",
         ["trainingplan", "exercises", "competition", "medals", "checkin", "regevents"]),
        ("verein", "mac.sidebar.section.club",
         ["news", "chat", "teams", "sparten", "departments", "anniversaries", "family", "hours"]),
        ("betrieb", "mac.sidebar.section.operations",
         ["facility", "equipment", "lockers", "waitlists", "budget", "notes", "chart"]),
        ("ablage", "mac.sidebar.section.files",
         ["gallery", "document"]),
        ("ich", "mac.sidebar.section.me",
         ["profile"]),
    ]

    /// Die Gruppen für die aktuelle Anmeldung.
    ///
    /// `isClubAdmin`/`isPlatformAdmin` steuern NUR die Sichtbarkeit der beiden
    /// Verwaltungs-Gruppen — dieselbe Menüführung wie im iOS-Hub. Verbindlich
    /// entscheidet weiterhin der Server (403), das hier ist Höflichkeit.
    static func sections(isClubAdmin: Bool, isPlatformAdmin: Bool) -> [MacSidebarSection] {
        let byID = Dictionary(
            uniqueKeysWithValues: MehrCatalog.available.map { ($0.id, $0) }
        )
        var used = Set<String>()
        var sections: [MacSidebarSection] = []

        // Betreiber ganz oben — wer ihn sieht, ist zum Betrieb hier.
        var adminItems: [MacSidebarItem] = []
        if isPlatformAdmin, let item = MacSidebarItem(MehrCatalog.platform) { adminItems.append(item) }
        if isClubAdmin, let item = MacSidebarItem(MehrCatalog.verwaltung) { adminItems.append(item) }
        if !adminItems.isEmpty {
            sections.append(
                MacSidebarSection(id: "admin", titleKey: "mac.sidebar.section.admin", items: adminItems)
            )
        }

        for group in grouping {
            let items = group.ids.compactMap { id -> MacSidebarItem? in
                guard let tile = byID[id] else { return nil }
                used.insert(id)
                return MacSidebarItem(tile)
            }
            guard !items.isEmpty else { continue }
            sections.append(MacSidebarSection(id: group.id, titleKey: group.titleKey, items: items))
        }

        // Sicherheitsnetz: neue Module ohne Gruppen-Zuordnung bleiben sichtbar.
        let rest = MehrCatalog.available
            .filter { !used.contains($0.id) }
            .compactMap(MacSidebarItem.init)
        if !rest.isEmpty {
            sections.append(
                MacSidebarSection(id: "rest", titleKey: "mac.sidebar.section.more", items: rest)
            )
        }
        return sections
    }

    /// Die fünf Einträge, die ⌘1 … ⌘5 bekommen (Startgruppe).
    static let shortcutIDs = ["dashboard", "events", "members", "routines", "finance"]

    /// Startauswahl beim Öffnen eines Fensters.
    static let defaultItemID = "dashboard"
}
#endif
