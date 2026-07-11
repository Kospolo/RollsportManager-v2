import Foundation
import SwiftUI

// ============================================================================
// Wettkampf-Feature: reine Anzeige-/Rechenhelfer (kein Netzwerk, kein State).
// Eigener Namensraum („Wettkampf…“) — kollisionsfrei zu den anderen parallelen
// Feature-Teams. Alle Wire-Typen kommen aus den generierten Contracts
// (Competition/CompetitionEntry/CompetitionStandingRow …); hier liegt nur, was
// die Views zum Formatieren, Gruppieren und Beschriften brauchen.
// Web-Referenz-Semantik: apps/web/app/(portal)/wettkampf/derive.ts.
// ============================================================================

// MARK: - ISO-8601 / Datum

/// Contracts lassen Zeitstempel/Datum als String auf der Leitung:
/// `starts_at`/`ends_at` sind volle Zeitstempel, `registration_deadline` und
/// `scored_on` reine Kalenderdaten (YYYY-MM-DD).
enum WettkampfDate {
    private static let isoFractional: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f
    }()

    private static let isoPlain: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime]
        return f
    }()

    /// Reines Kalenderdatum (lokale Mitternacht) — für Meldeschluss/`scored_on`.
    private static let dateOnly: DateFormatter = {
        let f = DateFormatter()
        f.calendar = Calendar(identifier: .iso8601)
        f.locale = Locale(identifier: "en_US_POSIX")
        f.timeZone = .current
        f.dateFormat = "yyyy-MM-dd"
        return f
    }()

    private static let relativeFormatter: RelativeDateTimeFormatter = {
        let f = RelativeDateTimeFormatter()
        f.unitsStyle = .full
        return f
    }()

    /// Zeitstempel (`starts_at`/`ends_at`) parsen.
    static func timestamp(from iso: String) -> Date? {
        isoFractional.date(from: iso) ?? isoPlain.date(from: iso)
    }

    /// Kalenderdatum (Meldeschluss) parsen — akzeptiert auch volle Zeitstempel.
    static func day(from iso: String) -> Date? {
        dateOnly.date(from: iso) ?? timestamp(from: iso)
    }

    /// Heute als reines Kalenderdatum „YYYY-MM-DD“ (für `saveRoutineScore.scoredOn`).
    static func todayString() -> String {
        dateOnly.string(from: Date())
    }

    /// Absolutes Datum lokalisiert (z. B. „9. Aug. 2026“ / „Aug 9, 2026“).
    static func absolute(_ iso: String) -> String {
        guard let date = timestamp(from: iso) ?? day(from: iso) else { return "" }
        return date.formatted(date: .abbreviated, time: .omitted)
    }

    /// Uhrzeit lokalisiert kurz (z. B. „14:00“) — „–“ wenn unlesbar.
    static func time(_ iso: String) -> String {
        guard let date = timestamp(from: iso) else { return "–" }
        return date.formatted(date: .omitted, time: .shortened)
    }

    /// Relative Angabe lokalisiert (z. B. „in 5 Tagen“ / „vor 2 Tagen“).
    static func relative(_ iso: String) -> String {
        guard let date = timestamp(from: iso) ?? day(from: iso) else { return "" }
        return relativeFormatter.localizedString(for: date, relativeTo: Date())
    }

    /// Ganze Kalendertage von heute bis zum Datum (negativ = vergangen); `nil`,
    /// wenn unlesbar. Grundlage für die Meldeschluss-Ampel (≤ 3 Tage = warn).
    static func dayDiff(_ iso: String) -> Int? {
        guard let target = day(from: iso) else { return nil }
        let calendar = Calendar.current
        let start = calendar.startOfDay(for: Date())
        let end = calendar.startOfDay(for: target)
        return calendar.dateComponents([.day], from: start, to: end).day
    }
}

// MARK: - RollArt-Zahlenformat

enum WettkampfScore {
    private static let number: NumberFormatter = {
        let f = NumberFormatter()
        f.numberStyle = .decimal
        f.minimumFractionDigits = 2
        f.maximumFractionDigits = 2
        return f
    }()

    /// 44.1 → „44,10“ (de) / „44.10“ (en) — immer zwei Nachkommastellen.
    static func format(_ value: Double) -> String {
        number.string(from: NSNumber(value: value)) ?? String(format: "%.2f", value)
    }

    /// Optionalwert oder Gedankenstrich („—“) für noch nicht Gewertetes.
    static func formatOptional(_ value: Double?) -> String {
        guard let value else { return "—" }
        return format(value)
    }

    /// Vorzeichenbehaftetes Delta mit echtem Minuszeichen: „+1,30“ / „−0,25“ / „±0,00“.
    static func delta(_ value: Double) -> String {
        let magnitude = format(Swift.abs(value))
        if value > 0 { return "+\(magnitude)" }
        if value < 0 { return "−\(magnitude)" }
        return "±\(magnitude)"
    }

    /// Fließkomma-sauber auf zwei Nachkommastellen (0,1er-Stepper).
    static func round2(_ value: Double) -> Double {
        (value * 100).rounded() / 100
    }
}

// MARK: - Rollen-Gate (Wertung erfassen)

enum WettkampfRoles {
    /// Wertungen erfasst nur der Trainerstab — spiegelt `COACH_ROLES` der API
    /// (services/api/src/lib/guards.ts). `member`/`treasurer`/`guest` erhalten
    /// serverseitig 403; die Durchsetzung bleibt am Server, wir blenden nur aus.
    static let scoreRoles: Set<ClubRole> = [.owner, .admin, .moderator, .coach, .guestCoach]

    static func canScore(_ role: ClubRole?) -> Bool {
        guard let role else { return false }
        return scoreRoles.contains(role)
    }
}

// MARK: - Wettkampf-Status → Pill

enum WettkampfStatusDisplay {
    static func labelKey(_ status: CompetitionStatus) -> LocalizedStringKey {
        switch status {
        case .upcoming: "wettkampf.status.upcoming"
        case .running: "wettkampf.status.running"
        case .done: "wettkampf.status.done"
        case .cancelled: "wettkampf.status.cancelled"
        }
    }

    static func pillKind(_ status: CompetitionStatus) -> RSMStatusKind {
        switch status {
        case .upcoming: .brand
        case .running: .success
        case .done: .neutral
        case .cancelled: .danger
        }
    }
}

// MARK: - Meldungen (Ableitungen über Competition.entries)

enum WettkampfEntries {
    /// Gemeldete Meldungen ohne „zurückgezogen“.
    static func activeEntries(_ competition: Competition) -> [CompetitionEntry] {
        competition.entries.filter { $0.status != .withdrawn }
    }

    /// Gemeldete Starter (aktive Meldungen).
    static func starterCount(_ competition: Competition) -> Int {
        activeEntries(competition).count
    }

    /// Distinkte gemeldete Küren (`routine_id` gesetzt).
    static func routineCount(_ competition: Competition) -> Int {
        Set(activeEntries(competition).compactMap { $0.routineId }).count
    }
}

// MARK: - Rangliste je Kategorie

/// Ein Kategorie-Block der Rangliste (Reihenfolge kommt bereits vom Server:
/// `order by category, rank, last_name`).
struct WettkampfStandingsGroup: Identifiable {
    let category: String
    let rows: [CompetitionStandingRow]

    var id: String { category }
}

enum WettkampfStandings {
    /// Bereits (Kategorie, Rang, Nachname)-sortierte Zeilen in Kategorie-Blöcke
    /// schneiden — für die Gruppen-Header, ohne die Server-Ordnung zu verändern.
    static func groups(_ rows: [CompetitionStandingRow]) -> [WettkampfStandingsGroup] {
        var result: [WettkampfStandingsGroup] = []
        for row in rows {
            if let last = result.last, last.category == row.category {
                result[result.count - 1] = WettkampfStandingsGroup(
                    category: last.category,
                    rows: last.rows + [row]
                )
            } else {
                result.append(WettkampfStandingsGroup(category: row.category, rows: [row]))
            }
        }
        return result
    }

    /// Mindestens eine Kür ist gewertet (sonst reine Startliste).
    static func hasAnyScore(_ rows: [CompetitionStandingRow]) -> Bool {
        rows.contains { $0.totalScore != nil }
    }

    /// Endstand: jede gemeldete Kür trägt eine Gesamtwertung.
    static func isFinal(_ rows: [CompetitionStandingRow]) -> Bool {
        !rows.isEmpty && rows.allSatisfy { $0.totalScore != nil }
    }

    /// Anzeigename (Vor- + Nachname) oder Kür-Titel als Fallback.
    static func skaterName(_ row: CompetitionStandingRow) -> String {
        let name = [row.firstName, row.lastName]
            .compactMap { $0 }
            .joined(separator: " ")
            .trimmingCharacters(in: .whitespaces)
        return name.isEmpty ? row.routineTitle : name
    }
}
