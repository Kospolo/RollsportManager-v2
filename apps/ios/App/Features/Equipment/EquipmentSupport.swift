import SwiftUI
import Foundation

// MARK: - ISO-8601 (Contracts lassen Timestamps als String auf der Leitung)

/// Eigener Namensraum (kollisionsfrei zu anderen Feature-Teams). Parst API-
/// Timestamps mit und ohne Millisekunden und serialisiert `date-time`-Werte
/// für `createReservation` (der Server validiert strikt `date-time`).
enum EquipmentISO {
    private static let withFractionalSeconds: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter
    }()

    private static let plain: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]
        return formatter
    }()

    static func date(from string: String) -> Date? {
        withFractionalSeconds.date(from: string) ?? plain.date(from: string)
    }

    /// `Date` → voller ISO-8601-`date-time`-String (UTC „Z“), analog `EventsISO`.
    static func string(from date: Date) -> String {
        plain.string(from: date)
    }
}

// MARK: - Anzeige-Mapping (eigener Namensraum)

/// Reines Ableitungswissen der Ausrüstung: Zustands-/Status-Labels und
/// -Farbtöne, verfügbare Menge (Reservier-Obergrenze), Sortier-Gewicht der
/// Reservierungen und die Zeitraum-Anzeige. Web-Referenz: ausruestung/i18n.ts.
enum EquipmentDisplay {

    // Zustand → Label + Ton (Status nie nur über Farbe: Chip trägt ein Wort).
    static func conditionLabel(_ condition: EquipmentCondition) -> LocalizedStringKey {
        switch condition {
        case .good: "ausruestung.cond.good"
        case .fair: "ausruestung.cond.fair"
        case .defect: "ausruestung.cond.defect"
        }
    }

    static func conditionKind(_ condition: EquipmentCondition) -> RSMStatusKind {
        switch condition {
        case .good: .success
        case .fair: .warn
        case .defect: .danger
        }
    }

    // Reservierungs-Status → Label + Ton.
    static func statusLabel(_ status: ReservationStatus) -> LocalizedStringKey {
        switch status {
        case .active: "ausruestung.status.active"
        case .returned: "ausruestung.status.returned"
        case .cancelled: "ausruestung.status.cancelled"
        }
    }

    static func statusKind(_ status: ReservationStatus) -> RSMStatusKind {
        switch status {
        case .active: .success
        case .returned: .neutral
        case .cancelled: .warn
        }
    }

    /// Sortier-Gewicht: aktiv zuerst, danach zurückgegeben/storniert.
    static func statusWeight(_ status: ReservationStatus) -> Int {
        switch status {
        case .active: 0
        case .returned: 1
        case .cancelled: 2
        }
    }

    /// Verfügbare Menge (Obergrenze fürs Reservieren): explizit verfügbar,
    /// sonst Gesamtbestand, sonst `nil` (Bestand nicht erfasst).
    static func availableCap(_ equipment: Equipment) -> Int? {
        equipment.availableQuantity ?? equipment.totalQuantity
    }

    // MARK: - Zeitraum

    private static let rangeFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.locale = .autoupdatingCurrent
        formatter.dateStyle = .short
        formatter.timeStyle = .short
        return formatter
    }()

    /// „11.07.26, 13:00 – 11.07.26, 15:00“ — parst die beiden ISO-Strings und
    /// gibt bei nicht parsebaren Werten den Rohwert zurück (nie leer).
    static func periodText(from: String, to: String) -> String {
        let left = EquipmentISO.date(from: from).map(rangeFormatter.string(from:)) ?? from
        let right = EquipmentISO.date(from: to).map(rangeFormatter.string(from:)) ?? to
        return "\(left) – \(right)"
    }

    /// Vorbelegung fürs Reservieren: nächste volle Stunde bis +2 h
    /// (identisch zur Web-Referenz `defaultReserveRange`).
    static func defaultRange(now: Date = Date()) -> (from: Date, to: Date) {
        let calendar = Calendar.current
        var comps = calendar.dateComponents([.year, .month, .day, .hour], from: now)
        comps.minute = 0
        comps.second = 0
        let base = calendar.date(from: comps) ?? now
        let from = calendar.date(byAdding: .hour, value: 1, to: base) ?? now
        let to = calendar.date(byAdding: .hour, value: 2, to: from) ?? from
        return (from, to)
    }
}

// MARK: - Kategorie-Filter

/// Auswahl der Kategorie-Chips: Alle · konkrete Kategorie · Ohne Kategorie.
/// (Enum statt Sentinel-String wie im Web — typsicher und kollisionsfrei.)
enum EquipmentCategoryFilter: Hashable {
    case all
    case category(String)
    case uncategorized
}
