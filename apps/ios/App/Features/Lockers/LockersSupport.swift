import SwiftUI

// MARK: - Status-Filter

/// Auswahl der Status-Chips: Alle · frei · belegt · defekt.
/// (Enum statt Sentinel-String wie im Web — typsicher und kollisionsfrei zu
/// den anderen Feature-Teams.) Web-Referenz: schliessfaecher/i18n.ts.
enum LockerStatusFilter: Hashable {
    case all
    case status(LockerStatus)

    func matches(_ locker: Locker) -> Bool {
        switch self {
        case .all: return true
        case .status(let status): return locker.status == status
        }
    }
}

// MARK: - Anzeige-Mapping (eigener Namensraum)

/// Reines Ableitungswissen der Schließfächer: Status-Label + -Farbton und die
/// Anzeige-Reihenfolge (frei → belegt → defekt). „Status nie nur über Farbe“ —
/// der Chip trägt IMMER ein Wort. Web-Referenz: STATUS_TONE/STATUS_KEY.
enum LockerDisplay {

    /// Anzeige-Reihenfolge der Status (frei → belegt → defekt).
    static let order: [LockerStatus] = [.free, .assigned, .broken]

    static func statusLabel(_ status: LockerStatus) -> LocalizedStringKey {
        switch status {
        case .free: "schliessfaecher.status.free"
        case .assigned: "schliessfaecher.status.assigned"
        case .broken: "schliessfaecher.status.broken"
        }
    }

    /// Status → Chip-Ton (frei = grün, belegt = petrol/info, defekt = rot).
    static func statusKind(_ status: LockerStatus) -> RSMStatusKind {
        switch status {
        case .free: .success
        case .assigned: .info
        case .broken: .danger
        }
    }
}
