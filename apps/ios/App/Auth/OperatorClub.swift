import Foundation

/// Der Verein, den ein Betreiber gerade BETRETEN hat — Name/Kürzel nur zur Anzeige.
///
/// Spiegel von `OperatorClub` in apps/web/lib/data/operator-club.ts:42-46. Bewusst
/// ein schlanker Anzeige-Wert: gespeichert wird EIN Verein, mehr nicht. Er entscheidet
/// allein, welche `club_id` die Portal-Aufrufe mitschicken (siehe `SessionStore.clubId`).
/// Es ist KEIN Rechte-Trick — der Server (`requirePlatformAdmin` + operator-access,
/// Migration 0051) lässt den Betreiber hinein UND protokolliert jeden Zugriff.
///
/// `Equatable`, damit `@Published var operatorClub` in `MainTabView` sauber per
/// `.onChange` beobachtet werden kann (Betreten/Verlassen → Navigation).
struct OperatorClub: Equatable {
    let id: String
    let name: String
    let shortName: String?

    init(id: String, name: String, shortName: String? = nil) {
        self.id = id
        self.name = name
        self.shortName = shortName
    }

    /// Aus einer Vereinszeile der Betreiber-Konsole (`GET /platform/clubs`).
    init(club: PlatformClub) {
        self.id = club.id
        self.name = club.name
        self.shortName = club.shortName
    }

    /// Anzeige-Label: „Verein (Kürzel)" wenn ein Kürzel da ist, sonst nur der Name.
    var label: String {
        if let shortName, !shortName.isEmpty {
            return "\(name) (\(shortName))"
        }
        return name
    }
}
