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
    /// PRO-Modul (Galerie/Dokumente): trägt zusätzlich ein „PRO"-Badge. Der
    /// Zugang bleibt sichtbar; das eigentliche Gate zieht die Ziel-View
    /// (Entitlement → Upgrade-Karte statt Inhalt).
    var isPro: Bool = false
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
            id: "lockers",
            titleKey: "module.lockers.title", descKey: "module.lockers.desc",
            systemImage: "lock.square.fill", tone: .info, isNew: true,
            destination: AnyView(LockersRootView())
        ),
        MehrTile(
            id: "waitlists",
            titleKey: "module.waitlists.title", descKey: "module.waitlists.desc",
            systemImage: "person.badge.clock.fill", tone: .warn, isNew: true,
            destination: AnyView(WaitlistsRootView())
        ),
        MehrTile(
            id: "budget",
            titleKey: "module.budget.title", descKey: "module.budget.desc",
            systemImage: "chart.pie.fill", tone: .success, isNew: true,
            destination: AnyView(BudgetRootView())
        ),
        MehrTile(
            id: "profile",
            titleKey: "module.profile.title", descKey: "module.profile.desc",
            systemImage: "person.crop.circle.fill", tone: .brand, isNew: true,
            destination: AnyView(ProfileRootView())
        ),
        MehrTile(
            id: "notes",
            titleKey: "module.notes.title", descKey: "module.notes.desc",
            systemImage: "note.text", tone: .info, isNew: true,
            destination: AnyView(NotesRootView())
        ),
        MehrTile(
            id: "regevents",
            titleKey: "module.regevents.title", descKey: "module.regevents.desc",
            systemImage: "flag.2.crossed.fill", tone: .warn, isNew: true,
            destination: AnyView(RegionalEventsRootView())
        ),
        MehrTile(
            id: "departments",
            titleKey: "module.departments.title", descKey: "module.departments.desc",
            systemImage: "square.grid.2x2.fill", tone: .success, isNew: true,
            destination: AnyView(DepartmentsRootView())
        ),
        MehrTile(
            id: "anniversaries",
            titleKey: "module.anniversaries.title", descKey: "module.anniversaries.desc",
            systemImage: "gift.fill", tone: .honey, isNew: true,
            destination: AnyView(AnniversariesRootView())
        ),
        MehrTile(
            id: "gallery",
            titleKey: "module.gallery.title", descKey: "module.gallery.desc",
            systemImage: "photo.on.rectangle.angled", tone: .info, isNew: true, isPro: true,
            destination: AnyView(GalleryRootView())
        ),
        MehrTile(
            id: "document",
            titleKey: "module.document.title", descKey: "module.document.desc",
            systemImage: "doc.fill", tone: .success, isNew: true, isPro: true,
            destination: AnyView(DocumentsRootView())
        ),
        MehrTile(
            id: "competition",
            titleKey: "module.competition.title", descKey: "module.competition.desc",
            systemImage: "trophy.fill", tone: .warn, isNew: true,
            destination: AnyView(CompetitionRootView())
        ),
        MehrTile(
            id: "facility",
            titleKey: "module.facility.title", descKey: "module.facility.desc",
            systemImage: "building.2.fill", tone: .info, isNew: true,
            destination: AnyView(FacilityRootView())
        ),
        MehrTile(
            id: "equipment",
            titleKey: "module.equipment.title", descKey: "module.equipment.desc",
            systemImage: "shippingbox.fill", tone: .success, isNew: true,
            destination: AnyView(EquipmentRootView())
        ),
        MehrTile(
            id: "checkin",
            titleKey: "module.checkin.title", descKey: "module.checkin.desc",
            systemImage: "qrcode.viewfinder", tone: .warn, isNew: true,
            destination: AnyView(CheckinRootView())
        ),
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
            id: "exercises",
            titleKey: "module.exercises.title", descKey: "module.exercises.desc",
            systemImage: "figure.flexibility", tone: .success, isNew: true,
            destination: AnyView(ExercisesRootView())
        ),
        MehrTile(
            id: "family",
            titleKey: "module.family.title", descKey: "module.family.desc",
            systemImage: "figure.2.and.child.holdinghands", tone: .warn, isNew: true,
            destination: AnyView(FamilyRootView())
        ),
        MehrTile(
            id: "hours",
            titleKey: "module.hours.title", descKey: "module.hours.desc",
            systemImage: "clock.badge.checkmark", tone: .info, isNew: true,
            destination: AnyView(DutyHoursRootView())
        ),
        MehrTile(
            id: "chart",
            titleKey: "module.chart.title", descKey: "module.chart.desc",
            systemImage: "chart.bar.fill", tone: .success, isNew: true,
            destination: AnyView(ReportsRootView())
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
