import SwiftUI

/// Farbton einer Icon-Kachel im „Mehr“-Hub (Heimspiel-Palette).
/// Bildet je einen getönten Hintergrund + passende Vordergrundfarbe ab —
/// analog zu den Tönen des Web-Hubs (brand/info/success/warn/neutral).
enum MehrTone {
    case brand, info, success, warn, honey, neutral

    var foreground: Color {
        switch self {
        case .brand: return Theme.Colors.brandInk
        case .info: return Theme.Colors.info
        case .success: return Theme.Colors.success
        case .warn: return Theme.Colors.warn
        case .honey: return Theme.Colors.honeyDeep
        case .neutral: return Theme.Colors.inkSoft
        }
    }

    var background: Color {
        switch self {
        case .brand: return Theme.Colors.brandSoft
        case .info: return Theme.Colors.infoSoft
        case .success: return Theme.Colors.successSoft
        case .warn: return Theme.Colors.warnSoft
        case .honey: return Theme.Colors.honeySoft
        case .neutral: return Theme.Colors.bgSunken
        }
    }
}

/// Eine Kachel des „Mehr“-Rasters.
///
/// `destination` ist bewusst eine `AnyView`: nur so lassen sich die
/// heterogenen Ziel-Views (bestehende Feature-Roots + neue Platzhalter) in
/// einer Liste halten. Das Konstruieren der View-Structs ist billig — der
/// `body` wird erst beim Push ausgewertet. `destination == nil` ⇒ „Bald“.
struct MehrTile: Identifiable {
    let id: String
    let titleKey: LocalizedStringKey
    let descKey: LocalizedStringKey
    let systemImage: String
    let tone: MehrTone
    var isNew: Bool = false
    let destination: AnyView?

    var isNavigable: Bool { destination != nil }
}

/// Statische Definition des Rasters — Reihenfolge wie im Web-Hub:
/// die vier neuen Module (mit „Neu“) zuerst, danach die bereits nativen
/// Bereiche; die restlichen als nicht-navigierbare „Bald“-Kacheln.
enum MehrCatalog {

    /// Navigierbar: 4 neue Module (NavigationLink-Ziele = neue Root-Views)
    /// + die bereits nativen Bereiche (Ziele = bestehende Feature-Roots).
    static let available: [MehrTile] = [
        MehrTile(
            id: "news",
            titleKey: "module.news.title", descKey: "module.news.desc",
            systemImage: "newspaper.fill", tone: .brand, isNew: true,
            destination: AnyView(NewsRootView())
        ),
        MehrTile(
            id: "chat",
            titleKey: "module.chat.title", descKey: "module.chat.desc",
            systemImage: "bubble.left.and.bubble.right.fill", tone: .info, isNew: true,
            destination: AnyView(ChatRootView())
        ),
        MehrTile(
            id: "medals",
            titleKey: "module.medals.title", descKey: "module.medals.desc",
            systemImage: "medal.fill", tone: .honey, isNew: true,
            destination: AnyView(MedalsRootView())
        ),
        MehrTile(
            id: "trainingplan",
            titleKey: "module.trainingplan.title", descKey: "module.trainingplan.desc",
            systemImage: "calendar.badge.clock", tone: .success, isNew: true,
            destination: AnyView(TrainingPlanRootView())
        ),
        MehrTile(
            id: "dashboard",
            titleKey: "module.dashboard.title", descKey: "module.dashboard.desc",
            systemImage: "house.fill", tone: .neutral,
            destination: AnyView(DashboardView())
        ),
        MehrTile(
            id: "events",
            titleKey: "module.events.title", descKey: "module.events.desc",
            systemImage: "calendar", tone: .brand,
            destination: AnyView(EventsRootView())
        ),
        MehrTile(
            id: "members",
            titleKey: "module.members.title", descKey: "module.members.desc",
            systemImage: "person.2.fill", tone: .info,
            destination: AnyView(MembersListView())
        ),
        MehrTile(
            id: "routines",
            titleKey: "module.routines.title", descKey: "module.routines.desc",
            systemImage: "music.note", tone: .honey,
            destination: AnyView(RoutinesRootView())
        ),
        MehrTile(
            id: "finance",
            titleKey: "module.finance.title", descKey: "module.finance.desc",
            systemImage: "eurosign.circle.fill", tone: .success,
            destination: AnyView(FinanceView())
        ),
    ]

    /// Noch nicht gebaut — nicht navigierbar, „Bald“-Kachel.
    static let soon: [MehrTile] = [
        soonTile("facility", "module.facility.title", "module.facility.desc", "building.2.fill", .info),
        soonTile("equipment", "module.equipment.title", "module.equipment.desc", "shippingbox.fill", .success),
        soonTile("hours", "module.hours.title", "module.hours.desc", "clock.badge.checkmark", .info),
        soonTile("chart", "module.chart.title", "module.chart.desc", "chart.bar.fill", .success),
        soonTile("checkin", "module.checkin.title", "module.checkin.desc", "qrcode.viewfinder", .warn),
        soonTile("regevents", "module.regevents.title", "module.regevents.desc", "flag.2.crossed.fill", .warn),
        soonTile("family", "module.family.title", "module.family.desc", "figure.2.and.child.holdinghands", .warn),
        soonTile("exercises", "module.exercises.title", "module.exercises.desc", "figure.flexibility", .success),
        soonTile("notes", "module.notes.title", "module.notes.desc", "note.text", .info),
        soonTile("gallery", "module.gallery.title", "module.gallery.desc", "photo.on.rectangle.angled", .info),
        soonTile("document", "module.document.title", "module.document.desc", "doc.fill", .success),
        soonTile("manage", "module.manage.title", "module.manage.desc", "shield.fill", .neutral),
    ]

    private static func soonTile(
        _ id: String,
        _ title: LocalizedStringKey,
        _ desc: LocalizedStringKey,
        _ symbol: String,
        _ tone: MehrTone
    ) -> MehrTile {
        MehrTile(
            id: id, titleKey: title, descKey: desc,
            systemImage: symbol, tone: tone, destination: nil
        )
    }
}
