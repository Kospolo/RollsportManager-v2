import SwiftUI

// ============================================================================
// Reine Ableitungs-Helfer des Wartelisten-Features (Web-Referenz:
// /(portal)/wartelisten/derive.ts + i18n.ts). Arbeiten ausschließlich auf den
// generierten Contracts (Waitlist / WaitlistKind / WaitlistStatus) und den
// nachgeladenen Stammdaten — keine Netzwerk-Zugriffe, damit sich das ViewModel
// und die Views identisch verhalten lassen. Self-contained (kein Import aus
// fremden Feature-Ordnern), alle Strings über den „wartelisten.“-Namespace.
// ============================================================================

// MARK: - Art (kind) → Label · Symbol · Reihenfolge

extension WaitlistKind {
    /// Menschlicher Label-Key (String Catalog, DE+EN).
    var labelKey: LocalizedStringKey {
        switch self {
        case .facility: "wartelisten.kind.facility"
        case .equipment: "wartelisten.kind.equipment"
        case .team: "wartelisten.kind.team"
        case .event: "wartelisten.kind.event"
        }
    }

    /// SF-Symbol je Art (analog zu den Web-Icons pin/settings/teams/events).
    var systemImage: String {
        switch self {
        case .facility: "mappin.and.ellipse"
        case .equipment: "shippingbox.fill"
        case .team: "person.3.fill"
        case .event: "calendar"
        }
    }

    /// Stabile Anzeige-Reihenfolge (Filter + Gruppierung).
    static let displayOrder: [WaitlistKind] = [.facility, .equipment, .team, .event]
}

// MARK: - Status → Label · Ton · Sortier-Rang

extension WaitlistStatus {
    var labelKey: LocalizedStringKey {
        switch self {
        case .waiting: "wartelisten.status.waiting"
        case .offered: "wartelisten.status.offered"
        case .fulfilled: "wartelisten.status.fulfilled"
        case .cancelled: "wartelisten.status.cancelled"
        }
    }

    /// Chip-Ton (Design-System). „Angebot“ = warn, „Warten“ = info,
    /// „Erfüllt“ = success, „Storniert“ = neutral.
    var pillKind: RSMStatusKind {
        switch self {
        case .waiting: .info
        case .offered: .warn
        case .fulfilled: .success
        case .cancelled: .neutral
        }
    }

    /// Sortier-Rang: aktive zuerst (Angebot → Warten), erledigte zuletzt.
    var sortRank: Int {
        switch self {
        case .offered: 0
        case .waiting: 1
        case .fulfilled: 2
        case .cancelled: 3
        }
    }
}

// MARK: - Ziel-Auflösung

/// Aufgelöstes Ziel eines Eintrags fürs Anzeige-Label.
/// - `general`: kein `targetId` gesetzt → „Allgemein“.
/// - `named`: `targetId` gegen die Stammdaten aufgelöst → konkreter Name.
/// - `unknown`: `targetId` gesetzt, aber (noch) nicht auflösbar
///   (z. B. Team/Termin ohne Endpoint) → neutrales „Ziel“-Label.
enum WaitlistTarget: Equatable {
    case general
    case named(String)
    case unknown

    var labelText: Text {
        switch self {
        case .general: Text("wartelisten.target.general")
        case .named(let name): Text(verbatim: name)
        case .unknown: Text("wartelisten.target.unknown")
        }
    }
}

/// Wählbare Ziel-Option im Eintragen-Dialog.
struct WaitlistTargetOption: Identifiable, Equatable {
    let id: String
    let label: String
}

/// Nachgeladene Stammdaten zum Auflösen der `targetId` je Art. Nur Hallen und
/// Ausrüstung sind hier abbildbar (dafür existieren Endpoints); Team/Termin
/// fallen auf das neutrale „Ziel“-Label zurück, bis Endpoints bereitstehen.
struct WaitlistTargetSources: Equatable {
    var facilitiesById: [String: String] = [:]
    var equipmentById: [String: String] = [:]

    /// Menschlich lesbares Ziel eines Eintrags.
    func resolve(_ entry: Waitlist) -> WaitlistTarget {
        guard let targetId = entry.targetId, !targetId.isEmpty else { return .general }
        switch entry.kind {
        case .facility: return facilitiesById[targetId].map(WaitlistTarget.named) ?? .unknown
        case .equipment: return equipmentById[targetId].map(WaitlistTarget.named) ?? .unknown
        case .team, .event: return .unknown
        }
    }

    /// Auswählbare Ziele einer Art fürs Eintragen (leer = keine Quelle →
    /// nur allgemeiner Eintrag möglich).
    func options(for kind: WaitlistKind) -> [WaitlistTargetOption] {
        let source: [String: String]
        switch kind {
        case .facility: source = facilitiesById
        case .equipment: source = equipmentById
        case .team, .event: return []
        }
        return source
            .map { WaitlistTargetOption(id: $0.key, label: $0.value) }
            .sorted { $0.label.localizedCaseInsensitiveCompare($1.label) == .orderedAscending }
    }
}

// MARK: - Sortierung & Zählung

enum WaitlistDerive {
    /// Status zuerst (aktiv → erledigt), dann jüngste zuerst.
    static func sorted(_ entries: [Waitlist]) -> [Waitlist] {
        entries.sorted { a, b in
            if a.status.sortRank != b.status.sortRank {
                return a.status.sortRank < b.status.sortRank
            }
            return a.createdAt > b.createdAt
        }
    }

    /// Anzahl je Art (für die Filter-Chips der Warteschlange).
    static func countByKind(_ entries: [Waitlist]) -> [WaitlistKind: Int] {
        var counts: [WaitlistKind: Int] = [:]
        for entry in entries { counts[entry.kind, default: 0] += 1 }
        return counts
    }
}

// MARK: - Rollen-Gate „Trainer+"

enum WaitlistAccess {
    /// Rollen, die die Vereins-Warteschlange sehen dürfen (Komfort-Sicht;
    /// die verbindliche Durchsetzung bleibt serverseitig über RLS/403).
    /// „Trainer+" = Trainer:innen und darüber; Kassenwart:in (treasurer) ist
    /// rein finanziell und bleibt außen vor — konsistent zur Web-Sicht.
    static let queueRoles: Set<ClubRole> = [.owner, .admin, .moderator, .coach, .guestCoach]

    static func canManageQueue(_ role: ClubRole) -> Bool {
        queueRoles.contains(role)
    }
}

// MARK: - Datum (Leitung → Anzeige)

enum WaitlistDateFormat {
    private static let isoWithFraction: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter
    }()

    private static let isoPlain: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]
        return formatter
    }()

    /// `created_at` (ISO 8601, mal mit, mal ohne Millisekunden) → kurzes Datum
    /// in der aktuellen Locale. Fällt bei unparsebarer Eingabe auf den Rohwert
    /// zurück, statt zu leeren.
    static func short(_ iso: String) -> String {
        guard let date = isoWithFraction.date(from: iso) ?? isoPlain.date(from: iso) else {
            return iso
        }
        return date.formatted(date: .abbreviated, time: .omitted)
    }
}
