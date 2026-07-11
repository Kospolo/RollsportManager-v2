import SwiftUI

/// Helfer des Übungen-Features (eigener Namensraum, kollisionsfrei zu anderen
/// Feature-Teams). Kategorie-Reihenfolge + Label-Schlüssel, Dauer-Formatierung
/// und Datum. Web-Referenz: apps/web/app/(portal)/uebungen/i18n.ts.
enum ExerciseCatalog {

    /// Anzeige-Reihenfolge der Kategorien (Web-Referenz §4).
    static let order: [ExerciseCategory] = [
        .warmup, .stretching, .strength, .jump, .spin, .steps, .combination,
    ]

    /// ExerciseCategory → lokalisierter Label-Schlüssel (Präfix „uebungen.“).
    static func labelKey(_ category: ExerciseCategory) -> LocalizedStringKey {
        switch category {
        case .warmup: "uebungen.cat.warmup"
        case .stretching: "uebungen.cat.stretching"
        case .strength: "uebungen.cat.strength"
        case .jump: "uebungen.cat.jump"
        case .spin: "uebungen.cat.spin"
        case .steps: "uebungen.cat.steps"
        case .combination: "uebungen.cat.combination"
        }
    }
}

/// Dauer-Formatierung: Sekunden → „m:ss“ (90 → „1:30“, 300 → „5:00“).
/// Identisch zum Web (`formatDurationSeconds`).
enum ExerciseDuration {
    static func format(_ totalSeconds: Int) -> String {
        let safe = max(0, totalSeconds)
        let minutes = safe / 60
        let seconds = safe % 60
        return "\(minutes):\(String(format: "%02d", seconds))"
    }
}

/// Datums-Helfer: ISO-8601-Wire-Format → lokalisiertes Absolutdatum.
enum ExerciseDate {
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

    /// Absolutes Datum, lokalisiert (z. B. „9. Juli 2026“ / „Jul 9, 2026“).
    static func absolute(_ iso: String) -> String {
        guard let date = date(from: iso) else { return "" }
        return date.formatted(date: .abbreviated, time: .omitted)
    }
}
