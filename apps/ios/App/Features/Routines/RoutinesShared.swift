import Foundation
import SwiftUI

// ============================================================================
// Gemeinsame Helfer des Küren-Moduls: Zeit-/Punkte-Formate, Status-Optik,
// kleine Chips. Honig ist hier ERLAUBT — die Küren sind der Musik-Kontext
// (DESIGN-SYSTEM §3.8). Beträge/Zeiten: Mono + monospacedDigit, echtes −.
// ============================================================================

enum RoutineFormat {

    /// "2:30" aus Millisekunden — Sekunden gerundet, wie `formatDurationMs` im Web.
    static func mmss(_ ms: Double) -> String {
        let totalSeconds = max(0, ms) / 1000
        let minutes = Int(totalSeconds / 60)
        let seconds = Int((totalSeconds - Double(minutes) * 60).rounded())
        // Rundung kann auf :60 kippen — dann sauber in die nächste Minute tragen.
        if seconds >= 60 { return "\(minutes + 1):00" }
        return String(format: "%d:%02d", minutes, seconds)
    }

    /// "0:38,2" — Mono-Timecode mit Zehnteln für die A/B-Griffe
    /// (Dezimaltrennzeichen folgt der Sprache: de „,“ / en „.“).
    static func mmssTenths(_ ms: Double) -> String {
        let totalSeconds = max(0, ms) / 1000
        let minutes = Int(totalSeconds / 60)
        let rest = totalSeconds - Double(minutes) * 60
        let whole = Int(rest)
        let tenths = Int((rest - Double(whole)) * 10)
        let separator = Locale.current.decimalSeparator ?? ","
        return String(format: "%d:%02d%@%d", minutes, whole, separator, tenths)
    }

    private static let pointsFormatter: NumberFormatter = {
        let formatter = NumberFormatter()
        formatter.numberStyle = .decimal
        formatter.minimumFractionDigits = 2
        formatter.maximumFractionDigits = 2
        return formatter
    }()

    /// RollArt-Punkte: immer 2 Nachkommastellen, lokalisiert („44,10“).
    static func points(_ value: Double) -> String {
        pointsFormatter.string(from: NSNumber(value: value)) ?? String(format: "%.2f", value)
    }

    /// Delta mit Vorzeichen und ECHTEM Minuszeichen (−, U+2212): "+1,30" / "−0,25" / "±0,00".
    static func pointsDelta(_ value: Double) -> String {
        let absText = points(Swift.abs(value))
        if value > 0 { return "+\(absText)" }
        if value < 0 { return "\u{2212}\(absText)" }
        return "±\(absText)"
    }

    private static let scoredOnParser: DateFormatter = {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter
    }()

    /// `scored_on` kommt als "yyyy-MM-dd" über die Leitung (Contracts: String).
    static func scoredOnDate(_ raw: String) -> Date? {
        scoredOnParser.date(from: raw)
    }

    private static let monthYearFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.setLocalizedDateFormatFromTemplate("MMM yyyy")
        return formatter
    }()

    /// "Jun 2026" — Achsen-/Zeilenbeschriftung im RollArt-Verlauf.
    static func monthYear(_ date: Date) -> String {
        monthYearFormatter.string(from: date)
    }

    private static let savedAtFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .short
        return formatter
    }()

    /// Zeitstempel der Notizen ("10. Juli 2026, 14:32").
    static func savedAt(_ date: Date) -> String {
        savedAtFormatter.string(from: date)
    }
}

extension RoutineStatus {

    /// Chip-Ton wie im Web (STATUS_TONE) — Status trägt IMMER Farbe UND Wort.
    var pillKind: RSMStatusKind {
        switch self {
        case .draft, .archived: .neutral
        case .ready: .success
        case .competition: .info
        }
    }

    var labelKey: LocalizedStringKey {
        switch self {
        case .draft: "routines.status.draft"
        case .ready: "routines.status.ready"
        case .competition: "routines.status.competition"
        case .archived: "routines.status.archived"
        }
    }

    /// Anzeige-Reihenfolge der Liste: aktive Küren zuerst, Archiv ans Ende.
    var sortRank: Int {
        switch self {
        case .competition: 0
        case .ready: 1
        case .draft: 2
        case .archived: 3
        }
    }
}

/// Disziplin aus der Besetzung abgeleitet: 1 = Einzellauf, 2+ = Paarlauf.
func routineDisciplineKey(skaterCount: Int) -> LocalizedStringKey {
    skaterCount >= 2 ? "routines.discipline.pair" : "routines.discipline.single"
}

/// Punkte-Delta-Chip: Mono-Ziffern, success/danger/neutral —
/// der Trend ist der motivierende Wert (DESIGN-SYSTEM §3.9).
struct RoutineDeltaChip: View {
    let delta: Double

    private var kind: RSMStatusKind {
        if delta > 0 { .success } else if delta < 0 { .danger } else { .neutral }
    }

    var body: some View {
        Text(verbatim: RoutineFormat.pointsDelta(delta))
            .font(Theme.Fonts.monoTable)
            .monospacedDigit()
            .foregroundStyle(kind.foreground)
            .padding(.horizontal, Theme.Spacing.s2)
            .padding(.vertical, 2)
            .background(kind.background)
            .clipShape(Capsule())
    }
}

/// RollArt-Kürzel-Chip (2S, SSp, StSq) — Mono, neutral getönt.
struct RoutineElementChip: View {
    let code: String

    var body: some View {
        Text(verbatim: code)
            .font(Theme.Fonts.monoTable)
            .foregroundStyle(Theme.Colors.inkSoft)
            .padding(.horizontal, Theme.Spacing.s2)
            .padding(.vertical, 2)
            .background(Theme.Colors.bgSunken)
            .clipShape(Capsule())
    }
}
