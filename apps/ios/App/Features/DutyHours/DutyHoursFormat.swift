import Foundation
import SwiftUI

/// Formatierung + Anzeige-Mappings der Pflichtstunden — reine, zustandslose
/// Helfer. Web-Referenz: apps/web/app/(portal)/pflichtstunden/{logic,i18n}.ts.
/// Runtime-Strings (mit eingesetzten Werten) laufen bewusst über
/// `NSLocalizedString` + `String(format:)`, damit sie im String Catalog
/// (DE + EN, echte Umlaute) landen.
enum DutyHoursFormat {

    /// Schmales geschütztes Leerzeichen vor der Einheit (Design-System §2.4).
    private static let narrowNBSP = "\u{202F}"

    private static let hoursFormatter: NumberFormatter = {
        let formatter = NumberFormatter()
        formatter.numberStyle = .decimal
        formatter.minimumFractionDigits = 0
        formatter.maximumFractionDigits = 2
        return formatter
    }()

    /// Stunden lokalisiert mit Einheit: „12,5 h“ (de) / „12.5 h“ (en).
    static func hours(_ value: Double) -> String {
        let number = hoursFormatter.string(from: NSNumber(value: value)) ?? "\(value)"
        return "\(number)\(narrowNBSP)h"
    }

    // MARK: - Datum

    private static let displayDateFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .none
        return formatter
    }()

    private static let isoDateParser: DateFormatter = {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = TimeZone(identifier: "UTC")
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter
    }()

    /// „2026-07-11“ → lokalisiertes Datum („11. Juli 2026“ / „11 Jul 2026“).
    /// `activity_date` ist ein reines Datum — nur der Datumsanteil zählt.
    static func entryDate(_ isoDate: String) -> String {
        let trimmed = String(isoDate.prefix(10))
        guard let date = isoDateParser.date(from: trimmed) else { return isoDate }
        return displayDateFormatter.string(from: date)
    }

    // MARK: - Art (DutyKind)

    /// Anzeigename der Art (String-Catalog-Key).
    static func kindLabelKey(_ kind: DutyKind) -> LocalizedStringKey {
        switch kind {
        case .training: "pflichtstunden.kind.training"
        case .helper: "pflichtstunden.kind.helper"
        case .competition: "pflichtstunden.kind.competition"
        case .other: "pflichtstunden.kind.other"
        }
    }

    /// Art → Status-Chip-Ton (Farbe + Wort; nie nur Farbe). Honig bleibt Musik.
    static func kindTone(_ kind: DutyKind) -> RSMStatusKind {
        switch kind {
        case .training: .info
        case .helper: .success
        case .competition: .brand
        case .other: .neutral
        }
    }

    // MARK: - Soll-Ebene + zusammengesetzte Captions

    private static func levelLabel(_ level: DutySollLevel) -> String? {
        switch level {
        case .member: return NSLocalizedString("pflichtstunden.level.member", comment: "Soll-Ebene: persönliche Regel")
        case .team: return NSLocalizedString("pflichtstunden.level.team", comment: "Soll-Ebene: Teamregel")
        case .club: return NSLocalizedString("pflichtstunden.level.club", comment: "Soll-Ebene: Vereinsregel")
        case .none: return nil
        }
    }

    /// Untertitel der Soll-Kachel: „Vereinsregel · 2025/26“ (Ebene, optional
    /// Saison). `nil`, wenn keine Regel greift. Web-Referenz: MyHoursCard.tsx.
    static func sollCaption(level: DutySollLevel, seasonLabel: String?) -> String? {
        guard let label = levelLabel(level) else { return nil }
        if let season = seasonLabel, !season.isEmpty {
            return "\(label) · \(season)"
        }
        return label
    }

    /// „davon 5 h genehmigt“ / „5 h approved“ (Untertitel der Ist-Kachel).
    static func approvedCaption(istApproved: Double) -> String {
        String(
            format: NSLocalizedString("pflichtstunden.istApprovedNote", comment: "Genehmigter Anteil"),
            hours(istApproved)
        )
    }

    /// „2 Einträge noch offen“ / „2 entries still open“ (Singular/Plural).
    static func pendingCaption(count: Int) -> String {
        let key = count == 1 ? "pflichtstunden.pending.one" : "pflichtstunden.pending.many"
        return String(format: NSLocalizedString(key, comment: "Offene Einträge"), count)
    }

    /// „12,5 h von 20 h“ / „12.5 h of 20 h“ (Fortschritts-Zeile + a11y).
    static func progressCaption(ist: Double, soll: Double) -> String {
        String(
            format: NSLocalizedString("pflichtstunden.progress.label", comment: "Ist von Soll"),
            hours(ist),
            hours(soll)
        )
    }

    /// Datum · Notiz für die Eintragszeile (Notiz optional).
    static func entryLine(date: String, note: String?) -> String {
        let dateText = entryDate(date)
        if let note, !note.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            return "\(dateText) · \(note.trimmingCharacters(in: .whitespacesAndNewlines))"
        }
        return dateText
    }
}
