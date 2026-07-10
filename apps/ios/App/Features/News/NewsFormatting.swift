import Foundation

/// Datums-Helfer des News-Features (eigener Namensraum, kollisionsfrei zu
/// anderen Feature-Teams). Wire-Format sind ISO-8601-Strings; angezeigt wird
/// vollständig lokalisiert (deutsche/englische Systemsprache).
enum NewsDate {
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

    private static let relative: RelativeDateTimeFormatter = {
        let formatter = RelativeDateTimeFormatter()
        formatter.unitsStyle = .full
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

    /// Relative Angabe, lokalisiert (z. B. „vor 3 Tagen“ / „3 days ago“).
    static func relativeText(_ iso: String) -> String {
        guard let date = date(from: iso) else { return "" }
        return relative.localizedString(for: date, relativeTo: Date())
    }
}
