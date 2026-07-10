import Foundation
import SwiftUI

// ============================================================================
// Medaillen-Feature — feature-lokale Modelle, Format- und Netz-Helfer.
// Alle Typen mit „Medal…“/„medaillen…“ präfixiert (Kollisionsschutz Parallel-
// Teams). Web-Referenz-UX: apps/web/app/(portal)/medaillen.
// ============================================================================

// MARK: - Ansichtsmodell eines Erfolgs
//
// ⚠️ CONTRACT-WORKAROUND (an Contracts-Team gemeldet, s. Rückgabe/„offene
// Punkte“): Der generierte `Achievement.medal` ist NICHT optional (`Medal`),
// die API liefert bei „Teilnahme ohne Medaille“ aber `medal: null`
// (verifiziert: Seed-Datensatz `ac000000-…-000006` „Teilnahmeurkunde
// Pflicht“). Damit wirft `JSONDecoder` beim ganzen Array — d. h.
// `session.api.listAchievements` scheitert für Verein c1 mit `.decoding`.
// Deshalb decodiert das Feature bewusst dieses tolerante Ansichtsmodell mit
// `medal: Medal?` über `APIClient.medaillenList(...)` statt des typisierten
// Endpoints. SOBALD die Contracts `Achievement.medal` als `Medal?`
// regenerieren (analog zum gemeldeten Weekday-Generator-Bug), lässt sich hier
// direkt auf `session.api.listAchievements` umstellen und dieses DTO fällt weg.
struct MedalAchievement: Identifiable, Equatable, Decodable {
    let id: String
    let clubId: String
    let memberId: String
    let title: String
    let competitionName: String?
    let placement: Int?
    /// Optional: `nil` = Teilnahme ohne Medaille (Gold/Silber/Bronze sonst).
    let medal: Medal?
    /// Datum auf der Leitung als `yyyy-MM-dd` (wie die Contracts).
    let achievedOn: String
    let note: String?

    enum CodingKeys: String, CodingKey {
        case id
        case clubId = "club_id"
        case memberId = "member_id"
        case title
        case competitionName = "competition_name"
        case placement
        case medal
        case achievedOn = "achieved_on"
        case note
    }
}

// MARK: - Medaillen-Filter (Vereins-Vitrine)

/// Filter über den Vereins-Erfolgen: alle, je Medaille oder Teilnahme (ohne).
/// Reihenfolge = Anzeigereihenfolge der Segmente (edelste Medaille zuerst).
enum MedalFilter: String, CaseIterable, Identifiable {
    case all, gold, silver, bronze, none

    var id: String { rawValue }

    var labelKey: LocalizedStringKey {
        switch self {
        case .all: "medaillen.filter.all"
        case .gold: "medaillen.filter.gold"
        case .silver: "medaillen.filter.silver"
        case .bronze: "medaillen.filter.bronze"
        case .none: "medaillen.filter.none"
        }
    }

    /// Filter-Prädikat für die Vereins-Vitrine.
    func matches(_ achievement: MedalAchievement) -> Bool {
        switch self {
        case .all: return true
        case .none: return achievement.medal == nil
        case .gold: return achievement.medal == .gold
        case .silver: return achievement.medal == .silver
        case .bronze: return achievement.medal == .bronze
        }
    }
}

// MARK: - Lokalisierungs- und Format-Helfer

enum MedaillenL10n {

    /// Medaille → Wort (immer als Text daneben, nie nur über Farbe —
    /// Design-System §3.6). `nil` = Teilnahme ohne Medaille.
    static func medalLabelKey(_ medal: Medal?) -> LocalizedStringKey {
        switch medal {
        case .gold: "medaillen.medal.gold"
        case .silver: "medaillen.medal.silver"
        case .bronze: "medaillen.medal.bronze"
        case .none: "medaillen.medal.participation"
        }
    }

    /// Anzeigename „Vorname Nachname“ — lokaler Helfer (kein Cross-Feature-
    /// Coupling, kein Namens-Clash mit `ClubMember.membersFullName`).
    static func memberName(_ member: ClubMember) -> String {
        "\(member.firstName) \(member.lastName)"
    }
}

/// Datums-Formatierung des Medaillen-Features — an EINER Stelle.
/// Die Contracts liefern `achieved_on` als `yyyy-MM-dd`; hier wird konvertiert.
enum MedaillenFormat {

    /// `yyyy-MM-dd` (Leitung) — POSIX-Locale, lokale Zeitzone.
    private static let wireDay: DateFormatter = {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter
    }()

    /// „19. Juni 2026“ (de) bzw. „June 19, 2026“ (en).
    private static let displayDay: DateFormatter = {
        let formatter = DateFormatter()
        formatter.locale = .autoupdatingCurrent
        formatter.setLocalizedDateFormatFromTemplate("ddMMMMyyyy")
        return formatter
    }()

    static func parseDay(_ wire: String) -> Date? { wireDay.date(from: wire) }

    /// Wire-`Date` → `yyyy-MM-dd` (für den `achieved_on`-Body beim Anlegen).
    static func wireString(from date: Date) -> String { wireDay.string(from: date) }

    /// Anzeige-Datum; fällt bei unparsbarem Wert auf den Rohwert zurück.
    static func dayText(_ wire: String) -> String {
        guard let date = wireDay.date(from: wire) else { return wire }
        return displayDay.string(from: date)
    }
}

// MARK: - Netz-Zugriff (feature-lokaler Contract-Workaround)

extension APIClient {

    /// GET /achievements — wie `listAchievements`, aber tolerant gegenüber
    /// `medal: null` (siehe Kopf-Kommentar von `MedalAchievement`).
    func medaillenList(clubId: String, memberId: String? = nil) async throws -> [MedalAchievement] {
        var query = [URLQueryItem(name: "club_id", value: clubId)]
        if let memberId { query.append(URLQueryItem(name: "member_id", value: memberId)) }
        return try await get("/achievements", query: query)
    }

    /// POST /achievements — Erfolg vergeben (Trainerstab; sonst `Problem` 403).
    /// Request-Body ist der generierte `AchievementCreate` (unverändert genutzt);
    /// nur die Antwort wird tolerant als `MedalAchievement` decodiert.
    func medaillenCreate(_ create: AchievementCreate) async throws -> MedalAchievement {
        try await post("/achievements", body: create)
    }
}
